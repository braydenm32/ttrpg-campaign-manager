import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { cloudErrorMessage } from '../cloud/client'
import {
  answerCharacterRequest,
  listCharacterRequests,
  listMyCharacterRequests,
  listPlayers,
  requestCharacter,
  withdrawCharacterRequest,
  type CharacterRequest,
  type CharacterSheet,
} from '../cloud/players'
import { schedule } from '../cloud/sync'
import { Modal } from '../components'
import { blankEntity, db, type World } from '../db'
import { Help } from '../help'
import { useCampaigns } from '../threads'
import { Ico } from '../icons'
import { MaskHappy, Plus, UserCirclePlus } from '@phosphor-icons/react'
import { pagePath } from '../paths'

/**
 * Players making their own characters. A player writes one up and sends it; the GM reads it,
 * then approves it (the app makes the character's page, revealed and already theirs) or turns it
 * down with a note.
 */

const STARTER_FIELDS = ['Ancestry', 'Class', 'Level']
const EXAMPLES: Record<string, string> = { Ancestry: 'e.g. Half-elf', Class: 'e.g. Ranger', Level: 'e.g. 1' }

/** For a player: the form to write up a new character. */
export function NewCharacterForm({ cloudId, onClose, onSent }: { cloudId: string; onClose: () => void; onSent: () => void }) {
  const [sheet, setSheet] = useState<CharacterSheet>({ name: '', summary: '', fields: STARTER_FIELDS.map((key) => ({ key, value: '' })), playerBody: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (patch: Partial<CharacterSheet>) => setSheet((s) => ({ ...s, ...patch }))
  const setField = (i: number, patch: Partial<CharacterSheet['fields'][number]>) => set({ fields: sheet.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) })
  return (
    <Modal title="A new character" onClose={onClose}>
      <form
        className="form new-character"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError('')
          try {
            await requestCharacter(cloudId, { ...sheet, fields: sheet.fields.filter((f) => f.key.trim() || f.value.trim()) })
            onSent()
            onClose()
          } catch (err) {
            setError(cloudErrorMessage(err))
          } finally {
            setBusy(false)
          }
        }}
      >
        <p className="muted small">
          Write up who you’d like to play. Your GM reads it and either makes it your character or gets back to you. <Help topic="newCharacter" />
        </p>
        <label>
          Name
          <input value={sheet.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} required autoFocus />
        </label>
        <label>
          In one line
          <input value={sheet.summary} onChange={(e) => set({ summary: e.target.value })} maxLength={300} placeholder="e.g. A disgraced temple guard looking for her brother" />
        </label>
        <div className="label">Details</div>
        {sheet.fields.map((f, i) => (
          <div key={i} className="row field-row">
            <input value={f.key} onChange={(e) => setField(i, { key: e.target.value })} placeholder="e.g. Class" maxLength={60} aria-label="Detail" />
            <input value={f.value} onChange={(e) => setField(i, { value: e.target.value })} placeholder={EXAMPLES[f.key] ?? ''} maxLength={300} aria-label="Value" />
            <button type="button" className="ghost small" aria-label="Remove" onClick={() => set({ fields: sheet.fields.filter((_, j) => j !== i) })}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="ghost small" onClick={() => set({ fields: [...sheet.fields, { key: '', value: '' }] })} disabled={sheet.fields.length >= 30}>
          <Ico as={Plus} /> Add a detail
        </button>
        <label>
          About them
          <textarea rows={6} value={sheet.playerBody} onChange={(e) => set({ playerBody: e.target.value })} maxLength={20000} placeholder="Where they come from, what they want, who they’ve left behind…" />
        </label>
        {error && <p className="error small">{error}</p>}
        <div className="row">
          <button className="primary" disabled={busy || !sheet.name.trim()}>
            {busy ? 'Sending…' : 'Send to my GM'}
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** For a player: "make a new character", plus any they've sent that are waiting or were turned down. */
export function MyNewCharacters({ world, compact }: { world: World; compact?: boolean }) {
  const cloudId = world.shared?.memberOf
  const [requests, setRequests] = useState<CharacterRequest[]>([])
  const [open, setOpen] = useState(false)
  const load = useCallback(async () => {
    if (!cloudId) return
    try {
      setRequests(await listMyCharacterRequests(cloudId))
    } catch {
      // Offline: nothing to show for now.
    }
  }, [cloudId])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    // A request answered elsewhere shows when the world next refreshes.
  }, [load, world.shared?.fetchedAt])
  if (!cloudId) return null
  return (
    <div className="my-new-characters">
      {requests.map((r) => (
        <div key={r.id} className={`small new-character-status ${r.status}`}>
          {r.status === 'pending' ? (
            <>
              <Ico as={MaskHappy} /> <b>{r.sheet.name}</b> is waiting for your GM.
            </>
          ) : (
            <>
              Your GM turned down <b>{r.sheet.name}</b>
              {r.gmNote ? `: “${r.gmNote}”` : '.'}
            </>
          )}{' '}
          <button
            className="link small"
            onClick={async () => {
              if (r.status === 'pending' && !confirm(`Take back ${r.sheet.name}?`)) return
              await withdrawCharacterRequest(r.id).catch(() => undefined)
              load()
            }}
          >
            {r.status === 'pending' ? 'Take it back' : 'Clear'}
          </button>
        </div>
      ))}
      <button className={compact ? 'link small' : 'small'} onClick={() => setOpen(true)}>
        <Ico as={UserCirclePlus} /> Make a new character
      </button>
      {open && <NewCharacterForm cloudId={cloudId} onClose={() => setOpen(false)} onSent={load} />}
    </div>
  )
}

/** For the GM: new characters players have sent, with a look at each and Approve or Turn down. */
export function NewCharacterRequestsBanner({ world }: { world: World }) {
  const [requests, setRequests] = useState<CharacterRequest[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [open, setOpen] = useState<CharacterRequest>()
  const load = useCallback(async () => {
    try {
      const [r, p] = await Promise.all([listCharacterRequests(world.id), listPlayers(world.id)])
      setRequests(r)
      setNames(new Map(p.members.map((m) => [m.userId, m.name])))
    } catch {
      // Offline, or the server hasn't been updated yet: nothing to show.
    }
  }, [world.id])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    const t = setInterval(() => !document.hidden && load(), 120_000)
    return () => clearInterval(t)
  }, [load])
  if (!requests.length) return null
  return (
    <div className="player-banner claim-requests">
      {requests.map((r, i) => (
        <div key={r.id} className="row wrap">
          <span>
            <Ico as={UserCirclePlus} /> <strong>{names.get(r.userId) ?? 'A player'}</strong> sent you a new character: <b>{r.sheet.name}</b>. {i === 0 && <Help topic="newCharacterGm" />}
          </span>
          <button className="primary small" onClick={() => setOpen(r)}>
            Read it
          </button>
        </div>
      ))}
      {open && <ReviewCharacter world={world} request={open} player={names.get(open.userId) ?? 'A player'} onClose={() => setOpen(undefined)} onDone={load} />}
    </div>
  )
}

function ReviewCharacter({ world, request, player, onClose, onDone }: { world: World; request: CharacterRequest; player: string; onClose: () => void; onDone: () => void }) {
  const campaigns = useCampaigns(world.id)
  const [campaignId, setCampaignId] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [made, setMade] = useState<string>()
  const s = request.sheet
  const run = async (approve: boolean) => {
    setBusy(true)
    setError('')
    try {
      if (approve) {
        const page = { ...blankEntity(world.id, 'pc', s.name.trim()), summary: s.summary, fields: s.fields, playerBody: s.playerBody, visibility: 'players' as const, campaignId: campaignId || undefined }
        // The player gets the page first (an approved claim), then the page itself syncs to them.
        await answerCharacterRequest(world.id, request.id, true, note, page.id)
        await db.entities.add(page)
        schedule(200)
        setMade(page.id)
      } else {
        await answerCharacterRequest(world.id, request.id, false, note)
        onClose()
      }
      onDone()
    } catch (e) {
      setError(cloudErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  if (made)
    return (
      <Modal title={`${s.name} is in`} onClose={onClose}>
        <p>
          {s.name} now has a page, revealed to players, and it’s {player}’s character. Add a picture, secrets or anything else on <Link to={pagePath(world.id, made)} onClick={onClose}>their page</Link>.
        </p>
        <button className="primary" onClick={onClose}>
          Done
        </button>
      </Modal>
    )
  return (
    <Modal title={`${player}’s new character`} onClose={onClose}>
      <div className="review-character">
        <h3>{s.name}</h3>
        {s.summary && <p className="lead">{s.summary}</p>}
        {s.fields.length > 0 && (
          <dl className="room-facts">
            {s.fields.map((f, i) => (
              <div key={i}>
                <dt>{f.key}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {s.playerBody && <p className="pre-wrap">{s.playerBody}</p>}
        {campaigns.length > 1 && (
          <label className="form">
            Plays in
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">Any campaign</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="form">
          A note for {player} (optional)
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Welcome aboard! Or: could they be from the coast instead?" />
        </label>
        {error && <p className="error small">{error}</p>}
        <div className="row wrap">
          <button className="primary" disabled={busy} onClick={() => run(true)}>
            ✓ Approve and make the page
          </button>
          <button disabled={busy} onClick={() => run(false)}>
            Turn down
          </button>
        </div>
      </div>
    </Modal>
  )
}
