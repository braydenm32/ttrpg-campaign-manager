import { blankEntity, blankLectern, blankPrep, db, newId, type Asset, type Board, type CalDate, type Entity, type Pin, type Session, type World, type WorldMap } from '../db'
import type { ExampleContent, ExMap, ExPage } from './types'
import worldFile from '../../worlds/vael-ardith/world.md?raw'
import { loadInBackground } from '../worldLoading'

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

type DrawArt = (key: string, page?: ExPage) => Promise<Blob | undefined>

/**
 * What's still to draw for a new example world: its pictures and maps (with the ids its pages
 * already point at), and the page ids its map pins need. Kept on this device, so closing the tab
 * halfway doesn't lose it: the drawing carries on the next time the world is opened.
 */
interface Plan {
  art: { id: string; key: string; page?: string }[]
  maps: { id: string; key: string }[]
  pages: Record<string, string>
  now: number
}

const planKey = (worldId: string) => `example.toDraw.${worldId}`

function readPlan(worldId: string): Plan | undefined {
  try {
    const raw = localStorage.getItem(planKey(worldId))
    return raw ? (JSON.parse(raw) as Plan) : undefined
  } catch {
    return undefined
  }
}

function savePlan(worldId: string, plan: Plan | undefined) {
  try {
    if (plan) localStorage.setItem(planKey(worldId), JSON.stringify(plan))
    else localStorage.removeItem(planKey(worldId))
  } catch {
    // Storage full or blocked: drawing still finishes while the tab stays open.
  }
}

/** Picks up an example world's unfinished drawing (after a reload, say). Does nothing for other worlds. */
export async function finishExampleWorld(worldId: string) {
  if (drawing.has(worldId) || !readPlan(worldId)) return
  const [{ EXAMPLE }, { drawArt }] = await Promise.all([import('./content'), import('./art')])
  await drawRest(worldId, EXAMPLE, drawArt)
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

async function addExample(content: ExampleContent, drawArt: DrawArt): Promise<string> {
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

  // Pictures and maps take far longer than the pages, so the world opens first and they're drawn
  // afterwards (see drawRest). Each drawing becomes one file, shared by every page that uses it;
  // its id is picked now so the pages can point at it already.
  const plan: Plan = { art: [], maps: [], pages: {}, now }
  const artIds = new Map<string, string>()
  const art = (key?: string, page?: ExPage) => {
    if (!key) return undefined
    if (!artIds.has(key)) {
      artIds.set(key, newId())
      plan.art.push({ id: artIds.get(key)!, key, page: page?.key })
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
      imageId: art(p.image, p),
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
    coverId: art(w.cover),
    calendar: w.calendar,
    ages: w.ages.map((a) => ({ id: ageIds.get(a.key)!, name: a.name, span: a.span, summary: a.summary })),
    safety: w.safety,
    partyCoin: w.partyCoin,
    example: EXAMPLE_VERSION,
    createdAt: now,
    updatedAt: now,
  }
  // The cover comes first, so the world's book on Home gets its picture soonest.
  plan.art.sort((a, b) => Number(b.id === world.coverId) - Number(a.id === world.coverId))
  plan.maps = (content.maps ?? []).map((m) => ({ id: newId(), key: m.key }))
  // Checked now, so a mistake in the content stops the load instead of failing halfway through drawing.
  for (const m of content.maps ?? []) for (const p of m.pins) ref(p.page)
  plan.pages = Object.fromEntries(ids)

  await db.transaction('rw', [db.worlds, db.campaigns, db.entities, db.sessions, db.boards], async () => {
    await db.worlds.add(world)
    await db.entities.bulkAdd(entities)
    await db.campaigns.add({ id: campaignId, worldId, name: w.campaign.name, description: w.campaign.description, system: w.system, status: 'active', createdAt: now })
    await db.sessions.bulkAdd(sessions)
    await db.boards.bulkAdd(boards)
  })
  savePlan(worldId, plan)
  // Not awaited: the world opens while this runs.
  void drawRest(worldId, content, drawArt, plan)
  return worldId
}

/**
 * Draws an example world's pictures, then its maps, saving each as soon as it's done, so they pop
 * in while the GM is already looking round. Stops if the world is deleted meanwhile.
 */
async function drawRest(worldId: string, content: ExampleContent, drawArt: DrawArt, plan = readPlan(worldId)) {
  // Claimed before anything is awaited, so opening the world meanwhile doesn't start a second drawing.
  if (!plan || drawing.has(worldId)) return
  drawing.add(worldId)
  try {
    await drawPlan(worldId, content, drawArt, plan)
  } finally {
    drawing.delete(worldId)
  }
}

/** Worlds whose pictures and maps this tab is drawing now. */
const drawing = new Set<string>()

async function drawPlan(worldId: string, content: ExampleContent, drawArt: DrawArt, plan: Plan) {
  const gone = async () => {
    if (await db.worlds.get(worldId)) return false
    savePlan(worldId, undefined)
    return true
  }
  const world = await db.worlds.get(worldId)
  const classic = plan.maps.length ? await import('../mapArt/classic') : undefined
  await classic?.loadMapFonts()
  const mapIds = new Map(plan.maps.map((m) => [m.key, m.id]))
  const ref = (key?: string) => (key ? plan.pages[key] : undefined)
  const drawOne = async (a: Plan['art'][number]) => {
    if (await db.assets.get(a.id)) return
    const page = a.page ? content.pages.find((p) => p.key === a.page) : undefined
    const blob = await drawArt(a.key, page)
    if (await gone()) return false
    if (blob) {
      // Players see the cover on the world's book, so its picture is theirs too.
      const visibility = a.id === world?.coverId ? ('players' as const) : ('gm' as const)
      await db.assets.add({ id: a.id, worldId, name: a.key, mime: blob.type, size: blob.size, blob, tags: ['example'], visibility, createdAt: plan.now })
    } else {
      // Nothing to draw for this key: the pages that pointed at it go without a picture.
      await db.entities.where({ worldId }).filter((e) => e.imageId === a.id).modify({ imageId: undefined })
      if (world?.coverId === a.id) await db.worlds.update(worldId, { coverId: undefined })
    }
  }
  const drawOneMap = async (m: Plan['maps'][number]) => {
    const def = content.maps?.find((d) => d.key === m.key)
    if (!def || !classic || (await db.maps.get(m.id))) return
    const made = drawMap(def, m.id, worldId, plan.now, ref, mapIds, (key) => content.pages.find((p) => p.key === key), classic.renderClassic, classic.pieceOutline)
    const blob = await classic.classicBlob(made.canvas)
    if (await gone()) return false
    const asset: Asset = { ...made.asset, name: `${def.name}.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`, mime: blob.type, size: blob.size, blob }
    await db.transaction('rw', [db.assets, db.maps, db.pins], async () => {
      await db.assets.add(asset)
      await db.maps.add(made.map)
      await db.pins.bulkAdd(made.pins)
    })
  }
  const steps = [...plan.art.map((a) => () => drawOne(a)), ...plan.maps.map((m) => () => drawOneMap(m))]
  try {
    let stopped = false
    await loadInBackground(worldId, 'drawing', steps, async (step) => {
      const ok = await step()
      if (ok === false) stopped = true
      return ok
    })
    if (!stopped) savePlan(worldId, undefined)
  } catch (e) {
    // Left in the plan, so the next visit tries again.
    console.error('Drawing the example world failed', e)
  }
}

/**
 * Draws one example map (the drawing stays on the map, so it opens in the map builder) and makes
 * its pins. Pin positions are [y, x] with y measured up from the bottom of the picture, as on every map.
 */
function drawMap(
  def: ExMap,
  mapId: string,
  worldId: string,
  now: number,
  ref: (key?: string) => string | undefined,
  mapIds: Map<string, string>,
  page: (key: string) => ExPage | undefined,
  renderClassic: typeof import('../mapArt/classic').renderClassic,
  pieceOutline: typeof import('../mapArt/classic').pieceOutline,
): { map: WorldMap; asset: Asset; canvas: HTMLCanvasElement; pins: Pin[] } {
  const drawing = def.drawing()
  const canvas = renderClassic(drawing, def.width, def.height)
  const visibility = def.players ? ('players' as const) : ('gm' as const)
  const asset: Asset = { id: newId(), worldId, name: def.name, mime: '', size: 0, blob: new Blob(), tags: ['map', 'drawn', 'example'], visibility, createdAt: now }
  const map: WorldMap = { id: mapId, worldId, name: def.name, imageId: asset.id, width: def.width, height: def.height, visibility, locationId: ref(def.location), drawing, createdAt: now }
  const pins: Pin[] = []
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
  return { map, asset, canvas, pins }
}
