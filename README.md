# ⚔️ Campaign Codex

A GM-first campaign and world manager for tabletop RPGs: D&D, Pathfinder, Starfinder, Call of Cthulhu, Daggerheart and anything else. Build your world, click around your maps, track NPCs and sessions, and show players only what you've revealed.

Runs in the browser, installs as an offline web app, and packages as a desktop app (Windows, macOS, Linux). Phone apps can be built from the same code later.

## What it does today

- **Worlds and campaigns.** One world can host several campaigns.
- **Codex.** Pages for locations, NPCs, player characters, factions, items, events, quests, shops and taverns, deities and lore. Link pages by writing `[[Name]]`. Every page shows what's inside it (NPCs, shops and events in a town) and which pages mention it.
- **GM secrets.** Every page, pin, map and session is either 🔒 GM only or 👁 revealed. You can also hide one passage inside a page:

  ```
  :::gm
  The innkeeper is a spy.
  :::
  ```

  GM notes on a page are never shown to players.
- **Interactive maps.** Upload any map image, drop pins or draw regions, and link them to pages. Clicking a pin shows the place, who and what is there, and an "Enter" button to open a more detailed map (region → city → building).
- **Timeline.** History (before the campaign) and in-campaign events, filterable by place.
- **Sessions.** GM notes and a separate player recap. You can record audio from one microphone for in-person games, or from the microphone plus your Discord or Zoom audio for online games. While recording, you can add timestamped bookmarks, and clicking one later jumps the playback to that moment.
- **The Lectern.** One screen for running a session at the table: where the party is, who's present (with their GM notes), an initiative tracker with hit points and conditions, a dice roller (`2d6+3`, advantage, `4d6kh3`), quick notes that land in the session log, and NPC, tavern and shop generators. Open it from any session with "📖 Run at the Lectern".
- **Loose threads.** A board of every hook, mystery, promise and grudge: dangling, in play, tied off or dropped. Threads link to the NPCs and places they involve, remember which session raised and resolved them, and warn you when one hasn't moved in three sessions. They also show up in the Lectern (the ones touching the current scene first), on session pages and on the overview. Reveal a thread and players see it under "Leads".
- **Generators.** Taverns (menu, patrons, rumours), shops (blacksmith, general store, alchemist, magic shop) and NPCs, saved into your world in one click.
- **Assets.** A library for handouts, portraits, maps, audio and PDFs.
- **Player view.** Switch "Viewing as" to Player to see exactly what players would see.
- **Map builder.** Draw maps in the app: paint land, forest, mountains and water, add roads, rivers, rooms, symbols, labels and a square or hex grid.
- **Cloud sync (optional).** Sign in and turn on sync for a world to keep it backed up and in step across your devices, with changes appearing within seconds.
- **Player share links.** A read-only link to the revealed parts of a world. Everything GM-only is removed on the server before it's sent, and the link updates live as you work.
- **Backups.** Download a whole world as one file and import it on another device.

Everything is stored on your device first, so it works with no internet. Sync catches up when you're back online.

## Using it

- **Web:** once GitHub Pages is switched on, the app lives at `https://braydenm32.github.io/ttrpg-campaign-manager/`. In Chrome or Edge, use "Install app" in the address bar to get a desktop-style app that works offline.
- **Desktop installers:** open the **Actions** tab, choose **Desktop**, then **Run workflow**. About 15 minutes later, a draft release with Windows, macOS and Linux installers appears under **Releases**. These installers are unsigned, so Windows and macOS will warn you the first time you open them.

## For developers

You'll need Node 22 or newer. The desktop app also needs Rust and the [Tauri prerequisites](https://tauri.app/start/prerequisites/).

```bash
npm install
npm run dev        # web app at http://localhost:5173
npm run desktop    # desktop app window (needs Rust)
npm run build      # production web build in dist/
npm run lint
```

| Piece | Choice |
|---|---|
| UI | React 19 + TypeScript, Vite |
| Storage | IndexedDB via Dexie (local-first) |
| Maps | Leaflet (`CRS.Simple` over an uploaded image) |
| Text | Markdown (marked + DOMPurify) with `[[wiki links]]` |
| Desktop / mobile | Tauri 2 (`src-tauri/`) |
| Web hosting | GitHub Pages, with a PWA service worker for offline use |
| Cloud | Supabase (Postgres + row-level security, Storage, Realtime, one edge function). Schema in `supabase/` |

Main files: `src/db.ts` (data model), `src/pages/` (screens), `src/Markdown.tsx` (links and secrets), `src/generators.ts` (random tables), `src/recorder.ts` (session audio), `src/sample.ts` (sample world), `src/mapDrawing.ts` + `src/pages/MapBuilder.tsx` (map builder), `src/cloud/` (sign-in, sync, share links), `src/pages/Lectern.tsx` + `src/dice.ts` (the Lectern), `src/pages/Threads.tsx` + `src/threads.ts` (loose threads).
