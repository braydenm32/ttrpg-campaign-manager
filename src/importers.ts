import { strToU8, unzipSync, zipSync } from 'fflate'
import { blankEntity, db, ENTITY_LABELS, newId, typeLabel, type Entity, type EntityType } from './db'
import { saveFileAsAsset } from './hooks'

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
  fields: { key: string; value: string }[]
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

/** Every file picked (folders keep their paths), with .zip files opened up. */
export async function readFiles(list: File[]): Promise<Map<string, Blob>> {
  const out = new Map<string, Blob>()
  for (const f of list) {
    const path = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name
    if (/\.zip$/i.test(f.name)) {
      const files = unzipSync(new Uint8Array(await f.arrayBuffer()))
      for (const [p, data] of Object.entries(files)) if (!p.endsWith('/')) out.set(p, new Blob([data as BlobPart], { type: mimeOf(p) }))
    } else out.set(path, f)
  }
  return out
}

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

/** Obsidian's extras turned into ours: tidy [[links]], %%comments%% as GM-only, embedded pictures pulled out. */
function convertObsidian(body: string, images: string[]) {
  return body
    .replace(/%%([\s\S]*?)%%/g, (_m, inner: string) => `\n:::gm\n${inner.trim()}\n:::\n`)
    .replace(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, (_m, file: string) => (isImage(file) ? (images.push(file.trim()), '') : ''))
    .replace(/!\[[^\]]*\]\(([^)]+)\)/g, (m, file: string) => (/^https?:/.test(file) ? m : (images.push(decodeURIComponent(file.trim())), '')))
    .replace(/\[\[([^\]|#]*)(#[^\]|]*)?(\|[^\]]*)?\]\]/g, (_m, name: string, _h, alias?: string) => `[[${name.split('/').pop()!.trim()}${alias ?? ''}]]`)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const SKIP_KEYS = new Set(['title', 'name', 'tags', 'tag', 'type', 'aliases', 'alias', 'summary', 'description', 'cssclass', 'cssclasses', 'publish', 'location', 'parent', 'located in', 'image', 'status'])

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
    const { data, body } = frontmatter(await blob.text())
    const images: string[] = []
    const text = convertObsidian(body, images)
    const folders = path.split('/').slice(0, -1).reverse()
    const name = (typeof data.title === 'string' && data.title) || (typeof data.name === 'string' && data.name) || baseName(path).replace(/\.(md|markdown)$/i, '')
    const imageName = linkName(data.image) ?? images[0]
    const imageBlob = imageName ? byName.get(baseName(imageName).toLowerCase()) : undefined
    const fields = Object.entries(data)
      .filter(([k, v]) => !SKIP_KEYS.has(k) && (typeof v === 'string' ? v.trim() : v.length))
      .map(([k, v]) => ({ key: k[0].toUpperCase() + k.slice(1), value: Array.isArray(v) ? v.join(', ') : v }))
    const tags = [...asList(data.tags), ...asList(data.tag)].map((t) => t.replace(/^#/, ''))
    pages.push({
      key: path,
      name: name.trim(),
      type: guessType(typeof data.type === 'string' ? data.type : undefined, ...folders, ...tags),
      summary: typeof data.summary === 'string' ? data.summary : typeof data.description === 'string' ? data.description : '',
      body: text,
      tags,
      fields,
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
const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')

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
  const pages = raw.map(({ folder, o }) => {
    const ent = (o.entity as Json | undefined) ?? {}
    const entry = str(o.entry) || str(ent.entry)
    const body = htmlToMarkdown(
      entry.replace(/\[(\w+):(\d+)(?:\|([^\]]+))?\]/g, (_m, _t, id: string, text?: string) => {
        const name = names.get(id)
        return name ? (text && text !== name ? `[[${name}|${text}]]` : `[[${name}]]`) : (text ?? '')
      }),
    )
    const tags = ((ent.tags ?? o.tags ?? []) as unknown[]).map((t) => (typeof t === 'string' ? t : str((t as Json)?.name))).filter(Boolean)
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
      key: `${folder}:${str(o.id)}`,
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

/** World Anvil's BBCode to Markdown: headings, bold, links, lists, quotes; mentions become [[links]], secrets GM-only. */
export function bbcodeToMarkdown(text: string): string {
  // Mentions become links, held aside as placeholders so the tag clean-up at the end can't touch them.
  const links: string[] = []
  let s = text.replace(/\r\n/g, '\n')
  s = s
    .replace(/@\[([^\]]+)\]\([^)]*\)/g, (_m, name: string) => `\uE000${links.push(name) - 1}\uE000`)
    .replace(/\[h(\d)\]([\s\S]*?)\[\/h\d\]/gi, (_m, n: string, t: string) => `\n\n${'#'.repeat(Math.min(6, Number(n) + 1))} ${t.trim()}\n\n`)
    .replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '**$1**')
    .replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '*$1*')
    .replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '~~$1~~')
    .replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '$1')
    .replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, '[$2]($1)')
    .replace(/\[url\]([\s\S]*?)\[\/url\]/gi, '$1')
    .replace(/\[img[^\]]*\][\s\S]*?\[\/img\]/gi, '')
    .replace(/\[(?:quote|aloud)[^\]]*\]([\s\S]*?)\[\/(?:quote|aloud)\]/gi, (_m, t: string) => `\n\n${t.trim().split('\n').map((l) => `> ${l}`).join('\n')}\n\n`)
    .replace(/\[(?:spoiler|gm)[^\]]*\]([\s\S]*?)\[\/(?:spoiler|gm)\]/gi, (_m, t: string) => `\n:::gm\n${t.trim()}\n:::\n`)
    .replace(/\[secret:[^\]]*\]/gi, '')
    .replace(/\[li\]([\s\S]*?)(?:\[\/li\]|(?=\[li\])|(?=\[\/[uo]l\]))/gi, (_m, t: string) => `\n- ${t.trim()}`)
    .replace(/\[\/?(?:ul|ol|list)\]/gi, '\n')
    .replace(/\[br\]/gi, '\n')
    .replace(/\[\/?p\]/gi, '\n\n')
    .replace(/\[\/?[a-z][\w-]*(?:[:=][^\]]*)?\]/gi, '')
    .replace(/\uE000(\d+)\uE000/g, (_m, i: string) => `[[${links[Number(i)]}]]`)
  return s
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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
    for (const item of list) {
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
        key: str(o.id) || path,
        name: title.trim(),
        type: guessType(template, ...path.split('/').slice(0, -1).reverse()),
        summary: bbcodeToMarkdown(str(o.excerpt)).replace(/\s+/g, ' ').slice(0, 300),
        body,
        tags,
        fields: WA_FIELDS.filter(([k]) => str(o[k]).trim()).map(([k, label]) => ({ key: label, value: bbcodeToMarkdown(str(o[k])) })),
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
  const idByKey = new Map<string, string>()
  const idByName = new Map(existing.map((e) => [e.name.trim().toLowerCase(), e.id]))
  for (const p of pages) {
    const id = newId()
    idByKey.set(p.key, id)
    if (!idByName.has(p.name.toLowerCase())) idByName.set(p.name.toLowerCase(), id)
  }
  const now = Date.now()
  const rows: Entity[] = []
  for (const [i, p] of pages.entries()) {
    const e = blankEntity(worldId, p.type, p.name || 'Untitled')
    e.id = idByKey.get(p.key)!
    e.summary = p.summary
    e.body = p.body
    e.tags = [...new Set(p.tags)]
    e.fields = p.fields
    if (p.status) e.status = p.status
    if (p.type === 'event') e.eventOrder = now + i
    const parent = p.parent && (idByKey.get(p.parent) ?? idByName.get(p.parent.toLowerCase()))
    if (parent && parent !== e.id) e.parentId = parent
    if (p.image) e.imageId = await saveFileAsAsset(worldId, p.image.blob, p.image.name, [p.name])
    rows.push(e)
  }
  await db.entities.bulkAdd(rows)
  return rows.length
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
    if (e.status) fm.push(`status: ${e.status}`)
    const parent = e.parentId && byId.get(e.parentId)
    if (parent) fm.push(`location: ${JSON.stringify(`[[${parent.name}]]`)}`)
    for (const f of e.fields) if (f.key.trim() && !/^(type|tags|summary|status|location|visibility)$/i.test(f.key.trim())) fm.push(`${f.key.trim().replace(/[:\n]/g, ' ')}: ${JSON.stringify(f.value)}`)
    let image = ''
    const asset = e.imageId ? await db.assets.get(e.imageId) : undefined
    if (asset) {
      const name = `${e.id.slice(0, 8)}-${safeFile(asset.name)}`
      files[`images/${name}`] = new Uint8Array(await asset.blob.arrayBuffer())
      image = `![[${name}]]\n\n`
    }
    const parts = [`---\n${fm.join('\n')}\n---\n`, image, e.body]
    if (e.playerBody) parts.push(`\n\n## In the player’s words\n\n${e.playerBody}`)
    const rels = (e.relations ?? []).filter((r) => byId.has(r.to))
    if (rels.length) parts.push(`\n\n## Relationships\n\n${rels.map((r) => `- ${r.kind} [[${byId.get(r.to)!.name}]]${r.note ? ` (${r.note})` : ''}`).join('\n')}`)
    if (e.gmNotes) parts.push(`\n\n## GM notes\n\n${e.gmNotes}`)
    files[file] = strToU8(parts.join(''))
  }
  const zip = zipSync(files, { level: 6 })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }))
  a.download = `${safeFile(world.name)}-markdown.zip`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
