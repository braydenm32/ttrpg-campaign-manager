import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ENTITY_LABELS, type Entity } from './db'
import { useAssetUrl } from './hooks'
import { StatusBadge } from './status'
import { plainLinks } from './text'
import { characterNames, useViewMode } from './viewMode'

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

/**
 * Splits text into ordinary text and secret passages, line by line:
 *  - ":::gm" up to a ":::" line is for the GM only. Any line starting ":::gm" opens one, even with
 *    text after it, and a missing closing line keeps the rest secret, so a typo never leaks.
 *  - ":::for Wren and Silas" up to ":::" is for the players of those characters only.
 *  - Either fits on one line too: ":::gm::: The innkeeper is a spy :::".
 *  - ":::foryou" is what a player's copy holds for a ":::for" passage meant for them.
 * Keep in step with public.player_text in supabase/migrations, which decides what players receive.
 */
export function splitSecrets(text: string): Segment[] {
  const out: Segment[] = []
  let open: Segment | null = null
  const push = (kind: 'text', line: string) => {
    const last = out[out.length - 1]
    if (last?.kind === kind) last.body += '\n' + line
    else out.push({ kind, body: line })
  }
  for (const line of text.split('\n')) {
    if (open) {
      if (/^:::[ \t]*$/.test(line)) {
        out.push(open)
        open = null
      } else open.body += (open.body ? '\n' : '') + line
      continue
    }
    const forLine = line.match(/^:::for[ \t]+(.+?):::(.*):::[ \t]*$/)
    if (/^:::gm\b/.test(line)) {
      const one = line.match(/^:::gm\b[: \t]*([^: \t].*?)[ \t]*:::[ \t]*$/)
      if (one) out.push({ kind: 'gm', body: one[1] })
      else open = { kind: 'gm', body: line.replace(/^:::gm\b[: \t]*/, '') }
    } else if (/^:::foryou\b/.test(line)) {
      open = { kind: 'foryou', body: '' }
    } else if (forLine) {
      out.push({ kind: 'for', names: forNames(forLine[1]), body: forLine[2].trim() })
    } else if (/^:::for(?=[ \t:]|$)/.test(line)) {
      // With no names yet it's a secret for nobody, never for everyone.
      open = { kind: 'for', names: forNames(line.replace(/^:::for[ \t:]*/, '')), body: '' }
    } else push('text', line)
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
}: {
  text: string
  entities: Entity[]
  worldId: string
  showSecrets: boolean
}) {
  const navigate = useNavigate()
  // Previewing as one player: passages for their characters show as they would for them.
  const { previewAs } = useViewMode()
  const forViewer = (previewAs ? characterNames(previewAs.characterNames) : []).join('\n')
  const html = useMemo(() => {
    const viewer = new Set(forViewer.split('\n').filter(Boolean))
    const byName = new Map(entities.map((e) => [e.name.trim().toLowerCase(), e]))
    let src = splitSecrets(text)
      .map((seg) => {
        if (seg.kind === 'text') return seg.body
        if (seg.kind === 'foryou') return `<div class="secret for-you">\n\n${seg.body}\n\n</div>`
        if (!showSecrets && seg.kind === 'for' && seg.names.some((n) => viewer.has(n.toLowerCase())))
          return `<div class="secret for-you">\n\n${seg.body}\n\n</div>`
        if (!showSecrets) return ''
        if (seg.kind !== 'for') return `<div class="secret">\n\n${seg.body}\n\n</div>`
        return `<div class="secret for-some" data-for="${escapeHtml(seg.names.join(', ') || 'nobody yet')}">\n\n${seg.body}\n\n</div>`
      })
      .join('\n')
    src = src.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, name: string, label?: string) => {
      const target = byName.get(name.trim().toLowerCase())
      const shown = escapeHtml(label ?? name)
      if (!target) return `<span class="wikilink missing" title="No page yet">${shown}</span>`
      return `<a class="wikilink" href="#/w/${worldId}/e/${target.id}" data-internal="1" data-id="${target.id}">${shown}</a>`
    })
    return DOMPurify.sanitize(marked.parse(src, { async: false }) as string)
  }, [text, entities, worldId, showSecrets, forViewer])

  // Hovering a link shows a peek at the page it goes to.
  const [peek, setPeek] = useState<{ entity: Entity; left: number; top: number; below: boolean }>()
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const linkAt = (t: EventTarget) => (t as HTMLElement).closest?.('a.wikilink[data-id]') as HTMLAnchorElement | null

  return (
    <>
      <div
        className="markdown"
        onClick={(ev) => {
          const a = (ev.target as HTMLElement).closest('a[data-internal]') as HTMLAnchorElement | null
          if (a) {
            ev.preventDefault()
            setPeek(undefined)
            navigate(a.getAttribute('href')!.slice(1))
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
          {ENTITY_LABELS[e.type].icon} {ENTITY_LABELS[e.type].one}
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

/** Entities whose page links to the given entity, for "mentioned in" backlinks. */
export function findBacklinks(target: Entity, entities: Entity[]) {
  const needle = target.name.trim().toLowerCase()
  if (!needle) return []
  return entities.filter(
    (e) =>
      e.id !== target.id &&
      [...e.body.matchAll(/\[\[([^\]|]+)/g)].some((m) => m[1].trim().toLowerCase() === needle),
  )
}

/** Hidden parts of an entity are removed for players; used for previews and exports. */
export function stripSecrets(text: string) {
  return splitSecrets(text)
    .filter((seg) => seg.kind === 'text')
    .map((seg) => seg.body)
    .join('\n')
}
