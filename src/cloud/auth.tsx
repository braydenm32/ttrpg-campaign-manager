import { AuthClient, type EmailOtpType, type Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { Modal } from '../components'
import { db, type World } from '../db'
import { Help } from '../help'
import { currentPath, goToPath, hashRouting } from '../paths'
import { recordingStore } from '../recordingStore'
import { recordingsOnlyHere } from '../backup'
import { getAiSettings } from '../ai/settings'
import { appLink, appUrl, cloudErrorMessage, signInAbandoned, signInStarting, SUPABASE_KEY, SUPABASE_URL, supabase } from './client'
import { joinedHere, pendingInvite, removeJoinedCopies } from './players'
import { deleteMyAccount, stopSync, syncEverythingNow, syncStore } from './sync'

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
    sessionStorage.setItem(RETURN_KEY, JSON.stringify({ path: currentPath(), at: Date.now() }))
  } catch {
    // private window: we just land on the front page
  }
  signInStarting()
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: appUrl() } })
  if (error) {
    signInAbandoned()
    throw error
  }
}

export function finishSignInRedirect() {
  try {
    const saved = sessionStorage.getItem(RETURN_KEY)
    if (!saved) return
    sessionStorage.removeItem(RETURN_KEY)
    const { path, at } = JSON.parse(saved) as { path?: string; at: number }
    // Only a sign-in that just came back from Google, not one abandoned earlier.
    if (path && path !== '/' && Date.now() - at < 10 * 60_000 && path !== currentPath()) goToPath(path)
  } catch {
    // nothing to restore
  }
}

/**
 * The kinds of email link the app's own templates send (supabase/templates), and "signup", the older
 * name for confirming an email: a link of any other kind (an invite, say) is ignored.
 */
const LINK_TYPES: readonly string[] = ['email', 'signup', 'magiclink', 'recovery', 'email_change'] satisfies EmailOtpType[]
const LINK_USED = 'That link has expired or was already used. Sign in, or ask for a new email.'

/** The address this device last asked for an email for (signing up, or a new password), and when. */
const ASKED = 'codex.emailAsked'
/** How long a link from that email signs in without asking. */
const ASKED_FOR = 2 * 24 * 60 * 60_000

/** Remembers that this device asked for an email for this address, so its link signs in without asking. */
function askedForEmail(email: string) {
  try {
    localStorage.setItem(ASKED, JSON.stringify({ email: email.trim().toLowerCase(), at: Date.now() }))
  } catch {
    // Storage blocked: the link asks first instead.
  }
}

/** Whether this device asked for an email for this address lately. */
function askedHere(email: string | undefined) {
  try {
    const asked = JSON.parse(localStorage.getItem(ASKED) ?? 'null') as { email?: unknown; at?: unknown } | null
    return !!email && asked?.email === email.trim().toLowerCase() && typeof asked.at === 'number' && Date.now() - asked.at < ASKED_FOR
  } catch {
    return false
  }
}

/**
 * Our own email templates link straight to the app (`?token_hash=…&type=…`) instead of a
 * supabase.co address. Finish that here: returns the link type (and who it signed in) on success.
 *
 * Anyone can send someone a link like that for their own account (to have them work, and sync,
 * in it without noticing). So the link is checked on the side first, without touching who's signed
 * in here, and the person is asked before it signs them in: always if they're signed in as someone
 * else, and when signed out unless this device asked for that email itself.
 */
export async function verifyEmailLink(): Promise<{ type?: EmailOtpType; email?: string; error?: string } | null> {
  // Usually "?token_hash=…" on the address. A link that returns to an invite page carries it inside
  // the "#/join/…" part instead, so look there too.
  const { search, hash, pathname } = window.location
  const inHash = hash.includes('?') ? hash.slice(hash.indexOf('?')) : ''
  const params = new URLSearchParams(search.includes('token_hash') ? search : inHash)
  const token_hash = params.get('token_hash')
  const type = params.get('type')
  if (!token_hash || !type) return null
  window.history.replaceState(null, '', pathname + (search.includes('token_hash') ? hash : hash.slice(0, hash.indexOf('?'))))
  if (!LINK_TYPES.includes(type)) return { error: 'That link isn’t one the Warded Atlas sends, so nothing was changed.' }
  const otp = { token_hash, type: type as EmailOtpType }
  const now = (await supabase.auth.getSession()).data.session
  // Whose link is it?
  const side = new AuthClient({
    url: `${SUPABASE_URL}/auth/v1`,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    storageKey: 'codex.emailLinkCheck',
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  })
  const { data, error } = await side.verifyOtp(otp)
  if (error) return { error: LINK_USED }
  const linked = data.session
  // Nothing to sign in with (one step of an email change, say): it's done.
  if (!linked) return { type: otp.type }
  const them = linked.user.email || 'another account'
  if (!now) {
    // Signed out, and this device didn't ask for this email: someone may have sent their own.
    const ok =
      askedHere(linked.user.email) ||
      confirm(
        `This link signs you in as ${them}.\n\nOnly go ahead if you asked for this email yourself: someone could send you a link to their own account, to get your worlds and AI keys into it.`,
      )
    if (!ok) {
      await side.signOut({ scope: 'local' }).catch(() => {})
      return { error: `Nothing changed: you’re not signed in, and that link won’t work again. If ${them} is yours, sign in with it from the account button.` }
    }
  } else if (linked.user.id !== now.user.id) {
    const me = now.user.email || 'your account'
    const ok = confirm(
      `This link signs in as ${them}, but you’re signed in as ${me}.\n\nSwitch to ${them}? You’ll be signed out of ${me} on this device.\n\nOnly switch if you asked for this email yourself: someone could send you a link to their account to get your worlds into it.`,
    )
    if (!ok) {
      await side.signOut({ scope: 'local' }).catch(() => {})
      return { error: `Nothing changed: you’re still signed in as ${me}, and that link won’t work again. If ${them} is yours too, sign out first, then sign in with it.` }
    }
    await supabase.auth.signOut({ scope: 'local' })
  }
  try {
    localStorage.removeItem(ASKED)
  } catch {
    // nothing to forget
  }
  const { error: notSet } = await supabase.auth.setSession({ access_token: linked.access_token, refresh_token: linked.refresh_token })
  return notSet ? { error: LINK_USED } : { type: otp.type, email: linked.user.email }
}

/** What "Sign out and remove everything" would take off this device, checked once the latest changes have synced. */
interface LeaveCheck {
  /** Why it can't go ahead yet. */
  blocked?: string
  /** The GM's own worlds only on this device: gone for good. */
  lost: string[]
  lostIds: string[]
  /** The GM's own worlds backed up to this account: they come back on sign-in. */
  kept: string[]
  /** Copies of worlds joined as a player or opened from a wiki link. */
  copies: number
  /** Session recordings in the GM's own worlds that are only on this device (in no backup, not in the cloud): they go for good. */
  recordings: number
  /** AssemblyAI copies this device still had to delete, which nothing will try again once it's cleared. */
  assemblyLeft?: number
  /** Sync couldn't finish, so the newest changes may not have reached the account. */
  unsynced?: string
}

async function checkBeforeLeaving(userId: string): Promise<LeaveCheck> {
  if (recordingStore.get()) return { blocked: 'A session is being recorded on this device. Stop and save the recording first, or it’s lost.', lost: [], lostIds: [], kept: [], copies: 0, recordings: 0 }
  // Send what's waiting first (and wait for a sync already under way, and one more for what changed
  // meanwhile), so the account has the latest of every world it backs up.
  await syncEverythingNow().catch(() => {})
  const sync = syncStore.get()
  const worlds = await db.worlds.toArray()
  const own = worlds.filter((w) => !w.shared)
  const backedUp = (w: World) => !!w.cloud?.enabled && !w.cloud.gone && (!w.cloud.by || w.cloud.by === userId)
  // New recordings stay on the device that made them (older ones may be in the account, or in a backup from here).
  let recordings = 0
  for (const w of own) recordings += (await recordingsOnlyHere(w.id)).count
  // Once this device is cleared nothing tries again, so have one more go now (for up to about 8 seconds).
  const { assemblyKey, keepAtAssembly } = getAiSettings()
  const assemblyLeft =
    assemblyKey.trim() && !keepAtAssembly
      ? await import('../ai/cloud')
          .then((c) => c.deleteCloudLeftovers(assemblyKey.trim(), Date.now() + 8000))
          .catch(() => 0)
      : 0
  return {
    lost: own.filter((w) => !backedUp(w)).map((w) => w.name),
    lostIds: own.filter((w) => !backedUp(w)).map((w) => w.id),
    kept: own.filter(backedUp).map((w) => w.name),
    copies: worlds.length - own.length,
    recordings,
    assemblyLeft,
    unsynced:
      sync.status === 'offline'
        ? 'this device is offline.'
        : sync.status === 'error'
          ? sync.message || 'sync hit a problem.'
          : sync.status !== 'idle'
            ? 'sync didn’t finish.'
            : sync.unsent?.length
              ? `some files in ${sync.unsent.map((n) => `“${n}”`).join(', ')} couldn’t upload, so your account doesn’t have them.`
              : undefined,
  }
}

/** Takes everything the app keeps off this device: every world and copy, recordings, AI keys and settings. Then starts afresh. */
async function removeEverythingHere(check: LeaveCheck) {
  // A transcript AssemblyAI is still making for a world that goes for good: nothing will pick it up now, so its copy goes too.
  const { assemblyKey, keepAtAssembly } = getAiSettings()
  if (assemblyKey.trim() && !keepAtAssembly && check.lostIds.length) {
    const { forgetCloudJob, jobsInUse } = await import('../ai/cloud')
    const jobs = jobsInUse(await db.sessions.where('worldId').anyOf(check.lostIds).toArray())
    await Promise.all([...jobs].map((id) => forgetCloudJob(id, assemblyKey.trim())))
  }
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  stopSync()
  await db.delete()
  for (const store of [localStorage, sessionStorage])
    try {
      store.clear()
    } catch {
      // Storage blocked: nothing was kept there.
    }
  // Back to the front page of this copy of the app (a fresh start, with nothing of anyone's).
  window.location.replace(hashRouting ? `${window.location.pathname}#/` : '/')
}

/**
 * The second way to sign out, for a computer that isn't yours: says plainly what goes (worlds only
 * on this device are gone for good) once the others are checked as saved to the account.
 */
function SignOutEverything({ userId, onCancel }: { userId: string; onCancel: () => void }) {
  const [check, setCheck] = useState<LeaveCheck>()
  const [sure, setSure] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let on = true
    void checkBeforeLeaving(userId).then((c) => on && setCheck(c))
    return () => {
      on = false
    }
  }, [userId])
  const list = (names: string[]) => names.map((n) => `“${n}”`).join(', ')
  if (!check)
    return (
      <p className="muted" role="status">
        Saving your latest changes to your account first…
      </p>
    )
  if (check.blocked)
    return (
      <div className="form">
        <p className="notice">{check.blocked}</p>
        <div className="row end">
          <button onClick={onCancel}>Back</button>
        </div>
      </div>
    )
  const mustTick = check.lost.length > 0 || check.recordings > 0 || !!check.unsynced
  const recordings = check.recordings === 1 ? 'a session recording' : `${check.recordings} session recordings`
  const also = [
    check.copies > 0 && `your copies of ${check.copies === 1 ? 'a world' : `${check.copies} worlds`} you joined or opened from a link (you stay in them)`,
    'the AI keys saved here',
    'this device’s settings',
  ].filter((x): x is string => !!x)
  return (
    <div className="form sign-out-everything">
      <p>
        <strong>Remove everything from this device and sign out?</strong> For a computer that isn’t yours. <Help topic="signOut" />
      </p>
      {check.unsynced && (
        <p className="notice small" role="alert">
          Couldn’t check that your latest changes reached your account: {check.unsynced} Anything changed since the last sync would be lost.
        </p>
      )}
      {check.lost.length > 0 && (
        <p className="error small">
          Gone for good, as {check.lost.length === 1 ? 'it’s' : 'they’re'} only on this device and not backed up to your account: {list(check.lost)}.
        </p>
      )}
      {check.recordings > 0 && (
        <p className="error small">
          Also gone for good: {recordings} only on this device, as new recordings aren’t saved to your account. To keep {check.recordings === 1 ? 'it' : 'them'}, cancel and
          download a backup of {check.recordings === 1 ? 'its world' : 'their worlds'} with “Include session recordings” ticked first.
        </p>
      )}
      {!!check.assemblyLeft && (
        <p className="notice small">
          AssemblyAI hasn’t deleted {check.assemblyLeft === 1 ? 'a transcript' : `${check.assemblyLeft} transcripts`} sent from here yet, and this device won’t try again once it’s cleared: delete{' '}
          {check.assemblyLeft === 1 ? 'it' : 'them'} in your AssemblyAI account.
        </p>
      )}
      <p className="small">Also removed from this device: {`${also.slice(0, -1).join(', ')} and ${also[also.length - 1]}`}.</p>
      {check.kept.length > 0 && <p className="muted small">Saved in your account, so they come back when you sign in again: {list(check.kept)}.</p>}
      {mustTick && (
        <label className="row small">
          <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} /> I understand{' '}
          {[
            check.lost.length > 0 && (check.lost.length === 1 ? 'that world' : 'those worlds'),
            check.recordings > 0 && (check.recordings === 1 ? 'that recording' : 'those recordings'),
            !!check.unsynced && 'any changes not yet in my account',
          ]
            .filter(Boolean)
            .join(' and ')}{' '}
          {check.lost.length + check.recordings === 1 && !check.unsynced ? 'is' : 'are'} gone for good
        </label>
      )}
      {error && <p className="error small">{error}</p>}
      <div className="row end wrap">
        <button disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button
          className="danger"
          disabled={busy || (mustTick && !sure)}
          onClick={async () => {
            setBusy(true)
            setError('')
            try {
              await removeEverythingHere(check)
            } catch (err) {
              setError(cloudErrorMessage(err))
              setBusy(false)
            }
          }}
        >
          {busy ? 'Removing…' : 'Remove everything and sign out'}
        </button>
      </div>
    </div>
  )
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
  // The second way to sign out: everything off this device.
  const [leaving, setLeaving] = useState(false)
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

  if (user && leaving)
    return (
      <Modal title="Your account" onClose={onClose}>
        <SignOutEverything userId={user.id} onCancel={() => setLeaving(false)} />
      </Modal>
    )

  if (user)
    return (
      <Modal title="Your account" onClose={onClose}>
        <div className="form">
          <p>
            Signed in as <strong>{user.email || user.user_metadata?.full_name || 'you'}</strong>. Worlds you turn sync on for are backed up to the cloud and kept in step
            across your devices.
          </p>
          {error && <p className="error">{error}</p>}
          <div className="row spread">
            <span className="row small">
              <button
                className="link danger-link"
                disabled={busy}
                onClick={async () => {
                  const typed = prompt(
                    'Delete your account?\n\nThis removes the cloud copy of every world you own (and its share and invite links), and takes you out of worlds you joined. Worlds saved on this device stay here.\n\nType DELETE to confirm.',
                  )
                  if (typed?.trim().toUpperCase() !== 'DELETE') return
                  setBusy(true)
                  setError('')
                  try {
                    await deleteMyAccount()
                    onClose()
                  } catch (err) {
                    setError(cloudErrorMessage(err))
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {busy ? 'Deleting…' : 'Delete my account'}
              </button>
              <Help topic="deleteAccount" />
            </span>
            <span className="row">
              <button
                onClick={async () => {
                  // On a shared computer the worlds you joined shouldn't stay readable after you leave.
                  const joined = await joinedHere()
                  if (
                    joined.length &&
                    confirm(
                      `Also remove the ${joined.length === 1 ? 'world' : `${joined.length} worlds`} you joined as a player from this device?\n\n${joined
                        .map((w) => `• ${w.name}`)
                        .join('\n')}\n\nYou stay in ${joined.length === 1 ? 'it' : 'them'}: sign in again and Home lists ${joined.length === 1 ? 'it' : 'them'} to open. Cancel keeps ${joined.length === 1 ? 'it' : 'them'} here.`,
                    )
                  ) {
                    await removeJoinedCopies()
                    // Don't leave the screen on a world that's just gone.
                    if (currentPath().startsWith('/w/')) goToPath('/')
                  }
                  await supabase.auth.signOut()
                  onClose()
                }}
              >
                Sign out
              </button>
              <Help topic="signOut" />
            </span>
          </div>
          <p className="small">
            <button className="link" onClick={() => setLeaving(true)}>
              Sign out and remove all worlds and keys from this device…
            </button>
          </p>
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
        // Someone signing up from an invite comes back to it from the email, even on another device.
        const invite = pendingInvite.get()
        askedForEmail(email)
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: invite ? appLink(`/join/${invite}`) : appUrl() } })
        if (error) throw error
        if (data.session) onClose()
        else setMessage('Check your email and click the confirmation link, then sign in here.')
      } else {
        askedForEmail(email)
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: appUrl() })
        if (error) throw error
        setMessage('If that email has an account, a reset link is on its way.')
      }
    } catch (err) {
      setError(cloudErrorMessage(err))
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
                      setError(cloudErrorMessage(err))
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
        {mode !== 'reset' && (
          <p className="muted small">
            By continuing you agree to the{' '}
            <a href={`${import.meta.env.BASE_URL}terms.html`} target="_blank" rel="noreferrer">
              terms of service
            </a>{' '}
            and{' '}
            <a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">
              privacy policy
            </a>
            .
          </p>
        )}
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
