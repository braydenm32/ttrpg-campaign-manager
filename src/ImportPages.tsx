import { useState } from 'react'
import { ENTITY_LABELS, type EntityType } from './db'
import { Help } from './help'
import { applyImport, exportMarkdown, planImport, readFiles, type ImportPlan, type ImportSource } from './importers'

const SOURCES: { id: ImportSource; label: string; hint: string; accept: string; folder?: boolean }[] = [
  { id: 'markdown', label: '📝 Obsidian or Markdown', hint: 'Pick your vault folder, a .zip of it, or some .md files.', accept: '.md,.markdown,.zip', folder: true },
  { id: 'kanka', label: '🐉 Kanka', hint: 'In Kanka: Campaign, Export. Pick the .zip it emails you.', accept: '.zip,.json' },
  { id: 'worldanvil', label: '🌍 World Anvil', hint: 'In World Anvil: World, Export (needs a Guild plan). Pick the .zip.', accept: '.zip,.json' },
]

/** World settings: bring pages in from other tools, or take them out as Markdown. */
export function ImportPages({ worldId }: { worldId: string }) {
  const [plan, setPlan] = useState<ImportPlan>()
  const [busy, setBusy] = useState('')
  const [done, setDone] = useState('')
  const [error, setError] = useState('')
  const [skipExisting, setSkipExisting] = useState(true)

  const read = async (source: ImportSource, list: FileList | null) => {
    if (!list?.length) return
    setBusy('Reading files…')
    setError('')
    setDone('')
    try {
      const files = await readFiles([...list])
      const p = await planImport(source, files)
      if (!p.pages.length) setError(`Couldn’t find any pages in those files. Check you picked the ${SOURCES.find((s) => s.id === source)!.label.slice(3)} export.`)
      else setPlan(p)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  const counts = plan
    ? (Object.entries(
        plan.pages.reduce<Record<string, number>>((n, p) => ({ ...n, [p.type]: (n[p.type] ?? 0) + 1 }), {}),
      ) as [EntityType, number][])
    : []

  return (
    <section>
      <h2>
        📥 Import pages <Help topic="importPages" />
      </h2>
      {!plan ? (
        <div className="import-sources">
          {SOURCES.map((s) => (
            <div key={s.id} className="row wrap">
              <label className="button">
                {s.label}
                <input type="file" hidden multiple accept={s.accept} onChange={(e) => (read(s.id, e.target.files), (e.target.value = ''))} />
              </label>
              {s.folder && (
                <label className="button">
                  📁 Pick a folder
                  <input
                    type="file"
                    hidden
                    multiple
                    // Folder picking: supported by every current browser, though not in React's types.
                    {...({ webkitdirectory: '' } as object)}
                    onChange={(e) => (read(s.id, e.target.files), (e.target.value = ''))}
                  />
                </label>
              )}
              <span className="muted small">{s.hint}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <p>
            Found <strong>{plan.pages.length}</strong> pages from {plan.source}:{' '}
            {counts.map(([t, n]) => `${n} ${(n === 1 ? ENTITY_LABELS[t].one : ENTITY_LABELS[t].many).toLowerCase()}`).join(', ')}.
            {plan.skipped > 0 && <span className="muted"> {plan.skipped} other files were skipped.</span>}
          </p>
          <p className="muted small">Everything comes in 🔒 GM only. The type of each page is a guess; change any page’s type when you edit it.</p>
          <label className="inline-check small">
            <input type="checkbox" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} />
            Skip pages with the same name as one already in this world
          </label>
          <div className="row">
            <button
              className="primary"
              disabled={!!busy}
              onClick={async () => {
                setBusy('Importing…')
                try {
                  const n = await applyImport(worldId, plan, skipExisting)
                  setDone(`✓ Added ${n} page${n === 1 ? '' : 's'}.`)
                  setPlan(undefined)
                } catch (e) {
                  setError((e as Error).message)
                } finally {
                  setBusy('')
                }
              }}
            >
              Import {plan.pages.length} pages
            </button>
            <button onClick={() => setPlan(undefined)}>Cancel</button>
          </div>
        </div>
      )}
      {busy && <p className="muted small">{busy}</p>}
      {done && <p className="small">{done}</p>}
      {error && <p className="error small">{error}</p>}
      <h3>
        📤 Export as Markdown <Help topic="exportMarkdown" />
      </h3>
      <button onClick={() => exportMarkdown(worldId)}>⬇ Download pages as Markdown (.zip)</button>
    </section>
  )
}
