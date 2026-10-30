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
| `search.spec.ts` | Search (Ctrl K, Cmd K, or the search button on a phone) still finds every "Go to" place and lands on the same address, finds pages, sessions ("#1"), maps and "New npc", and in the player view offers none of the GM-only ones. |

Not covered yet: the public wiki link and joined players. Both get a copy of the world the server
has already filtered, which needs the real cloud.

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
