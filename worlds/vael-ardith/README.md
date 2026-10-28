# Vael Ardith: cheat sheet

This folder **is** the Vael Ardith example world. Every page in the app is one file here.
The full step-by-step guide is [docs/EDITING.md](../../docs/EDITING.md).

## Where things are

| To change… | Look in |
| --- | --- |
| The world's name, blurb, calendar, moons, history ages, safety tools, party coin | `world.md` |
| Player characters and NPCs | `people/` |
| Continents, nations, towns, taverns, shops, dungeons | `places/` |
| Factions and companies | `factions/` |
| Gods, ancestries, magic, the wards | `lore/` |
| History on the timeline | `history/` |
| Items | `items/` |
| Random tables | `tables/` |
| Quests, loose threads, handouts, endings, campaign events | `campaign/` |
| The eight sessions (notes, prep, encounters, Lectern) | `sessions/` |
| The corkboard | `boards/` |
| The GM's "Start here" page | `guides/` |
| Page templates | `templates/` |

Can't find a page? Search for its name across the folder (Mac: Cmd+Shift+F in VS Code, Windows: Ctrl+Shift+F).
The folders are only for tidiness: a page works in any folder.

## A page file

```
---
type: npc
name: Fennick Bottlebrook
players: true
summary: Halfling quartermaster of the Ninth Lantern.
parent: lantern-keep
tags: [ npc, ninth-lantern, halfling ]
---

The page text, in Markdown. Link other pages by name: [[Cinderford]].

:::gm
Only the GM sees this passage.
:::

== GM notes ==

Notes players never see.
```

- The **file name is the page's key** (`fennick.md` is `fennick`). Other files point at pages by key: `parent`, `relations`, `heldBy`, session `pages`, board cards.
- Text links use the page's **name** instead: `[[Fennick Bottlebrook]]`, or `[[Fennick Bottlebrook|the quartermaster]]`.
- Pages are **GM only** unless they say `players: true`.
- `type` is one of: location, npc, pc, faction, item, event, quest, shop, deity, lore, thread, table, custom.

## The five rules that stop mistakes

1. The settings sit between the two `---` lines, one per line, as `setting: value`.
2. Indent with **spaces**, never tabs.
3. If a value has **a colon and a space** in it (`summary: Wanted: Dannic Rook`), put the whole value in "double quotes".
4. If a value has a `#` in it, put it in quotes too, or everything from the `#` on is dropped.
5. File names: small letters, numbers and dashes only (`old-mill.md`). Renaming a file changes its key, so update anything that points at it.

## Before you commit

Open the Terminal in VS Code and run:

```
npm run check
```

It lists every mistake with the file and line. **ERROR** must be fixed (the site won't build). **warning** is worth a look.

To see your edits in the app: `npm run dev`, open http://localhost:5173, and in Vael Ardith's World settings press **Reset the example world**.

When the change is ready for everyone, raise `version:` at the top of `world.md` by one. Anyone with an older copy is then offered the new one.
