import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Help, HelpTipsToggle } from '../help'
import { ThemePicker } from '../theme'
import { RecentlyDeleted } from '../History'
import { AiSettingsSection } from '../ai/AiSettingsSection'
import { BackupButton } from '../BackupReminder'
import { deleteCloudCopy } from '../cloud/sync'
import { myRole } from '../cloud/players'
import { db, deleteWorld, GAME_SYSTEMS, newId, typeLabel, WORLD_COLORS, worldColor, type Asset, type CustomType, type World } from '../db'
import { saveFileAsAsset, useBlobUrl, useTemplates, useWorld } from '../hooks'
import CloudSettings from './CloudSettings'
import { CalendarEditor } from '../calendar'
import { DiscordSettings } from '../discord'
import { ImportPages } from '../ImportPages'
import { Ico, PageIcon } from '../icons'
import { Ruler } from '@phosphor-icons/react'
import { pagePath, typePath, worldPath } from '../paths'
import { EXAMPLE_VERSION, resetExampleWorld } from '../example/load'
import { DraftText, Empty } from '../components'
import { useViewMode } from '../viewMode'

const TABS = [
  ['world', 'World'],
  ['players', 'Players and sharing'],
  ['device', 'This device'],
  ['data', 'Data and backup'],
] as const
type Tab = (typeof TABS)[number][0]

export default function WorldSettings() {
  const { worldId, world } = useWorld()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { isGM } = useViewMode()
  const tab: Tab = TABS.find(([t]) => t === params.get('tab'))?.[0] ?? 'world'
  if (!world) return null
  // A player's copy of someone else's world has no settings to change.
  if (world.shared) return <Navigate to={worldPath(worldId)} replace />
  // Previewing as a player: settings would show GM-only names, so switch back to change them.
  if (!isGM) return <Empty>Switch back to the GM view to change the world's settings.</Empty>
  const update = (patch: Partial<World>) => db.worlds.update(worldId, { ...patch, updatedAt: Date.now() })

  return (
    <div className="page">
      <header className="page-header">
        <h1>World settings</h1>
      </header>
      <div className="segmented tabs settings-tabs" role="tablist">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? 'on' : ''}
            onClick={() => setParams(t === 'world' ? {} : { tab: t }, { replace: true })}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'world' && (
        <>
          <div className="form">
            <label>
              Name
              <DraftText value={world.name} onCommit={(name) => update({ name })} />
            </label>
            <label>
              Default game system
              <select value={world.system} onChange={(e) => update({ system: e.target.value })}>
                {GAME_SYSTEMS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Description
              <DraftText multiline rows={4} value={world.description} onCommit={(description) => update({ description })} />
              <small className="muted">Players can read this. Keep secrets in GM notes or a :::gm block on a page.</small>
            </label>
          </div>

          <WorldLook world={world} update={update} />

          <CalendarEditor world={world} />

          <CustomTypes world={world} update={update} />

          <Templates world={world} />
        </>
      )}

      {tab === 'players' && <CloudSettings world={world} />}

      {tab === 'device' && (
        <>
          <p className="muted">These settings stay on this device: they aren’t synced or put in backups (except AI keys you choose to save to your account).</p>
          <ThemePicker /> <Help topic="theme" />
          <HelpTipsToggle />
          <DiscordSettings worldId={worldId} />
          <AiSettingsSection />
        </>
      )}

      {tab === 'data' && (
        <>
          <section>
            <h2>
              Backup <Help topic="backup" />
            </h2>
            <p className="muted">
              A backup is a single file with the whole world in it, including uploaded files. Keep one even if sync is on; you can import it from the
              home screen on any device.
            </p>
            <BackupButton worldId={worldId} />
          </section>

          <ImportPages worldId={worldId} />

          <RecentlyDeleted />

          {world.example && (
            <section>
              <h2>
                Example world <Help topic="exampleWorld" />
              </h2>
              <p className="muted">
                {world.example < EXAMPLE_VERSION
                  ? 'A newer version of the example world is available. Resetting gives you the new one.'
                  : 'Changed things while exploring? Reset puts the example world back the way it came.'}{' '}
                Your changes to it are lost, so make a backup first if you want to keep them.
              </p>
              <button
                onClick={async () => {
                  const cloud = world.cloud?.enabled ? ' Its cloud copy is deleted too, so players who joined it lose it.' : ''
                  if (!confirm(`Reset the example world? Everything you changed in it is lost.${cloud}`)) return
                  try {
                    navigate(worldPath(await resetExampleWorld(worldId)))
                  } catch (e) {
                    alert(`The example world couldn’t be reset (${(e as Error).message}). Your copy is unchanged.`)
                  }
                }}
              >
                Reset the example world
              </button>
            </section>
          )}

          <section>
            <h2>Danger zone</h2>
            <button
              className="danger"
              onClick={async () => {
                const inCloud = !!world.cloud?.enabled
                const warning = inCloud ? ' This also deletes the cloud copy, so your players, share link and other devices lose it too.' : ''
                if (prompt(`Type the world's name to delete it forever: ${world.name}.${warning}`) !== world.name) return
                // Only the owner can delete the cloud copy; a co-GM just removes it from this device.
                if (inCloud) {
                  const role = await myRole(worldId).catch(() => null)
                  if (role === 'owner') {
                    try {
                      await deleteCloudCopy(worldId)
                    } catch (e) {
                      if (!confirm(`Couldn't delete the cloud copy (${(e as Error).message}). Delete it from this device only?`)) return
                    }
                  } else if (!role && !confirm('You’re offline or signed out, so the cloud copy stays. Delete it from this device only?')) return
                }
                await deleteWorld(worldId)
                navigate('/')
              }}
            >
              Delete this world
            </button>
          </section>
        </>
      )}
    </div>
  )
}

function CustomTypes({ world, update }: { world: World; update: (patch: Partial<World>) => unknown }) {
  const types = world.customTypes ?? []
  const [draft, setDraft] = useState<Omit<CustomType, 'id'>>({ one: '', many: '', icon: '📄' })
  const counts =
    useLiveQuery(
      () =>
        db.entities
          .where({ worldId: world.id })
          .filter((e) => e.type === 'custom')
          .toArray(),
      [world.id],
    ) ?? []
  const set = (next: CustomType[]) => update({ customTypes: next })
  return (
    <section>
      <h2>
        🧩 Your own page types <Help topic="customTypes" />
      </h2>
      {types.length > 0 && (
        <ul className="custom-types">
          {types.map((c, i) => {
            const n = counts.filter((e) => e.customType === c.id).length
            const change = (patch: Partial<CustomType>) => set(types.map((x, j) => (j === i ? { ...x, ...patch } : x)))
            return (
              <li key={c.id} className="row">
                <DraftText className="icon-input" value={c.icon} onCommit={(icon) => change({ icon })} aria-label="Icon" />
                <DraftText value={c.one} onCommit={(one) => change({ one })} aria-label="Name for one" />
                <DraftText value={c.many} onCommit={(many) => change({ many })} aria-label="Name for several" />
                <Link className="small" to={`${typePath(world.id, 'custom', c.id)}`}>
                  {n} page{n === 1 ? '' : 's'}
                </Link>
                <button
                  className="ghost small"
                  title={n ? 'Move or delete its pages first' : 'Remove this type'}
                  disabled={n > 0}
                  onClick={() => set(types.filter((x) => x.id !== c.id))}
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <form
        className="row wrap"
        onSubmit={(e) => {
          e.preventDefault()
          const one = draft.one.trim()
          if (!one) return
          set([...types, { id: newId(), one, many: draft.many.trim() || `${one}s`, icon: draft.icon.trim() || '📄' }])
          setDraft({ one: '', many: '', icon: '📄' })
        }}
      >
        <input className="icon-input" value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} aria-label="Icon" />
        <input value={draft.one} onChange={(e) => setDraft({ ...draft, one: e.target.value })} placeholder="Name, e.g. Ship" />
        <input
          value={draft.many}
          onChange={(e) => setDraft({ ...draft, many: e.target.value })}
          placeholder={draft.one ? `${draft.one}s` : 'Plural, e.g. Ships'}
        />
        <button disabled={!draft.one.trim()}>+ Add type</button>
      </form>
    </section>
  )
}

function Templates({ world }: { world: World }) {
  const templates = useTemplates(world.id)
  return (
    <section>
      <h2>
        <Ico as={Ruler} /> Templates <Help topic="templates" />
      </h2>
      {templates.length === 0 ? (
        <p className="muted">No templates yet. Open any page, edit it, and choose “Save as template”.</p>
      ) : (
        <ul className="entity-list">
          {templates.map((t) => (
            <li key={t.id}>
              <Link to={`${pagePath(world.id, t.id)}`}>
                <PageIcon page={t} world={world} /> {t.name}
              </Link>{' '}
              <span className="muted small">· for new {typeLabel(t, world).many.toLowerCase()}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** The world's cover picture and colour, shown on Home and on its book on the shelf of worlds. */
function WorldLook({ world, update }: { world: World; update: (patch: Partial<World>) => void }) {
  const pictures = useLiveQuery(() => db.assets.where({ worldId: world.id }).filter((a) => a.mime.startsWith('image/')).toArray(), [world.id]) ?? []
  // The cover is for everyone: players get the picture while it's the cover (the server adds it),
  // and stop getting it if you pick another, unless it's marked for players in Files.
  const choose = (id: string | undefined) => update({ coverId: id })
  return (
    <section className="world-look">
      <h2>
        Cover and colour <Help topic="worldLook" />
      </h2>
      <div className="row wrap swatches world-colors" role="radiogroup" aria-label="World colour">
        {WORLD_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={worldColor(world) === c.value}
            className={`swatch ${worldColor(world) === c.value ? 'on' : ''}`}
            style={{ background: c.value }}
            title={c.name}
            onClick={() => update({ color: c.value })}
          />
        ))}
      </div>
      <p className="muted small">Cover picture (players see it too):</p>
      <div className="show-thumbs">
        <button type="button" className={`show-thumb no-cover ${world.coverId ? '' : 'on'}`} onClick={() => choose(undefined)}>
          None
        </button>
        {pictures.map((a) => (
          <CoverThumb key={a.id} asset={a} on={world.coverId === a.id} onPick={() => choose(a.id)} />
        ))}
        <label className="button">
          Upload…
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) choose(await saveFileAsAsset(world.id, f, f.name, ['cover']))
            }}
          />
        </label>
      </div>
    </section>
  )
}

function CoverThumb({ asset, on, onPick }: { asset: Asset; on: boolean; onPick: () => void }) {
  const url = useBlobUrl(asset)
  return (
    <button type="button" className={`show-thumb ${on ? 'on' : ''}`} title={asset.name} onClick={onPick}>
      {url && <img src={url} alt={asset.name} />}
    </button>
  )
}
