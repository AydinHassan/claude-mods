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

The repository is read from `git remote get-url origin` in the session's working directory. Links point at `/pull/123`, which GitHub redirects to the issue when the number belongs to an issue.

Limits:

- Only Claude's reply text is rewritten. Tool output, such as a `gh pr list` result, is left as it is.
- Only GitHub remotes are supported. With any other remote the text is not changed.
- Numbers inside code, existing links and URLs are left alone. A bare all-digit hex colour such as `#333` outside code is linked like a PR number.
