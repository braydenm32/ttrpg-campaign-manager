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
