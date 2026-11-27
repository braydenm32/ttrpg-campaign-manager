/**
 * Secret passages in the app's text, read line by line: ":::gm" … ":::" (GM only), ":::for Name" …
 * ":::" (for some players' characters) and ":::foryou" (a player's own copy). No screen code here, so
 * the page view (src/Markdown.tsx), the text boxes and the formatted editor (src/editor) all read
 * passages the same way. Keep in step with public.player_text in supabase/migrations, which decides
 * what players receive.
 */

export type Segment = { kind: 'text' | 'gm' | 'foryou'; body: string } | { kind: 'for'; names: string[]; body: string }

/** The character names in a ":::for" line: split by commas, "&" or "and"; a trailing ":::" is ignored. */
export function forNames(spec: string) {
  return spec
    .replace(/[ \t]*:::[ \t]*$/, '')
    .trim()
    .split(/[ \t]*(?:,|&|\band\b)[ \t]*/i)
    .map((n) => n.trim())
    .filter(Boolean)
}

/** A line that opens a secret passage: ":::gm", ":::for …" or ":::foryou", forgiving of case and spaces. */
const OPENER = /^[ \t]*:::[ \t]*(foryou|gm|for)(?![a-z0-9])(.*)$/i
export const CLOSER = /^[ \t]*:::[ \t]*$/

/** Reads an opener line: its kind, and for a one-line passage its text (and names). */
export function readOpener(line: string): { kind: 'gm' | 'for' | 'foryou'; names: string[]; one?: string; first?: string } | null {
  const m = line.match(OPENER)
  if (!m) {
    // Older player copies hold one-line passages as ":::foryouText:::".
    const legacy = line.match(/^:::foryou(\S.*?):::[ \t]*$/)
    return legacy ? { kind: 'foryou', names: [], one: legacy[1].trim() } : null
  }
  const kind = m[1].toLowerCase() as 'gm' | 'for' | 'foryou'
  const rest = m[2]
  if (kind === 'for') {
    const one = rest.match(/^[ \t]+(.+?):::(.*):::[ \t]*$/)
    if (one) return { kind, names: forNames(one[1]), one: one[2].trim() }
    return { kind, names: forNames(rest.replace(/^[ \t:]*/, '')) }
  }
  const one = rest.match(/^[: \t]*([^: \t].*?)[ \t]*:::[ \t]*$/)
  // ":::gm The innkeeper is a spy" with no closing marker opens a block that starts with that text.
  return { kind, names: [], one: one?.[1], first: rest.replace(/^[: \t]*/, '') }
}

/**
 * Splits text into ordinary text and secret passages, line by line:
 *  - ":::gm" up to a ":::" line is for the GM only. Any line starting ":::gm" opens one, even with
 *    text after it, and a missing closing line keeps the rest secret, so a typo never leaks.
 *    ":::GM", "::: gm" and indented markers count too.
 *  - ":::for Wren and Silas" up to ":::" is for the players of those characters only.
 *  - Either fits on one line too: ":::gm::: The innkeeper is a spy :::".
 *  - ":::foryou" is what a player's copy holds for a ":::for" passage meant for them.
 *  - Passages can sit inside each other: a ":::" closes the innermost one, so a secret inside a
 *    secret never ends the outer one early. A passage's body keeps its inner markers.
 * Keep in step with public.player_text in supabase/migrations, which decides what players receive.
 */
export function splitSecrets(text: string): Segment[] {
  const out: Segment[] = []
  let open: Segment | null = null
  let depth = 0
  const push = (line: string) => {
    const last = out[out.length - 1]
    if (last?.kind === 'text') last.body += '\n' + line
    else out.push({ kind: 'text', body: line })
  }
  // A lone "\r" ends a line too, the same as in public.player_text, so the app and the server
  // always read the same lines (a stray "\r" once let the server end a secret the app kept closed).
  for (const line of text.split(/\r\n?|\n/)) {
    const opener = readOpener(line)
    if (open) {
      if (CLOSER.test(line)) depth--
      else if (opener && opener.one === undefined) depth++
      if (depth === 0) {
        out.push(open)
        open = null
      } else open.body += (open.body ? '\n' : '') + line
      continue
    }
    if (!opener) {
      push(line)
      continue
    }
    const seg: Segment =
      opener.kind === 'for' ? { kind: 'for', names: opener.names, body: opener.one ?? '' } : { kind: opener.kind, body: opener.one ?? opener.first ?? '' }
    if (opener.one !== undefined) out.push(seg)
    else {
      open = seg
      depth = 1
    }
  }
  if (open) out.push(open)
  return out
}
