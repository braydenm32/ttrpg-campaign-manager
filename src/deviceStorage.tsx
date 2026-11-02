import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { HardDrives } from '@phosphor-icons/react'
import { dataIsKept } from './appUpdate'
import { Help } from './help'
import { formatBytes } from './hooks'
import { Ico } from './icons'
import { worldPath } from './paths'

interface Room {
  used?: number
  quota?: number
  kept?: boolean
}

async function readRoom(): Promise<Room> {
  let used: number | undefined
  let quota: number | undefined
  try {
    const e = await navigator.storage?.estimate?.()
    used = e?.usage
    quota = e?.quota
  } catch {
    // Not available here.
  }
  return { used, quota, kept: await dataIsKept() }
}

/**
 * "This device": how much room the app uses here and whether the browser has promised to keep it.
 * Without that promise the browser may clear it when space runs short (Safari on an iPhone after a
 * week unused), so it points to a backup.
 */
export function DeviceStorage({ worldId, backupHere = false }: { worldId: string; backupHere?: boolean }) {
  const [room, setRoom] = useState<Room>()
  useEffect(() => {
    let live = true
    void readRoom().then((r) => live && setRoom(r))
    return () => {
      live = false
    }
  }, [])
  if (!room) return null
  const size = room.used !== undefined ? `Using ${formatBytes(room.used)}${room.quota ? ` of about ${formatBytes(room.quota)}` : ''}` : 'This browser doesn’t say how much room it uses'
  return (
    <div className={`device-storage ${room.kept === false ? 'notice' : ''}`}>
      <p className="small">
        <Ico as={HardDrives} /> <b>This device:</b> {size}
        {room.kept === true && ' · the browser has promised to keep it.'}
        {room.kept === false && ' · the browser hasn’t promised to keep it.'}
        {room.kept === undefined && '.'} <Help topic="deviceStorage" />
      </p>
      {room.kept === false && (
        <p className="small">
          It may clear this app’s data if the device runs short of space (Safari on an iPhone can after a week unused).{' '}
          {backupHere ? 'Download a backup below to be safe.' : <Link to={`${worldPath(worldId)}/settings?tab=data`}>Download a backup</Link>}
          {navigator.storage?.persist && (
            <>
              {' '}
              or{' '}
              <button
                className="link"
                onClick={async () => {
                  try {
                    await navigator.storage.persist()
                  } catch {
                    // Refused or not supported: the line below says so.
                  }
                  setRoom(await readRoom())
                }}
              >
                ask the browser again
              </button>
            </>
          )}
          .
        </p>
      )}
    </div>
  )
}
