import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { backupStore, exportWorld } from './backup'
import { db, type World } from './db'
import { Help } from './help'
import { Ico } from './icons'
import { FloppyDisk } from '@phosphor-icons/react'

/**
 * A nudge on the overview to download a backup now and then. A world kept only on this device is
 * one lost phone or cleared browser away from gone, so it asks every two weeks; with cloud sync on,
 * once a month. "Later" waits a week.
 */

const DAY = 24 * 60 * 60_000

export function BackupReminder({ world }: { world: World }) {
  const pages = useLiveQuery(() => db.entities.where({ worldId: world.id }).count(), [world.id]) ?? 0
  const [now] = useState(() => Date.now())
  const [hidden, setHidden] = useState(false)
  const [busy, setBusy] = useState(false)
  if (hidden || world.shared || pages < 5) return null
  const last = backupStore.read(world.id, 'last')
  const every = (world.cloud?.enabled ? 30 : 14) * DAY
  const since = last || world.createdAt
  if (now - since < every || now < backupStore.read(world.id, 'snooze')) return null
  return (
    <div className="backup-reminder">
      <span>
        <Ico as={FloppyDisk} /> {last ? `Your last backup of this world was ${Math.round((now - last) / DAY)} days ago.` : 'You haven’t downloaded a backup of this world yet.'}{' '}
        {world.cloud?.enabled ? 'Sync keeps a copy in the cloud, but a file of your own is the safest.' : 'It only lives on this device, so keep a copy somewhere safe.'}{' '}
        <Help topic="backupReminder" />
      </span>
      <span className="row">
        <button
          className="small primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await exportWorld(world.id)
              setHidden(true)
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Preparing…' : 'Download backup'}
        </button>
        <button
          className="small ghost"
          onClick={() => {
            backupStore.write(world.id, 'snooze', Date.now() + 7 * DAY)
            setHidden(true)
          }}
        >
          Later
        </button>
      </span>
    </div>
  )
}
