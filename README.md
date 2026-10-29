# NOVA

A private, atmospheric new-tab space built with React, TypeScript, Vite, Tailwind, Motion, Zustand, and dnd-kit.

## Develop

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open http://localhost:5173. `npm run build` checks TypeScript and creates `dist/`. `npm test` runs critical URL, search encoding, and calculator tests.

## Install in Chrome / Chromium

1. Run `npm run build`.
2. Open `chrome://extensions` and enable Developer mode.
3. Choose **Load unpacked**, then select this project's `dist` directory.
4. Open a new tab. Accept Chrome's new-tab override prompt if shown.

Run `npm run package:extension` to produce `nova-extension.zip` for distribution. Unzip before loading unpacked. This is an MV3 extension; no server is needed after installation. Its wallpapers, icons, and interface are bundled and work offline. External destinations and weather searches require a connection.

## Everyday use

- **Cmd/Ctrl K** opens search. Arrow keys select; Enter opens; Escape dismisses.
- Search your shortcuts, type a website URL, run a calculator expression, or search the selected engine.
- `/focus`, `/notes`, `/settings`, and `/wallpaper` access tools.
- Right-click a shortcut to edit/delete it. **Add shortcut** creates a destination.
- The sliders button enables layout editing: drag tiles, or focus a tile and use Space then arrow keys to reorder; Space drops.
- Wallpaper Studio offers six bundled atmospheric palettes with brightness and blur controls.
- Settings autosave and support JSON export/import, clock preferences, name, widget visibility, search engine, and launch behavior.
- Focus timer supports 15/25/45/60 minute sessions, pause, and reset. Notes and intentions autosave.

## Architecture

- `src/main.tsx`: home, reusable shortcut tile, clock, panels, and interactions.
- `src/store.ts`: typed preference/shortcut models, Zustand persistence, optional Chrome local storage bridge.
- `src/logic.mjs`: pure URL validation, query encoding, and parser-based calculator (no eval).
- `src/style.css`: visual tokens, layered ambient artwork, materials, responsive layouts, reduced-motion behavior.
- `public/manifest.json`: minimal-permission new-tab extension.

Preferences are stored in localStorage, plus Chrome storage when available. No account, analytics, history, bookmarks, or location access. Automatic shortcut artwork requests the website domain from Google’s favicon service; cached icons are kept locally when cross-origin pixel access is available. Tile colors are sampled from icons where possible, with curated brand colors and a deterministic domain palette as fallbacks. Turn off “Use website icon & matching color” in a shortcut to use manual artwork and avoid that shortcut’s icon request. Weather displays real current conditions and a five-day forecast from Open-Meteo inside NOVA. City searches and selected city coordinates are sent to Open-Meteo only when using Weather; no device location is requested. The selected city and ten-minute forecast cache are stored locally. Data exports contain your saved notes, tasks, and links; keep them private.

## Scope

The foundation and selected interaction/productivity features are implemented. Folders, arbitrary widget resizing, browser history/bookmark integrations, calendar connections, AI, synchronization, and theme sharing remain future work. No API integrations or unsupported browser capabilities are represented as functional. Extension packaging is build-verified; installation needs manual verification in Chrome.

### Search suggestions

The search palette filters saved shortcut names and URLs as you type. After an 80 ms pause, cached completions appear immediately; new live query completions are retrieved from Google Autocomplete through a same-origin `/api/suggest` endpoint (or directly with a scoped host permission inside Chrome). Arrow keys select, Enter opens, and Tab/Right Arrow or the row’s fill button completes text. Searches open in your configured engine. Disable live suggestions in Customize → Search to keep typed queries local until submitting a search. Commands, calculator expressions, and website URLs do not trigger live requests. Offline failures leave shortcut matching and search usable.

Recent NOVA searches are saved locally (up to 20), with the latest eight shown when opening search. Clear history removes this list. This does not read browser history or recover searches made before this feature was enabled.

Weather is powered by Open-Meteo (https://open-meteo.com/). Its public API is for non-commercial use; obtain an appropriate commercial plan before a commercial release.

### Production website

Run `npm run build` and `npm start` to serve NOVA and its Google suggestion endpoint on port 4173. Set PORT/HOST for your deployment environment. Static-only hosting needs an equivalent `/api/suggest` server route for live autocomplete. The server forwards only the query to Google, without browser cookies or identifiers; it keeps a bounded one-minute memory cache and does not log queries. The extension calls Google directly with its scoped host permission. Disable live suggestions to stop autocomplete requests.

### Personalization polish

Wallpaper Studio accepts JPG, PNG, WebP and AVIF up to 20 MB, optimizes them locally to a maximum 2560 × 1600 image, and keeps the image in IndexedDB. The image is never uploaded to a server. Wallpaper exports contain preferences only; the local image stays on this device. The uploaded image can be removed in Wallpaper Studio.

Use **Edit favorites** in the shelf to reorder, edit or remove destinations. Removal offers Undo for six seconds. Done or Escape exits editing. Recent search rows have their own remove button. Search matches are highlighted. Hover opening has a short close grace period and suppresses accidental activation during the shelf entrance; click the shelf handle to pin it open, then click outside or press Escape to close.

### Ambient background motion

Bundled atmospheres use two rasterized radial-gradient layers animated with CSS transforms over 12–15 seconds. Ambient backgrounds avoid the full-screen blur filter and SVG turbulence; the softness control adjusts their radial feathering. Uploaded photos retain their normal image blur setting. Motion pauses for open panels, favorites, hidden tabs and reduced-motion preferences.

### First-time welcome

A fresh installation starts with a four-step setup: name, atmosphere and clock/widget choices, optional city weather, then a keyboard/favorites/customization walkthrough. Finish or Skip setup saves completion locally so future visits open the home screen. Existing preferences from older NOVA versions are treated as an existing user and skip onboarding. Abandoning an unfinished setup starts it again on the next visit. Resetting appearance preferences does not restart onboarding. Clearing all browser/extension storage creates a fresh installation.
