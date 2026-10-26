import { createClient } from '@supabase/supabase-js'

/**
 * Connection to the Campaign Codex cloud (Supabase). These two values are public by design:
 * the database's security rules decide what each signed-in person can read or write.
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://ysrxumagiiaoihlhofqt.supabase.co'
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_HsmvijuCGe53E9WU5N2ZQA_1EGPpGt1'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** Where the public web app lives; used for share links made from the desktop app or a dev server. */
export const PUBLIC_APP_URL = 'https://braydenm32.github.io/ttrpg-campaign-manager/'

export function appUrl() {
  const { protocol, hostname, origin, pathname } = window.location
  if (protocol.startsWith('http') && hostname !== 'localhost' && hostname !== '127.0.0.1') return origin + pathname
  return PUBLIC_APP_URL
}

/**
 * A plain-words message for a failed cloud call. The free server falls asleep after about a week
 * with nobody using it (a weekly keep-alive normally stops that), and then every call fails the same
 * way, so that case gets its own explanation.
 */
export function cloudErrorMessage(e: unknown) {
  const msg = (e as Error)?.message ?? String(e)
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'You’re offline. Your copy on this device still works, and it will catch up when you’re back online.'
  if (/failed to fetch|networkerror|load failed|network request failed|paused|status of 54\d|fetch/i.test(msg))
    return 'Can’t reach the Campaign Codex server right now. If nobody has used it for about a week it may be asleep: the GM can wake it by opening their Supabase dashboard (it takes a minute). Your copy on this device still works.'
  return msg
}
