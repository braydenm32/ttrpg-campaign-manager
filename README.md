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
- **Secrets for particular players.** In a world your players have joined, a GM-only page can be revealed to just the players you tick ("🤫 Reveal just to"). A passage can be meant for certain characters only, by first or full name:

  ```
  :::for Wren and Silas
  The letter in your pack is a forgery.
  :::
  ```

  Separate names with commas, "&" or "and". A short one fits on one line: `:::for Silas::: You recognise the crest. :::` (the same works for `:::gm::: ... :::`). The "🔒 GM-only passage" and "🤫 Secret for…" buttons under the text box write these for you, and character names are suggested as you type. Only the players of those characters ever receive the passage; everyone else's copy never contains it.
- **Interactive maps.** Upload any map image, drop pins or draw regions, and link them to pages. Clicking a pin shows the place, who and what is there, and an "Enter" button to open a more detailed map (region → city → building).
- **Timeline.** History (before the campaign) and in-campaign events, filterable by place.
- **Sessions.** GM notes and a separate player recap. You can record audio from one microphone for in-person games, or from the microphone plus your Discord or Zoom audio for online games. While recording, you can add timestamped bookmarks, and clicking one later jumps the playback to that moment.
- **Transcripts and recaps.** Turn a recording into text either on your own device (free and private, slower, no speaker names) or in the cloud with AssemblyAI (faster, tells speakers apart, needs your own key). Click any line to hear it, search it, and name the speakers. Then have Claude draft a GM summary and a player recap: either "Copy for Claude" and paste it into claude.ai (free with a Claude subscription), or "Write it now" with your own Anthropic API key. You check and edit both drafts before anything is saved. Keys are kept on the device only, set under World settings → AI tools.
- **The Lectern.** One screen for running a session at the table: where the party is, who's present (with their GM notes), an initiative tracker with hit points and conditions, a dice roller (`2d6+3`, advantage, `4d6kh3`), quick notes that land in the session log, and NPC, tavern and shop generators. Open it from any session with "📖 Run at the Lectern".
- **Loose threads.** A board of every hook, mystery, promise and grudge: dangling, in play, tied off or dropped. Threads link to the NPCs and places they involve, remember which session raised and resolved them, and warn you when one hasn't moved in three sessions. They also show up in the Lectern (the ones touching the current scene first), on session pages and on the overview. Reveal a thread and players see it under "Leads".
- **Generators.** Taverns (menu, patrons, rumours), shops (blacksmith, general store, alchemist, magic shop) and NPCs, saved into your world in one click.
- **Assets.** A library for handouts, portraits, maps, audio and PDFs.
- **Help tips.** A small ? next to each feature explains it. Hover or tap to read; turn them off (and back on) in World settings.
- **Player view.** Switch "Viewing as" to Player to see exactly what players would see.
- **Map builder.** Draw maps in the app: paint land, forest, mountains and water, add roads, rivers, rooms, symbols, labels and a square or hex grid.
- **Cloud sync (optional).** Sign in and turn on sync for a world to keep it backed up and in step across your devices, with changes appearing within seconds.
- **Player share links.** A read-only link to the revealed parts of a world. Everything GM-only is removed on the server before it's sent, and the link updates live as you work.
- **Players.** Invite your players with a link from World settings. They sign in, join, and see everything you've revealed (GM-only content is removed on the server), kept up to date as you sync. Each player can claim their player character and keep their own notes on it, which you can read on the character's page. You can see who plays whom, release a character, or remove a player.
- **Player notes and the scratchpad.** On every page they can see, players keep private notes (only them) and group notes (the whole party edits them together). The 📝 Scratchpad is the same for notes that aren't about any one page. You can read the group notes, never the private ones.
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
