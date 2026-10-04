import type { RenderElement } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { linkify, repoUrlFromRemote } from './linkify'

const REPO = 'https://github.com/acme/site'

test('links a bare PR number', () => {
  expect(linkify('Opened PR #641 and (#12).', REPO)).toBe(
    `Opened PR [#641](${REPO}/pull/641) and ([#12](${REPO}/pull/12)).`,
  )
})

test('leaves code, existing links and URLs alone', () => {
  const text = [
    '`#1`',
    '```\n#2\n```',
    `[#3](${REPO}/pull/3)`,
    `${REPO}/pull/4#5`,
    'acme/other#6',
    'color: &#39;',
  ].join('\n')

  expect(linkify(text, REPO)).toBe(text)
})

test('reads the repo from ssh and https remotes', () => {
  expect(repoUrlFromRemote('git@github.com:acme/site.git\n')).toBe(REPO)
  expect(repoUrlFromRemote('https://github.com/acme/site\n')).toBe(REPO)
  expect(repoUrlFromRemote('git@gitlab.com:acme/site.git\n')).toBe(undefined)
})

test('rewrites an assistant message through the hook', async ($, on) => {
  const drawn: string[] = []

  on('session.cwd', () => ({ value: '/repo' }))
  on('process.run', () => ({
    value: {
      exitCode: 0,
      stdout: 'git@github.com:acme/site.git\n',
      stderr: '',
      isStdoutTruncated: false,
      isStderrTruncated: false,
    },
  }))
  on('ui.render', { component: 'AssistantMessage' }, ($$, e) => {
    drawn.push(e.props.text)

    return h($$.ui.resolve(e).Text, null, e.props.text) as RenderElement
  })

  await $.ui.render({
    component: 'AssistantMessage',
    surface: 'terminal',
    requestId: 'm1',
    props: { text: 'Merged #7.', isFirstOfReply: true },
  })

  expect(drawn).toEqual([`Merged [#7](${REPO}/pull/7).`])
})
