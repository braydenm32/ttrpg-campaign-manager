/** Text with [[links]] as plain names and pictures from the world's files left out (for previews, exports and Discord). */
export const plainLinks = (text: string) =>
  text.replace(/!\[[^\]]*\]\(asset:[^)]*\)/g, '').replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, name: string, label?: string) => label ?? name)
