import type { EntityType } from '../db'
import { htmlToMarkdown } from '../importers'
import type { LookupSource } from './sources'

/**
 * Asking the sources in sources.ts, straight from the browser (each allows it: Open5e for everyone,
 * MediaWiki when asked with origin=*), or reading the rules that come with the app. Nothing here is saved; the Look it up screen turns what's
 * found into a page only when the GM says so.
 */

/** One search result. */
export interface Hit {
  source: LookupSource
  title: string
  /** "Spell", "Monster", "Wiki article". */
  kind: string
  /** A line of the text, to tell results apart. */
  snippet: string
  /** Open5e sends everything with the search (and the app's own rules are all here), so there's nothing more to fetch. */
  raw?: Record<string, unknown>
  bundled?: BundledEntry
  /** The page type it most likely becomes. */
  type: EntityType
}

/** What's found, ready to become a page. */
export interface Found {
  title: string
  summary: string
  /** Markdown, without the credit line. */
  body: string
  fields: { key: string; value: string }[]
  type: EntityType
  /** Where it came from, and the licence, as a Markdown line to keep under the text. */
  credit: string
  /** The article's own address, to open in a new tab. */
  url: string
}

export class LookupError extends Error {}

const TIMEOUT = 15_000

async function getJson(url: string): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT),
      credentials: 'omit',
    })
  } catch {
    throw new LookupError('offline')
  }
  if (res.status === 404) throw new LookupError('missing')
  if (!res.ok) throw new LookupError(`status ${res.status}`)
  try {
    return await res.json()
  } catch {
    throw new LookupError('not json')
  }
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const plain = (html: string) => new DOMParser().parseFromString(html, 'text/html').body.textContent?.replace(/\s+/g, ' ').trim() ?? ''
/** The opening sentence or so, for a page's one-line summary. */
const firstLine = (md: string) => {
  const text = md
    .replace(/^#+ .*$/gm, '')
    .replace(/[*_`>|]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  const sentence = text.match(/^.{20,200}?[.!?](\s|$)/)?.[0] ?? text.slice(0, 160)
  return sentence.trim()
}

// ---------- Open5e (the D&D SRDs) ----------

const OPEN5E = 'https://api.open5e.com/v2'

/** The kinds of thing Open5e keeps, what to call them and the page type each becomes. */
const OPEN5E_KINDS: { path: string; kind: string; type: EntityType }[] = [
  { path: 'spells', kind: 'Spell', type: 'lore' },
  { path: 'creatures', kind: 'Monster', type: 'npc' },
  { path: 'items', kind: 'Item', type: 'item' },
  { path: 'magicitems', kind: 'Magic item', type: 'item' },
  { path: 'conditions', kind: 'Condition', type: 'lore' },
  { path: 'feats', kind: 'Feat', type: 'lore' },
  { path: 'species', kind: 'Species', type: 'lore' },
  { path: 'classes', kind: 'Class', type: 'lore' },
  { path: 'backgrounds', kind: 'Background', type: 'lore' },
  { path: 'rules', kind: 'Rule', type: 'lore' },
]

const SRD_CREDIT: Record<string, string> = {
  'srd-2014':
    'This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.',
  'srd-2024':
    'This work includes material from the System Reference Document 5.2 (“SRD 5.2”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.',
}

const docKey = (o: Obj) => {
  const d = o.document
  if (isObj(d)) return str(d.key) || str(d.slug)
  return str(d).replace(/\/$/, '').split('/').pop() ?? str(o.document__slug)
}

async function searchOpen5e(source: LookupSource, words: string): Promise<Hit[]> {
  const doc = source.document!
  const lower = words.toLowerCase()
  let failures = 0
  const lists = await Promise.all(
    OPEN5E_KINDS.map(async (k) => {
      try {
        const data = await getJson(`${OPEN5E}/${k.path}/?name__icontains=${encodeURIComponent(words)}&document__key__in=${doc}&limit=10&format=json`)
        const results = isObj(data) && Array.isArray(data.results) ? data.results.filter(isObj) : []
        return results
          .filter((o) => str(o.name).toLowerCase().includes(lower) && (!o.document || !docKey(o) || docKey(o) === doc))
          .map<Hit>((o) => ({
            source,
            title: str(o.name),
            kind: k.kind,
            snippet: firstLine(str(o.desc)),
            raw: o,
            type: k.type,
          }))
      } catch (e) {
        // A kind this version of the API doesn't have is fine; every kind failing means it's unreachable.
        if (!(e instanceof LookupError && e.message === 'missing')) failures++
        return []
      }
    }),
  )
  if (failures === OPEN5E_KINDS.length) throw new LookupError('offline')
  const seen = new Set<string>()
  // Exact names first, then the rest in the order of the kinds above.
  return lists
    .flat()
    .filter((h) => (seen.has(h.title.toLowerCase()) ? false : (seen.add(h.title.toLowerCase()), true)))
    .sort((a, b) => Number(b.title.toLowerCase() === lower) - Number(a.title.toLowerCase() === lower))
}

const human = (key: string) =>
  key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\bAc\b/, 'AC')
    .replace(/\bHp\b/, 'HP')
/** Parts of an Open5e entry that are about the API, not the thing itself. */
const OPEN5E_SKIP = new Set([
  'key',
  'url',
  'name',
  'desc',
  'document',
  'slug',
  'page',
  'page_no',
  'highlighted',
  'parent',
  'children',
  'ruleset',
  'illustration',
  'v2_converted_path',
])
/** Text that reads as part of the description however short it is, with the heading it gets. */
const PROSE = new Map([
  ['higher_level', 'At higher levels'],
  ['benefits', 'Benefits'],
  ['description', 'Description'],
  ['flavor', 'Flavour'],
  ['notes', 'Notes'],
])
const nameOf = (v: unknown) => (isObj(v) ? str(v.name) : str(v))

/** An Open5e entry as a page: short values become details, long ones and lists of named things become sections. */
function readOpen5e(hit: Hit): Found {
  const o = hit.raw ?? {}
  const fields: Found['fields'] = []
  const parts: string[] = [str(o.desc)]
  for (const [k, v] of Object.entries(o)) {
    if (OPEN5E_SKIP.has(k) || k.startsWith('document') || v === null || v === undefined || v === '' || v === false) continue
    const key = human(k)
    if (typeof v === 'string' && PROSE.has(k)) parts.push(`### ${PROSE.get(k)}\n\n${v}`)
    else if (typeof v === 'number') fields.push({ key, value: String(v) })
    else if (v === true) fields.push({ key, value: 'Yes' })
    else if (typeof v === 'string') {
      if (/^https?:\/\//.test(v)) continue
      if (v.length <= 80 && !v.includes('\n')) fields.push({ key, value: v })
      else parts.push(`### ${key}\n\n${v}`)
    } else if (Array.isArray(v)) {
      if (!v.length) continue
      if (v.every((x) => isObj(x) && x.desc)) parts.push(`### ${key}\n\n${v.map((x) => `**${nameOf(x)}.** ${str((x as Obj).desc)}`).join('\n\n')}`)
      else {
        const names = v.map(nameOf).filter(Boolean)
        if (names.length && names.join(', ').length <= 120) fields.push({ key, value: names.join(', ') })
        else if (names.length) parts.push(`### ${key}\n\n${names.map((x) => `- ${x}`).join('\n')}`)
      }
    } else if (isObj(v)) {
      if (str(v.name)) fields.push({ key, value: str(v.name) })
      else {
        // A set of numbers, like ability scores or speeds: "Strength 10, Dexterity 14".
        const pairs = Object.entries(v).filter(([, x]) => typeof x === 'number' || (typeof x === 'string' && x && x.length < 40))
        if (pairs.length && pairs.length <= 12)
          fields.push({
            key,
            value: pairs.map(([a, b]) => `${human(a)} ${b}`).join(', '),
          })
      }
    }
  }
  const doc = hit.source.document!
  return {
    title: hit.title,
    summary: firstLine(str(o.desc)) || `${hit.kind} from the ${hit.source.name}.`,
    body: parts.filter(Boolean).join('\n\n'),
    fields: fields.slice(0, 30),
    type: hit.type,
    credit: `*${hit.kind} from the [${hit.source.name}](https://open5e.com) (via Open5e). ${SRD_CREDIT[doc] ?? ''}*`,
    url: 'https://open5e.com',
  }
}

// ---------- MediaWiki (Fandom and other fan wikis) ----------

interface WikiInfo {
  api: string
  /** "https://forgottenrealms.fandom.com/wiki/$1" */
  articles: string
  licence?: { name: string; url: string }
}
const wikiInfo = new Map<string, Promise<WikiInfo>>()

/** Finds the wiki's API (the first address that answers) and reads its licence. Remembered for the visit. */
function infoFor(source: LookupSource): Promise<WikiInfo> {
  const known = wikiInfo.get(source.id)
  if (known) return known
  const p = (async () => {
    let lastError: unknown
    for (const api of source.apis ?? []) {
      try {
        const data = await getJson(`${api}?action=query&meta=siteinfo&siprop=general%7Crightsinfo&format=json&formatversion=2&origin=*`)
        const general = isObj(data) && isObj(data.query) && isObj(data.query.general) ? data.query.general : undefined
        if (!general) continue
        const rights = isObj(data) && isObj(data.query) && isObj(data.query.rightsinfo) ? data.query.rightsinfo : {}
        const server = str(general.server).replace(/^\/\//, 'https://')
        return {
          api,
          articles: server && str(general.articlepath) ? server + str(general.articlepath) : '',
          licence: str(rights.text)
            ? {
                name: str(rights.text),
                url: str(rights.url).replace(/^\/\//, 'https://'),
              }
            : undefined,
        }
      } catch (e) {
        lastError = e
      }
    }
    throw lastError instanceof LookupError ? lastError : new LookupError('offline')
  })()
  wikiInfo.set(source.id, p)
  p.catch(() => wikiInfo.delete(source.id))
  return p
}

async function searchWiki(source: LookupSource, words: string): Promise<Hit[]> {
  const { api } = await infoFor(source)
  const data = await getJson(
    `${api}?action=query&list=search&srsearch=${encodeURIComponent(words)}&srlimit=12&srprop=snippet&format=json&formatversion=2&origin=*`,
  )
  const results = isObj(data) && isObj(data.query) && Array.isArray(data.query.search) ? data.query.search.filter(isObj) : []
  return results.map((r) => ({
    source,
    title: str(r.title),
    kind: 'Wiki article',
    snippet: plain(str(r.snippet)),
    type: 'lore' as EntityType,
  }))
}

/** Bits of a wiki page that don't belong in a GM's notes: boxes, navigation, references, pictures, tables. */
const WIKI_JUNK = [
  '.portable-infobox',
  'aside',
  '.infobox',
  '.navbox',
  '.reference',
  'sup',
  '.references',
  '.mw-references-wrap',
  '.mw-editsection',
  '#toc',
  '.toc',
  'figure',
  '.thumb',
  '.gallery',
  '.wikia-gallery',
  '.noprint',
  '.metadata',
  '.ambox',
  '.dablink',
  '.hatnote',
  '.notice',
  '.mw-empty-elt',
  'style',
  'script',
  'table',
].join(',')
/** Sections at the end of an article that are lists of sources, not the thing itself. */
const WIKI_TAIL = /^(references|notes|external links|see also|gallery|appearances|further reading|sources|connections|footnotes|bibliography|trivia)$/i

/** The infobox's rows (Fandom's portable infoboxes and the classic table kind) as details. */
function infoboxFields(root: Element) {
  const out: Found['fields'] = []
  for (const row of root.querySelectorAll('.portable-infobox .pi-data')) {
    const key = row.querySelector('.pi-data-label')?.textContent?.replace(/\s+/g, ' ').trim()
    const valueEl = row.querySelector('.pi-data-value')
    valueEl?.querySelectorAll('sup, .reference').forEach((x) => x.remove())
    valueEl?.querySelectorAll('br, li').forEach((x) => x.after(', '))
    const value = valueEl?.textContent
      ?.replace(/\s+/g, ' ')
      .replace(/(,\s*)+$/, '')
      .replace(/\s+,/g, ',')
      .trim()
    if (key && value && value.length <= 160) out.push({ key, value })
  }
  for (const row of root.querySelectorAll('table.infobox tr')) {
    const th = row.querySelector('th')
    const td = row.querySelector('td')
    td?.querySelectorAll('sup, .reference').forEach((x) => x.remove())
    const key = th?.textContent?.replace(/\s+/g, ' ').trim()
    const value = td?.textContent?.replace(/\s+/g, ' ').trim()
    if (key && value && value.length <= 160) out.push({ key, value })
  }
  const seen = new Set<string>()
  return out.filter((f) => (seen.has(f.key.toLowerCase()) ? false : (seen.add(f.key.toLowerCase()), true))).slice(0, 20)
}

/** A guess at the page type from the infobox. */
function wikiType(fields: Found['fields']): EntityType {
  const keys = fields.map((f) => f.key.toLowerCase()).join('|')
  if (/portfolio|domains|worshipers|holy symbol|symbol|divine rank/.test(keys)) return 'deity'
  if (/population|capital|region|climate|demonym|location|terrain/.test(keys)) return 'location'
  if (/headquarters|leader|members|founded|base of operations/.test(keys)) return 'faction'
  if (/gender|born|died|race|species|occupation|class|age|clan/.test(keys)) return 'npc'
  return 'lore'
}

const MAX_BODY = 60_000

async function readWiki(hit: Hit, whole: boolean): Promise<Found> {
  const info = await infoFor(hit.source)
  const data = await getJson(
    `${info.api}?action=parse&page=${encodeURIComponent(hit.title)}&prop=text%7Cdisplaytitle&redirects=1&disableeditsection=1&disabletoc=1&format=json&formatversion=2&origin=*${whole ? '' : '&section=0'}`,
  )
  const parse = isObj(data) && isObj(data.parse) ? data.parse : undefined
  if (!parse) throw new LookupError('missing')
  const title = plain(str(parse.displaytitle)) || str(parse.title) || hit.title
  const root = new DOMParser().parseFromString(str(parse.text), 'text/html').body
  const fields = infoboxFields(root)
  root.querySelectorAll(WIKI_JUNK).forEach((x) => x.remove())
  // Drop the list-of-sources sections at the end (the heading may be wrapped in a <div class="mw-heading">).
  for (const h of [...root.querySelectorAll('h2')]) {
    if (!WIKI_TAIL.test(h.textContent?.replace(/\[.*?\]/g, '').trim() ?? '')) continue
    const start = h.parentElement?.classList.contains('mw-heading') ? h.parentElement : h
    let next = start.nextElementSibling
    while (next && next.tagName !== 'H2' && !next.querySelector('h2')) {
      const after = next.nextElementSibling
      next.remove()
      next = after
    }
    start.remove()
  }
  let body = htmlToMarkdown(root.innerHTML)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (body.length > MAX_BODY) body = `${body.slice(0, MAX_BODY).replace(/\s+\S*$/, '')}…\n\n*(The article goes on; open it on the wiki for the rest.)*`
  const url = info.articles ? info.articles.replace('$1', encodeURIComponent(title.replace(/ /g, '_')).replace(/%2F/g, '/')) : hit.source.article!(title)
  const licence = info.licence ?? hit.source.licence
  return {
    title,
    summary: firstLine(body),
    body,
    fields,
    type: wikiType(fields),
    credit: `*From “[${title}](${url})” on the ${hit.source.name}${licence ? `, under [${licence.name}](${licence.url})` : ''}. Keep this line if you share the page.*`,
    url,
  }
}

// ---------- rules that come with the app ----------

/** One entry of a rules file in public/rules/ (see scripts/build-daggerheart.mjs). */
interface BundledEntry {
  /** Title, kind ("Adversary"), page type, Markdown, details. */
  t: string
  k: string
  y: EntityType
  b: string
  f: Found['fields']
}
interface BundledRules {
  name: string
  credit: string
  entries: BundledEntry[]
}
const bundled = new Map<string, Promise<BundledRules>>()

function rulesFor(source: LookupSource) {
  const known = bundled.get(source.id)
  if (known) return known
  const p = (getJson(`${import.meta.env.BASE_URL}${source.data}`) as Promise<BundledRules>).then((r) => {
    if (!Array.isArray(r?.entries)) throw new LookupError('missing')
    return r
  })
  bundled.set(source.id, p)
  p.catch(() => bundled.delete(source.id))
  return p
}

/** Words as they're compared: lower case, without accents or punctuation. */
const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9+]+/g, ' ')
    .trim()

const headingCache = new WeakMap<BundledEntry, string>()
const headings = (e: BundledEntry) => {
  let h = headingCache.get(e)
  if (h === undefined) {
    h = fold(
      e.b
        .split('\n')
        .filter((l) => l.startsWith('#'))
        .join(' '),
    )
    headingCache.set(e, h)
  }
  return h
}

/** Names first (exact, then starting with the words, then containing them all), then a heading inside, then text that has every word. */
async function searchBundled(source: LookupSource, words: string): Promise<Hit[]> {
  const rules = await rulesFor(source)
  const q = fold(words)
  const terms = q.split(' ').filter(Boolean)
  if (!terms.length) return []
  const scored: [number, BundledEntry][] = []
  for (const e of rules.entries) {
    const title = fold(e.t)
    let score = 0
    if (title === q) score = 100
    else if (title.startsWith(q)) score = 80
    else if (terms.every((t) => title.includes(t))) score = 60
    // A rule that has the words as one of its own headings ("Vulnerable" under Conditions) comes next.
    else if (terms.every((t) => headings(e).includes(t))) score = 50
    else if (terms.every((t) => fold(`${e.k} ${e.b}`).includes(t))) score = 20 - Math.min(10, e.b.length / 2000)
    if (score) scored.push([score, e])
  }
  return scored
    .sort((a, b) => b[0] - a[0] || a[1].t.localeCompare(b[1].t))
    .slice(0, 40)
    .map(([, e]) => ({
      source,
      title: e.t,
      kind: e.k,
      snippet: firstLine(e.b),
      bundled: e,
      type: e.y,
    }))
}

async function readBundled(hit: Hit): Promise<Found> {
  const rules = await rulesFor(hit.source)
  const e = hit.bundled!
  return {
    title: e.t,
    summary: firstLine(e.b),
    body: e.b,
    fields: e.f,
    type: e.y,
    credit: `*${e.k} from the ${rules.name}. ${rules.credit}*`,
    url: hit.source.site,
  }
}

// ---------- either ----------

/** Searches one source. Throws LookupError('offline') when it can't be reached. */
export function search(source: LookupSource, words: string): Promise<Hit[]> {
  if (source.kind === 'open5e') return searchOpen5e(source, words)
  if (source.kind === 'wiki') return searchWiki(source, words)
  if (source.kind === 'bundled') return searchBundled(source, words)
  return Promise.resolve([])
}

/** Everything about one result, ready to show and save. Wikis give their opening part unless `whole`. */
export async function read(hit: Hit, whole = false): Promise<Found> {
  if (hit.source.kind === 'open5e') return readOpen5e(hit)
  if (hit.source.kind === 'bundled') return readBundled(hit)
  return readWiki(hit, whole)
}

/** The text a page gets: what was found, then the credit line. */
export const pageBody = (f: Found) => `${f.body}\n\n---\n\n${f.credit}`
