import {
  Armchair,
  Backpack,
  BookBookmark,
  BookOpenText,
  Books,
  CastleTurret,
  Compass,
  Desk,
  DiceFive,
  DotsThreeOutline,
  DownloadSimple,
  Feather,
  FileArrowUp,
  FlagBanner,
  FlagCheckered,
  Folder,
  GlobeHemisphereWest,
  Graph,
  HandPalm,
  Hourglass,
  ListChecks,
  MapTrifold,
  MusicNotes,
  Newspaper,
  Notepad,
  Play,
  Printer,
  PushPin,
  Ruler,
  SlidersHorizontal,
  Spiral,
  SquaresFour,
  Stack,
  Sun,
  Table,
  Television,
  Timer,
  Trash,
  Tray,
  User,
  UserCircle,
  UsersThree,
  type Icon,
} from '@phosphor-icons/react'
import type { EntityType } from './db'
import { sectionType, worldPath } from './paths'

/**
 * The world's menus, in one place. Every way around a world is listed here: the areas (the
 * sidebar on a computer, the bar along the bottom on a phone), each area's tabs (the bar across
 * the top), the More page, and the addresses that are on purpose in no menu at all. The sidebar,
 * the tabs, the phone's bottom bar, the More page and the search's "Go to" places are all made
 * from this file, and a test (tests/nav.spec.ts) fails if any screen in App.tsx has no home here.
 *
 * Addresses are written as they come after /w/<world>/: '' is the world's front page, ':x' stands
 * for any one part (a map, a session…), and '?tab=me' means that part of the address must match too.
 */

/** Who is looking: the GM in their own world, a player (joined, or the GM previewing as one), or a reader of a public wiki link. */
export type Viewer = 'gm' | 'player' | 'wiki'

/** What the menus need to know about the world right now, to fill in addresses and leave out what doesn't apply. */
export interface NavFacts {
  worldId: string
  viewer: Viewer
  /** A player who joined with an invite (not the GM previewing). */
  invited?: boolean
  /** Cloud sync on for the GM's own world. */
  cloud?: boolean
  /** The session the Session tabs work on: the one open now, or else the one in hand. */
  sessionId?: string
  /** Its campaign (or the first one, before any session). */
  campaignId?: string
  /** Where pressing Session goes: the session being played, the next one, or "plan the first one". */
  sessionHome?: string
  /** Handouts the viewer can see. */
  handouts?: number
  /** Anything carried by the party, or any coin. */
  loot?: boolean
  /** Clocks still ticking that the viewer can see. */
  clocks?: number
  /** Links between pages the viewer can see (the relationship web). */
  links?: boolean
  /** Lines, veils, notes or the X-card set up for the table. */
  safety?: boolean
  /** Questions, downtime and character claims waiting on the GM. */
  inbox?: number
  /** Whether players' questions can arrive at all (cloud sync on and signed in). */
  questions?: boolean
  /** Open loose threads (GM) or leads and quests (players). */
  threads?: number
  leads?: number
  /** Campaigns the viewer can see. */
  campaigns?: { id: string; name: string }[]
}

export interface NavTab {
  id: string
  label: string
  /** The name in search, where the label alone is vague ("Play" is the Lectern). */
  searchTitle?: string
  icon: Icon
  /** Where it goes. Nothing means it's left out of the menus for now. */
  to: (f: NavFacts) => string | undefined
  /** Addresses that light it (see the top of the file). */
  paths?: string[]
  /** Lists and pages of these types light it too. */
  types?: EntityType[]
  /** Who it's for. GM-only things never get 'player' or 'wiki'. */
  who: Viewer[]
  /** Shown only when this holds (there are handouts, cloud sync is on…). Search ignores it. */
  when?: (f: NavFacts) => boolean
  /** A count beside it; `alert` when it's something waiting on you. */
  count?: (f: NavFacts) => number | undefined
  alert?: boolean
  /** Other words search finds it by, including names it had before the areas (Home, Loose threads…). */
  keywords?: string
  /** One line about it, for the More page. */
  blurb?: string
  /** Opens in a new tab (the players' screen for a TV). */
  external?: boolean
}

export type AreaId = 'desk' | 'session' | 'atlas' | 'story' | 'more' | 'room' | 'world' | 'rules'

export interface NavArea {
  id: AreaId
  label: string
  /** The label in the phone's bottom bar, if shorter. */
  short?: string
  icon: Icon
  who: Viewer[]
  tabs: NavTab[]
  /** Addresses that belong to the area without lighting any one tab. */
  paths?: string[]
  /** Where it goes when it has no tabs of its own to pick from. */
  to?: (f: NavFacts) => string | undefined
  count?: (f: NavFacts) => number | undefined
  keywords?: string
}

const w = (f: NavFacts, rest = '') => `${worldPath(f.worldId)}${rest ? `/${rest}` : ''}`
const own: Viewer[] = ['gm']
const readers: Viewer[] = ['player', 'wiki']
const players: Viewer[] = ['player']

/** The World, as players and wiki readers read it. Shared by both, so it's written once. */
const worldTabs: NavTab[] = [
  { id: 'front', label: 'Front page', icon: Books, to: (f) => w(f), paths: [''], who: ['wiki'], keywords: 'home overview front page' },
  { id: 'maps', label: 'Maps', icon: MapTrifold, to: (f) => w(f, 'maps'), paths: ['maps', 'maps/:mapId'], who: readers, keywords: 'map atlas' },
  { id: 'places', label: 'Places', icon: CastleTurret, to: (f) => w(f, 'locations'), types: ['location', 'shop'], who: readers, keywords: 'locations shops towns' },
  { id: 'people', label: 'People', icon: User, to: (f) => w(f, 'npcs'), types: ['npc', 'pc', 'faction'], who: readers, keywords: 'npcs characters factions' },
  { id: 'lore', label: 'Lore', icon: Books, to: (f) => w(f, 'lore'), types: ['lore', 'deity'], who: readers, keywords: 'history gods deities' },
  {
    id: 'timeline',
    label: 'Timeline',
    icon: Hourglass,
    to: (f) => w(f, 'timeline'),
    paths: ['timeline', 'c/:campaignId', 's/:sessionId'],
    who: readers,
    keywords: 'history events sessions recaps campaigns',
  },
  { id: 'everything', label: 'Everything', icon: SquaresFour, to: (f) => w(f, 'everything'), paths: ['everything', 'other/:kind'], types: ['item', 'event', 'custom', 'table'], who: readers, keywords: 'all types codex items events' },
  { id: 'more', label: 'More', icon: DotsThreeOutline, to: (f) => w(f, 'more'), paths: ['more', 'handouts', 'web'], who: readers, keywords: 'handouts relationships campaigns' },
]

export const AREAS: NavArea[] = [
  // ——— The GM ———
  {
    id: 'desk',
    label: 'Desk',
    icon: Desk,
    who: own,
    count: (f) => f.inbox || undefined,
    keywords: 'home overview front page dashboard',
    tabs: [
      { id: 'today', label: 'Today', icon: Sun, to: (f) => w(f), paths: [''], who: own, keywords: 'home overview front page dashboard needs you' },
      {
        id: 'inbox',
        label: 'Inbox',
        icon: Tray,
        to: (f) => w(f, 'questions'),
        paths: ['questions'],
        who: own,
        count: (f) => f.inbox || undefined,
        alert: true,
        keywords: 'questions downtime players claims answers',
      },
    ],
  },
  {
    id: 'session',
    label: 'Session',
    icon: BookOpenText,
    who: own,
    paths: ['session'],
    to: (f) => f.sessionHome,
    keywords: 'next session run prep',
    tabs: [
      {
        id: 'prepare',
        label: 'Prepare',
        searchTitle: 'Prepare the session',
        icon: ListChecks,
        to: (f) => (f.sessionId ? w(f, `s/${f.sessionId}?tab=prep`) : undefined),
        paths: ['s/:sessionId?tab=prep'],
        who: own,
        keywords: 'prep scenes clues encounters next session',
      },
      {
        id: 'play',
        label: 'Play',
        searchTitle: 'The Lectern',
        icon: Play,
        to: (f) => (f.sessionId ? w(f, `s/${f.sessionId}/lectern`) : undefined),
        paths: ['s/:sessionId/lectern'],
        who: own,
        keywords: 'lectern play run the session table next session',
      },
      {
        id: 'wrap',
        label: 'Wrap up',
        searchTitle: 'Wrap up the session',
        icon: FlagCheckered,
        to: (f) => (f.sessionId ? w(f, `s/${f.sessionId}?tab=notes`) : undefined),
        paths: ['s/:sessionId?tab=notes', 's/:sessionId?tab=recap', 's/:sessionId?end=1'],
        who: own,
        keywords: 'gm notes recap end of session recording transcript',
      },
      {
        id: 'sessions',
        label: 'All sessions',
        icon: Stack,
        to: (f) => (f.campaignId ? w(f, `c/${f.campaignId}`) : undefined),
        paths: ['c/:campaignId'],
        who: own,
        keywords: 'campaigns campaign sessions schedule party',
      },
      { id: 'loot', label: 'Party loot', icon: Backpack, to: (f) => w(f, 'loot'), paths: ['loot'], who: own, keywords: 'treasure coin inventory items' },
    ],
  },
  {
    id: 'atlas',
    label: 'Atlas',
    icon: MapTrifold,
    who: own,
    keywords: 'world codex',
    tabs: [
      { id: 'maps', label: 'Maps', icon: MapTrifold, to: (f) => w(f, 'maps'), paths: ['maps', 'maps/:mapId', 'maps/:mapId/draw'], who: own, keywords: 'map atlas draw' },
      { id: 'places', label: 'Places', icon: CastleTurret, to: (f) => w(f, 'locations'), types: ['location', 'shop'], who: own, keywords: 'locations shops towns' },
      { id: 'people', label: 'People', icon: User, to: (f) => w(f, 'npcs'), types: ['npc', 'pc'], who: own, keywords: 'npcs player characters' },
      { id: 'factions', label: 'Factions', icon: FlagBanner, to: (f) => w(f, 'factions'), types: ['faction'], who: own, keywords: 'guilds groups' },
      { id: 'lore', label: 'Lore', icon: Books, to: (f) => w(f, 'lore'), types: ['lore', 'deity'], who: own, keywords: 'history gods deities' },
      {
        id: 'everything',
        label: 'Everything',
        icon: SquaresFour,
        to: (f) => w(f, 'everything'),
        paths: ['everything', 'other/:kind'],
        types: ['item', 'event', 'custom'],
        who: own,
        keywords: 'all types codex items events other pages',
      },
    ],
  },
  {
    id: 'story',
    label: 'Story',
    icon: Feather,
    who: own,
    tabs: [
      {
        id: 'threads',
        label: 'Threads',
        icon: Spiral,
        to: (f) => w(f, 'threads'),
        paths: ['threads'],
        types: ['thread'],
        who: own,
        count: (f) => f.threads || undefined,
        keywords: 'loose threads leads hooks',
      },
      { id: 'quests', label: 'Quests', icon: Compass, to: (f) => w(f, 'quests'), types: ['quest'], who: own, keywords: 'objectives rewards' },
      { id: 'clocks', label: 'Clocks', icon: Timer, to: (f) => w(f, 'clocks'), paths: ['clocks'], who: own, count: (f) => f.clocks || undefined, keywords: 'countdown progress' },
      { id: 'timeline', label: 'Timeline', icon: Hourglass, to: (f) => w(f, 'timeline'), paths: ['timeline'], who: own, keywords: 'history events calendar' },
      { id: 'chronicle', label: 'Chronicle', icon: BookBookmark, to: (f) => w(f, 'chronicle'), paths: ['chronicle'], who: own, keywords: 'what happened sessions history' },
      { id: 'web', label: 'Relationships', icon: Graph, to: (f) => w(f, 'web'), paths: ['web'], who: own, keywords: 'web family tree who knows' },
    ],
  },
  {
    id: 'more',
    label: 'More',
    icon: DotsThreeOutline,
    who: own,
    // The More page itself; each item on it lights its own name in the top bar (see moreTabs).
    tabs: [{ id: 'more', label: 'More', icon: DotsThreeOutline, to: (f) => w(f, 'more'), paths: ['more'], who: own, keywords: 'tools settings workshop' }],
  },

  // ——— Players (and the GM previewing as one) ———
  {
    id: 'room',
    label: 'Common Room',
    icon: Armchair,
    who: players,
    keywords: 'home overview front page',
    tabs: [
      { id: 'now', label: 'Now', icon: Armchair, to: (f) => w(f), paths: ['?tab=overview', '?tab=scene'], who: players, keywords: 'home common room overview next session the scene' },
      { id: 'me', label: 'Me', searchTitle: 'My character', icon: UserCircle, to: (f) => `${w(f)}?tab=me`, paths: ['?tab=me'], who: players, keywords: 'my character sheet' },
      { id: 'party', label: 'Party', icon: UsersThree, to: (f) => `${w(f)}?tab=party`, paths: ['?tab=party', 'loot'], who: players, keywords: 'the party loot' },
      {
        id: 'leads',
        label: 'Leads',
        icon: Spiral,
        to: (f) => `${w(f)}?tab=leads`,
        paths: ['?tab=leads', 'threads', 'clocks'],
        types: ['thread', 'quest'],
        who: players,
        count: (f) => f.leads || undefined,
        keywords: 'loose threads leads quests rumours clocks',
      },
      { id: 'notes', label: 'Notes', icon: Notepad, to: (f) => `${w(f)}?tab=notes`, paths: ['?tab=notes', 'questions', 'scratchpad'], who: players, keywords: 'scratchpad questions for the gm group notes' },
    ],
  },
  { id: 'world', label: 'The World', short: 'World', icon: GlobeHemisphereWest, who: readers, tabs: worldTabs, keywords: 'atlas codex' },
  {
    id: 'rules',
    label: 'Table rules',
    icon: HandPalm,
    who: players,
    tabs: [
      {
        id: 'rules',
        label: 'Table rules',
        icon: HandPalm,
        to: (f) => w(f, 'safety'),
        paths: ['safety'],
        who: players,
        when: (f) => !!f.safety,
        keywords: 'safety tools lines veils x-card',
      },
    ],
  },
]

export interface MoreGroup {
  id: string
  label: string
  blurb: string
  items: NavTab[]
}

/** The GM's More page: everything used now and then, by theme. Each item lights its own name when open. */
export const MORE_GROUPS: MoreGroup[] = [
  {
    id: 'table',
    label: 'At the table',
    blurb: 'Things you reach for while you play.',
    items: [
      { id: 'handouts', label: 'Handouts', icon: Newspaper, to: (f) => w(f, 'handouts'), paths: ['handouts'], who: own, blurb: 'Pictures, pages and notes you’ve shown the players.', keywords: 'shown' },
      { id: 'sounds', label: 'Soundboard', icon: MusicNotes, to: (f) => w(f, 'sounds'), paths: ['sounds'], who: own, blurb: 'Music and ambience for the table.', keywords: 'music ambience' },
      { id: 'safety', label: 'Safety tools', icon: HandPalm, to: (f) => w(f, 'safety'), paths: ['safety'], who: own, blurb: 'Lines, veils and the X-card.', keywords: 'lines veils x-card table rules' },
      {
        id: 'screen',
        label: 'Players’ screen for a TV',
        icon: Television,
        to: (f) => `/screen/${worldPath(f.worldId).slice(3)}`,
        who: own,
        external: true,
        blurb: 'Opens in a new tab: put it on a second screen and show the players pictures and pages.',
        keywords: 'tv second screen show players',
      },
      {
        id: 'scratchpad',
        label: 'Players’ scratchpad',
        icon: Notepad,
        to: (f) => w(f, 'scratchpad'),
        paths: ['scratchpad'],
        who: own,
        when: (f) => !!f.cloud,
        blurb: 'The notes your players keep together.',
        keywords: 'scratchpad group notes',
      },
    ],
  },
  {
    id: 'workshop',
    label: 'Workshop',
    blurb: 'Making things between sessions.',
    items: [
      { id: 'generators', label: 'Generators', icon: DiceFive, to: (f) => w(f, 'generators'), paths: ['generators'], who: own, blurb: 'Names, taverns, shops, people and treasure on the spot.', keywords: 'generators and random tables roll names tavern npc shop treasure' },
      { id: 'tables', label: 'Random tables', icon: Table, to: (f) => w(f, 'tables'), types: ['table'], who: own, blurb: 'Your own tables to roll on.', keywords: 'roll d20 d100' },
      { id: 'boards', label: 'Corkboards', icon: PushPin, to: (f) => w(f, 'boards'), paths: ['boards', 'boards/:boardId'], who: own, blurb: 'Pin pages up and tie them together with string.', keywords: 'board pins strings' },
      { id: 'assets', label: 'Files', icon: Folder, to: (f) => w(f, 'assets'), paths: ['assets'], who: own, blurb: 'Pictures, maps and sounds you’ve uploaded.', keywords: 'assets images uploads pictures' },
      { id: 'archivist', label: 'The Archivist', icon: Books, to: (f) => w(f, 'archivist'), paths: ['archivist'], who: own, blurb: 'Ask your world a question, or check it for contradictions.', keywords: 'ai claude ask question answer contradictions continuity check' },
      { id: 'templates', label: 'Templates', icon: Ruler, to: (f) => w(f, 'settings'), who: own, blurb: 'Starting points for new pages (in World settings).', keywords: 'template starting point' },
    ],
  },
  {
    id: 'keeping',
    label: 'Keeping the world',
    blurb: 'Settings, backups and the bin.',
    items: [
      { id: 'settings', label: 'World settings', icon: SlidersHorizontal, to: (f) => w(f, 'settings'), paths: ['settings'], who: own, blurb: 'The world, players and sharing, this device, data.', keywords: 'options sync calendar theme look' },
      {
        id: 'players',
        label: 'Players and sharing',
        icon: UsersThree,
        to: (f) => w(f, 'settings?tab=players'),
        paths: ['settings?tab=players'],
        who: own,
        blurb: 'Cloud sync, invites, the wiki link and who plays whom.',
        keywords: 'invite players sync share wiki link co-gm claims',
      },
      { id: 'backups', label: 'Backups', icon: DownloadSimple, to: (f) => w(f, 'settings?tab=data'), paths: ['settings?tab=data'], who: own, blurb: 'Download the whole world as one file.', keywords: 'backup download export' },
      { id: 'import', label: 'Import pages and character sheets', icon: FileArrowUp, to: (f) => w(f, 'settings?tab=data'), who: own, blurb: 'Bring in pages, or a character from D&D Beyond, Foundry and others.', keywords: 'import character sheet dndbeyond foundry pathbuilder' },
      { id: 'deleted', label: 'Recently deleted', icon: Trash, to: (f) => w(f, 'settings?tab=data'), who: own, blurb: 'Bring back what you deleted in the last month.', keywords: 'bin trash restore undelete' },
      { id: 'print', label: 'Print', icon: Printer, to: () => undefined, who: own, blurb: 'Every page and session has a Print button, for a GM copy or a player copy.', keywords: 'pdf paper' },
    ],
  },
]

/** The players' More page (a tab of The World): what isn't on a tab of its own. */
export const PLAYER_MORE_GROUPS: MoreGroup[] = [
  {
    id: 'table',
    label: 'At the table',
    blurb: 'For game night.',
    items: [
      { id: 'rules', label: 'Table rules', icon: HandPalm, to: (f) => w(f, 'safety'), who: players, when: (f) => !!f.safety, blurb: 'Lines, veils and the X-card your table agreed on.' },
      { id: 'handouts', label: 'Handouts', icon: Newspaper, to: (f) => w(f, 'handouts'), who: readers, when: (f) => !!f.handouts, blurb: 'What your GM has shown you.', keywords: 'shown' },
      { id: 'loot', label: 'Party loot', icon: Backpack, to: (f) => w(f, 'loot'), who: players, when: (f) => !!f.loot, blurb: 'Who carries what, and the party’s coin.', keywords: 'treasure coin inventory items' },
      { id: 'clocks', label: 'Clocks', icon: Timer, to: (f) => w(f, 'clocks'), who: players, when: (f) => !!f.clocks, blurb: 'Things that are ticking.', keywords: 'countdown progress' },
      { id: 'scratchpad', label: 'Scratchpad', icon: Notepad, to: (f) => w(f, 'scratchpad'), who: players, when: (f) => !!f.invited, blurb: 'Notes the party keeps together.' },
      { id: 'questions', label: 'Questions for the GM', icon: Tray, to: (f) => w(f, 'questions'), who: players, when: (f) => !!f.invited, blurb: 'Ask your GM something between sessions.' },
    ],
  },
  {
    id: 'world',
    label: 'The world',
    blurb: 'What the party knows.',
    items: [
      { id: 'everything', label: 'Everything', icon: SquaresFour, to: (f) => w(f, 'everything'), who: readers, blurb: 'Every kind of page, with how many there are.' },
      { id: 'web', label: 'Relationships', icon: Graph, to: (f) => w(f, 'web'), who: readers, when: (f) => !!f.links, blurb: 'Who knows whom.', keywords: 'web family tree who knows' },
      { id: 'timeline', label: 'Timeline', icon: Hourglass, to: (f) => w(f, 'timeline'), who: readers, blurb: 'Dates, history and past sessions.' },
    ],
  },
]

/**
 * Addresses that are in no menu on purpose, and where they're reached from instead. With the
 * areas and the More page, this covers every <Route> in App.tsx (tests/nav.spec.ts checks).
 */
export const CONTEXTUAL: { path: string; from: string }[] = [
  { path: '/', from: 'the world’s name in the top bar (your worlds)' },
  { path: '/join/:token', from: 'an invite link' },
  { path: '/shared/:token', from: 'a public wiki link' },
  { path: '/screen/:worldId', from: 'More › Players’ screen, and “Players’ screen” while showing something' },
  { path: '/w/:worldId/print/:kind/:id', from: 'Print on a page or a session' },
  { path: '/w/:worldId/p/:entityId', from: 'every link to a page; it lights the tab for its type (?edit=1 and ?new=1 from Edit and New)' },
  { path: '/w/:worldId/e/:entityId', from: 'old links: moved to /p/ on arrival' },
  { path: '/w/:worldId/type/:type', from: 'old links: moved to the list’s own address on arrival' },
  { path: '/w/:worldId/type/:type/:kind', from: 'old links: moved to /other/ on arrival' },
  { path: '/w/:worldId/:section', from: 'the type tabs (Places, People…), Everything, and old type words like /npc' },
  { path: '/w/:worldId/*', from: 'a mistyped address: “nothing here”, with a way home' },
  { path: '*', from: 'any other address: your worlds' },
]

/** Areas for a viewer, in order. */
export const areasFor = (viewer: Viewer) => AREAS.filter((a) => a.who.includes(viewer))

/** Whether a tab shows in the menus right now. */
export const showsTab = (t: NavTab, f: NavFacts) => t.who.includes(f.viewer) && (!t.when || t.when(f)) && !!t.to(f)

/** The tabs of an area a viewer has right now. */
export const tabsOf = (area: NavArea, f: NavFacts) => area.tabs.filter((t) => showsTab(t, f))

/** The More page's groups for a viewer, each with only what they can open now. */
export function moreFor(f: NavFacts) {
  const groups = f.viewer === 'gm' ? MORE_GROUPS : PLAYER_MORE_GROUPS
  return groups.map((g) => ({ ...g, items: g.items.filter((t) => t.who.includes(f.viewer) && (!t.when || t.when(f))) })).filter((g) => g.items.length)
}

/** Where an area goes when chosen without a remembered page: its own address, else its first tab. */
export function areaHome(area: NavArea, f: NavFacts) {
  return area.to?.(f) ?? tabsOf(area, f)[0]?.to(f)
}

/** The phone's bottom bar: five things in thumb reach. A player's Me holds both Me and Notes. */
export interface BarItem {
  id: string
  label: string
  icon: Icon
  area: AreaId
  /** The tabs it stands for; none means the whole area. */
  tabs?: string[]
}
export const PHONE_BAR: Record<'gm' | 'player', BarItem[]> = {
  gm: AREAS.filter((a) => a.who.includes('gm')).map((a) => ({ id: a.id, label: a.short ?? a.label, icon: a.icon, area: a.id })),
  player: [
    { id: 'now', label: 'Now', icon: Armchair, area: 'room', tabs: ['now'] },
    { id: 'me', label: 'Me', icon: UserCircle, area: 'room', tabs: ['me', 'notes'] },
    { id: 'party', label: 'Party', icon: UsersThree, area: 'room', tabs: ['party'] },
    { id: 'leads', label: 'Leads', icon: Spiral, area: 'room', tabs: ['leads'] },
    { id: 'world', label: 'World', icon: GlobeHemisphereWest, area: 'world' },
  ],
}

/** Where an address is: its area and the tab it lights (if any). */
export interface NavSpot {
  area: NavArea
  tab?: NavTab
}

/** What locate() needs besides the address: the type of a page, and which part of a session opens by default. */
export interface LocateHelp {
  viewer: Viewer
  /** The type of the page a /p/ address names. */
  pageType?: (param: string) => EntityType | undefined
  /** The tab a session opens on when the address names none (prep before it's played, notes after). */
  sessionTab?: (sessionId: string) => string
}

/** Every tab and More item a viewer has, with its area. */
function candidates(viewer: Viewer): NavSpot[] {
  const out: NavSpot[] = []
  for (const area of areasFor(viewer)) {
    for (const tab of area.tabs) if (tab.who.includes(viewer)) out.push({ area, tab })
    if (area.id === 'more') for (const g of MORE_GROUPS) for (const tab of g.items) if (tab.who.includes(viewer)) out.push({ area, tab })
  }
  return out
}

/** How well a pattern fits an address: undefined if not at all, more for more exact matches. */
function fit(pattern: string, parts: string[], query: URLSearchParams) {
  const [path, q] = pattern.split('?')
  const want = path ? path.split('/') : []
  if (want.length !== parts.length) return
  let score = 10
  for (let i = 0; i < want.length; i++) {
    if (want[i].startsWith(':')) continue
    if (want[i] !== parts[i]) return
    score += 2
  }
  for (const [k, v] of new URLSearchParams(q ?? '')) {
    if (query.get(k) !== v) return
    score += 5
  }
  return score
}

/**
 * Which area and tab an address belongs to, for a viewer: what lights up in the sidebar and the top
 * bar. Pages (/p/…) and lists go by their type. Undefined for addresses outside a world, and for
 * ones the viewer has no menu for (a GM tool in the player view).
 */
export function locate(pathname: string, search: string, help: LocateHelp): NavSpot | undefined {
  const m = pathname.match(/^\/w\/[^/]+(?:\/(.*))?$/)
  if (!m) return
  const parts = (m[1] ?? '').replace(/\/+$/, '').split('/').filter(Boolean)
  const query = new URLSearchParams(search)
  // An address with no tab named is on the tab it opens on.
  if (!parts.length && !query.get('tab')) query.set('tab', 'overview')
  if (parts[0] === 's' && parts.length === 2 && !query.get('tab') && !query.get('end')) query.set('tab', help.sessionTab?.(parts[1]) ?? 'prep')
  let type: EntityType | undefined
  if ((parts[0] === 'p' || parts[0] === 'e') && parts.length === 2) type = help.pageType?.(parts[1])
  else if (parts[0] === 'type' && parts[1]) type = parts[2] ? 'custom' : sectionType(parts[1])
  else if (parts[0] === 'other') type = 'custom'
  else if (parts.length === 1) type = sectionType(parts[0])

  let best: NavSpot | undefined
  let bestScore = 0
  for (const spot of candidates(help.viewer)) {
    let score = 0
    for (const p of spot.tab!.paths ?? []) score = Math.max(score, fit(p, parts, query) ?? 0)
    if (type && spot.tab!.types?.includes(type)) score = Math.max(score, 9)
    if (score > bestScore) {
      best = spot
      bestScore = score
    }
  }
  if (best) return best
  for (const area of areasFor(help.viewer)) if (area.paths?.some((p) => fit(p, parts, query) !== undefined)) return { area }
  // A wiki reader has one area; anything of theirs that lights no tab still sits in it.
  if (help.viewer === 'wiki') return { area: AREAS.find((a) => a.id === 'world')! }
}

/** The tabs across the top for an area: its own, or for More the page itself and the item that's open. */
export function topTabs(area: NavArea, f: NavFacts, lit?: NavTab) {
  const tabs = tabsOf(area, f)
  if (lit && !tabs.includes(lit) && lit.to(f)) tabs.push(lit)
  return tabs
}

/** A "Go to" place for search. */
export interface NavPlace {
  title: string
  to: string
  words: string
  external?: boolean
}

/** Every area, tab and More item the viewer has, for the search's "Go to" places. */
export function navPlaces(f: NavFacts): NavPlace[] {
  const out: NavPlace[] = []
  const add = (title: string, to: string | undefined, words = '', external?: boolean) => {
    if (!to) return
    const same = out.find((p) => p.title === title && p.to === to)
    if (same) same.words = `${same.words} ${words.toLowerCase()}`
    else out.push({ title, to, words: words.toLowerCase(), external })
  }
  for (const area of areasFor(f.viewer)) {
    add(area.label, areaHome(area, f), area.keywords)
    for (const t of area.tabs) if (t.who.includes(f.viewer)) add(t.searchTitle ?? t.label, t.to(f), `${t.label} ${t.keywords ?? ''}`)
  }
  for (const g of f.viewer === 'gm' ? MORE_GROUPS : PLAYER_MORE_GROUPS)
    for (const t of g.items) if (t.who.includes(f.viewer)) add(t.searchTitle ?? t.label, t.to(f), `${g.label} ${t.keywords ?? ''}`, t.external)
  for (const c of f.campaigns ?? []) add(c.name, w(f, `c/${c.id}`), 'campaign sessions')
  return out
}

/** Every address pattern the menus answer for, as App.tsx writes them (for the orphan test). */
export function navPatterns(): string[] {
  const all = [...AREAS.flatMap((a) => [...(a.paths ?? []), ...a.tabs.flatMap((t) => t.paths ?? [])]), ...[...MORE_GROUPS, ...PLAYER_MORE_GROUPS].flatMap((g) => g.items.flatMap((t) => t.paths ?? []))]
  return [...new Set(all.map((p) => `/w/:worldId${p.split('?')[0] ? `/${p.split('?')[0]}` : ''}`))]
}
