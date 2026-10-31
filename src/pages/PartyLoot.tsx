import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useSearchParams } from 'react-router-dom'
import { DraftText, Empty, VisibilityBadge } from '../components'
import { db, saveEntity, type Entity, type World } from '../db'
import { Help } from '../help'
import { useVisibleEntities, useWorld } from '../hooks'
import { useViewMode } from '../viewMode'
import { Ico } from '../icons'
import { ArrowLeft, Backpack, Minus, Plus, X } from '@phosphor-icons/react'
import { pagePath, worldPath } from '../paths'
import { partyLoot, quantityLabel } from '../counts'
import { changeCoin, editPurse, tidyPurse } from '../purse'
import { removeWithUndo } from '../undo'
import { useKeepScroll } from '../jump'

/**
 * Party loot: the party's coin, the party stash and what each player character carries. The GM also
 * sees what others carry (NPCs, shops, places) and what nobody does. An item's holder is set on its
 * page ("Carried by"); here the GM can hand things around quickly.
 */
export default function PartyLoot() {
  const { worldId, world } = useWorld()
  const { isGM } = useViewMode()
  const entities = useVisibleEntities(worldId)
  // Opened from the Lectern's "Party found" panel: a way straight back to the table.
  const from = useSearchParams()[0].get('from')
  const fromSession = useLiveQuery(async () => (from ? ((await db.sessions.get(from)) ?? null) : null), [from])
  useKeepScroll(!!world)
  if (!world) return null

  const loot = partyLoot(entities, world)
  // Player characters always get a section, even with empty pockets.
  const groups: { id: string; name: string; link?: string; items: Entity[] }[] = [
    { id: 'party', name: '🎒 Party stash', items: loot.stash },
    ...loot.members.map(({ holder: h, items }) => ({ id: h.id, name: `🛡️ ${h.name}`, link: pagePath(worldId, h.id), items })),
  ]
  // Characters with empty pockets share one line instead of a block each.
  const emptyHanded = loot.members.filter((m) => !m.items.length).map((m) => m.holder)
  // Who else can be picked as a carrier: whoever carries something now.
  const others = [...new Set(loot.elsewhere.map((i) => i.heldBy!))].flatMap((id) => entities.filter((e) => e.id === id))
  const holders = [...groups, ...others.map((h) => ({ id: h.id, name: `${h.type === 'npc' ? '🧙' : '📍'} ${h.name}` }))]

  return (
    <div className="page">
      <header className="page-header">
        {isGM && fromSession && fromSession.worldId === worldId && (
          <Link className="button back-to" to={`${worldPath(worldId)}/s/${fromSession.id}/lectern`}>
            <Ico as={ArrowLeft} /> Back to the Lectern (#{fromSession.number} {fromSession.title})
          </Link>
        )}
        <h1>
          <Ico as={Backpack} /> Party loot <Help topic="loot" />
        </h1>
      </header>
      <CoinPurse world={world} coin={isGM ? tidyPurse(world.partyCoin) : loot.coin} editable={isGM} />
      {groups
        .filter((g) => g.id === 'party' || g.items.length)
        .map((g) => (
          <section key={g.id}>
            <h2>{g.link ? <Link to={g.link}>{g.name}</Link> : g.name}</h2>
            {g.items.length === 0 ? (
              <p className="muted small">Nothing in the stash.</p>
            ) : (
              <ItemList items={g.items} worldId={worldId} holders={holders} isGM={isGM} />
            )}
          </section>
        ))}
      {emptyHanded.length > 0 && (
        <p className="muted small empty-handed">
          Nothing carried:{' '}
          {emptyHanded.map((h, i) => (
            <span key={h.id}>
              {i > 0 && ', '}
              <Link to={pagePath(worldId, h.id)}>{h.name}</Link>
            </span>
          ))}
          .
        </p>
      )}
      {isGM && loot.elsewhere.length > 0 && (
        <section>
          <h2>Carried by others</h2>
          <ItemList items={loot.elsewhere} worldId={worldId} holders={holders} isGM={isGM} />
        </section>
      )}
      {isGM && (
        <section>
          <h2>Items nobody is carrying</h2>
          {loot.loose.length === 0 ? (
            <Empty>Every item is with someone. New treasure? Make an item page and set who carries it.</Empty>
          ) : (
            <ItemList items={loot.loose} worldId={worldId} holders={holders} isGM={isGM} />
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
              quantityLabel(i) && <span className="qty">{quantityLabel(i)}</span>
            )}{' '}
            <Link to={`${pagePath(worldId, i.id)}`}>{i.name}</Link> <VisibilityBadge value={i.visibility} />
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
const STEPS = [1, 5, 10, 100]

/**
 * The purse, one line per coin. The GM puts coins in or takes them out with + and − (by the step
 * picked above the lines), or taps the number to type a new total. Players see the coins there are.
 */
function CoinPurse({ world, coin, editable }: { world: World; coin: { name: string; amount: number }[]; editable: boolean }) {
  const [adding, setAdding] = useState('')
  const [step, setStep] = useState(1)
  const save = (fn: (purse: { name: string; amount: number }[]) => { name: string; amount: number }[]) => editPurse(world.id, fn)
  if (!editable && !coin.length) return null
  return (
    <section className="card coin-purse">
      <div className="row spread wrap">
        <h2>
          💰 The party’s purse {editable && <Help topic="lootSteps" />}
        </h2>
        {editable && coin.length > 0 && (
          <div className="row coin-steps" role="group" aria-label="How many coins each tap">
            {STEPS.map((n) => (
              <button key={n} className={`chip ${step === n ? 'on' : ''}`} aria-pressed={step === n} onClick={() => setStep(n)}>
                {n}
              </button>
            ))}
          </div>
        )}
      </div>
      {coin.length === 0 ? (
        <div className="row wrap">
          <span className="muted small">No coin tracked yet.</span>
          {editable && (
            <button className="small" onClick={() => save(() => DEFAULT_COIN.map((name) => ({ name, amount: 0 })))}>
              Start with pp, gp, sp, cp
            </button>
          )}
        </div>
      ) : (
        <ul className="coin-lines">
          {coin.map((c, i) => (
            <li key={c.name} className="coin-line">
              <span className="coin-name">{c.name}</span>
              {editable ? (
                <>
                  <button className="coin-step" aria-label={`Take ${step} ${c.name} out`} onClick={() => changeCoin(world.id, c.name, -step)}>
                    <Ico as={Minus} />
                  </button>
                  <DraftText
                    className="coin-amount"
                    inputMode="numeric"
                    aria-label={`${c.name} in the purse`}
                    value={String(c.amount)}
                    saveOn="leave"
                    onCommit={(v) => {
                      const n = Math.round(Number(v))
                      if (Number.isFinite(n)) return save((p) => p.map((x) => (x.name === c.name ? { ...x, amount: n } : x)))
                    }}
                  />
                  <button className="coin-step" aria-label={`Put ${step} ${c.name} in`} onClick={() => changeCoin(world.id, c.name, step)}>
                    <Ico as={Plus} />
                  </button>
                  <button
                    className="ghost coin-remove"
                    title={`Stop tracking ${c.name}`}
                    aria-label={`Stop tracking ${c.name}`}
                    onClick={() =>
                      removeWithUndo(
                        `${c.name} no longer tracked${c.amount ? ` (it had ${c.amount})` : ''}.`,
                        () => save((p) => p.filter((x) => x.name !== c.name)),
                        () => save((p) => (p.some((x) => x.name === c.name) ? p : [...p.slice(0, i), c, ...p.slice(i)])),
                      )
                    }
                  >
                    <Ico as={X} />
                  </button>
                </>
              ) : (
                <b className="coin-amount">{c.amount}</b>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault()
            const name = adding.trim()
            if (name) void changeCoin(world.id, name, 0)
            setAdding('')
          }}
        >
          <input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Add a currency, gem or resource (e.g. credits, rations)" aria-label="New coin or resource" />
          <button disabled={!adding.trim()}>Add</button>
        </form>
      )}
    </section>
  )
}
