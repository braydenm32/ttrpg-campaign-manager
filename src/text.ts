/** Text with [[links]] as plain names and pictures from the world's files left out (for previews, search, exports and Discord). */
export const plainLinks = (text: string) =>
  asLetters(text).replace(/!\[[^\]]*\]\(asset:[^)]*\)/g, '').replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, name: string, label?: string) => label ?? name)

/**
 * Character codes ("&#x64;", "&#100;") as the letters they stand for. The formatted editor writes a
 * letter that way where it touches bold or italic words that start or end with a mark ("Bra&#x6E;**'s**"),
 * so that the Markdown reads back right; anything that reads the text as plain words (search, previews,
 * Discord) reads that letter. A code written with a backslash before it ("\&#x64;") stays as typed.
 */
export const asLetters = (text: string) =>
  text.includes('&#')
    ? text.replace(/(?<!\\)&#(?:x([0-9a-f]{1,6})|(\d{1,7}));/gi, (m, hex?: string, dec?: string) => {
        const code = hex ? parseInt(hex, 16) : Number(dec)
        return code > 0 && code < 0x110000 && !(code >= 0xd800 && code < 0xe000) ? String.fromCodePoint(code) : m
      })
    : text

/** One or two letters for a page without a picture. */
export function initials(name: string) {
  const words = name.replace(/^(the|a|an)\s+/i, '').split(/\s+/).filter(Boolean)
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase() || '?'
}

/** A saved day ("2026-10-25") the way the Common Room writes dates: "Sat, 25 Oct 2026". Anything else is left as typed. */
export function showDay(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

/** "active" as "Active" (for words that come straight from the data). */
export const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)
