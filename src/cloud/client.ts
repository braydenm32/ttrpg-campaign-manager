import { createClient } from '@supabase/supabase-js'

/**
 * Connection to the Warded Atlas cloud (Supabase). These two values are public by design:
 * the database's security rules decide what each signed-in person can read or write.
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://ysrxumagiiaoihlhofqt.supabase.co'
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_HsmvijuCGe53E9WU5N2ZQA_1EGPpGt1'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** Where the public web app lives; used for share links made from the desktop app or a dev server. */
export const PUBLIC_APP_URL = 'https://wardedatlas.com/'

const OLD_HOST = 'braydenm32.github.io'

/** The app's front page, where sign-in comes back to. */
export function appUrl() {
  const { protocol, hostname, origin, pathname } = window.location
  // The old GitHub Pages address lives in a folder and only knows "#/" addresses.
  if (hostname === OLD_HOST) return origin + pathname
  if (protocol.startsWith('http') && hostname !== 'localhost' && hostname !== '127.0.0.1') return origin + '/'
  return PUBLIC_APP_URL
}

/** A full link to a place in the app, e.g. appLink('/join/abc'), for share and invite links and emails. */
export function appLink(path: string) {
  return window.location.hostname === OLD_HOST ? `${appUrl()}#${path}` : appUrl() + path.slice(1)
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
    return 'Can’t reach the Warded Atlas server right now. If nobody has used it for about a week it may be asleep: the GM can wake it by opening their Supabase dashboard (it takes a minute). Your copy on this device still works.'
  if (/row-level security|permission denied|violates.*policy/i.test(msg))
    return 'The cloud didn’t allow that: this world’s cloud copy may have been deleted on another device, or you may no longer be one of its GMs.'
  if (/jwt expired|invalid jwt|refresh token|not authenticated/i.test(msg)) return 'Your sign-in has run out. Sign in again (Cloud settings) and it will carry on.'
  if (/payload too large|request entity too large|maximum allowed size|413/i.test(msg)) return 'That’s too big to upload: the free plan allows 50 MB per file.'
  if (/unsupported unicode escape|\\u0000/i.test(msg)) return 'Some text has a hidden character the cloud can’t store (it often comes from copying out of a PDF).'
  return msg
}
