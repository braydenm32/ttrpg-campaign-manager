# Editing The Warded Atlas yourself

A step-by-step guide to changing the app's files on your own computer, mainly the Vael Ardith example world, including working with no internet and sending the changes up later.

The one-page version for Vael Ardith is [worlds/vael-ardith/README.md](../worlds/vael-ardith/README.md).

**Contents**

1. [How it fits together](#1-how-it-fits-together)
2. [One-time setup](#2-one-time-setup) (Mac, Windows, iPhone or iPad)
3. [The routine: edit offline, send later](#3-the-routine-edit-offline-send-later)
4. [Where Vael Ardith lives](#4-where-vael-ardith-lives)
5. [How a page file works](#5-how-a-page-file-works)
6. [Recipes](#6-recipes): fix text, add a page, secrets, links, timeline, sessions and quests, tables, pictures, maps
7. [Checking and previewing your work](#7-checking-and-previewing-your-work)
8. [Getting it to everyone](#8-getting-it-to-everyone)
9. [When something goes wrong](#9-when-something-goes-wrong)
10. [The rest of the app](#10-the-rest-of-the-app): what each folder does, and small safe edits

---

## 1. How it fits together

A few words you'll see everywhere:

- **Repository (repo):** the app's files. The main copy lives on GitHub at `braydenm32/ttrpg-campaign-manager`. You keep your own full copy on your computer or iPad.
- **Commit:** a saved, labelled snapshot of your changes ("Fix Fennick's summary"). Committing works with **no internet**: it's saved on your device.
- **Push:** send your commits up to GitHub. Needs internet. Until you push, nobody else sees your changes, and nothing is lost if you don't.
- **Pull** (or **fetch**): bring down changes made elsewhere (for example by Claude) so your copy is up to date.
- **Branch:** a separate line of work. `main` is what the live site runs. You make your edits on your own branch, so a half-finished edit can never reach the live site.
- **Pull request (PR):** on GitHub, a request to bring a branch into `main`. GitHub checks that the app still builds, then you press **Merge**.
- **Cloudflare:** builds `main` and puts it live at wardedatlas.com, a few minutes after each merge.

So the journey of an edit is:

```
edit files  →  commit (offline is fine)  →  push (online)  →  pull request  →  checks pass  →  merge  →  live in a few minutes
```

Nothing you do on your own branch can break the live site. The worst case is a pull request with a red ✗, which you fix and push again.

### Two ways to change Vael Ardith

- **In the app** (wardedatlas.com or the desktop app): open Vael Ardith and edit pages like any world. This changes **only your own copy**, works offline, needs no setup, and nobody else sees it. Good for running the campaign at your table. A **Reset the example world** in World settings throws those changes away, so download a backup first if you want to keep them.
- **In the repo** (this guide): changes the example **itself**, the one everyone gets when they open Vael Ardith from Home, including you after a reset. Good for improving the example for everyone.

Changes made in the app don't flow back into the repo files by themselves. If you've written something in the app that belongs in the example, copy the text into the matching file here.

---

## 2. One-time setup

Do this once, **while you have internet**. After that you can edit offline as long as you like.

### Mac (main setup)

You need three free apps.

1. **GitHub Desktop**: https://desktop.github.com. Install it, open it and sign in with your GitHub account (`braydenm32`).
2. **Visual Studio Code** (VS Code), the editor: https://code.visualstudio.com. Download, unzip, and drag it into Applications.
3. **Node.js**, which runs the checker and the app on your Mac: https://nodejs.org. Download the button marked **LTS** and run the installer.

Then get your copy of the repo:

4. In GitHub Desktop: **File → Clone Repository…**, pick `braydenm32/ttrpg-campaign-manager`, and choose where to keep it (for example `Documents/GitHub`). Press **Clone**.
5. Still in GitHub Desktop: **Repository → Open in Visual Studio Code**. (If it asks which editor, choose Visual Studio Code in GitHub Desktop's Settings → Integrations.)
6. In VS Code: **Terminal → New Terminal**. A panel opens at the bottom. Type this and press Return:

   ```
   npm install
   ```

   It downloads what the app needs (a few minutes the first time). This is the only step besides pushing that needs internet.

7. Check it all works: in the same Terminal type `npm run check`. You should see **✓ All good.**

Helpful VS Code extras (optional): the **YAML** extension by Red Hat colours the settings at the top of each file and underlines mistakes as you type. Install it from the Extensions icon on the left (four squares).

### Windows

Exactly the same as the Mac, with these differences:

- GitHub Desktop and VS Code install with normal installers from the same websites. Node.js: the **LTS** `.msi` installer from nodejs.org. Keep the default options.
- Keyboard shortcuts use **Ctrl** where the Mac uses **Cmd**.
- After installing Node.js, close and reopen VS Code before running `npm install`, so it can find it.
- If Windows asks whether to allow Node.js through the firewall when you preview the app, **Allow** on private networks is fine.

### iPhone or iPad (Working Copy)

Good for reading and editing page text on the go. You can't run the checker or preview the app on an iPhone, so check on your Mac afterwards or let the pull request check it.

1. Install **Working Copy** from the App Store. It's free to clone and edit, but **pushing needs the one-time Pro unlock** (about US$25).
2. Open it, tap **+ → Clone repository**, sign in to GitHub and pick `ttrpg-campaign-manager`.
3. Browse to `worlds/vael-ardith/`, tap a file and edit it in Working Copy's own editor.
4. Commit (tap the repo name, then **Commit**). This works offline. Push when you're back online.
5. Make your branch first, as in step 3 of the routine below: tap the branch name at the top of the repo (`main`) and create a new branch.

Without Pro, you can still make small edits straight on github.com in Safari (open the file, tap the pencil). That needs internet.

---

## 3. The routine: edit offline, send later

### Before you lose internet

1. Open **GitHub Desktop**. Make sure the **Current Repository** is `ttrpg-campaign-manager`.
2. Switch to `main` (the **Current Branch** button), then press **Fetch origin** and, if it appears, **Pull origin**. Your copy now matches the live site.
3. Make your own branch: **Current Branch → New Branch**, name it something like `vael-edits-march`, press **Create Branch**. Make sure it's based on `main`.

### While offline

4. Edit files in VS Code (see sections 4 to 6). Save with Cmd+S.
5. Run `npm run check` in the VS Code Terminal and fix anything marked ERROR.
6. Optional: preview in the app (section 7).
7. Commit in GitHub Desktop: the left side lists the files you changed (tick the ones to include). At the bottom left, write a short summary like "Add the ferryman's daughter" and press **Commit to vael-edits-march**. Commit as often as you like: each is a checkpoint you can go back to.

### Back online

8. In GitHub Desktop press **Publish branch** (the first time) or **Push origin** (after that).
9. Press **Create Pull Request** (or **Preview Pull Request**, then Create). It opens GitHub in your browser. Give it a title and press **Create pull request**.
10. Wait for the checks at the bottom of the pull request (a minute or two). A green ✓ means it builds. A red ✗ means something needs fixing: see [section 9](#9-when-something-goes-wrong).
11. Press **Merge pull request**, then **Confirm merge**. Cloudflare puts it live within a few minutes.
12. Back in GitHub Desktop: switch to `main` and **Pull origin**, ready for next time. You can delete the old branch (**Branch → Delete…**).

**If you were offline a long time:** Claude may have changed things on `main` meanwhile. Before step 8, do **Branch → Update from main** in GitHub Desktop. If two people changed the same lines it will say there's a conflict; see [section 9](#9-when-something-goes-wrong).

---

## 4. Where Vael Ardith lives

Everything is in the folder **`worlds/vael-ardith/`**. Each page in the app is one file there.

| To change… | Edit |
| --- | --- |
| The world's name, the blurb on its book, the game system | `world.md` |
| The calendar (months, weekdays, moons, holidays, today's date), the history ages on the timeline | `world.md` |
| Safety tools (lines, veils, X-card) and the party's starting coin | `world.md` |
| The campaign's name and description | `world.md` |
| Player characters and NPCs | `people/` (PCs: `varra.md`, `ysse.md`, `borrin.md`, `tick.md`, `quorl.md`) |
| The continent, nations, regions, towns, buildings, taverns, shops, dungeons | `places/` |
| Factions, companies, guilds | `factions/` |
| Gods (`god-…`), ancestries (`people-…`), magic and the wards (`lore-…`) | `lore/` |
| Timeline events before the campaign | `history/` |
| Items, treasure, clues | `items/` |
| Random tables | `tables/` |
| Quests | `campaign/quests/` |
| Loose threads | `campaign/threads/` |
| Handouts | `campaign/handouts/` |
| The three endings | `campaign/endings/` |
| Events that happen during play | `campaign/events/` |
| Sessions 1 to 8: GM notes, recap, prep, encounters, the Lectern | `sessions/session-1.md` … `session-8.md` |
| The corkboard ("Who's poisoning the flame?") | `boards/` |
| The GM's "Start here" tour, the GM's chapter and the Player's Guide | `guides/guide-start.md`, `guide-running.md`, `guide-players.md` |
| Page templates | `templates/` |

**Finding a page:** in VS Code press **Cmd+Shift+F** (Windows Ctrl+Shift+F) and type the page's name. Or **Cmd+P** and type part of the file name.

The folders are only for tidiness. The app reads every `.md` file in `worlds/vael-ardith/` (except this README), so a page works wherever it sits.

**Not in this folder:** the pictures (drawn by code in `src/example/art/`) and the maps (built in code in `src/example/maps/`). See [Pictures](#6h-pictures) and [Maps](#6i-maps).

---

## 5. How a page file works

A page file has two parts: **settings** at the top, between two lines of three dashes, and then the **text**.

```
---
type: npc
name: Fennick Bottlebrook
players: true
summary: Halfling quartermaster of the Ninth Lantern.
parent: lantern-keep
tags: [ npc, ninth-lantern, halfling ]
image: sil:fennick
status: alive
statusKnown: true
fields:
  Ancestry: Halfling
  Role: Quartermaster
gmFields:
  5e: AC 12, HP 9
relations:
  - to: f-ninth-lantern
    kind: serves
    known: true
---

The page text, in Markdown: **bold**, *italic*, ### headings, - lists.
Link other pages by name: [[Cinderford]].

== GM notes ==

The GM notes box. Players never see it.
```

### The key

The **file name is the page's key**: `people/fennick.md` is the page `fennick`. Keys are how files point at each other (`parent: lantern-keep`). They never show in the app, so they can be short. Use small letters, numbers and dashes only.

**Renaming a file changes its key**, so everything pointing at the old key has to change too, including the pins on the maps in `src/example/maps/`. Search the whole project for the old key in quotes (Cmd+Shift+F, for example `'last-candle'`) and replace each one. `npm run check` lists anything you missed. Changing a page's `name:` is safe: only `[[links]]` use the name, and the checker warns about any that no longer match.

Text links are different: inside the text you link by the page's **name** (or one of its aliases), exactly as in the app: `[[Fennick Bottlebrook]]`.

### Every setting

Only `type` and `name` are required. Leave out anything you don't need.

| Setting | What it does | Example |
| --- | --- | --- |
| `type` | What kind of page: `location`, `npc`, `pc`, `faction`, `item`, `event`, `quest`, `shop`, `deity`, `lore`, `thread`, `table`, `custom` | `type: shop` |
| `name` | The page's title | `name: The Last Candle` |
| `players` | `true` reveals it to every player. Without it, the page is GM only | `players: true` |
| `summary` | The one-line description under the title | `summary: A tavern with one candle.` |
| `parent` | The page this one sits inside (a tavern in a town, an NPC in a tavern), by key | `parent: cinderford` |
| `aliases` | Other names `[[links]]` can use (GM only) | `aliases: [ The Captain, Ilse ]` |
| `tags` | Tags players can see (if the page is revealed) | `tags: [ tavern, cinderford ]` |
| `gmTags` | Tags only the GM sees | `gmTags: [ traitor ]` |
| `image` | The page's picture (see [Pictures](#6h-pictures)) | `image: sil:fennick` |
| `status` | `alive`, `dead`, `missing` or `captured` | `status: missing` |
| `statusKnown` | `true` if players know the status | `statusKnown: true` |
| `fields` | The fact box. One line each, indented two spaces | see above |
| `gmFields` | Fact-box lines only the GM sees (5e stats, secrets) | see above |
| `relations` | Ties to other pages (by key), for the relationship web. `known: true` means players know about it | see [links](#6d-links-and-relationships) |
| `clocks` | Progress clocks on the page | `- { name: The ward cracks, segments: 6, filled: 2 }` |
| `age` | Events: the part of history (an age key from `world.md`), or `campaign` | `age: ashen` |
| `when` | Events: the date, as day, month name, year | `when: 14 Ashfall 3011` |
| `date` | Events: the date in words, shown as written | `date: The night of the Battle of Cinders` |
| `order` | Events: the order within their age, smallest first | `order: 120` |
| `questStatus` | Quests: `open`, `active`, `done` or `failed` | `questStatus: active` |
| `threadStatus` | Loose threads: `open` (dangling), `active`, `resolved` or `dropped` | `threadStatus: open` |
| `threadUrgency` | Loose threads: `low`, `normal` or `high` | `threadUrgency: high` |
| `raisedIn` / `tiedOffIn` | Loose threads: the session number that raised or resolved it | `raisedIn: 1` |
| `heldBy` | Items: who has it, by key, or `party` | `heldBy: party` |
| `quantity` | Items: how many | `quantity: 3` |
| `template` | `true` makes it a page template rather than a page | `template: true` |

### Parts of the text

Lines like `== GM notes ==` start another part of the text:

| Part | Where | What it is |
| --- | --- | --- |
| *(the text before any part)* | every page | The page's main text |
| `== GM notes ==` | any page | The GM notes box |
| `== Entries ==` | random tables | One entry per line (see [tables](#6g-random-tables)) |

Sessions have their own parts (see [sessions](#6f-sessions-quests-loose-threads-and-the-corkboard)).

### Writing settings safely

The settings use a format called YAML. It's forgiving, with five traps:

1. **One setting per line**, written `setting: value`, with a space after the colon.
2. **Indent with spaces, never tabs.** Lines under `fields:` or `relations:` are indented two spaces. (VS Code does this for you.)
3. **A colon followed by a space inside a value needs quotes.** `name: Wanted: Dannic Rook` breaks; write `name: "Wanted: Dannic Rook"`. If the value itself has double quotes in it, use single quotes outside: `summary: 'He said "never".'`
4. **`#` starts a comment.** `summary: The #1 smuggler` loses everything from `#`. Put it in quotes. (The checker warns about this.)
5. **Lists** go in square brackets, `tags: [ one, two ]`, or one per line starting with `- `.

The page text below the settings is ordinary Markdown: none of these rules apply there.

---

## 6. Recipes

### 6a. Fix or rewrite a page's text

1. Find the file (Cmd+Shift+F and the page's name).
2. Change the text below the second `---`. Change the one-liner in `summary:`.
3. Save, `npm run check`, commit.

### 6b. Add a new page

The easiest way is to copy a page like the one you want.

1. In VS Code's file list, right-click a similar page (a tavern for a tavern, an NPC for an NPC) and choose **Copy**, then right-click the folder and **Paste**.
2. Right-click the copy, **Rename**, and give it a new key as its file name: `old-mill.md`. Small letters, numbers, dashes.
3. Change `name`, `summary`, `parent` and the rest, and write the text. Delete settings you don't need (`relations`, `gmFields`…).
4. Decide who sees it: keep `players: true` to reveal it, or delete that line to keep it GM only.
5. `npm run check`. It catches a repeated key, a `parent` that doesn't exist, and misspelt settings.

To start from nothing, a new NPC needs only:

```
---
type: npc
name: Old Hesk
parent: cinderford
---

A chandler who sells candles to the company on credit.
```

### 6c. Secrets: GM-only pages, passages and notes

From most hidden to least:

- **A whole page:** leave out `players: true`. The page is GM only.
- **GM notes:** anything under `== GM notes ==`. Never shown to players.
- **GM-only fact-box lines:** put them under `gmFields:` instead of `fields:`.
- **A passage inside the text:**

  ```
  :::gm
  Fennick has been selling the lamp oil.
  :::
  ```

  A short one fits on one line: `:::gm::: Fennick is lying. :::`
- **A passage for certain players' characters only**, by the character's first or full name:

  ```
  :::for Varra
  You recognise the brass on his tusks: Rust Choir.
  :::
  ```

  Several: `:::for Varra and Tick`. Only the players who have claimed those characters see it.
- **Who knows a relationship or status:** `known: true` on a relation, `statusKnown: true` on a page. Without them, only the GM sees them.

Every `:::gm` or `:::for` needs its closing `:::` line. If one is missing, everything after it stays hidden (so nothing leaks), and the checker warns you.

**Rumours.** Rumour lists are player-visible. Write the rumours plain and put the truth key in a `:::gm` block straight after the list ("Which are true: 1. … 2. …"). Never put a verdict in brackets inside the list.

### 6d. Links and relationships

- **In the text**, link by name: `[[Lantern Keep]]`, or with different words: `[[Lantern Keep|the Keep]]`. A link to a page that doesn't exist yet is allowed (it shows as a "no page yet" link), and the checker mentions it as a warning in case it's a typo.
- **"Located in"** is `parent:` with the key of the place.
- **Relationships** (for the relationship web) are a list under `relations:`, each pointing at a key:

  ```
  relations:
    - to: mirrel-vosk
      kind: drills under
      note: He knows more about her than he says.
      known: true
    - to: grashka
      kind: granddaughter of
  ```

  `kind` is the label on the line between them. `note` and `known` are optional. You only need to write a relationship on one of the two pages.
- **Aliases** let links find a page by other names: `aliases: [ The Captain, Old Marrow ]`.
- **Links and secrets.** A link from player text to a GM-only page shows players a locked name. Use it only for places they will find; otherwise write the name as plain text.

### 6e. The timeline: events, ages and dates

Timeline events are pages with `type: event`. History before the campaign is in `history/`, things that happen during play in `campaign/events/`.

```
---
type: event
name: The Ford Freezes
players: true
summary: For one night the Cinder freezes solid, in Ashfall.
parent: the-ford
age: ashen
when: 3 Ashfall 3010
date: 3 Ashfall 3010 AW
order: 415
---

What happened, in a paragraph or two.
```

- `age` picks the part of history. The ages and their keys are at the bottom of `world.md`: `myth`, `wards`, `crowns`, `imperial`, `ashen`. Use `campaign` for something that happens in play.
- `when` is the date on the world calendar, written day, month, year: `14 Ashfall 3011`. The months are Hollowfrost, Thawmere, Seedwake, Bloomtide, Greenreach, Highsun, Emberwane, Reaping, Ashfall, Leafrot, Frostcall, Longnight. Leave it out for myths and vague times.
- `date` is how the date reads on the page. Anything goes: "Late in the Age of Crowns".
- `order` sets the order within an age, smallest first. The existing events go up in tens, so there's room: to put one between `order: 410` and `order: 420`, use `415`.

**Adding an age:** in `world.md`, add another entry under `ages:` with its own `key`, `name`, `span` and `summary`. Ages show in the order they're listed.

**Changing the calendar or today's date:** `calendar:` in `world.md`. `today:` is the date the campaign starts. Moons have a `cycle` (days from full to full) and an `offset` that shifts which day they're full; the notes beside them say what they're set to.

**Adding a holiday or festival:** under `holidays:` in the `calendar:` part of `world.md`, add a line like `- { name: Doorsnight, day: 1 Leafrot }` (a day and a month, no year). It comes round every year and shows beside that date on the calendar. Write about it on its own page too if it needs more than a name.

### 6f. Sessions, quests, loose threads and the corkboard

**Sessions** are `sessions/session-1.md` to `session-8.md`:

```
---
number: 2
title: The Glass Under the Ford
players: true
worldDate: 15 Ashfall 3011
pages: [ glass-barrow, the-ford, dannic-rook ]
encounters:
  - name: Glassers at the sluice
    notes: They'd rather talk than fight.
    foes:
      - { name: Glasser, count: 3, hp: 11, ac: 12, side: foe }
      - { name: Kettle Brindlewake, count: 1, side: ally, page: kettle }
lectern:
  scene: glass-barrow
  present: [ kettle ]
---

The GM's notes for the session (the main text).

== Recap ==

What the players read afterwards.

== Strong start ==

How the session opens.

== Scenes ==

- One scene per line.
- Another scene.

== Clues ==

- One clue per line.

== Lectern ==

What the Lectern shows as the current scene.
```

- `players: true` means the session has been played and players can see it (and its recap).
- `pages` are the pages involved, by key.
- Each foe needs a `name`, a `count` and a `side` (`foe`, `ally` or `pc`). `hp`, `ac` and `page` (the foe's page, by key) are optional. `ac` can be a number or text like `"15 (chain)"`.
- Leave out any part you don't use.

The session notes follow one pattern, so a GM always knows where to look. Keep it when you edit or add a session:
- A short header (level, date, sky, weather, *Touch these*, *In between*, *Level-up*, *If the party…*), then **Goal**.
- `### Running this session`: **Last time** (a recap to read aloud), **Where the PCs are**, **The party should have**, **If they missed something** (a way back in for each clue they could miss) and **The session at a glance** (the order of scenes and when they happen).
- One `### Scene` heading per scene. Each scene ends with **Development** (what happens next, with "if they do this, then that", and which scene comes next) and, when there's something to find, **Treasure**.
- Each fight's `notes` end with the party it was built for, like "Built for five level-2 PCs: medium".

**Quests** (`campaign/quests/`) are pages with `type: quest` and a `questStatus`. **Loose threads** (`campaign/threads/`) are pages with `type: thread`, a `threadStatus`, a `threadUrgency`, and `raisedIn` (the session number). Link them to the NPCs and places involved with `relations`.

**Handouts** (`campaign/handouts/`) are ordinary pages tagged `handout`. They show under Prep → Story → Handouts, ready to show players.

**The corkboard** (`boards/`) is a list of cards and the strings between them. Each card has its own short `key`, a position (`x` across, `y` down, in pixels) and either a `page` (by key) or a `text` note with a `color`. Strings join two cards by their card keys. It's easiest to move cards around in the app, then copy the numbers back.

### 6g. Random tables

A table is a page with `type: table`. The entries go under `== Entries ==`, one per line:

```
== Entries ==

- 3x A Ninth Lantern patrol of {1d4} soldiers.
- A caravan stuck in the ash. {Greywind Weather}
- {1d4} gaunt dogs trailing the party.
```

- `3x` at the start makes an entry three times as likely.
- `{1d4}` rolls dice inside the entry.
- `{Table Name}` rolls on another table by its name.

### 6h. Pictures

The example world's pictures aren't image files: they're drawn by code when the world loads, so they look hand-inked. The `image:` setting picks one:

| `image:` | Draws | Can I make a new one? |
| --- | --- | --- |
| `sil:<anything>` | A silhouette, shaped by the page's `Ancestry` and `Role` fields and its tags | **Yes**: any new name works, e.g. `sil:old-hesk` |
| `item:<anything>` | An item sketch, chosen by words in the name (sword, coin, letter, bottle, key, lantern, stone, map…) | **Yes**, if the name has one of those words: `item:silver-dagger` |
| `crest:…`, `holy:…`, `handout:…`, `cover` | Faction crests, holy symbols, handouts, the world cover | No: each is drawn by its own code. Reuse an existing one, or ask Claude for a new one |

### 6i. Maps

Vael Ardith's five maps are drawn by code when the world loads, one file each in `src/example/maps/`: `continent.ts`, `ashenreach.ts`, `cinderford.ts`, `lip-of-rent.ts` (a battle map) and `glass-barrow.ts` (the dungeon). The Shattered Coast's maps are in `src/sampleMap.ts`.

Most of each file is drawing code: ask Claude for changes to the land, buildings or labels. Each file has one block that starts like `export const CINDERFORD: ExMap = {`, holding the map's name, who can see it and its pins. Two small edits there are safe (search the file for `pins:` to find it):

- **Which page a pin opens.** `pins:` is a list, one pin per line:

  ```ts
  { page: 'the-ford', at: [1250, 800] },
  ```

  `page` is a page key, in single quotes. Change it to another key and keep the rest of the line as it is. `at` is the position in pixels from the top left, if you want to nudge a pin.
- **Whether players can see the map**: the line `players: true,` in the same block, as on pages. Without it the map is GM only (the Lip of the Rent and the Glass Barrow are, so players don't see the battle and the dungeon ahead of time).

Run `npm run check` afterwards: it checks every pin's key too.

---

## 7. Checking and previewing your work

### The checker

In the VS Code Terminal (**Terminal → New Terminal**):

```
npm run check
```

It reads every file in `worlds/vael-ardith` and lists problems with the file and line:

```
ERROR  worlds/vael-ardith/people/varra.md, line 9: Unknown setting "staus". Did you mean "status"?
warning  worlds/vael-ardith/places/old-mill.md: The link [[Cinderfrod]] has no page with that name or alias.
```

- **ERROR** must be fixed: with an error, the site won't build, so it can't go live (the live site just keeps the last good version).
- **warning** is worth a look but doesn't stop anything.

The same check runs on every pull request and every build, so even if you forget, a mistake can't reach the live site.

### Previewing in the app

You can run the whole app on your computer, offline:

1. In the VS Code Terminal: `npm run dev`
2. Open http://localhost:5173 in your browser. This is your own private copy of the app, with its own separate storage.
3. The first time, open **Vael Ardith** from Home.
4. After editing files, go to Vael Ardith's **World settings** and press **Reset the example world** to load your latest version. (A world already loaded doesn't change by itself.)
5. While `npm run dev` is running, the Terminal also prints the checker's report each time you save a file in `worlds/vael-ardith`.
6. To stop it, click in the Terminal and press **Ctrl+C**.

---

## 8. Getting it to everyone

Merging your pull request puts the new files live within a few minutes. But anyone who already opened Vael Ardith (including you, on wardedatlas.com) keeps the copy they loaded, with their own changes in it.

To offer them the new version, raise the **`version:`** at the top of `world.md` by one (`version: 1` becomes `version: 2`) in the same pull request. Then:

- Their Vael Ardith book on Home says "update in World settings".
- World settings offers **Reset the example world**, which gives them the new copy (and loses their changes to the old one, so it warns them first).

Don't raise it for tiny typo fixes: it nags everyone to reset. Save it up for a batch of changes.

People who open Vael Ardith for the first time always get the latest version.

---

## 9. When something goes wrong

**The checker says ERROR.** Go to the file and line it names. The message says what's wrong. The most common:

| Message | Fix |
| --- | --- |
| "has a colon and a space in it" | Put the whole value in "double quotes" |
| "Indent with spaces, not tabs" | Delete the indent and type spaces |
| "Unknown setting" | A misspelt setting: it suggests the right one |
| "no page with the key" | A `parent`, `relation` or `pages` entry points at a key that doesn't exist. Check the file name. It suggests the nearest |
| "Two pages have the key" | Two files with the same name in different folders. Rename one |
| "no month called" | Check the month name's spelling in `when:` |
| "The file must start with a line of three dashes" | Something (even a blank line) is above the first `---` |

**The pull request shows a red ✗.** Click **Details** next to it. The checker's report is near the top ("Check the example world"). Fix the files on your computer, commit, and **Push origin**: the pull request updates and checks again by itself.

**GitHub Desktop says there's a conflict.** Someone else (often Claude) changed the same lines while you were offline. GitHub Desktop lists the files; open each in VS Code, which shows both versions with buttons **Accept Current**, **Accept Incoming** or **Accept Both**. Pick, save, then **Continue merge** in GitHub Desktop. If it's confusing, press **Abort merge** and ask Claude: nothing is lost.

**I made a mess and want to start the file over.** In GitHub Desktop, right-click the file in the Changes list → **Discard changes**. (Only for changes you haven't committed yet.)

**I committed something wrong.** Just fix it and commit again. Or in GitHub Desktop's History tab, right-click the commit → **Revert changes in commit**.

**`npm run check` says "command not found" or something about Node.** Node.js isn't installed, or VS Code was open before you installed it: restart VS Code. If it complains about the version, install the current LTS from nodejs.org.

**`npm run dev` says the port is in use.** It's already running in another Terminal. Use that one, or close it with Ctrl+C.

---

## 10. The rest of the app

### What each folder does

| Folder or file | What's in it |
| --- | --- |
| `worlds/vael-ardith/` | The Vael Ardith example world (this guide) |
| `src/sample.ts`, `src/sampleMap.ts` | The small Shattered Coast sample world and its maps, written as code. Editable, but more fiddly: keep the punctuation exactly as it is around your changes |
| `src/help.tsx` | The text of every **?** help tip |
| `src/pages/` | Each screen of the app (Home, a page, the timeline, sessions, World settings…) |
| `src/example/` | The code that reads Vael Ardith's files, its pictures (`art/`) and its maps (`maps/`, see [Maps](#6i-maps)) |
| `src/db.ts` | How everything is stored on the device. **Leave to Claude** |
| `src/cloud/`, `supabase/` | Sync, sharing and what players are allowed to see. **Leave to Claude**: mistakes here can show GM secrets to players |
| `src/ai/` | Transcription and recaps |
| `src/mapArt/`, `src/mapDrawing.ts` | The map builder's drawing |
| `public/` | Files served as they are: the icon, privacy policy, terms (`privacy.html`, `terms.html`) |
| `docs/` | This guide, the roadmap (`ROADMAP.md`), account setup notes |
| `README.md` | The project's front page on GitHub |
| `CLAUDE.md` | Standing instructions for Claude |

### Small, safe edits

**Help tips.** Every **?** tip is one line in `src/help.tsx`:

```ts
  needsYou: 'Things waiting on you: questions your players asked, …',
```

Change only the words inside the quotes. Use ’ (a curly apostrophe) inside the text, or the straight `'` ends the text early. Keep the comma at the end of the line.

**Words on screen.** To change a button or heading, search for the exact words (Cmd+Shift+F) and change them between the `>` and `<`, or inside the quotes. Keep everything else on the line as it is.

**The roadmap and docs.** `docs/ROADMAP.md` and the other `.md` files are plain Markdown. Edit freely.

For any of these, check before committing with:

```
npm run lint && npm run build
```

Both must finish without errors (warnings are fine). The pull request runs the same checks.

**Leave to Claude:** anything about how data is stored or synced, what players can see, sign-in, or new features. Ask in the project, and mention which files you've been changing so the work doesn't collide.
