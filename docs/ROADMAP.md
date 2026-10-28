# Roadmap

The order of these items is a starting point and will change as we see what matters at the table.

## Recently built

- Random tables, page history and recently deleted pages, page templates and custom page types, party loot and coin purse, co-GMs, and session scheduling.
- Preview as one player, session prep sheets (strong start, scenes, secrets and clues), encounters that load into the Lectern, character status (alive, dead, missing, captured) with "last seen", printing and PDFs, a soundboard (your own files and Syrinscape), corkboards, and private questions from players to the GM.
- Fog of war on maps, "show to players" with a players' screen for a TV, custom calendars (Harptos, Golarion, Eberron, Greyhawk, Exandria or your own) with today's date in the world, a relationship web and family trees, progress clocks, players editing their own character, link previews on hover, Discord posts, safety tools (lines, veils, anonymous X-card), and importing from Obsidian, Kanka and World Anvil (plus Markdown export).

- From the October review: a recently deleted bin, `.codex.zip` backups, search everywhere (Ctrl/⌘K), a folding phone menu, pictures inside text, GM-only details and tags, nicknames and rename-safe links, hidden campaigns, "what's new" for players, backup reminders and a tidy public wiki.
- Round two: handouts and "reveal and show", an end-of-session checklist that starts the next session where you left off (leftover clues and scenes carry over), a player home page, recordings that save as they go and survive a crash, the party per campaign, "track as thread" on quests, a grouped menu and settings tabs, time zones for session dates, group notes that can't overwrite each other, private live channels, and a keep-alive for the free cloud.

## Next up

- **The players' screen** (name still to pick): one screen for players during play, with what the GM is showing, their character in short, the party, leads and clocks, party notes with GM replies, the last recap and loot, plus a tab for each on its own.

- **Players, next steps:** invite links, claiming a character, per-player reveals (pages and `:::for` passages), and private or group notes plus a party scratchpad are built. Still to come: per-player map pins, and the GM replying in the group notes.
- **Map builder, Dungeondraft-style (in stages):**
  - Stage 1 (built): classic hand-inked world maps. Paint land and sea, automatic ragged coastlines, rivers, roads and borders, a library of hand-drawn pieces (mountains, forests, towns, ships, compass roses) with 8 previewable versions each, a click-and-hold scatter brush, curved labels, layers to hide or lock, three looks (ink on parchment, ink on white, coloured) and biome tints.
  - Battle maps (built): the same hand-drawn style seen from above on a 5 ft grid. Paint the ground (grass, dirt, sand, rocky ground, mud, snow, paving, water) with soft uneven edges and inked banks, fences, hedges, stone walls and cliff edges, and 39 top-down pieces (trees, plants, rocks, camp gear, village things, buildings, bridges) with 8 versions of each made thing.
  - Stage 2 (built): a searchable piece browser with recently used pieces, turning pieces (by hand, with R, or at random) with shadows that still fall the right way, a scatter brush that mixes several pieces, and pieces that link to a page and work like pins on the map, following the usual GM-only, reveal and fog rules.
  - Stage 3 (built): dungeons. A Rooms tool for rooms, round rooms, passages and caves that join up with their walls drawn on their own (and Fill in to put rock back), dug out of solid rock hatched like an old hand-drawn dungeon map, or standing on the ground as buildings and ruins. Doors that fit themselves to the grid and leave a gap in the wall, inner walls, smooth stone and wooden floors that can stop at the walls, and dungeon pieces (doors, stairs, pillars, pits, altars, coffins, braziers and more).
  - Stage 4 (built): one hand-drawn style only (old flat-colour maps redraw themselves in it), two kinds of map ("World, region or city" and "Dungeon, building or battle map", each Small, Medium or Large), and town maps seen from above at true scale: ground painting, a coastline brush, streets and rivers at a chosen width with their own edges, town walls with towers that close into a loop and gatehouses that snap into them, the battle-map pieces, and 12 new town pieces with 8 versions each (blocks of houses, manor, guildhall, market square, castle, cathedral, gatehouse, wall tower, pier, ship, moored boats, farm fields). Buildings square themselves to the nearest street and keep off it when scattered.
  - Stage 5: export as PNG and Universal VTT (.dd2vtt) with walls and lights for Foundry and Roll20.
  - Later: an optional side-view look for cities (little pictorial houses), and marks only the GM sees on a drawn map (secret doors, traps), with players getting a picture without them.
  - Later: lighting, editing on phones, drawing on top of an uploaded map, custom colours.
- **Rich text editor** with `@`-mention autocomplete for links.
- **Lectern extras:** timers, and system-specific initiative rules once game systems arrive.
- **Calendar extras:** leap years and festivals that don't count as months, and moons that line up with published dates.
- **Mobile apps** (iOS and Android) built from the Tauri project.
- **Imports and exports:** Foundry VTT journals and pins (Obsidian, Kanka and World Anvil imports are built).

## Parked (from the October review)

Ideas we looked at and chose to leave for later:

- **Lectern and sessions:** stat blocks in the combat list (with the game-system packs), a "party is here" marker on maps, player notes on sessions.
- **Players:** making their own character (with a portrait) for the GM to approve, one writing box on a player's own character instead of three, hiding empty sections from players' menus, page links you can copy for players, "what's new" also flagging recaps and pages that changed.
- **Secrets (low risk):** a warning when a `:::for` first name matches two characters, and "recently updated" not hinting at secret edits.
- **Bigger choices:** pages that belong to a campaign (we filter the party instead), merging quests and loose threads, desktop polish (saving files on a Mac, auto-updates) and the phone apps.
- **Behind the scenes:** transcripts in their own table, smarter sync that only looks at changed rows, and storage limits per user before anyone pays.

## Game systems (later)

The core stays system-agnostic: stats are free-form "Details" fields. Later we'll add system packs (D&D 5e, PF2e, Starfinder, Call of Cthulhu 7e, Daggerheart) with stat block templates, character sheets and initiative rules.

## AI features

Built: session transcripts (on-device with Whisper, or AssemblyAI in the cloud with speaker labels) and recaps (GM summary plus player recap, via "Copy for Claude" or the GM's own Anthropic API key, always reviewed before saving).

Built: world updates from a session. In the same Claude run as the recap, Claude compares the transcript with every page (names, nicknames, one-line summaries, quest states and timeline dates) and suggests new pages for anything improvised, lines for existing pages, quest progress, relationships, timeline events, deaths and captures, loot changing hands, loose threads and things that contradict the notes. The GM ticks and edits them, then applies them in one go; each change is listed in the Chronicle (per session, GM-only) and kept in page history. Pages also show the sessions that link them and, for the GM, where their name was heard in a transcript (click to play that moment). Speaker names are remembered from the last session.

Still parked (each needs an AI provider):

- Speaker names for on-device transcripts
- A whole-world continuity check (per-session contradictions are already part of world updates)
- AI flavour for generators, and improvised NPC dialogue in character
- "Ask your world": chat that answers only from your own notes
- A continuity checker that flags contradictions
- A prep helper that gathers the relevant NPCs, hooks and secrets for next session
- Reading recaps aloud ("Previously on…")
- Portrait and location art generation
- Spotlight stats (who got screen time), from transcripts
