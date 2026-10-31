import logo from '../assets/logo.svg'
import { cloudErrorMessage } from '../cloud/client'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Books } from '@phosphor-icons/react'
import { loadSharedWorld } from '../cloud/share'
import { Ico } from '../icons'
import { worldPath } from '../paths'

/** Opening a player share link: fetch the player-safe copy, then show it like any other world. */
export default function SharedWorld() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  // Bumped by "Try again", which fetches the world again.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadSharedWorld(token)
      .then((id) => !cancelled && navigate(`${worldPath(id)}`, { replace: true }))
      .catch((e: Error) => !cancelled && setError(cloudErrorMessage(e)))
    return () => {
      cancelled = true
    }
  }, [token, navigate, attempt])

  return (
    <div className="home join-page more-screen">
      <h1 className="brand-title">
        <img className="brand-mark" src={logo} alt="" />
        The Warded Atlas
      </h1>
      <div className="card join-card" role="status" aria-live="polite">
        {error ? (
          <>
            <h2>
              <Ico as={Books} /> Couldn’t open this wiki
            </h2>
            <p>{error}</p>
            <div className="join-actions">
              <button
                className="primary"
                onClick={() => {
                  setError('')
                  setAttempt((n) => n + 1)
                }}
              >
                Try again
              </button>
              <Link className="button" to="/">
                Go to your worlds
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2>
              <Ico as={Books} /> Opening the world your GM shared…
            </h2>
            <p className="muted">Fetching everything they’ve revealed. The first time takes a moment; after that it opens straight away.</p>
            <span className="join-wait" aria-hidden="true" />
          </>
        )}
      </div>
    </div>
  )
}
