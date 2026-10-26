import logo from '../assets/logo.svg'
import { cloudErrorMessage } from '../cloud/client'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { loadSharedWorld } from '../cloud/share'

/** Opening a player share link: fetch the player-safe copy, then show it like any other world. */
export default function SharedWorld() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    loadSharedWorld(token)
      .then((id) => !cancelled && navigate(`/w/${id}`, { replace: true }))
      .catch((e: Error) => !cancelled && setError(cloudErrorMessage(e)))
    return () => {
      cancelled = true
    }
  }, [token, navigate])

  return (
    <div className="home">
      <h1 className="brand-title"><img className="brand-mark" src={logo} alt="" />Campaign Codex</h1>
      {error ? (
        <>
          <p className="error">{error}</p>
          <Link to="/">Go to your worlds</Link>
        </>
      ) : (
        <p className="muted">Opening the world your GM shared…</p>
      )}
    </div>
  )
}
