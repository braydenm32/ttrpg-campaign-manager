import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { backupStore, exportWorld, recordingsSize } from './backup'
import { db, type World } from './db'
import { formatBytes } from './hooks'
import { Help } from './help'

/**
 * A nudge on the Desk to download a backup now and then. A world kept only on this device is
 * one lost phone or cleared browser away from gone, so it asks every two weeks; with cloud sync on,
 * once a month. "Later" waits a week.
 */

const DAY = 24 * 60 * 60_000

/**
 * Whether a backup is due, the words for it, and Later (which waits a week). The Desk shows it as a
 * line in "Needs you"; nothing is due for a world of fewer than five pages or a player's copy.
 */
export function useBackupDue(world: World) {
  const pages = useLiveQuery(() => db.entities.where({ worldId: world.id }).count(), [world.id]) ?? 0
  const [now] = useState(() => Date.now())
  const [hidden, setHidden] = useState(false)
  const last = backupStore.read(world.id, 'last')
  const every = (world.cloud?.enabled ? 30 : 14) * DAY
  const since = last || world.createdAt
  const due = !hidden && !world.shared && pages >= 5 && now - since >= every && now >= backupStore.read(world.id, 'snooze')
  return {
    due,
    text: last ? `Your last backup was ${Math.round((now - last) / DAY)} days ago` : 'Nothing backed up from this device yet',
    why: world.cloud?.enabled ? 'Sync keeps a copy in the cloud, but a file of your own is the safest.' : 'It only lives on this device, so keep a copy somewhere safe.',
    done: () => setHidden(true),
    later: () => {
      backupStore.write(world.id, 'snooze', Date.now() + 7 * DAY)
      setHidden(true)
    },
  }
}

/**
 * Downloads a backup of the world, saying how far it has got (a world with recordings can take a while) and what went wrong if it fails.
 * Recording audio is left out unless ticked, since it can be many times bigger than everything else.
 */
export function BackupButton({ worldId, className, label = '⬇ Download backup', onDone }: { worldId: string; className?: string; label?: string; onDone?: () => void }) {
  const [progress, setProgress] = useState<string>()
  const [error, setError] = useState('')
  const [withAudio, setWithAudio] = useState(false)
  const audioBytes = useLiveQuery(() => recordingsSize(worldId), [worldId]) ?? 0
  const run = async () => {
    setError('')
    setProgress('Preparing…')
    try {
      await exportWorld(worldId, (done, total) => setProgress(total > 1 ? `Preparing… ${done} of ${total} files` : 'Preparing…'), { recordings: withAudio })
      onDone?.()
    } catch (e) {
      setError(`The backup couldn’t be made (${(e as Error).message || 'something went wrong'}). If this device is short of space, free some up and try again.`)
    } finally {
      setProgress(undefined)
    }
  }
  return (
    <>
      <button className={className} disabled={!!progress} onClick={run}>
        {progress ?? label}
      </button>
      {audioBytes > 0 && (
        <label className="row small">
          <input type="checkbox" checked={withAudio} disabled={!!progress} onChange={(e) => setWithAudio(e.target.checked)} />
          Include session recordings ({formatBytes(audioBytes)}) <Help topic="backupRecordings" />
        </label>
      )}
      {error && <span className="error small">{error}</span>}
    </>
  )
}
