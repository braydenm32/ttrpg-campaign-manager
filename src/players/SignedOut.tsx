import { useState } from 'react'
import { AccountModal, useAuthSession } from '../cloud/auth'
import type { World } from '../db'

/**
 * For a joined player whose sign-in has lapsed: questions and downtime go through the account, so
 * without it they can't be sent. One card says so, with a way back in.
 */
export function SignedOutCard({ world }: { world: World }) {
  const { user, loading } = useAuthSession()
  const [account, setAccount] = useState(false)
  if (!world.shared?.memberOf || loading || user) return null
  return (
    <section className="card room-card signed-out" role="status">
      <p>You’re signed out, so questions and downtime can’t be sent. Sign in again.</p>
      <div className="row">
        <button className="primary" onClick={() => setAccount(true)}>
          Sign in
        </button>
      </div>
      {account && <AccountModal onClose={() => setAccount(false)} />}
    </section>
  )
}
