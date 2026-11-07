import { createClient } from '@supabase/supabase-js'

/**
 * Connection to the Warded Atlas cloud (Supabase). These two values are public by design:
 * the database's security rules decide what each signed-in person can read or write.
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://ysrxumagiiaoihlhofqt.supabase.co'
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_HsmvijuCGe53E9WU5N2ZQA_1EGPpGt1'

/** When this tab set off a sign-in with Google, so the sign-in that comes back in the address counts. */
const SIGN_IN_STARTED = 'codex.signInStarted'
/** A trip to Google and back takes seconds; this leaves time for a second sign-in step there. */
const SIGN_IN_TRIP = 5 * 60_000
/** What a sign-in in the address is made of (Supabase puts these after "#" on the way back from Google). */
const ADDRESS_SIGN_IN = ['access_token', 'refresh_token', 'expires_in', 'expires_at', 'token_type', 'provider_token', 'provider_refresh_token']

/** Just before leaving for Google's sign-in page. */
export function signInStarting() {
  try {
    sessionStorage.setItem(SIGN_IN_STARTED, String(Date.now()))
  } catch {
    // Storage blocked: the sign-in can't be kept on this device anyway.
  }
}

/** The trip to Google didn't happen, or the app was opened again without coming back from it. */
export function signInAbandoned() {
  try {
    sessionStorage.removeItem(SIGN_IN_STARTED)
  } catch {
    // Storage blocked: nothing was noted.
  }
}

// Back from Google's page with the browser's Back button: the app carries on as it was, so the trip is over.
if (typeof window !== 'undefined') window.addEventListener('pageshow', (e) => e.persisted && signInAbandoned())

/** Takes a sign-in that wasn't asked for off the address, so it isn't left in the address bar or history. */
function dropSignInFromAddress() {
  const url = new URL(window.location.href)
  for (const key of ADDRESS_SIGN_IN) url.searchParams.delete(key)
  if (url.hash.includes('access_token=')) url.hash = ''
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
}

/**
 * A sign-in that comes back in the address (from Google) counts only when this tab just set one
 * off. Anyone can make a link with their own account's sign-in in it, to have someone work (and
 * sync) in that account without noticing; a link like that is just taken off the address.
 */
function signInFromAddress(_url: URL, params: Record<string, string>) {
  let started = 0
  try {
    started = Number(sessionStorage.getItem(SIGN_IN_STARTED)) || 0
  } catch {
    // Storage blocked: nothing was started here.
  }
  // Whatever this address is, the trip to Google is over: a later sign-in in an address needs a new one.
  signInAbandoned()
  if (!params.access_token && !params.error && !params.error_description && !params.error_code) return false
  if (started && Date.now() - started < SIGN_IN_TRIP) return true
  if (params.access_token) dropSignInFromAddress()
  return false
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: signInFromAddress },
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
 * What a new password needs. Supabase checks the same on its side (docs/ACCOUNT_SETUP.md, section
 * 6), so change the two together. Signing in never checks it, so older, shorter passwords still work.
 */
export const PASSWORD_MIN = 10
export const PASSWORD_RULE = 'At least 10 characters, with letters and numbers.'

/** Why a new password won't do, in plain words, or '' when it's fine. */
export function passwordProblem(password: string) {
  return password.length >= PASSWORD_MIN && /[A-Za-z]/.test(password) && /[0-9]/.test(password) ? '' : PASSWORD_RULE
}

/**
 * A plain-words message for a failed cloud call. The free server falls asleep after about a week
 * with nobody using it (a weekly keep-alive normally stops that), and then every call fails the same
 * way, so that case gets its own explanation.
 */
export function cloudErrorMessage(e: unknown) {
  const msg = (e as Error)?.message ?? String(e)
  if ((e as { code?: string })?.code === 'weak_password')
    return (e as { reasons?: string[] }).reasons?.includes('pwned')
      ? 'That password has turned up in a known data leak, so it isn’t safe to use. Please pick another.'
      : `That password is too easy to guess. ${PASSWORD_RULE}`
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
