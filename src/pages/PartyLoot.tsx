import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty, VisibilityBadge } from '../components'
import { db, saveEntity, type Entity, type World } from '../db'
import { Help } from '../help'
import { useVisibleEntities, useWorld } from '../hooks'
import { useViewMode } from '../viewMode'
import { Ico } from '../icons'
import { Backpack } from '@phosphor-icons/react'

/**
 * Party loot: every item someone is carrying, grouped by who has it, plus the party's coin.
 * An item's holder is set on its page ("Carried by"); here the GM can hand things around quickly.
 */
export default function PartyLoot() {
  const { worldId, world } = useWorld()
  const { isGM } = useViewMode()
  const entities = useVisibleEntities(worldId)
  if (!world) return null

  const items = entities.filter((e) => e.type === 'item')
  const carried = items.filter((e) => e.heldBy)
  const holders = entities.filter((e) => (e.type === 'pc' || e.type === 'npc') && carried.some((i) => i.heldBy === e.id))
  // Player characters always get a section, even with empty pockets.
  const pcs = entities.filter((e) => e.type === 'pc')
  // Items whose holder was deleted or is hidden go in the stash rather than vanishing.
  const known = (id?: string) => id === 'party' || entities.some((e) => e.id === id)
  const groups: { id: string; name: string; link?: string; items: Entity[] }[] = [
    { id: 'party', name: '🎒 Party stash', items: carried.filter((i) => !known(i.heldBy) || i.heldBy === 'party') },
    ...[...new Map([...pcs, ...holders].map((h) => [h.id, h])).values()].map((h) => ({
      id: h.id,
      name: `${h.type === 'pc' ? '🛡️' : '🧙'} ${h.name}`,
      link: `/w/${worldId}/e/${h.id}`,
      items: carried.filter((i) => i.heldBy === h.id),
    })),
  ]
  const loose = items.filter((i) => !i.heldBy)

  return (
    <div className="page">
      <header className="page-header">
        <h1>
          <Ico as={Backpack} /> Party loot <Help topic="loot" />
        </h1>
      </header>
      <CoinPurse world={world} editable={isGM} />
      {groups.map((g) => (
        <section key={g.id}>
          <h2>{g.link ? <Link to={g.link}>{g.name}</Link> : g.name}</h2>
          {g.items.length === 0 ? (
            <p className="muted small">Nothing carried.</p>
          ) : (
            <ItemList items={g.items} worldId={worldId} holders={groups} isGM={isGM} />
          )}
        </section>
      ))}
      {isGM && (
        <section>
          <h2>Items nobody is carrying</h2>
          {loose.length === 0 ? (
            <Empty>Every item is with someone. New treasure? Make an item page and set who carries it.</Empty>
          ) : (
            <ItemList items={loose} worldId={worldId} holders={groups} isGM={isGM} />
          )}
        </section>
      )}
    </div>
  )
}

function ItemList({ items, worldId, holders, isGM }: { items: Entity[]; worldId: string; holders: { id: string; name: string }[]; isGM: boolean }) {
  return (
    <ul className="entity-list loot-list">
      {items.map((i) => (
        <li key={i.id} className="row spread">
          <span>
            {isGM ? (
              <input
                className="qty"
                type="number"
                min={0}
                aria-label={`How many ${i.name}`}
                value={i.quantity ?? 1}
                onChange={(e) => db.entities.update(i.id, { quantity: Math.max(0, Number(e.target.value) || 0), updatedAt: Date.now() })}
              />
            ) : (
              <span className="qty">{i.quantity ?? 1}×</span>
            )}{' '}
            <Link to={`/w/${worldId}/e/${i.id}`}>{i.name}</Link> <VisibilityBadge value={i.visibility} />
            {i.summary && <span className="muted small"> · {i.summary}</span>}
          </span>
          {isGM && (
            <select
              aria-label={`Who carries ${i.name}`}
              value={i.heldBy ?? ''}
              onChange={(e) => saveEntity({ ...i, heldBy: e.target.value || undefined, updatedAt: Date.now() })}
            >
              <option value="">Nobody</option>
              {holders.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          )}
        </li>
      ))}
    </ul>
  )
}

const DEFAULT_COIN = ['pp', 'gp', 'sp', 'cp']

function CoinPurse({ world, editable }: { world: World; editable: boolean }) {
  const coin = world.partyCoin ?? []
  const [adding, setAdding] = useState('')
  const save = (next: World['partyCoin']) => db.worlds.update(world.id, { partyCoin: next, updatedAt: Date.now() })
  if (!editable && !coin.length) return null
  return (
    <section className="card coin-purse">
      <h2>💰 The party’s purse</h2>
      {coin.length === 0 ? (
        <div className="row wrap">
          <span className="muted small">No coin tracked yet.</span>
          <button className="small" onClick={() => save(DEFAULT_COIN.map((name) => ({ name, amount: 0 })))}>
            Start with pp, gp, sp, cp
          </button>
        </div>
      ) : (
        <div className="row wrap">
          {coin.map((c, i) => (
            <label key={c.name} className="coin">
              <span>{c.name}</span>
              {editable ? (
                <input
                  type="number"
                  value={c.amount}
                  onChange={(e) => save(coin.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) || 0 } : x)))}
                />
              ) : (
                <b>{c.amount}</b>
              )}
              {editable && (
                <button className="ghost small" title={`Stop tracking ${c.name}`} onClick={() => save(coin.filter((_, j) => j !== i))}>
                  ×
                </button>
              )}
            </label>
          ))}
        </div>
      )}
      {editable && (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault()
            const name = adding.trim()
            if (name && !coin.some((c) => c.name === name)) save([...coin, { name, amount: 0 }])
            setAdding('')
          }}
        >
          <input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Add a currency, gem or resource (e.g. credits, rations)" />
          <button disabled={!adding.trim()}>Add</button>
        </form>
      )}
    </section>
  )
}
