import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useAuthSession } from '../cloud/auth'
import { listGroupNotes, savePlayerNote } from '../cloud/players'
import type { Entity, PlayerNote, World } from '../db'
import { Markdown } from '../Markdown'

/**
 * Players' own notes on a page (or, with entityId '', the world's scratchpad).
 * Players get "My notes" (only them) and "Group notes" (every player, and the GM can read them).
 * The GM sees the group's notes read-only.
 */
export function PlayerNotesBox({
  world,
  entityId,
  entities,
  big,
}: {
  world: World
  entityId: string
  entities: Entity[]
  big?: boolean
}) {
  const memberOf = world.shared?.memberOf
  if (memberOf) return <MemberNotes world={world} memberOf={memberOf} entityId={entityId} big={big} />
  if (!world.shared && world.cloud?.enabled) return <GmGroupNotes world={world} entityId={entityId} entities={entities} big={big} />
  return null
}

function MemberNotes({ world, memberOf, entityId, big }: { world: World; memberOf: string; entityId: string; big?: boolean }) {
  const [tab, setTab] = useState<'mine' | 'group'>('mine')
  const notes = world.shared?.notes ?? []
  const find = (shared: boolean) => notes.find((n) => n.entityId === entityId && n.shared === shared)
  const names = new Map((world.shared?.members ?? []).map((m) => [m.userId, m.name || 'A player']))
  const group = find(true)

  return (
    <section className={`player-notes ${big ? 'scratchpad' : ''}`}>
      {!big && <h2>📝 Notes</h2>}
      <div className="tabs segmented">
        <button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>
          My notes
        </button>
        <button className={tab === 'group' ? 'on' : ''} onClick={() => setTab('group')}>
          Group notes{group?.body ? ' •' : ''}
        </button>
      </div>
      {tab === 'mine' ? (
        <NoteEditor
          key={`${entityId}:mine`}
          saved={find(false)?.body ?? ''}
          hint="Only you can see these."
          placeholder={big ? 'Anything you want to remember…' : 'What you know, suspect or want to ask about this…'}
          onSave={(body) => savePlayerNote(memberOf, entityId, false, body)}
        />
      ) : (
        <NoteEditor
          key={`${entityId}:group`}
          saved={group?.body ?? ''}
          hint={
            <>
              Every player can read and edit these, and your GM can read them.
              {group?.updatedBy && ` Last edited by ${group.updatedBy === world.shared?.me ? 'you' : (names.get(group.updatedBy) ?? 'a player')}.`}
            </>
          }
          placeholder={big ? 'The party’s shared notes: names, clues, plans, who owes whom…' : 'Shared with the whole party…'}
          onSave={(body) => savePlayerNote(memberOf, entityId, true, body)}
        />
      )}
    </section>
  )
}

/**
 * A notes box that keeps what you're typing even if a refresh brings in a newer copy, and shows the
 * newest saved text whenever you aren't mid-edit.
 */
function NoteEditor({
  saved,
  hint,
  placeholder,
  onSave,
}: {
  saved: string
  hint: ReactNode
  placeholder: string
  onSave: (body: string) => Promise<void>
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [state, setState] = useState<'' | 'saving' | 'saved' | 'error'>('')
  const text = draft ?? saved
  const save = async () => {
    if (draft === null || draft === saved) {
      setDraft(null)
      return
    }
    setState('saving')
    try {
      await onSave(draft)
      setDraft(null)
      setState('saved')
    } catch {
      setState('error')
    }
  }
  return (
    <>
      <textarea
        rows={6}
        value={text}
        onChange={(e) => {
          setDraft(e.target.value)
          setState('')
        }}
        onBlur={save}
        placeholder={placeholder}
        maxLength={50000}
      />
      <span className="note-meta">
        {state === 'saving' ? 'Saving…' : state === 'saved' ? '✓ Saved. ' : state === 'error' ? 'Couldn’t save. Check your connection and click away to try again. ' : ''}
        {state !== 'saving' && hint}
        {state === '' && ' Saves when you click away.'}
      </span>
    </>
  )
}

/** The GM's read-only look at what the party has written together. */
function GmGroupNotes({ world, entityId, entities, big }: { world: World; entityId: string; entities: Entity[]; big?: boolean }) {
  const { user } = useAuthSession()
  const [notes, setNotes] = useState<PlayerNote[] | null>(null)
  const load = useCallback(async () => {
    if (!user) return
    try {
      setNotes(await listGroupNotes(world.id))
    } catch {
      // Offline: nothing to show for now.
    }
  }, [user, world.id])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const note = notes?.find((n) => n.entityId === entityId)
  if (!big && !note?.body) return null
  return (
    <section className="player-notes">
      {!big && <h2>📝 Your players’ notes</h2>}
      <span className="note-meta">
        What your players have written here together. Only they can edit it, and their private notes stay private.{' '}
        <button className="link" onClick={load}>
          Refresh
        </button>
      </span>
      {note?.body ? (
        <div className="side-box">
          <Markdown text={note.body} entities={entities} worldId={world.id} showSecrets={false} />
        </div>
      ) : (
        <p className="muted">{notes ? 'Nothing yet.' : user ? 'Loading…' : 'Sign in to see your players’ notes.'}</p>
      )}
    </section>
  )
}
