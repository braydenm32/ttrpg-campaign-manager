import { useState } from 'react'
import { Help } from '../help'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../db'
import {
  generateNpc,
  generateShop,
  generateTavern,
  npcGreeting,
  npcMarkdown,
  npcToEntity,
  placeToEntities,
  SHOP_KIND_NAMES,
  type GeneratedNpc,
  type GeneratedPlace,
  type ShopKind,
} from '../generators'
import { useVisibleEntities, useWorld } from '../hooks'
import { Markdown } from '../Markdown'
import { TablesPanel } from '../tables'

type Kind = 'tavern' | 'shop' | 'npc'

export default function Generators() {
  const { worldId } = useWorld()
  const navigate = useNavigate()
  const entities = useVisibleEntities(worldId)
  const [kind, setKind] = useState<Kind>('tavern')
  const [shopKind, setShopKind] = useState<ShopKind>('blacksmith')
  const [place, setPlace] = useState<GeneratedPlace>(() => generateTavern())
  const [npc, setNpc] = useState<GeneratedNpc>(() => generateNpc())
  const [parentId, setParentId] = useState('')

  const reroll = (k = kind, sk = shopKind) => {
    if (k === 'tavern') setPlace(generateTavern())
    else if (k === 'shop') setPlace(generateShop(sk))
    else setNpc(generateNpc())
  }

  const save = async () => {
    const created = kind === 'npc' ? [npcToEntity(worldId, npc, parentId || undefined)] : placeToEntities(worldId, place, parentId || undefined)
    await db.entities.bulkAdd(created)
    navigate(`/w/${worldId}/e/${created[0].id}`)
  }

  const preview =
    kind === 'npc'
      ? `## ${npc.name}\n\n${npcMarkdown(npc)}\n\n> ${npcGreeting(npc)}`
      : `## ${place.name}\n\n${place.body}\n\n> **${place.keeper.name}:** ${npcGreeting(place.keeper)}`

  return (
    <div className="page">
      <header className="page-header">
        <h1>
          🎰 Generators &amp; tables <Help topic="generators" />
        </h1>
        <Link className="button" to={`/w/${worldId}/type/table`}>
          🎲 Edit your random tables <Help topic="randomTables" />
        </Link>
      </header>
      <p className="muted">Roll up a place or person on the fly, then save it into your world. Saved results start as GM only.</p>
      <div className="row wrap">
        <div className="segmented">
          {(['tavern', 'shop', 'npc'] as const).map((k) => (
            <button
              key={k}
              className={kind === k ? 'on' : ''}
              onClick={() => {
                setKind(k)
                reroll(k)
              }}
            >
              {k === 'tavern' ? '🍺 Tavern' : k === 'shop' ? '⚒️ Shop' : '🧙 NPC'}
            </button>
          ))}
        </div>
        {kind === 'shop' && (
          <select
            value={shopKind}
            onChange={(e) => {
              const sk = e.target.value as ShopKind
              setShopKind(sk)
              reroll('shop', sk)
            }}
          >
            {SHOP_KIND_NAMES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        )}
        <button onClick={() => reroll()}>🎲 Reroll</button>
      </div>
      <div className="card generated">
        <Markdown text={preview} entities={entities} worldId={worldId} showSecrets />
      </div>
      <div className="row wrap">
        <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">Place it in… (optional)</option>
          {entities
            .filter((e) => e.type === 'location')
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
        </select>
        <button className="primary" onClick={save}>
          Save to world
        </button>
      </div>
      <TablesPanel tables={entities.filter((e) => e.type === 'table')} worldId={worldId} entities={entities} />
    </div>
  )
}
