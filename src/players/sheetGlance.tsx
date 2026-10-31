import type { Entity } from '../db'
import { plainLinks } from '../text'

/** Up to three numbers worth seeing at a glance: armour, hit points, level or class first. */
export function keyNumbers(c: Entity) {
  const facts = c.fields.filter((f) => !f.gm && f.key.trim() && f.value.trim())
  const want = [/^(ac|armou?r)/i, /^(hp|hit points|health)/i, /^(level|lvl)/i, /^class/i]
  const picked = want.flatMap((re) => facts.filter((f) => re.test(f.key.trim())).slice(0, 1))
  for (const f of facts) if (picked.length < 3 && !picked.includes(f)) picked.push(f)
  return picked.slice(0, 3)
}

/** A character's key numbers as tiles: in the Common Room and at the top of their page. */
export function NumberTiles({ c }: { c: Entity }) {
  const tiles = keyNumbers(c)
  if (!tiles.length) return null
  return (
    <dl className="number-tiles">
      {tiles.map((f, i) => (
        <div key={i}>
          <dt>{f.key}</dt>
          <dd>{plainLinks(f.value)}</dd>
        </div>
      ))}
    </dl>
  )
}
