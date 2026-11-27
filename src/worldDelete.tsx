import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, deleteWorld, type World } from './db'
import { backupStore, recordingsOnlyHere } from './backup'
import { forgetCloudTranscripts } from './ai/TranscriptPanel'
import { BackupButton } from './BackupReminder'
import { nameToType, useDeleteCheck } from './deleteCheck'
import { useLiveRecording } from './recordingStore'
import { formatBytes } from './hooks'
import { listPlayers, myRole } from './cloud/players'
import { deleteCloudCopy } from './cloud/sync'

/**
 * The two deletes nothing can undo: a whole world, and a world's cloud copy. Each asks with the
 * app's own dialog (src/deleteCheck.tsx), listing what goes with real counts, and has the world's
 * name typed first (or the word "delete", for a world with no name).
 */

/** The world in a dialog's title: “Its name”, or "this unnamed world". */
const called = (world: World) => (world.name.trim() ? `“${world.name.trim()}”` : 'this unnamed world')

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** What goes from the cloud with its copy: the players' side of the world. Shared by both deletes. */
const CLOUD_GOES = [
  'The players’ notes, group notes, questions and your answers, downtime, date answers, stars and wishes, and their claims on characters',
  'The wiki, invite and co-GM links stop working',
  'Your other devices stop updating',
]

/** Who is in the world online, in words ("3 players and a co-GM"), or '' when it can't be told (offline). */
async function whoIsIn(worldId: string) {
  try {
    const { members } = await listPlayers(worldId)
    const players = members.filter((m) => m.role === 'player').length
    const gms = members.filter((m) => m.role === 'gm').length
    return [players && plural(players, 'player'), gms && plural(gms, 'co-GM')].filter(Boolean).join(' and ')
  } catch {
    return ''
  }
}

/** Every player and co-GM is taken out: the first line of what goes with a cloud copy. */
const takenOut = (who: string) => (who ? `Everyone who joined (${who}) is taken out of the world` : 'Every player and co-GM is taken out of the world')

/** What this device holds of a world, in lines with counts, for the world delete. */
async function onThisDevice(worldId: string) {
  const [pages, maps, campaigns, sessions, assets, bin] = await Promise.all([
    db.entities.where({ worldId }).filter((e) => !e.template).count(),
    db.maps.where({ worldId }).count(),
    db.campaigns.where({ worldId }).count(),
    db.sessions.where({ worldId }).toArray(),
    db.assets.where({ worldId }).toArray(),
    db.bin.where({ worldId }).count(),
  ])
  const recordingIds = new Set(sessions.flatMap((s) => s.recordings.map((r) => r.assetId)))
  const recordings = assets.filter((a) => recordingIds.has(a.id))
  const files = assets.length - recordings.length
  const bytes = assets.reduce((n, a) => n + (a.size || 0), 0)
  const only = await recordingsOnlyHere(worldId)
  /** "a, b and c", leaving out the ones there are none of. */
  const and = (parts: (string | false)[]) => {
    const xs = parts.filter((x): x is string => !!x)
    return xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : (xs[0] ?? '')
  }
  const lines = [
    and([!!pages && plural(pages, 'page'), !!maps && `${plural(maps, 'map')} with their pins`]),
    and([!!campaigns && plural(campaigns, 'campaign'), !!sessions.length && `${plural(sessions.length, 'session')} with their notes and recaps`]),
    and([!!files && plural(files, 'file'), !!recordings.length && plural(recordings.length, 'recording')]) + (bytes ? ` (${formatBytes(bytes)})` : ''),
  ].filter((x) => x && !x.startsWith(' ('))
  if (only.count) lines.push(`${only.count === 1 ? '1 recording is' : `${only.count} recordings are`} on this device only, in no backup`)
  if (bin) lines.push(`${plural(bin, 'thing')} in Recently deleted`)
  return lines
}

/** World settings › Danger zone: delete this world, after the dialog. */
export function DeleteWorldButton({ world }: { world: World }) {
  const navigate = useNavigate()
  const { ask, dialog } = useDeleteCheck()
  const [busy, setBusy] = useState(false)
  const worldId = world.id
  // A recording still running would go on writing into a world that's gone.
  const recording = useLiveRecording()?.worldId === worldId
  const go = async () => {
    setBusy(true)
    try {
      const inCloud = !!world.cloud?.enabled
      // Only the owner can delete the cloud copy; a co-GM (or anyone offline) only removes it from this device.
      const role = inCloud ? await myRole(worldId).catch(() => null) : null
      const owner = role === 'owner'
      const [here, who] = await Promise.all([onThisDevice(worldId), owner ? whoIsIn(worldId) : Promise.resolve('')])
      const backedUp = backupStore.read(worldId, 'last')
      const yes = await ask({
        title: world.name.trim() ? `Delete the world ${called(world)}?` : 'Delete this unnamed world?',
        goesTitle: 'Deleted from this device',
        goes: here,
        alsoGoes: owner ? { title: 'Deleted from the cloud', lines: ['The world’s cloud copy', takenOut(who), ...CLOUD_GOES] } : undefined,
        stays: !inCloud
          ? undefined
          : owner
            ? undefined
            : [
                role === 'gm'
                  ? 'The cloud copy: you’re a co-GM, so the world only goes from this device. The owner and the players keep it, and you can download it again from Your worlds.'
                  : 'The cloud copy: you’re offline or signed out, so it can’t be deleted now. Your players keep the world. To delete it too, cancel, sign in and try again.',
              ],
        back: `This can’t be undone, and it doesn’t go to Recently deleted. Only a backup brings it back${backedUp ? ` (your last one is from ${new Date(backedUp).toLocaleDateString()})` : ': you haven’t downloaded one on this device'}.`,
        extra: (
          <div className="row wrap">
            <BackupButton worldId={worldId} label="⬇ Download a backup first" />
          </div>
        ),
        confirm: 'Delete world',
        ...nameToType(world.name),
      })
      if (!yes) return
      let forGood = !inCloud
      if (owner) {
        try {
          await deleteCloudCopy(worldId)
          forGood = true
        } catch (e) {
          const local = await ask({
            title: 'The cloud copy couldn’t be deleted',
            goes: ['This device’s copy of the world'],
            stays: [`The cloud copy, and your players’ access to it (${(e as Error).message || 'something went wrong'})`],
            back: 'Try again later to delete the cloud copy too. Deleting only this device’s copy can’t be undone either.',
            confirm: 'Delete from this device only',
          })
          if (!local) return
        }
      }
      // Gone everywhere, so AssemblyAI's copies of transcripts still being made go too. (A world
      // only taken off this device keeps them, as another device may still pick them up.)
      if (forGood) await forgetCloudTranscripts(await db.sessions.where({ worldId }).toArray())
      await deleteWorld(worldId)
      navigate('/')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button className="danger" disabled={busy || recording} title={recording ? 'Stop the recording first' : undefined} onClick={go}>
        Delete this world
      </button>
      {recording && <span className="muted small"> Stop the recording first.</span>}
      {dialog}
    </>
  )
}

/** Players and sharing: delete the cloud copy (the owner only), after the dialog. `run` shows errors as the rest of the section does. */
export function DeleteCloudCopyButton({ world, run }: { world: World; run: (fn: () => Promise<unknown>) => Promise<unknown> }) {
  const { ask, dialog } = useDeleteCheck()
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try {
      const who = await whoIsIn(world.id)
      const yes = await ask({
        title: `Delete the cloud copy of ${called(world)}?`,
        goesTitle: 'Deleted from the cloud',
        goes: [takenOut(who), ...CLOUD_GOES],
        stays: ['This device’s copy of the world: every page, map, session and file'],
        back: 'This can’t be undone. Turning sync back on later doesn’t bring any of it back, and players would need a new invite.',
        confirm: 'Delete cloud copy',
        ...nameToType(world.name),
      })
      if (!yes) return
      await run(() => deleteCloudCopy(world.id))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button className="danger" disabled={busy} onClick={go}>
        Delete cloud copy
      </button>
      {dialog}
    </>
  )
}
