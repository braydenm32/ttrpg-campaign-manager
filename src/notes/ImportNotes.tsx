import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Camera, NotePencil, Question, X } from '@phosphor-icons/react'
import { ClaudeJob } from '../ai/ClaudeJob'
import { Modal } from '../components'
import { db, ENTITY_LABELS, newId, type Entity, type EntityType } from '../db'
import { Help } from '../help'
import { Ico } from '../icons'
import { nameIndex } from '../links'
import { pagePath } from '../paths'
import { toast } from '../undo'
import { applyNotes } from './apply'
import { notesFromReply, notesRequest, type NotePage, type NotesPlan } from './claude'
import { MAX_PHOTOS, readNotePhoto, type NotePhoto } from './photos'

const TYPES = (Object.keys(ENTITY_LABELS) as EntityType[]).filter((t) => t !== 'table' && t !== 'custom')

/**
 * "Import hand-written notes": photos or scans of the GM's notebook (or typed notes) go to Claude,
 * which sorts them into pages. The GM looks over every page before anything is added.
 */
export function ImportNotes({ worldId, onClose }: { worldId: string; onClose: () => void }) {
  const world = useLiveQuery(() => db.worlds.get(worldId), [worldId])
  const entities = useLiveQuery(() => db.entities.where({ worldId }).toArray(), [worldId])
  const [photos, setPhotos] = useState<NotePhoto[]>([])
  const [text, setText] = useState('')
  const [hints, setHints] = useState('')
  const [plan, setPlan] = useState<NotesPlan>()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  // Let go of the little previews when the dialog closes.
  const shown = useRef<NotePhoto[]>([])
  useEffect(() => {
    shown.current = photos
  }, [photos])
  useEffect(() => () => shown.current.forEach((p) => p.preview && URL.revokeObjectURL(p.preview)), [])
  const remove = (i: number) => {
    const p = photos[i]
    if (p.preview) URL.revokeObjectURL(p.preview)
    setPhotos((all) => all.filter((_, j) => j !== i))
  }

  const add = async (list: FileList | null) => {
    if (!list?.length) return
    setError('')
    const room = MAX_PHOTOS - photos.length
    const files = [...list].slice(0, Math.max(0, room))
    if (list.length > room) setError(`Up to ${MAX_PHOTOS} photos at a time. Import these, then do the rest.`)
    setBusy(`Getting ${files.length === 1 ? 'the photo' : `${files.length} photos`} ready…`)
    const read: NotePhoto[] = []
    for (const f of files) {
      try {
        read.push(await readNotePhoto(f))
      } catch (e) {
        setError((e as Error).message)
      }
    }
    setPhotos((p) => [...p, ...read])
    setBusy('')
  }

  const ready = photos.length > 0 || text.trim().length > 0

  return (
    <Modal title="Import hand-written notes" onClose={onClose}>
      {!plan ? (
        <div className="form sheet-import notes-import">
          <p className="muted small">
            <Help topic="importNotes" /> Claude reads your notes and sorts them into pages: people, places, factions, items, quests and what happened at the table.
            Nothing is added until you’ve looked it over, and it all arrives 🔒 GM only.
          </p>

          <div className="sheet-way">
            <h3>
              <Ico as={Camera} /> Photos or scans
            </h3>
            <label className="button">
              {photos.length ? 'Add more photos' : 'Add photos or scans'}
              <input type="file" hidden multiple accept="image/*,application/pdf,.pdf" onChange={(e) => (add(e.target.files), (e.target.value = ''))} />
            </label>
            <p className="muted small">
              One page per photo works best: flat, in good light, the right way up. A PDF from a scanner app is fine too. Up to {MAX_PHOTOS} at a time.
            </p>
            {photos.length > 0 && (
              <ol className="note-photos">
                {photos.map((p, i) => (
                  <li key={`${p.name}-${i}`}>
                    {p.preview ? <img src={p.preview} alt={`Photo ${i + 1}`} /> : <span className="note-pdf">PDF</span>}
                    <span className="small">
                      {i + 1}. {p.name}
                    </span>
                    <button className="ghost small" aria-label={`Remove ${p.name}`} onClick={() => remove(i)}>
                      <Ico as={X} />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="sheet-way">
            <h3>
              <Ico as={NotePencil} /> Typed notes <span className="muted small">(if you have any)</span>
            </h3>
            <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste notes from your phone, a document or an email." />
          </div>

          <div className="sheet-way">
            <h3>
              <Ico as={Question} /> Anything Claude should know? <span className="muted small">(optional)</span>
            </h3>
            <textarea
              rows={3}
              value={hints}
              onChange={(e) => setHints(e.target.value)}
              placeholder="e.g. Bram, Ysolde and Kit are the players’ characters. “The Crow” is Lady Vess. Red ink means secret."
            />
          </div>

          {ready && world && entities && (
            <ClaudeJob
              worldId={worldId}
              jobId={`notes:${worldId}`}
              jobTitle="Reading your notes"
              label="Read my notes"
              build={() => notesRequest({ worldName: world.name, system: world.system, entities, photos, text, hints })}
              priceKey={`${photos.map((p) => p.name).join('|')}:${text.length}:${hints.length}`}
              onResult={(reply) => {
                setError('')
                try {
                  setPlan(notesFromReply(reply))
                } catch (e) {
                  setError((e as Error).message)
                }
              }}
            />
          )}
        </div>
      ) : (
        entities && <NotesReview worldId={worldId} plan={plan} entities={entities} onBack={() => setPlan(undefined)} onClose={onClose} />
      )}
      {busy && <p className="muted small">{busy}</p>}
      {error && <p className="error small">{error}</p>}
    </Modal>
  )
}

interface Row {
  page: NotePage
  pick: boolean
  /** The world's page to add to, or '' for a new one. */
  into: string
}

/** Every page Claude found, to tick, rename, retype or point at a page the world already has. */
function NotesReview({ worldId, plan, entities, onBack, onClose }: { worldId: string; plan: NotesPlan; entities: Entity[]; onBack: () => void; onClose: () => void }) {
  const navigate = useNavigate()
  const world = useLiveQuery(() => db.worlds.get(worldId), [worldId])
  const campaigns = useLiveQuery(() => db.campaigns.where({ worldId }).sortBy('createdAt'), [worldId]) ?? []
  const pages = useMemo(() => entities.filter((e) => !e.template), [entities])
  const names = useMemo(() => nameIndex(pages), [pages])
  const [rows, setRows] = useState<Row[]>(() =>
    plan.pages.map((page) => ({ page, pick: true, into: (page.existing && names.get(page.existing.toLowerCase())?.id) || names.get(page.name.toLowerCase())?.id || '' })),
  )
  const [sessions, setSessions] = useState(() => plan.sessions.map(() => true))
  const [campaign, setCampaign] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const chosenCampaign = campaign || campaigns.at(-1)?.id || ''

  const set = (i: number, r: Partial<Row>) => setRows((all) => all.map((x, j) => (j === i ? { ...x, ...r } : x)))
  const setPage = (i: number, p: Partial<NotePage>) => setRows((all) => all.map((x, j) => (j === i ? { ...x, page: { ...x.page, ...p } } : x)))

  const picked = rows.filter((r) => r.pick && r.page.name.trim())
  const pickedSessions = plan.sessions.filter((_, i) => sessions[i])
  const newCount = picked.filter((r) => !r.into).length
  const addCount = picked.length - newCount

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      let campaignId = chosenCampaign
      if (pickedSessions.length && !campaignId && world) {
        // Sessions belong to a campaign; a world without one gets one, named after it.
        campaignId = newId()
        await db.campaigns.add({ id: campaignId, worldId, name: world.name, description: '', system: world.system, status: 'active', createdAt: Date.now() })
      }
      const res = await applyNotes(
        worldId,
        picked.map((r) => ({ page: { ...r.page, name: r.page.name.trim() }, into: r.into })),
        pickedSessions,
        campaignId || undefined,
      )
      const said = [
        res.made && `${res.made} new page${res.made === 1 ? '' : 's'}`,
        res.updated && `${res.updated} page${res.updated === 1 ? '' : 's'} updated`,
        res.sessions && `${res.sessions} session${res.sessions === 1 ? '' : 's'}`,
      ].filter(Boolean)
      toast(`From your notes: ${said.join(', ')}. All 🔒 GM only until you reveal them.`)
      onClose()
      if (res.first) navigate(pagePath(worldId, res.first))
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="form notes-review">
      {plan.unsure.length > 0 && (
        <div className="notice small">
          <strong>Check these: Claude wasn’t sure it read them right.</strong>
          <ul>
            {plan.unsure.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
          <span className="muted">Fix a name below before importing, or on the page afterwards.</span>
        </div>
      )}

      <p className="small">
        Claude found <strong>{plan.pages.length}</strong> page{plan.pages.length === 1 ? '' : 's'}
        {plan.sessions.length > 0 && (
          <>
            {' '}
            and <strong>{plan.sessions.length}</strong> session{plan.sessions.length === 1 ? '' : 's'}
          </>
        )}
        . Untick any you don’t want.
      </p>

      <ul className="notes-pages">
        {rows.map((r, i) => {
          const same = pages.filter((e) => e.type === r.page.type || e.id === r.into).sort((a, b) => a.name.localeCompare(b.name))
          return (
            <li key={i} className={r.pick ? undefined : 'notes-off'}>
              <div className="row">
                <input type="checkbox" checked={r.pick} onChange={(e) => set(i, { pick: e.target.checked })} aria-label={`Import ${r.page.name}`} />
                <input className="notes-name" value={r.page.name} onChange={(e) => setPage(i, { name: e.target.value })} aria-label="Name" />
              </div>
              <div className="notes-where">
                <select value={r.page.type} onChange={(e) => setPage(i, { type: e.target.value as EntityType })} aria-label="Type" disabled={!!r.into}>
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ENTITY_LABELS[t].icon} {ENTITY_LABELS[t].one}
                    </option>
                  ))}
                </select>
                <select value={r.into} onChange={(e) => set(i, { into: e.target.value })} aria-label="Where it goes">
                  <option value="">A new page</option>
                  {same.map((e) => (
                    <option key={e.id} value={e.id}>
                      Add to {e.name}
                    </option>
                  ))}
                </select>
              </div>
              {r.page.summary && <p className="muted small">{r.page.summary}</p>}
              <details>
                <summary className="small">What it says</summary>
                {r.page.fields.length > 0 && (
                  <dl className="sheet-fields">
                    {r.page.fields.map((f) => (
                      <div key={f.key}>
                        <dt>{f.key}</dt>
                        <dd>{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {r.page.body && <pre className="sheet-body">{r.page.body}</pre>}
                {r.page.secrets && (
                  <>
                    <p className="small">🔒 Into GM notes:</p>
                    <pre className="sheet-body">{r.page.secrets}</pre>
                  </>
                )}
                {r.page.in && <p className="muted small">In: {r.page.in}</p>}
              </details>
            </li>
          )
        })}
      </ul>

      {plan.sessions.length > 0 && (
        <>
          <h3 className="small">Sessions</h3>
          <ul className="notes-pages">
            {plan.sessions.map((s, i) => (
              <li key={i} className={sessions[i] ? undefined : 'notes-off'}>
                <label className="inline-check small">
                  <input type="checkbox" checked={sessions[i]} onChange={(e) => setSessions((all) => all.map((x, j) => (j === i ? e.target.checked : x)))} />
                  <strong>{s.title || 'A session'}</strong>
                  {s.date && <span className="muted"> · {s.date}</span>}
                </label>
                <details>
                  <summary className="small">What happened</summary>
                  <pre className="sheet-body">{s.notes}</pre>
                </details>
              </li>
            ))}
          </ul>
          {pickedSessions.length > 0 &&
            (campaigns.length > 1 ? (
              <label className="small">
                Add them to
                <select value={chosenCampaign} onChange={(e) => setCampaign(e.target.value)}>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="muted small">
                {campaigns.length
                  ? `They go at the end of ${campaigns[0].name}, as played, with your notes as their GM notes.`
                  : 'This world has no campaign yet, so one is made for them, named after the world.'}
              </p>
            ))}
        </>
      )}

      <p className="muted small">
        New pages are 🔒 GM only and tagged “from my notes”. Notes for a page you already have are added under “From my notes”, kept GM only if players can see
        that page, and its old version stays in its history. Secrets go into GM notes.
      </p>
      {error && <p className="error small">{error}</p>}
      <div className="row end">
        <button type="button" onClick={onBack}>
          Back
        </button>
        <button className="primary" disabled={busy || (!picked.length && !pickedSessions.length)} onClick={save}>
          {[newCount && `Add ${newCount} page${newCount === 1 ? '' : 's'}`, addCount && `update ${addCount}`, pickedSessions.length && `add ${pickedSessions.length} session${pickedSessions.length === 1 ? '' : 's'}`]
            .filter(Boolean)
            .join(', ')
            .replace(/^./, (c) => c.toUpperCase()) || 'Import'}
        </button>
      </div>
    </div>
  )
}

/** The button that opens it. */
export function ImportNotesButton({ worldId, className, label = 'Import hand-written notes' }: { worldId: string; className?: string; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className={className} onClick={() => setOpen(true)} title="Turn photos of your notebook, or typed notes, into pages">
        <Ico as={NotePencil} /> {label}
      </button>
      {open && <ImportNotes worldId={worldId} onClose={() => setOpen(false)} />}
    </>
  )
}
