import { useEffect, useState } from 'react'
import { Megaphone, X } from '@phosphor-icons/react'
import { newId, type Entity, type LecternState, type RollAnswer, type RollCall } from './db'
import { roll } from './dice'
import { Help } from './help'
import { removeWithUndo } from './undo'
import { Ico } from './icons'
import { LecternPanel } from './lecternPanel'
import { RollDetail } from './atTheTable'
import { useTable } from './cloud/table'
import { bonusFor, parseCall, passes, withBonus } from './rollCall'

type Edit = (fn: (l: LecternState) => void) => unknown

/**
 * The Lectern's "Call for a roll": type "@all roll perception 15" or fill in the boxes, and
 * players who are following live get a Roll button. Results come back into one list, marked
 * against the DC. Anyone not online can be rolled for here, with the bonus from their page.
 */
export function CallForRoll({ lectern, edit, party, cloudId, live }: { lectern: LecternState; edit: Edit; party: Entity[]; cloudId?: string; live: boolean }) {
  const call = lectern.rollCall
  const [line, setLine] = useState('')
  const [label, setLabel] = useState('')
  const [dice, setDice] = useState('d20')
  const [dc, setDc] = useState('')
  const [to, setTo] = useState<string[]>([])
  const [secret, setSecret] = useState(false)
  const [showDc, setShowDc] = useState(false)
  const [problem, setProblem] = useState('')
  const parsed = line.trim() ? parseCall(line, party) : null

  // Players' results arrive on the live link; keep them with the call so they last.
  const { answers } = useTable(cloudId)
  const fresh = call ? answers.filter((a) => a.callId === call.id && !call.answers.some((x) => x.id === a.id)) : []
  const freshKey = fresh.map((a) => a.id).join(',')
  useEffect(() => {
    if (!freshKey || !call) return
    const add = fresh.map(({ callId: _c, ...a }) => a as RollAnswer)
    edit((l) => {
      if (l.rollCall?.id !== call.id) return
      const have = new Set(l.rollCall.answers.map((a) => a.id))
      // A character's newer roll replaces an older one.
      for (const a of add) {
        if (have.has(a.id)) continue
        l.rollCall.answers = [...l.rollCall.answers.filter((x) => !(a.entityId && x.entityId === a.entityId)), a]
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshKey])

  const start = (c: Omit<RollCall, 'id' | 'at' | 'answers'>) => {
    try {
      roll(c.dice)
    } catch (err) {
      return setProblem((err as Error).message)
    }
    setProblem('')
    edit((l) => void (l.rollCall = { ...c, id: newId(), at: Date.now(), answers: [] }))
    setLine('')
  }
  const fromLine = () => {
    if (!parsed) return setProblem('Type what to roll for, like “@all roll perception 15”.')
    if (parsed.unknown.length) return setProblem(`No one in the party called ${parsed.unknown.map((u) => `“${u}”`).join(' or ')}.`)
    start({ label: parsed.label, dice: parsed.dice, dc: parsed.dc, secret: parsed.secret || secret || undefined, showDc: showDc || undefined, to: parsed.to })
  }

  const asked = call ? (call.to.length ? party.filter((e) => call.to.includes(e.id)) : party) : []
  const rollFor = (e: Entity) => {
    if (!call) return
    const expr = withBonus(call.dice, bonusFor(e, call.label))
    const r = roll(expr)
    const a: RollAnswer = { id: newId(), entityId: e.id, who: e.name.split(' ')[0], expr: r.expr, total: r.total, detail: r.detail, crit: r.crit, byGM: true }
    edit((l) => {
      if (l.rollCall?.id !== call.id) return
      l.rollCall.answers = [...l.rollCall.answers.filter((x) => x.entityId !== e.id), a]
    })
  }

  return (
    <LecternPanel id="callroll" name="Call for a roll" keywords="ask roll check save perception dc everyone party" title={<><Ico as={Megaphone} /> Call for a roll <Help topic="callForRoll" /></>}>
      {call ? (
        <div className="roll-call">
          <div className="row spread">
            <strong>
              {call.label} <span className="muted small">{call.dice}{call.dc !== undefined && ` · DC ${call.dc}`}{call.secret && ' · secret'}</span>
            </strong>
            <button className="ghost small" title="Done: players’ Roll button goes away" onClick={() => removeWithUndo('Roll call closed.', () => edit((l) => void (l.rollCall = undefined)), () => edit((l) => void (l.rollCall = call)))}>
              <Ico as={X} /> Done
            </button>
          </div>
          <ul className="roll-call-results">
            {asked.map((e) => {
              const a = call.answers.find((x) => x.entityId === e.id)
              const pass = a ? passes(call, a.total) : undefined
              return (
                <li key={e.id} className={a ? (pass === true ? 'pass' : pass === false ? 'fail' : '') : 'waiting'}>
                  <span className="roll-call-who">{e.name}</span>
                  {a ? (
                    <span>
                      <b className="roll-total-small">{a.total}</b>{' '}
                      <span className="muted small">
                        {a.expr}: <RollDetail text={a.detail} />
                        {a.byGM && ' (you rolled)'}
                      </span>
                      {pass !== undefined && <span className="tag">{pass ? 'pass' : 'fail'}</span>}
                    </span>
                  ) : (
                    <span className="muted small">{live ? 'waiting…' : ''}</span>
                  )}
                  <button className="ghost small" onClick={() => rollFor(e)} title={`Roll ${withBonus(call.dice, bonusFor(e, call.label))} for ${e.name}`}>
                    {a ? 'Reroll' : 'Roll for them'}
                  </button>
                </li>
              )
            })}
            {call.answers
              .filter((a) => !a.entityId || !asked.some((e) => e.id === a.entityId))
              .map((a) => (
                <li key={a.id}>
                  <span className="roll-call-who">{a.who}</span>
                  <span>
                    <b className="roll-total-small">{a.total}</b> <span className="muted small">{a.expr}</span>
                  </span>
                </li>
              ))}
          </ul>
          {asked.length > 0 && call.answers.length < asked.length && (
            <button className="small" onClick={() => asked.filter((e) => !call.answers.some((a) => a.entityId === e.id)).forEach(rollFor)}>
              Roll for everyone still waiting
            </button>
          )}
          {!live && <p className="muted small">You’re not live, so players don’t see this. Roll for them here; bonuses come from their pages (a detail named “{call.label}”).</p>}
        </div>
      ) : (
        <>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault()
              fromLine()
            }}
          >
            <input
              value={line}
              onChange={(e) => {
                setLine(e.target.value)
                setProblem('')
              }}
              placeholder="@all roll perception 15"
              aria-label="Call for a roll"
            />
            <button className="primary" disabled={!line.trim()}>
              Ask
            </button>
          </form>
          {parsed && (
            <p className="muted small">
              {parsed.to.length ? party.filter((e) => parsed.to.includes(e.id)).map((e) => e.name.split(' ')[0]).join(', ') : 'Everyone'} rolls <b>{parsed.label}</b> ({parsed.dice}
              {parsed.dc !== undefined && `, DC ${parsed.dc}`}){parsed.secret && ', secretly'}
            </p>
          )}
          <details className="small">
            <summary>Or fill it in</summary>
            <div className="roll-call-form">
              <div className="row wrap">
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Perception" aria-label="What for" />
                <input className="wide-dice" value={dice} onChange={(e) => setDice(e.target.value)} aria-label="Dice" />
                <input className="hp-input" type="number" value={dc} onChange={(e) => setDc(e.target.value)} placeholder="DC" aria-label="DC" />
              </div>
              {party.length > 0 && (
                <div className="row wrap">
                  <label className="row">
                    <input type="checkbox" checked={!to.length} onChange={() => setTo([])} /> Everyone
                  </label>
                  {party.map((e) => (
                    <label key={e.id} className="row">
                      <input type="checkbox" checked={to.includes(e.id)} onChange={(ev) => setTo(ev.target.checked ? [...to, e.id] : to.filter((x) => x !== e.id))} /> {e.name.split(' ')[0]}
                    </label>
                  ))}
                </div>
              )}
              <button
                className="primary"
                disabled={!label.trim()}
                onClick={() => start({ label: label.trim(), dice: dice.trim() || 'd20', dc: dc ? Number(dc) : undefined, secret: secret || undefined, showDc: showDc || undefined, to })}
              >
                Ask
              </button>
            </div>
          </details>
          <div className="row wrap small">
            <label className="row" title="Players don’t see each other’s results, only you do">
              <input type="checkbox" checked={secret} onChange={(e) => setSecret(e.target.checked)} /> Secret
            </label>
            <label className="row" title="Players see the DC they need">
              <input type="checkbox" checked={showDc} onChange={(e) => setShowDc(e.target.checked)} /> Tell them the DC
            </label>
          </div>
          {problem && <p className="error small">{problem}</p>}
        </>
      )}
    </LecternPanel>
  )
}
