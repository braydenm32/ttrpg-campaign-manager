# The browser tests

These tests open the real app in a browser (Chromium), load the Vael Ardith example world from the
worlds shelf the way you would, and click through it. They run by themselves on every pull request
and every change to `main` (the "Tests" check on GitHub), so a change can't quietly break a screen,
lose a page, show GM secrets to players or break search.

Run them yourself with:

```
npm test
```

The first run builds the app (about a minute); the whole thing takes a few minutes. Nothing is sent
anywhere: the tests run offline, against a copy of the app on your computer. To watch them click
through the app in a window, use `npm run test:ui`. The first time on a new computer, install the
test browser once with `npx playwright install chromium`.

When something fails, `npx playwright show-report` opens a page with each failure, a screenshot and
a step-by-step replay. On GitHub, the same report is attached to the failed check as "test-report".

## What each test guards

| File | What it checks |
|---|---|
| `routes.spec.ts` | Every address the app answers (each `<Route>` in `src/App.tsx`) is listed in `routes.ts` with a sample address in the example world. Add a new screen and forget to list it, and this fails, so every screen gets tested. |
| `screens.spec.ts` | Every screen in `routes.ts`, on a laptop (1366 px wide) and a phone (390 px), in the GM view and, where players can go, the player view. Each must open without an error, without "Something went wrong", without "not found" (unless that's the point), and without the page scrolling sideways. On the phone, buttons and links must be at least 44×44 px, the size of a fingertip. |
| `leaks.spec.ts` | In the player view, no GM secret shows anywhere on any screen, not even hidden: names and text of GM-only pages, GM notes, `:::gm` and `:::for` passages, GM-only fields and nicknames, clocks players don't know about, GM-only maps, sessions and corkboards. It visits every screen, every page players can see, and every GM-only page and map by its address, and searches (Ctrl K) for the secrets too. The list of secrets is made from the example world's own data each run (`lib/secrets.ts`). |
| `old-addresses.spec.ts` | Old links and bookmarks still land on the right screen: `#/…` links, long ids instead of names, `/e/` page addresses, `/type/npc` lists. |
| `search.spec.ts` | Search (Ctrl K, Cmd K, or the search button on a phone) still finds every "Go to" place it found before the areas, by its old name ("Home" finds Today, "Loose threads" finds Threads), plus the new ones (the Lectern, Chronicle, Inbox, the scratchpad, campaigns, templates, the bin); finds pages, sessions ("#1"), maps and "New npc"; and in the player view offers none of the GM-only ones. |
| `nav.spec.ts` | The menus in `src/nav.ts`, without a browser. **No orphans**: every `<Route>` in `src/App.tsx` must be an area's tab, a More item, or a "contextual" address (one reached from somewhere else on purpose, like Print or an invite link). Add a screen and forget its menu, and this fails. It also checks which area and tab each address lights (for the GM, players and wiki readers), and that nothing in a player's menus or search leads to a GM tool. |
| `frame.spec.ts` | The world's frame, on a laptop and a phone: the sidebar (laptop) or bottom bar (phone) goes to each area for the GM and for players, Back after a tab click returns to the tab before, each area remembers the page you were last on in it, Notes sits inside Me on a phone, and the More page lists its groups (players' More has no GM tools). |
| `session.spec.ts` | The GM's Session area, on a laptop and a phone: a session moves Prepare → Play (the Lectern) → Wrap up → played, and the next one then comes up on the Desk; changing the scene at the Lectern replaces the read-aloud text and who's here (and Undo puts it back); "Next scene" follows the plan; Undo brings back a scene removed on Prepare; text typed in the page editor is saved when you leave without pressing Save (with Undo), and a new page you leave untouched, or cancel, leaves nothing behind. Each test puts back what it changed. |
| `room.spec.ts` | The players' Common Room, on a laptop and a phone, in the player view: Now answers when the party plays next, what happened last time and what it's doing, in that order and (on a phone) on the first screen, with a revealed recap's GM secret never showing; just after a game night the recap comes first, and while the GM runs a session live the scene, dice and a word to the GM do; Now's leads, the Leads tab and the players' leads page (`/threads`) list the same leads; Table rules opens from the foot of Now and from the frame; previewing as one character shows them on Me and nothing GM-only; Party lists everyone and the purse. Each test puts back what it changed. |
| `desk.spec.ts` | The GM's Desk and the worlds shelf, on a laptop and a phone: the strip's main button matches the stage of the session in hand (Start prep, Start playing, Wrap up); "Needs you" has one action per line, lists pressing threads, and sets a date in place with Undo; the date's buttons are folded under the date; the shelf has one New world button and keeps the examples apart; the pictures-and-maps note is a small chip in the top bar. With a pretend cloud (`lib/cloud.ts`, nothing leaves the machine) it checks that the Desk badge, the Inbox tab, "Needs you" and the Inbox all count the same players' questions, downtime, claims and new characters, that answers happen in place, and that Decline and Delete wait out their Undo before reaching the server. `SHOTS_DIR=<folder>` saves screenshots of those screens. |
| `atlas.spec.ts` | Pages, maps and the Story screens, on a laptop and a phone: a page's one visibility control says "GM only" or "Players can see this", revealing shows a review first (what players get, what stays hidden) and Undo hides it again; the breadcrumb starts at the list, never the world's name, and folds the middle into "…" on a phone; in the player view a page shows no visibility control, GM notes, edit date or Edit button; map pins carry their names (with a switch to hide them) and on a phone a pin opens in a sheet over the map; Threads keeps its search when you come Back from a thread; Timeline keeps List or Month in the address. Each test puts back what it changed. |
| `more.spec.ts` | Everything under More, on a laptop and a phone: the More page lists the GM's tools in three groups with counts (and Print as a note, not a button), and a player's lists no GM tool; World settings' tabs are steps in Back, and More's Recently deleted opens the bin; Undo brings back a removed safety line, holiday, page type, corkboard card and string, AI key and Syrinscape token; Handouts' Reveal and show and Treasure's Give to the party say what players will see first, and Undo takes them back; with a pretend cloud, turning off the wiki, invite or co-GM link or stopping sync asks first, saying what stops working. `SHOTS_DIR=<folder>` saves screenshots. |

Not covered yet: the public wiki link and joined players. Both get a copy of the world the server
has already filtered, which needs the real cloud (the pretend one only plays the GM's side).

## Known problems: the baseline

Today's app already has some of the problems these tests look for (lots of buttons smaller than
44 px on phones, a few screens that scroll sideways). `baseline.json` lists them, screen by screen,
so the tests fail only on a problem that is **new**. At the end of each run you get a short summary
of the known problems still there, and of any that have been fixed.

Update the baseline when you've fixed some (so they can't come back unnoticed), or when a change
knowingly adds one:

```
npm test -- -u
```

(or `npm run test:update-baseline`). It reruns everything and rewrites `baseline.json` from what it
found. Commit the new `baseline.json` with your change, so the reviewer can see what moved.

Two entries are real privacy gaps, kept in the baseline only so the check can run today: in the
player view, World settings and Files (typed in by address) show GM-only page and map names. They
are listed under `laptop player-leaks …`; fixing them should remove those lines.

## Adding a screen

1. Add its `<Route>` to `src/App.tsx` as usual.
2. Add it to `routes.ts`: its path exactly as in `App.tsx`, a sample address in the example world,
   and who can see it. `npm test` then opens it on both screen sizes and checks the player view.
3. Give it a home in `src/nav.ts`: a tab of an area, an item on the More page, or (if it's reached
   only from somewhere else on purpose) a line in `CONTEXTUAL` saying from where. `nav.spec.ts`
   fails until you do.

## Running two copies side by side

The tests use port 4175. If another copy is already using it, pick another: `TEST_PORT=4191 npm test`.
