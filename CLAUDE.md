# Campaign Codex

GM-first TTRPG campaign/world manager. Owner (Brayden) is not a developer: explain changes in plain language and keep the app working end to end.

- Local-first: all data lives in IndexedDB (`src/db.ts`, Dexie). Any schema change needs a new `db.version(n)` with an upgrade, never an edit to an existing version.
- Visibility is the core rule: anything with `visibility: 'gm'`, `gmNotes`, or a `:::gm` block must never reach the player view. Check `useViewMode().canSee` when adding screens.
- HashRouter + `base: './'` so the same build works on GitHub Pages and in Tauri.
- AI features are deliberately parked; see `docs/ROADMAP.md`.
- Before pushing: `npm run lint && npm run build`.
