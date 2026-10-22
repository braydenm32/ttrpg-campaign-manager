# Campaign Codex brand assets

The app logo is the **Codex Sigil**: an open book under a guiding star, pressed into a red wax seal and gilded. The other options are kept for future use. Colors match the app theme (`src/index.css`): ink `#1e1b24`, gold `#e0b354`.

| File | What it is |
| --- | --- |
| `codex-sigil-icon.svg` / `.png` | **Current logo**, on the rounded dark app-icon tile. Copied to `public/favicon.svg`, `public/icon-512.png`, `public/apple-touch-icon.png` and `src-tauri/icons/` |
| `codex-sigil-mark.svg` / `.png` | **Current logo** on a transparent background. Copied to `src/assets/logo.svg` for the page headers |
| `clasped-tome-icon.svg` / `.png` | Option A, closed spellbook with clasp and d20, on the rounded dark app-icon tile |
| `clasped-tome-mark.svg` / `.png` | Option A on a transparent background |
| `open-codex-icon.svg` / `.png` | Option B, open book with guiding star and ribbon, on the app-icon tile |
| `open-codex-mark.svg` / `.png` | Option B on a transparent background |

SVGs are the source; PNGs are 512×512 exports.

To regenerate the desktop/mobile icons after changing the logo: export a 1024×1024 PNG of the icon, then run `npx tauri icon <png> --ios-color '#15131a'`.
