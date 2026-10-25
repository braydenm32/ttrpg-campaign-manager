import { db, keepVersion, type Entity } from './db'

/**
 * Page names and [[links]]: a page answers to its name and its nicknames (aliases), and renaming a
 * page updates the links to it everywhere, so nothing breaks.
 */

/** Every name a page answers to, lower case. */
export const namesOf = (e: Pick<Entity, 'name' | 'aliases'>) =>
  [e.name, ...(e.aliases ?? [])].map((n) => n.trim().toLowerCase()).filter(Boolean)

/** Looks pages up by any of their names (an exact name wins over a nickname). */
export function nameIndex(entities: Entity[]) {
  const byName = new Map<string, Entity>()
  for (const e of entities) for (const n of (e.aliases ?? []).map((a) => a.trim().toLowerCase())) if (n && !byName.has(n)) byName.set(n, e)
  for (const e of entities) byName.set(e.name.trim().toLowerCase(), e)
  return byName
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Rewrites [[Old]] and [[Old|label]] links, and character names in :::for lines, in one piece of text. */
export function renameInText(text: string, from: string, to: string, firstFrom?: string, firstTo?: string) {
  let out = text.replace(new RegExp(`\\[\\[\\s*${escapeRe(from)}\\s*(\\||\\]\\])`, 'gi'), `[[${to}$1`)
  if (firstFrom !== undefined)
    out = out.replace(/^([ \t]*:::[ \t]*for[ \t]+)(.*)$/gim, (_m, head: string, names: string) => {
      let n = names.replace(new RegExp(`\\b${escapeRe(from)}\\b`, 'gi'), to)
      if (firstFrom && firstTo && firstFrom.toLowerCase() !== firstTo.toLowerCase())
        n = n.replace(new RegExp(`\\b${escapeRe(firstFrom)}\\b`, 'gi'), firstTo)
      return head + n
    })
  return out
}

/**
 * After a page is renamed: updates links on every page, session and map pin in the world. For a
 * player character, ":::for" passages follow the new name too, so they keep reaching the player.
 */
export async function renameLinks(worldId: string, before: Entity, after: Entity) {
  const from = before.name.trim()
  const to = after.name.trim()
  if (!from || from.toLowerCase() === to.toLowerCase()) return
  const pc = after.type === 'pc'
  const first = (n: string) => n.split(/\s+/)[0]
  const fix = (t: string | undefined) => (t ? renameInText(t, from, to, pc ? first(from) : undefined, pc ? first(to) : undefined) : t)
  await db.transaction('rw', [db.entities, db.sessions, db.pins, db.history], async () => {
    for (const e of await db.entities.where({ worldId }).toArray()) {
      const next = { ...e, body: fix(e.body)!, gmNotes: fix(e.gmNotes)!, summary: fix(e.summary)!, playerBody: fix(e.playerBody) }
      if (next.body !== e.body || next.gmNotes !== e.gmNotes || next.summary !== e.summary || next.playerBody !== e.playerBody) {
        await keepVersion(e, 'edit')
        await db.entities.put({ ...next, updatedAt: Date.now() })
      }
    }
    for (const s of await db.sessions.where({ worldId }).toArray()) {
      const next = {
        ...s,
        notes: fix(s.notes)!,
        recap: fix(s.recap)!,
        lectern: s.lectern && { ...s.lectern, sceneText: fix(s.lectern.sceneText)! },
        prep: s.prep && { ...s.prep, strongStart: fix(s.prep.strongStart)! },
      }
      if (JSON.stringify(next) !== JSON.stringify(s)) await db.sessions.put(next)
    }
    for (const p of await db.pins.where({ worldId }).toArray()) {
      const note = fix(p.note)!
      if (note !== p.note) await db.pins.update(p.id, { note })
    }
  })
}
