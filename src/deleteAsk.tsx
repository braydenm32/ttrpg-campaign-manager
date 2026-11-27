import { dropCloudTranscripts, transcriptsBeingMade } from './ai/TranscriptPanel'
import { assetUses, friendlyName } from './assetUses'
import { binCampaign, binFile, binMap, binSession, deletedNote } from './bin'
import { db, type Asset, type Campaign, type Session, type WorldMap } from './db'
import { useDeleteCheck } from './deleteCheck'
import { formatBytes } from './hooks'

/**
 * Deleting a session, a campaign, a map or a file: each asks first with the app's own dialog
 * (src/deleteCheck.tsx), saying what goes with real counts and what is kept. Nothing is typed,
 * because all four go to Recently deleted: after the delete the Undo note puts them back at once,
 * and Restore does for a month. Only a transcript AssemblyAI is still making can't come back, so
 * it is stopped after the GM says yes, never before, and the dialog says so when there is one.
 */

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** The last line of each dialog: where it goes and how it comes back. */
const back = (transcripts = 0) =>
  `It goes to Recently deleted (under More) for a month. Undo, or Restore there, brings it back.${
    transcripts ? ` ${transcripts === 1 ? 'A transcript still being made is' : `${transcripts} transcripts still being made are`} stopped, and would need making again.` : ''
  }`

/** A session's (or several sessions') recordings in words: "2 recordings (34 MB)", or '' for none. */
async function recordingsLine(sessions: Session[]) {
  const ids = sessions.flatMap((s) => s.recordings.map((r) => r.assetId))
  if (!ids.length) return ''
  const bytes = (await db.assets.bulkGet(ids)).reduce((n, a) => n + (a?.size || 0), 0)
  const made = sessions.flatMap((s) => s.recordings).filter((r) => r.transcript && !r.transcript.pending).length
  return `${plural(ids.length, 'recording')}${bytes ? ` (${formatBytes(bytes)})` : ''}${made ? `, with ${made === 1 && ids.length === 1 ? 'its transcript' : made === ids.length ? 'their transcripts' : plural(made, 'transcript')}` : ''}`
}

/** The session's Delete button. `onDeleted` runs once it has gone (to leave its screen). */
export function DeleteSessionButton({ session, campaign, recording, onDeleted }: { session: Session; campaign?: Campaign | null; recording: boolean; onDeleted: () => void }) {
  const { ask, dialog } = useDeleteCheck()
  const go = async () => {
    const s = (await db.sessions.get(session.id)) ?? session
    const called = `#${s.number}${s.title ? ` “${s.title}”` : ''}`
    const recs = s.recordings.length
    const yes = await ask({
      title: `Delete session ${called}?`,
      goes: ['Its prep, your notes, the recap and the highlights', await recordingsLine([s])].filter(Boolean),
      stays: [campaign ? `The campaign “${campaign.name}” and its other sessions` : 'The other sessions', 'Every page, map and file of the world'],
      back: back(await transcriptsBeingMade([s])),
      restorable: true,
      confirm: 'Delete session',
    })
    if (!yes) return
    // Only now: AssemblyAI's copy of a transcript still being made goes, and the session stops waiting on it.
    const stopped = (await dropCloudTranscripts([s])).length
    const bin = await binSession(s.id)
    onDeleted()
    deletedNote(`Session ${called} deleted${recs ? `, with its ${recs === 1 ? 'recording' : `${recs} recordings`}` : ''}.${stopped ? ' The transcript still being made was stopped.' : ''}`, bin)
  }
  return (
    <>
      <button className="danger" disabled={recording} title={recording ? 'Stop the recording first' : undefined} onClick={go}>
        Delete session
      </button>
      {dialog}
    </>
  )
}

/** The campaign's Delete button. Its sessions go with it; its characters stay in the world, and Restore puts them back in it. */
export function DeleteCampaignButton({ campaign, recording, onDeleted }: { campaign: Campaign; recording: boolean; onDeleted: () => void }) {
  const { ask, dialog } = useDeleteCheck()
  const go = async () => {
    const sessions = await db.sessions.where({ campaignId: campaign.id }).toArray()
    const characters = await db.entities.where({ worldId: campaign.worldId }).filter((e) => e.campaignId === campaign.id).count()
    const n = sessions.length
    const yes = await ask({
      title: `Delete the campaign “${campaign.name}”?`,
      goes: ['The campaign, with its pitch and story so far', n ? `${plural(n, 'session')}, with ${n === 1 ? 'its' : 'their'} prep, notes and recaps` : '', await recordingsLine(sessions)].filter(Boolean),
      stays: [
        'Every page, map and file of the world',
        characters ? `Its ${plural(characters, 'character')}: ${characters === 1 ? 'the page stays' : 'their pages stay'}, in no campaign until you restore it` : '',
      ].filter(Boolean),
      back: back(await transcriptsBeingMade(sessions)),
      restorable: true,
      confirm: 'Delete campaign',
    })
    if (!yes) return
    // As for one session: only now do AssemblyAI's copies of transcripts still being made go.
    const stopped = (await dropCloudTranscripts(sessions)).length
    // binCampaign sends its characters back to "any campaign" (so they don't vanish from every party) and remembers them for Restore.
    const bin = await binCampaign(campaign.id)
    onDeleted()
    deletedNote(
      `Campaign “${campaign.name}” deleted${n ? `, with its ${n === 1 ? 'session' : `${n} sessions`}` : ''}. The world’s pages, maps and files are kept.${stopped ? ' Transcripts still being made were stopped.' : ''}`,
      bin,
    )
  }
  return (
    <>
      <button className="danger" disabled={recording} title={recording ? 'Stop the recording first' : undefined} onClick={go}>
        Delete campaign
      </button>
      {dialog}
    </>
  )
}

/** The map's Delete button (Map settings). Its pins, fog and players' copy go with it; the pages its pins open stay. */
export function DeleteMapButton({ map, onDeleted }: { map: WorldMap; onDeleted: () => void }) {
  const { ask, dialog } = useDeleteCheck()
  const go = async () => {
    const pins = await db.pins.where({ mapId: map.id }).toArray()
    const linked = new Set(pins.map((p) => p.entityId).filter(Boolean)).size
    // As binMap works it out: the picture stays when another map or a page uses it too.
    const shared =
      (await db.maps.where({ worldId: map.worldId }).filter((x) => x.id !== map.id && x.imageId === map.imageId).count()) +
      (await db.entities.where({ worldId: map.worldId }).filter((e) => e.imageId === map.imageId).count())
    const ways = await db.pins.where({ worldId: map.worldId }).filter((p) => p.childMapId === map.id && p.mapId !== map.id).count()
    const yes = await ask({
      title: `Delete the map “${map.name}”?`,
      goes: [
        shared ? 'The map (its picture stays, as something else uses it)' : 'The map and its picture',
        pins.length ? plural(pins.length, 'pin') : '',
        map.fog ? 'Its fog of war' : '',
      ].filter(Boolean),
      affects: ways ? { title: 'Changed until you restore it', lines: [`${plural(ways, 'pin')} on other maps ${ways === 1 ? 'stops' : 'stop'} opening this one`] } : undefined,
      stays: linked ? [`The ${linked === 1 ? 'page its pins open' : `${linked} pages its pins open`}`] : undefined,
      back: back(),
      restorable: true,
      confirm: 'Delete map',
    })
    if (!yes) return
    const bin = await binMap(map.id)
    onDeleted()
    deletedNote(`Map “${map.name}” deleted${pins.length ? `, with its ${pins.length === 1 ? 'pin' : `${pins.length} pins`}` : ''}.`, bin)
  }
  return (
    <>
      <button className="danger" onClick={go}>
        Delete map
      </button>
      {dialog}
    </>
  )
}

/** A file's Delete button (Files). The dialog lists the pages, maps and handouts that use it: they show nothing in its place until it's restored. */
export function DeleteFileButton({ asset }: { asset: Asset }) {
  const { ask, dialog } = useDeleteCheck()
  const go = async () => {
    const where = (await assetUses(asset.worldId)).get(asset.id) ?? []
    const name = friendlyName(asset.name, where)
    const yes = await ask({
      title: `Delete the file “${name}”?`,
      goes: [`The file${asset.size ? ` (${formatBytes(asset.size)})` : ''}`],
      affects: where.length ? { title: where.length === 1 ? 'This goes without it until you restore it' : 'These go without it until you restore it', lines: where } : undefined,
      stays: where.length ? undefined : ['Everything else: nothing in this world uses this file'],
      back: back(),
      restorable: true,
      confirm: 'Delete file',
    })
    if (!yes) return
    const bin = await binFile(asset.id)
    deletedNote(`“${name}” deleted.`, bin)
  }
  return (
    <>
      <button className="danger" aria-label={`Delete ${asset.name}`} title="Delete (it asks first, and goes to Recently deleted for a month)" onClick={go}>
        🗑
      </button>
      {dialog}
    </>
  )
}
