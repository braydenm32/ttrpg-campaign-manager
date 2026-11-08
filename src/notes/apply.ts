import { blankEntity, db, newId, saveEntity, type Entity, type Session } from '../db'
import { nameIndex } from '../links'
import { gmBlock } from '../Markdown'
import type { NotePage, NoteSession } from './claude'

/** Where each page from the notes goes: a new page, or added to one already in the world. */
export interface NotePick {
  page: NotePage
  /** The id of the world's page to add to; empty for a new page. */
  into: string
  /**
   * Players may see it: a new page is made visible to them, and notes added to a page they can
   * already see go in as plain text. Otherwise everything stays GM only.
   */
  show: boolean
}

/** Whether players (all, or some by name) can see a page. */
const seen = (page: Entity) => page.visibility !== 'gm' || !!page.revealedTo?.length

/**
 * Text from the notes added to a page players can already see goes inside a GM-only block, unless
 * the GM left it ticked for players, so nothing else from the notebook reaches them (a ":::" line
 * in the notes can't end the block early: see gmBlock).
 */
const addedText = (page: Entity, text: string, show: boolean) =>
  seen(page) && !show ? `### From my notes\n\n${gmBlock(text)}` : `### From my notes\n\n${text}`

const joinText = (a: string, b: string) => (a.trim() ? `${a.trimEnd()}\n\n${b}` : b)

/**
 * Adds the pages and sessions the GM ticked. New pages are GM only. Notes for an existing page are
 * added under “From my notes” (GM only if the page is revealed), secrets go to its GM notes, and the
 * page's old version is kept in its history. Sessions go at the end of the campaign, GM only.
 * Returns how many pages were made and updated, and how many sessions were added.
 */
export async function applyNotes(worldId: string, picks: NotePick[], sessions: NoteSession[], campaignId?: string) {
  const existing = (await db.entities.where({ worldId }).toArray()).filter((e) => !e.template)
  const byId = new Map(existing.map((e) => [e.id, e]))
  const now = Date.now()
  const made: Entity[] = []
  const changed = new Map<string, Entity>()
  /** Each pick's page: the new one, or the id of the one it adds to. */
  const forPick: (Entity | string)[] = []

  for (const [i, { page: p, into, show }] of picks.entries()) {
    const old = into ? (changed.get(into) ?? byId.get(into)) : undefined
    if (old) {
      const e: Entity = { ...old, fields: [...old.fields], aliases: [...(old.aliases ?? [])], updatedAt: now }
      if (p.body) e.body = joinText(e.body, addedText(e, p.body, show))
      if (p.secrets) e.gmNotes = joinText(e.gmNotes, `From my notes:\n\n${p.secrets}`)
      if (!e.summary.trim() && p.summary) e.summary = p.summary
      const shown = seen(e) && !show
      const keys = new Set(e.fields.map((f) => f.key.trim().toLowerCase()))
      for (const f of p.fields) if (!keys.has(f.key.toLowerCase())) e.fields.push({ ...f, ...(shown ? { gm: true } : {}) })
      const names = new Set([e.name, ...e.aliases!].map((n) => n.trim().toLowerCase()))
      const aliases = [...e.aliases!, ...p.aliases.filter((a) => !names.has(a.toLowerCase()))]
      if (aliases.length) e.aliases = aliases
      else delete e.aliases
      if (p.status && !e.status) e.status = p.status
      changed.set(e.id, e)
      forPick[i] = e.id
    } else {
      const e = blankEntity(worldId, p.type, p.name)
      e.summary = p.summary
      e.body = p.body
      e.gmNotes = p.secrets
      e.fields = p.fields
      // Only the GM sees where a page came from.
      e.gmTags = ['from my notes']
      if (show) e.visibility = 'players'
      if (p.aliases.length) e.aliases = [...new Set(p.aliases)]
      if (p.status) e.status = p.status
      if (p.type === 'event') e.eventOrder = now + i
      made.push(e)
      forPick[i] = e
    }
  }

  // Places: "in" names a place in the notes or one already in the world.
  const names = nameIndex([...existing.map((e) => changed.get(e.id) ?? e), ...made])
  for (const [i, { page: p }] of picks.entries()) {
    if (!p.in) continue
    const t = forPick[i]
    const e = typeof t === 'string' ? changed.get(t) : t
    const parent = names.get(p.in.toLowerCase())
    if (e && parent && parent.id !== e.id && !e.parentId) e.parentId = parent.id
  }

  await db.transaction('rw', [db.entities, db.history], async () => {
    if (made.length) await db.entities.bulkAdd(made)
    for (const e of changed.values()) await saveEntity(e)
  })

  let added = 0
  if (campaignId && sessions.length) {
    const last = (await db.sessions.where({ campaignId }).sortBy('number')).at(-1)
    let number = last?.number ?? 0
    const rows: Session[] = sessions.map((s) => {
      number++
      // The date box takes 2026-03-12; anything else ("12 March", "Sess 4") stays in the notes as written.
      const iso = /^\d{4}-\d{2}-\d{2}$/.test(s.date) ? s.date : ''
      const linked = [...s.notes.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)].map((m) => names.get(m[1].trim().toLowerCase())?.id).filter((id): id is string => !!id)
      return {
        id: newId(),
        worldId,
        campaignId,
        number,
        title: s.title || `Session ${number}`,
        date: iso,
        notes: s.date && !iso ? `*Date in my notes: ${s.date}*\n\n${s.notes}` : s.notes,
        recap: '',
        visibility: 'gm',
        entityIds: [...new Set(linked)],
        recordings: [],
        // Already played: these are notes of what happened.
        playedAt: now,
        createdAt: now + number,
      }
    })
    await db.sessions.bulkAdd(rows)
    added = rows.length
  }
  return {
    made: made.length,
    shown: made.filter((e) => e.visibility === 'players').length,
    updated: changed.size,
    sessions: added,
    first: made[0]?.id ?? [...changed.keys()][0],
  }
}
