import { useState } from 'react'
import type { Entity } from '../db'
import { plainLinks } from '../text'
import { cloudErrorMessage } from '../cloud/client'

export const HP_KEY = /^(hp|hit points|health)/i

/** Up to three numbers worth seeing at a glance: armour, hit points, level or class first. */
export function keyNumbers(c: Entity) {
  const facts = c.fields.filter((f) => !f.gm && f.key.trim() && f.value.trim())
  const want = [/^(ac|armou?r)/i, HP_KEY, /^(level|lvl)/i, /^class/i]
  const picked = want.flatMap((re) => facts.filter((f) => re.test(f.key.trim())).slice(0, 1))
  for (const f of facts) if (picked.length < 3 && !picked.includes(f)) picked.push(f)
  return picked.slice(0, 3)
}

/**
 * A character's key numbers as tiles: in the Common Room and at the top of their page. With
 * `onChangeHp` (the player's own character, in a joined copy) the hit points tile can be tapped to
 * change the number in place: "13/20" keeps its "/20" when you type a new current number.
 */
export function NumberTiles({ c, onChangeHp }: { c: Entity; onChangeHp?: (value: string) => Promise<unknown> }) {
  const tiles = keyNumbers(c)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!tiles.length) return null
  const save = async (value: string) => {
    if (!onChangeHp) return
    setBusy(true)
    setError('')
    try {
      await onChangeHp(value)
      setEditing(false)
    } catch (err) {
      setError(cloudErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <dl className="number-tiles">
        {tiles.map((f, i) => {
          const editable = !!onChangeHp && HP_KEY.test(f.key.trim())
          // “13/20” (or “13 / 20 (temp 3)”): only the first number is typed over.
          const m = f.value.match(/^\s*(-?\d+)(.*)$/)
          return (
            <div key={i}>
              <dt>{f.key}</dt>
              <dd>
                {editable && editing ? (
                  <form
                    className="tile-edit"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const typed = draft.trim()
                      if (typed) void save(m && /^-?\d+$/.test(typed) ? `${typed}${m[2]}` : typed)
                    }}
                  >
                    <input
                      autoFocus
                      inputMode="numeric"
                      value={draft}
                      aria-label={`New ${f.key}`}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
                    />
                    <button className="small primary" disabled={busy || !draft.trim()}>
                      {busy ? '…' : 'Save'}
                    </button>
                    <button type="button" className="small ghost" onClick={() => setEditing(false)} aria-label="Cancel">
                      ✕
                    </button>
                  </form>
                ) : editable ? (
                  <button
                    type="button"
                    className="link tile-value"
                    title={`Change your ${f.key}`}
                    onClick={() => {
                      setDraft(m ? m[1] : f.value)
                      setError('')
                      setEditing(true)
                    }}
                  >
                    {f.value} <span className="muted small">change</span>
                  </button>
                ) : (
                  plainLinks(f.value)
                )}
              </dd>
            </div>
          )
        })}
      </dl>
      {error && <p className="error small">{error}</p>}
    </>
  )
}
