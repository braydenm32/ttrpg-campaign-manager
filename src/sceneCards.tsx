import { useLiveQuery } from 'dexie-react-hooks'
import { blankLectern, db, saveEntity, type Entity, type PrepScene, type Session, type World } from './db'
import { DraftText } from './components'
import { Help } from './help'
import { PagePicker } from './PagePicker'
import { TypeIcon } from './icons'
import { addCombatants, encounterCombatants } from './encounters'
import { play } from './sound/player'
import { schedule } from './cloud/sync'
import { askToReveal, type Review } from './reveal'
import { showToPlayers } from './showing'
import { toast } from './undo'

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
 * The Lectern's scene as it is now (and which planned scenes are ticked, who's featured in the
 * session, who's in the fight and whether play has started), so a scene change can be undone.
 */
export interface SceneSnapshot {
  sceneId?: string
  sceneText: string
  presentIds: string[]
  planSceneId?: string
  done: string[]
  entityIds: string[]
  combatantIds: string[]
  activeId?: string
  startedAt?: number
}

export function sceneSnapshot(session: Session): SceneSnapshot {
  const l = session.lectern
  return {
    sceneId: l?.sceneId,
    sceneText: l?.sceneText ?? '',
    presentIds: [...(l?.presentIds ?? [])],
    planSceneId: l?.planSceneId,
    done: (session.prep?.scenes ?? []).filter((x) => x.done).map((x) => x.id),
    entityIds: [...session.entityIds],
    combatantIds: (l?.combat.combatants ?? []).map((c) => c.id),
    activeId: l?.combat.activeId,
    startedAt: session.startedAt,
  }
}

/**
 * Puts the scene back as it was: the place, the read-aloud text, who's here, which scenes are
 * ticked, and takes away the pages it added to the session, the fighters it added and the start time
 * it set.
 */
export const restoreScene = (sessionId: string, snap: SceneSnapshot) =>
  db.sessions
    .where('id')
    .equals(sessionId)
    .modify((s) => {
      s.lectern = { ...blankLectern(), ...s.lectern, sceneId: snap.sceneId, sceneText: snap.sceneText, presentIds: [...snap.presentIds], planSceneId: snap.planSceneId }
      for (const x of s.prep?.scenes ?? []) x.done = snap.done.includes(x.id)
      s.entityIds = s.entityIds.filter((id) => snap.entityIds.includes(id))
      const combat = s.lectern.combat
      const kept = combat.combatants.filter((c) => snap.combatantIds.includes(c.id))
      if (kept.length !== combat.combatants.length) {
        s.lectern.combat = { ...combat, combatants: kept, activeId: kept.some((c) => c.id === combat.activeId) ? combat.activeId : snap.activeId }
      }
      if (snap.startedAt) s.startedAt = snap.startedAt
      else delete s.startedAt
    })

/**
 * Starts a scene: a new scene replaces the last one, so its read-aloud text and who's there take
 * the place of the old (none, if the card has none; a scene with no place of its own stays where the
 * party is). It also loads its fight, plays its sounds, reveals its pages and puts its handout on
 * players' screens. The scene is ticked as played, and becomes the scene "Next scene" goes on from.
 * Pages it would reveal get the same review as on the page itself (one review for all of them).
 * Gives back a function that hides those pages again and puts back what was on players' screens
 * (for Undo), or false if the GM cancelled.
 */
export async function startScene(world: World, session: Session, scene: PrepScene, ask: (r: Review) => Promise<string | null>) {
  const enc = scene.encounterId ? session.prep?.encounters.find((e) => e.id === scene.encounterId) : undefined
  const reveal = (await db.entities.bulkGet(scene.revealIds ?? [])).filter((e): e is Entity => !!e && e.visibility !== 'players')
  const shownPage = scene.show?.kind === 'page' ? await db.entities.get(scene.show.entityId) : undefined
  const toReveal = [...reveal, ...(shownPage && shownPage.visibility !== 'players' && !reveal.some((r) => r.id === shownPage.id) ? [shownPage] : [])]
  const ok = await askToReveal(ask, toReveal, {
    title: toReveal.length === 1 ? `Starting this scene reveals “${toReveal[0].name}” to players` : `Starting this scene reveals ${toReveal.length} pages to players`,
    note: 'Every player can read them from now on. Undo straight after hides them again.',
    confirm: 'Start the scene',
  })
  if (!ok) return false
  const worldBefore = await db.worlds.get(world.id)
  await db.sessions
    .where('id')
    .equals(session.id)
    .modify((s) => {
      s.lectern = { ...blankLectern(), ...s.lectern }
      const l = s.lectern
      if (scene.placeId) l.sceneId = scene.placeId
      l.sceneText = scene.readAloud?.trim() ? scene.readAloud : ''
      l.presentIds = [...new Set(scene.presentIds ?? [])]
      l.planSceneId = scene.id
      const fresh = l.presentIds.filter((id) => !s.entityIds.includes(id))
      if (fresh.length) s.entityIds = [...s.entityIds, ...fresh]
      if (enc) addCombatants(l, encounterCombatants(enc))
      const mine = s.prep?.scenes.find((x) => x.id === scene.id)
      if (mine) mine.done = true
      if (!s.startedAt) s.startedAt = Date.now()
    })
  for (const e of toReveal) await saveEntity({ ...e, visibility: 'players', updatedAt: Date.now() })
  const sounds = (await db.sounds.bulkGet(scene.soundIds ?? [])).filter((x) => !!x)
  for (const s of sounds) await play(s).catch(() => undefined)
  let shown = false
  if (scene.show?.kind === 'page' && shownPage) shown = await showToPlayers(world.id, { kind: 'page', title: shownPage.name, entityId: shownPage.id })
  else if (scene.show?.kind === 'image') {
    const a = await db.assets.get(scene.show.assetId)
    if (a) shown = await showToPlayers(world.id, { kind: 'image', title: a.name, assetId: a.id })
  }
  const shownId = shown ? (await db.worlds.get(world.id))?.showing?.id : undefined
  return async () => {
    for (const e of toReveal) {
      const now = await db.entities.get(e.id)
      if (now?.visibility === 'players') await db.entities.update(e.id, { visibility: e.visibility, updatedAt: Date.now() })
    }
    // What was on players' screens (and in their handouts) before, unless the GM has shown something else since.
    if (shownId)
      await db.worlds
        .where('id')
        .equals(world.id)
        .modify((w) => {
          if (!(w.handouts ?? []).some((h) => h.id === shownId)) return
          w.handouts = worldBefore?.handouts ?? (w.handouts ?? []).filter((h) => h.id !== shownId)
          if (w.showing?.id === shownId) w.showing = worldBefore?.showing ?? null
        })
    if (toReveal.length || shownId) schedule(200)
  }
}

/** The planned scene being played now, and the one "Next scene" goes to: the first unplayed one after it. */
export function plannedScenes(session: Session) {
  const scenes = session.prep?.scenes ?? []
  const at = scenes.findIndex((x) => x.id === session.lectern?.planSceneId)
  const current = at >= 0 ? scenes[at] : undefined
  const next = scenes.slice(at + 1).find((x) => !x.done) ?? scenes.find((x) => !x.done && x.id !== current?.id)
  return { scenes, current, at, next }
}

/**
 * Starts a scene from the Lectern with Undo, which takes it all back: the last scene, the fighters
 * and pages it added, the pages it revealed and what was on players' screens.
 */
export async function goToScene(world: World, session: Session, scene: PrepScene, ask: (r: Review) => Promise<string | null>) {
  const before = sceneSnapshot(session)
  const undoShown = await startScene(world, session, scene, ask)
  if (!undoShown) return
  const n = (session.prep?.scenes ?? []).findIndex((x) => x.id === scene.id) + 1
  toast(`Scene ${n}: ${scene.text.length > 48 ? `${scene.text.slice(0, 48).trimEnd()}…` : scene.text}`, async () => {
    await restoreScene(session.id, before)
    await undoShown()
  })
}

/**
 * The party moves to another place by hand (the Scene picker): a new scene. What was planned for
 * that place, if anything, comes with it; otherwise the read-aloud text and who's here are cleared,
 * so last scene's text can't be read out by mistake. Undo puts it back.
 */
export async function changePlace(session: Session, placeId: string | undefined, placeName?: string) {
  const before = sceneSnapshot(session)
  const planned = placeId ? session.prep?.scenes.find((x) => x.placeId === placeId && !x.done) ?? session.prep?.scenes.find((x) => x.placeId === placeId) : undefined
  await db.sessions
    .where('id')
    .equals(session.id)
    .modify((s) => {
      s.lectern = { ...blankLectern(), ...s.lectern }
      const l = s.lectern
      l.sceneId = placeId
      l.sceneText = planned?.readAloud?.trim() ? planned.readAloud : ''
      l.presentIds = [...new Set(planned?.presentIds ?? [])]
      l.planSceneId = planned?.id ?? l.planSceneId
      const fresh = l.presentIds.filter((id) => !s.entityIds.includes(id))
      if (fresh.length) s.entityIds = [...s.entityIds, ...fresh]
    })
  toast(placeId ? `The scene is now ${placeName ?? 'somewhere new'}.` : 'The scene is cleared.', () => restoreScene(session.id, before))
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

