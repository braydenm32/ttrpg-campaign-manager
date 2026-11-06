import logo from '../assets/logo.svg'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AccountModal, useAuthSession } from '../cloud/auth'
import { joinWorld, loadMemberWorld, nameProblem, pendingInvite } from '../cloud/players'
import { downloadCloudWorld } from '../cloud/sync'
import { cloudErrorMessage } from '../cloud/client'
import { Help } from '../help'
import { db } from '../db'
import { Ico } from '../icons'
import { BookOpen, MaskHappy } from '@phosphor-icons/react'
import { worldPath } from '../paths'

/** Opening a player invite link: sign in, say what to call you, and join the GM's world. */
export default function JoinWorld() {
  const { token = '' } = useParams()
  const [params] = useSearchParams()
  const asGM = params.get('as') === 'gm'
  const { user, loading } = useAuthSession()
  const navigate = useNavigate()
  const [account, setAccount] = useState(false)
  // Starts with the name on their Google account, if any; null until they type.
  const [typed, setTyped] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Keep the invite if the player has to go off and confirm their email first.
  useEffect(() => pendingInvite.set(token), [token])

  // Everyone in the world sees this name, so it's never the player's email, and it has to be filled
  // in: an empty box or the invite link pasted into it (an easy slip) can't join.
  const name = typed ?? String(user?.user_metadata?.full_name ?? '')
  const tableName = name.trim()
  const problem = nameProblem(name)
  const [tried, setTried] = useState(false)

  const join = async () => {
    setTried(true)
    if (problem) return
    setBusy(true)
    setError('')
    try {
      const { cloudId, isGM, name: worldName } = await joinWorld(token, tableName)
      pendingInvite.set(null)
      if (isGM) {
        // A co-GM (or the GM opening their own link): bring down the full world, secrets and all, rather than a player copy.
        if (!(await db.worlds.get(cloudId))) await downloadCloudWorld({ id: cloudId, name: worldName, share_token: null, updated_at: '' })
        navigate(`${worldPath(cloudId)}`, { replace: true })
        return
      }
      navigate(`${worldPath(await loadMemberWorld(cloudId))}?joined=1`, { replace: true })
    } catch (e) {
      // A link that's been turned off would otherwise send the player back here every time they open the app.
      pendingInvite.set(null)
      setError(cloudErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="home join-page more-screen">
      <h1 className="brand-title"><img className="brand-mark" src={logo} alt="" />The Warded Atlas</h1>
      <div className="card join-card">
        {asGM ? (
          <>
            <h2>
              <Ico as={BookOpen} /> You’re invited to co-GM a world <Help topic="coGM" />
            </h2>
            <p className="muted">
              You’ll get the whole world on your device, secrets included, and anything you change syncs back to the other GM.
            </p>
          </>
        ) : (
          <>
            <h2>
              <Ico as={MaskHappy} /> You’re invited to a world <Help topic="joining" />
            </h2>
            <p className="muted">
              Your GM has invited you to play. You’ll see everything they’ve revealed, kept up to date as they add to it, and you can
              claim your character.
            </p>
          </>
        )}
        {loading ? (
          <p className="muted" role="status">
            Checking whether you’re signed in…
          </p>
        ) : !user ? (
          <>
            <p>First, sign in or create a free account so your GM knows it’s you.</p>
            <div className="join-actions">
              <button className="primary" onClick={() => setAccount(true)}>
                Sign in or create an account
              </button>
            </div>
          </>
        ) : (
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault()
              join()
            }}
          >
            <label>
              What should the table call you?
              <input
                autoFocus
                required
                value={name}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="e.g. Sam"
                maxLength={60}
                aria-invalid={!!problem && (tried || !!name.trim())}
              />
            </label>
            {problem && (tried || name.trim()) ? (
              <p className="error small" role="alert">
                {problem}
              </p>
            ) : (
              <p className="muted small">{tableName && !problem ? `Others in the world will see you as “${tableName}”. You can change it later.` : 'Your first name or a nickname is fine. You can change it later.'}</p>
            )}
            <p className="muted small">Signed in as {user.email || user.user_metadata?.full_name}.</p>
            <div className="join-actions">
              <button className="primary" disabled={busy}>
                {busy ? 'Joining…' : asGM ? 'Join as co-GM' : 'Join the world'}
              </button>
            </div>
          </form>
        )}
        {error && (
          <div className="join-error" role="alert">
            <p className="error">{error}</p>
            <div className="join-actions">
              <Link className="button" to="/" onClick={() => pendingInvite.set(null)}>
                Go to your worlds
              </Link>
            </div>
          </div>
        )}
      </div>
      {account && <AccountModal onClose={() => setAccount(false)} />}
    </div>
  )
}
