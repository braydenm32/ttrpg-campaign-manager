# Roadmap

The order of these items is a starting point and will change as we see what matters at the table.

## Next up

- **Players join a campaign**, similar to D&D Beyond: invite links, player accounts, per-player reveals ("only Wren knows this"), and player journals.
- **Map builder extras:** draw on top of an uploaded map, merge adjoining rooms, more symbols, custom colours.
- **Fog of war / reveal areas** on maps for the player view.
- **Rich text editor** with `@`-mention autocomplete for links.
- **Lectern extras:** a players' screen (show a handout or the current scene to the table), timers, and system-specific initiative rules once game systems arrive.
- **Faction clocks** (progress clocks for villains' plans, tied to loose threads) and a **safety tools record** (lines and veils).
- **Custom calendars** (Harptos, Golarion and others) for the timeline.
- **Relationship graph** between NPCs and factions.
- **Mobile apps** (iOS and Android) built from the Tauri project.
- **Saving recordings in chunks**, so a crash or closed tab never loses a long session.
- **Imports and exports:** Markdown/Obsidian, Kanka, World Anvil, and Foundry VTT journals and pins.

## Game systems (later)

The core stays system-agnostic: stats are free-form "Details" fields. Later we'll add system packs (D&D 5e, PF2e, Starfinder, Call of Cthulhu 7e, Daggerheart) with stat block templates, character sheets and initiative rules.

## AI features (parked until the core is solid)

Each of these needs an AI provider (for example Claude for text, plus a speech-to-text service):

- Transcribing session recordings, with labels for who is speaking (in person and online)
- Recap generation: a GM version and a player-safe version
- Suggested updates to pages from a transcript (new NPCs, places, items, quest progress), approved by the GM
- AI flavour for generators, and improvised NPC dialogue in character
- "Ask your world": chat that answers only from your own notes
- A continuity checker that flags contradictions
- A prep helper that gathers the relevant NPCs, hooks and secrets for next session
- Reading recaps aloud ("Previously on…")
- Portrait and location art generation
- Spotlight stats (who got screen time), from transcripts
