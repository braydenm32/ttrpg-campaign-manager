import DOMPurify, { type Config } from 'dompurify'
import { Marked } from 'marked'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, ENTITY_LABELS, type Entity } from './db'
import { useAssetUrl } from './hooks'
import { StatusBadge } from './status'
import { plainLinks } from './text'
import { nameIndex, namesOf } from './links'
import { characterNames, useViewMode } from './viewMode'
import { TypeIcon } from './icons'
import { hrefFor, pagePath } from './paths'
import { MakePagePopover } from './wanted'
import { clickInlineRoll, inlineRolls } from './inlineRolls'

type Segment = { kind: 'text' | 'gm' | 'foryou'; body: string } | { kind: 'for'; names: string[]; body: string }

/** The character names in a ":::for" line: split by commas, "&" or "and"; a trailing ":::" is ignored. */
export function forNames(spec: string) {
  return spec
    .replace(/[ \t]*:::[ \t]*$/, '')
    .trim()
    .split(/[ \t]*(?:,|&|\band\b)[ \t]*/i)
    .map((n) => n.trim())
    .filter(Boolean)
}

/** A line that opens a secret passage: ":::gm", ":::for …" or ":::foryou", forgiving of case and spaces. */
const OPENER = /^[ \t]*:::[ \t]*(foryou|gm|for)(?![a-z0-9])(.*)$/i
const CLOSER = /^[ \t]*:::[ \t]*$/

/** Reads an opener line: its kind, and for a one-line passage its text (and names). */
function readOpener(line: string): { kind: 'gm' | 'for' | 'foryou'; names: string[]; one?: string; first?: string } | null {
  const m = line.match(OPENER)
  if (!m) {
    // Older player copies hold one-line passages as ":::foryouText:::".
    const legacy = line.match(/^:::foryou(\S.*?):::[ \t]*$/)
    return legacy ? { kind: 'foryou', names: [], one: legacy[1].trim() } : null
  }
  const kind = m[1].toLowerCase() as 'gm' | 'for' | 'foryou'
  const rest = m[2]
  if (kind === 'for') {
    const one = rest.match(/^[ \t]+(.+?):::(.*):::[ \t]*$/)
    if (one) return { kind, names: forNames(one[1]), one: one[2].trim() }
    return { kind, names: forNames(rest.replace(/^[ \t:]*/, '')) }
  }
  const one = rest.match(/^[: \t]*([^: \t].*?)[ \t]*:::[ \t]*$/)
  // ":::gm The innkeeper is a spy" with no closing marker opens a block that starts with that text.
  return { kind, names: [], one: one?.[1], first: rest.replace(/^[: \t]*/, '') }
}

/**
 * Splits text into ordinary text and secret passages, line by line:
 *  - ":::gm" up to a ":::" line is for the GM only. Any line starting ":::gm" opens one, even with
 *    text after it, and a missing closing line keeps the rest secret, so a typo never leaks.
 *    ":::GM", "::: gm" and indented markers count too.
 *  - ":::for Wren and Silas" up to ":::" is for the players of those characters only.
 *  - Either fits on one line too: ":::gm::: The innkeeper is a spy :::".
 *  - ":::foryou" is what a player's copy holds for a ":::for" passage meant for them.
 *  - Passages can sit inside each other: a ":::" closes the innermost one, so a secret inside a
 *    secret never ends the outer one early. A passage's body keeps its inner markers.
 * Keep in step with public.player_text in supabase/migrations, which decides what players receive.
 */
export function splitSecrets(text: string): Segment[] {
  const out: Segment[] = []
  let open: Segment | null = null
  let depth = 0
  const push = (line: string) => {
    const last = out[out.length - 1]
    if (last?.kind === 'text') last.body += '\n' + line
    else out.push({ kind: 'text', body: line })
  }
  // A lone "\r" ends a line too, the same as in public.player_text, so the app and the server
  // always read the same lines (a stray "\r" once let the server end a secret the app kept closed).
  for (const line of text.split(/\r\n?|\n/)) {
    const opener = readOpener(line)
    if (open) {
      if (CLOSER.test(line)) depth--
      else if (opener && opener.one === undefined) depth++
      if (depth === 0) {
        out.push(open)
        open = null
      } else open.body += (open.body ? '\n' : '') + line
      continue
    }
    if (!opener) {
      push(line)
      continue
    }
    const seg: Segment =
      opener.kind === 'for' ? { kind: 'for', names: opener.names, body: opener.one ?? '' } : { kind: opener.kind, body: opener.one ?? opener.first ?? '' }
    if (opener.one !== undefined) out.push(seg)
    else {
      open = seg
      depth = 1
    }
  }
  if (open) out.push(open)
  return out
}

/**
 * An element the app itself puts in rendered text: a [[link]], a roll button, a picture from the
 * world's files, a box round a secret passage, a ticked or empty box in a list. Nobody can type one:
 * typed text is sanitised with no classes, data-* attributes, buttons or forms, and these are put
 * in afterwards, with exactly the attributes given here (see renderMarkdown).
 */
export interface AppElement {
  tag: 'a' | 'span' | 'button' | 'output' | 'img' | 'div' | 'input'
  attrs: Record<string, string>
  /** Its words (set as plain text, never read as HTML). */
  text?: string
  children?: AppElement[]
}

/**
 * What typed text may use, GM's or player's: the tags Markdown makes and a few harmless ones, with
 * plain attributes. Nothing that can pass for the app or reach out: no forms, buttons or inputs, no
 * <style> or style="", no frames, embeds, links to stylesheets, <meta> or <base>, no SVG, no class
 * or data-* (so no fake [[links]], roll buttons or secret boxes). "data-app" only carries the
 * one-off key of the app's own boxes, and renderMarkdown takes it off again.
 */
const SANITISE: Config = {
  ALLOWED_TAGS: ['a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'code', 'col', 'colgroup', 'dd', 'del', 'details', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins', 'kbd', 'li', 'mark', 'ol', 'p', 'pre', 'q', 's', 'small', 'span', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul', 'wbr'],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'align', 'colspan', 'rowspan', 'start', 'open', 'data-app'],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
}

/** A key nobody can guess, made fresh for each render: only the app's own markers carry it. */
const oneOffKey = () => `0${[...crypto.getRandomValues(new Uint32Array(3))].map((n) => n.toString(16)).join('')}`
/** A marker sits between these two characters (from Unicode's private use area, so never in a word). */
const OPEN = String.fromCharCode(0xe000)
const CLOSE = String.fromCharCode(0xe001)

export interface RenderOptions {
  entities: Entity[]
  worldId: string
  showSecrets: boolean
  /** Links don't open anything (the players' screen on a TV, a sheet to print). */
  stillLinks?: boolean
  /** A player wrote it: see the Markdown component. */
  playerWritten?: boolean
  /** The GM's own view (not the player view, not previewing as a player). */
  gmView: boolean
  /** The previewed player's character names, lower case, for ":::for" passages. */
  viewer: Set<string>
}

/**
 * Markdown to safe HTML, for the Markdown component. Typed text goes through marked and DOMPurify
 * (SANITISE above). The app's own elements never pass through as HTML: each one is held back, a
 * marker with a one-off key stands in its place (or, for a secret's box, a <div> carrying the key),
 * and after sanitising each marker is swapped for the element, made with exactly its attributes.
 * Typed text can't make one: it can't know the key, and a key is used once.
 */
export function renderMarkdown(text: string, o: RenderOptions): string {
  const key = oneOffKey()
  const held: { el: AppElement; raw: string }[] = []
  /** Holds back an inline element, returning its marker (`raw` is the source it came from). */
  const put = (el: AppElement, raw: string) => `${OPEN}${key}:${held.push({ el, raw }) - 1}${CLOSE}`
  /** A secret passage's box: it holds Markdown, so it goes through as a <div> carrying the key. */
  const box = (attrs: Record<string, string>, body: string) => `<div data-app="${key}:${held.push({ el: { tag: 'div', attrs }, raw: '' }) - 1}">\n\n${body}\n\n</div>`
  const byName = nameIndex(o.entities)
  // Passages inside passages are rendered the same way, so an inner secret stays hidden.
  const render = (t: string): string =>
    splitSecrets(t)
      .map((seg) => {
        if (seg.kind === 'text') return seg.body
        if (seg.kind === 'foryou') return box({ class: 'secret for-you' }, render(seg.body))
        if (!o.showSecrets && seg.kind === 'for' && seg.names.some((n) => o.viewer.has(n.toLowerCase()))) return box({ class: 'secret for-you' }, render(seg.body))
        if (!o.showSecrets) return ''
        if (seg.kind !== 'for') return box({ class: 'secret' }, render(seg.body))
        return box({ class: 'secret for-some', 'data-for': seg.names.join(', ') || 'nobody yet' }, render(seg.body))
      })
      .join('\n')
  // A player's words have no secret passages: ":::gm", ":::for" and ":::foryou" stay as typed, so
  // nobody can pass off a line as the GM's or as a secret "just for you".
  let src = o.playerWritten ? text : render(text)
  // Pictures from the world's files: filled in from this device's copy once on screen.
  src = src.replace(/!\[([^\]]*)\]\(asset:([0-9a-fA-F-]{36})\)/g, (raw, alt: string, id: string) => put({ tag: 'img', attrs: { class: 'inline-picture', 'data-asset': id, alt } }, raw))
  src = src.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (raw, name: string, label?: string) => {
    const target = byName.get(name.trim().toLowerCase())
    const shown = label ?? name
    // Only the GM's own view says which page a link was meant for: for players it may be a GM-only page.
    if (!target) return put({ tag: 'span', attrs: o.gmView ? { class: 'wikilink missing', title: 'No page yet', 'data-missing': name.trim() } : { class: 'wikilink missing' }, text: shown }, raw)
    // Where links go nowhere (the TV, a sheet to print), the name is plain words, not something to tap.
    if (o.stillLinks) return put({ tag: 'span', attrs: { class: 'wikilink still' }, text: shown }, raw)
    return put({ tag: 'a', attrs: { class: 'wikilink', href: hrefFor(pagePath(o.worldId, target.id)), 'data-internal': '1', 'data-id': target.id }, text: shown }, raw)
  })
  // `roll:1d8+3` and {{Table name}} become roll buttons (only in what's left after the secrets went).
  src = inlineRolls(src, o.entities.filter((e) => e.type === 'table'), o.stillLinks, put)
  const md = new Marked({
    renderer: {
      // HTML a player typed shows as they typed it, as plain text.
      html: ({ text: t, block }) => (o.playerWritten ? (block ? `<p>${escapeHtml(t)}</p>` : escapeHtml(t)) : t),
      // A "- [x]" list's boxes are the app's own (typed text can't have inputs).
      checkbox: ({ checked }) => `${put({ tag: 'input', attrs: { type: 'checkbox', disabled: '', ...(checked ? { checked: '' } : {}) } }, '')} `,
    },
  })
  const clean = DOMPurify.sanitize(md.parse(src, { async: false }), SANITISE)
  return putBack(clean, key, held, o.playerWritten)
}

/** Swaps the markers in sanitised HTML for the app's own elements (see renderMarkdown). */
function putBack(clean: string, key: string, held: { el: AppElement; raw: string }[], playerWritten?: boolean) {
  // A <template> is inert: nothing in it loads while it's worked on.
  const t = document.createElement('template')
  t.innerHTML = clean
  const doc = t.content.ownerDocument
  const used = new Set<number>()
  const take = (i: number) => {
    if (used.has(i) || !held[i]) return undefined
    used.add(i)
    return held[i]
  }
  const build = (el: AppElement): Element => {
    const n = doc.createElement(el.tag)
    for (const [k, v] of Object.entries(el.attrs)) n.setAttribute(k, v)
    if (el.text) n.textContent = el.text
    for (const c of el.children ?? []) n.append(build(c))
    return n
  }
  const words = (el: AppElement): string => el.text ?? (el.children ?? []).map(words).join('')
  // The secret boxes: a box keeps exactly the attributes the app gave it, and anything else that
  // claims to be one is a plain <div>.
  for (const el of t.content.querySelectorAll('[data-app]')) {
    const m = el.getAttribute('data-app')!.match(/^(\w+):(\d+)$/)
    el.removeAttribute('data-app')
    const it = m && m[1] === key ? take(Number(m[2])) : undefined
    if (it?.el.tag !== el.localName) continue
    for (const a of [...el.attributes]) el.removeAttribute(a.name)
    for (const [k, v] of Object.entries(it.el.attrs)) el.setAttribute(k, v)
  }
  // Typed pictures: GM-written text may show pictures from the web (https), a player's may not (a
  // picture loading tells its website who opened it, and when). Instead, a link to it.
  for (const img of t.content.querySelectorAll('img')) {
    const src = (img.getAttribute('src') ?? '').trim()
    if (!playerWritten && /^(https:\/\/|data:image\/)/i.test(src)) continue
    const alt = (img.getAttribute('alt') ?? '').trim() || 'picture'
    if (!/^https?:\/\//i.test(src)) {
      img.replaceWith(alt)
      continue
    }
    const a = doc.createElement('a')
    a.setAttribute('href', src)
    a.textContent = alt
    img.replaceWith(a)
  }
  // Typed links go where they say, as ordinary links (never dressed as [[links]]), without telling
  // the other website which page they were on.
  for (const a of t.content.querySelectorAll('a')) a.setAttribute('rel', 'noopener noreferrer')
  // The app's inline elements, in place of their markers.
  const marker = new RegExp(`${OPEN}${key}:(\\d+)${CLOSE}`, 'g')
  const walk = doc.createTreeWalker(t.content, NodeFilter.SHOW_TEXT)
  const found: Text[] = []
  for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.nodeValue?.includes(OPEN)) found.push(n as Text)
  for (const n of found) {
    const text = n.nodeValue!
    const inCode = !!n.parentElement?.closest('code, pre')
    // A typed link's words can't hold a link or a button of the app's (a click would do both).
    const inLink = !!n.parentElement?.closest('a')
    const parts: (string | Node)[] = []
    let last = 0
    for (const m of text.matchAll(marker)) {
      parts.push(text.slice(last, m.index))
      last = m.index + m[0].length
      const it = take(Number(m[1]))
      if (!it) continue
      // In code the source shows as written: `[[Name]]` stays `[[Name]]`.
      if (inCode) parts.push(it.raw)
      else if (inLink && it.el.tag !== 'img') parts.push(words(it.el))
      else parts.push(build(it.el))
    }
    parts.push(text.slice(last))
    n.replaceWith(...parts)
  }
  // A marker that ended up inside an attribute (a link's title, a picture's words) reads as its source.
  for (const el of t.content.querySelectorAll('*'))
    for (const a of [...el.attributes]) if (a.value.includes(OPEN)) el.setAttribute(a.name, a.value.replace(marker, (_m, i: string) => held[Number(i)]?.raw ?? ''))
  return t.innerHTML
}

/**
 * Renders Markdown with a few extras:
 *  - [[Entity Name]] or [[Entity Name|label]] links to that entity's page
 *  - :::gm ... ::: blocks are secrets, shown only to the GM
 *  - :::for Name ... ::: blocks are secrets for particular players' characters
 *  - `roll:1d8+3` and {{Table name}} roll buttons, and ![](asset:…) pictures from the world's files
 * Raw HTML in it is cut down to a few harmless tags (see SANITISE). Text a player wrote
 * (`playerWritten`: their character's own words, the party's notes) is stricter still: HTML shows
 * as typed, ":::" passages don't count, and pictures from other websites become links.
 */
export function Markdown({
  text,
  entities,
  worldId,
  showSecrets,
  stillLinks,
  playerWritten,
}: {
  text: string
  entities: Entity[]
  worldId: string
  showSecrets: boolean
  /** Links don't open anything (the players' screen on a TV, where a click would leave the player view). */
  stillLinks?: boolean
  /** A player wrote it (not the GM, the app or Claude): see above. */
  playerWritten?: boolean
}) {
  const navigate = useNavigate()
  // Previewing as one player: passages for their characters show as they would for them.
  const { previewAs, isGM } = useViewMode()
  const gmView = isGM && !previewAs
  // The GM can click a link to a page that doesn't exist yet to make it.
  const [making, setMaking] = useState<{ name: string; left: number; top: number }>()
  const forViewer = (previewAs ? characterNames(previewAs.characterNames) : []).join('\n')
  const html = useMemo(
    () => renderMarkdown(text, { entities, worldId, showSecrets, stillLinks, playerWritten, gmView, viewer: new Set(forViewer.split('\n').filter(Boolean)) }),
    [text, entities, worldId, showSecrets, forViewer, stillLinks, playerWritten, gmView],
  )

  // Hovering a link shows a peek at the page it goes to.
  const [peek, setPeek] = useState<{ entity: Entity; left: number; top: number; below: boolean }>()
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const urls: string[] = []
    let live = true
    for (const img of box.current?.querySelectorAll<HTMLImageElement>('img[data-asset]') ?? [])
      db.assets.get(img.dataset.asset!).then((a) => {
        if (!live) return
        if (!a) return void (img.alt = img.alt ? `${img.alt} (picture not on this device yet)` : 'Picture not on this device yet')
        const u = URL.createObjectURL(a.blob)
        urls.push(u)
        img.src = u
      })
    return () => {
      live = false
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [html])
  const linkAt = (t: EventTarget) => (t as HTMLElement).closest?.('a.wikilink[data-id]') as HTMLAnchorElement | null

  return (
    <>
      <div
        ref={box}
        className="markdown"
        onClick={(ev) => {
          if (!stillLinks && clickInlineRoll(ev.target as HTMLElement, { tables: entities.filter((e) => e.type === 'table'), showSecrets, isGM: gmView, worldId })) return
          const missing = (ev.target as HTMLElement).closest('[data-missing]') as HTMLElement | null
          if (missing && gmView && !stillLinks) {
            const r = missing.getBoundingClientRect()
            setMaking({ name: missing.dataset.missing!, left: Math.max(12, Math.min(r.left, window.innerWidth - 332)), top: r.bottom + 230 > window.innerHeight ? Math.max(12, r.top - 226) : r.bottom + 6 })
            return
          }
          const a = (ev.target as HTMLElement).closest('a[data-internal]') as HTMLAnchorElement | null
          if (a) {
            ev.preventDefault()
            setPeek(undefined)
            // Only ever to a page of this world, found by its id: never to wherever the link's address points.
            const page = entities.find((e) => e.id === a.dataset.id)
            if (page && !stillLinks) navigate(pagePath(worldId, page.id))
          }
        }}
        onMouseOver={(ev) => {
          const a = linkAt(ev.target)
          if (!a) return
          const entity = entities.find((e) => e.id === a.dataset.id)
          if (!entity) return
          clearTimeout(timer.current)
          timer.current = setTimeout(() => {
            const r = a.getBoundingClientRect()
            const below = window.innerHeight - r.bottom > 260
            const left = Math.max(12, Math.min(r.left, window.innerWidth - 332))
            setPeek({ entity, left, top: below ? r.bottom + 6 : r.top - 6, below })
          }, 350)
        }}
        onMouseOut={(ev) => {
          if (!linkAt(ev.target)) return
          clearTimeout(timer.current)
          setPeek(undefined)
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {peek && <LinkPeek {...peek} />}
      {making && <MakePagePopover worldId={worldId} {...making} onClose={() => setMaking(undefined)} />}
    </>
  )
}

/** The little card shown when hovering a [[link]]: picture, type, summary and the start of the page. */
function LinkPeek({ entity: e, left, top, below }: { entity: Entity; left: number; top: number; below: boolean }) {
  const image = useAssetUrl(e.imageId)
  // Never secrets, even for the GM: the peek is a quick reminder, not the page.
  const text = plainLinks(stripSecrets(e.body))
    .replace(/[#>*_`~[\]()|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return (
    <div className="link-peek" style={below ? { left, top } : { left, top, transform: 'translateY(-100%)' }} role="tooltip">
      {image && <img src={image} alt="" />}
      <div>
        <div className="muted small">
          <TypeIcon type={e.type} /> {ENTITY_LABELS[e.type].one}
        </div>
        <strong>{e.name}</strong> {e.status && <StatusBadge entity={e} />}
        {e.summary && <p className="small">{plainLinks(e.summary)}</p>}
        {text && <p className="muted small">{text.length > 220 ? `${text.slice(0, 220)}…` : text}</p>}
      </div>
    </div>
  )
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/** Entities whose page links to the given entity, for "mentioned in" backlinks. Links in hidden passages only count for the GM. */
export function findBacklinks(target: Entity, entities: Entity[], isGM = true) {
  const needles = new Set(namesOf(target))
  if (!needles.size) return []
  return entities.filter(
    (e) =>
      e.id !== target.id &&
      [...(isGM ? e.body : stripSecrets(e.body)).matchAll(/\[\[([^\]|]+)/g)].some((m) => needles.has(m[1].trim().toLowerCase())),
  )
}

/**
 * Hidden parts of an entity are removed for players; used for previews and exports. A ":::foryou"
 * passage only exists in a player's own copy (the server picked it for them), so it stays.
 */
export function stripSecrets(text: string) {
  return splitSecrets(text)
    .filter((seg) => seg.kind === 'text' || seg.kind === 'foryou')
    .map((seg) => seg.body)
    .join('\n')
}

/**
 * Wraps text the app puts into a page as a GM-only passage (notes from a notebook, a "Secret" from
 * Claude's flavour, the session log's GM-only lines) in ":::gm" … ":::". None of its own lines can
 * end the passage early, or open another: a line starting ":::" gets a backslash in front, so
 * neither the app nor the server (public.player_text) reads it as a marker, and Markdown still
 * shows it as ":::". If players would still get any of it, this throws instead, so it isn't saved.
 */
export function gmBlock(text: string) {
  const inner = text
    .split(/\r\n?|\n/)
    .map((line) => line.replace(/^([ \t]*):::/, '$1\\:::'))
    .join('\n')
  const block = `:::gm\n${inner}\n:::`
  if (stripSecrets(block).trim()) throw new Error('That text wouldn’t have stayed GM only, so it wasn’t added.')
  return block
}
