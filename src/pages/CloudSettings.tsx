import { useEffect, useState, useSyncExternalStore } from 'react'
import { Help } from '../help'
import { AccountModal, useAuthSession } from '../cloud/auth'
import { createShareLink, getShareToken, revokeShareLink, shareUrl } from '../cloud/share'
import { deleteCloudCopy, disableCloud, enableCloud, syncNow, syncStore } from '../cloud/sync'
import type { World } from '../db'
import { myRole } from '../cloud/players'
import { CoGmSettings, PlayersSettings } from '../players/PlayersSettings'
import { Ico } from '../icons'
import { BookOpen, Cloud, Scroll } from '@phosphor-icons/react'

/** World settings section: turn on sync, and manage the player share link. */
export default function CloudSettings({ world }: { world: World }) {
  const { user } = useAuthSession()
  const sync = useSyncExternalStore(syncStore.subscribe, syncStore.get)
  const [account, setAccount] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [role, setRole] = useState<Awaited<ReturnType<typeof myRole>>>('owner')
  const enabled = !!world.cloud?.enabled
  const coGM = role === 'gm'

  useEffect(() => {
    if (user && enabled) getShareToken(world.id).then(setToken, () => setToken(null))
    if (user && enabled) myRole(world.id).then(setRole, () => setRole('owner'))
  }, [user, enabled, world.id])

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h2>
        <Ico as={Cloud} /> Cloud sync, sharing and players <Help topic="cloudSync" />
      </h2>
      {!user ? (
        <>
          <p className="muted">Sign in to back this world up to the cloud, use it on several devices, and share a player view with a link.</p>
          <button className="primary" onClick={() => setAccount(true)}>
            Sign in or create an account
          </button>
        </>
      ) : !enabled ? (
        <>
          <p className="muted">
            Turn on sync to keep this world backed up and in step on every device you sign in on. Changes appear on your other devices
            within a few seconds.
          </p>
          <button className="primary" disabled={busy} onClick={() => run(() => enableCloud(world.id))}>
            {busy ? 'Uploading…' : 'Turn on sync for this world'}
          </button>
        </>
      ) : (
        <>
          <p>
            Sync is on.{' '}
            <span className="muted">
              {sync.status === 'syncing'
                ? 'Syncing now…'
                : sync.status === 'offline'
                  ? "You're offline; changes will upload when you reconnect."
                  : sync.lastSync
                    ? `Last synced ${new Date(sync.lastSync).toLocaleTimeString()}.`
                    : ''}
            </span>
          </p>
          {sync.message && <p className="notice small">{sync.message}</p>}
          {coGM && (
            <p className="notice small">
              <Ico as={BookOpen} /> You’re a co-GM of this world <Help topic="coGM" />. Everything you change syncs to the other GM. Share links, players and
              the cloud copy are managed by the world’s owner.
            </p>
          )}
          <div className="row wrap">
            <button onClick={() => syncNow()}>Sync now</button>
            <button onClick={() => run(() => disableCloud(world.id))}>Stop syncing on this device</button>
            {!coGM && (
            <button
              className="danger"
              onClick={() =>
                confirm('Delete the cloud copy of this world? This device keeps its copy, but other devices and the share link stop updating.') &&
                run(() => deleteCloudCopy(world.id))
              }
            >
              Delete cloud copy
            </button>
            )}
          </div>
          {!coGM && (
          <>

          <h3 className="share-heading">
            <Ico as={Scroll} /> Public wiki link <Help topic="shareLink" />
          </h3>
          <p className="muted">
            A read-only wiki of your world for anyone with the link, no account needed: friends outside the group, or a player before
            they sign up. It shows only what you've revealed to the whole table. GM-only pages, pins, maps, sessions, secret passages,
            GM notes and anything revealed to just one player are removed on the server before anything is sent. It updates as you sync.
            To bring players into the game, use the invite link below instead.
          </p>
          {token ? (
            <>
              <div className="row">
                <input readOnly value={shareUrl(token)} onFocus={(e) => e.target.select()} />
                <button
                  className="primary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(shareUrl(token))
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                >
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
              </div>
              <div className="row wrap">
                <button disabled={busy} onClick={() => confirm('Make a new link? The old one will stop working.') && run(async () => setToken(await createShareLink(world.id)))}>
                  New link
                </button>
                <button className="danger" disabled={busy} onClick={() => run(async () => (await revokeShareLink(world.id), setToken(null)))}>
                  Turn off link
                </button>
              </div>
            </>
          ) : (
            <button className="primary" disabled={busy} onClick={() => run(async () => setToken(await createShareLink(world.id)))}>
              Create wiki link
            </button>
          )}

          <PlayersSettings world={world} />
          <CoGmSettings world={world} />
          </>
          )}
        </>
      )}
      {error && <p className="error">{error}</p>}
      {account && <AccountModal onClose={() => setAccount(false)} />}
    </section>
  )
}
