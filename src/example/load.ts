import { blankEntity, blankLectern, blankPrep, db, newId, type Asset, type Board, type CalDate, type Entity, type Pin, type Session, type World, type WorldMap } from '../db'
import type { ExampleContent, ExMap, ExPage } from './types'
import worldFile from '../../worlds/vael-ardith/world.md?raw'

/**
 * The "version" in worlds/vael-ardith/world.md. Raising it offers a fresh copy to anyone holding an
 * older one (Home and World settings say an update is ready). Read here on its own, so Home doesn't
 * have to download the whole world to know.
 */
export const EXAMPLE_VERSION = Number(worldFile.match(/^version:\s*(\d+)/m)?.[1] ?? 1)

/** Loads the example world as a new world on this device and returns its id. */
export async function loadExampleWorld(): Promise<string> {
  // The content and its drawings are big, so they only download when someone opens the example.
  const [{ EXAMPLE }, { drawArt }] = await Promise.all([import('./content'), import('./art')])
  return addExample(EXAMPLE, drawArt)
}

/**
 * Loads the example world fresh and deletes this copy. The new copy is made first, so if anything
 * goes wrong (offline, say) the old one is still there. A synced copy's cloud copy goes too (when
 * this is its owner), or it would keep coming back under "In your cloud".
 */
export async function resetExampleWorld(worldId: string): Promise<string> {
  const { deleteWorld } = await import('../db')
  const old = await db.worlds.get(worldId)
  const fresh = await loadExampleWorld()
  if (old?.cloud?.enabled) {
    const [{ myRole }, { deleteCloudCopy }] = await Promise.all([import('../cloud/players'), import('../cloud/sync')])
    try {
      if ((await myRole(worldId)) === 'owner') await deleteCloudCopy(worldId)
    } catch {
      // Offline or signed out: the cloud copy stays, and can be deleted from Home later.
    }
  }
  await deleteWorld(worldId)
  return fresh
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

  // The maps take longest, so they start drawing first; the pictures are saved while the rest is built.
  const mapsDrawn = drawMaps(content.maps ?? [], worldId, now, ref, (key) => content.pages.find((p) => p.key === key)!)
  // If building the pages below fails, that error is the one reported; this one isn't left unhandled.
  mapsDrawn.catch(() => {})

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

  // Maps: drawn in the classic style (started early, see above; drawing is async, so it can't happen inside the transaction).
  const { maps, pins } = await mapsDrawn
  for (const m of maps) assets.push(m.asset)

  await db.transaction('rw', [db.worlds, db.campaigns, db.entities, db.sessions, db.assets, db.boards, db.maps, db.pins], async () => {
    await db.worlds.add(world)
    await db.assets.bulkAdd(assets)
    await db.entities.bulkAdd(entities)
    await db.campaigns.add({ id: campaignId, worldId, name: w.campaign.name, description: w.campaign.description, system: w.system, status: 'active', createdAt: now })
    await db.sessions.bulkAdd(sessions)
    await db.boards.bulkAdd(boards)
    await db.maps.bulkAdd(maps.map((m) => m.map))
    await db.pins.bulkAdd(pins)
  })
  return worldId
}

/**
 * Draws each example map (the drawing stays on the map, so it opens in the map builder) and makes
 * its pins. Pin positions are [y, x] with y measured up from the bottom of the picture, as on every map.
 */
async function drawMaps(
  defs: ExMap[],
  worldId: string,
  now: number,
  ref: (key?: string) => string | undefined,
  page: (key: string) => ExPage,
): Promise<{ maps: { map: WorldMap; asset: Asset }[]; pins: Pin[] }> {
  if (!defs.length) return { maps: [], pins: [] }
  const { renderClassic, classicBlob, loadMapFonts, pieceOutline } = await import('../mapArt/classic')
  await loadMapFonts()
  const mapIds = new Map(defs.map((m) => [m.key, newId()]))
  const maps: { map: WorldMap; asset: Asset }[] = []
  const pins: Pin[] = []
  // each picture is saved (encoded) in the background while the next map is drawn
  const saving: Promise<void>[] = []
  for (const def of defs) {
    const drawing = def.drawing()
    const canvas = renderClassic(drawing, def.width, def.height)
    const visibility = def.players ? ('players' as const) : ('gm' as const)
    const asset: Asset = { id: newId(), worldId, name: def.name, mime: '', size: 0, blob: new Blob(), tags: ['map', 'drawn', 'example'], visibility, createdAt: now }
    saving.push(
      classicBlob(canvas).then((blob) => {
        Object.assign(asset, { name: `${def.name}.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`, mime: blob.type, size: blob.size, blob })
      }),
    )
    const mapId = mapIds.get(def.key)!
    maps.push({
      asset,
      map: { id: mapId, worldId, name: def.name, imageId: asset.id, width: def.width, height: def.height, visibility, locationId: ref(def.location), drawing, createdAt: now },
    })
    const H = def.height
    for (const p of def.pins) {
      const target = page(p.page)
      if (!target) throw new Error(`Example map "${def.name}": no page with key "${p.page}"`)
      // a pin is only for players when both the map and the page are
      const shown = def.players && target.players ? ('players' as const) : ('gm' as const)
      const childMapId = p.map ? mapIds.get(p.map) : undefined
      if (p.map && !childMapId) throw new Error(`Example map "${def.name}": no map with key "${p.map}"`)
      const base = { id: newId(), worldId, mapId, label: p.label ?? target.name, entityId: ref(p.page), childMapId, note: p.note ?? '', visibility: shown }
      const shape = p.piece ? drawing.shapes.find((s) => s.id === p.piece) : undefined
      if (p.piece && shape?.kind !== 'asset') throw new Error(`Example map "${def.name}": no piece "${p.piece}"`)
      if (shape?.kind === 'asset') {
        const outline = pieceOutline({ id: shape.id, asset: shape.asset, at: shape.at, size: shape.size, seed: shape.seed, variant: shape.variant, flip: !!shape.flip, turn: shape.turn })
        pins.push({ ...base, kind: 'region', color: '#e0b354', pieceId: shape.id, points: outline.map(([x, y]) => [Math.round((H - y) * 10) / 10, Math.round(x * 10) / 10]) })
      } else pins.push({ ...base, kind: 'point', color: shown === 'gm' ? '#d9534f' : '#e0b354', position: [H - p.at[1], p.at[0]] })
    }
  }
  await Promise.all(saving)
  return { maps, pins }
}
