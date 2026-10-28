# The Warded Atlas

GM-first TTRPG campaign/world manager. Owner (Brayden) is not a developer: explain changes in plain language and keep the app working end to end.

- Local-first: all data lives in IndexedDB (`src/db.ts`, Dexie). Any schema change needs a new `db.version(n)` with an upgrade, never an edit to an existing version.
- Visibility is the core rule: anything with `visibility: 'gm'`, `gmNotes`, or a `:::gm` block must never reach the player view. Exceptions are per player and decided on the server: `revealedTo` (user ids) on a page, and `:::for Name` passages (`player_text`), matched only against characters the player has claimed. Check `useViewMode().canSee` when adding screens.
- Players see worlds only through server functions (`shared_world`, `member_world`, both built on `player_view(wid, viewer)` in `supabase/migrations`); they never read `records` or `player_notes` directly. New GM-only fields must stay out of `player_view`.
- New features get a help tip: add a line to `HELP` in `src/help.tsx` and put `<Help topic="…" />` by the heading.
- Plain web addresses (`/w/<world-name>/p/<page-name>`, BrowserRouter, `base: '/'`); the desktop app and the old GitHub Pages copy keep HashRouter (`hashRouting` in `src/paths.ts`). Build in-app links with `worldPath`/`pagePath`/`typePath` from `src/paths.ts`, never by hand; old `#/` and long-id addresses must keep working.
- AI features live in `src/ai/`: transcription (on-device Whisper in a worker, or AssemblyAI) and recaps (Claude). API keys are device-only (localStorage), never synced or backed up. Transcripts and recap drafts are GM-only. Other AI ideas are parked; see `docs/ROADMAP.md`.
- The Vael Ardith example world is Markdown in `worlds/vael-ardith/` (one file per page, session and board; file name = key), read by `src/example/parse.ts` and checked (with the map pins in `src/example/maps/`) by `npm run check` and on every build. Brayden edits these by hand (guide: `docs/EDITING.md`), so keep the format stable and update the guide and `worlds/vael-ardith/README.md` if it changes. Raise `version:` in `world.md` when its content changes.
- Before pushing: `npm run lint && npm run build`.
