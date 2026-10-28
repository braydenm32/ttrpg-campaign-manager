import { blankEntity, db, ENTITY_TYPES, LIFE_STATUS, newId, saveEntity, THREAD_STATUS, type Entity, type EntityType, type LedgerEntry, type LifeStatus, type Session, type World, type WorldUpdate } from '../db'
import { nameIndex } from '../links'
import { RELATION_KINDS } from '../relations'

/**
 * Keeping the world up to date from a session. Claude reads the transcript next to the list of
 * pages and suggests changes (new people and places, quests moving on, relationships, timeline
 * events...). The GM ticks the ones to keep, and applying them edits the pages (each edit kept in
 * the page's history) and writes a line per change in the session's ledger.
 */

export const UPDATES_HEADING = '## World updates'

/** The name of the record of changes made to the world from sessions. */
export const LEDGER_NAME = 'The Chronicle'

const NEW_TYPES = ['npc', 'location', 'shop', 'item', 'faction', 'quest', 'deity', 'lore'] as const

export function updatesInstructions() {
  return `For the GM's world notes. Compare what happened at the table with the list of known pages below, and list the changes the notes need so they stay up to date, including anything the GM improvised on the spot (a new name, shop, place or rumour). Only list what actually happened or was said at the table, not guesses. Write a single JSON code block (\`\`\`json … \`\`\`) holding an array of objects, each one of these:
- {"kind":"new","type":"${NEW_TYPES.join('|')}","name":"…","summary":"one line","details":"what the players saw, learned or did with it, a few sentences","in":"known place it is in (optional)","sameAs":"a known page this might really be, if the name sounds like a misheard name or nickname (optional)"}
- {"kind":"note","page":"known page","note":"one sentence on what happened with it this session"}
- {"kind":"quest","page":"known quest","status":"open|active|done|failed","note":"…"}
- {"kind":"relation","from":"name","to":"name","relation":"${RELATION_KINDS.map((k) => k.kind).join('|')}","note":"…"}
- {"kind":"event","name":"short title","summary":"what happened","involves":["names"],"where":"known place (optional)"} for moments big enough for the world's timeline
- {"kind":"status","page":"character","status":"alive|dead|missing|captured","note":"…"}
- {"kind":"item","item":"name","to":"character name, or party","quantity":1}
- {"kind":"thread","action":"raised|moved|resolved|dropped","page":"known loose thread (not for raised)","name":"new loose thread (for raised)","note":"…"}
- {"kind":"conflict","page":"known page","note":"what was said at the table, and what the notes say instead"}
Names can be known pages or pages you list as new. Leave out the player characters' everyday actions unless something changed for them. Write [] if nothing changed.`
}

const str = (x: unknown) => (typeof x === 'string' ? x.trim() : '')

/** Reads the JSON list from Claude's reply, keeping only well-formed suggestions. */
export function parseUpdates(text: string): WorldUpdate[] {
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)
  let raw: unknown
  try {
    raw = JSON.parse(block)
  } catch {
    return []
  }
  if (!Array.isArray(raw)) return []
  const out: WorldUpdate[] = []
  for (const r of raw as Record<string, unknown>[]) {
    if (!r || typeof r !== 'object') continue
    const base = { id: newId(), on: r.kind !== 'conflict' }
    const note = str(r.note) || undefined
    switch (r.kind) {
      case 'new': {
        const type = (NEW_TYPES as readonly string[]).includes(str(r.type)) ? (str(r.type) as EntityType) : 'npc'
        // When Claude thinks a "new" name is really a known page misheard, adding to that page is the safer default.
        if (str(r.name))
          out.push({ ...base, kind: 'new', type, name: str(r.name), summary: str(r.summary), details: str(r.details), in: str(r.in) || undefined, sameAs: str(r.sameAs) || undefined, useSameAs: !!str(r.sameAs) })
        break
      }
      case 'note':
        if (str(r.page) && note) out.push({ ...base, kind: 'note', page: str(r.page), note })
        break
      case 'quest':
        if (str(r.page) && ['open', 'active', 'done', 'failed'].includes(str(r.status)))
          out.push({ ...base, kind: 'quest', page: str(r.page), status: str(r.status) as 'open', note })
        break
      case 'relation':
        if (str(r.from) && str(r.to) && str(r.relation)) out.push({ ...base, kind: 'relation', from: str(r.from), to: str(r.to), relation: str(r.relation).toLowerCase(), note })
        break
      case 'event':
        if (str(r.name))
          out.push({
            ...base,
            kind: 'event',
            name: str(r.name),
            summary: str(r.summary),
            involves: Array.isArray(r.involves) ? r.involves.map(str).filter(Boolean) : undefined,
            where: str(r.where) || undefined,
          })
        break
      case 'status':
        if (str(r.page) && str(r.status) in LIFE_STATUS) out.push({ ...base, kind: 'status', page: str(r.page), status: str(r.status) as LifeStatus, note })
        break
      case 'item':
        if (str(r.item) && str(r.to))
          out.push({ ...base, kind: 'item', item: str(r.item), to: str(r.to), quantity: typeof r.quantity === 'number' && r.quantity > 0 ? Math.round(r.quantity) : undefined })
        break
      case 'thread': {
        const action = str(r.action)
        if (action === 'raised' ? str(r.name) : ['moved', 'resolved', 'dropped'].includes(action) && str(r.page))
          out.push({ ...base, kind: 'thread', action: action as 'raised', page: str(r.page) || undefined, name: str(r.name) || undefined, note })
        break
      }
      case 'conflict':
        if (str(r.page) && note) out.push({ ...base, kind: 'conflict', page: str(r.page), note })
        break
    }
  }
  return out
}

/**
 * Finds pages by name or nickname, with or without a leading "the", and people by their first
 * name alone when only one person has it ("Wren" for Wren Thistle).
 */
export function pageFinder(entities: Entity[]) {
  const pages = entities.filter((e) => !e.template)
  const index = nameIndex(pages)
  const firsts = new Map<string, Entity | null>()
  for (const e of pages) {
    if (e.type !== 'npc' && e.type !== 'pc') continue
    const first = e.name.trim().split(/\s+/)[0].toLowerCase()
    if (first && first !== e.name.trim().toLowerCase()) firsts.set(first, firsts.has(first) ? null : e)
  }
  return (name: string | undefined) => {
    const n = (name ?? '').trim().toLowerCase()
    if (!n) return undefined
    return index.get(n) ?? index.get(n.replace(/^the\s+/, '')) ?? index.get(`the ${n}`) ?? firsts.get(n) ?? undefined
  }
}

/** The pages a suggestion needs, by name; used to warn about names that match nothing. */
export function namesIn(u: WorldUpdate): string[] {
  switch (u.kind) {
    case 'new':
      return []
    case 'relation':
      return [u.from, u.to]
    case 'item':
      // A new item gets a page of its own; only who has it must already exist.
      return /^(the )?party$/i.test(u.to.trim()) ? [] : [u.to]
    case 'event':
      return []
    case 'thread':
      return u.action === 'raised' ? [] : [u.page ?? '']
    default:
      return [u.page]
  }
}

/** A sentence describing a suggestion, used in the checklist and the ledger. */
export function describe(u: WorldUpdate): string {
  switch (u.kind) {
    case 'new':
      return `New ${u.type === 'npc' ? 'NPC' : u.type === 'shop' ? 'shop or tavern' : u.type}: ${u.name}${u.summary ? `, ${u.summary}` : ''}`
    case 'note':
      return `${u.page}: ${u.note}`
    case 'quest':
      return `Quest ${u.page} is now ${u.status}${u.note ? `: ${u.note}` : ''}`
    case 'relation':
      return `${u.from}: ${u.relation} ${u.to}${u.note ? ` (${u.note})` : ''}`
    case 'event':
      return `On the timeline: ${u.name}${u.summary ? `, ${u.summary}` : ''}`
    case 'status':
      return `${u.page} is ${LIFE_STATUS[u.status].label.toLowerCase()}${u.note ? `: ${u.note}` : ''}`
    case 'item':
      return `${u.quantity && u.quantity !== 1 ? `${u.quantity} × ` : ''}${u.item} now with ${u.to}`
    case 'thread':
      return u.action === 'raised'
        ? `New loose thread: ${u.name}${u.note ? `, ${u.note}` : ''}`
        : `Loose thread ${u.page}: ${u.action === 'moved' ? 'in play' : THREAD_STATUS[u.action].label.toLowerCase()}${u.note ? `, ${u.note}` : ''}`
    case 'conflict':
      return `${u.page}: ${u.note}`
  }
}

/** Adds lines under a "Session log" heading at the end of a page. GM-only lines go in a :::gm block. */
export function addToSessionLog(body: string, lines: { text: string; players?: boolean }[]) {
  if (!lines.length) return body
  const open = lines.filter((l) => l.players).map((l) => `- ${l.text}`)
  const secret = lines.filter((l) => !l.players).map((l) => `- ${l.text}`)
  const chunk = [...open, ...(secret.length ? [':::gm', ...secret, ':::'] : [])].join('\n')
  const head = body.search(/^##\s*Session log\s*$/im)
  if (head < 0) return `${body.trimEnd()}${body.trim() ? '\n\n' : ''}## Session log\n\n${chunk}\n`
  // The section runs to the next heading of the same or a higher level.
  const after = body.slice(head).replace(/^.*\n?/, '')
  const next = after.search(/^#{1,2}\s/m)
  const end = next < 0 ? body.length : body.length - after.length + next
  return `${body.slice(0, end).trimEnd()}\n${chunk}\n${next < 0 ? '' : `\n${body.slice(end)}`}`
}

/**
 * Makes the ticked changes. Every page edit goes through saveEntity, so each one can be undone
 * from the page's history. Returns the ledger lines written.
 */
export async function applyUpdates(world: World, session: Session, updates: WorldUpdate[]) {
  const all = (await db.entities.where({ worldId: world.id }).toArray()).filter((e) => !e.template)
  const original = new Map(all.map((e) => [e.id, e]))
  const working = new Map(all.map((e) => [e.id, structuredClone(e)]))
  const made = new Set<string>()
  // Pages that were part of the session as players saw it. GM-only notes, relationships and
  // "check this" lines don't count, so a secret doesn't show up as "seen in session N".
  const seen = new Set<string>()
  const logs = new Map<string, { text: string; players?: boolean }[]>()
  const ledger: LedgerEntry[] = []
  const now = Date.now()
  let order = 0
  const label = `Session ${session.number}`
  const find = () => pageFinder([...working.values()])
  let lookup = find()
  const log = (e: Entity, text: string, players?: boolean) => logs.set(e.id, [...(logs.get(e.id) ?? []), { text: `**${label}:** ${text}`, players }])
  const record = (text: string, e?: Entity, isNew?: boolean) => ledger.push({ id: newId(), at: now + order++, text, entityId: e?.id, made: isNew || undefined })
  const create = (type: EntityType, name: string) => {
    const e = blankEntity(world.id, type, name)
    e.createdAt = e.updatedAt = now + order++
    working.set(e.id, e)
    made.add(e.id)
    lookup = find()
    return e
  }
  const timelineEvent = (name: string, summary: string, involves: string[] = [], where?: string) => {
    const ev = create('event', name)
    ev.eventEra = 'campaign'
    ev.eventOrder = now + order++
    if (session.worldDate) ev.eventWhen = session.worldDate
    ev.summary = summary
    const people = involves.map((n) => lookup(n)?.name).filter(Boolean)
    ev.body = [summary, people.length ? `Involves ${people.map((n) => `[[${n}]]`).join(', ')}.` : '', `Happened in ${label.toLowerCase()}.`].filter(Boolean).join('\n\n')
    const place = lookup(where)
    if (place?.type === 'location') ev.parentId = place.id
    record(`On the timeline: ${name}`, ev, true)
    return ev
  }

  const on = updates.filter((u) => u.on)
  // New pages first, so later suggestions can refer to them by name.
  for (const u of on) {
    if (u.kind !== 'new') continue
    const same = u.useSameAs ? lookup(u.sameAs) : undefined
    if (same) {
      seen.add(same.id)
      log(same, u.details || u.summary)
      record(`${same.name}: ${u.details || u.summary} (heard as “${u.name}”)`, same)
      continue
    }
    const e = create(u.type, u.name)
    e.summary = u.summary
    e.body = u.details
    const place = lookup(u.in)
    if (place && place.type === 'location' && place.id !== e.id) e.parentId = place.id
    log(e, 'first came up.')
    record(describe(u), e, true)
  }
  for (const u of on) {
    switch (u.kind) {
      case 'note': {
        const e = lookup(u.page)
        if (!e) break
        log(e, u.note, u.players)
        if (u.players) seen.add(e.id)
        record(`${e.name}: ${u.note}`, e)
        if (u.timeline) timelineEvent(`${e.name}: ${u.note}`.slice(0, 80), u.note, [e.name])
        break
      }
      case 'quest': {
        const e = lookup(u.page)
        if (!e) break
        if (e.type === 'quest') e.questStatus = u.status
        seen.add(e.id)
        log(e, u.note ? `${u.note} (now ${u.status})` : `Now ${u.status}.`)
        record(describe({ ...u, page: e.name }), e)
        if (u.timeline) timelineEvent(`${e.name} ${u.status === 'done' ? 'completed' : u.status}`, u.note ?? '', [e.name])
        break
      }
      case 'relation': {
        const from = lookup(u.from)
        const to = lookup(u.to)
        if (!from || !to || from.id === to.id) break
        const kind = RELATION_KINDS.find((k) => k.kind === u.relation)?.kind ?? u.relation
        if ((from.relations ?? []).some((r) => r.to === to.id && r.kind === kind)) break
        from.relations = [...(from.relations ?? []), { id: newId(), to: to.id, kind, note: u.note, known: false }]
        record(`${from.name} ${kind} ${to.name}${u.note ? ` (${u.note})` : ''}`, from)
        break
      }
      case 'event':
        timelineEvent(u.name, u.summary, u.involves, u.where)
        break
      case 'status': {
        const e = lookup(u.page)
        if (!e) break
        e.status = u.status
        if (e.statusKnown) seen.add(e.id)
        log(e, u.note ? `${u.note} (${LIFE_STATUS[u.status].label.toLowerCase()})` : `${LIFE_STATUS[u.status].label}.`)
        record(describe({ ...u, page: e.name }), e)
        if (u.timeline) timelineEvent(`${e.name} ${u.status === 'alive' ? 'returns' : u.status === 'dead' ? 'dies' : `goes ${u.status}`}`, u.note ?? '', [e.name])
        break
      }
      case 'item': {
        const item = lookup(u.item) ?? create('item', u.item)
        const toParty = /^(the )?party$/i.test(u.to.trim())
        const holder = toParty ? undefined : lookup(u.to)
        if (!toParty && !holder) break
        item.heldBy = toParty ? 'party' : holder!.id
        seen.add(item.id)
        if (u.quantity) item.quantity = u.quantity
        const who = toParty ? 'the party' : holder!.name
        log(item, `Now with ${who}.`)
        record(describe({ ...u, item: item.name, to: who }), item, made.has(item.id))
        break
      }
      case 'thread': {
        if (u.action === 'raised') {
          const t = create('thread', u.name!)
          t.raisedIn = session.id
          t.summary = u.note ?? ''
          record(describe(u), t, true)
          break
        }
        const t = lookup(u.page)
        if (!t || t.type !== 'thread') break
        t.threadStatus = u.action === 'moved' ? 'active' : u.action
        if (u.action === 'resolved') t.tiedOffIn = session.id
        if (u.note) log(t, u.note)
        record(describe({ ...u, page: t.name }), t)
        break
      }
      case 'conflict': {
        const e = lookup(u.page)
        if (!e) break
        log(e, `Check this: ${u.note}`)
        record(`Worth checking on ${e.name}: ${u.note}`, e)
        break
      }
    }
  }

  // Write the session log lines, then save every page that changed.
  for (const [id, lines] of logs) {
    const e = working.get(id)
    if (e) e.body = addToSessionLog(e.body, lines)
  }
  const touched: string[] = []
  for (const e of working.values()) {
    const before = original.get(e.id)
    if (before && JSON.stringify(before) === JSON.stringify(e)) continue
    e.updatedAt = Math.max(e.updatedAt, now)
    if (made.has(e.id)) await db.entities.add(e)
    else await saveEntity(e)
    if (e.type !== 'event' && e.type !== 'thread' && (made.has(e.id) || seen.has(e.id))) touched.push(e.id)
  }
  // Everyone and everywhere that came up was "in" this session, which also sets their "last seen".
  await db.sessions
    .where('id')
    .equals(session.id)
    .modify((s) => {
      s.entityIds = [...new Set([...s.entityIds, ...touched])]
      s.ledger = [...(s.ledger ?? []), ...ledger]
      if (s.recapDraft) s.recapDraft.updatesDone = true
    })
  return ledger
}

/** Page types a new suggestion can be turned into. */
export const UPDATE_TYPES = NEW_TYPES.filter((t) => (ENTITY_TYPES as readonly string[]).includes(t))
