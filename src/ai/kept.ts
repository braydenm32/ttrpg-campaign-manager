import { useState, useSyncExternalStore } from 'react'

/**
 * What a Claude panel is showing (a suggestion, an answer, lines to keep), held outside the panel so
 * it is still there after the GM goes to another page and comes back. Kept for this browser tab
 * only (session storage), never in the world, a backup or the cloud: it can quote secrets.
 */

const PREFIX = 'codex.kept.'
const values = new Map<string, unknown>()
const listeners = new Set<() => void>()

export function getKept<T>(key: string): T | undefined {
  if (!values.has(key)) {
    let v: unknown
    try {
      const raw = sessionStorage.getItem(PREFIX + key)
      v = raw === null ? undefined : JSON.parse(raw)
    } catch {
      v = undefined
    }
    values.set(key, v)
  }
  return values.get(key) as T | undefined
}

function remember(key: string, value: unknown) {
  values.set(key, value)
  try {
    if (value === undefined) sessionStorage.removeItem(PREFIX + key)
    else sessionStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Too big for session storage, or storage blocked: it lasts until the page closes.
  }
}

/** Sets (or, with undefined, forgets) one kept value. */
export function setKept<T>(key: string, value: T | undefined) {
  remember(key, value)
  listeners.forEach((l) => l())
}

/** Like useState, but the value outlives the panel (see above). The first value is kept too, so a random first roll stays the same. */
export function useKept<T>(key: string, init: T | (() => T)) {
  const [fallback] = useState(() => {
    const was = getKept<T>(key)
    if (was !== undefined) return was
    const first = typeof init === 'function' ? (init as () => T)() : init
    if (first !== undefined) remember(key, first)
    return first
  })
  const value = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => getKept<T>(key),
  )
  const current = value === undefined ? fallback : value
  const set = (next: T | ((old: T) => T)) => {
    const old = getKept<T>(key)
    setKept(key, typeof next === 'function' ? (next as (old: T) => T)(old === undefined ? fallback : old) : next)
  }
  return [current, set] as const
}
