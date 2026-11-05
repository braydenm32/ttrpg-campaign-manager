/**
 * Map packs: the GM's own pictures as map pieces. Drop in files, a folder or a ZIP; the app sorts
 * them into pieces (tree-1, tree-2 become versions of one "Tree"), the GM checks the guesses, and
 * the pack is saved on this device and, when signed in, stored once in their account. Switch a
 * pack on for a world in World settings › Map pieces. Players never see this screen or the pieces.
 */
import { Stack } from '@phosphor-icons/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuthSession } from '../cloud/auth'
import { Empty } from '../components'
import { db, type MapPack, type PackPiece, type PackScene } from '../db'
import { Help } from '../help'
import { useWorld } from '../hooks'
import { Ico } from '../icons'
import '../more.css'
import { forgetPictures } from '../packs/art'
import { draftPieces, finishPiece, makePictures, picturesIn, type PictureFile, type PieceDraft } from '../packs/parse'
import { PackThumb } from '../packs/PackPicker'
import { addPieces, bytesOnDevice, createPack, pullPacks, removePack, renamePack, replacePictures, setWorldPack, updatePiece, worldPacks } from '../packs/store'
import { worldPath } from '../paths'
import { toast } from '../undo'
import { useViewMode } from '../viewMode'

const SCENES: { id: PackScene; label: string }[] = [
  { id: 'battle', label: 'Battle maps' },
  { id: 'city', label: 'Town maps' },
  { id: 'world', label: 'World maps' },
]
const sceneLabel = (s: PackScene) => SCENES.find((x) => x.id === s)?.label ?? s

export const megabytes = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`)

/** How much a piece takes up online: every picture it has had (maps can still use old ones). */
const bytesOf = (p: PackPiece) => [p.versions, ...Object.values(p.older ?? {})].flat().reduce((n, v) => n + (v.bytes || 0), 0)

export default function MapPacks() {
  const { world } = useWorld()
  const { isGM } = useViewMode()
  const { user } = useAuthSession()
  const packs = useLiveQuery(() => db.packs.filter((p) => !p.deleted && !p.borrowed).toArray(), []) ?? []
  const pieces = useLiveQuery(() => db.packPieces.toArray(), []) ?? []
  const [into, setInto] = useState<string>('new')
  const uploadRef = useRef<HTMLElement>(null)

  useEffect(() => void pullPacks().catch(() => {}), [user?.id])
  if (!isGM) return <Empty>Map packs are a GM tool. Switch back to the GM view to use them.</Empty>

  const mine = new Set(packs.map((p) => p.id))
  const online = pieces.filter((p) => mine.has(p.packId)).reduce((n, p) => n + bytesOf(p), 0)
  packs.sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div className="page more-screen">
      <header className="page-header">
        <h1>
          <Ico as={Stack} /> Map packs <Help topic="mapPacks" />
        </h1>
      </header>
      <p className="muted">
        Your own pictures as pieces for the map builder, in every one of your worlds. Upload a pack once, then switch it on for a world in{' '}
        {world ? <Link to={`${worldPath(world.id)}/settings?at=packs`}>World settings › Map pieces</Link> : 'World settings › Map pieces'}. Players only ever get the finished map picture.
      </p>
      {!user && (
        <p className="notice small">
          You’re not signed in, so your packs stay on this device. Sign in (Account, on the home page) to keep them in your account and use them on your other devices and with co-GMs.
        </p>
      )}

      <section ref={uploadRef}>
        <h2>Add pictures</h2>
        <Upload packs={packs} into={into} setInto={setInto} />
      </section>

      <section>
        <h2>Your packs</h2>
        {user && packs.length > 0 && <p className="muted small">About {megabytes(online)} stored in your account.</p>}
        {!packs.length && <p className="muted">No packs yet. Add some pictures above.</p>}
        {packs.map((pack) => (
          <PackCard
            key={pack.id}
            pack={pack}
            pieces={pieces.filter((p) => p.packId === pack.id)}
            onAddMore={() => {
              setInto(pack.id)
              uploadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          />
        ))}
      </section>
    </div>
  )
}

/** Choosing pictures, checking the guesses about each piece, and saving them into a pack. */
function Upload({ packs, into, setInto }: { packs: MapPack[]; into: string; setInto: (id: string) => void }) {
  const { world } = useWorld()
  const [drafts, setDrafts] = useState<PieceDraft[]>([])
  const [name, setName] = useState('')
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState<string>()
  const [error, setError] = useState('')
  const [switchOn, setSwitchOn] = useState(true)

  const read = async (files: File[]) => {
    setError('')
    if (!files.length) return
    setBusy('Opening…')
    try {
      const pics = await picturesIn(files)
      if (!pics.length) {
        setError('No pictures in that. Packs take PNG, WebP, JPG, GIF or AVIF files, or a ZIP of them.')
        return
      }
      const found = draftPieces(pics)
      setDrafts((d) => [...d, ...found])
      // a ZIP or folder gives the pack its name
      if (!name && into === 'new') {
        const zip = files.find((f) => /\.zip$/i.test(f.name))
        const folder = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath?.split('/')[0]
        const guess = zip ? zip.name.replace(/\.zip$/i, '') : folder
        if (guess) setName(guess.replace(/[_-]+/g, ' ').trim())
      }
    } catch (e) {
      setError(e instanceof Error ? `Couldn’t open that: ${e.message}` : 'Couldn’t open that.')
    } finally {
      setBusy(undefined)
    }
  }

  const drop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    void read([...e.dataTransfer.files])
  }

  const change = (i: number, patch: Partial<PieceDraft>) => setDrafts((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  const save = async () => {
    if (!drafts.length) return
    setError('')
    try {
      const pack = into === 'new' ? await createPack(name || 'My pack') : packs.find((p) => p.id === into)
      if (!pack) return
      let done = 0
      const ready = []
      for (const d of drafts) {
        setBusy(`Making pictures: ${++done} of ${drafts.length}…`)
        ready.push(await finishPiece(d))
      }
      setBusy('Saving…')
      await addPieces(pack.id, ready)
      if (into === 'new' && switchOn && world) await setWorldPack(world, pack.id, true)
      toast(`${ready.length} piece${ready.length === 1 ? '' : 's'} added to ${pack.name}.`)
      setDrafts([])
      setName('')
      setInto(pack.id)
    } catch (e) {
      setError(e instanceof Error ? `Couldn’t save: ${e.message}` : 'Couldn’t save those pictures.')
    } finally {
      setBusy(undefined)
    }
  }

  const pictures = drafts.reduce((n, d) => n + d.files.length, 0)
  return (
    <div className="form">
      <label>
        Put them in{' '}
        <select value={into} onChange={(e) => setInto(e.target.value)}>
          <option value="new">A new pack</option>
          {packs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {into === 'new' && (
        <label>
          Name of the new pack <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Forest props, Dungeon tiles…" />
        </label>
      )}
      <div
        className={`pack-drop${over ? ' over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
      >
        <span>Drop pictures, a folder of them, or a ZIP here</span>
        <div className="row">
          <label className="button">
            Choose pictures or a ZIP
            <input type="file" multiple hidden accept="image/png,image/webp,image/jpeg,image/gif,image/avif,.zip,application/zip" onChange={(e) => void read([...(e.target.files ?? [])]).then(() => (e.target.value = ''))} />
          </label>
          <label className="button">
            Choose a folder
            <input
              type="file"
              multiple
              hidden
              ref={(el) => {
                if (el) el.setAttribute('webkitdirectory', '')
              }}
              onChange={(e) => void read([...(e.target.files ?? [])]).then(() => (e.target.value = ''))}
            />
          </label>
        </div>
        <span className="muted small">Folders become groups. tree-1, tree-2 become versions of one piece. “2x3” in a name makes it 2 squares by 3.</span>
      </div>
      {busy && <p className="muted" role="status">{busy}</p>}
      {error && <p className="error">{error}</p>}

      {drafts.length > 0 && (
        <>
          <h3>
            Check the pieces: {drafts.length} piece{drafts.length === 1 ? '' : 's'}, {pictures} picture{pictures === 1 ? '' : 's'}
          </h3>
          <p className="muted small">The app guessed these from the names. Fix anything that’s off; you can change them later too.</p>
          <div className="row wrap">
            <label>
              Set all to{' '}
              <select value="" onChange={(e) => e.target.value && setDrafts((d) => d.map((x) => ({ ...x, scene: e.target.value as PackScene })))}>
                <option value="">…</option>
                {SCENES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <table className="pack-check">
            <thead>
              <tr>
                <th>Pictures</th>
                <th>Name</th>
                <th>For</th>
                <th>Group</th>
                <th>Size (squares)</th>
                <th>Gives light</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {drafts.map((d, i) => (
                <tr key={`${d.group}/${d.label}/${i}`}>
                  <td>
                    <span className="thumbs">
                      {d.files.slice(0, 3).map((f) => (
                        <DraftThumb key={f.path} file={f} />
                      ))}
                      {d.files.length > 3 && <span className="muted small">+{d.files.length - 3}</span>}
                    </span>
                  </td>
                  <td>
                    <input type="text" aria-label="Name" value={d.label} onChange={(e) => change(i, { label: e.target.value })} />
                  </td>
                  <td>
                    <select aria-label="For" value={d.scene} onChange={(e) => change(i, { scene: e.target.value as PackScene })}>
                      {SCENES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input type="text" aria-label="Group" value={d.group} onChange={(e) => change(i, { group: e.target.value })} />
                  </td>
                  <td>
                    <SizeInputs cols={d.cols} rows={d.rows} onChange={(cols, rows) => change(i, { cols, rows })} />
                  </td>
                  <td>
                    <input type="checkbox" aria-label="Gives off light" checked={d.light} onChange={(e) => change(i, { light: e.target.checked })} />
                  </td>
                  <td>
                    <button type="button" className="link" onClick={() => setDrafts((x) => x.filter((_, j) => j !== i))}>
                      Leave out
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {into === 'new' && world && (
            <label className="check">
              <input type="checkbox" checked={switchOn} onChange={(e) => setSwitchOn(e.target.checked)} /> Switch the pack on for {world.name}
            </label>
          )}
          <div className="row">
            <button type="button" className="primary" disabled={!!busy} onClick={() => void save()}>
              {into === 'new' ? 'Save the pack' : 'Add to the pack'}
            </button>
            <button type="button" disabled={!!busy} onClick={() => setDrafts([])}>
              Start again
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function SizeInputs({ cols, rows, onChange }: { cols: number; rows: number; onChange: (cols: number, rows: number) => void }) {
  const fix = (v: string) => Math.min(40, Math.max(0.25, Number(v) || 1))
  return (
    <span className="row" style={{ gap: '.2em', flexWrap: 'nowrap' }}>
      <input className="size" type="number" min={0.25} max={40} step={0.25} aria-label="Squares across" value={cols} onChange={(e) => onChange(fix(e.target.value), rows)} />×
      <input className="size" type="number" min={0.25} max={40} step={0.25} aria-label="Squares down" value={rows} onChange={(e) => onChange(cols, fix(e.target.value))} />
    </span>
  )
}

/** A chosen picture, small, before it's saved. */
function DraftThumb({ file }: { file: PictureFile }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    const u = URL.createObjectURL(file.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  return url ? <img src={url} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} /> : null
}

/** One of the GM's packs: its pieces, and changing them. */
function PackCard({ pack, pieces, onAddMore }: { pack: MapPack; pieces: PackPiece[]; onAddMore: () => void }) {
  const [name, setName] = useState(pack.name)
  const [editing, setEditing] = useState<string>()
  const [here, setHere] = useState<number>()
  const [showHidden, setShowHidden] = useState(false)
  useEffect(() => setName(pack.name), [pack.name])
  useEffect(() => {
    void bytesOnDevice(pack.id).then(setHere)
  }, [pack.id, pieces.length])

  const hidden = pieces.filter((p) => p.hidden).length
  const list = pieces.filter((p) => showHidden || !p.hidden).sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label))
  const piece = pieces.find((p) => p.id === editing)
  return (
    <div className="card pack-card">
      <div className="row">
        <h3>
          <input aria-label="Pack name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== pack.name && void renamePack(pack.id, name)} />
        </h3>
      </div>
      <p>
        {pieces.length - hidden} piece{pieces.length - hidden === 1 ? '' : 's'}
        {hidden > 0 && `, ${hidden} hidden`}
        {here !== undefined && here > 0 && ` · ${megabytes(here)} on this device`}
        {pack.pending && ' · not in your account yet'}
      </p>
      <div className="stamp-grid">
        {list.map((p) => (
          <button key={p.id} type="button" className={`pack-tile${p.id === editing ? ' on' : ''}${p.hidden ? ' hidden' : ''}`} aria-pressed={p.id === editing} title={p.label} onClick={() => setEditing(p.id === editing ? undefined : p.id)}>
            <PackThumb piece={p} />
            <span>{p.label}</span>
          </button>
        ))}
      </div>
      {piece && <PieceEditor key={piece.id} piece={piece} onClose={() => setEditing(undefined)} />}
      <div className="row wrap pack-actions">
        <button type="button" onClick={onAddMore}>
          Add pictures
        </button>
        {hidden > 0 && (
          <button type="button" className="link" onClick={() => setShowHidden(!showHidden)}>
            {showHidden ? 'Leave out hidden pieces' : 'Show hidden pieces'}
          </button>
        )}
        <span style={{ flex: 1 }} />
        <RemovePack pack={pack} />
      </div>
    </div>
  )
}

function RemovePack({ pack }: { pack: MapPack }) {
  const worlds = useLiveQuery(() => db.worlds.toArray(), []) ?? []
  const using = worlds.filter((w) => worldPacks(w).includes(pack.id))
  return (
    <button
      type="button"
      className="link danger-link"
      onClick={async () => {
        const note = using.length ? ` It’s switched on for ${using.map((w) => w.name).join(', ')}; it will be switched off.` : ''
        if (!confirm(`Remove ${pack.name}?${note} Maps already drawn with its pieces keep them.`)) return
        for (const w of using) await setWorldPack(w, pack.id, false)
        await removePack(pack.id)
        toast(`${pack.name} removed.`)
      }}
    >
      Remove pack
    </button>
  )
}

/** Changing one piece: its name, what it's for, size, light; hiding it; new pictures. */
function PieceEditor({ piece, onClose }: { piece: PackPiece; onClose: () => void }) {
  const [label, setLabel] = useState(piece.label)
  const [group, setGroup] = useState(piece.group)
  const [busy, setBusy] = useState('')
  const set = (patch: Parameters<typeof updatePiece>[1]) => void updatePiece(piece.id, patch)
  return (
    <div className="form pack-edit">
      <div className="row wrap">
        <label>
          Name <input value={label} onChange={(e) => setLabel(e.target.value)} onBlur={() => label !== piece.label && set({ label: label.trim() || 'Piece' })} />
        </label>
        <label>
          Group <input value={group} onChange={(e) => setGroup(e.target.value)} onBlur={() => group !== piece.group && set({ group: group.trim() })} />
        </label>
        <label>
          For{' '}
          <select value={piece.scene} onChange={(e) => set({ scene: e.target.value as PackScene })}>
            {SCENES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Size (squares) <SizeInputs cols={piece.cols} rows={piece.rows} onChange={(cols, rows) => set({ cols, rows })} />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={!!piece.light} onChange={(e) => set({ light: e.target.checked || undefined })} /> Gives off light (for battle maps sent to a VTT)
      </label>
      <p className="muted small">
        {piece.versions.length} version{piece.versions.length === 1 ? '' : 's'}, for {sceneLabel(piece.scene).toLowerCase()}.{' '}
        {piece.versions.map((_, v) => (
          <PackThumb key={v} piece={piece} version={v} px={36} />
        ))}
      </p>
      {busy && <p className="muted" role="status">{busy}</p>}
      <div className="row wrap">
        <label className="button">
          New pictures…
          <input
            type="file"
            multiple
            hidden
            accept="image/png,image/webp,image/jpeg,image/gif,image/avif"
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])].slice(0, 8)
              e.target.value = ''
              if (!files.length) return
              setBusy('Making pictures…')
              try {
                const pics = await makePictures(files.map((f) => ({ path: f.name, blob: f })))
                await replacePictures(piece.id, pics)
                forgetPictures(piece.id)
                toast(`${piece.label} has new pictures. Maps drawn with the old ones keep them until you swap in World settings › Map pieces.`)
              } catch {
                toast('Couldn’t read those pictures.')
              } finally {
                setBusy('')
              }
            }}
          />
        </label>
        <button type="button" onClick={() => set({ hidden: piece.hidden ? undefined : true })}>
          {piece.hidden ? 'Show in the picker again' : 'Hide from the picker'}
        </button>
        <button type="button" className="link" onClick={onClose}>
          Done
        </button>
      </div>
      {!piece.hidden && <p className="muted small">Hiding a piece keeps it on maps that already use it; it just isn’t offered any more.</p>}
    </div>
  )
}
