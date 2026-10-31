import { liveQuery } from 'dexie'
import { useSyncExternalStore } from 'react'
import { db, type Entity, type EntityType, type World } from './db'

/**
 * Short, readable addresses: /w/eldoria/locations or /w/eldoria/p/rusty-tankard instead of long codes.
 * Every link is still made from ids; these helpers turn the ids into names on the way out, and the
 * names back into ids on the way in. The long codes keep working, so old links and bookmarks open
 * the same place (and are tidied to the short form once there).
 */

/**
 * The desktop app and the old GitHub Pages address keep the "#/" style: neither can answer a deep
 * address like /w/eldoria by itself. On wardedatlas.com (and the dev server) the "#" is gone.
 */
export const hashRouting = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || window.location.hostname === 'braydenm32.github.io')

/** "The Rusty Tankard!" → "the-rusty-tankard". */
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

/** Section words for each kind of page. "thread" can't be "threads": that's the loose threads board. */
const TYPE_SLUGS: Record<EntityType, string> = {
  location: 'locations',
  npc: 'npcs',
  pc: 'characters',
  faction: 'factions',
  item: 'items',
  event: 'events',
  quest: 'quests',
  shop: 'shops',
  deity: 'deities',
  lore: 'lore',
  thread: 'loose-threads',
  table: 'tables',
  custom: 'other',
}
const SLUG_TYPES = new Map(Object.entries(TYPE_SLUGS).map(([t, s]) => [s, t as EntityType]))

/** The page type a section word stands for (old addresses used the type itself, so that works too). */
export function sectionType(section: string): EntityType | undefined {
  return SLUG_TYPES.get(section) ?? (section in TYPE_SLUGS ? (section as EntityType) : undefined)
}
export const SECTION_WORDS = Object.values(TYPE_SLUGS)

// What's known right now. Old names stay in the "back to id" maps so a link made before a rename
// still opens the page.
const worldSlug = new Map<string, string>()
const worldBySlug = new Map<string, string>()
const customSlug = new Map<string, string>() // `${worldId}/${customTypeId}` → slug
const customBySlug = new Map<string, string>() // `${worldId}/${slug}` → custom type id
const pageSlug = new Map<string, string>() // entity id → slug
const pageBySlug = new Map<string, string>() // `${worldId}/${slug}` → entity id

let version = 0
const listeners = new Set<() => void>()
function changed() {
  version++
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
/** Re-renders when names change, so a page can tidy its own address. */
export const usePathsVersion = () => useSyncExternalStore(subscribe, () => version)

/** Gives each item a slug of its name, adding -2, -3… for repeats (oldest keeps the plain name). */
function assign<T extends { id: string; createdAt: number }>(items: T[], name: (x: T) => string, put: (x: T, slug: string) => void) {
  const used = new Set<string>()
  for (const x of [...items].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))) {
    const base = slugify(name(x))
    let slug = base
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`
    used.add(slug)
    put(x, slug)
  }
}

// Names things used to have, kept on this device so a bookmark made before a rename still works.
const ALIASES_KEY = 'atlas.worldAliases'
const pageAliasesKey = (worldId: string) => `atlas.pageAliases.${worldId}`
function readAliases(key = ALIASES_KEY): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}')
  } catch {
    return {}
  }
}
function saveAliases(aliases: Record<string, string>, key = ALIASES_KEY) {
  try {
    localStorage.setItem(key, JSON.stringify(aliases))
  } catch {
    // private window: old names are just forgotten on reload
  }
}

function setWorlds(worlds: World[]) {
  // A bookmark made before a world was renamed still finds it, even after a reload.
  const aliases = readAliases()
  worldBySlug.clear()
  for (const [slug, id] of Object.entries(aliases)) worldBySlug.set(slug, id)
  worldSlug.clear()
  assign(worlds, (w) => w.name, (w, slug) => {
    worldSlug.set(w.id, slug)
    worldBySlug.set(slug, w.id)
    aliases[slug] = w.id
    for (const c of w.customTypes ?? []) customSlug.delete(`${w.id}/${c.id}`)
    assign(
      (w.customTypes ?? []).map((c) => ({ ...c, createdAt: 0 })),
      (c) => c.many,
      (c, s) => {
        customSlug.set(`${w.id}/${c.id}`, s)
        customBySlug.set(`${w.id}/${s}`, c.id)
      },
    )
  })
  saveAliases(aliases)
  changed()
}

/** Loads world names before the app starts and keeps them up to date. */
export async function startPaths() {
  setWorlds(await db.worlds.toArray())
  liveQuery(() => db.worlds.toArray()).subscribe({ next: setWorlds, error: () => {} })
}

/** Called with the open world's pages, so links to them can use names. */
export function setPages(worldId: string, pages: Entity[]) {
  const aliases = readAliases(pageAliasesKey(worldId))
  for (const [slug, id] of Object.entries(aliases)) if (!pageBySlug.has(`${worldId}/${slug}`)) pageBySlug.set(`${worldId}/${slug}`, id)
  let fresh = false
  assign(pages, (e) => e.name, (e, slug) => {
    if (pageSlug.get(e.id) !== slug) fresh = true
    pageSlug.set(e.id, slug)
    pageBySlug.set(`${worldId}/${slug}`, e.id)
    if (aliases[slug] !== e.id) aliases[slug] = e.id
  })
  if (fresh) {
    saveAliases(aliases, pageAliasesKey(worldId))
    changed()
  }
}

/** The world's id, from its name or its id in the address. */
export const resolveWorld = (param: string) => {
  const id = worldBySlug.get(param)
  // A current name wins over an old one that has since gone to another world.
  if (id && worldSlug.get(id) !== undefined) return id
  if (worldSlug.has(param)) return param
  return id ?? param
}
export const resolvePage = (worldId: string, param: string) => pageBySlug.get(`${worldId}/${param}`) ?? param
export const resolveCustom = (worldId: string, param: string) => customBySlug.get(`${worldId}/${param}`) ?? param

export const worldPath = (worldId: string) => `/w/${worldSlug.get(worldId) ?? worldId}`
export const pagePath = (worldId: string, entityId: string) => `${worldPath(worldId)}/p/${pageSlug.get(entityId) ?? entityId}`
export function typePath(worldId: string, type: string, customId?: string) {
  const section = TYPE_SLUGS[type as EntityType] ?? type
  if (type !== 'custom' || !customId) return `${worldPath(worldId)}/${section}`
  return `${worldPath(worldId)}/${section}/${customSlug.get(`${worldId}/${customId}`) ?? customId}`
}

/**
 * The tidy form of an address inside a world: names instead of codes, section words instead of
 * "type/…". Undefined when it's already tidy (or not a world address).
 */
export function tidyPath(pathname: string): string | undefined {
  const m = pathname.match(/^\/w\/([^/]+)(\/.*)?$/)
  if (!m) return
  const worldId = resolveWorld(m[1])
  // Anything not found stays as it was, so an address that matches nothing can't bounce around.
  const world = worldSlug.get(worldId) ?? m[1]
  let rest = m[2] ?? ''
  const page = rest.match(/^\/(?:e|p)\/([^/]+)(.*)$/)
  const type = rest.match(/^\/type\/([^/]+)(?:\/([^/]+))?\/?$/)
  const custom = (id: string) => customSlug.get(`${worldId}/${resolveCustom(worldId, id)}`) ?? id
  if (page) rest = `/p/${pageSlug.get(resolvePage(worldId, page[1])) ?? page[1]}${page[2]}`
  else if (type?.[1] === 'custom' && type[2]) rest = `/other/${custom(type[2])}`
  else if (type && sectionType(type[1])) rest = `/${TYPE_SLUGS[sectionType(type[1])!]}`
  else if (rest.startsWith('/other/')) rest = `/other/${custom(rest.slice(7).replace(/\/$/, ''))}`
  const tidy = `/w/${world}${rest}`
  return tidy !== pathname ? tidy : undefined
}

/** An href for a link outside the router's own links (raw HTML). */
export const hrefFor = (path: string) => (hashRouting ? `#${path}` : path)

/**
 * Old links have the address after a "#/" (wardedatlas.com/#/join/…). Moves that into the address
 * itself before the app starts, so the router sees it.
 */
export function upgradeHashLink() {
  if (hashRouting) return
  const { hash, search } = window.location
  if (!hash.startsWith('#/')) return
  const inner = hash.slice(1)
  const q = inner.indexOf('?')
  const path = q < 0 ? inner : inner.slice(0, q)
  const params = new URLSearchParams(q < 0 ? '' : inner.slice(q))
  for (const [k, v] of new URLSearchParams(search)) if (!params.has(k)) params.set(k, v)
  const query = params.toString()
  window.history.replaceState(null, '', path + (query ? `?${query}` : ''))
}

/** Goes to an address from outside the router (after signing in, say). */
export function goToPath(path: string) {
  if (hashRouting) {
    window.location.hash = path
    return
  }
  window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/** Where the router is right now, as "/w/…?…" (the part a link after sign-in should go back to). */
export const currentPath = () => (hashRouting ? window.location.hash.slice(1) || '/' : window.location.pathname + window.location.search)
