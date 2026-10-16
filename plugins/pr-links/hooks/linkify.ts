import type { SessionMessage } from 'claude-code'

// Code fences, inline code, existing markdown links and bare URLs are matched
// first so a number inside them is left alone. `owner/repo#12` names its repo.
const PATTERN =
  /(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*`|\[[^\]\n]*\]\([^)\n]*\)|https?:\/\/\S+)|(?<![\w./-])([\w.-]+\/[\w.-]+)#(\d{1,6})\b|(?<![\w&#/])#(\d{1,6})\b/g

const QUALIFIED_REF = /(?<![\w./-])([\w.-]+\/[\w.-]+)#(\d{1,6})\b/g
const GITHUB_REF = /github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/(?:pull|issues)\/(\d+)/g
const REPO_FLAG = /(?:--repo[= ]|-R ?)["']?([\w.-]+)\/([\w.-]+?)["']?(?=[\s;&|)]|$)/g
const CD = /(?:^|[;&|(]\s*)cd\s+("[^"]+"|'[^']+'|[^\s;&|)]+)/g
const GIT_C = /\bgit\s+-C\s+("[^"]+"|'[^']+'|\S+)/g

/**
 * Something in the transcript that points at a repository: its URL outright
 * (with the PR or issue number it was seen with, if any), or a directory whose
 * git remote names it.
 */
export type Signal = { repoUrl: string; number?: string } | { dir: string }

export function linkify(text: string, urlFor: (number: string) => string | undefined): string {
  return text.replace(
    PATTERN,
    (match, skipped: string | undefined, repo: string | undefined, repoNumber: string, number: string) => {
      if (skipped !== undefined) {
        return match
      }

      if (repo !== undefined) {
        return `[${repo}#${repoNumber}](https://github.com/${repo}/pull/${repoNumber})`
      }

      const repoUrl = urlFor(number)

      return repoUrl === undefined ? match : `[#${number}](${repoUrl}/pull/${number})`
    },
  )
}

/**
 * The bare `#N` numbers in the text that linkify would link.
 */
export function bareNumbers(text: string): string[] {
  const numbers = new Set<string>()

  for (const found of text.matchAll(PATTERN)) {
    if (found[4] !== undefined) {
      numbers.add(found[4])
    }
  }

  return [...numbers]
}

export function repoUrlFromRemote(remote: string): string | undefined {
  const found = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?\s*$/.exec(remote)

  return found === null ? undefined : `https://github.com/${found[1]}/${found[2]}`
}

/**
 * Every repository signal in the messages, oldest first.
 */
export function signalsFrom(messages: SessionMessage[]): Signal[] {
  const signals: Signal[] = []

  for (const message of messages) {
    signals.push(...githubRefs(message.text), ...qualifiedRefs(message.text))

    for (const use of message.toolUses) {
      signals.push(...signalsInToolInput(use.input), ...githubRefs(use.text ?? ''))
    }
  }

  return signals
}

function signalsInToolInput(input: Record<string, unknown>): Signal[] {
  const signals: Signal[] = []

  if (typeof input.owner === 'string' && typeof input.repo === 'string') {
    const number = input.pull_number ?? input.pullNumber ?? input.issue_number ?? input.number

    signals.push({
      repoUrl: `https://github.com/${input.owner}/${input.repo}`,
      number: number === undefined ? undefined : String(number),
    })
  }

  for (const key of ['file_path', 'notebook_path', 'path']) {
    const path = input[key]

    if (typeof path === 'string' && path.startsWith('/')) {
      signals.push({ dir: key === 'path' ? path : path.replace(/\/[^/]*$/, '') || '/' })
    }
  }

  if (typeof input.command === 'string') {
    const command = input.command
    const found: { index: number; signal: Signal }[] = [
      ...[...command.matchAll(CD), ...command.matchAll(GIT_C)].map(match => ({
        index: match.index ?? 0,
        signal: { dir: unquote(match[1] ?? '') },
      })),
      ...[...command.matchAll(REPO_FLAG)].map(match => ({
        index: match.index ?? 0,
        signal: { repoUrl: `https://github.com/${match[1]}/${match[2]}` },
      })),
    ]

    signals.push(...found.sort((a, b) => a.index - b.index).map(entry => entry.signal), ...githubRefs(command))
  }

  return signals
}

function githubRefs(text: string): Signal[] {
  return [...text.matchAll(GITHUB_REF)].map(found => ({
    repoUrl: `https://github.com/${found[1]}/${found[2]}`,
    number: found[3],
  }))
}

function qualifiedRefs(text: string): Signal[] {
  return [...text.matchAll(QUALIFIED_REF)].map(found => ({
    repoUrl: `https://github.com/${found[1]}`,
    number: found[2],
  }))
}

function unquote(value: string): string {
  return value.replace(/^(["'])(.*)\1$/, '$2')
}
