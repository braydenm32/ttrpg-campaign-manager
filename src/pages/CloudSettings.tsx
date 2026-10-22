import { useEffect, useState, useSyncExternalStore } from 'react'
import { AccountModal, useAuthSession } from '../cloud/auth'
import { createShareLink, getShareToken, revokeShareLink, shareUrl } from '../cloud/share'
import { deleteCloudCopy, disableCloud, enableCloud, syncNow, syncStore } from '../cloud/sync'
import type { World } from '../db'

/** World settings section: turn on sync, and manage the player share link. */
export default function CloudSettings({ world }: { world: World }) {
  const { user } = useAuthSession()
  const sync = useSyncExternalStore(syncStore.subscribe, syncStore.get)
  const [account, setAccount] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const enabled = !!world.cloud?.enabled

  useEffect(() => {
    if (user && enabled) getShareToken(world.id).then(setToken, () => setToken(null))
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
      <h2>☁️ Cloud sync and sharing</h2>
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
          <div className="row wrap">
            <button onClick={() => syncNow()}>Sync now</button>
            <button onClick={() => run(() => disableCloud(world.id))}>Stop syncing on this device</button>
            <button
              className="danger"
              onClick={() =>
                confirm('Delete the cloud copy of this world? This device keeps its copy, but other devices and the share link stop updating.') &&
                run(() => deleteCloudCopy(world.id))
              }
            >
              Delete cloud copy
            </button>
          </div>

          <h3 className="share-heading">📜 Player share link</h3>
          <p className="muted">
            Anyone with the link sees only what you've revealed: GM-only pages, pins, maps, sessions, secret passages and GM notes are
            removed on the server before anything is sent. It updates live as you sync.
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
              Create share link
            </button>
          )}
        </>
      )}
      {error && <p className="error">{error}</p>}
      {account && <AccountModal onClose={() => setAccount(false)} />}
    </section>
  )
}
