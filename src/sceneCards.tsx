import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Entity, type PrepScene, type Session, type World } from './db'
import { DraftText } from './components'
import { Help } from './help'
import { PagePicker } from './PagePicker'
import { TypeIcon } from './icons'
import { addCombatants, encounterCombatants } from './encounters'
import { play } from './sound/player'
import { showToPlayers } from './showing'

/**
 * Scene cards: a prep scene can carry what it needs (the place, read-aloud text, who's there, the
 * music, a planned fight, something to show the players, pages to reveal), and "Start" at the
 * Lectern sets it all going in one click.
 */

/** Whether a scene has anything for "Start" to do. */
export const hasCard = (s: PrepScene) =>
  !!(s.placeId || s.readAloud?.trim() || s.presentIds?.length || s.soundIds?.length || s.encounterId || s.show || s.revealIds?.length)

/** What starting a scene will do, in a few words, for its button's tooltip. */
export function cardSummary(s: PrepScene, entities: Entity[], session: Session) {
  const name = (id: string) => entities.find((e) => e.id === id)?.name
  // Count only pages that are still there.
  const there = (id: string) => entities.some((e) => e.id === id)
  const present = (s.presentIds ?? []).filter(there).length
  const reveal = (s.revealIds ?? []).filter(there).length
  const bits = [
    s.placeId && `scene: ${name(s.placeId) ?? 'a place'}`,
    s.readAloud?.trim() && 'read-aloud text',
    present && `${present} here`,
    s.soundIds?.length && `${s.soundIds.length} sound${s.soundIds.length === 1 ? '' : 's'}`,
    s.encounterId && `fight: ${session.prep?.encounters.find((e) => e.id === s.encounterId)?.name ?? 'an encounter'}`,
    s.show && 'show players',
    reveal && `reveal ${reveal}`,
  ].filter(Boolean)
  return bits.join(' · ')
}

/**
 * Starts a scene: sets the Lectern's scene, text and who's there, loads its fight, plays its
 * sounds, reveals its pages and puts its handout on players' screens. The scene is ticked as played.
 */
export async function startScene(world: World, session: Session, scene: PrepScene) {
  const enc = scene.encounterId ? session.prep?.encounters.find((e) => e.id === scene.encounterId) : undefined
  const reveal = (await db.entities.bulkGet(scene.revealIds ?? [])).filter((e): e is Entity => !!e && e.visibility !== 'players')
  const shownPage = scene.show?.kind === 'page' ? await db.entities.get(scene.show.entityId) : undefined
  const toReveal = [...reveal, ...(shownPage && shownPage.visibility !== 'players' && !reveal.some((r) => r.id === shownPage.id) ? [shownPage] : [])]
  if (toReveal.length && !confirm(`Starting this scene reveals ${toReveal.map((e) => `“${e.name}”`).join(', ')} to everyone. Go ahead?`)) return false
  await db.sessions
    .where('id')
    .equals(session.id)
    .modify((s) => {
      s.lectern = { sceneText: '', presentIds: [], combat: { round: 0, combatants: [] }, rolls: [], ...s.lectern }
      const l = s.lectern
      if (scene.placeId) l.sceneId = scene.placeId
      if (scene.readAloud?.trim()) l.sceneText = scene.readAloud
      for (const id of scene.presentIds ?? []) if (!l.presentIds.includes(id)) l.presentIds.push(id)
      const fresh = l.presentIds.filter((id) => !s.entityIds.includes(id))
      if (fresh.length) s.entityIds = [...s.entityIds, ...fresh]
      if (enc) addCombatants(l, encounterCombatants(enc))
      const mine = s.prep?.scenes.find((x) => x.id === scene.id)
      if (mine) mine.done = true
    })
  for (const e of toReveal) await db.entities.update(e.id, { visibility: 'players', updatedAt: Date.now() })
  const sounds = (await db.sounds.bulkGet(scene.soundIds ?? [])).filter((x) => !!x)
  for (const s of sounds) await play(s).catch(() => undefined)
  if (scene.show?.kind === 'page' && shownPage) await showToPlayers(world.id, { kind: 'page', title: shownPage.name, entityId: shownPage.id })
  else if (scene.show?.kind === 'image') {
    const a = await db.assets.get(scene.show.assetId)
    if (a) await showToPlayers(world.id, { kind: 'image', title: a.name, assetId: a.id })
  }
  return true
}

/** The extra parts of a scene, on the session's Prep tab. */
export function SceneCardEditor({ scene, session, entities, onChange }: { scene: PrepScene; session: Session; entities: Entity[]; onChange: (fn: (s: PrepScene) => void) => void }) {
  const sounds = useLiveQuery(() => db.sounds.where({ worldId: session.worldId }).toArray(), [session.worldId]) ?? []
  const pictures = useLiveQuery(() => db.assets.where({ worldId: session.worldId }).filter((a) => a.mime.startsWith('image/')).toArray(), [session.worldId]) ?? []
  const byId = new Map(entities.map((e) => [e.id, e]))
  const places = entities.filter((e) => e.type === 'location' || e.type === 'shop')
  const people = entities.filter((e) => ['npc', 'pc', 'faction', 'deity'].includes(e.type))
  const chips = (ids: string[] | undefined, remove: (id: string) => void) =>
    (ids ?? []).map((id) => {
      const e = byId.get(id)
      return (
        <button key={id} className="tag" title="Remove" onClick={() => remove(id)}>
          {e ? <TypeIcon type={e.type} /> : null} {e?.name ?? 'Deleted page'} ✕
        </button>
      )
    })
  return (
    <div className="scene-card-editor">
      <label>
        <span>Where</span>
        <PagePicker entities={places} value={scene.placeId} placeholder="The place (it becomes the Lectern’s scene)" onPick={(id) => onChange((s) => void (s.placeId = id || undefined))} />
      </label>
      {scene.placeId && (
        <button className="link small" onClick={() => onChange((s) => void delete s.placeId)}>
          Clear the place
        </button>
      )}
      <label>
        <span>Read aloud</span>
        <DraftText multiline rows={3} value={scene.readAloud ?? ''} placeholder="Text for the scene box at the Lectern: what they see, hear and smell." onCommit={(v) => onChange((s) => void (s.readAloud = v || undefined))} />
      </label>
      <div>
        <span className="small muted">Who’s there</span>
        <span className="tags">{chips(scene.presentIds, (id) => onChange((s) => void (s.presentIds = s.presentIds?.filter((x) => x !== id))))}</span>
        <PagePicker entities={people.filter((e) => !scene.presentIds?.includes(e.id))} placeholder="+ Someone in this scene" onPick={(id) => id && onChange((s) => void (s.presentIds = [...(s.presentIds ?? []), id]))} />
      </div>
      {sounds.length > 0 && (
        <div>
          <span className="small muted">Sounds to play</span>
          <div className="row wrap small">
            {sounds.map((snd) => (
              <label key={snd.id} className="row">
                <input
                  type="checkbox"
                  checked={!!scene.soundIds?.includes(snd.id)}
                  onChange={(e) => {
                    const on = e.target.checked
                    onChange((s) => void (s.soundIds = on ? [...(s.soundIds ?? []), snd.id] : s.soundIds?.filter((x) => x !== snd.id)))
                  }}
                />
                {snd.name}
              </label>
            ))}
          </div>
        </div>
      )}
      {(session.prep?.encounters.length ?? 0) > 0 && (
        <label>
          <span>Fight</span>
          <select value={scene.encounterId ?? ''} onChange={(e) => {
            const v = e.target.value || undefined
            onChange((s) => void (s.encounterId = v))
          }}>
            <option value="">No fight</option>
            {session.prep!.encounters.map((enc) => (
              <option key={enc.id} value={enc.id}>
                {enc.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div>
        <span className="small muted">Show players</span>
        <div className="row wrap">
          <select
            value={scene.show?.kind === 'image' ? scene.show.assetId : ''}
            onChange={(e) => {
              const v = e.target.value
              onChange((s) => void (s.show = v ? { kind: 'image', assetId: v } : s.show?.kind === 'image' ? undefined : s.show))
            }}
            aria-label="A picture to show"
          >
            <option value="">{pictures.length ? 'A picture…' : 'No pictures in this world yet'}</option>
            {pictures.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <span className="muted small">or</span>
          <PagePicker
            entities={entities.filter((e) => !e.template)}
            value={scene.show?.kind === 'page' ? scene.show.entityId : undefined}
            placeholder="a page (a letter, an NPC)…"
            onPick={(id) => onChange((s) => void (s.show = id ? { kind: 'page', entityId: id } : undefined))}
          />
          {scene.show && (
            <button className="link small" onClick={() => onChange((s) => void delete s.show)}>
              Show nothing
            </button>
          )}
        </div>
      </div>
      <div>
        <span className="small muted">Reveal to everyone</span>
        <span className="tags">{chips(scene.revealIds, (id) => onChange((s) => void (s.revealIds = s.revealIds?.filter((x) => x !== id))))}</span>
        <PagePicker
          entities={entities.filter((e) => e.visibility === 'gm' && !e.template && !scene.revealIds?.includes(e.id))}
          placeholder="+ A GM-only page players learn about here"
          onPick={(id) => id && onChange((s) => void (s.revealIds = [...(s.revealIds ?? []), id]))}
        />
      </div>
      <p className="muted small">
        At the Lectern, <b>▶ Start</b> on this scene does all of this at once. <Help topic="sceneCards" />
      </p>
    </div>
  )
}

