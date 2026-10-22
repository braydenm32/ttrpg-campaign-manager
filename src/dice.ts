/**
 * A small dice roller. Understands things like "d20", "2d6+3", "4d6kh3" (keep the highest 3),
 * "2d20kl1" (disadvantage), "d%" and plain numbers, joined with + and -.
 */

export interface Roll {
  expr: string
  total: number
  /** Human-readable breakdown, e.g. "2d6 [3, 5] + 3". */
  detail: string
  /** A natural 20 or natural 1 on a single d20, for highlighting. */
  crit?: 'high' | 'low'
}

/** A fair random integer from 1 to sides. */
export function rollDie(sides: number) {
  const buf = new Uint32Array(1)
  const limit = Math.floor(0x100000000 / sides) * sides
  do crypto.getRandomValues(buf)
  while (buf[0] >= limit)
  return (buf[0] % sides) + 1
}

const TERM = /^(\d*)d(\d+|%)(?:(kh|kl)(\d+))?$|^(\d+)$/

export function roll(input: string): Roll {
  const expr = input.toLowerCase().replace(/\s+/g, '')
  if (!expr) throw new Error('Type something to roll, like 2d6+3')
  const parts = expr.match(/[+-]?[^+-]+/g)
  if (!parts || parts.join('') !== expr) throw new Error(`Couldn't read "${input}"`)
  let total = 0
  let crit: Roll['crit']
  const detail: string[] = []
  for (const [i, part] of parts.entries()) {
    const sign = part.startsWith('-') ? -1 : 1
    const body = part.replace(/^[+-]/, '')
    const m = body.match(TERM)
    if (!m) throw new Error(`Couldn't read "${body}". Try something like 2d6+3`)
    const op = i === 0 ? (sign < 0 ? '-' : '') : sign < 0 ? ' - ' : ' + '
    if (m[5]) {
      total += sign * Number(m[5])
      detail.push(op + m[5])
      continue
    }
    const count = m[1] ? Number(m[1]) : 1
    const sides = m[2] === '%' ? 100 : Number(m[2])
    if (count < 1 || count > 100) throw new Error('Roll between 1 and 100 dice at a time')
    if (sides < 2 || sides > 1000) throw new Error('Dice need between 2 and 1000 sides')
    const rolls = Array.from({ length: count }, () => rollDie(sides))
    let kept = rolls.map((_, j) => j)
    if (m[3]) {
      const keep = Math.min(Number(m[4]), count)
      const order = kept.sort((a, b) => (m[3] === 'kh' ? rolls[b] - rolls[a] : rolls[a] - rolls[b]))
      kept = order.slice(0, keep)
    }
    const keptSet = new Set(kept)
    const sum = rolls.reduce((s, r, j) => (keptSet.has(j) ? s + r : s), 0)
    total += sign * sum
    const shown = rolls.map((r, j) => (keptSet.has(j) ? `${r}` : `~~${r}~~`)).join(', ')
    detail.push(`${op}${body} [${shown}]`)
    if (sides === 20 && kept.length === 1) {
      const nat = rolls[kept[0]]
      if (nat === 20) crit = 'high'
      else if (nat === 1) crit = 'low'
    }
  }
  return { expr: input.trim(), total, detail: detail.join(''), crit }
}

/** Turns "+2", "2", "-1" or "Dex +3" into a number, or 0 if there isn't one. */
export function modifierFrom(text: string | undefined) {
  const m = text?.match(/[+-]?\s*\d+/)
  return m ? Number(m[0].replace(/\s/g, '')) : 0
}
