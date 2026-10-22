import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { Modal } from '../components'
import { appUrl, supabase } from './client'

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

  if (user)
    return (
      <Modal title="Your account" onClose={onClose}>
        <div className="form">
          <p>
            Signed in as <strong>{user.email}</strong>. Worlds you turn sync on for are backed up to the cloud and kept in step
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
