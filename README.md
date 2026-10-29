# NOVA

**Your browser. Your universe.**

A personal new-tab page with flowing ambient wallpapers, a clock and greeting, colorful favorites, fast Google autocomplete, local notes, and built-in weather.

No account required. Your shortcuts and preferences stay on your device.

## Use NOVA with New Tab Redirect

This is the recommended setup if you want to use the [New Tab Redirect extension](https://chromewebstore.google.com/detail/new-tab-redirect/icpgjfneehieebagbmdbhnlpiopdcmna?hl=en-US).

### 1. Open NOVA

Visit **[the-nova-web.vercel.app](https://the-nova-web.vercel.app/)** in Chrome.

NOVA is already hosted. You do not need Node.js, a terminal, a local server, or NOVA’s standalone extension to use this website.

### 2. Set your new-tab URL

1. Install [New Tab Redirect](https://chromewebstore.google.com/detail/new-tab-redirect/icpgjfneehieebagbmdbhnlpiopdcmna?hl=en-US).
2. Open `chrome://extensions`.
3. Find **New Tab Redirect**, open **Details**, then **Extension options**. You can also access its options from the extension menu.
4. Set the custom redirect URL to:

   ```text
   https://the-nova-web.vercel.app/
   ```

5. Save it, then open a new tab.

New Tab Redirect changes new tabs; it does not change Chrome’s startup pages or homepage. Chrome’s address-bar focus after a redirect is controlled by the browser and the extension.

Use one extension to control your new-tab page. If you previously installed NOVA’s standalone new-tab extension, disable it while using New Tab Redirect.

### 3. Make it yours

On your first visit, NOVA asks for your name, appearance preferences, optional weather city, and shows a short walkthrough. Complete or skip setup once; later visits go straight to your home screen.

Existing users with saved NOVA preferences skip the welcome flow. If you close setup before completing it, it appears again on the next visit.

## Everyday controls

| Action | How |
| --- | --- |
| Open search | Click the search bar or press **Cmd/Ctrl + K** |
| Navigate suggestions | **↑ / ↓** |
| Fill a suggestion | **Tab**, **→** at the end of the input, or its fill arrow |
| Open a result | **Enter** |
| Alternate current/new-tab action | **Cmd/Ctrl + Enter** |
| Close a panel | **Escape** |
| Show favorites | Hover over the bottom shelf or use **Show favorites** |
| Add a favorite | **Add shortcut** |
| Edit/remove favorites | Open the shelf, then select **Edit favorites** |
| Reorder favorites | Drag in edit mode; keyboard users can focus a sortable tile, press **Space**, use arrows, then **Space** to drop |
| Undo favorite removal | Select **Undo** in the confirmation toast within six seconds |
| Finish editing | **Done** or **Escape** |
| Change appearance | **Customize** |
| Check weather | Select the weather control at the top right |

Right-clicking a favorite also opens its editor. Changing its URL automatically updates its website icon and matching color. Manual icon/color choices remain available in the editor.

Search opens with recent NOVA searches. Remove one using its **×** button or remove the list using **Clear history**. Commands such as `/notes`, `/wallpaper`, and `/settings` work while typing.

## Wallpapers and motion

Choose a bundled atmosphere through **Customize → Wallpaper studio**, or upload your own image.

- Supports JPG, PNG, WebP and AVIF, up to **20 MB**.
- Uploaded images are optimized locally to fit within **2560 × 1600** pixels.
- Images stay in your browser’s IndexedDB; they are not sent to a server.
- Brightness and softness are adjustable.
- Bundled backgrounds have flowing waves and slow aurora ribbons.
- Background motion pauses while panels or favorites are open and while the tab is hidden.
- System **Reduce Motion** preferences disable background animation.
- Uploaded photos are static.

The inspiration widget rotates through 31 original, locally bundled NOVA prompts. It changes at local midnight, stays consistent across refreshes that day, and works offline.

## Weather

Select the weather control, search for a city, and choose the correct result. NOVA displays current conditions, feels-like temperature, humidity, wind, and a five-day forecast inside the app.

The selected city is remembered locally. Forecasts are cached for ten minutes; use the refresh button to request a fresh forecast. NOVA does not request device location access.

Weather and city lookup are provided by [Open-Meteo](https://open-meteo.com/). Internet access is required. Its public API is intended for non-commercial use; review the provider’s terms before a commercial release.

## Local data and privacy

NOVA does not have an account system, analytics, or cloud synchronization.

| Data | Storage |
| --- | --- |
| Favorites, order, names, URLs, appearance, preferences, notes, tasks, recent searches, setup completion | Browser localStorage |
| Uploaded wallpaper | Browser IndexedDB |
| Weather city and forecast cache | Browser localStorage |
| Preferences when running as NOVA’s standalone extension | Also mirrored to Chrome local storage |

**New Tab Redirect does not store NOVA’s shortcuts.** In redirect mode, NOVA is a normal website, and its data belongs to the URL and Chrome profile you use.

Online features make these requests:

- **Google autocomplete:** typed search queries are sent to Google through NOVA’s suggestion endpoint. Commands, calculator expressions, and recognized website addresses do not trigger autocomplete requests. Disable **Live search suggestions** in Customize to stop them.
- **Website icons:** a favorite’s website domain is sent to Google’s favicon service. Turn off automatic website appearance for a shortcut to use manual artwork.
- **Weather:** city searches and selected city coordinates are sent to Open-Meteo when you use the weather panel.
- **Opening a destination or search:** navigates to that website or your chosen search engine.

The included suggestion server does not log query text or forward your browser cookies. It keeps a bounded, one-minute in-memory suggestion cache.

Clearing site data, removing a browser profile, or clearing extension data can erase your setup. Incognito storage is temporary. Keep periodic JSON exports; they contain your notes, links and searches, so store them privately.


## Troubleshooting

**New tabs show “site can’t be reached.”**  
Check your internet connection and confirm the saved redirect URL is exactly `https://the-nova-web.vercel.app/`. Try opening that URL directly. If the hosted site is unavailable, try again later.

**My shortcuts disappeared after changing the URL.**  
You probably changed the origin, port, or browser profile. Return to the old URL, export your settings, then import them at the new one. Do not clear the old site’s data first.

**NOVA is still opening another new-tab page.**  
Check the redirect URL and disable other extensions that override new tabs, including NOVA’s optional standalone extension if you are using redirect mode.

**Changes to source files are not appearing in daily use.**  
Local source edits do not update the hosted website until a new version is deployed. For a local production build, run `npm run build` again. Development changes are automatically reflected only on the development server.

**Google suggestions are unavailable.**  
Check your connection and that Live search suggestions are enabled. The hosted deployment must provide `/api/suggest`; if suggestions remain unavailable, that endpoint may need a deployment fix. For local development, `npm start` and `npm run dev` provide it. Local shortcut matching and submitted searches remain usable when live suggestions fail.

**The background is not moving.**  
Close panels and the favorites shelf. Motion pauses during interaction and in hidden tabs; system Reduce Motion also disables it. Uploaded wallpapers are static.

**Weather cannot load.**  
Check your connection, search for the city again, or use refresh/retry. Weather depends on Open-Meteo availability.

## Shortcut folders

Choose **New folder** in the favorites shelf, give it a name, and select shortcuts. Open a folder to launch its links; choose **Edit folder & shortcuts** to rename it or update its contents. Selecting a shortcut from another folder moves it here. You can also change a shortcut’s folder in its own editor. Removing a folder returns its shortcuts to the main shelf. Folders and membership are saved locally and included in JSON exports. Search still finds links inside folders.

**Customize → New tab extension** links to New Tab Redirect and displays `https://the-nova-web.vercel.app/` for its redirect setting.

### Vercel autocomplete route

`api/suggest.js` is the Vercel Function entry point for `/api/suggest`, sharing the same handler used in development. Deploy the whole repository, including `api/`, `server/`, and `vercel.json`; uploading only `dist/` omits the function and causes autocomplete requests to return 404. After deployment, verify `/api/suggest?q=hello` returns a JSON array rather than a 404 page.
