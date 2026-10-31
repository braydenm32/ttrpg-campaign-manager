import type { Page } from '@playwright/test'

/**
 * The example world as the app stored it in the browser (IndexedDB), read straight from the
 * database so the tests know the real ids, names and secrets without hard-coding them.
 */

export interface Field {
  key: string
  value: string
  gm?: boolean
}
export interface Entity {
  id: string
  type: string
  customType?: string | null
  template?: boolean
  name: string
  summary: string
  body: string
  gmNotes: string
  visibility: 'gm' | 'players'
  tags: string[]
  gmTags?: string[]
  aliases?: string[]
  fields: Field[]
  playerBody?: string
  clocks?: { name: string; known?: boolean }[]
  relations?: { kind: string; note?: string; known?: boolean }[]
  objectives?: { text: string; known?: boolean }[]
  rewards?: { text: string; known?: boolean }[]
  entries?: string[]
  createdAt: number
}
export interface Dump {
  worlds: (Record<string, unknown> & { id: string; name: string; createdAt: number; customTypes?: { id: string; one: string; many: string }[] })[]
  entities: Entity[]
  maps: { id: string; name: string; visibility: string }[]
  pins: { id: string; mapId: string; label: string; note: string; visibility: string }[]
  sessions: { id: string; number: number; title: string; notes?: string; recap?: string; visibility: string; campaignId: string }[]
  campaigns: { id: string; name: string; description: string; visibility?: string | null }[]
  boards: { id: string; name: string }[]
}

/** Every table of the app's database, minus pictures and drawings. Runs in the page. */
export async function readDatabase(page: Page): Promise<Dump> {
  return page.evaluate(
    () =>
      new Promise<Dump>((resolve, reject) => {
        const req = indexedDB.open('ttrpg-campaign-manager')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const idb = req.result
          const want = ['worlds', 'entities', 'maps', 'pins', 'sessions', 'campaigns', 'boards']
          const tx = idb.transaction(want, 'readonly')
          const out: Record<string, unknown[]> = {}
          let left = want.length
          for (const s of want) {
            const r = tx.objectStore(s).getAll()
            r.onsuccess = () => {
              out[s] = r.result.map((x: Record<string, unknown>) => {
                const y = { ...x }
                delete y.blob
                delete y.drawing
                return y
              })
              if (!--left) {
                idb.close()
                resolve(out as unknown as Dump)
              }
            }
          }
        }
      }),
  )
}

/** A custom page type the tests add to the example (it has none), so /other/<kind> has something to show. */
export const TEST_CUSTOM_TYPE = { id: 'test-custom-type', one: 'Ward Note', many: 'Ward Notes', icon: '📜' }

/** Adds the test's custom page type to the world, straight into the database. Runs in the page. */
export async function addCustomType(page: Page, worldId: string) {
  await page.evaluate(
    ({ worldId, custom }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('ttrpg-campaign-manager')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const idb = req.result
          const store = idb.transaction('worlds', 'readwrite').objectStore('worlds')
          const get = store.get(worldId)
          get.onsuccess = () => {
            const w = get.result
            w.customTypes = [...(w.customTypes ?? []).filter((c: { id: string }) => c.id !== custom.id), custom]
            const put = store.put(w)
            put.onsuccess = () => {
              idb.close()
              resolve()
            }
            put.onerror = () => reject(put.error)
          }
        }
      }),
    { worldId, custom: TEST_CUSTOM_TYPE },
  )
}

/** The app's own address names (src/paths.ts slugify), so tests can build the same short addresses. */
export function slugify(name: string) {
  const s = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
  return s || 'untitled'
}

/** Slugs the way src/paths.ts hands them out: oldest first, repeats get -2, -3… */
function assign<T extends { id: string; createdAt: number }>(items: T[], name: (x: T) => string) {
  const used = new Set<string>()
  const out = new Map<string, string>()
  for (const x of [...items].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))) {
    const base = slugify(name(x))
    let slug = base
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`
    used.add(slug)
    out.set(x.id, slug)
  }
  return out
}

/** The example world, with what the tests need to know about it. */
export class World {
  readonly id: string
  readonly slug: string
  readonly pageSlugs: Map<string, string>
  constructor(readonly dump: Dump) {
    const w = dump.worlds.find((x) => x.example) ?? dump.worlds[0]
    this.id = w.id
    this.slug = assign(dump.worlds, (x) => x.name).get(w.id)!
    this.pageSlugs = assign(dump.entities, (e) => e.name)
  }
  get world() {
    return this.dump.worlds.find((w) => w.id === this.id)!
  }
  page(name: string) {
    const e = this.dump.entities.find((x) => x.name === name)
    if (!e) throw new Error(`The example world has no page called “${name}”`)
    return e
  }
  pageSlug(name: string) {
    return this.pageSlugs.get(this.page(name).id)!
  }
  /**
   * Pages a player sees in the example (revealed to everyone, not templates), by name. Ids differ in
   * each worker's copy of the world, so anything split between tests must go by name.
   */
  get playerPages() {
    return this.dump.entities.filter((e) => e.visibility === 'players' && !e.template).sort((a, b) => a.name.localeCompare(b.name))
  }
  map(name: string) {
    const m = this.dump.maps.find((x) => x.name === name)
    if (!m) throw new Error(`The example world has no map called “${name}”`)
    return m
  }
  session(n: number) {
    const s = this.dump.sessions.find((x) => x.number === n)
    if (!s) throw new Error(`The example world has no session #${n}`)
    return s
  }

  /**
   * Fills in a sample address from tests/routes.ts:
   * {world} {worldId} {page:Name} {pageId:Name} {map:Name} {session:N} {campaign} {board} {custom} {customId}
   */
  resolve(sample: string) {
    return sample.replace(/\{(\w+)(?::([^}]+))?\}/g, (_, key: string, arg?: string) => {
      switch (key) {
        case 'world':
          return this.slug
        case 'worldId':
          return this.id
        case 'page':
          return this.pageSlug(arg!)
        case 'pageId':
          return this.page(arg!).id
        case 'map':
          return this.map(arg!).id
        case 'session':
          return this.session(Number(arg)).id
        case 'campaign':
          return this.dump.campaigns[0].id
        case 'board':
          return this.dump.boards[0].id
        case 'custom':
          return slugify(TEST_CUSTOM_TYPE.many)
        case 'customId':
          return TEST_CUSTOM_TYPE.id
        default:
          throw new Error(`Unknown placeholder {${key}} in ${sample}`)
      }
    })
  }
}
