import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Dump, Entity } from './world'

/**
 * The GM's secrets in the example world, as short distinctive phrases a player must never see:
 * names of GM-only pages, maps and sessions, words from GM notes, ":::gm" and ":::for" passages,
 * GM-only fields, nicknames and clocks players don't know about.
 *
 * Each phrase is checked against everything players are allowed to see (and against the app's own
 * wording), and dropped if it appears there, so the list has no false alarms: a GM-only page whose
 * name is also written in a revealed page's text isn't a leak.
 */

export interface Secret {
  /** The phrase, normalised (see norm). */
  text: string
  /** Where it comes from, for the failure message. */
  why: string
}

/**
 * Text boiled down for comparing: [[links]] as their label, lower case, no accents, apostrophes
 * dropped, anything that isn't a letter or digit turned into a single space.
 */
export function norm(s: string) {
  return ` ${s
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’‘`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `
}

/** A ":::gm" / ":::for" / plain split of a page's text, like src/Markdown.tsx splitSecrets (simplified). */
export function splitSecrets(text: string) {
  const out: { kind: 'text' | 'gm' | 'for'; body: string }[] = []
  let open: { kind: 'gm' | 'for'; body: string } | null = null
  let depth = 0
  for (const line of text.split(/\r?\n/)) {
    const opener = line.match(/^[ \t]*:::[ \t]*(foryou|gm|for)(?![a-z0-9])(.*)$/i)
    const closer = /^[ \t]*:::[ \t]*$/.test(line)
    if (open) {
      if (closer) depth--
      else if (opener && !/:::[ \t]*$/.test(opener[2])) depth++
      if (depth === 0) {
        out.push(open)
        open = null
      } else open.body += `\n${line}`
      continue
    }
    if (!opener) {
      out.push({ kind: 'text', body: line })
      continue
    }
    const kind = opener[1].toLowerCase() === 'gm' ? 'gm' : 'for'
    // One-line passage: ":::gm text :::", ":::for Name::: text :::".
    if (/:::[ \t]*$/.test(opener[2]) && opener[2].replace(/:::[ \t]*$/, '').trim()) out.push({ kind, body: opener[2] })
    else {
      open = { kind, body: kind === 'gm' ? opener[2] : '' }
      depth = 1
    }
  }
  if (open) out.push(open)
  return out
}

const visibleText = (text: string) =>
  splitSecrets(text ?? '')
    .filter((s) => s.kind === 'text')
    .map((s) => s.body)
    .join('\n')

/** Up to `max` phrases of `words` words from a secret text, taken from its longest lines. */
function phrases(text: string, words = 6, max = 2): string[] {
  const lines = (text ?? '')
    .split(/\n|(?<=[.!?])\s+/)
    .map((l) => norm(l.replace(/^:::\s*(gm|for[^:]*)?:{0,3}/i, '')).trim().split(' '))
    .filter((w) => w.length >= words)
    .sort((a, b) => b.length - a.length)
  const out: string[] = []
  for (const w of lines) {
    for (const start of [0, Math.max(0, Math.floor((w.length - words) / 2))]) {
      const p = w.slice(start, start + words).join(' ')
      if (p.length >= 24 && !out.includes(p)) out.push(p)
      if (out.length >= max) return out
    }
  }
  return out
}

/** Everything a player is allowed to read, normalised: the haystack a secret must not be found in. */
function playerCorpus(dump: Dump): string {
  const parts: string[] = []
  const world = dump.worlds.find((w) => w.example) ?? dump.worlds[0]
  // The world's own settings players see (calendar, ages, safety, coin…). GM-only bits left out.
  const walk = (v: unknown, key = ''): void => {
    if (/gm|screen|lectern|cloud|ai|shared/i.test(key)) return
    if (typeof v === 'string') parts.push(v)
    else if (Array.isArray(v)) v.forEach((x) => walk(x))
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k)
  }
  walk(world)
  for (const e of dump.entities) {
    if (e.visibility !== 'players' || e.template) continue
    parts.push(e.name, e.summary, visibleText(e.body), visibleText(e.playerBody ?? ''), ...e.tags)
    for (const f of e.fields) if (!f.gm) parts.push(f.key, f.value)
    for (const c of e.clocks ?? []) if (c.known) parts.push(c.name)
    for (const r of e.relations ?? []) if (r.known) parts.push(r.kind, r.note ?? '')
    for (const o of e.objectives ?? []) if (o.known) parts.push(o.text)
    for (const r of e.rewards ?? []) if (r.known) parts.push(r.text)
    if (e.type === 'table') for (const x of e.entries ?? []) parts.push(visibleText(x))
  }
  for (const m of dump.maps) if (m.visibility === 'players') parts.push(m.name)
  const playerMaps = new Set(dump.maps.filter((m) => m.visibility === 'players').map((m) => m.id))
  for (const p of dump.pins) if (p.visibility === 'players' && playerMaps.has(p.mapId)) parts.push(p.label, visibleText(p.note))
  for (const c of dump.campaigns) if (c.visibility !== 'gm') parts.push(c.name, c.description)
  for (const s of dump.sessions) if (s.visibility === 'players') parts.push(s.title, visibleText(s.recap ?? ''))
  return norm(parts.join('\n'))
}

/** The app's own wording (every string in src/), so a secret phrase that is also UI text isn't flagged. */
function appCorpus(): string {
  const root = join(import.meta.dirname, '..', '..', 'src')
  const files = readdirSync(root, { recursive: true })
    .map(String)
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.startsWith('example'))
  return norm(files.map((f) => readFileSync(join(root, f), 'utf8')).join('\n'))
}

/** The GM's secrets in the world, as phrases players must never see. */
export function secretsOf(dump: Dump): Secret[] {
  const allowed = playerCorpus(dump) + appCorpus()
  const out = new Map<string, string>()
  const add = (text: string, why: string, { minWords = 2, minLength = 10 } = {}) => {
    const n = norm(text)
    const t = n.trim()
    if (t.length < minLength || t.split(' ').length < minWords) return
    if (allowed.includes(n) || out.has(t)) return
    out.set(t, why)
  }
  const page = (e: Entity) => `“${e.name}”`
  for (const e of dump.entities) {
    const gmPage = e.visibility === 'gm' || e.template
    if (gmPage) {
      add(e.name, `name of the GM-only page ${page(e)}`, { minWords: 2, minLength: 12 })
      for (const p of phrases(e.body)) add(p, `text of the GM-only page ${page(e)}`)
      add(e.summary, `summary of the GM-only page ${page(e)}`, { minWords: 5, minLength: 24 })
    } else {
      for (const s of splitSecrets(e.body ?? ''))
        if (s.kind !== 'text') for (const p of phrases(s.body)) add(p, `a :::${s.kind} passage on ${page(e)}`)
      for (const f of e.fields) if (f.gm) for (const p of phrases(f.value, 5)) add(p, `GM-only field “${f.key}” on ${page(e)}`)
      for (const c of e.clocks ?? []) if (!c.known) add(c.name, `the clock “${c.name}” on ${page(e)}, which players don't know about`, { minWords: 2, minLength: 10 })
    }
    for (const p of phrases(e.gmNotes)) add(p, `GM notes on ${page(e)}`)
    for (const a of e.aliases ?? []) add(a, `nickname “${a}” of ${page(e)} (nicknames are GM-only)`, { minWords: 2, minLength: 12 })
    for (const t of e.gmTags ?? []) add(t, `GM-only tag on ${page(e)}`, { minWords: 2, minLength: 12 })
  }
  for (const m of dump.maps) if (m.visibility === 'gm') add(m.name, `name of the GM-only map “${m.name}”`, { minWords: 2, minLength: 12 })
  for (const s of dump.sessions) {
    if (s.visibility === 'gm') add(s.title, `title of the GM-only session #${s.number}`, { minWords: 2, minLength: 12 })
    for (const p of phrases(s.notes ?? '')) add(p, `GM notes of session #${s.number}`)
  }
  for (const b of dump.boards) add(b.name, `name of the corkboard “${b.name}” (corkboards are GM-only)`, { minWords: 2, minLength: 12 })
  // Sorted, so the same secrets are picked in every run (the database hands pages back in id order, and ids differ each time).
  return [...out].map(([text, why]) => ({ text, why })).sort((a, b) => a.text.localeCompare(b.text))
}

/** The secrets found in a screen's text. */
export function leaksIn(text: string, secrets: Secret[]) {
  const n = norm(text)
  return secrets.filter((s) => n.includes(` ${s.text} `))
}
