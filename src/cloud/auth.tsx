import type { EmailOtpType, Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { Modal } from '../components'
import { Help } from '../help'
import { appUrl, SUPABASE_KEY, SUPABASE_URL, supabase } from './client'

type Provider = 'google' | 'facebook'
const PROVIDERS: { id: Provider; label: string }[] = [
  { id: 'google', label: 'Continue with Google' },
  { id: 'facebook', label: 'Continue with Facebook' },
]
const RETURN_KEY = 'codex.returnTo'

/** Which social logins are switched on in the Supabase dashboard, so buttons only appear once they work. */
let providersPromise: Promise<Provider[]> | null = null
function enabledProviders() {
  providersPromise ??= fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } })
    .then((r) => (r.ok ? r.json() : { external: {} }))
    .then((s: { external?: Record<string, boolean> }) => PROVIDERS.map((p) => p.id).filter((id) => s.external?.[id]))
    .catch(() => {
      providersPromise = null
      return []
    })
  return providersPromise
}

/**
 * Social sign-in leaves the app and comes back to its front page, so remember where we were
 * (an invite link, say) and go back there once signed in. See finishSignInRedirect.
 */
async function signInWith(provider: Provider) {
  try {
    sessionStorage.setItem(RETURN_KEY, JSON.stringify({ hash: window.location.hash, at: Date.now() }))
  } catch {
    // private window: we just land on the front page
  }
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: appUrl() } })
  if (error) throw error
}

export function finishSignInRedirect() {
  try {
    const saved = sessionStorage.getItem(RETURN_KEY)
    if (!saved) return
    sessionStorage.removeItem(RETURN_KEY)
    const { hash, at } = JSON.parse(saved) as { hash: string; at: number }
    // Only a sign-in that just came back from Google or Facebook, not one abandoned earlier.
    if (hash && Date.now() - at < 10 * 60_000 && hash !== window.location.hash) window.location.hash = hash
  } catch {
    // nothing to restore
  }
}

/**
 * Our own email templates link straight to the app (`?token_hash=…&type=…`) instead of a
 * supabase.co address. Finish that here: returns the link type on success.
 */
export async function verifyEmailLink(): Promise<{ type?: EmailOtpType; error?: string } | null> {
  const params = new URLSearchParams(window.location.search)
  const token_hash = params.get('token_hash')
  const type = params.get('type') as EmailOtpType | null
  if (!token_hash || !type) return null
  window.history.replaceState(null, '', window.location.pathname + window.location.hash)
  const { error } = await supabase.auth.verifyOtp({ token_hash, type })
  if (error) return { error: 'That link has expired or was already used. Sign in, or ask for a new email.' }
  return { type }
}

export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return { session, loading, user: session?.user ?? null }
}

export function AccountModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuthSession()
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [providers, setProviders] = useState<Provider[]>([])
  // The desktop app can't hand a Google or Facebook sign-in back to itself, so it keeps to email.
  const desktop = '__TAURI_INTERNALS__' in window
  useEffect(() => {
    if (!desktop) enabledProviders().then(setProviders)
  }, [desktop])

  if (user)
    return (
      <Modal title="Your account" onClose={onClose}>
        <div className="form">
          <p>
            Signed in as <strong>{user.email || user.user_metadata?.full_name || 'you'}</strong>. Worlds you turn sync on for are backed up to the cloud and kept in step
            across your devices.
          </p>
          <div className="row end">
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                onClose()
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </Modal>
    )

  const submit = async () => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onClose()
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: appUrl() } })
        if (error) throw error
        if (data.session) onClose()
        else setMessage('Check your email and click the confirmation link, then sign in here.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: appUrl() })
        if (error) throw error
        setMessage('If that email has an account, a reset link is on its way.')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={mode === 'signup' ? 'Create an account' : mode === 'reset' ? 'Reset password' : 'Sign in'} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <p className="muted small">
          An account lets you sync worlds between devices and share a read-only player view. Without one, everything still works on
          this device.
        </p>
        {mode !== 'reset' && providers.length > 0 && (
          <>
            <div className="social-logins">
              {PROVIDERS.filter((p) => providers.includes(p.id)).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`social ${p.id}`}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    setError('')
                    try {
                      await signInWith(p.id)
                    } catch (err) {
                      setError((err as Error).message)
                      setBusy(false)
                    }
                  }}
                >
                  <span className="social-icon" aria-hidden="true">
                    {p.id === 'google' ? 'G' : 'f'}
                  </span>
                  {p.label}
                </button>
              ))}
            </div>
            <p className="or-divider muted small">
              or use your email <Help topic="socialLogin" />
            </p>
          </>
        )}
        <label>
          Email
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode !== 'reset' && (
          <label>
            Password
            <input
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        {error && <p className="error">{error}</p>}
        {message && <p className="notice">{message}</p>}
        <div className="row spread">
          <div className="row small">
            {mode !== 'signin' && (
              <button type="button" className="link" onClick={() => setMode('signin')}>
                Sign in instead
              </button>
            )}
            {mode !== 'signup' && (
              <button type="button" className="link" onClick={() => setMode('signup')}>
                Create account
              </button>
            )}
            {mode === 'signin' && (
              <button type="button" className="link" onClick={() => setMode('reset')}>
                Forgot password
              </button>
            )}
          </div>
          <button className="primary" disabled={busy}>
            {busy ? '…' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send link' : 'Sign in'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
