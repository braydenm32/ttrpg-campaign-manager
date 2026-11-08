import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowSquareOut, BookOpenText, MagnifyingGlass } from '@phosphor-icons/react'
import { blankEntity, db, ENTITY_LABELS, PICKER_TYPES, saveEntity, type Entity, type EntityType } from '../db'
import { Empty, Skeleton } from '../components'
import { Help } from '../help'
import { useVisibleEntities, useWorld } from '../hooks'
import { Ico } from '../icons'
import { useKept } from '../ai/kept'
import { Markdown } from '../Markdown'
import { pagePath } from '../paths'
import { toast } from '../undo'
import { useViewMode } from '../viewMode'
import { LookupError, pageBody, read, search, type Found, type Hit } from '../lookup/fetch'
import { LOOKUP_SYSTEMS, sourcesFor } from '../lookup/sources'
import '../more.css'

/**
 * Look it up: search the open rules (the D&D SRDs, the Daggerheart SRD that comes with the app) and the
 * fan wikis for the world's game, read what comes back, and (the GM) keep it as a page with a line
 * saying where it came from. Players can search and read too, but nothing they find is saved. Games
 * whose rules aren't free to copy get links that open the right site instead.
 */
export default function Lookup() {
  const { worldId, world } = useWorld()
  const { isGM } = useViewMode()
  const entities = useVisibleEntities(worldId)
  const kept = `lookup:${worldId}`
  const startSystem = world && LOOKUP_SYSTEMS.includes(world.system) ? world.system : 'D&D 5e (2024)'
  const [system, setSystem] = useKept(`${kept}:system`, '')
  const game = system || startSystem
  const sources = sourcesFor(game)
  const askable = sources.filter((s) => s.kind !== 'web')
  const links = sources.filter((s) => s.kind === 'web')
  const [sourceId, setSourceId] = useKept(`${kept}:source`, '')
  const source = askable.find((s) => s.id === sourceId) ?? askable[0]
  const [words, setWords] = useKept(`${kept}:words`, '')
  const [hits, setHits] = useState<Hit[]>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<Hit>()

  /** A different game or source starts a fresh list. */
  const fresh = () => {
    setHits(undefined)
    setOpen(undefined)
    setError('')
  }

  if (!world) return <Skeleton />

  const go = async () => {
    const w = words.trim()
    if (!w || !source) return
    setBusy(true)
    setError('')
    setOpen(undefined)
    try {
      setHits(await search(source, w))
    } catch (e) {
      setHits(undefined)
      setError(unreachable(source.name, e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page more-screen lookup">
      <header className="page-header">
        <div>
          <h1>
            <Ico as={BookOpenText} /> Look it up <Help topic="lookup" />
          </h1>
          <p className="lead">
            {isGM ? 'Search the rules and the wikis for your game, and keep what you find as a page.' : 'Search the rules and the wikis for your game.'}
          </p>
        </div>
      </header>

      <div className="form lookup-search">
        <div className="row wrap">
          <label>
            Game
            <select value={game} onChange={(e) => (setSystem(e.target.value), setSourceId(''), fresh())}>
              {LOOKUP_SYSTEMS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          {askable.length > 1 && (
            <div className="segmented" role="group" aria-label="Where to look">
              {askable.map((s) => (
                <button key={s.id} className={s.id === source?.id ? 'on' : ''} onClick={() => (setSourceId(s.id), fresh())} title={s.blurb}>
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {source && <p className="muted small">{source.blurb}</p>}
        <form
          className="row"
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            go()
          }}
        >
          <input
            type="search"
            value={words}
            onChange={(e) => setWords(e.target.value)}
            placeholder={
              !source
                ? 'What are you looking for?'
                : source.kind === 'open5e'
                  ? 'A spell, monster, item or rule: “fireball”, “goblin”'
                  : source.kind === 'bundled'
                    ? 'An adversary, card, weapon or rule: “acid burrower”, “stress”'
                    : 'A place, person, god or anything else'
            }
            aria-label="Look up"
            disabled={!source}
          />
          <button className="primary" disabled={!source || !words.trim() || busy}>
            <Ico as={MagnifyingGlass} /> Search
          </button>
        </form>
        {links.length > 0 && (
          <p className="small lookup-links">
            {source ? 'Also look on: ' : 'This game’s rules aren’t free to copy into the app, so these open in a new tab: '}
            {links.map((s, i) => (
              <span key={s.id}>
                {i > 0 && ' · '}
                <a href={words.trim() ? s.search!(words.trim()) : s.site} target="_blank" rel="noreferrer" title={s.blurb}>
                  {s.name} <Ico as={ArrowSquareOut} />
                </a>
              </span>
            ))}
          </p>
        )}
      </div>

      {busy && <p className="muted">Searching {source?.name}…</p>}
      {error && <p className="error">{error}</p>}
      {hits && !busy && !open && (
        <section>
          {hits.length ? (
            <ul className="recent-list lookup-hits" aria-label="Results">
              {hits.map((h, i) => (
                <li key={`${h.title}:${i}`}>
                  <button className="link" onClick={() => setOpen(h)}>
                    {h.title}
                  </button>
                  <span className="muted small">
                    {h.kind}
                    {h.snippet && ` · ${h.snippet}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>
              Nothing on {source?.name} matches “{words.trim()}”. Try fewer words, or another spelling.
            </Empty>
          )}
        </section>
      )}
      {open && (
        <Result key={`${open.source.id}:${open.title}`} hit={open} worldId={worldId} entities={entities} isGM={isGM} onBack={() => setOpen(undefined)} />
      )}
    </div>
  )
}

function unreachable(name: string, e: unknown) {
  if (e instanceof LookupError && e.message === 'missing') return `${name} doesn’t have that any more. Try searching again.`
  return `Couldn’t reach ${name}. Check you’re online and try again; if it keeps happening the site may be down for a while.`
}

/** One result, read in full: a preview, and where it goes. */
function Result({ hit, worldId, entities, isGM, onBack }: { hit: Hit; worldId: string; entities: Entity[]; isGM: boolean; onBack: () => void }) {
  const navigate = useNavigate()
  const { world } = useWorld()
  const [whole, setWhole] = useState(false)
  const [got, setGot] = useState<{
    whole: boolean
    found?: Found
    error?: string
  }>()
  const current = got?.whole === whole ? got : undefined
  const found = current?.found
  const [error, setError] = useState('')
  const [type, setType] = useState<string>()
  const [into, setInto] = useState<string>()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let live = true
    read(hit, whole).then(
      (f) => live && setGot({ whole, found: f }),
      (e) => live && setGot({ whole, error: unreachable(hit.source.name, e) }),
    )
    return () => {
      live = false
    }
  }, [hit, whole])

  const same = found ? entities.find((e) => !e.template && e.name.trim().toLowerCase() === found.title.trim().toLowerCase()) : undefined
  const target = into ?? same?.id ?? ''
  const pickedType = type ?? found?.type ?? 'lore'

  const save = async () => {
    if (!found) return
    setSaving(true)
    try {
      const existing = target ? await db.entities.get(target) : undefined
      if (existing) {
        // Added below what's already written; nothing of the GM's own is changed.
        const have = new Set(existing.fields.map((f) => f.key.toLowerCase()))
        await saveEntity({
          ...existing,
          body: `${existing.body.trim()}\n\n## From the ${hit.source.name}\n\n${pageBody(found)}`.trim(),
          summary: existing.summary || found.summary,
          fields: [...existing.fields, ...found.fields.filter((f) => !have.has(f.key.toLowerCase()))],
          updatedAt: Date.now(),
        })
        toast(`Added to ${existing.name}.`)
        navigate(pagePath(worldId, existing.id))
      } else {
        const [t, custom] = pickedType.startsWith('custom:') ? (['custom', pickedType.slice(7)] as const) : ([pickedType as EntityType, undefined] as const)
        const page = blankEntity(worldId, t, found.title)
        if (custom) page.customType = custom
        page.summary = found.summary
        page.body = pageBody(found)
        page.fields = found.fields
        await db.entities.add(page)
        toast(`Made ${found.title} (GM only until you reveal it).`)
        navigate(pagePath(worldId, page.id))
      }
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <section className="lookup-result">
      <div className="row wrap">
        <button type="button" onClick={onBack}>
          ← Back to the results
        </button>
        <span className="grow" />
        {found && hit.source.kind !== 'bundled' && (
          <a className="button" href={found.url} target="_blank" rel="noreferrer">
            Open on {hit.source.kind === 'open5e' ? 'Open5e' : 'the wiki'} <Ico as={ArrowSquareOut} />
          </a>
        )}
      </div>
      <h2>{found?.title ?? hit.title}</h2>
      {current?.error && <p className="error">{current.error}</p>}
      {!current && <p className="muted">Reading it…</p>}
      {found && (
        <>
          {found.fields.length > 0 && (
            <dl className="sheet-fields">
              {found.fields.map((f) => (
                <div key={f.key}>
                  <dt>{f.key}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="lookup-preview">
            <Markdown text={pageBody(found)} entities={entities} worldId={worldId} showSecrets={isGM} />
          </div>
          {hit.source.kind === 'wiki' && (
            <label className="small">
              <input type="checkbox" checked={whole} onChange={(e) => setWhole(e.target.checked)} /> The whole article (not just the opening)
            </label>
          )}
          {isGM && (
            <div className="form lookup-keep">
              <label>
                Keep it as
                <select value={target} onChange={(e) => setInto(e.target.value)}>
                  <option value="">A new page (🔒 GM only until you reveal it)</option>
                  {same && <option value={same.id}>Added to your page {same.name}</option>}
                </select>
              </label>
              {!target && (
                <label>
                  Type
                  <select value={pickedType} onChange={(e) => setType(e.target.value)}>
                    {PICKER_TYPES.filter((t) => t !== 'pc' && t !== 'thread' && t !== 'table').map((t) => (
                      <option key={t} value={t}>
                        {ENTITY_LABELS[t].icon} {ENTITY_LABELS[t].one}
                      </option>
                    ))}
                    {(world?.customTypes ?? []).map((c) => (
                      <option key={c.id} value={`custom:${c.id}`}>
                        {c.icon} {c.one}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="muted small">The line saying where it came from stays at the bottom: the licence asks for it if you share the page.</p>
              {error && <p className="error small">{error}</p>}
              <div className="row end">
                <button className="primary" disabled={saving} onClick={save}>
                  {target ? 'Add it to the page' : 'Make the page'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
