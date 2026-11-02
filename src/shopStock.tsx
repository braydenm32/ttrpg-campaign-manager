import { Link } from 'react-router-dom'
import { Storefront } from '@phosphor-icons/react'
import { DraftText } from './components'
import { db, newId, saveEntity, type Entity, type World } from './db'
import { Help } from './help'
import { Ico } from './icons'
import { pagePath } from './paths'
import { changeCoin, coinKey, tidyPurse } from './purse'
import { toast } from './undo'

/**
 * Stock: the items a shop (or any page that isn't a character) holds, with their prices, on the
 * holder's page. An item's price is an ordinary detail called "Price" (or "Value" when it has no
 * price), so players see it once the item is revealed, like any other detail. The GM's "Sold to the
 * party" moves one into the party stash and takes the price from the purse, with Undo.
 */

/** An item's price as written ("25 gp", "3 silver"), from its Price detail, or its Value. */
export function priceOf(item: Entity, showGm = true) {
  const f = item.fields.find((x) => /^price$/i.test(x.key.trim()) && (showGm || !x.gm)) ?? item.fields.find((x) => /^value$/i.test(x.key.trim()) && (showGm || !x.gm))
  return f?.value.trim() ?? ''
}

/** "25 gp" → 25 of gp; "1,200 gold" → 1200 of gold. A price with no coin named is in gp. Unreadable prices give nothing. */
export function readPrice(text: string): { amount: number; coin: string } | undefined {
  const m = text.match(/(\d[\d,]*(?:\.\d+)?)\s*([a-zA-Z][a-zA-Z ]*)?/)
  if (!m) return
  const amount = Number(m[1].replace(/,/g, ''))
  if (!amount || !Number.isFinite(amount)) return
  const coin = (m[2] ?? 'gp').trim().replace(/\s+(each|apiece)$/i, '') || 'gp'
  return { amount, coin }
}

/** Sets an item's Price detail (adding it, or removing it when blank). */
const withPrice = (item: Entity, price: string): Entity => {
  const others = item.fields.filter((f) => !/^price$/i.test(f.key.trim()))
  const was = item.fields.find((f) => /^price$/i.test(f.key.trim()))
  return { ...item, fields: price.trim() ? [...others, { ...(was ?? {}), key: was?.key ?? 'Price', value: price.trim() }] : others, updatedAt: Date.now() }
}

/** One of the item goes to the party stash and its price comes out of the purse; Undo puts both back. */
async function sellToParty(item: Entity, world: World) {
  const price = readPrice(priceOf(item))
  if (price) {
    const have = tidyPurse(world.partyCoin).find((c) => coinKey(c.name) === coinKey(price.coin))?.amount ?? 0
    if (have < price.amount && !confirm(`The party’s purse has ${have} ${price.coin}, and “${item.name}” costs ${price.amount} ${price.coin}. Sell it anyway (the purse goes below zero)?`)) return
  }
  const many = (item.quantity ?? 1) > 1
  const sold: Entity = many
    ? { ...structuredClone(item), id: newId(), quantity: undefined, heldBy: 'party', visibility: 'players', createdAt: Date.now(), updatedAt: Date.now() }
    : { ...item, heldBy: 'party', visibility: 'players', updatedAt: Date.now() }
  if (many) {
    await db.entities.add(sold)
    await saveEntity({ ...item, quantity: (item.quantity ?? 1) - 1 === 1 ? undefined : (item.quantity ?? 1) - 1, updatedAt: Date.now() })
  } else await saveEntity(sold)
  if (price) await changeCoin(world.id, price.coin, -price.amount)
  const revealed = item.visibility !== 'players'
  toast(
    `“${item.name}” sold to the party${price ? ` for ${price.amount} ${price.coin}` : ' (no price to take from the purse)'}${revealed ? '; players can see it now' : ''}.`,
    async () => {
      if (many) {
        await db.entities.delete(sold.id)
        const now = await db.entities.get(item.id)
        if (now) await saveEntity({ ...now, quantity: (now.quantity ?? 1) + 1, updatedAt: Date.now() })
      } else {
        const now = await db.entities.get(item.id)
        if (now) await saveEntity({ ...now, heldBy: item.heldBy, visibility: item.visibility, updatedAt: Date.now() })
      }
      if (price) await changeCoin(world.id, price.coin, price.amount)
    },
  )
}

/** The Stock table on a shop's (or any other holder's) page. Shown only when something is held there. */
export function StockTable({ holder, entities, world, isGM }: { holder: Entity; entities: Entity[]; world: World | null | undefined; isGM: boolean }) {
  const items = entities.filter((x) => x.type === 'item' && x.heldBy === holder.id && !x.template).sort((a, b) => a.name.localeCompare(b.name))
  if (!items.length) return null
  const purse = tidyPurse(world?.partyCoin).filter((c) => c.amount)
  return (
    <section className="stock" id="page-stock">
      <h2>
        <Ico as={Storefront} /> {holder.type === 'shop' ? 'Stock' : 'Kept here'} <Help topic="stock" />
      </h2>
      {isGM && purse.length > 0 && <p className="muted small">The party’s purse: {purse.map((c) => `${c.amount} ${c.name}`).join(', ')}</p>}
      <div className="table-scroll">
        <table className="stock-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>How many</th>
              <th>Price</th>
              {isGM && <th aria-label="Sell" />}
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>
                  <Link to={pagePath(i.worldId, i.id)}>{i.name}</Link>
                  {isGM && i.visibility !== 'players' && <span className="muted small"> (GM only)</span>}
                  {i.summary && <div className="muted small">{i.summary}</div>}
                </td>
                <td>{i.quantity ?? 1}</td>
                <td>{isGM ? <DraftText value={priceOf(i)} placeholder="e.g. 25 gp" aria-label={`Price of ${i.name}`} saveOn="leave" onCommit={(v) => saveEntity(withPrice(i, v))} /> : priceOf(i, false) || '—'}</td>
                {isGM && (
                  <td>
                    {world && (
                      <button className="small" onClick={() => sellToParty(i, world)} title="Into the party stash, and the price out of the purse">
                        Sold to the party
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
