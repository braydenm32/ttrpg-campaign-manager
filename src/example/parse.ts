import { parse as parseYaml, YAMLParseError } from 'yaml'
import type { CalDate, EntityType, LifeStatus, ThreadStatus, WorldCalendar } from '../db.ts'
import type { ExAge, ExampleContent, ExBoard, ExFoe, ExPage, ExSession, ExWorld } from './types.ts'

/**
 * Reads an example world written as Markdown files (see docs/EDITING.md):
 *
 *   world.md            the world itself: name, calendar, history ages, safety tools
 *   sessions/*.md       one file per session
 *   boards/*.md         one file per corkboard
 *   anything else .md   one page each, named by its key (people/varra.md is the page "varra")
 *
 * Each file opens with settings between two "---" lines, then the text. Lines like "== GM notes =="
 * start the other parts of the text. Everything is checked, and each problem names the file and
 * line, so a mistake shows up when the app is built rather than when someone opens the example.
 * Shared by the app, the build check in vite.config.ts and scripts/check-world.mjs, so it uses no
 * browser or Node features.
 */

export interface Problem {
  file: string
  line?: number
  message: string
  /** Errors stop the build; warnings are worth a look but nothing breaks. */
  level: 'error' | 'warning'
}

// Written as records so TypeScript complains if the app gains a value these don't list.
const TYPES = Object.keys({
  location: 1, npc: 1, pc: 1, faction: 1, item: 1, event: 1, quest: 1, shop: 1, deity: 1, lore: 1, thread: 1, table: 1, custom: 1,
} satisfies Record<EntityType, 1>)
const STATUS = Object.keys({ alive: 1, dead: 1, missing: 1, captured: 1 } satisfies Record<LifeStatus, 1>)
const QUEST = Object.keys({ open: 1, active: 1, done: 1, failed: 1 } satisfies Record<NonNullable<ExPage['questStatus']>, 1>)
const THREAD = Object.keys({ open: 1, active: 1, resolved: 1, dropped: 1 } satisfies Record<ThreadStatus, 1>)
const URGENCY = Object.keys({ low: 1, normal: 1, high: 1 } satisfies Record<NonNullable<ExPage['threadUrgency']>, 1>)
const SIDES: readonly ExFoe['side'][] = ['pc', 'ally', 'foe']
const ART = ['sil', 'crest', 'holy', 'item', 'handout', 'cover']

const PAGE_SETTINGS = [
  'type', 'name', 'players', 'summary', 'parent', 'aliases', 'tags', 'gmTags', 'image', 'status', 'statusKnown', 'age', 'when', 'date', 'order',
  'questStatus', 'threadStatus', 'threadUrgency', 'raisedIn', 'tiedOffIn', 'heldBy', 'quantity', 'template', 'fields', 'gmFields', 'relations', 'clocks',
]
const SESSION_SETTINGS = ['number', 'title', 'players', 'worldDate', 'pages', 'encounters', 'lectern']
const BOARD_SETTINGS = ['name', 'order', 'cards', 'strings']
const WORLD_SETTINGS = ['version', 'name', 'system', 'color', 'cover', 'campaign', 'calendar', 'ages', 'safety', 'partyCoin']

/** One file split into its settings, its main text and its "== Name ==" parts. */
interface Split {
  settings: Record<string, unknown>
  text: string
  parts: Map<string, string>
  /** The line each setting starts on, for pointing at mistakes. */
  lines: Map<string, number>
}

type Report = (message: string, setting?: string, level?: Problem['level']) => void

export function parseExampleFiles(files: Record<string, string>): { content: ExampleContent; problems: Problem[]; version: number } {
  const problems: Problem[] = []
  const pages: (ExPage & { file: string })[] = []
  const sessions: (ExSession & { file: string })[] = []
  const boards: (ExBoard & { file: string; order?: number })[] = []
  let world: ExWorld | undefined
  let version = 1
  // Pages that couldn't be read: their own mistake is reported, so references to them aren't.
  const unreadable = new Set<string>()

  const paths = Object.keys(files).sort()
  // The world goes first: dates on pages are read with its calendar.
  const worldPath = paths.find((p) => p === 'world.md')
  if (!worldPath) problems.push({ file: 'world.md', message: 'The world file is missing.', level: 'error' })
  const months = (() => {
    if (!worldPath) return []
    const split = splitFile(worldPath, files[worldPath], problems)
    if (!split) return []
    const report = reporter(worldPath, split, problems)
    const read = readWorld(split, report)
    world = read.world
    version = read.version
    return world?.calendar.months.map((m) => m.name) ?? []
  })()

  for (const file of paths) {
    if (file === worldPath || /(^|\/)readme\.md$/i.test(file) || !file.endsWith('.md')) continue
    const key = file.replace(/^.*\//, '').replace(/\.md$/, '')
    const split = splitFile(file, files[file], problems)
    const isPage = !file.startsWith('sessions/') && !file.startsWith('boards/')
    if (!split) {
      if (isPage) unreadable.add(key)
      continue
    }
    const report = reporter(file, split, problems)
    if (file.startsWith('sessions/')) {
      const s = readSession(split, report, months)
      if (s) sessions.push({ ...s, file })
    } else if (file.startsWith('boards/')) {
      const b = readBoard(split, report)
      if (b) boards.push({ ...b, file })
    } else {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(key))
        report(`The file name "${key}.md" can only use small letters, numbers and dashes (it becomes the page's key).`)
      const p = readPage(key, split, report, months)
      if (p) pages.push({ ...p, file })
      else unreadable.add(key)
    }
  }

  checkReferences(pages, sessions, boards, world, problems, unreadable)
  sessions.sort((a, b) => a.number - b.number)
  boards.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const strip = <T extends { file: string }>({ file: _file, ...rest }: T) => rest
  const content: ExampleContent = {
    world: world ?? blankWorld(),
    pages: pages.map(strip),
    sessions: sessions.map(strip),
    boards: boards.map(({ file: _file, order: _order, ...b }) => b),
  }
  return { content, problems, version }
}

/** Formats problems for a person to read: one line each, errors first. */
export function describeProblems(problems: Problem[], folder = ''): string {
  return [...problems]
    .sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1))
    .map((p) => `${p.level === 'error' ? 'ERROR' : 'warning'}  ${folder}${p.file}${p.line ? `, line ${p.line}` : ''}: ${p.message}`)
    .join('\n')
}

// ───────────────────────────── Files ─────────────────────────────

function splitFile(file: string, raw: string, problems: Problem[]): Split | undefined {
  // Windows saves lines ending \r\n, and some editors start a file with an invisible marker.
  const src = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const fail = (message: string, line?: number) => void problems.push({ file, line, message, level: 'error' })
  if (!src.startsWith('---\n')) return fail('The file must start with a line of three dashes (---), then its settings, then another --- line.', 1)
  const end = src.indexOf('\n---\n', 3)
  const close = end < 0 && src.endsWith('\n---') ? src.length - 4 : end
  if (close < 0) return fail('The settings at the top never end: add a line of three dashes (---) after them.', 1)
  const front = src.slice(4, close + 1)
  let settings: unknown
  try {
    settings = front.trim() ? parseYaml(front, { uniqueKeys: true }) : {}
  } catch (e) {
    if (e instanceof YAMLParseError) {
      const line = (e.linePos?.[0].line ?? 0) + 1
      return fail(`${yamlHint(e, front.split('\n')[line - 2] ?? '')}`, line)
    }
    throw e
  }
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return fail('The settings at the top should be lines like "name: Cinderford".', 2)

  // "#" after a space starts a comment, which silently cuts the text short ("the #1 rogue").
  // A real comment is written "# like this", with a space.
  front.split('\n').forEach((line, i) => {
    if (/^\s*#/.test(line) || /["']/.test(line)) return
    if (/\s#\S/.test(line)) problems.push({ file, line: i + 2, message: 'Everything after " #" on this line is ignored. If the # is part of the text, put the text in quotes.', level: 'warning' })
  })

  const lines = new Map<string, number>()
  front.split('\n').forEach((line, i) => {
    const m = line.match(/^([A-Za-z][\w ()]*):/)
    if (m && !lines.has(m[1])) lines.set(m[1], i + 2)
  })

  // The text after the settings, cut into parts at lines like "== GM notes ==".
  const bodyStart = close + 5
  const body = src.slice(bodyStart)
  const firstLine = src.slice(0, bodyStart).split('\n').length
  const parts = new Map<string, string>()
  let current = ''
  let buf: string[] = []
  const flush = () => void parts.set(current, buf.join('\n').trim())
  body.split('\n').forEach((line, i) => {
    const m = line.match(/^==\s*(.+?)\s*==\s*$/)
    if (!m) return void buf.push(line)
    flush()
    const name = m[1].toLowerCase()
    if (parts.has(name)) fail(`"== ${m[1]} ==" appears twice.`, firstLine + i)
    current = name
    lines.set(`== ${name}`, firstLine + i)
    buf = []
  })
  flush()
  checkSecrets(file, body, firstLine, problems)
  return { settings: settings as Record<string, unknown>, text: parts.get('') ?? '', parts, lines }
}

/** Turns the YAML library's message into advice. */
function yamlHint(e: YAMLParseError, line: string): string {
  const msg = e.message.split('\n')[0].replace(/ at line \d+, column \d+:?$/, '')
  if (e.code === 'TAB_AS_INDENT') return 'Indent with spaces, not tabs.'
  if (e.code === 'DUPLICATE_KEY') return `A setting appears twice (${msg}).`
  if (/mapping|BLOCK_AS_IMPLICIT_KEY/.test(msg + e.code) && /:\s/.test(line))
    return `This setting's text has a colon and a space in it. Put the whole text in "double quotes". (${msg})`
  if (e.code === 'MISSING_CHAR' || e.code === 'UNEXPECTED_TOKEN') return `Something is unfinished here, like a quote, [ or { that is never closed. (${msg})`
  return `The settings can't be read here: ${msg}`
}

/** Warns about :::gm or :::for passages that are never closed, since the rest of the page then stays secret. */
function checkSecrets(file: string, body: string, firstLine: number, problems: Problem[]) {
  const opener = /^[ \t]*:::[ \t]*(foryou|gm|for)(?![a-z0-9])(.*)$/i
  const closer = /^[ \t]*:::[ \t]*$/
  const open: number[] = []
  body.split('\n').forEach((line, i) => {
    const m = line.match(opener)
    if (m) {
      // A passage written on one line (":::gm::: text :::") closes itself.
      if (!/:::[ \t]*$/.test(m[2]) || !m[2].trim()) open.push(firstLine + i)
    } else if (closer.test(line)) {
      if (open.length) open.pop()
      else problems.push({ file, line: firstLine + i, message: 'A closing ::: line with no :::gm or :::for above it.', level: 'warning' })
    }
  })
  for (const line of open)
    problems.push({ file, line, message: 'This secret passage is never closed with a ::: line, so everything after it is hidden from players too.', level: 'warning' })
}

function reporter(file: string, split: Split, problems: Problem[]): Report {
  return (message, setting, level = 'error') => problems.push({ file, line: setting ? split.lines.get(setting) : undefined, message, level })
}

// ───────────────────────────── Reading values ─────────────────────────────

/** Reads settings one by one, complaining about anything misspelt or of the wrong kind. */
function reader(split: Split, report: Report, known: string[]) {
  const s = split.settings
  for (const key of Object.keys(s)) {
    if (known.includes(key)) continue
    const near = nearest(key, known)
    report(`Unknown setting "${key}".${near ? ` Did you mean "${near}"?` : ''}`, key)
  }
  const text = (key: string, required = false): string | undefined => {
    const v = s[key]
    if (v === undefined || v === null) {
      if (required) report(`"${key}" is missing.`)
      return undefined
    }
    if (typeof v === 'string') return v
    if (typeof v === 'number' || typeof v === 'boolean') return String(v)
    report(`"${key}" should be plain text.`, key)
    return undefined
  }
  const yes = (key: string): boolean | undefined => {
    const v = s[key]
    if (v === undefined || v === null) return undefined
    if (typeof v === 'boolean') return v
    if (v === 'yes' || v === 'no') return v === 'yes'
    report(`"${key}" should be true or false.`, key)
    return undefined
  }
  const num = (key: string, required = false): number | undefined => {
    const v = s[key]
    if (v === undefined || v === null) {
      if (required) report(`"${key}" is missing.`)
      return undefined
    }
    if (typeof v === 'number' && Number.isFinite(v)) return v
    report(`"${key}" should be a number.`, key)
    return undefined
  }
  const list = (key: string): string[] | undefined => {
    const v = s[key]
    if (v === undefined || v === null) return undefined
    if (typeof v === 'string') return [v]
    if (Array.isArray(v) && v.every((x) => typeof x === 'string' || typeof x === 'number')) return v.map(String)
    report(`"${key}" should be a list, like [one, two].`, key)
    return undefined
  }
  const oneOf = <T extends string>(key: string, options: readonly T[]): T | undefined => {
    const v = text(key)
    if (v === undefined) return undefined
    if ((options as readonly string[]).includes(v)) return v as T
    report(`"${key}" can be ${options.join(', ')}, not "${v}".`, key)
    return undefined
  }
  const records = (key: string): Record<string, unknown>[] | undefined => {
    const v = s[key]
    if (v === undefined || v === null) return undefined
    if (Array.isArray(v) && v.every((x) => x && typeof x === 'object' && !Array.isArray(x))) return v as Record<string, unknown>[]
    report(`"${key}" should be a list of entries, each starting with "- ".`, key)
    return undefined
  }
  return { s, text, yes, num, list, oneOf, records }
}

/** Checks one entry of a list (a relation, a foe) has the right parts. */
function entry<T>(rec: unknown, where: string, setting: string, report: Report, spec: Record<string, 'text' | 'text?' | 'num' | 'num?' | 'yes?'>): T | undefined {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
    report(`${where} should be written like { ${Object.keys(spec).filter((k) => !spec[k].endsWith('?')).map((k) => `${k}: …`).join(', ')} }.`, setting)
    return undefined
  }
  for (const k of Object.keys(rec)) {
    if (k in spec) continue
    const near = nearest(k, Object.keys(spec))
    report(`${where}: unknown part "${k}".${near ? ` Did you mean "${near}"?` : ''}`, setting)
  }
  const out: Record<string, string | number | boolean | undefined> = {}
  let ok = true
  for (const [k, kind] of Object.entries(spec)) {
    const v = (rec as Record<string, unknown>)[k]
    const optional = kind.endsWith('?')
    if (v === undefined || v === null) {
      if (!optional) {
        report(`${where}: "${k}" is missing.`, setting)
        ok = false
      }
      continue
    }
    const want = kind.startsWith('text') ? 'plain text' : kind.startsWith('num') ? 'a number' : 'true or false'
    if (kind.startsWith('text') && (typeof v === 'string' || typeof v === 'number')) out[k] = String(v)
    else if (kind.startsWith('num') && typeof v === 'number') out[k] = v
    else if (kind === 'yes?' && typeof v === 'boolean') out[k] = v
    else {
      ok = false
      report(`${where}: "${k}" should be ${want}.`, setting)
    }
  }
  return ok ? (out as T) : undefined
}

/** Reads "14 Ashfall 3011" (or "14 9 3011") with the world's month names. */
function readDate(v: unknown, months: string[], setting: string, report: Report): CalDate | undefined {
  if (v === undefined || v === null) return undefined
  const m = String(v).trim().match(/^(\d{1,3})\s+(.+?)\s+(-?\d+)$/)
  const fail = () => void report(`"${setting}" should be a date like "14 Ashfall 3011" (day, month, year).`, setting)
  if (!m) return fail()
  const day = Number(m[1])
  const name = m[2].toLowerCase()
  const month = /^\d+$/.test(name) ? Number(name) : months.findIndex((n) => n.toLowerCase() === name) + 1
  if (month < 1 || (months.length && month > months.length)) {
    report(`"${setting}": no month called "${m[2]}". The months are ${months.join(', ')}.`, setting)
    return undefined
  }
  if (day < 1) return fail()
  return { year: Number(m[3]), month, day }
}

/** "- one" lines, as written under "== Entries ==" or "== Scenes ==". */
function listLines(text: string | undefined): string[] | undefined {
  if (text === undefined) return undefined
  return text
    .split('\n')
    .map((l) => l.replace(/^\s*[-*]\s+/, '').trim())
    .filter(Boolean)
}

function checkParts(split: Split, report: Report, allowed: string[]) {
  for (const name of split.parts.keys()) {
    if (name === '' || allowed.includes(name)) continue
    report(`Unknown part "== ${name} ==". This file can have: ${allowed.map((a) => `== ${a} ==`).join(', ') || 'no parts'}.`, `== ${name}`)
  }
}

// ───────────────────────────── Pages, sessions, boards, world ─────────────────────────────

function readPage(key: string, split: Split, report: Report, months: string[]): ExPage | undefined {
  const r = reader(split, report, PAGE_SETTINGS)
  checkParts(split, report, ['gm notes', 'entries'])
  const type = r.text('type', true)
  if (type && !TYPES.includes(type)) report(`"type" can be ${TYPES.join(', ')}, not "${type}".`, 'type')
  const name = r.text('name', true)
  if (!type || !TYPES.includes(type) || !name) return undefined

  const fields: NonNullable<ExPage['fields']> = []
  for (const [setting, gm] of [['fields', false], ['gmFields', true]] as const) {
    const v = r.s[setting]
    if (v === undefined || v === null) continue
    if (typeof v !== 'object' || Array.isArray(v)) {
      report(`"${setting}" should be lines like "Ancestry: Orc", indented under it.`, setting)
      continue
    }
    for (const [k, value] of Object.entries(v)) {
      if (value !== null && typeof value === 'object') report(`"${setting}": "${k}" should be plain text.`, setting)
      else fields.push({ key: k, value: value === null ? '' : String(value), ...(gm ? { gm: true } : {}) })
    }
  }

  const relations = r.records('relations')?.flatMap((rec, i) => {
    const e = entry<NonNullable<ExPage['relations']>[number]>(rec, `relation ${i + 1}`, 'relations', report, { to: 'text', kind: 'text', note: 'text?', known: 'yes?' })
    return e ? [e] : []
  })
  const clocks = r.records('clocks')?.flatMap((rec, i) => {
    const e = entry<NonNullable<ExPage['clocks']>[number]>(rec, `clock ${i + 1}`, 'clocks', report, { name: 'text', segments: 'num', filled: 'num', known: 'yes?' })
    return e ? [e] : []
  })
  const image = r.text('image')
  if (image && !ART.includes(image.split(':')[0]))
    report(`"image": pictures start with ${ART.map((a) => `${a}:`).join(', ')} (or are "cover").`, 'image', 'warning')
  if (type !== 'table' && split.parts.has('entries')) report('Only random tables have "== Entries ==".', '== entries')
  const page: ExPage = {
    key,
    type: type as EntityType,
    name,
    summary: r.text('summary'),
    body: split.text || undefined,
    gmNotes: split.parts.get('gm notes') || undefined,
    players: r.yes('players'),
    parent: r.text('parent'),
    tags: r.list('tags'),
    gmTags: r.list('gmTags'),
    fields: fields.length ? fields : undefined,
    aliases: r.list('aliases'),
    image,
    status: r.oneOf('status', STATUS as LifeStatus[]),
    statusKnown: r.yes('statusKnown'),
    relations,
    clocks,
    age: r.text('age'),
    when: readDate(r.s.when, months, 'when', report),
    date: r.text('date'),
    order: r.num('order'),
    questStatus: r.oneOf('questStatus', QUEST as NonNullable<ExPage['questStatus']>[]),
    threadStatus: r.oneOf('threadStatus', THREAD as ThreadStatus[]),
    threadUrgency: r.oneOf('threadUrgency', URGENCY as NonNullable<ExPage['threadUrgency']>[]),
    raisedIn: r.num('raisedIn'),
    tiedOffIn: r.num('tiedOffIn'),
    entries: listLines(split.parts.get('entries')),
    heldBy: r.text('heldBy'),
    quantity: r.num('quantity'),
    template: r.yes('template'),
  }
  if (type === 'event' && page.order === undefined)
    report('Timeline events need an "order" (a number): events in the same part of history are shown smallest first.', undefined, 'warning')
  if (type !== 'event' && (page.age || page.when || page.date || page.order !== undefined))
    report('"age", "when", "date" and "order" only do anything on events (type: event).', undefined, 'warning')
  // Leave out what wasn't written, so the loader's defaults apply.
  for (const k of Object.keys(page) as (keyof ExPage)[]) if (page[k] === undefined) delete page[k]
  return page
}

function readSession(split: Split, report: Report, months: string[]): ExSession | undefined {
  const r = reader(split, report, SESSION_SETTINGS)
  checkParts(split, report, ['recap', 'strong start', 'scenes', 'clues', 'lectern'])
  const number = r.num('number', true)
  const title = r.text('title', true)
  if (number === undefined || !title) return undefined
  const encounters = r.records('encounters')?.flatMap((rec, i) => {
    const where = `encounter ${i + 1}`
    const { foes: foesRaw = [], ...rest } = rec
    const e = entry<{ name: string; notes?: string }>(rest, where, 'encounters', report, { name: 'text', notes: 'text?' })
    if (!Array.isArray(foesRaw)) return report(`${where}: "foes" should be a list.`, 'encounters'), []
    const foes = foesRaw.flatMap((f, j) => {
      const foe = entry<ExFoe>(f, `${where}, foe ${j + 1}`, 'encounters', report, { name: 'text', count: 'num', hp: 'num?', ac: 'text?', side: 'text', page: 'text?' })
      if (foe && !SIDES.includes(foe.side)) report(`${where}, foe ${j + 1}: "side" can be ${SIDES.join(', ')}.`, 'encounters')
      return foe ? [foe] : []
    })
    return e ? [{ name: e.name, notes: e.notes ?? '', foes }] : []
  })
  const lecternRaw = r.s.lectern
  let lectern: ExSession['lectern']
  if (lecternRaw !== undefined || split.parts.has('lectern')) {
    const rec = lecternRaw && typeof lecternRaw === 'object' && !Array.isArray(lecternRaw) ? (lecternRaw as Record<string, unknown>) : {}
    if (lecternRaw !== undefined && lecternRaw !== rec) report('"lectern" should have "scene" and "present" indented under it.', 'lectern')
    const present = rec.present
    if (present !== undefined && !Array.isArray(present)) report('"lectern": "present" should be a list of page keys.', 'lectern')
    lectern = { scene: rec.scene === undefined ? undefined : String(rec.scene), sceneText: split.parts.get('lectern') ?? '', present: Array.isArray(present) ? present.map(String) : undefined }
  }
  const strongStart = split.parts.get('strong start')
  const scenes = listLines(split.parts.get('scenes'))
  const clues = listLines(split.parts.get('clues'))
  const hasPrep = strongStart !== undefined || scenes || clues || encounters?.length
  return {
    number,
    title,
    players: r.yes('players'),
    worldDate: readDate(r.s.worldDate, months, 'worldDate', report),
    notes: split.text,
    recap: split.parts.get('recap'),
    pages: r.list('pages'),
    prep: hasPrep ? { strongStart: strongStart ?? '', scenes: scenes ?? [], clues: clues ?? [], encounters: encounters ?? [] } : undefined,
    lectern,
  }
}

function readBoard(split: Split, report: Report): (ExBoard & { order?: number }) | undefined {
  const r = reader(split, report, BOARD_SETTINGS)
  checkParts(split, report, [])
  const name = r.text('name', true)
  if (!name) return undefined
  const cards = (r.records('cards') ?? []).flatMap((rec, i) => {
    const e = entry<ExBoard['cards'][number]>(rec, `card ${i + 1}`, 'cards', report, { key: 'text', x: 'num', y: 'num', page: 'text?', text: 'text?', color: 'text?' })
    return e ? [e] : []
  })
  const strings = (r.records('strings') ?? []).flatMap((rec, i) => {
    const e = entry<ExBoard['strings'][number]>(rec, `string ${i + 1}`, 'strings', report, { from: 'text', to: 'text', label: 'text?' })
    if (!e) return []
    for (const end of [e.from, e.to]) if (!cards.some((c) => c.key === end)) report(`string ${i + 1}: no card with key "${end}" on this board.`, 'strings')
    return [e]
  })
  return { name, order: r.num('order'), cards, strings }
}

function readWorld(split: Split, report: Report): { world?: ExWorld; version: number } {
  const r = reader(split, report, WORLD_SETTINGS)
  checkParts(split, report, [])
  const version = r.num('version') ?? 1
  const name = r.text('name', true)
  const obj = (key: string) => {
    const v = r.s[key]
    if (v === undefined || v === null) return {}
    if (typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
    report(`"${key}" should have its settings indented under it.`, key)
    return {}
  }
  const strs = (v: unknown, where: string, key: string) => {
    if (v === undefined) return []
    if (Array.isArray(v)) return v.map(String)
    report(`${where} should be a list.`, key)
    return []
  }

  const cal = obj('calendar')
  const months = (Array.isArray(cal.months) ? (cal.months as unknown[]) : []).flatMap((m, i) => {
    const e = entry<WorldCalendar['months'][number]>(m, `calendar: month ${i + 1}`, 'calendar', report, { name: 'text', days: 'num' })
    return e ? [e] : []
  })
  if (!months.length) report('calendar: "months" needs at least one month.', 'calendar')
  const moons = (Array.isArray(cal.moons) ? (cal.moons as unknown[]) : []).flatMap((m, i) => {
    const e = entry<WorldCalendar['moons'][number]>(m, `calendar: moon ${i + 1}`, 'calendar', report, { name: 'text', cycle: 'num', offset: 'num' })
    return e ? [e] : []
  })
  const today = readDate(cal.today, months.map((m) => m.name), 'calendar', report)
  for (const k of Object.keys(cal))
    if (!['preset', 'months', 'weekdays', 'era', 'moons', 'weekdayOffset', 'today'].includes(k)) report(`calendar: unknown setting "${k}".`, 'calendar')
  const calendar: WorldCalendar = {
    preset: cal.preset === undefined ? undefined : String(cal.preset),
    months,
    weekdays: strs(cal.weekdays, 'calendar: "weekdays"', 'calendar'),
    era: cal.era === undefined ? '' : String(cal.era),
    moons,
    weekdayOffset: typeof cal.weekdayOffset === 'number' ? cal.weekdayOffset : undefined,
    // The app counts months from 0.
    today: today && { ...today, month: today.month - 1 },
  }

  const ages = (r.records('ages') ?? []).flatMap((rec, i) => {
    const e = entry<ExAge>(rec, `age ${i + 1}`, 'ages', report, { key: 'text', name: 'text', span: 'text?', summary: 'text?' })
    return e ? [e] : []
  })
  const safetyRaw = r.s.safety === undefined ? undefined : obj('safety')
  const camp = obj('campaign')
  const partyCoin = r.records('partyCoin')?.flatMap((rec, i) => {
    const e = entry<NonNullable<ExWorld['partyCoin']>[number]>(rec, `coin ${i + 1}`, 'partyCoin', report, { name: 'text', amount: 'num' })
    return e ? [e] : []
  })
  if (!camp.name) report('campaign: "name" is missing.', 'campaign')
  if (!name) return { version }
  return {
    version,
    world: {
      name,
      description: split.text,
      system: r.text('system') ?? '',
      color: r.text('color'),
      cover: r.text('cover'),
      calendar,
      ages,
      safety: safetyRaw && {
        lines: strs(safetyRaw.lines, 'safety: "lines"', 'safety'),
        veils: strs(safetyRaw.veils, 'safety: "veils"', 'safety'),
        notes: safetyRaw.notes === undefined ? '' : String(safetyRaw.notes),
        xcard: safetyRaw.xcard === true,
      },
      partyCoin,
      campaign: { name: String(camp.name ?? ''), description: String(camp.description ?? '') },
    },
  }
}

function blankWorld(): ExWorld {
  return { name: 'Example', description: '', system: '', calendar: { months: [], weekdays: [], era: '', moons: [] }, ages: [], campaign: { name: 'Campaign', description: '' } }
}

// ───────────────────────────── Across files ─────────────────────────────

function checkReferences(
  pages: (ExPage & { file: string })[],
  sessions: (ExSession & { file: string })[],
  boards: (ExBoard & { file: string })[],
  world: ExWorld | undefined,
  problems: Problem[],
  unreadable: Set<string>,
) {
  const err = (file: string, message: string, level: Problem['level'] = 'error') => void problems.push({ file, message, level })
  const byKey = new Map<string, string>()
  for (const p of pages) {
    const other = byKey.get(p.key)
    if (other) err(p.file, `Two pages have the key "${p.key}" (also ${other}). Rename one of the files.`)
    else byKey.set(p.key, p.file)
  }
  const page = (file: string, key: string | undefined, what: string) => {
    if (key && !byKey.has(key) && !unreadable.has(key)) err(file, `${what}: no page with the key "${key}".${suggest(key, [...byKey.keys()])}`)
  }
  const ages = new Set(world?.ages.map((a) => a.key))
  const numbers = new Set<number>()
  for (const s of sessions) {
    if (numbers.has(s.number)) err(s.file, `Two sessions are number ${s.number}.`)
    numbers.add(s.number)
  }
  for (const p of pages) {
    page(p.file, p.parent, '"parent"')
    for (const [i, rel] of (p.relations ?? []).entries()) page(p.file, rel.to, `relation ${i + 1}`)
    if (p.heldBy !== 'party') page(p.file, p.heldBy, '"heldBy"')
    if (p.parent === p.key) err(p.file, 'A page can\'t sit inside itself ("parent" is its own key).')
    if (p.age && p.age !== 'campaign' && !ages.has(p.age))
      err(p.file, `"age": no age with the key "${p.age}". The ages in world.md are ${[...ages].join(', ')}, or use "campaign" for something that happens in play.`)
    for (const n of [p.raisedIn, p.tiedOffIn]) if (n !== undefined && !numbers.has(n)) err(p.file, `There is no session number ${n}.`)
  }
  // A loop of parents (a town inside a region inside the town) would hang the sidebar.
  for (const p of pages) {
    const seen = new Set([p.key])
    let at = pages.find((q) => q.key === p.parent)
    while (at) {
      if (seen.has(at.key)) {
        err(p.file, `"parent" goes round in a circle: ${[...seen].join(' → ')} → ${at.key}.`)
        break
      }
      seen.add(at.key)
      at = pages.find((q) => q.key === at!.parent)
    }
  }
  for (const s of sessions) {
    for (const k of s.pages ?? []) page(s.file, k, '"pages"')
    for (const enc of s.prep?.encounters ?? []) for (const f of enc.foes) page(s.file, f.page, `encounter "${enc.name}"`)
    page(s.file, s.lectern?.scene, 'lectern "scene"')
    for (const k of s.lectern?.present ?? []) page(s.file, k, 'lectern "present"')
  }
  for (const b of boards) for (const c of b.cards) page(b.file, c.page, `card "${c.key}"`)

  // [[Links]] go by name or alias. A link to a page nobody has written yet is allowed, so only warn.
  // Until every page can be read, the names aren't all known, so this waits.
  if (unreadable.size) return
  const names = new Set(pages.flatMap((p) => [p.name, ...(p.aliases ?? [])]).map((n) => n.trim().toLowerCase()))
  const linkCheck = (file: string, text: string | undefined) => {
    for (const m of (text ?? '').matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
      const name = m[1].trim()
      if (!names.has(name.toLowerCase())) err(file, `The link [[${name}]] has no page with that name or alias.`, 'warning')
    }
  }
  for (const p of pages) [p.body, p.gmNotes, p.summary, ...(p.entries ?? [])].forEach((t) => linkCheck(p.file, t))
  for (const s of sessions) [s.notes, s.recap, s.prep?.strongStart, ...(s.prep?.scenes ?? []), ...(s.prep?.clues ?? []), s.lectern?.sceneText].forEach((t) => linkCheck(s.file, t))
}

/** How many letters must change to turn one word into the other, ignoring capitals. */
function distance(a: string, b: string): number {
  a = a.toLowerCase()
  b = b.toLowerCase()
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

/** The closest of `options` to a misspelt word, if any is only a slip or two away. */
function nearest(word: string, options: string[]): string | undefined {
  let best: string | undefined
  let bestD = 3
  for (const o of options) {
    const d = distance(word, o)
    if (d < bestD) [best, bestD] = [o, d]
  }
  return best
}

function suggest(key: string, keys: string[]): string {
  const near = nearest(key, keys)
  return near ? ` Did you mean "${near}"?` : ''
}
