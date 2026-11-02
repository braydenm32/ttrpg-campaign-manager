import { useEffect, useSyncExternalStore } from 'react'
import type { Entity } from './db'

/**
 * Pages opened lately, newest first, per world and kept on this device only (never in a world, a
 * backup or the cloud). The search box shows them before anything is typed, and the Desk's Today
 * has a short row of them, so the five pages a GM flips between during prep are one tap away.
 * Only ids are kept; whoever is looking sees only those pages they can see anyway.
 */

const MAX = 10
const key = (worldId: string) => `atlas.recentPages.${worldId}`

let version = 0
const listeners = new Set<() => void>()
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function recentPageIds(worldId: string): string[] {
  try {
    const ids = JSON.parse(localStorage.getItem(key(worldId)) ?? '[]')
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Puts a page at the front of the list. */
export function notePageOpened(worldId: string, entityId: string) {
  const ids = [entityId, ...recentPageIds(worldId).filter((x) => x !== entityId)].slice(0, MAX)
  try {
    localStorage.setItem(key(worldId), JSON.stringify(ids))
  } catch {
    // A private window: nothing remembered, which is fine.
  }
  version++
  listeners.forEach((l) => l())
}

/** Remembers a page as opened once it's shown. */
export function useNoteOpened(worldId: string, entityId: string | undefined) {
  useEffect(() => {
    if (entityId) notePageOpened(worldId, entityId)
  }, [worldId, entityId])
}

/** The recently opened pages among `visible` (what this viewer can see), newest first. */
export function useRecentPages(worldId: string, visible: Entity[], limit = MAX, skip?: string): Entity[] {
  useSyncExternalStore(subscribe, () => version)
  const byId = new Map(visible.map((e) => [e.id, e]))
  return recentPageIds(worldId)
    .filter((id) => id !== skip)
    .map((id) => byId.get(id))
    .filter((e): e is Entity => !!e && !e.template)
    .slice(0, limit)
}
