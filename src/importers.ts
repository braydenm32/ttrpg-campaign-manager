import { strToU8, zipSync } from 'fflate'
import { blankEntity, db, ENTITY_LABELS, newId, typeLabel, type Entity, type EntityType } from './db'
import { saveFileAsAsset } from './hooks'
import { stripSecrets } from './Markdown'
import { IMPORT_ZIP, openZip } from './zipSafe'

/**
 * Bringing pages in from other tools, and out again as Markdown.
 *  - Obsidian, or any folder of Markdown notes: one page per note, the type guessed from its
 *    folder or a "type:" line at the top. Obsidian %%comments%% become GM-only passages.
 *  - Kanka: the campaign export (a .zip of JSON files, one folder per kind of entity).
 *  - World Anvil: the world export (a .zip of JSON articles written in World Anvil's BBCode).
 * Formats change over time, so every reader is forgiving: anything it can't make sense of is skipped
 * and counted. Everything imported starts GM only.
 */

export interface ImportedPage {
  key: string
  name: string
  type: EntityType
  summary: string
  body: string
  tags: string[]
  fields: { key: string; value: string; gm?: boolean }[]
  /** Other names (GM only), and tags only the GM sees, from our own Markdown export. */
  aliases?: string[]
  gmTags?: string[]
  /** The key or name of the page this one sits inside. */
  parent?: string
  status?: Entity['status']
  image?: { name: string; blob: Blob }
}

export interface ImportPlan {
  source: string
  pages: ImportedPage[]
  skipped: number
}

export type ImportSource = 'markdown' | 'kanka' | 'worldanvil'

/** What an import takes out of a .zip: notes, JSON and pictures. Anything else is only counted as skipped. */
const UNPACKED = /\.(md|markdown|json|png|jpe?g|gif|webp|svg)$/i

/** Every file picked (folders keep their paths), with .zip files opened up (within the limits in zipSafe.ts). */
export async function readFiles(list: File[]): Promise<Map<string, Blob>> {
  const out = new Map<string, Blob>()
  for (const f of list) {
    const path = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name
    if (/\.zip$/i.test(f.name)) {
      if (f.size > IMPORT_ZIP.total) throw new Error(`${f.name} is too big to open here (over 1 GB). Unzip it, then pick the files or the folder inside instead.`)
      const zip = openZip(new Uint8Array(await f.arrayBuffer()), IMPORT_ZIP)
      for (const e of zip.entries) if (!e.name.endsWith('/')) out.set(e.name, UNPACKED.test(e.name) ? new Blob([zip.read(e)], { type: mimeOf(e.name) }) : new Blob())
    } else out.set(path, f)
  }
  return out
}

/** Windows (\r\n) and old Mac (\r) line endings as plain \n, so a stray \r can't end a secret passage for the server and not for the app. */
const plainNewlines = (s: string) => s.replace(/\r\n?/g, '\n')

/**
 * Text as a GM-only passage. A line in it that starts ":::" would end the passage early (or start
 * another), and what follows would reach players once the page is revealed, so such a line gets a
 * backslash in front. Markdown still shows it as it was ("\:" reads as ":").
 */
export function gmOnly(text: string) {
  return `:::gm\n${plainNewlines(text).replace(/^([ \t]*):::/gm, '$1\\:::')}\n:::`
}

/** Stands in for a piece of text while the text around it is worked on; never left in what's imported. */
const MARK = '\uE000'
const MARKS = /\uE000/g

function mimeOf(path: string) {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return (
    { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', md: 'text/markdown', json: 'application/json' }[ext] ??
    'application/octet-stream'
  )
}

const isImage = (p: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(p)
const baseName = (p: string) => p.split('/').pop() ?? p

// ---------- types ----------

const TYPE_WORDS: [RegExp, EntityType][] = [
  [/\b(pcs?|player ?characters?|party)\b/i, 'pc'],
  [/\b(npcs?|characters?|people|persons?|creatures?)\b/i, 'npc'],
  [/\b(locations?|places?|regions?|cities|city|towns?|villages?|settlements?|geography|buildings?|landmarks?|dungeons?|planes?|countries|country|kingdoms?)\b/i, 'location'],
  [/\b(factions?|organi[sz]ations?|guilds?|groups?|families|family|houses?|military)\b/i, 'faction'],
  [/\b(items?|artifacts?|artefacts?|loot|equipment|weapons?|objects?|vehicles?|documents?)\b/i, 'item'],
  [/\b(events?|history|conflicts?|battles?|wars?|timelines?)\b/i, 'event'],
  [/\b(quests?|missions?|plots?|adventures?)\b/i, 'quest'],
  [/\b(shops?|taverns?|inns?|stores?|markets?)\b/i, 'shop'],
  [/\b(deit(?:y|ies)|gods?|religions?|pantheons?)\b/i, 'deity'],
  [/\b(threads?|hooks?|rumou?rs?)\b/i, 'thread'],
]

/** A best guess at the page type from a type name, folder or template. Unknown things become lore. */
export function guessType(...hints: (string | undefined)[]): EntityType {
  for (const h of hints) {
    if (!h) continue
    const t = h.replace(/[_-]+/g, ' ')
    for (const type of Object.keys(ENTITY_LABELS) as EntityType[]) {
      const l = ENTITY_LABELS[type]
      if (type !== 'custom' && (t.toLowerCase() === type || t.toLowerCase() === l.one.toLowerCase() || t.toLowerCase() === l.many.toLowerCase())) return type
    }
    for (const [re, type] of TYPE_WORDS) if (re.test(t)) return type
  }
  return 'lore'
}

// ---------- Markdown / Obsidian ----------

function frontmatter(text: string): { data: Record<string, string | string[]>; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!m) return { data: {}, body: text }
  const data: Record<string, string | string[]> = {}
  let listKey = ''
  for (const line of m[1].split(/\r?\n/)) {
    const item = line.match(/^\s*-\s+(.*)$/)
    if (item && listKey) {
      const list = Array.isArray(data[listKey]) ? (data[listKey] as string[]) : []
      list.push(unquote(item[1]))
      data[listKey] = list
      continue
    }
    const kv = line.match(/^([\w ][\w -]*?)\s*:\s*(.*)$/)
    if (!kv) continue
    const key = kv[1].trim().toLowerCase()
    const v = kv[2].trim()
    listKey = v ? '' : key
    if (v.startsWith('[') && v.endsWith(']') && !v.startsWith('[[')) data[key] = v.slice(1, -1).split(',').map((x) => unquote(x.trim())).filter(Boolean)
    else data[key] = unquote(v)
  }
  return { data, body: text.slice(m[0].length) }
}

const unquote = (s: string) => s.replace(/^["'](.*)["']$/, '$1')
const asList = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? v.split(/[,\s]+/).filter(Boolean) : [])
const linkName = (v: string | string[] | undefined) => {
  const s = Array.isArray(v) ? v[0] : v
  return s?.replace(/^\[\[|\]\]$/g, '').split('|')[0].split('#')[0].split('/').pop()?.trim()
}

/**
 * Our Markdown export marks GM-only details with this in front of the name ("gm-True identity"), so
 * importing it back keeps them GM only instead of making them details players can see.
 */
const GM_PREFIX = 'gm-'
const GM_TAGS_KEY = 'gm-tags'

/** Obsidian's extras turned into ours: tidy [[links]], %%comments%% as GM-only, embedded pictures pulled out. */
function convertObsidian(body: string, images: string[]) {
  // Comments are found in the text as written, before anything else changes it. A comment never
  // closed hides the rest of the note, as it does in Obsidian.
  const text = body
    .replace(MARKS, '')
    .split('%%')
    .map((part, i) => (i % 2 ? `\n${gmOnly(part.trim())}\n` : part))
    .join('')
  // Embeds come out of the text (the first picture can become the page's picture), but only where
  // players could see them: one inside a secret passage stays put, so a secret picture never ends up
  // as the picture on the page.
  const embeds: string[] = []
  const marked = text.replace(/!\[\[[^\]|]+(?:\|[^\]]*)?\]\]|!\[[^\]]*\]\([^)]+\)/g, (m) => `${MARK}${embeds.push(m) - 1}${MARK}`)
  const shown = new Set(stripSecrets(marked).match(/\uE000\d+\uE000/g))
  return marked
    .replace(/\uE000(\d+)\uE000/g, (t, i: string) => (shown.has(t) ? pullPicture(embeds[Number(i)], images) : embeds[Number(i)]))
    .replace(/\[\[([^\]|#]*)(#[^\]|]*)?(\|[^\]]*)?\]\]/g, (_m, name: string, _h, alias?: string) => `[[${name.split('/').pop()!.trim()}${alias ?? ''}]]`)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** An embed taken out of the text, noting its file if it's a picture in the vault. A web picture stays as it is. */
function pullPicture(embed: string, images: string[]) {
  const wiki = embed.match(/^!\[\[([^\]|]+)/)
  if (wiki) {
    if (isImage(wiki[1])) images.push(wiki[1].trim())
    return ''
  }
  const file = embed.match(/\]\(([^)]+)\)$/)![1].trim()
  if (/^https?:/.test(file)) return embed
  try {
    images.push(decodeURIComponent(file))
  } catch {
    images.push(file)
  }
  return ''
}

const SKIP_KEYS = new Set(['title', 'name', 'tags', 'tag', 'type', 'aliases', 'alias', 'summary', 'description', 'cssclass', 'cssclasses', 'publish', 'location', 'parent', 'located in', 'image', 'status', 'visibility', GM_TAGS_KEY])

export async function planMarkdown(files: Map<string, Blob>): Promise<ImportPlan> {
  const pages: ImportedPage[] = []
  let skipped = 0
  const byName = new Map<string, Blob>()
  for (const [p, b] of files) if (isImage(p)) byName.set(baseName(p).toLowerCase(), b)
  for (const [path, blob] of files) {
    if (/(^|\/)\.(obsidian|trash)\//.test(path) || /(^|\/)\./.test(baseName(path))) continue
    if (!/\.(md|markdown)$/i.test(path)) {
      if (!isImage(path)) skipped++
      continue
    }
    const { data, body } = frontmatter(plainNewlines(await blob.text()))
    const images: string[] = []
    const text = convertObsidian(body, images)
    const folders = path.split('/').slice(0, -1).reverse()
    const name = (typeof data.title === 'string' && data.title) || (typeof data.name === 'string' && data.name) || baseName(path).replace(/\.(md|markdown)$/i, '')
    const imageName = linkName(data.image) ?? images[0]
    const imageBlob = imageName ? byName.get(baseName(imageName).toLowerCase()) : undefined
    const fields = Object.entries(data)
      .filter(([k, v]) => !SKIP_KEYS.has(k) && (typeof v === 'string' ? v.trim() : v.length))
      .map(([k, v]) => {
        const gm = k.startsWith(GM_PREFIX) && k.length > GM_PREFIX.length
        const key = gm ? k.slice(GM_PREFIX.length).trim() : k
        return { key: key[0].toUpperCase() + key.slice(1), value: Array.isArray(v) ? v.join(', ') : v, ...(gm ? { gm: true } : {}) }
      })
    // Other names can have spaces in them, so a plain line is split at commas only.
    const names = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? v.split(',') : []).map((a) => a.trim()).filter(Boolean)
    const aliases = [...names(data.aliases), ...names(data.alias)]
    const gmTags = asList(data[GM_TAGS_KEY])
    const tags = [...asList(data.tags), ...asList(data.tag)].map((t) => t.replace(/^#/, ''))
    pages.push({
      key: path,
      name: name.trim(),
      type: guessType(typeof data.type === 'string' ? data.type : undefined, ...folders, ...tags),
      summary: typeof data.summary === 'string' ? data.summary : typeof data.description === 'string' ? data.description : '',
      body: text,
      tags,
      fields,
      aliases: aliases.length ? aliases : undefined,
      gmTags: gmTags.length ? gmTags : undefined,
      parent: linkName(data.location) ?? linkName(data.parent) ?? linkName(data['located in']),
      status: typeof data.status === 'string' && ['alive', 'dead', 'missing', 'captured'].includes(data.status.toLowerCase()) ? (data.status.toLowerCase() as Entity['status']) : undefined,
      image: imageBlob && imageName ? { name: baseName(imageName), blob: imageBlob } : undefined,
    })
  }
  return { source: 'Markdown', pages, skipped }
}

// ---------- HTML (Kanka) ----------

/** Rough HTML to Markdown, enough for wiki text: paragraphs, headings, bold, italics, links, lists, quotes. */
export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const walk = (n: Node, listDepth = 0): string => {
    if (n.nodeType === Node.TEXT_NODE) return (n.textContent ?? '').replace(/\s+/g, ' ')
    if (n.nodeType !== Node.ELEMENT_NODE) return ''
    const el = n as Element
    const kids = (depth = listDepth) => [...el.childNodes].map((c) => walk(c, depth)).join('')
    const tag = el.tagName.toLowerCase()
    switch (tag) {
      case 'br':
        return '\n'
      case 'p':
      case 'div':
      case 'section':
        return `\n\n${kids().trim()}\n\n`
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        return `\n\n${'#'.repeat(Math.min(6, Number(tag[1]) + 1))} ${kids().trim()}\n\n`
      case 'strong':
      case 'b':
        return `**${kids().trim()}**`
      case 'em':
      case 'i':
        return `*${kids().trim()}*`
      case 's':
      case 'del':
        return `~~${kids().trim()}~~`
      case 'a': {
        const text = kids().trim()
        const href = el.getAttribute('href') ?? ''
        // Kanka's mentions link to the other entity; keep them as page links by name.
        if (el.getAttribute('data-id') || el.classList.contains('entity-mention') || /\/entities\/\d+/.test(href)) return `[[${text}]]`
        return /^https?:/.test(href) ? `[${text}](${href})` : text
      }
      case 'ul':
      case 'ol':
        return `\n\n${[...el.children]
          .map((li, i) => `${'  '.repeat(listDepth)}${tag === 'ol' ? `${i + 1}.` : '-'} ${walk(li, listDepth + 1).trim()}`)
          .join('\n')}\n\n`
      case 'blockquote':
        return `\n\n${kids()
          .trim()
          .split('\n')
          .map((l) => `> ${l}`)
          .join('\n')}\n\n`
      case 'img':
      case 'script':
      case 'style':
        return ''
      case 'tr':
        return `\n| ${[...el.children].map((c) => walk(c).trim()).join(' | ')} |`
      case 'table':
        return `\n\n${kids()}\n\n`
      default:
        return kids()
    }
  }
  return walk(doc.body.firstChild!)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ---------- Kanka ----------

const KANKA_SKIP = /^(calendars?|maps?|dice_rolls|conversations|attribute_templates|tags|bookmarks|menu_links|posts|relations|images|gallery)$/i
const KANKA_TYPES: Record<string, EntityType> = {
  characters: 'npc',
  locations: 'location',
  organisations: 'faction',
  organizations: 'faction',
  families: 'faction',
  items: 'item',
  events: 'event',
  quests: 'quest',
  journals: 'lore',
  notes: 'lore',
  races: 'lore',
  creatures: 'lore',
  abilities: 'lore',
  timelines: 'event',
}

type Json = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? plainNewlines(v) : typeof v === 'number' ? String(v) : '')

export async function planKanka(files: Map<string, Blob>): Promise<ImportPlan> {
  const raw: { folder: string; o: Json }[] = []
  let skipped = 0
  for (const [path, blob] of files) {
    if (!/\.json$/i.test(path)) {
      if (!isImage(path)) skipped++
      continue
    }
    const parts = path.split('/')
    const folder = parts.length > 1 ? parts[parts.length - 2] : baseName(path).replace(/\.json$/i, '')
    if (KANKA_SKIP.test(folder)) continue
    try {
      const parsed = JSON.parse(await blob.text()) as unknown
      const list = Array.isArray(parsed) ? parsed : Array.isArray((parsed as Json)?.data) ? ((parsed as Json).data as unknown[]) : [parsed]
      for (const o of list) if (o && typeof o === 'object' && str((o as Json).name)) raw.push({ folder, o: o as Json })
    } catch {
      skipped++
    }
  }
  // Mentions point at Kanka's entity ids: [character:123] or [character:123|shown text].
  const names = new Map<string, string>()
  for (const { o } of raw) {
    const ent = o.entity as Json | undefined
    if (ent?.id != null) names.set(str(ent.id), str(o.name))
    if (o.entity_id != null) names.set(str(o.entity_id), str(o.name))
  }
  const pages = raw.map(({ folder, o }, i) => {
    const ent = (o.entity as Json | undefined) ?? {}
    const entry = str(o.entry) || str(ent.entry)
    const body = htmlToMarkdown(
      entry.replace(/\[(\w+):(\d+)(?:\|([^\]]+))?\]/g, (_m, _t, id: string, text?: string) => {
        const name = names.get(id)
        return name ? (text && text !== name ? `[[${name}|${text}]]` : `[[${name}]]`) : (text ?? '')
      }),
    )
    const tags = ((ent.tags ?? o.tags ?? []) as unknown[]).map((t) => str(typeof t === 'string' ? t : (t as Json)?.name)).filter(Boolean)
    const fields = [
      ['Kind', o.type],
      ['Title', o.title],
      ['Age', o.age],
      ['Gender', o.sex ?? o.gender],
      ['Pronouns', o.pronouns],
    ]
      .filter(([, v]) => str(v).trim())
      .map(([k, v]) => ({ key: k as string, value: str(v) }))
    const parentId = str(o.parent_location_id) || str(o.location_id) || str(o.parent_id)
    const parentFolder = o.parent_location_id != null || o.location_id != null ? 'locations' : folder
    const type = KANKA_TYPES[folder.toLowerCase()] ?? guessType(folder)
    return {
      // Something without an id of its own still gets a key of its own.
      key: `${folder}:${str(o.id) || `#${i}`}`,
      name: str(o.name).trim(),
      type,
      summary: '',
      body,
      tags,
      fields,
      parent: parentId ? `${parentFolder}:${parentId}` : undefined,
      status: o.is_dead === true || o.is_dead === 1 ? ('dead' as const) : undefined,
    }
  })
  return { source: 'Kanka', pages, skipped }
}

// ---------- World Anvil ----------

/**
 * World Anvil's secret passages: [spoiler], [gm], and [sec:…] (only for some subscribers there).
 * Each becomes GM only.
 */
const WA_SECRET = /(\[\/?(?:spoiler|gm|sec)(?![\w-])[^\]]*\])/i

/** World Anvil's BBCode to Markdown: headings, bold, links, lists, quotes; mentions become [[links]], secrets GM-only. */
export function bbcodeToMarkdown(text: string): string {
  // Secrets are found from the tags as written, and each part is converted on its own, so nothing in
  // the conversion can move text out of a secret. A secret inside another is part of it, a closing tag
  // with nothing open is dropped, and a secret never closed keeps the rest of the text secret.
  let out = ''
  let secret = ''
  let depth = 0
  const keep = () => {
    if (secret.trim()) out += `\n${gmOnly(bbcodePart(secret).trim())}\n`
    secret = ''
  }
  for (const [i, part] of plainNewlines(text).split(WA_SECRET).entries()) {
    if (i % 2 === 0) {
      if (depth) secret += part
      else out += bbcodePart(part)
    } else if (part[1] !== '/') depth++
    else if (depth && !--depth) keep()
  }
  keep()
  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function bbcodePart(text: string): string {
  // Mentions become links, held aside as placeholders so the tag clean-up at the end can't touch them.
  const links: string[] = []
  return text
    .replace(MARKS, '')
    .replace(/@\[([^\]]+)\]\([^)]*\)/g, (_m, name: string) => `${MARK}${links.push(name) - 1}${MARK}`)
    .replace(/\[h(\d)\]([\s\S]*?)\[\/h\d\]/gi, (_m, n: string, t: string) => `\n\n${'#'.repeat(Math.min(6, Number(n) + 1))} ${t.trim()}\n\n`)
    .replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '**$1**')
    .replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '*$1*')
    .replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '~~$1~~')
    .replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '$1')
    .replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, '[$2]($1)')
    .replace(/\[url\]([\s\S]*?)\[\/url\]/gi, '$1')
    .replace(/\[img[^\]]*\][\s\S]*?\[\/img\]/gi, '')
    .replace(/\[(?:quote|aloud)[^\]]*\]([\s\S]*?)\[\/(?:quote|aloud)\]/gi, (_m, t: string) => `\n\n${t.trim().split('\n').map((l) => `> ${l}`).join('\n')}\n\n`)
    .replace(/\[secret:[^\]]*\]/gi, '')
    .replace(/\[li\]([\s\S]*?)(?:\[\/li\]|(?=\[li\])|(?=\[\/[uo]l\]))/gi, (_m, t: string) => `\n- ${t.trim()}`)
    .replace(/\[\/?(?:ul|ol|list)\]/gi, '\n')
    .replace(/\[br\]/gi, '\n')
    .replace(/\[\/?p\]/gi, '\n\n')
    .replace(/\[\/?[a-z][\w-]*(?:[:=][^\]]*)?\]/gi, '')
    .replace(/\uE000(\d+)\uE000/g, (_m, i: string) => `[[${links[Number(i)]}]]`)
}

const WA_FIELDS: [string, string][] = [
  ['firstname', 'First name'],
  ['lastname', 'Last name'],
  ['nickname', 'Nickname'],
  ['honorific', 'Honorific'],
  ['gender', 'Gender'],
  ['age', 'Age'],
  ['dob', 'Born'],
  ['dod', 'Died'],
  ['height', 'Height'],
  ['weight', 'Weight'],
  ['eyes', 'Eyes'],
  ['hair', 'Hair'],
  ['skin', 'Skin'],
  ['motto', 'Motto'],
  ['population', 'Population'],
  ['government', 'Government'],
]
const WA_BODY = ['content', 'sidebarcontent', 'sidepanelcontenttop', 'sidepanelcontent', 'fullfooter', 'footnotes']

export async function planWorldAnvil(files: Map<string, Blob>): Promise<ImportPlan> {
  const pages: ImportedPage[] = []
  let skipped = 0
  for (const [path, blob] of files) {
    if (!/\.json$/i.test(path)) {
      if (!isImage(path)) skipped++
      continue
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(await blob.text())
    } catch {
      skipped++
      continue
    }
    const list = Array.isArray(parsed) ? parsed : [parsed]
    for (const [index, item] of list.entries()) {
      const o = item as Json
      const title = str(o?.title) || str(o?.name)
      if (!title || !WA_BODY.some((k) => str(o[k]))) {
        skipped++
        continue
      }
      const template = str(o.templateType) || str(o.template) || str(o.entityClass) || str((o.category as Json | undefined)?.title)
      const body = WA_BODY.map((k) => str(o[k]))
        .filter(Boolean)
        .map(bbcodeToMarkdown)
        .join('\n\n')
      const tags = str(o.tags)
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      pages.push({
        // Something without an id of its own still gets a key of its own.
        key: str(o.id) || `${path}#${index}`,
        name: title.trim(),
        type: guessType(template, ...path.split('/').slice(0, -1).reverse()),
        // The summary and details are plain text that players see once the page is shown to them, so
        // a secret in the summary is left out, and a detail with a secret in it is GM only.
        summary: stripSecrets(bbcodeToMarkdown(str(o.excerpt))).replace(/\s+/g, ' ').trim().slice(0, 300),
        body,
        tags,
        fields: WA_FIELDS.filter(([k]) => str(o[k]).trim()).map(([k, label]) => {
          const value = str(o[k])
          const open = value.replace(new RegExp(WA_SECRET.source, 'gi'), '')
          return open === value ? { key: label, value: bbcodeToMarkdown(value) } : { key: label, value: bbcodeToMarkdown(open), gm: true }
        }),
      })
    }
  }
  return { source: 'World Anvil', pages, skipped }
}

export function planImport(source: ImportSource, files: Map<string, Blob>) {
  return source === 'kanka' ? planKanka(files) : source === 'worldanvil' ? planWorldAnvil(files) : planMarkdown(files)
}

// ---------- applying ----------

/** Adds the planned pages to a world, all GM only. Returns how many were added. */
export async function applyImport(worldId: string, plan: ImportPlan, skipExisting: boolean) {
  const existing = await db.entities.where({ worldId }).toArray()
  const taken = new Set(existing.map((e) => e.name.trim().toLowerCase()))
  const pages = skipExisting ? plan.pages.filter((p) => !taken.has(p.name.toLowerCase())) : plan.pages
  // Every page gets an id of its own, even when two share a key (a link to that key finds the first).
  const ids = pages.map(() => newId())
  const idByKey = new Map<string, string>()
  const idByName = new Map(existing.map((e) => [e.name.trim().toLowerCase(), e.id]))
  pages.forEach((p, i) => {
    if (!idByKey.has(p.key)) idByKey.set(p.key, ids[i])
    if (!idByName.has(p.name.toLowerCase())) idByName.set(p.name.toLowerCase(), ids[i])
  })
  const now = Date.now()
  // Pictures and pages go in together, so if anything fails (a full device, say) nothing is left half done.
  return db.transaction('rw', [db.entities, db.assets], async () => {
    const rows: Entity[] = []
    for (const [i, p] of pages.entries()) {
      const e = blankEntity(worldId, p.type, p.name || 'Untitled')
      e.id = ids[i]
      e.summary = p.summary
      e.body = p.body
      e.tags = [...new Set(p.tags)]
      e.fields = p.fields
      if (p.aliases) e.aliases = [...new Set(p.aliases)]
      if (p.gmTags) e.gmTags = [...new Set(p.gmTags)]
      if (p.status) e.status = p.status
      if (p.type === 'event') e.eventOrder = now + i
      const parent = p.parent && (idByKey.get(p.parent) ?? idByName.get(p.parent.toLowerCase()))
      if (parent && parent !== e.id) e.parentId = parent
      if (p.image) e.imageId = await saveFileAsAsset(worldId, p.image.blob, p.image.name, [p.name])
      rows.push(e)
    }
    await db.entities.bulkAdd(rows)
    return rows.length
  })
}

// ---------- export ----------

const safeFile = (s: string) => s.replace(/[\\/:*?"<>|#^[\]]+/g, '-').trim() || 'Untitled'

/** Every page as a Markdown file, in a folder per type, zipped, ready for Obsidian. */
export async function exportMarkdown(worldId: string) {
  const world = await db.worlds.get(worldId)
  if (!world) return
  const entities = (await db.entities.where({ worldId }).toArray()).filter((e) => !e.template)
  const byId = new Map(entities.map((e) => [e.id, e]))
  const files: Record<string, Uint8Array> = {}
  const used = new Set<string>()
  for (const e of entities) {
    const folder = safeFile(typeLabel(e, world).many)
    let file = `${folder}/${safeFile(e.name)}.md`
    for (let n = 2; used.has(file.toLowerCase()); n++) file = `${folder}/${safeFile(e.name)} ${n}.md`
    used.add(file.toLowerCase())
    const fm: string[] = [`type: ${JSON.stringify(typeLabel(e, world).one)}`, `visibility: ${e.visibility === 'players' ? 'revealed' : 'gm only'}`]
    if (e.summary) fm.push(`summary: ${JSON.stringify(e.summary)}`)
    if (e.tags.length) fm.push(`tags: [${e.tags.map((t) => JSON.stringify(t)).join(', ')}]`)
    if (e.aliases?.length) fm.push(`aliases: [${e.aliases.map((t) => JSON.stringify(t)).join(', ')}]`)
    if (e.gmTags?.length) fm.push(`${GM_TAGS_KEY}: [${e.gmTags.map((t) => JSON.stringify(t)).join(', ')}]`)
    if (e.status) fm.push(`status: ${e.status}`)
    const parent = e.parentId && byId.get(e.parentId)
    if (parent) fm.push(`location: ${JSON.stringify(`[[${parent.name}]]`)}`)
    // GM-only details keep their mark, so importing this back in never shows them to players.
    for (const f of e.fields)
      if (f.key.trim() && !/^(type|tags|summary|status|location|visibility)$/i.test(f.key.trim()))
        fm.push(`${f.gm ? GM_PREFIX : ''}${f.key.trim().replace(/[:\n]/g, ' ')}: ${JSON.stringify(f.value)}`)
    let image = ''
    const asset = e.imageId ? await db.assets.get(e.imageId) : undefined
    if (asset) {
      const name = `${e.id.slice(0, 8)}-${safeFile(asset.name)}`
      files[`images/${name}`] = new Uint8Array(await asset.blob.arrayBuffer())
      image = `![[${name}]]\n\n`
    }
    // Pictures in the text go into the zip too, as Obsidian-style embeds.
    let body = e.body
    for (const m of e.body.matchAll(/!\[[^\]]*\]\(asset:([0-9a-fA-F-]{36})\)/g)) {
      const pic = await db.assets.get(m[1])
      if (!pic) continue
      const name = `${pic.id.slice(0, 8)}-${safeFile(pic.name)}`
      files[`images/${name}`] = new Uint8Array(await pic.blob.arrayBuffer())
      body = body.replace(m[0], `![[${name}]]`)
    }
    const parts = [`---\n${fm.join('\n')}\n---\n`, image, body]
    if (e.playerBody) parts.push(`\n\n## In the player’s words\n\n${e.playerBody}`)
    const rels = (e.relations ?? []).filter((r) => byId.has(r.to))
    if (rels.length) parts.push(`\n\n## Relationships\n\n${rels.map((r) => `- ${r.kind} [[${byId.get(r.to)!.name}]]${r.note ? ` (${r.note})` : ''}`).join('\n')}`)
    // Inside a :::gm block, so importing the export back in never turns GM notes into page text players can see.
    if (e.gmNotes) parts.push(`\n\n## GM notes\n\n${gmOnly(e.gmNotes)}`)
    files[file] = strToU8(parts.join(''))
  }
  const zip = zipSync(files, { level: 6 })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }))
  a.download = `${safeFile(world.name)}-markdown.zip`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
