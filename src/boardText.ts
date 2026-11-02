import { blankEntity, db, type Board, type BoardCard, type Entity } from './db'

/** A card as words: the page's name as a link, or the note's text (shortened when it's only naming one end of a string). */
function cardWords(c: BoardCard | undefined, byId: Map<string, Entity>, short = false) {
  if (!c) return 'a card that’s gone'
  const page = c.entityId ? byId.get(c.entityId) : undefined
  if (page) return `[[${page.name}]]`
  if (c.entityId) return 'a page that’s been deleted'
  const text = (c.text ?? '').replace(/\s+/g, ' ').trim() || 'an empty note'
  return short && text.length > 50 ? `“${text.slice(0, 48).trim()}…”` : `“${text}”`
}

/**
 * A corkboard written out as a page's text: every card (pages as links, notes as quotes), top to
 * bottom and left to right as they sit on the board, then every string with its label. Corkboards
 * are retired, so this is how one is kept.
 */
export function boardAsText(board: Board, byId: Map<string, Entity>) {
  const cards = [...board.cards].sort((a, b) => a.y - b.y || a.x - b.x)
  const card = new Map(board.cards.map((c) => [c.id, c]))
  const lines = [`Copied from the corkboard “${board.name}”.`, '', '### On the board']
  for (const c of cards) {
    const page = c.entityId ? byId.get(c.entityId) : undefined
    lines.push(`- ${cardWords(c, byId)}${page?.summary ? `: ${page.summary}` : ''}`)
  }
  if (!cards.length) lines.push('- Nothing was pinned on it.')
  if (board.strings.length) {
    lines.push('', '### Strings between them')
    for (const s of board.strings) lines.push(`- ${cardWords(card.get(s.from), byId, true)} → ${cardWords(card.get(s.to), byId, true)}${s.label ? ` (${s.label})` : ''}`)
  }
  return lines.join('\n')
}

/** Turns a corkboard into a new GM-only lore page with its cards and strings as text. Returns the page. */
export async function copyBoardIntoPage(board: Board, byId: Map<string, Entity>) {
  const page = blankEntity(board.worldId, 'lore', board.name)
  page.summary = 'Copied from a corkboard.'
  page.body = boardAsText(board, byId)
  page.tags = ['corkboard']
  await db.entities.add(page)
  return page
}
