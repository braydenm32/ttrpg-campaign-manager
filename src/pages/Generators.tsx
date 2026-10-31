import { Help } from '../help'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../db'
import { Empty } from '../components'
import { useViewMode } from '../viewMode'
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
import { GeneratorFlavour, keepSecretsSecret } from '../ai/Flavour'
import { useKept } from '../ai/kept'
import { Markdown } from '../Markdown'
import { TablesPanel } from '../tables'
import { Ico } from '../icons'
import { Coins, DiceFive, IdentificationCard } from '@phosphor-icons/react'
import { NameGenerator, StarterTables, TreasureGenerator } from '../moreGenerators'
import { pagePath, typePath } from '../paths'

type Kind = 'tavern' | 'shop' | 'npc'

export default function Generators() {
  const { worldId, world } = useWorld()
  const navigate = useNavigate()
  const entities = useVisibleEntities(worldId)
  const { isGM } = useViewMode()
  // What's rolled stays while you look at other pages, so Claude's flavour still has its tavern when you come back.
  const kept = `generators:${worldId}`
  const [kind, setKind] = useKept<Kind>(`${kept}:kind`, 'tavern')
  const [shopKind, setShopKind] = useKept<ShopKind>(`${kept}:shopKind`, 'blacksmith')
  const [place, setPlace] = useKept<GeneratedPlace>(`${kept}:place`, () => generateTavern())
  const [npc, setNpc] = useKept<GeneratedNpc>(`${kept}:npc`, () => generateNpc())
  const [parentId, setParentId] = useKept(`${kept}:parent`, '')
  const [flavour, setFlavour] = useKept(`${kept}:flavour`, '')

  const reroll = (k = kind, sk = shopKind) => {
    setFlavour('')
    if (k === 'tavern') setPlace(generateTavern())
    else if (k === 'shop') setPlace(generateShop(sk))
    else setNpc(generateNpc())
  }

  const save = async () => {
    const created = kind === 'npc' ? [npcToEntity(worldId, npc, parentId || undefined)] : placeToEntities(worldId, place, parentId || undefined)
    if (flavour) created[0].body = `${created[0].body.trim()}\n\n${keepSecretsSecret(flavour)}`
    await db.entities.bulkAdd(created)
    reroll()
    navigate(`${pagePath(worldId, created[0].id)}`)
  }

  const rolled =
    kind === 'npc'
      ? `## ${npc.name}\n\n${npcMarkdown(npc)}\n\n> ${npcGreeting(npc)}`
      : `## ${place.name}\n\n${place.body}\n\n> **${place.keeper.name}:** ${npcGreeting(place.keeper)}`
  const preview = flavour ? `${rolled}\n\n${keepSecretsSecret(flavour)}` : rolled

  if (!isGM) return <Empty>Only the GM can see this.</Empty>
  return (
    <div className="page">
      <header className="page-header">
        <h1>
          <Ico as={DiceFive} /> Generators &amp; tables <Help topic="generators" />
        </h1>
        <Link className="button" to={`${typePath(worldId, 'table')}`}>
          <Ico as={DiceFive} /> Edit your random tables <Help topic="randomTables" />
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
        <button onClick={() => reroll()}><Ico as={DiceFive} /> Reroll</button>
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
      {world && !flavour && <GeneratorFlavour world={world} entities={entities} preview={rolled} parentId={parentId || undefined} onUse={setFlavour} />}
      {world && (
        <div className="home-grid">
          <section className="card">
            <h2>
              <Ico as={IdentificationCard} /> Names
            </h2>
            <NameGenerator world={world} entities={entities} />
          </section>
          <section className="card">
            <h2>
              <Ico as={Coins} /> Treasure
            </h2>
            <TreasureGenerator world={world} />
          </section>
        </div>
      )}
      <TablesPanel tables={entities.filter((e) => e.type === 'table')} worldId={worldId} entities={entities} />
      {world && <StarterTables world={world} tables={entities.filter((e) => e.type === 'table')} />}
    </div>
  )
}
