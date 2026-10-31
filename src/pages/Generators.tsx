import { Help } from '../help'
import '../more.css'
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
import { TableRoller } from '../tables'
import { Ico } from '../icons'
import { Coins, DiceFive, IdentificationCard, Table } from '@phosphor-icons/react'
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

  if (!isGM) return <Empty>Generators are a GM tool. Switch back to the GM view to use them.</Empty>
  const tables = entities.filter((e) => e.type === 'table')
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>
            <Ico as={DiceFive} /> Generators &amp; tables <Help topic="generators" />
          </h1>
          <p className="lead">Your own tables first, then a place, a person, names or treasure on the spot.</p>
        </div>
      </header>

      <section className="gen-section">
        <h2>
          <Ico as={Table} /> Your tables <Help topic="randomTables" />
          <Link className="small" to={typePath(worldId, 'table')}>
            {tables.length ? `All ${tables.length}, to edit` : 'Make a table'}
          </Link>
        </h2>
        {tables.length ? (
          <TableRoller tables={tables} worldId={worldId} entities={entities} showSecrets />
        ) : (
          <Empty>No tables of your own yet. Make one, like “What’s in the sewer?” or “Tavern rumours”, or start from the ready-made ones below.</Empty>
        )}
        {world && <StarterTables world={world} tables={tables} />}
      </section>

      <section className="gen-section">
        <h2>Roll something new</h2>
        <p className="muted small">A tavern, a shop or a person, ready to drop into the game. Saving makes a page in your world, GM only until you reveal it.</p>
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
              aria-label="Kind of shop"
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
          <button onClick={() => reroll()}>
            <Ico as={DiceFive} /> Reroll
          </button>
        </div>
        <div className="card generated">
          <Markdown text={preview} entities={entities} worldId={worldId} showSecrets />
        </div>
        <div className="row wrap">
          <select value={parentId} onChange={(e) => setParentId(e.target.value)} aria-label="Place it in">
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
            Save to world (GM only)
          </button>
        </div>
        {world && !flavour && <GeneratorFlavour world={world} entities={entities} preview={rolled} parentId={parentId || undefined} onUse={setFlavour} />}
      </section>

      {world && (
        <div className="home-grid gen-section">
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
    </div>
  )
}
