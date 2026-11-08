/**
 * Where "Look it up" searches, for each game in GAME_SYSTEMS (src/db.ts).
 *
 * Three kinds of source:
 *  - 'open5e': the Open5e API, which serves the D&D System Reference Documents (5.1 for 2014, 5.2 for
 *    2024). Both SRDs are released under Creative Commons Attribution 4.0, so the text can be copied
 *    into a page as long as the page says where it came from.
 *  - 'wiki': a fan wiki that runs MediaWiki (Fandom wikis, PathfinderWiki, Starfinder Wiki). Their
 *    text is Creative Commons Attribution-ShareAlike; the licence is read from the wiki itself and
 *    written under the copied text with a link back to the article.
 *  - 'web': a site that has no open API, or whose rules text isn't free to copy (Archives of Nethys,
 *    D&D Beyond, Shadowdark, Daggerheart…). Search opens that site in a new tab instead.
 *
 * Every 'open5e' and 'wiki' host must also be in the connect-src of the security policy
 * (public/_headers and src-tauri/tauri.conf.json), or the browser won't let the app ask it.
 */

export type LookupKind = 'open5e' | 'wiki' | 'web'

export interface LookupSource {
  id: string
  /** The name shown on its button and under copied text. */
  name: string
  kind: LookupKind
  /** What it's good for, one short line. */
  blurb: string
  /** Its home page. */
  site: string
  /** open5e: the document key (srd-2014, srd-2024). */
  document?: string
  /** wiki: where its MediaWiki API might live (tried in order, the first that answers is kept). */
  apis?: string[]
  /** wiki: an article's address, from its title. */
  article?: (title: string) => string
  /** web: the address of a search for these words. */
  search?: (q: string) => string
  /** The licence, when it's fixed (wikis say theirs when asked). */
  licence?: { name: string; url: string }
}

const CC_BY_4 = { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }

const fandom = (sub: string, name: string, blurb: string): LookupSource => ({
  id: sub,
  name,
  kind: 'wiki',
  blurb,
  site: `https://${sub}.fandom.com`,
  apis: [`https://${sub}.fandom.com/api.php`],
  article: (t) => `https://${sub}.fandom.com/wiki/${encodeURIComponent(t.replace(/ /g, '_'))}`,
})

/** A small wiki that keeps MediaWiki under /mediawiki/ or /w/ (we try both). */
const mediawiki = (id: string, host: string, name: string, blurb: string): LookupSource => ({
  id,
  name,
  kind: 'wiki',
  blurb,
  site: `https://${host}`,
  apis: [`https://${host}/mediawiki/api.php`, `https://${host}/w/api.php`, `https://${host}/api.php`],
  article: (t) => `https://${host}/wiki/${encodeURIComponent(t.replace(/ /g, '_'))}`,
})

const web = (id: string, name: string, blurb: string, site: string, search: (q: string) => string): LookupSource => ({ id, name, kind: 'web', blurb, site, search })
const q = encodeURIComponent
/** A web search kept to one site, for sites without a search address of their own. */
const siteSearch = (host: string) => (words: string) => `https://duckduckgo.com/?q=${q(`site:${host} ${words}`)}`

export const SOURCES: Record<string, LookupSource> = {
  srd2014: {
    id: 'srd2014',
    name: 'D&D 5e SRD 5.1',
    kind: 'open5e',
    blurb: 'Spells, monsters, magic items, conditions and rules from the 2014 System Reference Document.',
    site: 'https://open5e.com',
    document: 'srd-2014',
    licence: CC_BY_4,
  },
  srd2024: {
    id: 'srd2024',
    name: 'D&D 5e SRD 5.2',
    kind: 'open5e',
    blurb: 'Spells, monsters, magic items, conditions and rules from the 2024 System Reference Document.',
    site: 'https://open5e.com',
    document: 'srd-2024',
    licence: CC_BY_4,
  },
  forgottenrealms: fandom('forgottenrealms', 'Forgotten Realms Wiki', 'Places, people, gods and history of the Forgotten Realms.'),
  pathfinderwiki: mediawiki('pathfinderwiki', 'pathfinderwiki.com', 'PathfinderWiki', 'Golarion: places, people, gods and history.'),
  starfinderwiki: mediawiki('starfinderwiki', 'starfinderwiki.com', 'Starfinder Wiki', 'The Pact Worlds and beyond: places, people and history.'),
  lovecraft: fandom('lovecraft', 'Lovecraft Wiki', 'The Cthulhu Mythos: beings, books, places and people.'),
  cyberpunk: fandom('cyberpunk', 'Cyberpunk Wiki', 'Night City and the Time of the Red: corps, gangs, people and gear.'),
  whitewolf: fandom('whitewolf', 'White Wolf Wiki', 'The World of Darkness: clans, sects, disciplines and characters.'),

  dndbeyond: web('dndbeyond', 'D&D Beyond', 'Rules you own on D&D Beyond.', 'https://www.dndbeyond.com', (w) => `https://www.dndbeyond.com/search?q=${q(w)}`),
  aon2e: web('aon2e', 'Archives of Nethys', 'The official Pathfinder 2e rules.', 'https://2e.aonprd.com', (w) => `https://2e.aonprd.com/Search.aspx?q=${q(w)}`),
  aon1e: web('aon1e', 'Archives of Nethys', 'The official Pathfinder 1e rules.', 'https://aonprd.com', (w) => `https://aonprd.com/Search.aspx?Query=${q(w)}`),
  aonsf2e: web('aonsf2e', 'Archives of Nethys', 'The official Starfinder 2e rules.', 'https://2e.aonsrd.com', (w) => `https://2e.aonsrd.com/Search.aspx?q=${q(w)}`),
  aonsf1e: web('aonsf1e', 'Archives of Nethys', 'The official Starfinder 1e rules.', 'https://aonsrd.com', (w) => `https://aonsrd.com/Search.aspx?Query=${q(w)}`),
  d20pfsrd: web('d20pfsrd', 'd20pfsrd', 'Pathfinder 1e rules, including third-party books.', 'https://www.d20pfsrd.com', siteSearch('d20pfsrd.com')),
  daggerheart: web('daggerheart', 'Daggerheart SRD', 'The Daggerheart rules (Darrington Press).', 'https://www.daggerheart.com', (w) => `https://duckduckgo.com/?q=${q(`Daggerheart SRD ${w}`)}`),
  shadowdark: web('shadowdark', 'The Arcane Library', 'Shadowdark’s publisher (its rules text isn’t free to copy).', 'https://www.thearcanelibrary.com', (w) => `https://duckduckgo.com/?q=${q(`Shadowdark RPG ${w}`)}`),
  blades: web('blades', 'Blades in the Dark SRD', 'The Blades in the Dark rules (CC BY 3.0).', 'https://bladesinthedark.com', siteSearch('bladesinthedark.com')),
  chaosium: web('chaosium', 'Chaosium', 'Call of Cthulhu’s publisher.', 'https://www.chaosium.com', (w) => `https://duckduckgo.com/?q=${q(`Call of Cthulhu 7e ${w}`)}`),
  rtalsorian: web('rtalsorian', 'R. Talsorian Games', 'Cyberpunk RED’s publisher.', 'https://rtalsorian.com', (w) => `https://duckduckgo.com/?q=${q(`Cyberpunk RED ${w}`)}`),
}

/** Each game's sources, the most useful first. Games not listed (System agnostic, Other) can pick from all of them. */
export const SYSTEM_SOURCES: Record<string, string[]> = {
  'D&D 5e (2014)': ['srd2014', 'forgottenrealms', 'dndbeyond'],
  'D&D 5e (2024)': ['srd2024', 'forgottenrealms', 'dndbeyond'],
  'Pathfinder 2e': ['pathfinderwiki', 'aon2e'],
  'Pathfinder 1e': ['pathfinderwiki', 'aon1e', 'd20pfsrd'],
  'Starfinder 2e': ['starfinderwiki', 'aonsf2e'],
  'Starfinder 1e': ['starfinderwiki', 'aonsf1e'],
  'Call of Cthulhu 7e': ['lovecraft', 'chaosium'],
  Daggerheart: ['daggerheart'],
  Shadowdark: ['shadowdark'],
  'Cyberpunk RED': ['cyberpunk', 'rtalsorian'],
  'Vampire: The Masquerade 5e': ['whitewolf'],
  'Blades in the Dark': ['blades'],
}

/** The games that have sources, in the order of GAME_SYSTEMS. */
export const LOOKUP_SYSTEMS = Object.keys(SYSTEM_SOURCES)

/** The sources for a world's game; for a game without its own list, the D&D 5e (2024) ones to start with. */
export function sourcesFor(system: string): LookupSource[] {
  return (SYSTEM_SOURCES[system] ?? SYSTEM_SOURCES['D&D 5e (2024)']).map((id) => SOURCES[id])
}

/** Every host the app asks directly (for the security policy test). */
export const LOOKUP_HOSTS = [
  'https://api.open5e.com',
  ...Object.values(SOURCES)
    .flatMap((s) => s.apis ?? [])
    .map((u) => new URL(u).origin),
].filter((h, i, all) => all.indexOf(h) === i)
