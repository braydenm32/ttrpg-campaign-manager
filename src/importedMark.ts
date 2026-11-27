import { useSyncExternalStore } from 'react'

/**
 * Whether notes or pages have been brought into a world on this device (the page importer, or
 * hand-written notes read by Claude). Getting started's first step ticks on this, not on the world
 * merely having pages. Kept on the device, per world, like the rest of that card's memory.
 */

const key = (worldId: string) => `gettingStarted.imported.${worldId}`
const listeners = new Set<() => void>()
/** Marked while this tab is open, for when storage is blocked. */
const marked = new Set<string>()

function stored(worldId: string) {
  try {
    return localStorage.getItem(key(worldId)) === '1'
  } catch {
    return false
  }
}

/** Notes that something was imported into this world. */
export function markImported(worldId: string) {
  marked.add(worldId)
  try {
    localStorage.setItem(key(worldId), '1')
  } catch {
    // Private window or storage blocked: it lasts until the page closes.
  }
  listeners.forEach((l) => l())
}

/** Whether something has been imported into this world on this device. */
export function useImported(worldId: string) {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => marked.has(worldId) || stored(worldId),
  )
}
