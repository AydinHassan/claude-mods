# claude-mods

A [Claude Code](https://claude.com/claude-code) plugin marketplace with my mods.

## Install

```
claude plugin marketplace add AydinHassan/claude-mods
claude plugin install pr-links@aydin-mods
```

## Mods

### pr-links

Turns `#123` in Claude's replies into a clickable link to that pull request on GitHub.

Each bare `#123` is linked to the repo the conversation was about when the reply was written, taken from the transcript up to that reply:

1. a PR or issue URL with that same number (e.g. the output of `gh pr create`);
2. otherwise the newest repo the transcript points at: `--repo`/`-R owner/repo`, GitHub MCP `owner`/`repo` arguments, a `github.com/owner/repo/pull|issues/N` URL, a `cd` or `git -C` directory in a Bash command, or the directory of a file read or edited (directories go through `git remote get-url origin`);
3. otherwise the remote of the session's working directory.

`owner/repo#123` is always linked to `owner/repo`. Links point at `/pull/123`, which GitHub redirects to the issue when the number belongs to an issue.

Limits:

- Only Claude's reply text is rewritten. Tool output, such as a `gh pr list` result, is left as it is.
- Only GitHub remotes are supported. With any other remote the text is not changed.
- Numbers inside code, existing links and URLs are left alone. A bare all-digit hex colour such as `#333` outside code is linked like a PR number.
