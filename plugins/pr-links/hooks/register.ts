import type { Register } from 'claude-code'
import { linkify, repoUrlFromRemote } from './linkify'

export const register: Register = on => {
  const repoUrls = new Map<string, Promise<string | undefined>>()

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (!/#\d/.test(e.props.text)) {
      return next(e)
    }

    const cwd = await $.session.cwd()
    let repoUrl = repoUrls.get(cwd)

    if (repoUrl === undefined) {
      repoUrl = $.process
        .run(['git', 'remote', 'get-url', 'origin'], { cwd })
        .then(ran => (ran.exitCode === 0 ? repoUrlFromRemote(ran.stdout) : undefined))
        .catch(() => undefined)
      repoUrls.set(cwd, repoUrl)
    }

    const url = await repoUrl

    return url === undefined ? next(e) : next({ ...e, props: { ...e.props, text: linkify(e.props.text, url) } })
  })
}
