import { useState } from 'react'
import { DraftText } from './components'
import { Ico } from './icons'
import { rollDie } from './dice'
import { removeWithUndo } from './undo'
import { Shield, DiceFive, Skull, CaretDown } from '@phosphor-icons/react'
import type { Combatant, LecternState } from './db'

/**
 * One fighter in the Lectern's Initiative list: a single line (name, initiative, HP bar, quick
 * -5 / -1 / +1) with everything else a tap away, plus the pieces that run a fight: conditions
 * that count down, and the "Down" list for fighters who are out.
 */

export const CONDITIONS = ['Blinded', 'Charmed', 'Concentrating', 'Deafened', 'Exhausted', 'Frightened', 'Grappled', 'Hidden', 'Incapacitated', 'Invisible', 'Paralysed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious']

export const toNumber = (v: string) => {
  const n = parseInt(v, 10)
  return Number.isNaN(n) ? null : n
}

/**
 * A condition ending in a small number, like “Burning 2”, counts that many turns: it goes down by
 * one at the end of the fighter's turn and comes off at 0. Notes like “ends round 5” are left alone.
 */
const COUNTING = /^(.*\S)\s+(\d{1,2})$/
export const countsDown = (k: string) => {
  const m = k.match(COUNTING)
  return !!m && Number(m[2]) <= 10 && Number(m[2]) > 0 && !/\b(round|rounds|ends?|until|dc|level)\b/i.test(m[1])
}

/** Ticks a fighter's counting conditions down by one. Returns the ones that just ran out. */
export function tickConditions(c: Combatant) {
  const ended: string[] = []
  c.conditions = c.conditions.flatMap((k) => {
    if (!countsDown(k)) return [k]
    const m = k.match(COUNTING)!
    const left = Number(m[2]) - 1
    if (left <= 0) {
      ended.push(m[1])
      return []
    }
    return [`${m[1]} ${left}`]
  })
  return ended
}

export function HpControl({ c, onChange }: { c: Combatant; onChange: (fn: (c: Combatant) => void) => void }) {
  const [amount, setAmount] = useState('')
  // What HP was before the last change, so a slip can be taken back.
  const [was, setWas] = useState<number | null>(null)
  // "+8" heals and "-8" damages whatever button or key is used; a bare number follows the button (Enter damages).
  const apply = (button: 1 | -1) => {
    const m = amount.trim().match(/^([+\-−–])?\s*(\d+)/)
    if (!m) return
    const sign = m[1] ? (m[1] === '+' ? 1 : -1) : button
    const n = Number(m[2])
    setWas(c.hp ?? c.maxHp ?? 0)
    onChange((x) => {
      const now = (x.hp ?? x.maxHp ?? 0) + sign * n
      x.hp = Math.max(0, x.maxHp ? Math.min(now, x.maxHp) : now)
    })
    setAmount('')
  }
  if (c.hp == null && c.maxHp == null)
    return (
      <button className="ghost small" onClick={() => onChange((x) => void ((x.hp = 10), (x.maxHp = 10)))}>
        + track HP
      </button>
    )
  const pct = c.maxHp ? Math.max(0, Math.min(1, (c.hp ?? 0) / c.maxHp)) : 1
  return (
    <span className="hp">
      <span className="hp-bar" title={`${c.hp} / ${c.maxHp ?? '?'}`}>
        <span style={{ width: `${pct * 100}%` }} className={pct <= 0.25 ? 'low' : pct <= 0.5 ? 'mid' : ''} />
      </span>
      <DraftText className="hp-input" inputMode="numeric" value={c.hp?.toString() ?? ''} title="Current HP" aria-label={`Current HP of ${c.name}`} onCommit={(v) => onChange((x) => void (x.hp = toNumber(v)))} />
      <span className="muted">/</span>
      <DraftText className="hp-input" inputMode="numeric" value={c.maxHp?.toString() ?? ''} title="Max HP" aria-label={`Most HP of ${c.name}`} onCommit={(v) => onChange((x) => void (x.maxHp = toNumber(v)))} />
      <input
        className="hp-input"
        value={amount}
        placeholder="±"
        aria-label={`Damage or healing for ${c.name}`}
        title="Amount of damage or healing. Type +5 to heal or -5 to damage; a plain number follows the button you press (Enter damages)."
        onChange={(e) => setAmount(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && apply(-1)}
      />
      <button className="ghost" title="Damage" aria-label={`Damage ${c.name}`} onClick={() => apply(-1)}>
        −
      </button>
      <button className="ghost" title="Heal" aria-label={`Heal ${c.name}`} onClick={() => apply(1)}>
        +
      </button>
      {was !== null && (
        <button
          className="ghost small"
          title="Put HP back to what it was before the last change"
          onClick={() => {
            onChange((x) => void (x.hp = was))
            setWas(null)
          }}
        >
          Undo (was {was})
        </button>
      )}
    </span>
  )
}

/** Adds a condition: the usual ones in a list, and “Something else…” opens a box right here (no pop-up). */
function ConditionPicker({ c, options, onAdd }: { c: Combatant; options: string[]; onAdd: (k: string) => void }) {
  const [custom, setCustom] = useState<string>()
  if (custom !== undefined)
    return (
      <form
        className="row condition-custom"
        onSubmit={(e) => {
          e.preventDefault()
          const v = custom.trim()
          if (v) onAdd(v)
          setCustom(undefined)
        }}
      >
        <input
          autoFocus
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setCustom(undefined)}
          placeholder="e.g. Burning 2 or Marked"
          aria-label={`Condition for ${c.name}`}
          title="A number at the end counts down each turn, like “Burning 2”."
        />
        <button className="small" disabled={!custom.trim()}>
          Add
        </button>
        <button type="button" className="ghost small" onClick={() => setCustom(undefined)}>
          Cancel
        </button>
      </form>
    )
  return (
    <select
      className="condition-select"
      value=""
      aria-label={`Add a condition to ${c.name}`}
      onChange={(e) => {
        if (e.target.value === '__custom') setCustom('')
        else if (e.target.value) onAdd(e.target.value)
      }}
    >
      <option value="">+ condition</option>
      {options.filter((k) => !c.conditions.includes(k)).map((k) => (
        <option key={k}>{k}</option>
      ))}
      <option value="__custom">Something else…</option>
    </select>
  )
}

type Change = (id: string, fn: (c: Combatant) => void) => unknown
type EditL = (fn: (l: LecternState) => void) => unknown

/** Takes a fighter out of the order (removed, or just marked down), passing the turn on if it was theirs. */
export function removeFighter(l: LecternState, id: string, mode: 'remove' | 'down') {
  const live = l.combat.combatants.filter((x) => !x.defeated).sort((a, b) => (b.init ?? -Infinity) - (a.init ?? -Infinity))
  if (l.combat.activeId === id) {
    const i = live.findIndex((x) => x.id === id)
    const rest = live.filter((x) => x.id !== id)
    if (rest.length && i === live.length - 1) l.combat.round++
    l.combat.activeId = rest.length ? rest[i % rest.length].id : undefined
  }
  if (mode === 'remove') l.combat.combatants = l.combat.combatants.filter((x) => x.id !== id)
  else {
    const c = l.combat.combatants.find((x) => x.id === id)
    if (c) c.defeated = true
  }
}

export function Fighter({
  c,
  active,
  open,
  onToggle,
  change,
  edit,
  initMod,
  conditionOptions,
}: {
  c: Combatant
  active: boolean
  open: boolean
  onToggle: () => void
  change: Change
  edit: EditL
  initMod: number
  conditionOptions: string[]
}) {
  const tracked = c.hp != null || c.maxHp != null
  const pct = c.maxHp ? Math.max(0, Math.min(1, (c.hp ?? 0) / c.maxHp)) : 1
  const nudge = (d: number) =>
    change(c.id, (x) => {
      const now = (x.hp ?? x.maxHp ?? 0) + d
      x.hp = Math.max(0, x.maxHp ? Math.min(now, x.maxHp) : now)
    })
  return (
    <li className={`combatant side-${c.side} ${active ? 'active' : ''} ${c.hp === 0 ? 'down' : ''}`}>
      <div className="fighter-line">
        <button className="fighter-name" aria-expanded={open} onClick={onToggle} title={open ? 'Hide the details' : 'Show the details: initiative, side, conditions…'}>
          <span className="init-chip" title="Initiative">
            {c.init ?? '–'}
          </span>
          <strong className="combatant-name">{c.name}</strong>
          <Ico as={CaretDown} />
        </button>
        {c.ac && (
          <span className="field-chip" title="Armour class / defence">
            <Ico as={Shield} /> {c.ac}
          </span>
        )}
        {tracked && (
          <>
            <span className="hp-compact" title={`${c.hp ?? '?'} / ${c.maxHp ?? '?'} hit points`}>
              <span className="hp-bar">
                <span style={{ width: `${pct * 100}%` }} className={pct <= 0.25 ? 'low' : pct <= 0.5 ? 'mid' : ''} />
              </span>
              <span className="small">
                {c.hp ?? '?'}
                {c.maxHp != null && <span className="muted">/{c.maxHp}</span>}
              </span>
            </span>
            <span className="hp-quick">
              {[-5, -1, 1].map((d) => (
                <button key={d} className="ghost small" aria-label={`${d < 0 ? 'Damage' : 'Heal'} ${c.name} by ${Math.abs(d)}`} onClick={() => nudge(d)}>
                  {d > 0 ? `+${d}` : `−${-d}`}
                </button>
              ))}
            </span>
          </>
        )}
      </div>
      {c.conditions.length > 0 && !open && (
        <div className="tags fighter-conds small">
          {c.conditions.map((k) => (
            <span key={k} className="tag">
              {k}
            </span>
          ))}
        </div>
      )}
      {open && (
        <div className="fighter-details">
          {c.ac && (
            <span className="small muted">
              <Ico as={Shield} /> Armour class {c.ac}
            </span>
          )}
          <div className="row wrap">
            <label className="row small muted">
              Initiative
              <DraftText
                className="init-input"
                inputMode="numeric"
                value={c.init?.toString() ?? ''}
                placeholder="–"
                title="Initiative"
                saveOn="leave"
                onCommit={(v) => change(c.id, (x) => void (x.init = toNumber(v)))}
              />
            </label>
            <button
              className="ghost"
              title={`Roll d20${initMod ? ` ${initMod > 0 ? '+' : ''}${initMod}` : ''}`}
              aria-label={`Roll initiative for ${c.name}`}
              onClick={() => change(c.id, (x) => void (x.init = rollDie(20) + initMod))}
            >
              <Ico as={DiceFive} />
            </button>
            <select
              className="side-select"
              value={c.side}
              title="Side"
              aria-label={`Side of ${c.name}`}
              onChange={(e) => {
                const v = e.target.value as Combatant['side']
                change(c.id, (x) => void (x.side = v))
              }}
            >
              <option value="pc">PC</option>
              <option value="ally">Ally</option>
              <option value="foe">Foe</option>
            </select>
            <span className="fighter-actions">
            <button
              className="small"
              title="Out of the fight: moves to the Down list below, and the turn passes on"
              onClick={() =>
                removeWithUndo(
                  `${c.name} is down.`,
                  () => edit((l) => removeFighter(l, c.id, 'down')),
                  () =>
                    edit((l) => {
                      const x = l.combat.combatants.find((y) => y.id === c.id)
                      if (x) x.defeated = false
                    }),
                )
              }
            >
              <Ico as={Skull} /> Defeated
            </button>
            <button
              className="ghost"
              title="Remove"
              aria-label={`Remove ${c.name}`}
              onClick={() =>
                removeWithUndo(
                  `${c.name} is out of the fight.`,
                  () => edit((l) => removeFighter(l, c.id, 'remove')),
                  () => edit((l) => void (l.combat.combatants.some((x) => x.id === c.id) || l.combat.combatants.push(c))),
                )
              }
            >
              ✕
            </button>
            </span>
          </div>
          <div className="row wrap">
            <HpControl c={c} onChange={(fn) => change(c.id, fn)} />
          </div>
          <div className="row wrap">
            <span className="tags">
              {c.conditions.map((k) => (
                <span key={k} className="tag" title={countsDown(k) ? 'Counts down at the end of their turn' : undefined}>
                  {k}
                  <button
                    title="Remove"
                    aria-label={`Remove ${k}`}
                    onClick={() =>
                      removeWithUndo(
                        `${k} taken off ${c.name}.`,
                        () => change(c.id, (x) => void (x.conditions = x.conditions.filter((y) => y !== k))),
                        () => change(c.id, (x) => void (x.conditions = [...new Set([...x.conditions, k])])),
                      )
                    }
                  >
                    ✕
                  </button>
                </span>
              ))}
            </span>
            <ConditionPicker c={c} options={conditionOptions} onAdd={(v) => change(c.id, (x) => void (x.conditions = [...new Set([...x.conditions, v])]))} />
          </div>
        </div>
      )}
    </li>
  )
}

/** Fighters who are out of it, folded away; each can come back or be removed. */
export function DownList({ down, change, edit }: { down: Combatant[]; change: Change; edit: EditL }) {
  if (!down.length) return null
  return (
    <details className="down-list">
      <summary className="small">Down ({down.length})</summary>
      <ul>
        {down.map((c) => (
          <li key={c.id} className="row">
            <span className="combatant-name muted">{c.name}</span>
            <button className="small" onClick={() => change(c.id, (x) => void (x.defeated = false))}>
              Back in
            </button>
            <button
              className="ghost"
              aria-label={`Remove ${c.name}`}
              title="Remove"
              onClick={() =>
                removeWithUndo(
                  `${c.name} is out of the fight.`,
                  () => edit((l) => void (l.combat.combatants = l.combat.combatants.filter((x) => x.id !== c.id))),
                  () => edit((l) => void (l.combat.combatants.some((x) => x.id === c.id) || l.combat.combatants.push(c))),
                )
              }
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}
