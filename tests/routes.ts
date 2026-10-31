/**
 * Every address the app answers, as written in src/App.tsx, with a sample of it in the Vael Ardith
 * example world and who can see it. tests/routes.spec.ts fails when App.tsx gains (or loses) a
 * route that isn't listed here, so every new screen gets opened by tests/screens.spec.ts, and its
 * player view is checked for GM secrets by tests/leaks.spec.ts.
 *
 * Placeholders in samples are filled in from the example world (tests/lib/world.ts):
 *   {world} the world's short name     {worldId} its long id
 *   {page:Name} a page's short name    {pageId:Name} its long id
 *   {map:Name} {session:N} {campaign} {board}   ids of those
 *   {custom} {customId}   a custom page type the tests add (the example has none)
 */

/**
 * Who can open it:
 *  - gm: a GM tool. In the player view it shows a "this is for the GM" note (or nothing useful).
 *  - both: GM and players (each sees their own version).
 *  - special: outside a world (front page, invite links), or a loader.
 */
export type Who = 'gm' | 'both' | 'special'

/**
 * What a sample should show:
 *  - ok: the screen itself
 *  - not-found: a "not found" / "not revealed" / "unknown" message, on purpose
 *  - skip: don't open it in this view
 */
export type Expect = 'ok' | 'not-found' | 'skip'

/**
 * What kind of address it is, for the menu check that comes with the new navigation (every
 * 'screen' must then have a place in src/nav.ts; old addresses and fallbacks need none).
 */
export type Kind = 'screen' | 'legacy' | 'fallback' | 'loader'

export interface Sample {
  url: string
  /** Short label for test names, when a route has several samples. */
  label?: string
  /** Overrides for this sample. */
  gm?: Expect
  player?: Expect
}

export interface RouteEntry {
  /** The full path pattern, exactly as App.tsx builds it (parent and child paths joined). */
  path: string
  /** Plain name of the screen. */
  screen: string
  who: Who
  kind: Kind
  samples: Sample[]
  note?: string
}

/** What a sample should show in each view, filling in the defaults. */
export function expectations(route: RouteEntry, sample: Sample): { gm: Expect; player: Expect } {
  const player: Expect = route.who === 'both' ? 'ok' : 'skip'
  return { gm: sample.gm ?? 'ok', player: sample.player ?? player }
}

const W = '/w/{world}'

export const ROUTES: RouteEntry[] = [
  { path: '/', screen: 'Worlds shelf (front page)', who: 'special', kind: 'screen', samples: [{ url: '/' }] },
  {
    path: '/shared/:token',
    screen: 'Public wiki link (loader)',
    who: 'special',
    kind: 'loader',
    samples: [{ url: '/shared/test-token' }],
    note: 'Downloads the world from the cloud; offline in tests, so it shows its "couldn’t open" message.',
  },
  { path: '/join/:token', screen: 'Join a world (invite link)', who: 'special', kind: 'loader', samples: [{ url: '/join/test-token' }, { url: '/join/test-token?as=gm', label: 'co-GM' }] },
  {
    path: '/w/:worldId/print/:kind/:id',
    screen: 'Print a page or session',
    who: 'both',
    kind: 'screen',
    // It sits outside the world's frame, so the player view doesn't reach it: the Print button adds
    // ?copy=players instead. Without it, it's the GM copy whoever opens it.
    samples: [
      { url: '/w/{worldId}/print/e/{pageId:Ford Street}', label: 'page', player: 'skip' },
      { url: '/w/{worldId}/print/e/{pageId:Ford Street}?copy=players', label: 'page, player copy' },
      { url: '/w/{worldId}/print/s/{session:1}', label: 'session', player: 'skip' },
      { url: '/w/{worldId}/print/s/{session:1}?copy=players', label: 'session, player copy', gm: 'not-found', player: 'not-found' },
    ],
    note: 'Uses long ids, not short names.',
  },
  { path: '/screen/:worldId', screen: "Players' screen (TV)", who: 'special', kind: 'screen', samples: [{ url: '/screen/{world}' }], note: 'Always the player view.' },
  {
    path: '/w/:worldId',
    screen: 'World home: GM dashboard / players’ Common Room',
    who: 'both',
    kind: 'screen',
    samples: [
      { url: W },
      { url: `${W}?tab=scene`, label: 'Common Room: old address of the scene', gm: 'skip' },
      { url: `${W}?tab=me`, label: 'Common Room: my character', gm: 'skip' },
      { url: `${W}?tab=party`, label: 'Common Room: the party', gm: 'skip' },
      { url: `${W}?tab=leads`, label: 'Common Room: leads', gm: 'skip' },
      { url: `${W}?tab=notes`, label: 'Common Room: notes', gm: 'skip' },
    ],
  },
  {
    path: '/w/:worldId/:section',
    screen: 'List of pages of one type',
    who: 'both',
    kind: 'screen',
    samples: [
      { url: `${W}/npcs` },
      { url: `${W}/locations`, label: 'locations' },
      { url: `${W}/events`, label: 'events' },
      { url: `${W}/loose-threads`, label: 'loose threads (list)' },
      { url: `${W}/tables`, label: 'random tables' },
      { url: `${W}/npc`, label: 'old type word' },
      { url: `${W}/no-such-section`, label: 'unknown word', gm: 'not-found', player: 'not-found' },
    ],
  },
  { path: '/w/:worldId/other/:kind', screen: 'List of a custom page type', who: 'both', kind: 'screen', samples: [{ url: `${W}/other/{custom}` }] },
  { path: '/w/:worldId/type/:type', screen: 'Old list address', who: 'both', kind: 'legacy', samples: [{ url: `${W}/type/npc` }] },
  { path: '/w/:worldId/type/:type/:kind', screen: 'Old custom list address', who: 'both', kind: 'legacy', samples: [{ url: `${W}/type/custom/{customId}` }] },
  { path: '/w/:worldId/loot', screen: 'Party loot', who: 'both', kind: 'screen', samples: [{ url: `${W}/loot` }] },
  {
    path: '/w/:worldId/p/:entityId',
    screen: 'A page',
    who: 'both',
    kind: 'screen',
    samples: [
      { url: `${W}/p/{page:Ford Street}`, label: 'location' },
      { url: `${W}/p/{page:Sabe Hallows}`, label: 'NPC' },
      { url: `${W}/p/{page:Varra Nine-Knuckles}`, label: 'player character' },
      { url: `${W}/p/{page:The Ninth Lantern}`, label: 'faction with clocks' },
      { url: `${W}/p/{page:Thunderjars}`, label: 'item' },
      { url: `${W}/p/{page:The Kingslaying}`, label: 'event' },
      { url: `${W}/p/{page:The Drowned Man}`, label: 'quest' },
      { url: `${W}/p/{page:The Inkwright's}`, label: 'shop' },
      { url: `${W}/p/{page:Tharos}`, label: 'deity' },
      { url: `${W}/p/{page:The Vesh}`, label: 'lore' },
      { url: `${W}/p/{page:Sayings, Oaths and Curses of the March}`, label: 'random table' },
      { url: `${W}/p/{page:Player's Guide}`, label: 'custom page' },
      { url: `${W}/p/{page:Why is Dannic's wanted poster dated after his death?}`, label: 'loose thread (GM only)', player: 'not-found' },
      { url: `${W}/p/{page:The Sleeper Below}`, label: 'GM-only page', player: 'not-found' },
      { url: `${W}/p/{page:Ford Street}?edit=1`, label: 'editor', player: 'skip' },
      { url: `${W}/p/no-such-page`, label: 'missing page', gm: 'not-found', player: 'not-found' },
    ],
  },
  { path: '/w/:worldId/e/:entityId', screen: 'Old page address', who: 'both', kind: 'legacy', samples: [{ url: `${W}/e/{pageId:Ford Street}` }] },
  { path: '/w/:worldId/maps', screen: 'Maps', who: 'both', kind: 'screen', samples: [{ url: `${W}/maps` }] },
  {
    path: '/w/:worldId/maps/:mapId',
    screen: 'A map',
    who: 'both',
    kind: 'screen',
    samples: [
      { url: `${W}/maps/{map:Cinderford}` },
      { url: `${W}/maps/{map:Vael Ardith}`, label: 'world map' },
      { url: `${W}/maps/{map:The Glass Barrow}`, label: 'GM-only map', player: 'not-found' },
    ],
  },
  { path: '/w/:worldId/maps/:mapId/draw', screen: 'Map maker', who: 'gm', kind: 'screen', samples: [{ url: `${W}/maps/{map:Cinderford}/draw` }] },
  { path: '/w/:worldId/timeline', screen: 'Timeline', who: 'both', kind: 'screen', samples: [{ url: `${W}/timeline` }] },
  { path: '/w/:worldId/chronicle', screen: 'Chronicle', who: 'gm', kind: 'screen', samples: [{ url: `${W}/chronicle` }] },
  { path: '/w/:worldId/threads', screen: 'Loose threads / Leads', who: 'both', kind: 'screen', samples: [{ url: `${W}/threads` }] },
  { path: '/w/:worldId/scratchpad', screen: "Players' scratchpad", who: 'both', kind: 'screen', samples: [{ url: `${W}/scratchpad` }], note: 'Needs cloud sync; offline it explains that.' },
  { path: '/w/:worldId/c/:campaignId', screen: 'Campaign', who: 'both', kind: 'screen', samples: [{ url: `${W}/c/{campaign}` }] },
  {
    path: '/w/:worldId/s/:sessionId',
    screen: 'Session',
    who: 'both',
    kind: 'screen',
    // The example's sessions are all still GM-only, so players get "not found".
    samples: [
      { url: `${W}/s/{session:1}`, player: 'not-found' },
      { url: `${W}/s/{session:1}?tab=prep`, label: 'prep tab', player: 'skip' },
      { url: `${W}/s/{session:1}?tab=notes`, label: 'GM notes tab', player: 'skip' },
      { url: `${W}/s/{session:1}?tab=recap`, label: 'recap tab', player: 'skip' },
      { url: `${W}/s/{session:1}?end=1`, label: 'end of session checklist', player: 'skip' },
    ],
  },
  { path: '/w/:worldId/s/:sessionId/lectern', screen: 'The Lectern (run a session)', who: 'gm', kind: 'screen', samples: [{ url: `${W}/s/{session:1}/lectern` }] },
  { path: '/w/:worldId/assets', screen: 'Files', who: 'gm', kind: 'screen', samples: [{ url: `${W}/assets` }], note: 'No GM check on the page itself (route map, orphans).' },
  { path: '/w/:worldId/generators', screen: 'Generators', who: 'gm', kind: 'screen', samples: [{ url: `${W}/generators` }], note: 'No GM check on the page itself (route map, orphans).' },
  {
    path: '/w/:worldId/archivist',
    screen: 'The Archivist',
    who: 'gm',
    kind: 'screen',
    samples: [{ url: `${W}/archivist` }, { url: `${W}/archivist?tab=check`, label: 'check for contradictions' }],
  },
  {
    path: '/w/:worldId/settings',
    screen: 'World settings',
    who: 'gm',
    kind: 'screen',
    samples: [
      { url: `${W}/settings` },
      { url: `${W}/settings?tab=players`, label: 'players and sharing' },
      { url: `${W}/settings?tab=device`, label: 'this device' },
      { url: `${W}/settings?tab=data`, label: 'data and backup' },
    ],
  },
  { path: '/w/:worldId/boards', screen: 'Corkboards', who: 'gm', kind: 'screen', samples: [{ url: `${W}/boards` }] },
  { path: '/w/:worldId/boards/:boardId', screen: 'A corkboard', who: 'gm', kind: 'screen', samples: [{ url: `${W}/boards/{board}` }] },
  { path: '/w/:worldId/sounds', screen: 'Soundboard', who: 'gm', kind: 'screen', samples: [{ url: `${W}/sounds` }] },
  { path: '/w/:worldId/questions', screen: 'Questions and downtime', who: 'both', kind: 'screen', samples: [{ url: `${W}/questions` }], note: 'Needs cloud sync; offline it explains that.' },
  { path: '/w/:worldId/web', screen: 'Relationships web', who: 'both', kind: 'screen', samples: [{ url: `${W}/web` }, { url: `${W}/web?view=family`, label: 'family tree' }] },
  { path: '/w/:worldId/clocks', screen: 'Clocks', who: 'both', kind: 'screen', samples: [{ url: `${W}/clocks` }] },
  { path: '/w/:worldId/safety', screen: 'Safety tools', who: 'both', kind: 'screen', samples: [{ url: `${W}/safety` }] },
  { path: '/w/:worldId/handouts', screen: 'Handouts', who: 'both', kind: 'screen', samples: [{ url: `${W}/handouts` }] },
  { path: '/w/:worldId/more', screen: 'More (things used now and then)', who: 'both', kind: 'screen', samples: [{ url: `${W}/more` }] },
  { path: '/w/:worldId/everything', screen: 'Everything (every kind of page)', who: 'both', kind: 'screen', samples: [{ url: `${W}/everything` }] },
  {
    path: '/w/:worldId/session',
    screen: 'Session (the session in hand)',
    who: 'gm',
    kind: 'screen',
    samples: [{ url: `${W}/session` }],
    note: 'Opens the session being played or the next one; with none, a page to plan the next.',
  },
  { path: '/w/:worldId/*', screen: 'Nothing here (inside a world)', who: 'both', kind: 'fallback', samples: [{ url: `${W}/no/such/place`, gm: 'not-found', player: 'not-found' }] },
  { path: '*', screen: 'Unknown address (shows the shelf)', who: 'special', kind: 'fallback', samples: [{ url: '/no/such/place' }] },
]
