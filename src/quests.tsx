import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckSquare, Eye, EyeSlash, Gift, X } from '@phosphor-icons/react'
import { db, newId, type Entity, type QuestObjective, type QuestReward } from './db'
import { Help } from './help'
import { Ico } from './icons'
import { PagePicker } from './PagePicker'
import { pagePath } from './paths'
import { coinKey, editPurse } from './purse'
import { useReview } from './reveal'
import { toast } from './undo'

/**
 * Quest objectives and rewards. Each step can be known to players or kept back until they find it
 * (a hidden goal, a twist), and so can each reward. Handing out a reward puts its coins in the
 * party's purse and its item in the party stash.
 */

async function changeQuest(id: string, fn: (q: Entity) => void) {
  await db.entities
    .where('id')
    .equals(id)
    .modify((q) => {
      fn(q)
      q.updatedAt = Date.now()
    })
}

/** Takes one objective or reward off a quest at once, with Undo (it goes back where it was). */
async function removeOne(quest: Entity, key: 'objectives' | 'rewards', id: string, text: string) {
  const at = (quest[key] ?? []).findIndex((x) => x.id === id)
  const was = (quest[key] ?? [])[at]
  if (!was) return
  // Puts `item` back into `list` where it was, unless it's already there again.
  const putBack = <T extends { id: string }>(list: T[] | undefined, item: T) => {
    const now = [...(list ?? [])]
    if (!now.some((x) => x.id === id)) now.splice(Math.min(at, now.length), 0, item)
    return now
  }
  await changeQuest(quest.id, (q) => {
    if (key === 'objectives') q.objectives = q.objectives?.filter((x) => x.id !== id)
    else q.rewards = q.rewards?.filter((x) => x.id !== id)
  })
  toast(text, () =>
    changeQuest(quest.id, (q) => {
      if (key === 'objectives') q.objectives = putBack(q.objectives, was as QuestObjective)
      else q.rewards = putBack(q.rewards, was as QuestReward)
    }),
  )
}

/** "2 of 4 done", from the steps this viewer has. */
export function questProgress(q: Entity) {
  const list = q.objectives ?? []
  if (!list.length) return ''
  return `${list.filter((o) => o.done).length} of ${list.length} done`
}

/** Reads "50 gp" or "100 gp, 20 sp" out of a reward's text, for the purse. */
export function coinsIn(text: string) {
  return [...text.matchAll(/(\d[\d,]*)\s*(pp|gp|ep|sp|cp|gold|silver|copper)\b/gi)].map((m) => ({
    amount: Number(m[1].replace(/,/g, '')),
    name: ({ gold: 'gp', silver: 'sp', copper: 'cp' } as Record<string, string>)[m[2].toLowerCase()] ?? m[2].toLowerCase(),
  }))
}

export function QuestBox({ quest, entities, isGM, worldId }: { quest: Entity; entities: Entity[]; isGM: boolean; worldId: string }) {
  const objectives = quest.objectives ?? []
  const rewards = quest.rewards ?? []
  if (!isGM && !objectives.length && !rewards.length) return null
  return (
    <section className="quest-box">
      <Objectives quest={quest} list={objectives} isGM={isGM} />
      <Rewards quest={quest} list={rewards} isGM={isGM} entities={entities} worldId={worldId} />
    </section>
  )
}

function KnownToggle({ known, onChange }: { known?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className={`ghost small known-toggle ${known ? 'on' : ''}`}
      title={known ? 'Players know this. Click to hide it from them' : 'Only you know this. Click to tell the players'}
      aria-label={known ? 'Players know this' : 'GM only'}
      onClick={() => onChange(!known)}
    >
      <Ico as={known ? Eye : EyeSlash} />
    </button>
  )
}

function Objectives({ quest, list, isGM }: { quest: Entity; list: QuestObjective[]; isGM: boolean }) {
  const [text, setText] = useState('')
  const [hidden, setHidden] = useState(false)
  const change = (id: string, fn: (o: QuestObjective) => void) =>
    changeQuest(quest.id, (q) => {
      const o = q.objectives?.find((x) => x.id === id)
      if (o) fn(o)
    })
  if (!isGM && !list.length) return null
  return (
    <div className="quest-objectives">
      <h2>
        <Ico as={CheckSquare} /> Objectives {list.length > 0 && <span className="muted small">{questProgress(quest)}</span>} <Help topic="objectives" />
      </h2>
      <ul className="objective-list">
        {list.map((o) => (
          <li key={o.id} className={`${o.done ? 'done' : ''} ${o.known ? '' : 'gm-only'}`}>
            <label className="row">
              <input type="checkbox" checked={o.done} disabled={!isGM} onChange={(e) => change(o.id, (x) => void (x.done = e.target.checked))} />
              <span>{o.text}</span>
            </label>
            {isGM && (
              <span className="row">
                <KnownToggle known={o.known} onChange={(v) => change(o.id, (x) => void (x.known = v || undefined))} />
                <button className="ghost small" aria-label="Remove" title="Remove" onClick={() => removeOne(quest, 'objectives', o.id, `Objective “${o.text}” removed.`)}>
                  <Ico as={X} />
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {isGM && (
        <form
          className="row wrap"
          onSubmit={(e) => {
            e.preventDefault()
            if (!text.trim()) return
            void changeQuest(quest.id, (q) => void (q.objectives = [...(q.objectives ?? []), { id: newId(), text: text.trim(), done: false, ...(hidden ? {} : { known: true }) }]))
            setText('')
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="A step, e.g. Find the missing caravan" aria-label="New objective" />
          <label className="row small" title="A hidden step stays GM-only until you click its eye">
            <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> Hidden
          </label>
          <button disabled={!text.trim()}>Add</button>
        </form>
      )}
    </div>
  )
}

function Rewards({ quest, list, isGM, entities, worldId }: { quest: Entity; list: QuestReward[]; isGM: boolean; entities: Entity[]; worldId: string }) {
  const [text, setText] = useState('')
  const [itemId, setItemId] = useState('')
  const change = (id: string, fn: (r: QuestReward) => void) =>
    changeQuest(quest.id, (q) => {
      const r = q.rewards?.find((x) => x.id === id)
      if (r) fn(r)
    })
  const { ask, dialog } = useReview()
  const give = async (r: QuestReward) => {
    const coins = r.coins ?? coinsIn(r.text)
    const item = r.itemId ? entities.find((e) => e.id === r.itemId) : undefined
    const ok = await ask({
      title: 'Give this to the party?',
      see: [
        `The reward: “${r.text || item?.name || 'reward'}”`,
        ...(coins.length ? [`${coins.map((c) => `${c.amount} ${c.name}`).join(', ')} added to the party’s purse`] : []),
        ...(item ? [`“${item.name}” in the party stash${item.visibility === 'gm' ? ', and its page (revealed now: not its GM notes or secret passages)' : ''}`] : []),
      ],
      confirm: 'Give to the party',
    })
    if (!ok) return
    const itemWas = item ? { heldBy: item.heldBy, visibility: item.visibility, updatedAt: item.updatedAt } : undefined
    const rewardWas = { given: r.given, known: r.known }
    if (coins.length)
      await editPurse(worldId, (purse) => {
        for (const c of coins) {
          const have = purse.find((p) => coinKey(p.name) === coinKey(c.name))
          if (have) have.amount += c.amount
          else purse.push({ ...c })
        }
        return purse
      })
    if (r.itemId) await db.entities.update(r.itemId, { heldBy: 'party', visibility: 'players', updatedAt: Date.now() })
    await change(r.id, (x) => {
      x.given = true
      x.known = true
    })
    toast('Given to the party.', async () => {
      if (coins.length)
        await editPurse(worldId, (purse) => {
          for (const c of coins) {
            const have = purse.find((p) => coinKey(p.name) === coinKey(c.name))
            if (have) have.amount = Math.max(0, have.amount - c.amount)
          }
          return purse
        })
      if (r.itemId && itemWas) await db.entities.update(r.itemId, itemWas)
      await change(r.id, (x) => {
        x.given = rewardWas.given
        x.known = rewardWas.known
      })
    })
  }
  const items = entities.filter((e) => e.type === 'item')
  if (!isGM && !list.length) return null
  return (
    <div className="quest-rewards">
      {dialog}
      <h2>
        <Ico as={Gift} /> Rewards <Help topic="rewards" />
      </h2>
      <ul className="objective-list">
        {list.map((r) => {
          const item = r.itemId ? entities.find((e) => e.id === r.itemId) : undefined
          return (
            <li key={r.id} className={`${r.given ? 'done' : ''} ${r.known ? '' : 'gm-only'}`}>
              <span>
                {r.text}
                {item && (
                  <>
                    {' '}
                    <Link to={pagePath(worldId, item.id)}>{item.name}</Link>
                  </>
                )}
                {r.given && <span className="muted small"> · given</span>}
              </span>
              {isGM && (
                <span className="row">
                  {!r.given && (
                    <button className="ghost small" title="Coins go into the party’s purse, the item into the party stash" onClick={() => give(r)}>
                      Give to the party
                    </button>
                  )}
                  <KnownToggle known={r.known} onChange={(v) => change(r.id, (x) => void (x.known = v || undefined))} />
                  <button className="ghost small" aria-label="Remove" title="Remove" onClick={() => removeOne(quest, 'rewards', r.id, `Reward “${r.text || item?.name || 'reward'}” removed.`)}>
                    <Ico as={X} />
                  </button>
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {isGM && (
        <form
          className="row wrap"
          onSubmit={(e) => {
            e.preventDefault()
            if (!text.trim() && !itemId) return
            void changeQuest(quest.id, (q) => void (q.rewards = [...(q.rewards ?? []), { id: newId(), text: text.trim(), ...(itemId ? { itemId } : {}) }]))
            setText('')
            setItemId('')
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. 200 gp and the mayor’s favour" aria-label="New reward" />
          {items.length > 0 && (
            <PagePicker
              entities={items}
              value={itemId}
              onPick={setItemId}
              placeholder="+ an item (optional)"
            />
          )}
          <button disabled={!text.trim() && !itemId}>Add</button>
        </form>
      )}
      {isGM && list.length > 0 && <p className="muted small">New rewards start hidden from players. Coins written like “200 gp” go into the party’s purse when you give it.</p>}
    </div>
  )
}
