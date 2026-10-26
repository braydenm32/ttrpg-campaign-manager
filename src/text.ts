/** Text with [[links]] as plain names and pictures from the world's files left out (for previews, exports and Discord). */
export const plainLinks = (text: string) =>
  text.replace(/!\[[^\]]*\]\(asset:[^)]*\)/g, '').replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, name: string, label?: string) => label ?? name)

/** One or two letters for a page without a picture. */
export function initials(name: string) {
  const words = name.replace(/^(the|a|an)\s+/i, '').split(/\s+/).filter(Boolean)
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase() || '?'
}
