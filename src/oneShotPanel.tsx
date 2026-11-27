import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowsCounterClockwise } from '@phosphor-icons/react'
import { db, type World } from './db'
import { Help } from './help'
import { Ico } from './icons'
import { Modal } from './components'
import './more.css'
import { formatBytes } from './hooks'
import { pagePath, worldPath } from './paths'
import { toast } from './undo'
import { BackupButton } from './BackupReminder'
import { listPlayers, UNNAMED } from './cloud/players'
import { oneShotOf, planReset, resetToStart, saveStartingPoint, setOneShot, startingPointFromBackup, startingPointSize, type ResetPlan } from './oneShot'

const when = (t: number) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

/** What this device holds as the world's starting point (without reading the files into memory). */
function useStartingPoint(worldId: string) {
  return useLiveQuery(async () => {
    const sp = await db.startingPoints.get(worldId)
    return sp ? { savedAt: sp.savedAt, size: startingPointSize(sp), pages: sp.entities.filter((e) => !e.template).length } : null
  }, [worldId])
}

/** "Reset for the next table", which opens the review before anything changes. */
export function ResetButton({ world, className = '', label = 'Reset for the next table' }: { world: World; className?: string; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <Ico as={ArrowsCounterClockwise} /> {label}
      </button>
      {open && <ResetDialog world={world} onClose={() => setOpen(false)} />}
    </>
  )
}

/** Loads a backup of this world as its starting point (for a device where none was saved). */
function FromBackup({ world, label }: { world: World; label: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  return (
    <>
      <button type="button" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'Reading the backup…' : label}
      </button>
      <input
        ref={input}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          setBusy(true)
          try {
            const sp = await startingPointFromBackup(world.id, file)
            if (!oneShotOf(world)) await setOneShot(world.id, { ...(world.gmScreen?.oneShot ?? {}), on: true, since: Date.now() })
            toast(`The backup from ${when(sp.savedAt)} is now this world’s starting point on this device.`)
          } catch (err) {
            alert((err as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      />
    </>
  )
}

/** World settings: switching one-shot mode on and off, and the starting point on this device. */
export function OneShotSettings({ world }: { world: World }) {
  const os = oneShotOf(world)
  const sp = useStartingPoint(world.id)
  const [busy, setBusy] = useState(false)
  const save = async (message: string) => {
    setBusy(true)
    try {
      await saveStartingPoint(world.id)
      toast(message)
    } catch (e) {
      alert(`The starting point couldn’t be saved (${(e as Error).message}). If this device is short of space, free some up and try again.`)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section id="settings-oneshot" className="one-shot-settings">
      <h2>
        <Ico as={ArrowsCounterClockwise} /> One-shot <Help topic="oneShot" />
      </h2>
      {!os ? (
        <>
          <p className="muted">
            Running this world again and again for different tables? Make it a one-shot: the world as it is now is saved as its starting point, and after each game “Reset for the next table” puts everything back, ready to run again.
          </p>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={async () => {
              await setOneShot(world.id, { ...(world.gmScreen?.oneShot ?? {}), on: true, since: Date.now() })
              await save('This world is a one-shot. Its starting point is saved on this device.')
            }}
          >
            Make this a one-shot
          </button>
        </>
      ) : (
        <>
          {sp ? (
            <p>
              Starting point saved on this device {when(sp.savedAt)} ({sp.pages} pages{sp.size ? `, ${formatBytes(sp.size)} of files` : ''}).
              {os.runs ? ` Played ${os.runs === 1 ? 'once' : `${os.runs} times`} so far.` : ''}
              {os.logId && (
                <>
                  {' '}
                  <Link to={pagePath(world.id, os.logId)}>Past runs</Link>
                </>
              )}
            </p>
          ) : sp === null ? (
            <p className="notice">
              There’s no starting point on this device yet (it isn’t synced). Save the world as it is now, if nobody has played it here yet, or use a backup downloaded from this world.
            </p>
          ) : null}
          <div className="row wrap">
            {sp && <ResetButton world={world} className="primary" />}
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                (!sp || confirm(`Save the world as it is now as its starting point? Resets will come back to this instead of how it was ${when(sp.savedAt)}.`)) &&
                save('The world as it is now is the starting point.')
              }
            >
              {sp ? 'Update starting point' : 'Save the world as it is now'}
            </button>
            <FromBackup world={world} label={sp ? 'Use a backup instead…' : 'Use a backup…'} />
            <button
              type="button"
              className="ghost"
              onClick={async () => {
                if (!confirm('Stop running this world as a one-shot? The starting point saved on this device is removed. The Past runs page stays.')) return
                await setOneShot(world.id, { ...os, on: false })
                await db.startingPoints.delete(world.id)
                toast('This world is no longer a one-shot.')
              }}
            >
              Stop being a one-shot
            </button>
          </div>
          <p className="small muted">Changed your prep? Update the starting point, so a reset keeps the change.</p>
        </>
      )}
    </section>
  )
}

const OTHERS: Record<keyof ResetPlan['others'], [string, string]> = {
  world: ['world setting', 'world settings'],
  sessions: ['session', 'sessions'],
  campaigns: ['campaign', 'campaigns'],
  maps: ['map', 'maps'],
  pins: ['map pin', 'map pins'],
  boards: ['corkboard', 'corkboards'],
  sounds: ['sound', 'sounds'],
  reputation: ['reputation', 'reputations'],
  assets: ['file', 'files'],
}

const SHORT = 12

/** The review before a reset: what changed since the starting point, what to keep, and the players. */
export function ResetDialog({ world, onClose }: { world: World; onClose: () => void }) {
  const navigate = useNavigate()
  const [plan, setPlan] = useState<ResetPlan | null>()
  const [players, setPlayers] = useState<string[]>()
  const [keep, setKeep] = useState<Set<string>>(new Set())
  const [all, setAll] = useState(false)
  const [log, setLog] = useState(true)
  const [removePlayers, setRemovePlayers] = useState(true)
  const [freeCharacters, setFreeCharacters] = useState(true)
  const [clearNotes, setClearNotes] = useState(true)
  const [busy, setBusy] = useState(false)
  const cloud = !!world.cloud?.enabled
  useEffect(() => {
    let live = true
    planReset(world.id).then((p) => live && setPlan(p))
    if (cloud)
      listPlayers(world.id)
        .then(({ members }) => live && setPlayers(members.filter((m) => m.role === 'player').map((m) => m.name || UNNAMED)))
        .catch(() => live && setPlayers([]))
    return () => {
      live = false
    }
  }, [world.id, cloud])

  const others = plan
    ? (Object.entries(plan.others) as [keyof ResetPlan['others'], number][]).map(([k, n]) => `${n} ${OTHERS[k][n === 1 ? 0 : 1]}`)
    : []
  const pages = plan?.pages ?? []
  const shown = all ? pages : pages.slice(0, SHORT)
  const run = async () => {
    setBusy(true)
    try {
      const { run, problems } = await resetToStart(world.id, { keep: [...keep], log, removePlayers: cloud && removePlayers, freeCharacters: cloud && freeCharacters, clearNotes: cloud && clearNotes })
      onClose()
      navigate(worldPath(world.id))
      toast(`Reset for the next table.${log ? ` Run ${run} is on the Past runs page.` : ''}${problems.length ? ` Not done: ${problems.join('; ')}.` : ''}`)
    } catch (e) {
      alert(`The world couldn’t be reset (${(e as Error).message}). Nothing was changed.`)
      setBusy(false)
    }
  }

  return (
    <Modal title="Reset for the next table" onClose={onClose}>
      {plan === undefined ? (
        <p className="muted">Looking at what changed…</p>
      ) : plan === null ? (
        <p>There’s no starting point on this device yet. Save one in World settings first.</p>
      ) : (
        <div className="one-shot-reset">
          <p>
            The world goes back to its starting point from {when(plan.startingPoint.savedAt)}: reveals, fog of war, clocks, the in-game time, handouts, who’s alive, loot, quests and the sessions with their Lectern. <Help topic="oneShotReset" />
          </p>
          {!pages.length && !others.length && <p className="muted">Nothing has changed since the starting point.</p>}
          {pages.length > 0 && (
            <fieldset>
              <legend>
                {pages.length === 1 ? '1 page changed' : `${pages.length} pages changed`} since then. Tick any fix to your prep you want to keep: it stays as it is now and becomes part of the starting point.
              </legend>
              <ul className="one-shot-pages">
                {shown.map((p) => (
                  <li key={p.id}>
                    <label className="row">
                      <input
                        type="checkbox"
                        checked={keep.has(p.id)}
                        onChange={(e) => {
                          const next = new Set(keep)
                          if (e.target.checked) next.add(p.id)
                          else next.delete(p.id)
                          setKeep(next)
                        }}
                      />
                      <span>
                        {p.name} <span className="muted small">· {p.how === 'new' ? 'new since (keep it)' : p.how === 'deleted' ? 'deleted since (keep it deleted)' : 'changed (keep the change)'}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {pages.length > SHORT && !all && (
                <button type="button" className="link" onClick={() => setAll(true)}>
                  Show all {pages.length}
                </button>
              )}
            </fieldset>
          )}
          {others.length > 0 && <p className="small">Also back to how they were: {others.join(', ')}.</p>}
          <fieldset>
            <legend>Also</legend>
            <label className="row">
              <input type="checkbox" checked={log} onChange={(e) => setLog(e.target.checked)} />
              Keep a record of this run (date, who played, recap and notes) on the GM-only “Past runs” page
            </label>
            {cloud && (
              <>
                <label className="row">
                  <input
                    type="checkbox"
                    checked={removePlayers}
                    onChange={(e) => {
                      setRemovePlayers(e.target.checked)
                      if (e.target.checked) setFreeCharacters(true)
                    }}
                  />
                  <span>
                    Remove the {players === undefined ? '' : players.length === 1 ? 'player' : `${players.length} players`} who joined
                    {players?.length ? ` (${players.join(', ')})` : ''}. The next group joins with the same invite link; co-GMs stay.
                  </span>
                </label>
                <label className="row">
                  <input type="checkbox" checked={freeCharacters || removePlayers} disabled={removePlayers} onChange={(e) => setFreeCharacters(e.target.checked)} />
                  Free up the characters they claimed, and clear their questions
                </label>
                <label className="row">
                  <input type="checkbox" checked={clearNotes} onChange={(e) => setClearNotes(e.target.checked)} />
                  Clear the players’ Group notes
                </label>
              </>
            )}
          </fieldset>
          <p className="small muted">What the reset replaces stays in Recently deleted for a month, and each page’s old version stays in its history.</p>
          <div className="row wrap">
            <BackupButton worldId={world.id} label="⬇ Download a backup first" />
          </div>
          <div className="row wrap">
            <button type="button" className="danger" disabled={busy} onClick={run}>
              {busy ? 'Resetting…' : 'Reset now'}
            </button>
            <button type="button" className="ghost" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/** The Desk's reminder that this world is a one-shot, with the reset one tap away. */
export function OneShotDesk({ world }: { world: World }) {
  const os = oneShotOf(world)
  const sp = useStartingPoint(world.id)
  if (!os || sp === undefined) return null
  return (
    <section className="card one-shot-desk">
      <div className="card-head">
        <h2>
          <Ico as={ArrowsCounterClockwise} /> One-shot <Help topic="oneShot" />
        </h2>
        <Link className="small" to={`${worldPath(world.id)}/settings?at=oneshot`}>
          Settings
        </Link>
      </div>
      {sp ? (
        <div className="row wrap spread">
          <p className="small muted">
            {os.runs ? `Played ${os.runs === 1 ? 'once' : `${os.runs} times`}. ` : ''}Played it? Put the world back to its starting point for the next table.
          </p>
          <ResetButton world={world} />
        </div>
      ) : (
        <p className="small">
          No starting point on this device yet. <Link to={`${worldPath(world.id)}/settings?at=oneshot`}>Save one or use a backup</Link>.
        </p>
      )}
    </section>
  )
}
