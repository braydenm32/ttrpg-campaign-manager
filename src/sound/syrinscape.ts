import { useSyncExternalStore } from 'react'

/**
 * Syrinscape remote control. The GM keeps Syrinscape's online player open (in another tab or its
 * app); the soundboard sends it play and stop commands. Commands need the GM's own Syrinscape
 * auth token, which stays on this device only (never synced or backed up), like the AI keys.
 * See https://docs.syrinscape.com/http-reference/
 */

const KEY = 'codex.syrinscapeToken'
const API = 'https://syrinscape.com/online/frontend-api'
const listeners = new Set<() => void>()

const token = () => {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export interface SyrinscapeRef {
  kind: 'mood' | 'element'
  id: string
}

/**
 * Reads a mood or element from what the GM pastes: a remote control link copied from Syrinscape
 * (…/frontend-api/moods/1234/play/), a link to it on syrinscape.com, or "mood 1234".
 */
export function parseSyrinscape(text: string): SyrinscapeRef | null {
  const t = text.trim()
  const m = t.match(/\b(moods?|elements?)[/:\s#-]+(\d+)/i)
  if (m) return { kind: m[1].toLowerCase().startsWith('mood') ? 'mood' : 'element', id: m[2] }
  return null
}

async function post(path: string) {
  const t = token()
  if (!t) throw new Error('Add your Syrinscape auth token on the Soundboard page first.')
  // Syrinscape doesn't say whether browsers may read its replies, so the command is sent without
  // waiting to read one. It still reaches Syrinscape; check its player if nothing plays.
  await fetch(`${API}/${path}?auth_token=${encodeURIComponent(t)}`, { method: 'POST', mode: 'no-cors' })
}

/** A soundset in the GM's Syrinscape library (the ones their account can play). */
export interface SyrinscapeSoundset {
  uuid: string
  name: string
  category: string
}

/** One of a soundset's moods: its number is what play and stop need. */
export interface SyrinscapeMood {
  id: string
  name: string
  order: number
}

async function get<T>(path: string, query = ''): Promise<T> {
  const t = token()
  if (!t) throw new Error('Add your Syrinscape auth token first.')
  let r: Response
  try {
    r = await fetch(`${API}/${path}?format=json${query}&auth_token=${encodeURIComponent(t)}`)
  } catch {
    throw new Error('Couldn’t reach Syrinscape. Check you’re online and try again.')
  }
  if (r.status === 400 || r.status === 401 || r.status === 403)
    throw new Error('Syrinscape didn’t accept your token. Copy it again from syrinscape.com/account/auth-token and save it here.')
  if (!r.ok) throw new Error(`Syrinscape didn’t answer (error ${r.status}). Try again in a minute.`)
  return (await r.json()) as T
}

const listOf = <T>(data: unknown): T[] => (Array.isArray(data) ? data : ((data as { results?: T[] })?.results ?? []))

// Kept while the app is open, so switching soundsets back and forth doesn't ask Syrinscape again
// (its guide asks apps to fetch moods one soundset at a time, only when needed).
let soundsetCache: { token: string; list: Promise<SyrinscapeSoundset[]> } | null = null
const moodCache = new Map<string, Promise<SyrinscapeMood[]>>()

/** The soundsets in the GM's Syrinscape library, by name. */
export function listSoundsets(fresh = false): Promise<SyrinscapeSoundset[]> {
  const t = token()
  if (fresh || !soundsetCache || soundsetCache.token !== t) {
    const list = get<unknown>('soundsets/').then((data) =>
      listOf<{ uuid?: string; name?: string; full_name?: string; category?: string }>(data)
        .filter((s) => s.uuid)
        .map((s) => ({ uuid: String(s.uuid), name: String(s.name || s.full_name || 'Untitled soundset'), category: String(s.category ?? '') }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    )
    list.catch(() => (soundsetCache = null))
    soundsetCache = { token: t, list }
    if (fresh) moodCache.clear()
  }
  return soundsetCache.list
}

/** A soundset's moods, in Syrinscape's order. */
export function listMoods(soundsetUuid: string): Promise<SyrinscapeMood[]> {
  const key = `${token()}|${soundsetUuid}`
  let list = moodCache.get(key)
  if (!list) {
    list = get<unknown>('moods/', `&soundset__uuid=${encodeURIComponent(soundsetUuid)}`).then((data) =>
      listOf<{ pk?: number | string; id?: number | string; name?: string; order?: number }>(data)
        .filter((m) => m.pk ?? m.id)
        .map((m, i) => ({ id: String(m.pk ?? m.id), name: String(m.name || 'Untitled mood'), order: typeof m.order === 'number' ? m.order : i }))
        .sort((a, b) => a.order - b.order),
    )
    list.catch(() => moodCache.delete(key))
    moodCache.set(key, list)
  }
  return list
}

/** Which soundset the GM last opened in a world, remembered on this device. */
const setKey = (worldId: string) => `codex.syrinscapeSoundset.${worldId}`
const setListeners = new Set<() => void>()
/** Used when the browser won't keep anything (a private window, say): the choice lasts until the app closes. */
const chosenHere = new Map<string, string>()
const readSet = (worldId: string) => {
  try {
    return localStorage.getItem(setKey(worldId)) ?? chosenHere.get(worldId) ?? ''
  } catch {
    return chosenHere.get(worldId) ?? ''
  }
}
export function useChosenSoundset(worldId: string): [SyrinscapeSoundset | null, (s: SyrinscapeSoundset | null) => void] {
  const raw = useSyncExternalStore(
    (l) => {
      setListeners.add(l)
      return () => setListeners.delete(l)
    },
    () => readSet(worldId),
  )
  let chosen: SyrinscapeSoundset | null = null
  try {
    chosen = raw ? (JSON.parse(raw) as SyrinscapeSoundset) : null
  } catch {
    chosen = null
  }
  const choose = (s: SyrinscapeSoundset | null) => {
    if (s) chosenHere.set(worldId, JSON.stringify(s))
    else chosenHere.delete(worldId)
    try {
      if (s) localStorage.setItem(setKey(worldId), JSON.stringify(s))
      else localStorage.removeItem(setKey(worldId))
    } catch {
      // Storage blocked: the choice lasts until the page closes.
    }
    setListeners.forEach((l) => l())
  }
  return [chosen, choose]
}

export const syrinscape = {
  token,
  setToken(v: string) {
    try {
      if (v.trim()) localStorage.setItem(KEY, v.trim())
      else localStorage.removeItem(KEY)
    } catch {
      // Storage blocked: the token can't be kept.
    }
    listeners.forEach((l) => l())
  },
  send: (ref: SyrinscapeRef, action: 'play' | 'stop') => post(`${ref.kind}s/${encodeURIComponent(ref.id)}/${action}/`),
  stopAll: () => post('stop-all/'),
}

export function useSyrinscapeToken() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    token,
  )
}
