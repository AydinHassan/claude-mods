import type { EngineInterface as Engine, Register } from 'claude-code'
import { bareNumbers, linkify, repoUrlFromRemote, type Signal, signalsFrom } from './linkify'

const MAX_DIR_LOOKUPS = 20
const MAX_REMEMBERED = 500

const remotes = new Map<string, Promise<string | undefined>>()
const linked = new Map<string, Promise<string>>()

function remoteOf($: Engine, dir: string, cwd: string): Promise<string | undefined> {
  let remote = remotes.get(dir)

  if (remote === undefined) {
    remote = $.process
      .run(['sh', '-c', 'p=$1; case $p in "~"*) p="$HOME${p#"~"}";; esac; git -C "$p" remote get-url origin', 'sh', dir], {
        cwd,
      })
      .then(ran => (ran.exitCode === 0 ? repoUrlFromRemote(ran.stdout) : undefined))
      .catch(() => undefined)
    remotes.set(dir, remote)
  }

  return remote
}

/**
 * The newest repo the signals point at, else the session directory's remote.
 */
async function latestRepo($: Engine, signals: Signal[], cwd: string): Promise<string | undefined> {
  let lookups = 0

  for (const signal of signals) {
    if ('repoUrl' in signal) {
      return signal.repoUrl
    }

    if (lookups++ < MAX_DIR_LOOKUPS) {
      const remote = await remoteOf($, signal.dir, cwd)

      if (remote !== undefined) {
        return remote
      }
    }
  }

  return remoteOf($, cwd, cwd)
}

/**
 * Links each bare `#N` to the repo the conversation was about when the block
 * was written: a PR or issue URL seen with that number, else the newest repo
 * the transcript points at, else the session directory's remote.
 */
async function resolve($: Engine, text: string): Promise<string> {
  const cwd = await $.session.cwd()
  const messages = await $.session.messages().catch(() => [])
  const probe = text.trim().slice(0, 200)
  const at = messages.findLastIndex(message => message.role === 'assistant' && message.text.includes(probe))
  const signals = signalsFrom(at === -1 ? messages : messages.slice(0, at + 1)).reverse()
  const urls = new Map<string, string>()
  let latest: Promise<string | undefined> | undefined

  for (const number of bareNumbers(text)) {
    const exact = signals.find(signal => 'repoUrl' in signal && signal.number === number)
    const url = exact !== undefined && 'repoUrl' in exact ? exact.repoUrl : await (latest ??= latestRepo($, signals, cwd))

    if (url !== undefined) {
      urls.set(number, url)
    }
  }

  return linkify(text, number => urls.get(number))
}

function linkedText($: Engine, text: string): Promise<string> {
  let rewritten = linked.get(text)

  if (rewritten === undefined) {
    rewritten = resolve($, text).catch(() => text)
    linked.set(text, rewritten)

    if (linked.size > MAX_REMEMBERED) {
      linked.delete(linked.keys().next().value!)
    }
  }

  return rewritten
}

export const register: Register = on => {
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (!/#\d/.test(e.props.text)) {
      return next(e)
    }

    return next({ ...e, props: { ...e.props, text: await linkedText($, e.props.text) } })
  })
}
