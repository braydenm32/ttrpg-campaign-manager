import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Entity, type Session, type World } from './db'
import { roll } from './dice'
import { bonusFor, withBonus } from './rollCall'
import {
  answerCall,
  answerSignal,
  gmIdOf,
  linkAsHost,
  linkAsPlayer,
  publishTable,
  sendSignal,
  setLiveSession,
  shareRoll,
  tableStateFor,
  useLiveSession,
  useTable,
  type SignalKind,
  type TableState,
} from './cloud/table'
import { useCharacterOwners } from './players/owners'
import { usePlaying } from './sound/player'
import { Ico } from './icons'
import { Broadcast, Coffee, DiceFive, HandWaving, Megaphone, Sparkle, Sword, Timer } from '@phosphor-icons/react'
import { worldPath } from './paths'

/**
 * The live table, both ends: the GM's app tells players what's happening (TableHost) and hears
 * their signals (TableSignals); a player's app listens (PlayerTableLink) and says when it's their
 * turn. The Common Room and the Lectern use the pieces below.
 */

/** For the GM: keeps players' Common Room in step with the session they went live with. Draws nothing. */
export function TableHost({ world }: { world: World }) {
  const sessionId = useLiveSession(world.id)
  // Until a new lookup answers, the last answer comes back: each one counts only for what it looked up.
  const found = useLiveQuery(async () => sessionId && { id: sessionId, session: (await db.sessions.get(sessionId)) ?? null }, [sessionId])
  const session = !sessionId ? null : found && found.id === sessionId ? found.session : undefined
  // A live session that's been deleted stops being live.
  useEffect(() => {
    if (sessionId && session === null) setLiveSession(world.id, undefined)
  }, [sessionId, session, world.id])
  const campaignId = session?.campaignId
  const foundCampaign = useLiveQuery(async () => campaignId && { id: campaignId, campaign: (await db.campaigns.get(campaignId)) ?? null }, [campaignId])
  const campaign = !campaignId ? null : foundCampaign && foundCampaign.id === campaignId ? foundCampaign.campaign : undefined
  const lectern = session?.lectern
  const ids = [lectern?.sceneId, ...(lectern?.combat.combatants.map((c) => c.entityId) ?? [])].filter((x): x is string => !!x)
  const key = ids.join(',')
  const pages = useLiveQuery(
    async () => new Map((await db.entities.bulkGet(key ? key.split(',') : [])).filter((e): e is Entity => !!e).map((e) => [e.id, e])),
    [key],
  )
  const sounds = useLiveQuery(() => db.sounds.where({ worldId: world.id }).toArray(), [world.id])
  const playing = usePlaying()
  const ready = session !== undefined && pages !== undefined && sounds !== undefined && campaign !== undefined
  const state = ready && session && session.worldId === world.id ? tableStateFor(session, pages, sounds, playing, campaign ?? undefined) : null
  const json = ready ? JSON.stringify(state) : ''
  const latest = useRef<TableState | null>(null)
  useEffect(() => {
    if (!json) return
    latest.current = JSON.parse(json)
    publishTable(world.id, latest.current)
  }, [json, world.id])
  useEffect(() => linkAsHost(world.id, () => latest.current), [world.id])
  return null
}

/** For the GM, in the top bar of every screen in the world: the session they're live with, and Stop. */
export function LiveBadge({ world }: { world: World }) {
  const sessionId = useLiveSession(world.id)
  const session = useLiveQuery(() => (sessionId ? db.sessions.get(sessionId) : undefined), [sessionId])
  if (!sessionId || session?.id !== sessionId) return null
  return (
    <div className="live-badge" role="status">
      <Link to={`${worldPath(world.id)}/s/${session.id}/lectern`} title={`Players are following session ${session.number} live. Open its Lectern`}>
        <span className="live-dot" /> Live<span className="live-badge-session"> · #{session.number}</span>
      </Link>
      <button className="ghost small" onClick={() => setLiveSession(world.id, undefined)} title="Stop sharing this session live with players">
        Stop
      </button>
    </div>
  )
}

/**
 * The Lectern's switch for the live link: players see nothing of a session until the GM goes
 * live with it. Going live with one session stops any other in the same world.
 */
export function GoLive({ world, session }: { world: World; session: Session }) {
  const live = useLiveSession(world.id)
  const lookup = useLiveQuery(() => (live && live !== session.id ? db.sessions.get(live) : undefined), [live, session.id])
  const other = lookup?.id === live ? lookup : undefined
  if (!world.cloud?.enabled) return null
  const goLive = () => {
    setLiveSession(world.id, session.id)
    // Older sessions could be set to share nothing; going live means sharing.
    if (session.lectern?.share?.off) db.sessions.where('id').equals(session.id).modify((s) => void (s.lectern!.share = { ...s.lectern!.share, off: undefined }))
  }
  if (live === session.id)
    return (
      <span className="live-badge" role="status">
        <span className="live-dot" /> Live to players
        <button className="ghost small" onClick={() => setLiveSession(world.id, undefined)} title="Stop sharing this session live. Players stop seeing it as being played">
          Stop
        </button>
      </span>
    )
  return (
    <span className="row wrap">
      {other && <span className="muted small">Session {other.number} is live now.</span>}
      <button className="go-live" onClick={goLive} title={other ? `Stops session ${other.number} and goes live with this one` : 'Players’ Common Room starts showing this session as being played'}>
        <Ico as={Broadcast} /> {other ? 'Go live with this one instead' : 'Go live to players'}
      </button>
    </span>
  )
}

const SIGNAL_TEXT: Record<SignalKind, string> = {
  act: 'would like to do something.',
  break: 'needs a break.',
  inspiration: 'wants to use inspiration.',
}
const SIGNAL_ICON = { act: HandWaving, break: Coffee, inspiration: Sparkle }

/** For the GM: players' signals, wherever the GM is in the app. */
export function TableSignals({ world }: { world: World }) {
  const { signals } = useTable(world.id)
  if (!signals.length) return null
  return (
    <div className="table-signals" role="status">
      {signals.map((s) => (
        <div key={s.id} className={`table-signal signal-${s.kind}`}>
          <span>
            <Ico as={SIGNAL_ICON[s.kind]} /> <b>{s.who}</b> {SIGNAL_TEXT[s.kind]}
          </span>
          {s.kind === 'inspiration' && s.entityId && (
            <button
              onClick={async () => {
                const e = await db.entities.get(s.entityId!)
                if (e) await db.entities.update(e.id, { inspiration: Math.max(0, (e.inspiration ?? 0) - 1), updatedAt: Date.now() })
                answerSignal(world.id, s.id)
              }}
            >
              Use it (−1)
            </button>
          )}
          <button onClick={() => answerSignal(world.id, s.id)}>OK</button>
        </div>
      ))}
    </div>
  )
}

/** A player's characters here, by local id and by the GM's id, and the name to sign rolls with. */
export function useMe(world: World) {
  const { owners } = useCharacterOwners(world)
  const ids = [...owners.entries()].filter(([, o]) => o.mine).map(([id]) => id)
  const key = ids.join(',')
  const characters = useLiveQuery(async () => (await db.entities.bulkGet(key ? key.split(',') : [])).filter((e): e is Entity => !!e), [key]) ?? []
  const me = world.shared?.members?.find((m) => m.userId === world.shared?.me)
  return {
    characters,
    gmIds: new Set(characters.map((c) => gmIdOf(c.id))),
    who: characters.map((c) => c.name.split(' ')[0]).join(' & ') || me?.name || 'A player',
  }
}

/** For a player in a joined world: listens to the table, and says when it's their turn. */
export function PlayerTableLink({ world }: { world: World }) {
  const cloudId = world.shared!.memberOf!
  useEffect(() => linkAsPlayer(cloudId), [cloudId])
  return (
    <>
      <YourTurn world={world} cloudId={cloudId} />
      <RollCallPrompt world={world} cloudId={cloudId} />
    </>
  )
}

/** For a player: the GM called for a roll that includes them. A Roll button, with their bonus filled in. */
function RollCallPrompt({ world, cloudId }: { world: World; cloudId: string }) {
  const { table, answered } = useTable(cloudId)
  const { characters } = useMe(world)
  const call = table?.call
  const asked = call ? characters.filter((c) => !call.to.length || call.to.includes(gmIdOf(c.id))) : []
  const [bonus, setBonus] = useState<Record<string, string>>({})
  const [closed, setClosed] = useState('')
  const [error, setError] = useState('')
  if (!call || !asked.length || closed === call.id) return null
  const done = answered[call.id]
  const go = async (c: Entity) => {
    const b = bonus[c.id] ?? String(bonusFor(c, call.label))
    try {
      const r = roll(withBonus(call.dice, Number(b) || 0))
      setError('')
      await answerCall(cloudId, { callId: call.id, entityId: gmIdOf(c.id), who: c.name.split(' ')[0], expr: `${call.label}: ${r.expr}`, total: r.total, detail: r.detail, crit: r.crit }, !!call.secret)
    } catch (err) {
      setError((err as Error).message)
    }
  }
  return (
    <div className="your-turn roll-call-prompt" role="alert">
      <Ico as={Megaphone} />
      <div>
        <strong>
          Your GM asks for a roll: {call.label}
          {call.dc !== undefined && <span className="muted"> (DC {call.dc})</span>}
        </strong>
        {done !== undefined ? (
          <div className="small">
            You rolled <b>{done}</b>{call.dc !== undefined && (done >= call.dc ? ' ✓' : ' ✗')}. {call.secret ? 'Only your GM sees it.' : 'Everyone at the table sees it.'}
          </div>
        ) : (
          asked.map((c) => (
            <form
              key={c.id}
              className="row wrap small"
              onSubmit={(e) => {
                e.preventDefault()
                void go(c)
              }}
            >
              {asked.length > 1 && <span>{c.name.split(' ')[0]}</span>}
              <span>
                {call.dice} +
              </span>
              <input
                className="hp-input"
                type="number"
                value={bonus[c.id] ?? String(bonusFor(c, call.label))}
                onChange={(e) => setBonus({ ...bonus, [c.id]: e.target.value })}
                aria-label="Your bonus"
                title="Your bonus for this roll"
              />
              <button className="primary">
                <Ico as={DiceFive} /> Roll
              </button>
            </form>
          ))
        )}
        {error && <div className="error small">{error}</div>}
      </div>
      <button onClick={() => setClosed(call.id)}>{done !== undefined ? 'OK' : 'Later'}</button>
    </div>
  )
}

function YourTurn({ world, cloudId }: { world: World; cloudId: string }) {
  const { table } = useTable(cloudId)
  const { gmIds, characters } = useMe(world)
  const combat = table?.combat
  const turn = combat?.order.find((t) => t.id === combat.turnId)
  const mine = !!turn?.entityId && gmIds.has(turn.entityId)
  const key = mine ? `${combat!.round}:${turn!.id}` : ''
  const [closed, setClosed] = useState('')
  useEffect(() => {
    if (key) navigator.vibrate?.([120, 60, 120])
  }, [key])
  if (!key || closed === key) return null
  const name = characters.find((c) => gmIdOf(c.id) === turn!.entityId)?.name ?? turn!.name
  return (
    <div className="your-turn" role="alert">
      <Ico as={Sword} /> <strong>Your turn, {name.split(' ')[0]}!</strong>
      <span className="muted small">Round {combat!.round}</span>
      <button onClick={() => setClosed(key)}>OK</button>
    </div>
  )
}

/** Whose turn it is, for players: the order, with them marked. */
export function TurnOrder({ combat, mine }: { combat: NonNullable<TableState['combat']>; mine: Set<string> }) {
  const i = combat.order.findIndex((t) => t.id === combat.turnId)
  const next = combat.order.length > 1 ? combat.order[(i + 1) % combat.order.length] : undefined
  return (
    <div className="turn-order">
      <div className="muted small">Round {combat.round}</div>
      <ol>
        {combat.order.map((t) => {
          const you = !!t.entityId && mine.has(t.entityId)
          return (
            <li key={t.id} className={`side-${t.side} ${t.id === combat.turnId ? 'active' : ''} ${you ? 'you' : ''}`}>
              <span>{t.name}</span>
              {you && <span className="tag">you</span>}
              {t.id === combat.turnId ? <span className="small">now</span> : t.id === next?.id ? <span className="small muted">next</span> : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** "I'd like to do something" and "I need a break": a quiet word to the GM. */
export function SignalButtons({ cloudId, who }: { cloudId?: string; who: string }) {
  const { sent } = useTable(cloudId)
  const [last, setLast] = useState<{ id: string; kind: SignalKind } | 'failed'>()
  const go = async (kind: SignalKind) => {
    if (!cloudId) return
    const id = await sendSignal(cloudId, kind, who)
    setLast(id ? { id, kind } : 'failed')
  }
  return (
    <div className="signal-buttons">
      <div className="row wrap">
        <button disabled={!cloudId} onClick={() => go('act')} title="Lets your GM know you have something you'd like to do, without interrupting">
          <Ico as={HandWaving} /> I’d like to do something
        </button>
        <button disabled={!cloudId} onClick={() => go('break')} title="Asks your GM for a short break">
          <Ico as={Coffee} /> I need a break
        </button>
      </div>
      {!cloudId ? (
        <p className="muted small">Players’ buttons work once they’ve joined the world.</p>
      ) : last === 'failed' ? (
        <p className="error small">Couldn’t reach your GM. Check your connection, or just tell them.</p>
      ) : last ? (
        <p className="small">{sent[last.id] === 'seen' ? '✓ Your GM saw it.' : 'Sent to your GM.'}</p>
      ) : null}
    </div>
  )
}

const QUICK_DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']

/** A dice roller whose rolls the whole table sees, with everyone's latest rolls. */
export function TableDice({ cloudId, who }: { cloudId?: string; who: string }) {
  const { rolls } = useTable(cloudId)
  const [local, setLocal] = useState<typeof rolls>([])
  const [expr, setExpr] = useState('')
  const [error, setError] = useState('')
  const doRoll = async (text: string) => {
    try {
      const r = roll(text)
      setError('')
      if (!cloudId) return setLocal((l) => [{ ...r, who, id: crypto.randomUUID(), at: Date.now() }, ...l].slice(0, 30))
      const ok = await shareRoll(cloudId, { who, expr: r.expr, total: r.total, detail: r.detail, crit: r.crit })
      if (!ok) setError('Only you saw that one: the table couldn’t be reached.')
    } catch (err) {
      setError((err as Error).message)
    }
  }
  const list = cloudId ? rolls : local
  return (
    <div className="table-dice">
      <div className="row wrap dice-buttons">
        {QUICK_DICE.map((d) => (
          <button key={d} onClick={() => doRoll(d)}>
            {d}
          </button>
        ))}
        <button title="Advantage: roll 2d20, keep the higher" onClick={() => doRoll('2d20kh1')}>
          Adv
        </button>
        <button title="Disadvantage: roll 2d20, keep the lower" onClick={() => doRoll('2d20kl1')}>
          Dis
        </button>
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          doRoll(expr)
        }}
      >
        <input value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="e.g. d20+5, 2d6+3" aria-label="Dice to roll" />
        <button className="primary">
          <Ico as={DiceFive} /> Roll
        </button>
      </form>
      {error && <p className="error small">{error}</p>}
      {list.length > 0 && <RollLog rolls={list} />}
    </div>
  )
}

/** Rolls at the table, newest first. */
export function RollLog({ rolls, limit = 8 }: { rolls: { id: string; who: string; total: number; expr: string; detail: string; crit?: 'high' | 'low' }[]; limit?: number }) {
  return (
    <ul className="roll-log table-rolls" aria-live="polite">
      {rolls.slice(0, limit).map((r) => (
        <li key={r.id} className={r.crit ?? ''}>
          <b className="roll-total-small">{r.total}</b> <span>{r.who}</span>{' '}
          <span className="muted small">
            {r.expr}: <RollDetail text={r.detail} />
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Shows dropped dice (from "keep highest/lowest") struck through. */
export function RollDetail({ text }: { text: string }) {
  return (
    <>
      {text.split(/~~(\d+)~~/).map((part, i) => (i % 2 ? <s key={i}>{part}</s> : <span key={i}>{part}</span>))}
    </>
  )
}

/** The time now, updated every so often (for countdowns). */
export function useNow(every = 1000, on = true) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return
    const t = setInterval(() => setNow(Date.now()), every)
    return () => clearInterval(t)
  }, [every, on])
  return now
}

/** Milliseconds left on a timer: counting down while running, frozen while paused. */
export const timeLeft = (t: { endsAt?: number; left?: number }, now: number) => Math.max(0, t.endsAt !== undefined ? t.endsAt - now : (t.left ?? 0))

/** "4:05", or "1:02:00" for long ones. */
export function clockText(ms: number) {
  const total = Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

/** Countdowns the GM is running, as players see them. */
export function TimerList({ timers }: { timers: NonNullable<TableState['timers']> }) {
  const now = useNow(500, timers.some((t) => t.endsAt !== undefined))
  return (
    <ul className="timer-list">
      {timers.map((t) => {
        const left = timeLeft(t, now)
        return (
          <li key={t.id} className={left === 0 ? 'done' : t.endsAt === undefined ? 'paused' : ''}>
            <Ico as={Timer} /> <span>{t.label || 'Timer'}</span>
            <b className="timer-time">{left === 0 ? 'Time’s up' : clockText(left)}</b>
            {t.endsAt === undefined && left > 0 && <span className="small muted">paused</span>}
          </li>
        )
      })}
    </ul>
  )
}

/** Timers in a line, for the strip at the top of the Common Room. */
export function TimerInline({ timers }: { timers: NonNullable<TableState['timers']> }) {
  const now = useNow(1000, timers.some((t) => t.endsAt !== undefined))
  return (
    <>
      {timers.map((t) => {
        const left = timeLeft(t, now)
        return (
          <span key={t.id} className={left === 0 ? 'timer-done' : ''}>
            <Ico as={Timer} /> {t.label || 'Timer'}: {left === 0 ? 'time’s up' : clockText(left)}
          </span>
        )
      })}
    </>
  )
}
