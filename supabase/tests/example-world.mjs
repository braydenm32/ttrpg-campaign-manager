// Writes the Vael Ardith example world as cloud rows (SQL for public.records), the way the app stores it
// once a GM switches on sync, for supabase/tests/security_audit.sql to compare what players receive.
//   node --disable-warning=ExperimentalWarning supabase/tests/example-world.mjs [world id] > /tmp/example-world.sql
// The pages, sessions and maps come from the app's own reader (src/example/parse.ts, src/example/maps),
// and become rows as src/example/load.ts makes them (addExample, drawPlan), except that pictures are not
// drawn: each picture is a row with a made-up size, and map pins are plain markers. Ids are fixed, so the
// output is the same every time.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runnerImport } from 'vite'
import { parseExampleFiles } from '../../src/example/parse.ts'

const worldId = process.argv[2] ?? '20000000-0000-4000-8000-000000000002'
const repo = join(import.meta.dirname, '..', '..')
const folder = join(repo, 'worlds', 'vael-ardith')
const files = Object.fromEntries(
  readdirSync(folder, { recursive: true })
    .map((p) => String(p).replaceAll('\\', '/'))
    .filter((p) => p.endsWith('.md'))
    .map((p) => [p, readFileSync(join(folder, p), 'utf8')]),
)
const { module: mapsModule } = await runnerImport(join(repo, 'src/example/maps/index.ts'), { configFile: false, logLevel: 'silent' })
const MAPS = mapsModule.MAPS
const { content, problems, version } = parseExampleFiles(files, MAPS)
const errors = problems.filter((p) => p.level === 'error')
if (errors.length) throw new Error(`The example world has mistakes: ${errors.map((e) => `${e.file}: ${e.message}`).join('; ')}`)

let counter = 0
const newId = () => `ba000000-0000-4000-8000-${(++counter).toString(16).padStart(12, '0')}`
const now = 1793000000000
const rows = []
const row = (table, data) => rows.push({ table, data })

// ---- as addExample in src/example/load.ts ----
const ids = new Map()
const id = (key) => {
  if (!ids.has(key)) ids.set(key, newId())
  return ids.get(key)
}
const known = new Set(content.pages.map((p) => p.key))
const ref = (key) => {
  if (!key) return undefined
  if (!known.has(key)) throw new Error(`no page with key "${key}"`)
  return id(key)
}
const art = []
const artIds = new Map()
const artOf = (key, page) => {
  if (!key) return undefined
  if (!artIds.has(key)) {
    artIds.set(key, newId())
    art.push({ id: artIds.get(key), key, page: page?.key })
  }
  return artIds.get(key)
}
const date = (d) => d && { ...d, month: d.month - 1 }
const blankEntity = (type, name) => ({
  id: newId(),
  worldId,
  type,
  name,
  summary: '',
  body: '',
  gmNotes: '',
  visibility: 'gm',
  tags: [],
  fields: [],
  createdAt: now,
  updatedAt: now,
  ...(type === 'event' ? { eventEra: 'pre', eventOrder: now } : {}),
  ...(type === 'quest' ? { questStatus: 'open' } : {}),
  ...(type === 'thread' ? { threadStatus: 'open', threadUrgency: 'normal' } : {}),
  ...(type === 'table' ? { entries: [] } : {}),
})

const ageIds = new Map(content.world.ages.map((a) => [a.key, newId()]))
const entities = content.pages.map((p, i) => {
  const e = blankEntity(p.type, p.name)
  const age = p.age && p.age !== 'campaign' ? ageIds.get(p.age) : undefined
  return {
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
    imageId: artOf(p.image, p),
    status: p.status,
    statusKnown: p.statusKnown,
    relations: p.relations?.map((r) => ({ id: newId(), to: ref(r.to), kind: r.kind, note: r.note, known: r.known })),
    clocks: p.clocks?.map((c) => ({ ...c, id: newId() })),
    ...(p.type === 'event'
      ? { eventEra: p.age === 'campaign' ? 'campaign' : 'pre', eventAge: age, eventWhen: date(p.when), eventDate: p.date, eventOrder: p.order ?? i }
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
  }
})
const campaignId = newId()
const sessionIds = new Map(content.sessions.map((s) => [s.number, newId()]))
content.pages.forEach((p, i) => {
  if (p.raisedIn) entities[i].raisedIn = sessionIds.get(p.raisedIn)
  if (p.tiedOffIn) entities[i].tiedOffIn = sessionIds.get(p.tiedOffIn)
})
for (const e of entities) row('entities', e)
for (const s of content.sessions)
  row('sessions', {
    id: sessionIds.get(s.number),
    worldId,
    campaignId,
    number: s.number,
    title: s.title,
    date: '',
    notes: s.notes,
    recap: s.recap ?? '',
    visibility: s.players ? 'players' : 'gm',
    entityIds: (s.pages ?? []).map((k) => ref(k)),
    recordings: [],
    worldDate: date(s.worldDate),
    prep: s.prep && { strongStart: s.prep.strongStart, scenes: s.prep.scenes.map((text) => ({ id: newId(), text, done: false })), clues: s.prep.clues.map((text) => ({ id: newId(), text, done: false })), encounters: [] },
    lectern: s.lectern && { sceneId: ref(s.lectern.scene), sceneText: s.lectern.sceneText, presentIds: (s.lectern.present ?? []).map((k) => ref(k)) },
    createdAt: now + s.number,
  })
const w = content.world
const world = {
  id: worldId,
  name: w.name,
  description: w.description,
  system: w.system,
  color: w.color,
  coverId: artOf(w.cover),
  calendar: w.calendar,
  ages: w.ages.map((a) => ({ id: ageIds.get(a.key), name: a.name, span: a.span, summary: a.summary })),
  safety: w.safety,
  partyCoin: w.partyCoin,
  example: version,
  createdAt: now,
  updatedAt: now,
}
row('worlds', world)
row('campaigns', { id: campaignId, worldId, name: w.campaign.name, description: w.campaign.description, system: w.system, status: 'active', createdAt: now })

// ---- pictures and maps, as drawPlan and drawMap make them (without drawing anything) ----
art.forEach((a, i) => {
  const page = a.page ? content.pages.find((p) => p.key === a.page) : undefined
  const forPage = page ?? content.pages.find((p) => p.key === a.key.replace(/^[a-z]+:/, ''))
  const cover = a.id === world.coverId
  const name = forPage ? `${forPage.name}.png` : cover ? `${w.name} cover.png` : `${a.key.replace(/^[a-z]+:/, '').replace(/-/g, ' ')}.png`
  row('assets', { id: a.id, worldId, name, mime: 'image/png', size: 1000 + i, tags: ['example'], visibility: cover ? 'players' : 'gm', createdAt: now })
})
const mapIds = new Map(MAPS.map((m) => [m.key, newId()]))
MAPS.forEach((def, i) => {
  const visibility = def.players ? 'players' : 'gm'
  const assetId = newId()
  row('assets', { id: assetId, worldId, name: `${def.name}.webp`, mime: 'image/webp', size: 50000 + i, tags: ['map', 'drawn', 'example'], visibility, createdAt: now })
  const mapId = mapIds.get(def.key)
  row('maps', { id: mapId, worldId, name: def.name, imageId: assetId, width: def.width, height: def.height, visibility, locationId: ref(def.location), createdAt: now })
  for (const p of def.pins) {
    const target = content.pages.find((x) => x.key === p.page)
    const shown = def.players && target.players ? 'players' : 'gm'
    row('pins', {
      id: newId(),
      worldId,
      mapId,
      label: p.label ?? target.name,
      entityId: ref(p.page),
      childMapId: p.map ? mapIds.get(p.map) : undefined,
      note: p.note ?? '',
      visibility: shown,
      kind: 'point',
      color: shown === 'gm' ? '#d9534f' : '#e0b354',
      position: [def.height - p.at[1], p.at[0]],
    })
  }
})

// ---- SQL ----
const quote = (s) => `'${s.replaceAll("'", "''")}'`
// The app strips NUL characters before upload (src/cloud/sync.ts, withoutNul); Postgres can't store them.
const json = (data) => JSON.stringify(data).replaceAll('\\u0000', '')
const out = [`-- ${rows.length} rows of the Vael Ardith example world (example version ${version}), made by supabase/tests/example-world.mjs.`]
for (let i = 0; i < rows.length; i += 100) {
  const chunk = rows.slice(i, i + 100)
  out.push('insert into public.records (world_id, table_name, id, data) values')
  out.push(chunk.map((r) => `(${quote(worldId)}, ${quote(r.table)}, ${quote(r.data.id)}, ${quote(json(r.data))}::jsonb)`).join(',\n') + ';')
}
process.stdout.write(out.join('\n') + '\n')
