import { db, type World } from './db'

type Coin = { name: string; amount: number }

/** Names that mean the same coin: "Silver" and "sp" are one line in the purse, not two. */
const SAME_COIN: Record<string, string> = {
  platinum: 'pp',
  'platinum pieces': 'pp',
  gold: 'gp',
  'gold pieces': 'gp',
  electrum: 'ep',
  'electrum pieces': 'ep',
  silver: 'sp',
  'silver pieces': 'sp',
  copper: 'cp',
  'copper pieces': 'cp',
}

/** Which coin a name is, ignoring case and the long spellings. */
export const coinKey = (name: string) => {
  const n = name.trim().toLowerCase()
  return SAME_COIN[n] ?? n
}

/**
 * The purse with one line per coin: lines that name the same coin are added together, under the
 * name with the most in it (so "sp 152" and "Silver 0" become "sp 152"). The order is kept.
 */
export function tidyPurse(purse: readonly Coin[] | undefined): Coin[] {
  const out: Coin[] = []
  const best = new Map<string, number>()
  for (const c of purse ?? []) {
    const key = coinKey(c.name)
    const have = out.find((x) => coinKey(x.name) === key)
    if (!have) {
      out.push({ ...c })
      best.set(key, c.amount)
      continue
    }
    if (Math.abs(c.amount) > Math.abs(best.get(key) ?? 0)) {
      have.name = c.name
      best.set(key, c.amount)
    }
    have.amount += c.amount
  }
  return out
}

/** Changes the party's purse in one go, starting from what's saved, so quick taps never overwrite each other. */
export const editPurse = (worldId: string, fn: (purse: Coin[]) => Coin[]) =>
  db.worlds
    .where('id')
    .equals(worldId)
    .modify((w: World) => {
      w.partyCoin = fn(tidyPurse(w.partyCoin))
      w.updatedAt = Date.now()
    })

/** Adds (or, below zero, takes out) coins, making the line if the purse doesn't have that coin yet. */
export const changeCoin = (worldId: string, name: string, delta: number) =>
  editPurse(worldId, (purse) => {
    const have = purse.find((c) => coinKey(c.name) === coinKey(name))
    if (have) have.amount += delta
    else purse.push({ name: name.trim(), amount: delta })
    return purse
  })
