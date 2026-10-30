import type { Entity, RollCall } from './db'

/**
 * Calling for a roll: the GM asks some or all of the party to roll ("everyone roll Perception,
 * DC 15") and gets everyone's results in one list. Typed as a line, it reads like
 * "@all roll perception 15", "@Wren @Silas stealth dc 12 secret" or "@all d20+2 strength".
 */

export interface ParsedCall {
  /** Character page ids; empty means the whole party. */
  to: string[]
  label: string
  dice: string
  dc?: number
  secret: boolean
  /** Names after @ that matched no one in the party. */
  unknown: string[]
}

const DICE = /^\d*d\d+(?:k[hl]\d+)?(?:[+-]\d+)*$/i
const EVERYONE = ['all', 'everyone', 'party', 'everybody', 'table']
const SECRET = ['secret', 'secretly', 'hidden', 'private', 'quietly']
const FILLER = ['roll', 'rolls', 'a', 'an', 'for', 'check', 'save', 'saving', 'throw', 'please', 'make', 'me', 'give', 'the', 'vs', 'against', 'with']

/** Reads a typed call. Returns null when there's nothing to roll for. */
export function parseCall(line: string, party: Entity[]): ParsedCall | null {
  const words = line
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/^[-–—]+/, '').replace(/[,.;!?]+$/, ''))
    .filter(Boolean)
  if (!words.length) return null
  const to = new Set<string>()
  const unknown: string[] = []
  let dice = ''
  let dc: number | undefined
  let secret = false
  const label: string[] = []
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const lower = w.toLowerCase()
    if (w.startsWith('@')) {
      const name = lower.slice(1)
      if (!name || EVERYONE.includes(name)) continue
      const who = party.find((e) => e.name.toLowerCase() === name || e.name.toLowerCase().split(/\s+/)[0] === name)
      if (who) to.add(who.id)
      else unknown.push(w.slice(1))
    } else if (lower === 'dc' && /^\d+$/.test(words[i + 1] ?? '')) {
      dc = Number(words[++i])
    } else if (/^dc\d+$/.test(lower)) {
      dc = Number(lower.slice(2))
    } else if (DICE.test(lower)) {
      dice = lower
    } else if (/^\d+$/.test(lower)) {
      dc = Number(lower)
    } else if (SECRET.includes(lower)) {
      secret = true
    } else if (!FILLER.includes(lower)) {
      label.push(w)
    }
  }
  const name = label.join(' ')
  if (!name && !dice) return null
  return { to: [...to], label: name ? name.charAt(0).toUpperCase() + name.slice(1) : 'Roll', dice: dice || 'd20', dc, secret, unknown }
}

/**
 * A character's bonus for a roll, read from their details: a detail named like the roll
 * ("Perception: +5", "Stealth +7", "Wisdom 14 (+2)"). Passive scores don't count.
 */
export function bonusFor(e: Entity | undefined, label: string) {
  if (!e) return 0
  const want = label.trim().toLowerCase()
  if (!want) return 0
  const fields = e.fields.filter((f) => !/passive/i.test(f.key))
  const f =
    fields.find((x) => x.key.trim().toLowerCase() === want) ??
    fields.find((x) => x.key.trim().toLowerCase().startsWith(want) || want.startsWith(x.key.trim().toLowerCase()))
  if (!f) return 0
  const m = f.value.match(/\(\s*([+-]\s*\d+)\s*\)/) ?? f.value.match(/[+-]\s*\d+/) ?? f.value.match(/^\s*(\d{1,2})\s*$/)
  if (!m) return 0
  const n = Number((m[1] ?? m[0]).replace(/\s/g, ''))
  // A bare number of 10 or more is a score (Wisdom 14), not a bonus.
  return /^[+-]/.test((m[1] ?? m[0]).trim()) || n < 10 ? n : 0
}

/** Dice with a bonus added: "d20" and 5 make "d20+5". */
export function withBonus(dice: string, bonus: number) {
  return bonus ? `${dice}${bonus > 0 ? '+' : ''}${bonus}` : dice
}

/** Whether a result passes the call's DC (undefined when there is none). */
export const passes = (call: Pick<RollCall, 'dc'>, total: number) => (call.dc === undefined ? undefined : total >= call.dc)
