import { binSound } from '../bin'
import { useState } from 'react'
import { DraftText, Empty } from '../components'
import { db, newId, type Sound } from '../db'
import { Help } from '../help'
import { saveFileAsAsset, useWorld } from '../hooks'
import { stop, stopAll, usePlaying } from '../sound/player'
import { Soundboard, useSounds } from '../sound/Soundboard'
import { parseSyrinscape, syrinscape, useSyrinscapeToken } from '../sound/syrinscape'
import { useViewMode } from '../viewMode'
import { Ico } from '../icons'
import { MusicNotes, SpeakerHigh } from '@phosphor-icons/react'

const GROUPS = ['Ambience', 'Music', 'Effects']

/** The soundboard: set up buttons for your own audio files and Syrinscape moods, and play them. */
export default function Sounds() {
  const { worldId } = useWorld()
  const { isGM } = useViewMode()
  const sounds = useSounds(worldId)
  const playing = usePlaying()
  const [group, setGroup] = useState('Ambience')
  const [busy, setBusy] = useState(false)
  if (!isGM) return <Empty>The soundboard is a GM tool. Switch back to the GM view to use it.</Empty>

  const groups = [...new Set([...GROUPS, ...sounds.map((s) => s.group).filter(Boolean)])]
  const update = (id: string, patch: Partial<Sound>) => db.sounds.update(id, patch)

  return (
    <div className="page">
      <header className="page-header">
        <h1>
          <Ico as={MusicNotes} /> Soundboard <Help topic="soundboard" />
        </h1>
        {playing.length > 0 && <button onClick={() => stopAll()}>■ Stop all</button>}
      </header>
      <section className="card">
        <Soundboard worldId={worldId} />
      </section>

      <section>
        <h2>Add sounds</h2>
        <div className="row wrap">
          <label>
            Group{' '}
            <input list="sound-groups" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Ambience" />
            <datalist id="sound-groups">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </label>
          <label className="button primary">
            {busy ? 'Adding…' : '⬆ Upload audio files'}
            <input
              type="file"
              accept="audio/*"
              multiple
              hidden
              onChange={async (e) => {
                const files = [...(e.target.files ?? [])]
                e.target.value = ''
                if (!files.length) return
                setBusy(true)
                try {
                  for (const f of files) {
                    const assetId = await saveFileAsAsset(worldId, f, f.name, ['sound'])
                    await db.sounds.add({
                      id: newId(),
                      worldId,
                      name: f.name.replace(/\.[^.]+$/, ''),
                      source: 'file',
                      assetId,
                      loop: group.toLowerCase() !== 'effects',
                      volume: 0.8,
                      group: group.trim(),
                      createdAt: Date.now(),
                    })
                  }
                } finally {
                  setBusy(false)
                }
              }}
            />
          </label>
        </div>
        <p className="muted small">
          Files stay GM only and sync to your other devices like maps do (up to 50 MB each). Ambience and music loop; effects play once. You can change that below.
        </p>
        <SyrinscapeAdd worldId={worldId} group={group} />
      </section>

      {sounds.length > 0 && (
        <section>
          <h2>Your buttons</h2>
          <table className="sound-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Group</th>
                <th>Loop</th>
                <th>Volume</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sounds.map((s) => (
                <tr key={s.id}>
                  <td>
                    <DraftText value={s.name} onCommit={(v) => update(s.id, { name: v })} />
                    <div className="muted small">{s.source === 'syrinscape' ? `Syrinscape ${s.syrinscape?.kind} ${s.syrinscape?.id}` : 'Your file'}</div>
                  </td>
                  <td>
                    <DraftText value={s.group} list="sound-groups" onCommit={(v) => update(s.id, { group: v })} />
                  </td>
                  <td>{s.source === 'file' ? <input type="checkbox" checked={s.loop} onChange={(e) => update(s.id, { loop: e.target.checked })} /> : <span className="muted small">in Syrinscape</span>}</td>
                  <td>
                    {s.source === 'file' && (
                      <input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => update(s.id, { volume: Number(e.target.value) })} />
                    )}
                  </td>
                  <td>
                    <button
                      className="ghost"
                      title="Remove"
                      onClick={async () => {
                        if (!confirm(`Remove “${s.name}”?`)) return
                        await stop(s).catch(() => {})
                        await binSound(s.id)
                      }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

function SyrinscapeAdd({ worldId, group }: { worldId: string; group: string }) {
  const token = useSyrinscapeToken()
  const [link, setLink] = useState('')
  const [name, setName] = useState('')
  const [tokenDraft, setTokenDraft] = useState('')
  const ref = parseSyrinscape(link)
  return (
    <details className="card">
      <summary>
        <strong><Ico as={SpeakerHigh} /> Syrinscape</strong> <Help topic="syrinscape" />
      </summary>
      {token ? (
        <p className="small">
          ✓ Your Syrinscape token is saved on this device.{' '}
          <button className="link" onClick={() => syrinscape.setToken('')}>
            Remove it
          </button>
        </p>
      ) : (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault()
            syrinscape.setToken(tokenDraft)
            setTokenDraft('')
          }}
        >
          <p className="small muted">
            Sign in at syrinscape.com, open the online player’s master interface and copy your auth token from its settings. It stays on this device only: never synced and never in
            backups.
          </p>
          <div className="row">
            <input type="password" value={tokenDraft} onChange={(e) => setTokenDraft(e.target.value)} placeholder="Syrinscape auth token" autoComplete="off" />
            <button disabled={!tokenDraft.trim()}>Save token</button>
          </div>
        </form>
      )}
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!ref) return
          await db.sounds.add({
            id: newId(),
            worldId,
            name: name.trim() || `Syrinscape ${ref.kind} ${ref.id}`,
            source: 'syrinscape',
            syrinscape: ref,
            loop: false,
            volume: 1,
            group: group.trim(),
            createdAt: Date.now(),
          })
          setLink('')
          setName('')
        }}
      >
        <p className="small muted">In Syrinscape, copy a mood’s or element’s remote control link and paste it here. Keep Syrinscape’s player open while you play: it makes the sound.</p>
        <div className="row wrap">
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://syrinscape.com/online/frontend-api/moods/1234/play/" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Button name, e.g. Tavern" />
          <button disabled={!ref}>Add</button>
        </div>
        {link && !ref && <p className="error small">That doesn’t look like a Syrinscape mood or element link.</p>}
        {ref && <p className="small muted">Found Syrinscape {ref.kind} {ref.id}.</p>}
      </form>
    </details>
  )
}
