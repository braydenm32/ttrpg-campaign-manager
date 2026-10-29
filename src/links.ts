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

/**
 * Rewrites [[Old]] and [[Old|label]] links (unless links is false), and a character's names in
 * :::for lines, in one piece of text. Only whole names in a :::for list change: "from" becomes
 * "to", and the first name "firstFrom" (when given) becomes "firstTo".
 */
export function renameInText(text: string, from: string, to: string, firstFrom?: string, firstTo?: string, links = true) {
  let out = links ? text.replace(new RegExp(`\\[\\[\\s*${escapeRe(from)}\\s*(\\||\\]\\])`, 'gi'), `[[${to}$1`) : text
  if (firstFrom !== undefined)
    out = out.replace(/^([ \t]*:::[ \t]*for(?![a-z0-9])[ \t:]*)(.*)$/gim, (_m, head: string, rest: string) => {
      // The names run up to a ":::" (a one-line passage's text, or a closing marker) or the end of the line.
      const cut = rest.indexOf(':::')
      const names = cut < 0 ? rest : rest.slice(0, cut)
      const swapped = names
        .split(/([ \t]*(?:,|&|\band\b)[ \t]*)/i)
        .map((part, i) => {
          if (i % 2) return part
          const n = part.trim().toLowerCase()
          const name = n === from.toLowerCase() ? to : firstFrom && n === firstFrom.toLowerCase() ? firstTo : undefined
          return name === undefined || !n ? part : part.replace(part.trim(), () => name)
        })
        .join('')
      return head + swapped + (cut < 0 ? '' : rest.slice(cut))
    })
  return out
}

/**
 * After a page is renamed: updates links on every page, session and map pin in the world. For a
 * player character, ":::for" passages follow the new name too, so they keep reaching the player.
 * A GM-only page's new name could be a secret (the Hooded Stranger is really Lord Vexis), so text
 * players can read keeps its links to the old name, which becomes one of the page's nicknames.
 * Returns a note for the GM about what was left alone or changed, or ''.
 */
export async function renameLinks(worldId: string, before: Entity, after: Entity) {
  const from = before.name.trim()
  const to = after.name.trim()
  if (!from || from.toLowerCase() === to.toLowerCase()) return ''
  const hidden = after.visibility === 'gm'
  const pc = after.type === 'pc'
  const first = (n: string) => n.split(/\s+/)[0]
  let firstFrom: string | undefined
  let firstTo: string | undefined
  if (pc) {
    // ":::for Kael" also reaches every other character called Kael: leave those alone, and write the
    // whole new name where the new first name is already someone else's.
    const others = await db.entities.where({ worldId }).filter((e) => e.type === 'pc' && !e.template && e.id !== after.id).toArray()
    const shared = (n: string) => others.some((e) => first(e.name.trim()).toLowerCase() === n.toLowerCase())
    firstFrom = first(from).toLowerCase() === first(to).toLowerCase() || shared(first(from)) ? '' : first(from)
    firstTo = shared(first(to)) ? to : first(to)
  }
  let kept = 0
  let forLines = 0
  /** Fixes one piece of text; "open" is true for text players can read. */
  const fix = (t: string | undefined, open = false) => {
    if (!t) return t
    const links = !(hidden && open)
    const out = renameInText(t, from, to, firstFrom, firstTo, links)
    if (!links && renameInText(t, from, to) !== t) kept++
    if (pc) {
      const was = renameInText(t, from, to, undefined, undefined, links).split('\n')
      forLines += out.split('\n').filter((l, i) => l !== was[i]).length
    }
    return out
  }
  // A renamed random table: "{Old name}" rolls in other tables follow it.
  const rolls = new RegExp(`\\{\\s*${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}`, 'gi')
  const fixRolls = (entries: string[] | undefined) => (after.type === 'table' && entries ? entries.map((x) => x.replace(rolls, `{${to}}`)) : entries)
  await db.transaction('rw', [db.entities, db.sessions, db.pins, db.history], async () => {
    for (const e of await db.entities.where({ worldId }).toArray()) {
      const open = !e.template && (e.visibility !== 'gm' || !!e.revealedTo?.length)
      const next = { ...e, body: fix(e.body, open)!, gmNotes: fix(e.gmNotes)!, summary: fix(e.summary, open)!, playerBody: fix(e.playerBody, open), entries: fixRolls(e.entries) }
      if (next.body !== e.body || next.gmNotes !== e.gmNotes || next.summary !== e.summary || next.playerBody !== e.playerBody || JSON.stringify(next.entries) !== JSON.stringify(e.entries)) {
        await keepVersion(e, 'edit')
        await db.entities.put({ ...next, updatedAt: Date.now() })
      }
    }
    for (const s of await db.sessions.where({ worldId }).toArray()) {
      const next = {
        ...s,
        notes: fix(s.notes)!,
        recap: fix(s.recap, s.visibility !== 'gm')!,
        lectern: s.lectern && { ...s.lectern, sceneText: fix(s.lectern.sceneText)! },
        prep: s.prep && { ...s.prep, strongStart: fix(s.prep.strongStart)! },
      }
      if (JSON.stringify(next) !== JSON.stringify(s)) await db.sessions.put(next)
    }
    for (const p of await db.pins.where({ worldId }).toArray()) {
      const note = fix(p.note, p.visibility !== 'gm')!
      if (note !== p.note) await db.pins.update(p.id, { note })
    }
    // The links left alone still find the page, by its old name.
    const me = kept ? await db.entities.get(after.id) : undefined
    if (me && !namesOf(me).includes(from.toLowerCase())) await db.entities.update(me.id, { aliases: [...(me.aliases ?? []), from], updatedAt: Date.now() })
  })
  const notes: string[] = []
  if (kept)
    notes.push(
      `This page is GM-only, so its new name stays secret: ${kept === 1 ? 'one place your players can read still says' : `${kept} places your players can read still say`} “${from}”. “${from}” is now one of this page’s other names, so those links still work.`,
    )
  if (forLines) notes.push(`${forLines === 1 ? 'One secret passage' : `${forLines} secret passages`} for ${from} now ${forLines === 1 ? 'uses' : 'use'} the new name.`)
  return notes.join('\n\n')
}
