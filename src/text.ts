/** Turns "[[Name]]" and "[[Name|label]]" into plain words, for one-line summaries. */
export const plainLinks = (text: string) => text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, name: string, label?: string) => label ?? name)
