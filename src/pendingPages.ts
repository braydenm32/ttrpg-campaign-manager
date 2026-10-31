import type { NavigateFunction } from 'react-router-dom'
import type { Entity } from './db'
import { pagePath } from './paths'

/**
 * A new page waits here, not in the world, until it's saved: "+ New NPC" opens the editor on it,
 * and leaving without writing anything leaves nothing behind. Kept for this tab only (so a reload
 * still finds it), and never in a backup or a player's copy.
 */
const held = new Map<string, Entity>()
const KEY = 'page.new.'

export function holdNewPage(e: Entity) {
  held.set(e.id, e)
  try {
    sessionStorage.setItem(KEY + e.id, JSON.stringify(e))
  } catch {
    // Kept in memory only: fine until a reload.
  }
}

/** The new page with this id, if it's waiting to be saved. */
export function heldPage(id: string): Entity | undefined {
  const mine = held.get(id)
  if (mine) return mine
  try {
    const raw = sessionStorage.getItem(KEY + id)
    return raw ? (JSON.parse(raw) as Entity) : undefined
  } catch {
    return undefined
  }
}

export function dropHeldPage(id: string) {
  held.delete(id)
  try {
    sessionStorage.removeItem(KEY + id)
  } catch {
    // Nothing kept.
  }
}

/** Opens the editor on a new page that isn't saved yet. `?new=1` marks it new, so Cancel simply drops it. */
export function openNewPage(navigate: NavigateFunction, e: Entity) {
  holdNewPage(e)
  navigate(`${pagePath(e.worldId, e.id)}?edit=1&new=1`)
}
