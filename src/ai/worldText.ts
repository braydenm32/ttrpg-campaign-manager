import { formatDate } from '../calendar'
import { ENTITY_LABELS, type Entity, type Session, type World } from '../db'
import { transcriptText } from './transcript'

/**
 * The GM's world written out as plain text for Claude: a short index of every page, and the full
 * text of any page or session on request. GM-only material is included (these tools are only for
 * the GM, with their own API key) but clearly marked, so Claude can keep secrets apart.
 */

const kindOf = (e: Entity, world?: World) =>
  e.type === 'custom' ? (world?.customTypes?.find((c) => c.id === e.customType)?.one ?? 'page').toLowerCase() : ENTITY_LABELS[e.type].one.toLowerCase()

/** Pages worth showing Claude: no templates or random tables. */
export const aiPages = (entities: Entity[]) => entities.filter((e) => !e.template && e.type !== 'table')

/** One line per page: name, kind, other names, state, and its one-line summary. */
export function indexLine(e: Entity, world?: World, byId?: Map<string, Entity>) {
  const about = [
    kindOf(e, world),
    e.aliases?.length ? `also called ${e.aliases.map((a) => `"${a}"`).join(', ')}` : '',
    e.parentId && byId?.get(e.parentId) ? `in ${byId.get(e.parentId)!.name}` : '',
    e.questStatus ? `quest ${e.questStatus}` : '',
    e.threadStatus ? `thread ${e.threadStatus}` : '',
    e.status && e.status !== 'alive' ? e.status : '',
    e.visibility === 'gm' ? 'secret' : '',
  ].filter(Boolean)
  const summary = e.summary.replace(/\s+/g, ' ').trim().slice(0, 160)
  return `- ${e.name} (${about.join('; ')})${summary ? `: ${summary}` : ''}`
}

export function worldIndex(world: World, entities: Entity[]) {
  const byId = new Map(entities.map((e) => [e.id, e]))
  return aiPages(entities)
    .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name))
    .map((e) => indexLine(e, world, byId))
    .join('\n')
}

/** Everything on one page, in Markdown. */
export function pageText(e: Entity, world: World, entities: Entity[], { secrets = true } = {}) {
  const byId = new Map(entities.map((x) => [x.id, x]))
  const name = (id?: string) => (id ? (byId.get(id)?.name ?? '') : '')
  const lines = [`# ${e.name}`, `Kind: ${kindOf(e, world)}${e.visibility === 'gm' ? ' (secret: players have not seen this page)' : ''}`]
  if (e.aliases?.length) lines.push(`Also called: ${e.aliases.join(', ')}`)
  if (e.parentId) lines.push(`Inside: ${name(e.parentId)}`)
  if (e.status) lines.push(`Status: ${e.status}${secrets && e.statusKnown === false ? ' (players don’t know)' : ''}`)
  if (e.questStatus) lines.push(`Quest: ${e.questStatus}`)
  if (e.threadStatus) lines.push(`Loose thread: ${e.threadStatus}`)
  if (e.heldBy) lines.push(`Held by: ${name(e.heldBy)}${e.quantity && e.quantity > 1 ? ` (×${e.quantity})` : ''}`)
  if (e.type === 'event') {
    const when = formatDate(world.calendar, e.eventWhen, false) || e.eventDate
    if (when) lines.push(`When: ${when}`)
  }
  if (e.tags.length) lines.push(`Tags: ${e.tags.join(', ')}`)
  if (e.summary.trim()) lines.push(`Summary: ${e.summary.trim()}`)
  const fields = e.fields.filter((f) => (f.key.trim() || f.value.trim()) && (secrets || !f.gm))
  if (fields.length) lines.push('', ...fields.map((f) => `- ${f.key}: ${f.value}${f.gm ? ' (GM only)' : ''}`))
  const rel = (e.relations ?? []).filter((r) => byId.has(r.to) && (secrets || r.known !== false))
  if (rel.length) lines.push('', 'Relationships:', ...rel.map((r) => `- ${r.kind} ${name(r.to)}${r.note ? `: ${r.note}` : ''}${secrets && r.known === false ? ' (secret)' : ''}`))
  if (e.clocks?.length) lines.push('', ...e.clocks.map((c) => `Clock "${c.name}": ${c.filled} of ${c.segments}`))
  if (e.body.trim()) lines.push('', secrets ? e.body.trim() : withoutSecrets(e.body))
  if (e.playerBody?.trim()) lines.push('', 'Written by the player:', e.playerBody.trim())
  if (e.entries?.length) lines.push('', 'Log:', ...e.entries.map((x) => `- ${x}`))
  if (secrets && e.gmNotes.trim()) lines.push('', 'GM notes (secret):', e.gmNotes.trim())
  return lines.join('\n')
}

/** Text with `:::gm` blocks taken out, for anything a player might see. */
const withoutSecrets = (text: string) => text.replace(/^[ \t]*:::[ \t]*gm\b[\s\S]*?^[ \t]*:::[ \t]*$/gim, '').trim()

/** A session: what the players were told, the GM's notes and summary, and optionally the transcript. */
export function sessionText(s: Session, world: World, { transcript = false } = {}) {
  const lines = [`# Session ${s.number}: ${s.title}`]
  if (s.date) lines.push(`Played: ${s.date}`)
  if (s.worldDate && world.calendar) lines.push(`In-world date: ${formatDate(world.calendar, s.worldDate, false)}`)
  if (s.recap.trim()) lines.push('', 'Recap the players read:', s.recap.trim())
  if (s.notes.trim()) lines.push('', 'GM notes (secret):', s.notes.trim())
  const prep = s.prep
  if (prep) {
    const planned = [
      ...(prep.strongStart.trim() ? [`Strong start: ${prep.strongStart.trim()}`] : []),
      ...prep.scenes.filter((x) => x.text.trim()).map((x) => `- Scene ${x.done ? '(played)' : '(not reached)'}: ${x.text}`),
      ...prep.clues.filter((x) => x.text.trim()).map((x) => `- Clue ${x.done ? '(found)' : '(not found yet)'}: ${x.text}`),
    ]
    if (planned.length) lines.push('', 'GM prep (secret):', ...planned)
  }
  if (transcript) {
    const t = s.recordings.flatMap((r) => (r.transcript && !r.transcript.pending ? [transcriptText(r.transcript)] : []))
    if (t.length) lines.push('', 'Transcript:', ...t)
  }
  return lines.join('\n')
}

export function sessionIndex(sessions: Session[]) {
  return [...sessions]
    .sort((a, b) => a.number - b.number)
    .map((s) => `- Session ${s.number}: ${s.title}${s.date ? ` (${s.date})` : ''}${s.visibility === 'gm' ? ' (secret)' : ''}`)
    .join('\n')
}

const STOP = new Set('the and for are was were with what who whom whose where when why how that this these those from into about does did has have had not but you your our their they them his her its any all one can will would could should there here then than been being just also some more most very which while'.split(' '))

/** The pages most likely to matter for a question, found on this device by matching words. */
export function findPages(query: string, entities: Entity[], limit = 12) {
  const words = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}'’-]{3,}/gu) ?? [])].filter((w) => !STOP.has(w))
  if (!words.length) return []
  return aiPages(entities)
    .map((e) => {
      const names = [e.name, ...(e.aliases ?? [])].join(' ').toLowerCase()
      const short = `${e.summary} ${e.tags.join(' ')}`.toLowerCase()
      const long = `${e.body} ${e.gmNotes} ${e.playerBody ?? ''} ${e.fields.map((f) => `${f.key} ${f.value}`).join(' ')}`.toLowerCase()
      let score = 0
      for (const w of words) {
        if (names.includes(w)) score += 10
        if (short.includes(w)) score += 3
        const n = long.split(w).length - 1
        score += Math.min(n, 5)
      }
      return { e, score }
    })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((h) => h.e)
}

/** Finds a page by the name Claude gives (or one of its other names), ignoring case and [[ ]]. */
export function pageByName(name: string, entities: Entity[]) {
  const n = name.replace(/^\[\[|\]\]$/g, '').trim().toLowerCase()
  const pages = aiPages(entities)
  return pages.find((e) => e.name.toLowerCase() === n) ?? pages.find((e) => e.aliases?.some((a) => a.toLowerCase() === n))
}

/** The tools that let Claude look things up in the world while it answers. */
export function worldTools(world: World, entities: Entity[], sessions: Session[], { transcripts = false } = {}) {
  return [
    {
      name: 'read_pages',
      description: 'Read the full text of pages in the world by name (as written in the index). Read every page you rely on before answering.',
      input_schema: { type: 'object' as const, properties: { names: { type: 'array', items: { type: 'string' }, description: 'Page names, up to 12' } }, required: ['names'] },
      run: (input: Record<string, unknown>) => {
        const names = Array.isArray(input.names) ? input.names.filter((x): x is string => typeof x === 'string').slice(0, 12) : []
        if (!names.length) return 'Give the names of the pages to read.'
        return names.map((n) => {
          const e = pageByName(n, entities)
          return e ? pageText(e, world, entities) : `# ${n}\n(No page by that name.)`
        }).join('\n\n---\n\n')
      },
    },
    {
      name: 'search_world',
      description: 'Search every page’s text for words, to find pages that mention something even if it isn’t in their name or summary. Returns matching page names with their summaries.',
      input_schema: { type: 'object' as const, properties: { query: { type: 'string' } }, required: ['query'] },
      run: (input: Record<string, unknown>) => {
        const hits = findPages(typeof input.query === 'string' ? input.query : '', entities, 15)
        const byId = new Map(entities.map((e) => [e.id, e]))
        return hits.length ? hits.map((e) => indexLine(e, world, byId)).join('\n') : 'Nothing matched.'
      },
    },
    {
      name: 'read_sessions',
      description: `Read what happened in sessions by number: the recap, the GM's notes and prep${transcripts ? ', and the transcript' : ''}.`,
      input_schema: { type: 'object' as const, properties: { numbers: { type: 'array', items: { type: 'integer' }, description: 'Session numbers, up to 6' } }, required: ['numbers'] },
      run: (input: Record<string, unknown>) => {
        const nums = Array.isArray(input.numbers) ? input.numbers.filter((x): x is number => typeof x === 'number').slice(0, 6) : []
        return nums.map((n) => {
          const s = sessions.find((x) => x.number === n)
          return s ? sessionText(s, world, { transcript: transcripts }) : `# Session ${n}\n(No such session.)`
        }).join('\n\n---\n\n') || 'Give the session numbers to read.'
      },
    },
  ]
}

/** What Claude is doing, in words, for the "Reading…" line. */
export function describeStep(name: string, input: Record<string, unknown>) {
  const list = (x: unknown) => (Array.isArray(x) ? x.map(String).slice(0, 4).join(', ') + (x.length > 4 ? '…' : '') : '')
  if (name === 'read_pages') return `Reading ${list(input.names)}`
  if (name === 'search_world') return `Searching for “${String(input.query ?? '')}”`
  if (name === 'read_sessions') return `Reading session ${list(input.numbers)}`
  return name
}

/** The world in a nutshell, for the top of every prompt. */
export function worldHeader(world: World) {
  const today = world.calendar?.today ? formatDate(world.calendar, world.calendar.today, false) : ''
  return [`World: ${world.name}${world.system ? ` (${world.system})` : ''}`, world.description?.trim() ? `About it: ${world.description.trim()}` : '', today ? `Today in the world: ${today}` : '']
    .filter(Boolean)
    .join('\n')
}

export const MARKUP_NOTE = `In page text, a block between ":::gm" and ":::" is a secret only the GM knows, and a block starting ":::for Name" is known only to that player's character. Pages marked "secret" haven't been shown to the players at all.`
