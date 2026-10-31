import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ClipboardText, Coins, DiceFive, IdentificationCard, Plus } from '@phosphor-icons/react'
import { blankEntity, db, type Entity, type EntityType, type World } from './db'
import { Help } from './help'
import { Ico } from './icons'
import { generateNames, NAME_KINDS, NAME_STYLES, namesLike, personNamesLike, type NameKind, type NameStyle } from './names'
import { worldPath } from './paths'
import { STARTER_TABLES, starterTableEntity } from './starterTables'
import { generateTreasure, TREASURE_SIZES, treasureMarkdown, type Treasure, type TreasureSize } from './treasure'
import { coinKey, editPurse } from './purse'
import { openNewPage } from './pendingPages'

/** Names in a style, or names like the world's own (its NPCs, places…). Click one to make a page or copy it. */
export function NameGenerator({ world, entities, compact }: { world: World; entities: Entity[]; compact?: boolean }) {
  const navigate = useNavigate()
  const [kind, setKind] = useState<NameKind>('person')
  const [style, setStyle] = useState<NameStyle | 'mine'>('common')
  const [names, setNames] = useState<string[]>(() => generateNames('person', 'common', compact ? 6 : 10))
  const [copied, setCopied] = useState('')
  // "Like my world's": names learnt from pages of the matching kind (people for people, places for places).
  const mineFrom = (k: NameKind) => {
    const types: EntityType[] = k === 'person' ? ['npc', 'pc'] : k === 'place' ? ['location'] : k === 'tavern' ? ['shop'] : ['item', 'custom']
    return entities.filter((e) => types.includes(e.type)).map((e) => e.name)
  }
  const roll = (k = kind, s = style) => {
    const n = compact ? 6 : 10
    if (s === 'mine') {
      const got = k === 'person' ? personNamesLike(mineFrom(k), n) : namesLike(mineFrom(k), n)
      setNames(got.length ? got : generateNames(k, 'common', n))
    } else setNames(generateNames(k, s, n))
    setCopied('')
  }
  const pageType: EntityType = kind === 'person' ? 'npc' : kind === 'place' ? 'location' : kind === 'tavern' ? 'shop' : 'item'
  return (
    <div className="name-generator">
      <div className="row wrap">
        <select value={kind} onChange={(e) => {
          const k = e.target.value as NameKind
          setKind(k)
          roll(k)
        }} aria-label="What to name">
          {Object.entries(NAME_KINDS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <select value={style} onChange={(e) => {
          const s = e.target.value as NameStyle | 'mine'
          setStyle(s)
          roll(kind, s)
        }} aria-label="Style">
          {Object.entries(NAME_STYLES).map(([k, s]) => (
            <option key={k} value={k}>
              {s.label}
            </option>
          ))}
          <option value="mine">Like my world’s names</option>
        </select>
        <button onClick={() => roll()}>
          <Ico as={DiceFive} /> More
        </button>
        <Help topic="names" />
      </div>
      {style === 'mine' && mineFrom(kind).length < 3 && <p className="muted small">Your world needs at least three names of this kind to learn from, so these are Common names for now.</p>}
      <ul className="name-list">
        {names.map((n) => (
          <li key={n}>
            <span>{n}</span>
            <button
              className="ghost small"
              title="Copy"
              aria-label={`Copy ${n}`}
              onClick={() => {
                navigator.clipboard.writeText(n).then(() => setCopied(n), () => undefined)
              }}
            >
              <Ico as={ClipboardText} />
              {copied === n && ' ✓'}
            </button>
            {!compact && (
              <button
                className="ghost small"
                title={`Make a page called ${n}`}
                onClick={async () => {
                  openNewPage(navigate, blankEntity(world.id, pageType, n))
                }}
              >
                <Ico as={Plus} /> Page
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Adds coins to the party's purse, merging with what's there. */
async function addCoins(worldId: string, coins: Treasure['coins']) {
  await editPurse(worldId, (purse) => {
    for (const c of coins) {
      const have = purse.find((p) => coinKey(p.name) === coinKey(c.name))
      if (have) have.amount += c.amount
      else purse.push({ ...c })
    }
    return purse
  })
}

/** Rolls a pile of treasure, then hands it to the party: coins into the purse, the rest as items in the stash. */
export function TreasureGenerator({ world, compact }: { world: World; compact?: boolean }) {
  const [size, setSize] = useState<TreasureSize>('stash')
  const [loot, setLoot] = useState<Treasure>(() => generateTreasure('stash'))
  const [given, setGiven] = useState(false)
  const [copied, setCopied] = useState(false)
  const reroll = (s = size) => {
    setLoot(generateTreasure(s))
    setGiven(false)
    setCopied(false)
  }
  const give = async () => {
    await addCoins(world.id, loot.coins)
    const items = loot.items.map((i) => {
      const e = blankEntity(world.id, 'item', i.name)
      e.heldBy = 'party'
      if (i.quantity && i.quantity > 1) e.quantity = i.quantity
      e.summary = [i.value && `Worth ${i.value}${i.quantity && i.quantity > 1 ? ' each' : ''}`, i.magic && 'Magical'].filter(Boolean).join('. ')
      if (i.value) e.fields = [{ key: 'Value', value: i.value }]
      e.tags = ['treasure']
      // Found by the party, so the party can see it.
      e.visibility = 'players'
      return e
    })
    await db.entities.bulkAdd(items)
    setGiven(true)
  }
  return (
    <div className="treasure-generator">
      <div className="row wrap">
        <select value={size} onChange={(e) => {
          const s = e.target.value as TreasureSize
          setSize(s)
          reroll(s)
        }} aria-label="How much treasure">
          {Object.entries(TREASURE_SIZES).map(([k, s]) => (
            <option key={k} value={k} title={s.hint}>
              {s.label}
            </option>
          ))}
        </select>
        <button onClick={() => reroll()}>
          <Ico as={DiceFive} /> Reroll
        </button>
        <Help topic="treasure" />
      </div>
      {!compact && <p className="muted small">{TREASURE_SIZES[size].hint}.</p>}
      <ul className="treasure-list small">
        {loot.coins.length > 0 && (
          <li>
            <Ico as={Coins} /> {loot.coins.map((c) => `${c.amount.toLocaleString()} ${c.name}`).join(', ')}
          </li>
        )}
        {loot.items.map((i, n) => (
          <li key={n}>
            {i.quantity && i.quantity > 1 ? `${i.quantity} × ` : ''}
            {i.name}
            {i.value && <span className="muted"> ({i.value}{i.quantity && i.quantity > 1 ? ' each' : ''})</span>}
            {i.magic && <span title="Magical"> ✨</span>}
          </li>
        ))}
      </ul>
      <div className="row wrap">
        <button className="primary" disabled={given} onClick={give} title="Coins go into the party’s purse, everything else into the party stash (players can see them)">
          {given ? '✓ Given to the party' : 'Give to the party'}
        </button>
        <button
          className="ghost"
          onClick={() => navigator.clipboard.writeText(treasureMarkdown(loot)).then(() => setCopied(true), () => undefined)}
        >
          <Ico as={ClipboardText} /> {copied ? 'Copied' : 'Copy'}
        </button>
        {given && <Link className="small" to={`${worldPath(world.id)}/loot`}>See party loot</Link>}
      </div>
    </div>
  )
}

/** Ready-made tables to add to the world, ticked one by one. Ones the world already has (by name) are left out. */
export function StarterTables({ world, tables }: { world: World; tables: Entity[] }) {
  const have = new Set(tables.map((t) => t.name.trim().toLowerCase()))
  const offer = STARTER_TABLES.filter((t) => !have.has(t.name.toLowerCase()))
  const [open, setOpen] = useState(false)
  const [chosen, setChosen] = useState<string[]>(() => offer.map((t) => t.name))
  const [added, setAdded] = useState(0)
  if (!offer.length && !added) return null
  return (
    <div className="starter-tables">
      {!open ? (
        <button className="ghost small" onClick={() => setOpen(true)}>
          <Ico as={IdentificationCard} /> {added ? `✓ Added ${added} tables. Add more…` : 'Add starter tables…'}
        </button>
      ) : (
        <div className="card">
          <div className="row spread">
            <strong>Starter tables <Help topic="starterTables" /></strong>
            <button className="ghost small" onClick={() => setOpen(false)} aria-label="Close">
              ✕
            </button>
          </div>
          {offer.map((t) => (
            <label key={t.name} className="row small">
              <input type="checkbox" checked={chosen.includes(t.name)} onChange={(e) => setChosen(e.target.checked ? [...chosen, t.name] : chosen.filter((x) => x !== t.name))} />
              <span>
                <b>{t.name}</b> <span className="muted">· {t.summary}</span>
              </span>
            </label>
          ))}
          <div className="row">
            <button
              className="primary"
              disabled={!chosen.length}
              onClick={async () => {
                const picked = offer.filter((t) => chosen.includes(t.name))
                await db.entities.bulkAdd(picked.map((t) => starterTableEntity(world.id, t)))
                setAdded(added + picked.length)
                setOpen(false)
              }}
            >
              Add {chosen.length} table{chosen.length === 1 ? '' : 's'}
            </button>
            <span className="muted small">They start as GM only, and you can change every line.</span>
          </div>
        </div>
      )}
    </div>
  )
}
