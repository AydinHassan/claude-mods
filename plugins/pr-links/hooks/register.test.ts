import type { RenderElement, SessionMessage } from 'claude-code'
import { type TestBody, expect, test } from 'claude-code/testing'
import { linkify, repoUrlFromRemote, signalsFrom } from './linkify'

const REPO = 'https://github.com/acme/site'
const OTHER = 'https://github.com/acme/api'

const always = () => REPO

const assistant = (text: string, toolUses: SessionMessage['toolUses'] = []): SessionMessage => ({
  role: 'assistant',
  text,
  toolUses,
})

const bash = (command: string, text = ''): SessionMessage['toolUses'][number] => ({
  tool_use_id: command,
  tool: 'Bash',
  input: { command },
  text,
})

test('links a bare PR number', () => {
  expect(linkify('Opened PR #641 and (#12).', always)).toBe(
    `Opened PR [#641](${REPO}/pull/641) and ([#12](${REPO}/pull/12)).`,
  )
})

test('links owner/repo#N to that repo', () => {
  expect(linkify('See acme/api#6.', always)).toBe(`See [acme/api#6](${OTHER}/pull/6).`)
})

test('leaves code, existing links and URLs alone', () => {
  const text = ['`#1`', '```\n#2\n```', `[#3](${REPO}/pull/3)`, `${REPO}/pull/4#5`, 'color: &#39;'].join('\n')

  expect(linkify(text, always)).toBe(text)
})

test('reads the repo from ssh and https remotes', () => {
  expect(repoUrlFromRemote('git@github.com:acme/site.git\n')).toBe(REPO)
  expect(repoUrlFromRemote('https://github.com/acme/site\n')).toBe(REPO)
  expect(repoUrlFromRemote('git@gitlab.com:acme/site.git\n')).toBe(undefined)
})

test('finds repo signals in tool calls, oldest first', () => {
  const signals = signalsFrom([
    assistant('', [
      { tool_use_id: 'r', tool: 'Read', input: { file_path: '/code/site/app.php' } },
      bash('cd ~/code/api && gh pr create --fill', `${OTHER}/pull/9\n`),
      bash('gh pr view 3 -R acme/docs'),
    ]),
  ])

  expect(signals).toEqual([
    { dir: '/code/site' },
    { dir: '~/code/api' },
    { repoUrl: OTHER, number: '9' },
    { repoUrl: 'https://github.com/acme/docs' },
  ])
})

const renderWith = async (
  $: Parameters<TestBody>[0],
  on: Parameters<TestBody>[1],
  messages: SessionMessage[],
  remotes: Record<string, string>,
  text: string,
): Promise<string[]> => {
  const drawn: string[] = []

  on('session.cwd', () => ({ value: '/cwd' }))
  on('session.messages', () => ({ value: messages }))
  on('process.run', (_$, e) => {
    const remote = remotes[e.argv.at(-1) ?? '']

    return {
      value: {
        exitCode: remote === undefined ? 128 : 0,
        stdout: remote ?? '',
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })
  on('ui.render', { component: 'AssistantMessage' }, ($$, e) => {
    drawn.push(e.props.text)

    return h($$.ui.resolve(e).Text, null, e.props.text) as RenderElement
  })

  await $.ui.render({
    component: 'AssistantMessage',
    surface: 'terminal',
    requestId: 'm1',
    props: { text, isFirstOfReply: true },
  })

  return drawn
}

test('uses the repo the conversation moved to, not the session directory', async ($, on) => {
  const drawn = await renderWith(
    $,
    on,
    [assistant('', [bash('cd /code/api && git push')]), assistant('Merged #7.')],
    { '/cwd': 'git@github.com:acme/site.git\n', '/code/api': 'git@github.com:acme/api.git\n' },
    'Merged #7.',
  )

  expect(drawn).toEqual([`Merged [#7](${OTHER}/pull/7).`])
})

test('a PR URL seen with the number wins over the newest repo', async ($, on) => {
  const drawn = await renderWith(
    $,
    on,
    [
      assistant('', [bash('gh pr create --fill', `${OTHER}/pull/12\n`)]),
      assistant('', [bash('cd /code/site && git status')]),
      assistant('Opened #12, see also #13.'),
    ],
    { '/code/site': 'git@github.com:acme/site.git\n' },
    'Opened #12, see also #13.',
  )

  expect(drawn).toEqual([`Opened [#12](${OTHER}/pull/12), see also [#13](${REPO}/pull/13).`])
})

test('falls back to the session directory remote', async ($, on) => {
  const drawn = await renderWith(
    $,
    on,
    [assistant('Merged #7.')],
    { '/cwd': 'git@github.com:acme/site.git\n' },
    'Merged #7.',
  )

  expect(drawn).toEqual([`Merged [#7](${REPO}/pull/7).`])
})
