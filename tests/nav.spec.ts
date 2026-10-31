import { expect, test } from '@playwright/test'
import { appRoutes } from './lib/app-routes'
import { ROUTES } from './routes'
import { AREAS, CONTEXTUAL, locate, MORE_GROUPS, navPatterns, navPlaces, PLAYER_MORE_GROUPS, type LocateHelp, type Viewer } from '../src/nav'

/**
 * The menus in src/nav.ts, checked without a browser: every address in App.tsx has a home in them
 * (an area's tab, a More item, or a "contextual" entry that says where it's reached from instead),
 * each address lights the right area and tab, and nothing in a player's menus leads to a GM tool.
 */

/** Whether a menu address (like /w/:worldId/npcs) is an instance of a route pattern (like /w/:worldId/:section). */
function fits(menu: string, route: string) {
  const a = menu.split('/')
  const b = route.split('/')
  if (b.at(-1) === '*') return a.length >= b.length - 1 && b.slice(0, -1).every((s, i) => s.startsWith(':') || s === a[i])
  return a.length === b.length && b.every((s, i) => (s.startsWith(':') ? !!a[i] : s === a[i]))
}

test('no orphans: every route in App.tsx is an area tab, a More item or a contextual address in src/nav.ts', () => {
  const menus = navPatterns()
  const contextual = CONTEXTUAL.map((c) => c.path)
  const routes = appRoutes()
  expect(routes.length, 'found no routes in src/App.tsx: has the file moved?').toBeGreaterThan(10)
  const orphans = routes.filter((r) => !contextual.includes(r) && !menus.some((m) => fits(m, r)))
  expect(orphans, 'Routes with no home in src/nav.ts: add each to an area, the More page, or CONTEXTUAL').toEqual([])
  // Each screen should be in a menu, not only contextual, unless it's a page (/p/) or a list of one type.
  const screens = ROUTES.filter((r) => r.kind === 'screen').map((r) => r.path)
  expect(screens.length).toBeGreaterThan(20)
  const unlisted = screens.filter((r) => !menus.some((m) => fits(m, r)) && !contextual.includes(r))
  expect(unlisted).toEqual([])
  // And a contextual address must still be a real route.
  expect(contextual.filter((c) => !routes.includes(c)), 'CONTEXTUAL lists an address App.tsx no longer has').toEqual([])
})

const W = '/w/vael-ardith'
const types: Record<string, string> = { ford: 'location', gerda: 'npc', varra: 'pc', lantern: 'faction', vesh: 'lore', tharos: 'deity', wagon: 'thread', drowned: 'quest', sayings: 'table', jars: 'item', guide: 'custom' }
const help = (viewer: Viewer, played = false): LocateHelp => ({
  viewer,
  pageType: (p) => types[p] as never,
  sessionTab: () => (played ? 'notes' : 'prep'),
})
const where = (url: string, h: LocateHelp) => {
  const [path, query = ''] = url.split('?')
  const spot = locate(path, query ? `?${query}` : '', h)
  return spot ? `${spot.area.id}${spot.tab ? `/${spot.tab.id}` : ''}` : undefined
}

test('each address lights the right area and tab, GM view', () => {
  const gm = help('gm')
  const cases: [string, string][] = [
    [W, 'desk/today'],
    [`${W}/questions`, 'desk/inbox'],
    [`${W}/session`, 'session'],
    [`${W}/s/1`, 'session/prepare'],
    [`${W}/s/1?tab=prep`, 'session/prepare'],
    [`${W}/s/1/lectern`, 'session/play'],
    [`${W}/s/1?tab=notes`, 'session/wrap'],
    [`${W}/s/1?tab=recap`, 'session/wrap'],
    [`${W}/s/1?end=1`, 'session/wrap'],
    [`${W}/c/1`, 'session/sessions'],
    [`${W}/loot`, 'session/loot'],
    [`${W}/maps`, 'atlas/maps'],
    [`${W}/maps/m`, 'atlas/maps'],
    [`${W}/maps/m/draw`, 'atlas/maps'],
    [`${W}/locations`, 'atlas/places'],
    [`${W}/p/ford`, 'atlas/places'],
    [`${W}/p/ford?edit=1`, 'atlas/places'],
    [`${W}/npcs`, 'atlas/people'],
    [`${W}/npc`, 'atlas/people'],
    [`${W}/type/npc`, 'atlas/people'],
    [`${W}/characters`, 'atlas/people'],
    [`${W}/p/varra`, 'atlas/people'],
    [`${W}/p/lantern`, 'atlas/factions'],
    [`${W}/p/tharos`, 'atlas/lore'],
    [`${W}/items`, 'atlas/everything'],
    [`${W}/p/guide`, 'atlas/everything'],
    [`${W}/other/ward-notes`, 'atlas/everything'],
    [`${W}/everything`, 'atlas/everything'],
    [`${W}/threads`, 'story/threads'],
    [`${W}/loose-threads`, 'story/threads'],
    [`${W}/p/wagon`, 'story/threads'],
    [`${W}/quests`, 'story/quests'],
    [`${W}/p/drowned`, 'story/quests'],
    [`${W}/clocks`, 'story/clocks'],
    [`${W}/timeline`, 'story/timeline'],
    [`${W}/chronicle`, 'story/chronicle'],
    [`${W}/web`, 'story/web'],
    [`${W}/more`, 'more/more'],
    [`${W}/handouts`, 'more/handouts'],
    [`${W}/sounds`, 'more/sounds'],
    [`${W}/safety`, 'more/safety'],
    [`${W}/scratchpad`, 'more/scratchpad'],
    [`${W}/generators`, 'more/generators'],
    [`${W}/tables`, 'more/tables'],
    [`${W}/p/sayings`, 'more/tables'],
    [`${W}/boards`, 'more/boards'],
    [`${W}/boards/b`, 'more/boards'],
    [`${W}/assets`, 'more/assets'],
    [`${W}/archivist?tab=check`, 'more/archivist'],
    [`${W}/settings`, 'more/settings'],
    [`${W}/settings?tab=players`, 'more/players'],
    [`${W}/settings?tab=data`, 'more/backups'],
  ]
  for (const [url, want] of cases) expect(where(url, gm), url).toBe(want)
  // A session that has been played opens on its notes, so plain /s/<id> is Wrap up.
  expect(where(`${W}/s/1`, help('gm', true))).toBe('session/wrap')
})

test('each address lights the right area and tab, player view and wiki', () => {
  const player = help('player')
  const cases: [string, string | undefined][] = [
    [W, 'room/now'],
    [`${W}?tab=scene`, 'room/now'],
    [`${W}?tab=me`, 'room/me'],
    [`${W}?tab=party`, 'room/party'],
    [`${W}/loot`, 'room/party'],
    [`${W}?tab=leads`, 'room/leads'],
    [`${W}/threads`, 'room/leads'],
    [`${W}/clocks`, 'room/leads'],
    [`${W}/p/drowned`, 'room/leads'],
    [`${W}?tab=notes`, 'room/notes'],
    [`${W}/questions`, 'room/notes'],
    [`${W}/scratchpad`, 'room/notes'],
    [`${W}/safety`, 'rules/rules'],
    [`${W}/maps/m`, 'world/maps'],
    [`${W}/p/ford`, 'world/places'],
    [`${W}/p/lantern`, 'world/people'],
    [`${W}/timeline`, 'world/timeline'],
    [`${W}/s/1`, 'world/timeline'],
    [`${W}/c/1`, 'world/timeline'],
    [`${W}/everything`, 'world/everything'],
    [`${W}/more`, 'world/more'],
    [`${W}/handouts`, 'world/more'],
    [`${W}/web`, 'world/more'],
    // GM tools have no place in a player's menus.
    [`${W}/generators`, undefined],
    [`${W}/settings`, undefined],
    [`${W}/s/1/lectern`, undefined],
  ]
  for (const [url, want] of cases) expect(where(url, player), url).toBe(want)
  const wiki = help('wiki')
  expect(where(W, wiki)).toBe('world/front')
  expect(where(`${W}/maps`, wiki)).toBe('world/maps')
  expect(where(`${W}/threads`, wiki)).toBe('world')
})

test('nothing in a player’s menus or search leads to a GM tool', () => {
  const gmOnly = ROUTES.filter((r) => r.who === 'gm').map((r) => r.path)
  for (const viewer of ['player', 'wiki'] as Viewer[]) {
    const tabs = [...AREAS.filter((a) => a.who.includes(viewer)).flatMap((a) => a.tabs), ...PLAYER_MORE_GROUPS.flatMap((g) => g.items)].filter((t) => t.who.includes(viewer))
    for (const t of tabs) {
      const to = t.to({ worldId: 'w', viewer, sessionId: 's', campaignId: 'c' })
      if (!to) continue
      const path = to.split('?')[0]
      expect(gmOnly.filter((r) => fits(path, r)), `${viewer}: ${t.label} goes to ${to}`).toEqual([])
    }
    const places = navPlaces({ worldId: 'w', viewer, sessionId: 's', campaignId: 'c' }).map((p) => p.title)
    // The GM's More items, apart from the ones players have too (handouts).
    const gmItems = MORE_GROUPS.flatMap((g) => g.items).filter((t) => !PLAYER_MORE_GROUPS.some((g) => g.items.some((x) => x.id === t.id)))
    for (const t of gmItems) expect(places, `${viewer} search offers ${t.label}`).not.toContain(t.label)
    for (const title of ['The Lectern', 'Chronicle', 'Inbox', 'Prepare the session']) expect(places).not.toContain(title)
  }
  // Wiki readers have no table: no Table rules, Common Room or notes.
  const wiki = navPlaces({ worldId: 'w', viewer: 'wiki' }).map((p) => p.title)
  for (const title of ['Table rules', 'Now', 'Notes', 'Scratchpad']) expect(wiki).not.toContain(title)
})

test('search finds every area, tab and More item by name, and the old place names', () => {
  const gm = navPlaces({ worldId: 'w', viewer: 'gm', sessionId: 's', campaignId: 'c', sessionHome: '/w/w/s/s?tab=prep' })
  const titles = gm.map((p) => p.title)
  for (const a of AREAS.filter((a) => a.who.includes('gm'))) expect(titles).toContain(a.label)
  for (const t of MORE_GROUPS.flatMap((g) => g.items)) if (t.to({ worldId: 'w', viewer: 'gm' })) expect(titles).toContain(t.label)
  for (const title of ['The Lectern', 'Chronicle', 'Inbox', 'Players’ scratchpad', 'All sessions', 'Templates', 'Recently deleted']) expect(titles).toContain(title)
  // The names search used before the areas still find somewhere.
  for (const old of ['home', 'loose threads', 'generators and random tables', 'questions', 'campaigns'])
    expect(gm.some((p) => p.title.toLowerCase().includes(old) || p.words.includes(old)), old).toBe(true)
})
