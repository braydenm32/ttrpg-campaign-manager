import DOMPurify from 'dompurify'
import { marked } from 'marked'
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
  for (const line of text.split(/\r?\n/)) {
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
 * Renders GM-authored Markdown with two extras:
 *  - [[Entity Name]] or [[Entity Name|label]] links to that entity's page
 *  - :::gm ... ::: blocks are secrets, shown only to the GM
 *  - :::for Name ... ::: blocks are secrets for particular players' characters
 */
export function Markdown({
  text,
  entities,
  worldId,
  showSecrets,
  stillLinks,
}: {
  text: string
  entities: Entity[]
  worldId: string
  showSecrets: boolean
  /** Links don't open anything (the players' screen on a TV, where a click would leave the player view). */
  stillLinks?: boolean
}) {
  const navigate = useNavigate()
  // Previewing as one player: passages for their characters show as they would for them.
  const { previewAs, isGM } = useViewMode()
  // The GM can click a link to a page that doesn't exist yet to make it.
  const [making, setMaking] = useState<{ name: string; left: number; top: number }>()
  const forViewer = (previewAs ? characterNames(previewAs.characterNames) : []).join('\n')
  const html = useMemo(() => {
    const viewer = new Set(forViewer.split('\n').filter(Boolean))
    const byName = nameIndex(entities)
    // Passages inside passages are rendered the same way, so an inner secret stays hidden.
    const render = (t: string): string =>
      splitSecrets(t)
        .map((seg) => {
          if (seg.kind === 'text') return seg.body
          if (seg.kind === 'foryou') return `<div class="secret for-you">\n\n${render(seg.body)}\n\n</div>`
          if (!showSecrets && seg.kind === 'for' && seg.names.some((n) => viewer.has(n.toLowerCase())))
            return `<div class="secret for-you">\n\n${render(seg.body)}\n\n</div>`
          if (!showSecrets) return ''
          if (seg.kind !== 'for') return `<div class="secret">\n\n${render(seg.body)}\n\n</div>`
          return `<div class="secret for-some" data-for="${escapeHtml(seg.names.join(', ') || 'nobody yet')}">\n\n${render(seg.body)}\n\n</div>`
        })
        .join('\n')
    let src = render(text)
    // Pictures from the world's files: filled in from this device's copy once on screen.
    src = src.replace(/!\[([^\]]*)\]\(asset:([0-9a-fA-F-]{36})\)/g, (_m, alt: string, id: string) => `<img class="inline-picture" data-asset="${id}" alt="${escapeHtml(alt)}">`)
    src = src.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, name: string, label?: string) => {
      const target = byName.get(name.trim().toLowerCase())
      const shown = escapeHtml(label ?? name)
      if (!target) return `<span class="wikilink missing" title="No page yet" data-missing="${escapeHtml(name.trim())}">${shown}</span>`
      return `<a class="wikilink" href="${hrefFor(pagePath(worldId, target.id))}" data-internal="1" data-id="${target.id}">${shown}</a>`
    })
    return DOMPurify.sanitize(marked.parse(src, { async: false }) as string)
  }, [text, entities, worldId, showSecrets, forViewer])

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
          const missing = (ev.target as HTMLElement).closest('[data-missing]') as HTMLElement | null
          if (missing && isGM && !stillLinks && !previewAs) {
            const r = missing.getBoundingClientRect()
            setMaking({ name: missing.dataset.missing!, left: Math.max(12, Math.min(r.left, window.innerWidth - 332)), top: r.bottom + 230 > window.innerHeight ? Math.max(12, r.top - 226) : r.bottom + 6 })
            return
          }
          const a = (ev.target as HTMLElement).closest('a[data-internal]') as HTMLAnchorElement | null
          if (a) {
            ev.preventDefault()
            setPeek(undefined)
            if (!stillLinks) navigate(a.getAttribute('href')!.replace(/^#/, ''))
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
