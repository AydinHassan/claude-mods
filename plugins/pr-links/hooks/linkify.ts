// Code fences, inline code, existing markdown links and bare URLs are matched
// first so a number inside them is left alone.
const PATTERN =
  /(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*`|\[[^\]\n]*\]\([^)\n]*\)|https?:\/\/\S+)|(?<![\w&#/])#(\d{1,6})\b/g

export function linkify(text: string, repoUrl: string): string {
  return text.replace(PATTERN, (match, skipped: string | undefined, number: string) =>
    skipped === undefined ? `[#${number}](${repoUrl}/pull/${number})` : match,
  )
}

export function repoUrlFromRemote(remote: string): string | undefined {
  const found = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?\s*$/.exec(remote)

  return found === null ? undefined : `https://github.com/${found[1]}/${found[2]}`
}
