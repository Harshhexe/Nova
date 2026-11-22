# NOVA Project Handoff

This is a portable overview of NOVA and the decisions and preferences from its development chat. Keep it with the project and share it with your next ChatGPT account.

## Project overview

- **Name:** NOVA
- **Tagline:** “Your browser. Your universe.”
- **Product:** A personal new-tab dashboard website
- **Live site:** [the-nova-web.vercel.app](https://the-nova-web.vercel.app/)
- **Project folder:** `/Users/harsh/Desktop/Nova`
- **Local development URL:** `http://localhost:5173/`
- **New-tab setup:** The intended workflow is the Chrome extension [New Tab Redirect](https://chromewebstore.google.com/detail/new-tab-redirect/icpgjfneehieebagbmdbhnlpiopdcmna?hl=en-US), pointed to `https://the-nova-web.vercel.app/`.

## Features

NOVA includes a live clock and greeting, search with Google suggestions, recent searches, favorites, shortcut folders, daily inspiration, quick notes, tasks, in-page weather, customizable wallpapers, and animated backgrounds. First-time onboarding asks for the user's name and initial preferences.

Favorites can be added, edited, removed, reordered, and grouped into folders. Search matches saved shortcuts, submits web searches, and supports calculator and unit/currency conversions. Weather uses Open-Meteo. Inspiration rotates daily.

## Technical overview

- React 19, TypeScript, Vite, Zustand, Motion, Lucide, and DnD Kit.
- Main interface: `src/main.tsx`; styles: `src/style.css`.
- State and persistence: `src/store.ts`.
- Search and URL helpers: `src/logic.mjs`; conversions: `src/converter.mjs`.
- Inspiration: `src/DailyInspiration.tsx`, `src/daily-inspiration.mjs`.
- Onboarding: `src/onboarding.tsx`, `src/onboarding-state.mjs`.
- Weather: `src/weather.tsx`.
- Animated canvas backgrounds: `src/CanvasShader.tsx`.
- Shortcut folders: `src/shortcut-folders.tsx`.
- Suggestions route: `api/suggest.js` on Vercel; local server code is in `server/`.
- Deployment config: `vercel.json`.

## Development commands

Run `npm install` to install dependencies. Run `npm start` for the local API server and `npm run dev` in a second terminal for the Vite app. Use `npm run build` to make a production build and `npm test` to run automated tests. `npm run package:extension` packages the web build as a zip for the optional extension workflow.

Deploy the full repository to Vercel so `/api/suggest` is included. Deploying only `dist/` leaves out the suggestions endpoint.

## Data and privacy

NOVA has no user account or cloud sync. Favorites, folders, settings, notes, tasks, recent searches, and onboarding completion are stored in browser localStorage. Uploaded wallpapers use IndexedDB. Data is tied to the browser profile and site origin, so clearing site data or removing the profile can erase it. Keep periodic JSON exports somewhere private.

Online requests include search queries sent to Google autocomplete through NOVA's endpoint, weather lookups sent to Open-Meteo, and favorite domains sent to Google's favicon service when automatic icons are enabled. Live suggestions can be disabled in settings.

## Design and interaction preferences

- Keep the experience fast and responsive. Avoid lag.
- The look should be modern, clean, calm, and glassy.
- Background motion should be clearly visible, smooth, and flowing, like slow aurora ribbons or waves. It should not feel barely animated or harsh and distracting.
- Keep search, Customize, and focus controls accessible when the favorites shelf is open. Hover effects must not block clicks.
- Favorite tiles should have crisp, rounded, high-contrast icons. The wider and shorter tile proportions were preferred over taller ones.
- Keep header actions minimal. The requested retained actions were weather and the user logo.
- Show favorite editing controls only when the shelf is open.
- Do not add features or visual effects that were not requested. Verify visual edits in the browser when possible.
- If a visual change is disliked and the owner asks to revert, revert it promptly.

## Decisions and recent history

- NOVA is being kept as a website, used as a new-tab page via New Tab Redirect. Electron or a desktop browser shell was discussed, but not chosen.
- Search should use Google suggestions for natural-language queries and show previous searches instead of generic starter suggestions.
- Daily inspiration should change each day. The existing README documents its rotation behavior.
- Shortcut folders and a New Tab Redirect entry in settings were requested.
- React Bits FluidGlass was integrated briefly as a search effect, then reverted after it displayed an unwanted black box. It is not part of the current project. Do not add it again unless requested.
- After reverting FluidGlass, `npm run build` succeeded.

## Scope

Keep NOVA as a web page unless the owner chooses a desktop shell. Local source edits do not update the live site until deployed. Do not deploy changes unless asked.

## Onboarding a new collaborator

1. Read this file and `README.md`.
2. Check `git status` before editing so any existing changes are preserved.
3. Run `npm install` if needed, then `npm run dev` to inspect the interface.
4. Run `npm start` alongside Vite when testing live suggestions locally.
5. Make focused changes and verify them in the browser. Run the build and tests when appropriate.

## Prompt for the next ChatGPT account

> I’m continuing work on NOVA, my React new-tab dashboard. Read `PROJECT_HANDOFF.md` and `README.md` in the project first. The live website is https://the-nova-web.vercel.app/ and the source is in `/Users/harsh/Desktop/Nova`. Keep the design clean, fast, and glassy. I prefer clearly visible, smooth aurora-like background motion, crisp readable favorites, and controls that stay clickable. Ask before making a major design direction change or deploying. FluidGlass was tried and reverted because it displayed an unwanted black box, so do not add it again unless I ask.
