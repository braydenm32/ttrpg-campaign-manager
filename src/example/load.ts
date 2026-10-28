import { blankEntity, blankLectern, blankPrep, db, newId, type Asset, type Board, type CalDate, type Entity, type Session, type World } from '../db'
import type { ExampleContent, ExPage } from './types'

/**
 * Bumped whenever the example world's content changes, so Home can offer a fresh copy to anyone
 * holding an older one.
 */
export const EXAMPLE_VERSION = 1

/** Loads the example world as a new world on this device and returns its id. */
export async function loadExampleWorld(): Promise<string> {
  // The content and its drawings are big, so they only download when someone opens the example.
  const [{ EXAMPLE }, { drawArt }] = await Promise.all([import('./content'), import('./art')])
  return addExample(EXAMPLE, drawArt)
}

/** Deletes this copy of the example world and loads it fresh. */
export async function resetExampleWorld(worldId: string): Promise<string> {
  const { deleteWorld } = await import('../db')
  await deleteWorld(worldId)
  return loadExampleWorld()
}

async function addExample(content: ExampleContent, drawArt: (key: string, page?: ExPage) => Promise<Blob | undefined>): Promise<string> {
  const worldId = newId()
  const now = Date.now()
  const ids = new Map<string, string>()
  const id = (key: string) => {
    if (!ids.has(key)) ids.set(key, newId())
    return ids.get(key)!
  }
  const known = new Set(content.pages.map((p) => p.key))
  const ref = (key?: string) => {
    if (!key) return undefined
    if (!known.has(key)) throw new Error(`Example world: no page with key "${key}"`)
    return id(key)
  }

  // Pictures: each drawing becomes one file, shared by every page that uses it.
  const assets: Asset[] = []
  const artIds = new Map<string, string>()
  const art = async (key?: string, page?: ExPage) => {
    if (!key) return undefined
    if (!artIds.has(key)) {
      const blob = await drawArt(key, page)
      if (!blob) return undefined
      const assetId = newId()
      artIds.set(key, assetId)
      assets.push({ id: assetId, worldId, name: key, mime: blob.type, size: blob.size, blob, tags: ['example'], visibility: 'gm', createdAt: now })
    }
    return artIds.get(key)
  }

  // Content counts months from 1, the app from 0.
  const date = (d?: CalDate) => d && { ...d, month: d.month - 1 }

  const ageIds = new Map(content.world.ages.map((a) => [a.key, newId()]))
  const entities: Entity[] = []
  for (const [i, p] of content.pages.entries()) {
    const e = blankEntity(worldId, p.type, p.name)
    const age = p.age && p.age !== 'campaign' ? ageIds.get(p.age) : undefined
    if (p.age && p.age !== 'campaign' && !age) throw new Error(`Example world: "${p.name}" is in an unknown age "${p.age}"`)
    entities.push({
      ...e,
      id: id(p.key),
      summary: p.summary ?? '',
      body: p.body ?? '',
      gmNotes: p.gmNotes ?? '',
      visibility: p.players ? 'players' : 'gm',
      parentId: ref(p.parent),
      tags: p.tags ?? [],
      gmTags: p.gmTags,
      fields: p.fields ?? [],
      aliases: p.aliases,
      imageId: await art(p.image, p),
      status: p.status,
      statusKnown: p.statusKnown,
      relations: p.relations?.map((r) => ({ id: newId(), to: ref(r.to)!, kind: r.kind, note: r.note, known: r.known })),
      clocks: p.clocks?.map((c) => ({ ...c, id: newId() })),
      ...(p.type === 'event'
        ? { eventEra: p.age === 'campaign' ? ('campaign' as const) : ('pre' as const), eventAge: age, eventWhen: date(p.when), eventDate: p.date, eventOrder: p.order ?? i }
        : {}),
      questStatus: p.questStatus ?? e.questStatus,
      threadStatus: p.threadStatus ?? e.threadStatus,
      threadUrgency: p.threadUrgency ?? e.threadUrgency,
      entries: p.entries ?? e.entries,
      heldBy: p.heldBy === 'party' ? 'party' : ref(p.heldBy),
      quantity: p.quantity,
      template: p.template,
      createdAt: now + i,
      updatedAt: now,
    })
  }

  const campaignId = newId()
  const sessionIds = new Map(content.sessions.map((s) => [s.number, newId()]))
  // Loose threads point at the session that raised or tied them off.
  for (const [i, p] of content.pages.entries()) {
    if (p.raisedIn) entities[i].raisedIn = sessionIds.get(p.raisedIn)
    if (p.tiedOffIn) entities[i].tiedOffIn = sessionIds.get(p.tiedOffIn)
  }
  const sessions: Session[] = content.sessions.map((s) => ({
    id: sessionIds.get(s.number)!,
    worldId,
    campaignId,
    number: s.number,
    title: s.title,
    date: '',
    notes: s.notes,
    recap: s.recap ?? '',
    visibility: s.players ? 'players' : 'gm',
    entityIds: (s.pages ?? []).map((k) => ref(k)!),
    recordings: [],
    worldDate: date(s.worldDate),
    prep: s.prep && {
      ...blankPrep(),
      strongStart: s.prep.strongStart,
      scenes: s.prep.scenes.map((text) => ({ id: newId(), text, done: false })),
      clues: s.prep.clues.map((text) => ({ id: newId(), text, done: false })),
      encounters: s.prep.encounters.map((enc) => ({
        id: newId(),
        name: enc.name,
        notes: enc.notes,
        foes: enc.foes.map((f) => ({ id: newId(), name: f.name, count: f.count, hp: f.hp, ac: f.ac, side: f.side, entityId: ref(f.page) })),
      })),
    },
    lectern: s.lectern && { ...blankLectern(), sceneId: ref(s.lectern.scene), sceneText: s.lectern.sceneText, presentIds: (s.lectern.present ?? []).map((k) => ref(k)!) },
    createdAt: now + s.number,
  }))

  const boards: Board[] = content.boards.map((b) => {
    const cardIds = new Map(b.cards.map((c) => [c.key, newId()]))
    return {
      id: newId(),
      worldId,
      name: b.name,
      cards: b.cards.map((c) => ({ id: cardIds.get(c.key)!, x: c.x, y: c.y, entityId: ref(c.page), text: c.text, color: c.color })),
      strings: b.strings.map((s) => ({ id: newId(), from: cardIds.get(s.from)!, to: cardIds.get(s.to)!, label: s.label })),
      createdAt: now,
      updatedAt: now,
    }
  })

  const w = content.world
  const world: World = {
    id: worldId,
    name: w.name,
    description: w.description,
    system: w.system,
    color: w.color,
    coverId: await art(w.cover),
    calendar: w.calendar,
    ages: w.ages.map((a) => ({ id: ageIds.get(a.key)!, name: a.name, span: a.span, summary: a.summary })),
    safety: w.safety,
    partyCoin: w.partyCoin,
    example: EXAMPLE_VERSION,
    createdAt: now,
    updatedAt: now,
  }
  // Players see the cover on the world's book, so its picture is theirs too.
  const cover = assets.find((a) => a.id === world.coverId)
  if (cover) cover.visibility = 'players'

  await db.transaction('rw', [db.worlds, db.campaigns, db.entities, db.sessions, db.assets, db.boards], async () => {
    await db.worlds.add(world)
    await db.assets.bulkAdd(assets)
    await db.entities.bulkAdd(entities)
    await db.campaigns.add({ id: campaignId, worldId, name: w.campaign.name, description: w.campaign.description, system: w.system, status: 'active', createdAt: now })
    await db.sessions.bulkAdd(sessions)
    await db.boards.bulkAdd(boards)
  })
  return worldId
}
