import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Entity } from './db'

/**
 * A secret block runs from a ":::gm" line to the next ":::" line. If the closing line is missing,
 * everything after ":::gm" stays secret, so a typo never leaks. Keep in step with
 * public.strip_gm_blocks in supabase/migrations, which applies the same rule to share links.
 */
export const GM_BLOCK = /^:::gm[ \t]*((?:\n.*)*?)(?:\n:::[ \t]*$|$(?![\s\S]))/gm

/**
 * ":::for Wren, Kael" ... ":::" is a secret for the players of those characters only. The server
 * (public.player_text) keeps it for them, relabelled ":::foryou", and drops it for everyone else.
 */
export const FOR_BLOCK = /^:::for[ \t]+(\S[^\n]*)((?:\n.*)*?)(?:\n:::[ \t]*$|$(?![\s\S]))/gm
const FOR_YOU_BLOCK = /^:::foryou[ \t]*((?:\n.*)*?)(?:\n:::[ \t]*$|$(?![\s\S]))/gm

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
  const html = useMemo(() => {
    const byName = new Map(entities.map((e) => [e.name.trim().toLowerCase(), e]))
    let src = text.replace(GM_BLOCK, (_m, inner: string) =>
      showSecrets ? `<div class="secret">\n\n${inner}\n\n</div>` : '',
    )
    src = src.replace(FOR_YOU_BLOCK, (_m, inner: string) => `<div class="secret for-you">\n\n${inner}\n\n</div>`)
    src = src.replace(FOR_BLOCK, (_m, names: string, inner: string) =>
      showSecrets ? `<div class="secret for-some" data-for="${escapeHtml(names.trim())}">\n\n${inner}\n\n</div>` : '',
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
  return text.replace(GM_BLOCK, '').replace(FOR_BLOCK, '')
}
