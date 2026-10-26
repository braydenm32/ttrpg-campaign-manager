# The Warded Atlas brand assets

The app logo is the **Warded Compass**: a gold compass star inside a thick ward band with twelve runes carved into it, in matte gold on the dark app tile. Colors match the app theme (`src/index.css`): ink `#1e1b24`, gold `#e0b354` (light `#f0cf7e`, shadow `#a87d27`).

| File | What it is |
| --- | --- |
| `warded-atlas-icon.svg` / `.png` | **Current logo**, on the rounded dark app-icon tile. Copied to `public/favicon.svg`, `public/icon-512.png`, `public/apple-touch-icon.png` and `src-tauri/icons/` |
| `warded-atlas-mark.svg` / `.png` | **Current logo** on a transparent background. Copied to `src/assets/logo.svg` for the page headers |
| `codex-sigil-*` | Old logo from when the app was called Campaign Codex (red wax seal). Kept for reference |
| `clasped-tome-*`, `open-codex-*` | Old unused options from the Campaign Codex days |

SVGs are the source; PNGs are 512×512 exports. Other concept rounds for the Warded Atlas logo are in the project files under `brand/warded-atlas/`.

To regenerate the desktop/mobile icons after changing the logo: export a 1024×1024 PNG of the icon, then run `npx tauri icon <png> --ios-color '#15131a'`.
