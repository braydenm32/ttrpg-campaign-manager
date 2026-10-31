import { useState, type ReactNode } from 'react'
import { Eye, EyeClosed, Lock, Television, Warning } from '@phosphor-icons/react'
import { Modal } from './components'
import { db, saveEntity, type Entity, type Visibility, type World } from './db'
import { Help } from './help'
import { Ico } from './icons'
import { splitSecrets } from './Markdown'
import { secretNames } from './SecretNamesWarning'
import { useWorldPlayers } from './players/Secrets'
import { revealAndShow, stopShowing } from './showing'
import { toast } from './undo'

/**
 * Showing things to players, one way everywhere: a control that says what something is now ("GM
 * only", "Players can see this", "Revealed to Sam"), a short review of what players will get before
 * anything is revealed, and Undo afterwards. Hiding needs no review (nothing new reaches anyone),
 * but it gets Undo too.
 */

export interface Review {
  title: string
  /** What players will get. */
  see?: ReactNode[]
  /** What stays with the GM. */
  kept?: ReactNode[]
  /** A warning worth reading first (names of GM-only pages in the text, say). */
  warn?: ReactNode
  /** Any other words, under the title. */
  note?: ReactNode
  /** The main button's words, and any other choices beside it (each answers with its value). */
  confirm: string
  others?: { label: ReactNode; value: string }[]
}

/**
 * A review step for one screen: `ask` opens it and answers with the button pressed ('ok', another
 * choice's value, or null for Cancel). Put `dialog` somewhere in the screen.
 */
export function useReview() {
  const [open, setOpen] = useState<{ r: Review; done: (v: string | null) => void }>()
  const ask = (r: Review) =>
    new Promise<string | null>((resolve) =>
      setOpen({
        r,
        done: (v) => {
          setOpen(undefined)
          resolve(v)
        },
      }),
    )
  const dialog = open ? <ReviewDialog review={open.r} onDone={open.done} /> : null
  return { ask, dialog }
}

function ReviewDialog({ review: r, onDone }: { review: Review; onDone: (v: string | null) => void }) {
  return (
    <Modal title={r.title} onClose={() => onDone(null)}>
      <div className="review-step">
        {r.note && <p className="small">{r.note}</p>}
        {!!r.see?.length && (
          <>
            <h3 className="small">
              <Ico as={Eye} /> Players will see
            </h3>
            <ul className="small">
              {r.see.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </>
        )}
        {!!r.kept?.length && (
          <>
            <h3 className="small">
              <Ico as={Lock} /> Still kept from them
            </h3>
            <ul className="small muted">
              {r.kept.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </>
        )}
        {r.warn && (
          <p className="secret-names small" role="status">
            <Ico as={Warning} /> {r.warn}
          </p>
        )}
        <div className="row end wrap review-step-buttons">
          <button type="button" onClick={() => onDone(null)}>
            Cancel
          </button>
          {r.others?.map((o) => (
            <button key={o.value} type="button" onClick={() => onDone(o.value)}>
              {o.label}
            </button>
          ))}
          <button type="button" className="primary" autoFocus onClick={() => onDone('ok')}>
            {r.confirm}
          </button>
        </div>
      </div>
    </Modal>
  )
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** What players get of a page once it's revealed, and what they don't, in plain words. */
export function pageReveal(e: Entity, pages: Entity[]) {
  const see: string[] = []
  const kept: string[] = []
  const segs = splitSecrets(e.body ?? '')
  const text = segs.filter((s) => s.kind === 'text').some((s) => s.body.trim())
  see.push(['the name', e.summary.trim() && 'the summary', text && 'the description'].filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' and $1'))
  const open = e.fields.filter((f) => !f.gm && f.key.trim())
  const shut = e.fields.filter((f) => f.gm && f.key.trim())
  if (open.length) see.push(`${plural(open.length, 'detail')}: ${open.map((f) => f.key).join(', ')}`)
  if (e.status && e.statusKnown) see.push('their status')
  if (e.tags.length) see.push(`tags: ${e.tags.join(', ')}`)
  if (e.imageId) see.push('the picture')
  if (e.playerBody) see.push('what the player wrote')
  const known = (e.relations ?? []).filter((r) => r.known).length
  if (known) see.push(`${plural(known, 'relationship')} marked “Players know” (with pages they can see)`)
  const gmPassages = segs.filter((s) => s.kind === 'gm').length
  const forPassages = segs.filter((s) => s.kind === 'for')
  if (e.gmNotes.trim()) kept.push('GM notes')
  if (gmPassages) kept.push(plural(gmPassages, 'GM-only passage'))
  if (forPassages.length)
    kept.push(`${plural(forPassages.length, 'passage')} for some characters only (${[...new Set(forPassages.flatMap((s) => (s.kind === 'for' ? s.names : [])))].join(', ')} see theirs)`)
  if (shut.length) kept.push(`${plural(shut.length, 'GM-only detail')}: ${shut.map((f) => f.key).join(', ')}`)
  if (e.gmTags?.length) kept.push('GM-only tags')
  if (e.status && !e.statusKnown) kept.push('their status')
  const hiddenRel = (e.relations ?? []).length - known
  if (hiddenRel) kept.push(plural(hiddenRel, 'relationship') + ' not marked “Players know”')
  const names = secretNames([e.summary, e.body, e.playerBody], pages)
  return { see, kept, warn: names.length ? `These GM-only pages are named in it, so players will read their names: ${names.join(', ')}.` : undefined }
}

/** Who can see a page right now, in words: for the summary strip and the control. */
export function pageAudience(e: Entity, names: string[]) {
  if (e.visibility === 'players') return { kind: 'players' as const, label: 'Players can see this' }
  if (e.revealedTo?.length)
    return { kind: 'some' as const, label: `Revealed to ${names.length ? names.join(', ') : plural(e.revealedTo.length, 'player')}` }
  return { kind: 'gm' as const, label: 'GM only' }
}

/**
 * The one visibility control on a page: says what the page is now, and changes it after a short
 * review (revealing) or straight away (hiding), with Undo either way.
 */
export function PageVisibility({ entity: e, world, entities }: { entity: Entity; world: World | null | undefined; entities: Entity[] }) {
  const { ask, dialog } = useReview()
  const players = useWorldPlayers(e.revealedTo?.length ? world : undefined, entities)
  const names = players.filter((p) => e.revealedTo?.includes(p.userId)).map((p) => p.name)
  const who = pageAudience(e, names)
  const onScreen = world?.showing?.kind === 'page' && world.showing.entityId === e.id
  const worldId = e.worldId

  const reveal = async () => {
    const { see, kept, warn } = pageReveal(e, entities)
    const answer = await ask({
      title: `Reveal “${e.name}” to players?`,
      note: who.kind === 'some' ? `${who.label} now. This lets every player read it.` : undefined,
      see,
      kept,
      warn,
      confirm: 'Reveal to players',
      others: [
        { label: <><Ico as={Television} /> Reveal and show on their screens</>, value: 'show' },
        ...(who.kind === 'some' ? [{ label: 'Hide from them too', value: 'hide' }] : []),
      ],
    })
    if (!answer) return
    const before = await db.entities.get(e.id)
    if (!before) return
    if (answer === 'hide') {
      await saveEntity({ ...before, revealedTo: undefined, updatedAt: Date.now() })
      toast(`“${e.name}” is GM only again.`, () => db.entities.update(e.id, { revealedTo: before.revealedTo, updatedAt: Date.now() }))
      return
    }
    if (answer === 'show') await revealAndShow(worldId, before)
    else await saveEntity({ ...before, visibility: 'players', updatedAt: Date.now() })
    toast(answer === 'show' ? `“${e.name}” revealed and on players’ screens.` : `“${e.name}” revealed to players.`, async () => {
      if (answer === 'show') await stopShowing(worldId)
      await db.entities.update(e.id, { visibility: before.visibility, updatedAt: Date.now() })
    })
  }
  const hide = async () => {
    const answer = await ask({
      title: `Make “${e.name}” GM only again?`,
      note: (
        <>
          Players stop seeing it straight away.{onScreen && ' It’s on their screens right now, and will come off.'} Anything they already read, they may remember.
        </>
      ),
      confirm: 'Make it GM only',
    })
    if (!answer) return
    const before = await db.entities.get(e.id)
    if (!before) return
    if (onScreen) await stopShowing(worldId)
    await saveEntity({ ...before, visibility: 'gm', updatedAt: Date.now() })
    toast(`“${e.name}” is GM only again.`, () => db.entities.update(e.id, { visibility: 'players', updatedAt: Date.now() }))
  }

  return (
    <>
      <span className="vis-control-wrap">
        <button
          type="button"
          className={`vis-control ${who.kind}`}
          onClick={who.kind === 'players' ? hide : reveal}
          title={who.kind === 'players' ? 'Every player can read this page (not its GM notes or secret passages). Click to make it GM only.' : 'Click to see what players would get, then reveal it.'}
        >
          <Ico as={who.kind === 'players' ? Eye : who.kind === 'some' ? EyeClosed : Lock} /> {who.label}
          <span className="vis-change">{who.kind === 'players' ? 'Hide' : 'Reveal…'}</span>
        </button>
        <Help topic="pageVisibility" />
      </span>
      {dialog}
    </>
  )
}

/**
 * The same control for a map, a pin or anything else with a visibility: reveals after a short
 * review of `see`, hides straight away, Undo for both.
 */
export function VisibilityControl({
  value,
  onChange,
  name,
  see,
  kept,
  compact,
}: {
  value: Visibility
  onChange: (v: Visibility) => unknown
  /** What it is, for the words: “the map “Cinderford””. */
  name: string
  see?: ReactNode[]
  kept?: ReactNode[]
  compact?: boolean
}) {
  const { ask, dialog } = useReview()
  const flip = async () => {
    if (value === 'gm') {
      const ok = await ask({ title: `Reveal ${name} to players?`, see, kept, confirm: 'Reveal to players' })
      if (!ok) return
      await onChange('players')
      toast(`Revealed ${name} to players.`, () => onChange('gm'))
    } else {
      await onChange('gm')
      toast(`${name.charAt(0).toUpperCase()}${name.slice(1)} is GM only again.`, () => onChange('players'))
    }
  }
  return (
    <>
      <button
        type="button"
        className={`vis-control ${value === 'players' ? 'players' : 'gm'} ${compact ? 'compact' : ''}`}
        onClick={flip}
        title={value === 'gm' ? 'Only you can see this. Click to review and reveal it.' : 'Players can see this. Click to make it GM only.'}
      >
        <Ico as={value === 'players' ? Eye : Lock} /> {value === 'players' ? 'Players can see this' : 'GM only'}
        <span className="vis-change">{value === 'players' ? 'Hide' : 'Reveal…'}</span>
      </button>
      {dialog}
    </>
  )
}

/** In GM lists: a small mark on what players can read (GM-only things carry the lock instead). */
export function SeenMark({ entity: e }: { entity: Pick<Entity, 'visibility' | 'revealedTo'> }) {
  if (e.visibility === 'players')
    return (
      <span className="seen-mark players" title="Players can see this">
        <Ico as={Eye} />
        <span className="sr-only">Players can see this</span>
      </span>
    )
  return (
    <span className={`seen-mark gm ${e.revealedTo?.length ? 'some' : ''}`} title={e.revealedTo?.length ? 'GM only, revealed to some players' : 'GM only'}>
      <Ico as={e.revealedTo?.length ? EyeClosed : Lock} />
      <span className="sr-only">{e.revealedTo?.length ? 'Revealed to some players' : 'GM only'}</span>
    </span>
  )
}
