import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Entity } from './db'

/**
 * Renders GM-authored Markdown with two extras:
 *  - [[Entity Name]] or [[Entity Name|label]] links to that entity's page
 *  - :::gm ... ::: blocks are secrets, shown only to the GM
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
  const html = useMemo(() => {
    const byName = new Map(entities.map((e) => [e.name.trim().toLowerCase(), e]))
    let src = text.replace(/^:::gm\s*\n([\s\S]*?)\n:::\s*$/gm, (_m, inner: string) =>
      showSecrets ? `<div class="secret">\n\n${inner}\n\n</div>` : '',
    )
    src = src.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, name: string, label?: string) => {
      const target = byName.get(name.trim().toLowerCase())
      const shown = escapeHtml(label ?? name)
      if (!target) return `<span class="wikilink missing" title="No page yet">${shown}</span>`
      return `<a class="wikilink" href="#/w/${worldId}/e/${target.id}" data-internal="1">${shown}</a>`
    })
    return DOMPurify.sanitize(marked.parse(src, { async: false }) as string)
  }, [text, entities, worldId, showSecrets])

  return (
    <div
      className="markdown"
      onClick={(ev) => {
        const a = (ev.target as HTMLElement).closest('a[data-internal]') as HTMLAnchorElement | null
        if (a) {
          ev.preventDefault()
          navigate(a.getAttribute('href')!.slice(1))
        }
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
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
  return text.replace(/^:::gm\s*\n[\s\S]*?\n:::\s*$/gm, '')
}
