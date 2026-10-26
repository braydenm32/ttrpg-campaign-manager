import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Help } from '../help'
import { useAuthSession } from '../cloud/auth'
import { listGroupNotes, savePlayerNote, type NoteClash } from '../cloud/players'
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
      {!big && (
        <h2>
          📝 Notes <Help topic="playerNotes" />
        </h2>
      )}
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
          nameOf={() => ''}
        />
      ) : (
        <NoteEditor
          key={`${entityId}:group`}
          saved={group?.body ?? ''}
          savedAt={group?.updatedAt}
          nameOf={(id) => (id === world.shared?.me ? 'You' : (names.get(id) ?? 'Another player'))}
          hint={
            <>
              Every player can read and edit these, and your GM can read them.
              {group?.updatedBy && ` Last edited by ${group.updatedBy === world.shared?.me ? 'you' : (names.get(group.updatedBy) ?? 'a player')}.`}
            </>
          }
          placeholder={big ? 'The party’s shared notes: names, clues, plans, who owes whom…' : 'Shared with the whole party…'}
          onSave={(body, expected) => savePlayerNote(memberOf, entityId, true, body, expected)}
        />
      )}
    </section>
  )
}

/**
 * A notes box that keeps what you're typing even if a refresh brings in a newer copy, and shows the
 * newest saved text whenever you aren't mid-edit. For group notes, if someone else saved while you
 * were typing, nothing is overwritten: you choose to keep both, use yours or use theirs.
 */
function NoteEditor({
  saved,
  savedAt,
  hint,
  placeholder,
  onSave,
  nameOf,
}: {
  saved: string
  savedAt?: string
  hint: ReactNode
  placeholder: string
  onSave: (body: string, expected: string | null) => Promise<NoteClash | null>
  nameOf: (userId: string) => string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  // When the note you started from was saved, so a newer save by someone else is caught.
  const [base, setBase] = useState<string | null>(null)
  const [clash, setClash] = useState<NoteClash | null>(null)
  const [state, setState] = useState<'' | 'saving' | 'saved' | 'error'>('')
  const text = draft ?? saved
  const save = async (body = draft, expected: string | null = base ?? savedAt ?? null) => {
    if (body === null || (body === saved && !clash)) {
      setDraft(null)
      return
    }
    setState('saving')
    try {
      const theirs = await onSave(body, expected)
      if (theirs) {
        setClash(theirs)
        setState('')
        return
      }
      setDraft(null)
      setBase(null)
      setClash(null)
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
          if (draft === null) setBase(savedAt ?? null)
          setDraft(e.target.value)
          setState('')
        }}
        onBlur={() => !clash && save()}
        placeholder={placeholder}
        maxLength={50000}
      />
      {clash && draft !== null && (
        <div className="note-clash" role="alert">
          <p>
            <strong>{nameOf(clash.updatedBy)} changed these notes while you were typing.</strong> Nothing has been overwritten yet. Their version:
          </p>
          <pre className="note-clash-theirs">{clash.body}</pre>
          <div className="row wrap">
            <button className="primary" onClick={() => save(`${clash.body.trimEnd()}\n\n${draft.trim()}`, null)}>
              Keep both
            </button>
            <button onClick={() => save(draft, null)}>Use mine</button>
            <button
              onClick={() => {
                setDraft(null)
                setBase(null)
                setClash(null)
              }}
            >
              Use theirs
            </button>
          </div>
        </div>
      )}
      <span className="note-meta">
        {state === 'saving' ? 'Saving…' : state === 'saved' ? '✓ Saved. ' : state === 'error' ? 'Couldn’t save. Check your connection and click away to try again. ' : ''}
        {state !== 'saving' && hint}
        {state === '' && !clash && ' Saves when you click away.'}
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
      {!big && (
        <h2>
          📝 Your players’ notes <Help topic="gmPlayerNotes" />
        </h2>
      )}
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
