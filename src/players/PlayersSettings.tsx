import { useLiveQuery } from 'dexie-react-hooks'
import { Help } from '../help'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createGmInviteLink,
  createInviteLink,
  getGmInviteToken,
  getInviteToken,
  gmInviteUrl,
  inviteUrl,
  listPlayers,
  releaseCharacter,
  removePlayer,
  revokeGmInviteLink,
  revokeInviteLink,
  type Claim,
  type Member,
} from '../cloud/players'
import { db, type World } from '../db'

/** World settings: invite players with a link, and see who has joined and which character each plays. */
export function PlayersSettings({ world }: { world: World }) {
  const [token, setToken] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pcs = useLiveQuery(() => db.entities.where({ worldId: world.id }).filter((e) => e.type === 'pc' && !e.template).toArray(), [world.id]) ?? []
  const hiddenPcs = pcs.filter((e) => e.visibility !== 'players')

  const load = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([getInviteToken(world.id), listPlayers(world.id)])
      setToken(t)
      setMembers(p.members.filter((m) => m.role === 'player'))
      setClaims(p.claims)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [world.id])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const pcName = (id: string) => pcs.find((e) => e.id === id)?.name ?? 'a character that has since been deleted'

  return (
    <>
      <h3 className="share-heading">
        🎭 Players <Help topic="players" />
      </h3>
      <p className="muted">
        Send your players an invite link. They sign in, join, and see everything you’ve revealed (never anything GM-only), kept up
        to date as you sync. Each player can claim their player character and keep their own notes on it.
      </p>
      {token ? (
        <>
          <div className="row">
            <input readOnly value={inviteUrl(token)} onFocus={(e) => e.target.select()} />
            <button
              className="primary"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteUrl(token))
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
            >
              {copied ? 'Copied!' : 'Copy invite'}
            </button>
          </div>
          <div className="row wrap">
            <button
              disabled={busy}
              onClick={() => confirm('Make a new invite link? The old one stops working, but players who already joined stay in.') && run(() => createInviteLink(world.id))}
            >
              New link
            </button>
            <button className="danger" disabled={busy} onClick={() => run(() => revokeInviteLink(world.id))}>
              Turn off invites
            </button>
          </div>
        </>
      ) : (
        <button className="primary" disabled={busy} onClick={() => run(() => createInviteLink(world.id))}>
          Create invite link
        </button>
      )}

      {hiddenPcs.length > 0 && (
        <p className="notice small">
          Players can only claim characters they can see. Still GM-only:{' '}
          {hiddenPcs.map((e, i) => (
            <span key={e.id}>
              {i > 0 && ', '}
              <Link to={`/w/${world.id}/e/${e.id}?edit=1`}>{e.name}</Link>
            </span>
          ))}
          .
        </p>
      )}

      {members.length > 0 && (
        <ul className="player-list">
          {members.map((m) => {
            const mine = claims.filter((c) => c.userId === m.userId)
            return (
              <li key={m.userId}>
                <div>
                  <strong>{m.name}</strong>{' '}
                  <span className="muted small">
                    {mine.length
                      ? mine.map((c, i) => (
                          <span key={c.entityId}>
                            {i > 0 && ', '}
                            plays{' '}
                            <Link to={`/w/${world.id}/e/${c.entityId}`}>{pcName(c.entityId)}</Link>{' '}
                            <button
                              className="link"
                              title="Free this character for someone else"
                              onClick={() => confirm(`Release ${pcName(c.entityId)} from ${m.name}?`) && run(() => releaseCharacter(world.id, c.entityId, false))}
                            >
                              (release)
                            </button>
                          </span>
                        ))
                      : 'hasn’t picked a character yet'}
                  </span>
                </div>
                <button
                  className="ghost small"
                  disabled={busy}
                  onClick={() => confirm(`Remove ${m.name} from this world? They’ll lose access straight away.`) && run(() => removePlayer(world.id, m.userId))}
                >
                  Remove
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {error && <p className="error">{error}</p>}
    </>
  )
}

/** World settings: invite a co-GM, who gets the whole world (secrets included) on their own account. */
export function CoGmSettings({ world }: { world: World }) {
  const [token, setToken] = useState<string | null>(null)
  const [gms, setGms] = useState<Member[]>([])
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([getGmInviteToken(world.id), listPlayers(world.id)])
      setToken(t)
      setGms(p.members.filter((m) => m.role === 'gm'))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [world.id])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h3 className="share-heading">
        📖 Co-GMs <Help topic="coGM" />
      </h3>
      <p className="muted">
        A co-GM sees and edits everything, secrets included. Only send this link to someone you’d trust with your GM notes.
      </p>
      {token ? (
        <>
          <div className="row">
            <input readOnly value={gmInviteUrl(token)} onFocus={(e) => e.target.select()} />
            <button
              className="primary"
              onClick={async () => {
                await navigator.clipboard.writeText(gmInviteUrl(token))
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
            >
              {copied ? 'Copied!' : 'Copy co-GM link'}
            </button>
          </div>
          <div className="row wrap">
            <button className="danger" disabled={busy} onClick={() => run(() => revokeGmInviteLink(world.id))}>
              Turn off co-GM link
            </button>
          </div>
        </>
      ) : (
        <button disabled={busy} onClick={() => run(() => createGmInviteLink(world.id))}>
          Create co-GM link
        </button>
      )}
      {gms.length > 0 && (
        <ul className="player-list">
          {gms.map((m) => (
            <li key={m.userId}>
              <strong>{m.name}</strong>
              <button
                className="ghost small"
                disabled={busy}
                onClick={() =>
                  confirm(`Remove ${m.name} as co-GM? They lose access straight away, though the copy already on their device stays there.`) &&
                  run(() => removePlayer(world.id, m.userId))
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="error">{error}</p>}
    </>
  )
}
