import { Lexer, type Token, type Tokens } from 'marked'
import { Fragment, type Mark, type Node as PMNode, Schema } from 'prosemirror-model'
import { CLOSER, forNames, readOpener, splitSecrets } from '../secretText.ts'

/**
 * The formatted editor's two-way door between the app's Markdown text and the document the GM edits.
 * No screen code here (it runs in the browser tests' Node side too).
 *
 * Storage never changes: a page is still the same Markdown text. So this is built to be lossless:
 *  - Reading: the text is cut into blocks (paragraphs, headings, lists, GM-only passages…), and each
 *    block remembers the exact text it came from.
 *  - Writing: a block nobody touched is written back as that exact text, byte for byte. Only a block
 *    that was edited is written afresh, so editing one paragraph never reformats the rest.
 *  - Anything the editor can't show faithfully (raw HTML, footnote-style link definitions, a list
 *    that starts with a code block…) becomes a "plain block" that holds its Markdown as typed.
 *  - Secret passages (":::gm", ":::for Name") are read line by line with the same readOpener and
 *    CLOSER as the page view and the server. Written text is checked with the app's own
 *    splitSecrets before it is handed back: see serializeMarkdown.
 */

// ---------------------------------------------------------------------------------------------
// The document's shape
// ---------------------------------------------------------------------------------------------

/** Where a block came from in the text (see Sources): only blocks directly in the text or in a passage have one. */
const sid = { sid: { default: null } }

export const schema = new Schema({
  nodes: {
    doc: { content: '(block | secret)+' },
    paragraph: { group: 'block', content: 'inline*', attrs: sid, parseDOM: [{ tag: 'p' }], toDOM: () => ['p', 0] },
    heading: {
      group: 'block',
      content: 'inline*',
      defining: true,
      attrs: { level: { default: 2 }, ...sid },
      parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({ tag: `h${level}`, attrs: { level } })),
      toDOM: (n) => [`h${n.attrs.level}`, 0],
    },
    blockquote: { group: 'block', content: 'block+', defining: true, attrs: sid, parseDOM: [{ tag: 'blockquote' }], toDOM: () => ['blockquote', 0] },
    bullet_list: {
      group: 'block',
      content: 'list_item+',
      attrs: { bullet: { default: '-' }, tight: { default: true }, ...sid },
      parseDOM: [{ tag: 'ul' }],
      toDOM: () => ['ul', 0],
    },
    ordered_list: {
      group: 'block',
      content: 'list_item+',
      attrs: { start: { default: 1 }, delim: { default: '.' }, tight: { default: true }, ...sid },
      parseDOM: [{ tag: 'ol', getAttrs: (el) => ({ start: Number((el as HTMLElement).getAttribute('start')) || 1 }) }],
      toDOM: (n) => (n.attrs.start === 1 ? ['ol', 0] : ['ol', { start: n.attrs.start }, 0]),
    },
    list_item: {
      content: 'paragraph block*',
      defining: true,
      // A "- [x]" line: true or false; null for an ordinary line.
      attrs: { checked: { default: null } },
      parseDOM: [{ tag: 'li' }],
      toDOM: (n) => (n.attrs.checked === null ? ['li', 0] : ['li', { 'data-checked': String(n.attrs.checked) }, 0]),
    },
    code_block: {
      group: 'block',
      content: 'text*',
      marks: '',
      code: true,
      defining: true,
      attrs: { lang: { default: '' }, ...sid },
      parseDOM: [{ tag: 'pre:not(.pm-raw)', preserveWhitespace: 'full' }],
      toDOM: () => ['pre', ['code', 0]],
    },
    horizontal_rule: { group: 'block', attrs: sid, parseDOM: [{ tag: 'hr' }], toDOM: () => ['hr'] },
    table: {
      group: 'block',
      content: 'table_row+',
      isolating: true,
      attrs: { align: { default: [] }, ...sid },
      parseDOM: [{ tag: 'table' }],
      toDOM: () => ['table', ['tbody', 0]],
    },
    table_row: { content: 'table_cell+', parseDOM: [{ tag: 'tr' }], toDOM: () => ['tr', 0] },
    table_cell: {
      content: '(text | wikilink | image)*',
      isolating: true,
      attrs: { header: { default: false } },
      parseDOM: [
        { tag: 'td', attrs: { header: false } },
        { tag: 'th', attrs: { header: true } },
      ],
      toDOM: (n) => [n.attrs.header ? 'th' : 'td', 0],
    },
    // Markdown the editor keeps exactly as typed, shown as a plain block.
    raw_block: {
      group: 'block',
      content: 'text*',
      marks: '',
      code: true,
      defining: true,
      attrs: sid,
      parseDOM: [{ tag: 'pre.pm-raw', preserveWhitespace: 'full' }],
      toDOM: () => ['pre', { class: 'pm-raw', spellcheck: 'false' }, 0],
    },
    // A secret passage: ":::gm" (GM only), ":::for Names" (some characters) or ":::foryou".
    secret: {
      content: '(block | secret)+',
      isolating: true,
      defining: true,
      attrs: { kind: { default: 'gm' }, names: { default: '' }, unclosed: { default: false }, ...sid },
      parseDOM: [
        {
          tag: 'div[data-secret]',
          contentElement: '.pm-secret-body',
          getAttrs: (el) => ({ kind: (el as HTMLElement).dataset.secret, names: (el as HTMLElement).dataset.names ?? '' }),
        },
      ],
      toDOM: (n) => ['div', { 'data-secret': n.attrs.kind, 'data-names': n.attrs.names, class: `pm-secret ${n.attrs.kind}` }, ['div', { class: 'pm-secret-body' }, 0]],
    },
    text: { group: 'inline' },
    hard_break: { group: 'inline', inline: true, selectable: false, parseDOM: [{ tag: 'br' }], toDOM: () => ['br'] },
    // A [[Page]] or [[Page|label]] link.
    wikilink: {
      group: 'inline',
      inline: true,
      atom: true,
      attrs: { target: {}, label: { default: null } },
      parseDOM: [{ tag: 'span[data-wikilink]', getAttrs: (el) => ({ target: (el as HTMLElement).dataset.wikilink, label: (el as HTMLElement).dataset.label ?? null }) }],
      toDOM: (n) => ['span', { class: 'wikilink pm-wikilink', 'data-wikilink': n.attrs.target, ...(n.attrs.label === null ? {} : { 'data-label': n.attrs.label }) }, n.attrs.label ?? n.attrs.target],
    },
    // A picture: one of the world's files ("asset:<id>") or a web address.
    image: {
      group: 'inline',
      inline: true,
      atom: true,
      attrs: { src: {}, alt: { default: '' }, title: { default: null } },
      // Only the editor's own pictures paste back in: a picture copied from a web page is left out.
      parseDOM: [{ tag: 'img[data-md-src]', getAttrs: (el) => ({ src: (el as HTMLElement).dataset.mdSrc, alt: (el as HTMLElement).getAttribute('alt') ?? '', title: (el as HTMLElement).getAttribute('title') }) }],
      toDOM: (n) => ['img', { 'data-md-src': n.attrs.src, alt: n.attrs.alt, ...(n.attrs.title ? { title: n.attrs.title } : {}) }],
    },
  },
  marks: {
    link: {
      attrs: { href: {}, title: { default: null } },
      inclusive: false,
      parseDOM: [{ tag: 'a[href]', getAttrs: (el) => ({ href: (el as HTMLElement).getAttribute('href'), title: (el as HTMLElement).getAttribute('title') }) }],
      toDOM: (m) => ['a', { href: m.attrs.href, ...(m.attrs.title ? { title: m.attrs.title } : {}), rel: 'noopener noreferrer' }, 0],
    },
    strong: {
      parseDOM: [
        { tag: 'strong' },
        // Google Docs wraps everything it copies in <b style="font-weight: normal">.
        { tag: 'b', getAttrs: (el) => (el as HTMLElement).style.fontWeight !== 'normal' && null },
        { style: 'font-weight=400', clearMark: (m) => m.type.name === 'strong' },
        { style: 'font-weight', getAttrs: (v) => /^(bold(er)?|[5-9]\d{2,})$/.test(v as string) && null },
      ],
      toDOM: () => ['strong', 0],
    },
    em: { parseDOM: [{ tag: 'i' }, { tag: 'em' }, { style: 'font-style=italic' }, { style: 'font-style=normal', clearMark: (m) => m.type.name === 'em' }], toDOM: () => ['em', 0] },
    strike: { parseDOM: [{ tag: 's' }, { tag: 'del' }, { tag: 'strike' }, { style: 'text-decoration=line-through' }], toDOM: () => ['s', 0] },
    code: { parseDOM: [{ tag: 'code' }], toDOM: () => ['code', 0] },
  },
})

const N = schema.nodes
const M = schema.marks

/** A block that came straight from the text, and what was around it there. */
export interface Source {
  /** The passage it sat in (its sid), or 0 for the text itself. */
  parent: number
  /** The block as first read: while the block still equals it, `body` is written back. */
  node: PMNode
  /** Its exact text, with the line end(s) that closed it. */
  body: string
  /** The line end(s) at the end of `body` (none for a passage that was never closed: it ran to the end). */
  tail: string
  /** The blank lines before it, if it was the first block of its parent. */
  lead: string
  first: boolean
  /** The blank lines after it (up to the next block, or to the end of its parent). */
  after: string
  /** The block after it, or null if it was the last. */
  next: number | null
  /** For a passage: its opening line (with its line end), and its closing line if it had one. */
  open?: string
  close?: string | null
  /** A passage written on one line, or with text on its opening line: kept whole while untouched. */
  opaque?: boolean
}

/** Everything remembered about the text a document was read from. */
export interface Sources {
  count: number
  byId: Map<number, Source>
  /** Parents that held nothing but blank lines: that blank text. */
  blank: Map<number, string>
  /** The text ended with a line end. */
  endsWithLine: boolean
}

// ---------------------------------------------------------------------------------------------
// Reading Markdown
// ---------------------------------------------------------------------------------------------

const LINE_END = /\r\n?|\n/
const TAIL = /(?:\r\n?|\n)*$/
/** The same two patterns as renderMarkdown: pictures from the world's files, then [[links]]. */
const ASSET = /!\[([^\]]*)\]\(asset:([0-9a-fA-F-]{36})\)/g
const WIKI = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
/** Held-back pictures and links stand between these while marked reads the text (as in renderMarkdown). */
const HOLD = /\uE000(\d+)\uE001/g
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', mdash: '—', ndash: '–', hellip: '…', copy: '©', times: '×', rarr: '→', larr: '←' }

/** Thrown for Markdown the editor can't show as formatted text: the block becomes a plain block. */
const CANT = new Error('not representable')
const cant = (): never => {
  throw CANT
}

/** Splits text into lines, each with the line end that followed it ("" for the last). */
function linesOf(text: string): { text: string; end: string }[] {
  const out: { text: string; end: string }[] = []
  const re = /([^\r\n]*)(\r\n?|\n|$)/g
  for (let m = re.exec(text); m; m = re.exec(text)) {
    out.push({ text: m[1], end: m[2] })
    if (!m[2]) break
  }
  return out
}

interface Piece {
  /** Blank lines between blocks. */
  blank?: string
  /** A block: its exact text and the token marked read it as. */
  body?: string
  token?: Token
  held?: string[]
}

/**
 * Reads a stretch of text with no secret passages in it into marked's blocks, each with its exact
 * source text. Null if the pieces don't add up to the text again (then the caller keeps it whole).
 */
function lexRun(run: string): Piece[] | null {
  if (/[\uE000-\uE002]/.test(run)) return null
  const held: string[] = []
  const put = (raw: string) => `\uE000${held.push(raw) - 1}\uE001`
  const src = run.replace(ASSET, put).replace(WIKI, put)
  // marked reads "\r\n" and "\r" as "\n": keep where each character came from, to cut the original.
  const at: number[] = []
  let norm = ''
  for (let i = 0; i < src.length; i++) {
    at.push(i)
    if (src[i] === '\r') {
      norm += '\n'
      if (src[i + 1] === '\n') i++
    } else norm += src[i]
  }
  at.push(src.length)
  let tokens: Token[]
  try {
    tokens = new Lexer().lex(norm)
  } catch {
    return null
  }
  const out: Piece[] = []
  let pos = 0
  for (const t of tokens) {
    if (!norm.startsWith(t.raw, pos)) return null
    const raw = src.slice(at[pos], at[pos + t.raw.length]).replace(HOLD, (_m, i: string) => held[Number(i)])
    pos += t.raw.length
    if (!raw) continue
    if (t.type === 'space' || !raw.trim()) out.push({ blank: raw })
    else out.push({ body: raw, token: t, held })
  }
  if (pos !== norm.length || out.map((p) => p.blank ?? p.body).join('') !== run) return null
  return out
}

/** Text as it shows: "&amp;" as "&", and a line break inside a paragraph as a space. */
function decode(text: string) {
  return text
    .replace(/[ \t]*\n[ \t]*/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/gi, (_m, name: string) => {
      if (name[0] !== '#') return ENTITIES[name] ?? cant()
      const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1))
      return code > 0 && code < 0x110000 && !(code >= 0xd800 && code < 0xe000) ? String.fromCodePoint(code) : cant()
    })
}

/** Turns marked's blocks into the editor's (see convert). */
class Reader {
  private held: string[]
  constructor(held: string[]) {
    this.held = held
  }

  /** The source text a held-back picture or link stands for. */
  expand(s: string) {
    return s.replace(HOLD, (_m, i: string) => this.held[Number(i)] ?? cant())
  }

  private text(out: PMNode[], str: string, marks: readonly Mark[]) {
    if (!str) return
    const last = out[out.length - 1]
    if (last?.isText && sameMarks(last.marks, marks)) out[out.length - 1] = schema.text(last.text + str, marks)
    else out.push(schema.text(str, marks))
  }

  /** Words that may hold held-back pictures and links. */
  private words(out: PMNode[], str: string, marks: readonly Mark[]) {
    let last = 0
    for (const m of str.matchAll(HOLD)) {
      this.text(out, str.slice(last, m.index), marks)
      last = m.index + m[0].length
      const raw = this.held[Number(m[1])] ?? cant()
      const pic = raw.match(/^!\[([^\]]*)\]\((asset:[0-9a-fA-F-]{36})\)$/)
      if (pic) out.push(N.image.create({ src: pic[2], alt: pic[1] }, null, marks))
      else {
        const link = raw.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/) ?? cant()
        out.push(N.wikilink.create({ target: link[1], label: link[2] ?? null }, null, marks))
      }
    }
    this.text(out, str.slice(last), marks)
  }

  inline(tokens: Token[] | undefined, marks: readonly Mark[], out: PMNode[] = []): PMNode[] {
    for (const t of tokens ?? []) {
      if (t.type === 'text') {
        const inner = (t as Tokens.Text).tokens
        if (inner?.length) this.inline(inner, marks, out)
        else this.words(out, decode(t.text), marks)
      } else if (t.type === 'escape') this.text(out, t.text, marks)
      else if (t.type === 'strong') this.inline(t.tokens, M.strong.create().addToSet(marks), out)
      else if (t.type === 'em') this.inline(t.tokens, M.em.create().addToSet(marks), out)
      else if (t.type === 'del') this.inline(t.tokens, M.strike.create().addToSet(marks), out)
      else if (t.type === 'codespan') this.text(out, this.expand(t.text), M.code.create().addToSet(marks))
      else if (t.type === 'br') out.push(N.hard_break.create(null, null, marks))
      else if (t.type === 'link') this.inline(t.tokens, M.link.create({ href: this.expand(t.href), title: t.title ? this.expand(t.title) : null }).addToSet(marks), out)
      else if (t.type === 'image') out.push(N.image.create({ src: this.expand(t.href), alt: this.expand(t.text), title: t.title ? this.expand(t.title) : null }, null, marks))
      else cant()
    }
    return out
  }

  /** A paragraph's or heading's words, without spaces at either end. */
  private textblock(tokens: Token[] | undefined): PMNode[] {
    const out = this.inline(tokens, [])
    const first = out[0]
    if (first?.isText) {
      const t = first.text!.replace(/^[ \t]+/, '')
      if (t) out[0] = schema.text(t, first.marks)
      else out.shift()
    }
    const last = out[out.length - 1]
    if (last?.isText) {
      const t = last.text!.replace(/[ \t]+$/, '')
      if (t) out[out.length - 1] = schema.text(t, last.marks)
      else out.pop()
    }
    return out
  }

  blocks(tokens: Token[]): PMNode[] {
    return tokens.map((t) => this.block(t)).filter((n) => n !== null)
  }

  block(t: Token): PMNode | null {
    switch (t.type) {
      case 'space':
        return null
      case 'paragraph':
      case 'text': {
        const content = this.textblock((t as Tokens.Paragraph).tokens ?? [t])
        return content.length ? N.paragraph.createChecked(null, content) : cant()
      }
      case 'heading':
        return N.heading.createChecked({ level: t.depth }, this.textblock(t.tokens))
      case 'hr':
        return N.horizontal_rule.create()
      case 'code': {
        // Code written by indenting it is read with the line end that closed it: that isn't part of the code.
        const text = this.expand(t.codeBlockStyle === 'indented' ? t.text.replace(/\n+$/, '') : t.text)
        return N.code_block.createChecked({ lang: this.expand(t.lang ?? '') }, text ? schema.text(text) : null)
      }
      case 'blockquote':
        return N.blockquote.createChecked(null, this.blocks(t.tokens ?? []))
      case 'list': {
        const list = t as Tokens.List
        const items = list.items.map((item) => {
          let tokens = item.tokens
          if (item.task) {
            // marked leaves the "[x] " as the first thing in the line, or in the line's first paragraph.
            const first = tokens[0] as Tokens.Paragraph | undefined
            if (first?.type === ('checkbox' as string)) tokens = tokens.slice(1)
            else if (first?.tokens?.[0]?.type === 'checkbox') tokens = [{ ...first, tokens: first.tokens.slice(1) }, ...tokens.slice(1)]
            else cant()
          }
          const blocks = this.blocks(tokens)
          // A line with nothing on it yet ("-") is an empty line of the list.
          return N.list_item.createChecked({ checked: item.task ? !!item.checked : null }, blocks[0]?.type === N.paragraph ? blocks : [N.paragraph.create(), ...blocks])
        })
        if (list.ordered) return N.ordered_list.createChecked({ start: list.start === '' ? 1 : Number(list.start), delim: /^\s*\d+\)/.test(list.raw) ? ')' : '.', tight: !list.loose }, items)
        return N.bullet_list.createChecked({ bullet: list.raw.match(/^\s*([-+*])/)?.[1] ?? '-', tight: !list.loose }, items)
      }
      case 'table': {
        const table = t as Tokens.Table
        const row = (cells: Tokens.TableCell[], header: boolean) => N.table_row.createChecked(null, cells.map((c) => N.table_cell.createChecked({ header }, this.textblock(c.tokens))))
        return N.table.createChecked({ align: table.align.map((a) => a ?? null) }, [row(table.header, true), ...table.rows.map((r) => row(r, false))])
      }
      default:
        return cant()
    }
  }
}

const sameMarks = (a: readonly Mark[], b: readonly Mark[]) => a.length === b.length && a.every((m, i) => m.eq(b[i]))

/**
 * One block of text as an editor block, or null if the editor can't show it faithfully. "Faithfully"
 * is checked, not assumed: the block is written out again and read back, and must come out the same.
 */
function convert(piece: Piece): PMNode | null {
  try {
    const node = new Reader(piece.held!).block(piece.token!)
    if (!node) return null
    const again = lexRun(blockMd(node))
    const blocks = again?.filter((p) => p.token)
    if (blocks?.length !== 1) return null
    const back = new Reader(blocks[0].held!).block(blocks[0].token!)
    return back && back.eq(node) ? node : null
  } catch {
    // Anything marked or the document's own rules refuse is kept as typed.
    return null
  }
}

/** Reads Markdown into a document, remembering where each block came from. */
export function parseMarkdown(text: string): { doc: PMNode; sources: Sources } {
  const sources: Sources = { count: 0, byId: new Map(), blank: new Map(), endsWithLine: /[\r\n]$/.test(text) }
  return { doc: N.doc.create(null, readInto(text, 0, sources)), sources }
}

/** Reads Markdown that is being pasted or dropped in: the same blocks, with nothing remembered. */
export function parseLoose(text: string): PMNode {
  return N.doc.create(null, readInto(text, 0, null))
}

/** The blocks of a text (the whole page, or the inside of a passage). */
function readInto(text: string, parent: number, sources: Sources | null): PMNode[] {
  type Found = { blank: string } | { body: string; make: (id: number | null) => { node: PMNode; extra?: Partial<Source> } }
  const found: Found[] = []
  const lines = linesOf(text)
  const run: string[] = []
  const flush = () => {
    if (!run.length) return
    const all = run.join('')
    run.length = 0
    const pieces = lexRun(all)
    if (!pieces) {
      if (!all.trim()) found.push({ blank: all })
      else found.push({ body: all, make: (id) => ({ node: rawBlock(all, id) }) })
      return
    }
    for (const p of pieces) {
      if (p.blank !== undefined) found.push({ blank: p.blank })
      else {
        const node = convert(p)
        const body = p.body!
        found.push({ body, make: (id) => ({ node: node ? withSid(node, id) : rawBlock(body, id) }) })
      }
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const opener = readOpener(line.text)
    if (!opener) {
      run.push(line.text + line.end)
      continue
    }
    flush()
    const attrs = { kind: opener.kind, names: opener.names.join(', ') }
    if (opener.one !== undefined) {
      // A passage on one line: ":::gm::: text :::".
      const one = opener.one
      const body = line.text + line.end
      found.push({ body, make: (id) => ({ node: N.secret.create({ ...attrs, sid: id }, readInto(one, id ?? -1, sources)), extra: { opaque: true, open: body, close: null } }) })
      continue
    }
    // Up to its closing line, counting passages inside it as splitSecrets does.
    let depth = 1
    let j = i + 1
    for (; j < lines.length; j++) {
      if (CLOSER.test(lines[j].text)) depth--
      else {
        const inner = readOpener(lines[j].text)
        if (inner && inner.one === undefined) depth++
      }
      if (depth === 0) break
    }
    const closed = j < lines.length
    const inside = lines.slice(i + 1, j).map((l) => l.text + l.end).join('')
    // ":::gm The innkeeper is a spy": text on the opening line is the passage's first line.
    const first = opener.kind !== 'for' && opener.first ? opener.first : ''
    const body = lines.slice(i, closed ? j + 1 : j).map((l) => l.text + l.end).join('')
    const closeLine = closed ? lines[j].text : null
    found.push({
      body,
      make: (id) => ({
        node: N.secret.create({ ...attrs, unclosed: !closed, sid: id }, readInto(first ? first + line.end + inside : inside, id ?? -1, sources)),
        extra: { opaque: !!first, open: line.text + line.end, close: closeLine, ...(closed || first ? {} : { tail: '' }) },
      }),
    })
    i = closed ? j : lines.length
  }
  flush()

  const nodes: PMNode[] = []
  let blank = ''
  let prev: Source | null = null
  for (const f of found) {
    if ('blank' in f) {
      blank += f.blank
      continue
    }
    const id = sources ? ++sources.count : null
    const { node, extra } = f.make(id)
    nodes.push(node)
    if (sources && id !== null) {
      const source: Source = { parent, node, body: f.body, tail: f.body.match(TAIL)![0], lead: prev ? '' : blank, first: !prev, after: '', next: null, ...extra }
      if (prev) {
        prev.after = blank
        prev.next = id
      }
      sources.byId.set(id, source)
      prev = source
    }
    blank = ''
  }
  if (prev) prev.after = blank
  if (!nodes.length) {
    if (sources) sources.blank.set(parent, blank)
    nodes.push(N.paragraph.create())
  }
  return nodes
}

const withSid = (node: PMNode, id: number | null) => (id === null ? node : node.type.create({ ...node.attrs, sid: id }, node.content, node.marks))
const rawBlock = (body: string, id: number | null) => N.raw_block.create({ sid: id }, schema.text(body.replace(TAIL, '')))

// ---------------------------------------------------------------------------------------------
// Writing Markdown
// ---------------------------------------------------------------------------------------------

/** Marks from the outside in: a link holds bold, bold holds italic, code is innermost. */
const ORDER = ['link', 'strong', 'em', 'strike', 'code'] as const

/** Words with the characters Markdown would read as formatting made plain. */
function escapeText(text: string, table: boolean) {
  let out = text
    .replace(/[\\`*~]/g, '\\$&')
    .replace(/(?<![A-Za-z0-9])_|_(?![A-Za-z0-9])/g, '\\_')
    .replace(/\[(?=[^\]\n]*\][ \t]?[([:])/g, '\\[')
    .replace(/<(?=[A-Za-z/!?])/g, '\\<')
    .replace(/&(?=(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);)/gi, '\\&')
  if (table) out = out.replace(/\|/g, '\\|')
  return out
}

function codeSpan(text: string, table: boolean) {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((r) => r.length))
  const fence = '`'.repeat(longest + 1)
  const pad = /^`|`$|^ .* $/.test(text) ? ' ' : ''
  return fence + pad + (table ? text.replace(/\|/g, '\\|') : text) + pad + fence
}

function leaf(n: PMNode, table: boolean): string {
  if (n.isText) return n.marks.some((m) => m.type === M.code) ? codeSpan(n.text!, table) : escapeText(n.text!, table)
  if (n.type === N.hard_break) return table ? ' ' : '\\\n'
  if (n.type === N.wikilink) return `${WORD}[[${n.attrs.target}${n.attrs.label === null ? '' : `|${n.attrs.label}`}]]${WORD}`
  if (n.type === N.image) {
    const md = `![${String(n.attrs.alt).replace(/[[\]\\]/g, '\\$&')}](${address(n.attrs.src)}${titlePart(n.attrs.title)})`
    return new RegExp(`^${ASSET.source}$`).test(md) ? WORD + md + WORD : md
  }
  return ''
}

const address = (href: string) => (/[\s()<>]/.test(href) || !href ? `<${href.replace(/[<>\n]/g, '')}>` : href)
const titlePart = (title: string | null) => (title ? ` "${title.replace(/["\\]/g, '\\$&').replace(/\n/g, ' ')}"` : '')

function inlineMd(content: Fragment, table = false): string {
  const items: PMNode[] = []
  content.forEach((n) => items.push(n))
  const emit = (nodes: PMNode[], level: number): string => {
    if (level === ORDER.length) return nodes.map((n) => leaf(n, table)).join('')
    const type = M[ORDER[level]]
    if (type === M.code) return emit(nodes, level + 1)
    let out = ''
    for (let i = 0; i < nodes.length; ) {
      const mark = type.isInSet(nodes[i].marks) ?? null
      const goesOn = (n: PMNode) => {
        const m = type.isInSet(n.marks) ?? null
        return mark ? !!m && m.eq(mark) : !m
      }
      let j = i + 1
      while (j < nodes.length && goesOn(nodes[j])) j++
      const inner = emit(nodes.slice(i, j), level + 1)
      out += mark ? wrap(mark, inner, nodes.slice(i, j)) : inner
      i = j
    }
    return out
  }
  const wrap = (mark: Mark, inner: string, nodes: PMNode[]) => {
    // Formatting marks hug their words: spaces at the edges go outside them.
    const m = inner.match(/^(\s*)([\s\S]*?)(\s*)$/)!
    if (!m[2]) return inner
    if (mark.type === M.link) {
      const href = String(mark.attrs.href)
      const plain = nodes.length === 1 && nodes[0].isText && nodes[0].marks.length === 1 && nodes[0].text === href
      if (plain && !mark.attrs.title && /^[a-z][a-z0-9+.-]*:[^\s<>]*$/i.test(href)) return `${m[1]}<${href}>${m[3]}`
      return `${m[1]}[${m[2]}](${address(href)}${titlePart(mark.attrs.title)})${m[3]}`
    }
    const d = mark.type === M.strong ? '**' : mark.type === M.em ? '*' : '~~'
    return `${m[1]}${OPENS}${d}${m[2]}${CLOSES}${d}${m[3]}`
  }
  const marked = emit(items, 0)
  if (!marked.includes(OPENS)) return marked.replaceAll(WORD, '')
  // Written the usual way; if that would not read back as what is shown, the next way that does.
  const usual = hugging(marked, 0)
  const shown = looks(content)
  if (readsAs(usual) === shown) return usual
  for (const style of [1, 2, 3]) {
    const other = hugging(marked, style)
    if (other !== usual && readsAs(other) === shown) return other
  }
  return usual
}

// Where bold, italic or struck-through words start and end, and where a page link or picture
// stands (the reader takes those for a letter), until `hugging` has looked at them.
const OPENS = ''
const CLOSES = ''
const WORD = ''
const DELIMS = /((?:\*\*|\*|~~)|(?:\*\*|\*|~~))/
/** What the reader counts as a mark of punctuation next to a delimiter ("~" is not one next to "*"). */
const isMark = (ch: string, delim = '*') => /[\p{P}\p{S}]/u.test(ch) && (ch !== '~' || delim[1] === '~')
const isEdge = (ch: string, delim = '*') => !ch || /\s/.test(ch) || isMark(ch, delim)
const asCode = (ch: string) => `&#x${ch.codePointAt(0)!.toString(16).toUpperCase()};`

/**
 * Chooses how each run of bold, italic or struck-through words is written, so that it reads back.
 * Markdown only takes "*" as the start of italics if a letter follows it, or if what stands before
 * it is a space or a mark: "word*(aside)*" would come back as stars. Where formatted words that
 * begin or end with a mark touch a letter, that letter is written as a character code, which reads
 * back as the same letter. `style` 1 writes italics with "_" where that is allowed (between
 * spaces or marks), 2 bold as well, 3 only bold: a second chance where the stars would be misread.
 */
function hugging(text: string, style: number) {
  const parts = text.split(DELIMS)
  const isOpen = (i: number) => parts[i][0] === OPENS
  // The character just outside a delimiter: another delimiter counts as a mark.
  const before = (i: number) => (parts[i - 1] ? parts[i - 1].match(/.$/su)![0] : i > 1 ? parts[i - 2].at(-1)! : '')
  const after = (i: number) => (parts[i + 1] ? parts[i + 1].match(/^./su)![0] : i + 2 < parts.length ? parts[i + 2][1] : '')
  if (style) {
    const open: number[] = []
    for (let i = 1; i < parts.length; i += 2) {
      if (isOpen(i)) open.push(i)
      else {
        const from = open.pop()
        const d = parts[i].slice(1)
        const under = d === '*' ? style !== 3 : d === '**' && style >= 2
        if (from !== undefined && under && isEdge(before(from)) && isEdge(after(i))) {
          parts[from] = OPENS + d.replaceAll('*', '_')
          parts[i] = CLOSES + d.replaceAll('*', '_')
        }
      }
    }
  }
  for (let a = 1; a < parts.length; a += 2) {
    // A run of delimiters with nothing between them: "***" opening bold italics, say.
    let b = a
    while (b + 2 < parts.length && !parts[b + 1] && isOpen(b + 2) === isOpen(a)) b += 2
    if (isOpen(a)) {
      const [out, inn] = [before(a), after(b)]
      if (isMark(inn, parts[b]) && !isEdge(out, parts[a]) && out !== WORD && parts[a - 1]) parts[a - 1] = parts[a - 1].replace(/.$/su, asCode)
    } else {
      const [inn, out] = [before(a), after(b)]
      if (isMark(inn, parts[a]) && !isEdge(out, parts[b]) && out !== WORD && parts[b + 1]) parts[b + 1] = parts[b + 1].replace(/^./su, asCode)
    }
    a = b
  }
  return parts.map((p, i) => (i % 2 ? p.slice(1) : p)).join('').replaceAll(WORD, '')
}

/** What a line of words looks like: each word with its formatting. Spaces carry none that shows. */
function looks(content: Fragment): string {
  let out = ''
  content.forEach((n) => {
    if (!n.isText) out += `${n.type.name}${JSON.stringify(n.attrs)}${n.marks.map((m) => JSON.stringify(m.toJSON())).join('')}`
    else for (const part of n.text!.split(/(\s+)/)) if (part) out += /^\s+$/.test(part) ? ' ' : `${part}${n.marks.map((m) => JSON.stringify(m.toJSON())).join('')}`
  })
  return out.replace(/ +/g, ' ').trim()
}

/** How a line of Markdown would be read (see looks), or null if it would not be one paragraph. */
function readsAs(md: string): string | null {
  try {
    const pieces = lexRun(md.split('\n').map(plainLineStart).join('\n'))?.filter((p) => p.token)
    if (pieces?.length !== 1) return null
    const node = new Reader(pieces[0].held!).block(pieces[0].token!)
    return node?.type === N.paragraph ? looks(node.content) : null
  } catch {
    return null
  }
}

/** A line that would start a heading, list, quote or rule gets a backslash, so it stays words. */
function plainLineStart(line: string) {
  const l = line.replace(/^[ \t]+/, '')
  if (/^(#{1,6}([ \t]|$)|>|[-+]([ \t]|$)|\[[ xX]\]([ \t]|$)|(?:[-_=][ \t]*){3,}$|=+[ \t]*$)/.test(l)) return `\\${l}`
  return l.replace(/^(\d{1,9})([.)])(?=[ \t]|$)/, '$1\\$2')
}

function textblockMd(content: Fragment) {
  return inlineMd(content)
    .replace(/^(?:\\\n)+|(?:\\\n)+$/g, '')
    .split('\n')
    .map(plainLineStart)
    .join('\n')
    .replace(/[ \t]+$/, '')
}

const tightList = (list: PMNode) => {
  let tight = !!list.attrs.tight
  list.forEach((item) => item.forEach((child, _o, i) => {
    if (i === 0 ? child.type !== N.paragraph : child.type !== N.bullet_list && child.type !== N.ordered_list) tight = false
  }))
  return tight
}

/** The marker a list is written with: "-", "*" or "+", or "." or ")" after a number. `other` picks the other one. */
const listMarker = (list: PMNode, other: boolean): string =>
  list.type === N.ordered_list ? ((list.attrs.delim === ')') !== other ? ')' : '.') : other ? (list.attrs.bullet === '-' ? '*' : '-') : String(list.attrs.bullet)

function listMd(list: PMNode, other = false): string {
  const ordered = list.type === N.ordered_list
  const tight = tightList(list)
  const out: string[] = []
  const mark = listMarker(list, other)
  list.forEach((item, _o, i) => {
    const marker = ordered ? `${(Number(list.attrs.start) || 0) + i}${mark}` : mark
    const parts: string[] = []
    item.forEach((child) => parts.push(blockMd(child)))
    let body = parts.join(tight ? '\n' : '\n\n')
    if (item.attrs.checked !== null) body = `${item.attrs.checked ? '[x]' : '[ ]'} ${body}`
    const pad = ' '.repeat(marker.length + 1)
    out.push(body.split('\n').map((l, k) => (k === 0 ? `${marker} ${l}`.trimEnd() : l ? pad + l : '')).join('\n'))
  })
  return out.join(tight ? '\n' : '\n\n')
}

function tableMd(table: PMNode): string {
  const rows: string[][] = []
  table.forEach((row) => {
    const cells: string[] = []
    row.forEach((cell) => cells.push(inlineMd(cell.content, true).replace(/\n/g, ' ').trim()))
    rows.push(cells)
  })
  const width = Math.max(1, ...rows.map((r) => r.length))
  const line = (cells: string[]) => `| ${Array.from({ length: width }, (_x, i) => cells[i] ?? '').join(' | ')} |`
  const align: (string | null)[] = table.attrs.align ?? []
  const rule = Array.from({ length: width }, (_x, i) => (align[i] === 'left' ? ':---' : align[i] === 'center' ? ':---:' : align[i] === 'right' ? '---:' : '---'))
  return [line(rows[0] ?? []), line(rule), ...rows.slice(1).map(line)].join('\n')
}

/** One block written afresh as Markdown (no line end after it). */
function blockMd(node: PMNode, other = false): string {
  switch (node.type) {
    case N.paragraph:
      return textblockMd(node.content)
    case N.heading: {
      const words = textblockMd(node.content).replace(/\\?\n/g, ' ').replace(/(^|[ \t])(#+)[ \t]*$/, '$1\\$2')
      return `${'#'.repeat(node.attrs.level)} ${words}`.trimEnd()
    }
    case N.blockquote: {
      const parts: string[] = []
      node.forEach((child) => parts.push(blockMd(child)))
      return parts.join('\n\n').split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n')
    }
    case N.bullet_list:
    case N.ordered_list:
      return listMd(node, other)
    case N.code_block: {
      const text = node.textContent
      const fence = '`'.repeat(Math.max(3, ...(text.match(/`+/g) ?? []).map((r) => r.length + 1)))
      return `${fence}${String(node.attrs.lang).replace(/[`\r\n]/g, '')}\n${text}${text && !text.endsWith('\n') ? '\n' : ''}${fence}`
    }
    case N.horizontal_rule:
      return '---'
    case N.table:
      return tableMd(node)
    case N.raw_block:
      return node.textContent
    case N.secret: {
      const parts: string[] = []
      node.forEach((child) => {
        if (!isEmpty(child)) parts.push(blockMd(child))
      })
      const inside = parts.join('\n\n')
      return `${openerFor(node)}${inside ? `${inside}\n` : ''}:::`
    }
    default:
      return ''
  }
}

/** The opening line the app writes for a passage (with its line end). */
function openerFor(node: PMNode) {
  if (node.attrs.kind !== 'for') return `:::${node.attrs.kind === 'foryou' ? 'foryou' : 'gm'}\n`
  return `:::for ${cleanNames(node.attrs.names)}`.trimEnd() + '\n'
}

/**
 * Names for a ":::for" line: nothing that could end the line or pass for a marker (no line ends, no
 * "::"), and otherwise as typed, so the line reads back as the same names ("Dr: Who", "Wren  Ash").
 */
export const cleanNames = (names: string) =>
  String(names)
    .replace(/[\r\n]+/g, ' ')
    .replace(/:{2,}/g, ':')
    .replace(/^[\s:]+/, '')
    .trim()

/** A paragraph or heading with nothing in it: Markdown has no such thing, so it isn't written. */
const isEmpty = (n: PMNode) => (n.type === N.paragraph || n.type === N.heading) && n.content.size === 0

/** What will be written: plain text, a passage with its markers, or a passage kept whole. */
type Out = string | { tag: string; open: string; close: string | null; body: Out[] } | { tag: string; whole: string }

const tagOf = (node: PMNode) => (node.attrs.kind === 'for' ? `for:${forNames(cleanNames(node.attrs.names)).map((n) => n.toLowerCase()).join(',')}` : String(node.attrs.kind))

/** The passage an opening line opens, as the app's reader reads that very line. */
function tagOfLine(line: string, node: PMNode) {
  const read = readOpener(line.replace(/(?:\r\n?|\n)$/, ''))
  if (!read || read.kind !== node.attrs.kind) return tagOf(node)
  return read.kind === 'for' ? `for:${read.names.map((n) => n.toLowerCase()).join(',')}` : read.kind
}

const isList = (n: PMNode) => n.type === N.bullet_list || n.type === N.ordered_list
const endsLine = (s: string) => /[\r\n]$/.test(s)

/**
 * The children of the text or of a passage, written out. An untouched block gives back its exact
 * text, and the blank lines between two blocks that still sit together are kept as they were.
 */
function childrenOut(parent: PMNode, parentId: number, sources: Sources | null, closed: boolean, followed: boolean): Out[] {
  const kids: PMNode[] = []
  parent.forEach((k) => {
    // (A heading typed with no words, "#", is kept while nobody touches it.)
    if (!isEmpty(k) || (k.attrs.sid !== null && sources?.byId.get(k.attrs.sid)?.node.eq(k))) kids.push(k)
  })
  if (!kids.length) return [sources?.blank.get(parentId) ?? '']
  const out: Out[] = []
  const src = kids.map((k) => (k.attrs.sid === null ? undefined : sources?.byId.get(k.attrs.sid)))
  // Markdown joins two lists that use the same marker, so a list right after one is written with the
  // other marker ("*" after "-") and they stay two.
  const other: boolean[] = []
  let before = ''
  kids.forEach((k, i) => {
    const prev = kids[i - 1]
    other.push(isList(k) && prev?.type === k.type && before === listMarker(k, false))
    before = isList(k) ? listMarker(k, other[i]) : ''
  })
  const same = kids.map((k, i) => !!src[i]?.node.eq(k) && !other[i])
  const here = (i: number) => src[i]?.parent === parentId
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i]
    const s = src[i]
    const tail = s?.tail ?? ''
    if (i === 0 && s?.first && here(0)) out.push(s.lead)
    const last = i === kids.length - 1
    if (k.type === N.secret) out.push(secretOut(k, s, same[i], sources, followed || !last))
    else out.push(same[i] ? s!.body.slice(0, s!.body.length - tail.length) : blockMd(k, other[i]))
    if (last) {
      // The closing line of a passage needs a line of its own.
      let end = s && s.next === null && here(i) ? tail + s.after : parentId === 0 && sources?.endsWithLine ? '\n' : ''
      if (closed && !endsLine(end)) end += '\n'
      out.push(end)
      break
    }
    const together = !!s && here(i) && here(i + 1) && s.next === kids[i + 1].attrs.sid && s.next !== k.attrs.sid
    const was = tail + (s?.after ?? '')
    const keep = together && ((same[i] && same[i + 1]) || was.split(LINE_END).length > 2 || (k.type === s.node.type && kids[i + 1].type === src[i + 1]!.node.type && !other[i + 1]))
    out.push(keep ? was : '\n\n')
  }
  return out
}

function secretOut(node: PMNode, s: Source | undefined, same: boolean, sources: Sources | null, followed: boolean): Out {
  if (same && s!.opaque && (!node.attrs.unclosed || !followed)) return { tag: tagOf(node), whole: s!.body.slice(0, s!.body.length - s!.tail.length) }
  // Its own opening line is kept while it still says the same thing; otherwise the app writes one.
  const kept = s && !s.opaque && s.node.attrs.kind === node.attrs.kind && s.node.attrs.names === node.attrs.names
  let open = kept ? s.open! : openerFor(node)
  // A kept line is meant for the names as that line reads them ("Dr: Who", "Wren  Ash"), not as the app would write them.
  const tag = kept ? tagOfLine(open, node) : tagOf(node)
  const close = node.attrs.unclosed && !followed ? null : kept && s.close != null ? s.close : ':::'
  const body = childrenOut(node, s && node.attrs.sid !== null ? node.attrs.sid : -1, sources, close !== null, followed)
  // An opening line that was the last line of the text had no line end: what's inside starts on the next line.
  if (!endsLine(open) && (close !== null || body.some((o) => o !== ''))) open += '\n'
  return { tag, open, close, body }
}

/**
 * Collects the written text, and beside it what each line of it is meant to be: an ordinary line, a
 * line inside a passage (and whose), or a passage's own marker.
 */
class Writer {
  text = ''
  /** Every line with words in it, with the passages it sits in ("" for none). */
  lines: [string, string][] = []
  ok = true
  private buf = ''
  private tag = ''
  /** A marker line has been written and its line end hasn't come yet. */
  private marker = false

  private write(s: string, tag: string) {
    this.text += s
    const parts = s.split(LINE_END)
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) this.flush()
      if (!parts[i]) continue
      if (this.marker) this.ok = false
      this.buf += parts[i]
      this.tag = tag
    }
  }
  private flush() {
    if (this.buf.trim() && !this.marker) this.lines.push([this.tag, this.buf])
    this.buf = ''
    this.marker = false
  }
  private line(s: string) {
    if (this.buf.trim() || this.marker) this.ok = false
    this.buf = ''
    this.text += s
    this.marker = !LINE_END.test(s)
    if (s.split(LINE_END).length > 2) this.ok = false
  }

  put(outs: Out[], depth: number, tag: string) {
    // Plain text between two passages is whole lines, so its markers can be made plain line by line.
    let text = ''
    const plain = () => {
      if (text) this.write(plainMarkers(text, depth), tag)
      text = ''
    }
    for (const o of outs) {
      if (typeof o === 'string') text += o
      else {
        plain()
        if ('whole' in o) {
          if (this.buf.trim() || this.marker) this.ok = false
          this.buf = ''
          this.text += o.whole
          this.lines.push(...secretLines(o.whole, tag))
          this.marker = true
        } else {
          this.line(o.open)
          this.put(o.body, depth + 1, `${tag}/${o.tag}`)
          if (o.close !== null) this.line(o.close)
        }
      }
    }
    plain()
  }
  end() {
    this.flush()
  }
}

/**
 * Makes any line that would read as a passage marker plain words, by putting a backslash before its
 * ":::" (as gmBlock does): an opening line anywhere, a closing line inside a passage. The editor
 * writes a passage's real markers itself, so nothing typed can open or close one by accident.
 */
function plainMarkers(text: string, depth: number) {
  return linesOf(text)
    .map((l) => (readOpener(l.text) || (depth > 0 && CLOSER.test(l.text)) ? l.text.replace(/^([ \t]*):::/, '$1\\:::') : l.text) + l.end)
    .join('')
}

/**
 * Every line of a text that has words in it, with the passages it sits in, as the app's own
 * splitSecrets reads it (the reading the page view uses to decide what players may see).
 */
export function secretLines(text: string, tag = ''): [string, string][] {
  const out: [string, string][] = []
  for (const seg of splitSecrets(text)) {
    if (seg.kind === 'text') {
      for (const l of seg.body.split('\n')) if (l.trim()) out.push([tag, l])
    } else out.push(...secretLines(seg.body, `${tag}/${seg.kind === 'for' ? `for:${seg.names.map((n) => n.toLowerCase()).join(',')}` : seg.kind}`))
  }
  return out
}

/**
 * Writes a document back as Markdown. `safe` is false if the text would not keep every line in the
 * passage the editor shows it in (GM only, for some characters, or for everyone): the text is
 * read again with splitSecrets and compared line by line with what the editor meant. The editor
 * never saves a text that isn't safe.
 */
export function serializeMarkdown(doc: PMNode, sources: Sources | null): { text: string; safe: boolean } {
  const w = new Writer()
  w.put(childrenOut(doc, 0, sources, false, false), 0, '')
  w.end()
  const read = secretLines(w.text)
  const safe = w.ok && read.length === w.lines.length && read.every((l, i) => l[0] === w.lines[i][0] && l[1] === w.lines[i][1])
  return { text: w.text, safe }
}

/** Blocks or words written afresh as Markdown (for copying out of the editor). */
export function fragmentMarkdown(content: Fragment): string {
  if (content.firstChild?.isInline) return inlineMd(content)
  let doc: PMNode
  try {
    doc = N.doc.createChecked(null, content)
  } catch {
    const parts: string[] = []
    content.forEach((n) => parts.push(n.isTextblock ? inlineMd(n.content) : n.textContent))
    return parts.join('\n')
  }
  return serializeMarkdown(stripSids(doc), null).text
}

/** The same document with nothing remembered about where its blocks came from. */
export function stripSids(node: PMNode): PMNode {
  if (node.isText || node.isLeaf) return node
  const kids: PMNode[] = []
  node.forEach((k) => kids.push(stripSids(k)))
  return node.type.create('sid' in node.attrs ? { ...node.attrs, sid: null } : node.attrs, Fragment.fromArray(kids), node.marks)
}

/**
 * What a document says, without how it was typed: no source ids, list markers or empty paragraphs.
 * Two documents with the same shape show the same thing (used by the tests).
 */
export function shapeOf(node: PMNode): unknown {
  if (node.isText) return { text: node.text, marks: node.marks.map((m) => m.toJSON()) }
  let kids: unknown[] = []
  node.forEach((k) => {
    if (!isEmpty(k) || node.type === N.list_item) kids.push(shapeOf(k))
  })
  // Spaces at either end of a paragraph, heading or table cell aren't written.
  if (node.inlineContent && !node.type.spec.code) {
    const edge = (k: unknown, re: RegExp) => (k && typeof (k as { text?: string }).text === 'string' ? { ...(k as object), text: (k as { text: string }).text.replace(re, '') } : k)
    if (kids.length) kids[0] = edge(kids[0], /^[ \t]+/)
    if (kids.length) kids[kids.length - 1] = edge(kids[kids.length - 1], /[ \t]+$/)
    kids = kids.filter((k) => (k as { text?: string }).text !== '')
    // Nor is a line break before the first word or after the last.
    const isBreak = (k: unknown) => (k as { type?: string })?.type === 'hard_break'
    while (kids.length && isBreak(kids[0])) kids.shift()
    while (kids.length && isBreak(kids[kids.length - 1])) kids.pop()
  }
  const attrs: Record<string, unknown> = { ...node.attrs }
  for (const how of ['sid', 'bullet', 'delim', 'tight']) delete attrs[how]
  return { type: node.type.name, attrs, marks: node.marks.map((m) => m.toJSON()), kids }
}
