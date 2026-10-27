import logo from '../assets/logo.svg'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AccountModal, useAuthSession } from '../cloud/auth'
import { joinWorld, loadMemberWorld, pendingInvite } from '../cloud/players'
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
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Keep the invite if the player has to go off and confirm their email first.
  useEffect(() => pendingInvite.set(token), [token])

  const join = async () => {
    setBusy(true)
    setError('')
    try {
      const { cloudId, isGM, name: worldName } = await joinWorld(token, name.trim() || user?.email?.split('@')[0] || user?.user_metadata?.full_name || '')
      pendingInvite.set(null)
      if (isGM) {
        // A co-GM (or the GM opening their own link): bring down the full world, secrets and all, rather than a player copy.
        if (!(await db.worlds.get(cloudId))) await downloadCloudWorld({ id: cloudId, name: worldName, share_token: null, updated_at: '' })
        navigate(`${worldPath(cloudId)}`, { replace: true })
        return
      }
      navigate(`${worldPath(await loadMemberWorld(cloudId))}`, { replace: true })
    } catch (e) {
      // A link that's been turned off would otherwise send the player back here every time they open the app.
      pendingInvite.set(null)
      setError(cloudErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="home join-page">
      <h1 className="brand-title"><img className="brand-mark" src={logo} alt="" />The Warded Atlas</h1>
      <div className="card join-card">
        {asGM ? (
          <>
            <h2><Ico as={BookOpen} /> You’re invited to co-GM a world</h2>
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
        {loading ? null : !user ? (
          <>
            <p>First, sign in or create a free account so your GM knows it’s you.</p>
            <button className="primary" onClick={() => setAccount(true)}>
              Sign in or create an account
            </button>
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
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={user.email?.split('@')[0] || user.user_metadata?.full_name} maxLength={60} />
            </label>
            <p className="muted small">Signed in as {user.email || user.user_metadata?.full_name}.</p>
            <div className="row end">
              <button className="primary" disabled={busy}>
                {busy ? 'Joining…' : asGM ? 'Join as co-GM' : 'Join the world'}
              </button>
            </div>
          </form>
        )}
        {error && (
          <p className="error">
            {error}{' '}
            <Link to="/" onClick={() => pendingInvite.set(null)}>
              Go to your worlds
            </Link>
          </p>
        )}
      </div>
      {account && <AccountModal onClose={() => setAccount(false)} />}
    </div>
  )
}
