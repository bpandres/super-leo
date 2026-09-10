# Super Leo

A Mario-style platformer built for Leo — run, jump, and kick soccer balls across five worlds (Sunny Hills, Shadow Caves, Sky Kickoff, the Final Showdown boss level, and the Overtime rematch) to reach each goal net.

Play it at: https://bpandres.github.io/super-leo/

Installs as a home-screen app (PWA) on iOS and Android, with offline play.

## Controls
- Arrow keys / WASD to move, Space to jump, K to kick — or on-screen touch buttons on mobile.

## Technologies

No build step, no framework, no dependencies — the entire game is hand-written vanilla web tech, chosen so the whole thing stays a handful of files that run directly in any browser:

- **HTML5 Canvas 2D** for all rendering — background, terrain, characters, particles, HUD overlays. Every sprite (Leo, enemies, the goalkeeper, the boss) is drawn procedurally with `ctx` path/gradient calls, not image assets, which keeps the whole game to a single file with no sprite sheets to load.
- **Vanilla JavaScript (ES5-leaning syntax)** for game logic — a classic `requestAnimationFrame` loop, no external libraries.
- **Web Audio API** for sound effects — a small `playTone()` synth helper generates every sound (jump, kick, hit, level-complete jingle, etc.) on the fly instead of loading audio files.
- **`localStorage`** for persistence — unlocked levels, high score, and each level's best completion time.
- **Service Worker + Web App Manifest** to make it an installable, offline-capable PWA (see [Architecture](#architecture) below).
- **Plain CSS** (no preprocessor) for the HUD, menus, and the responsive `#frame`/`#stage` layout that keeps the canvas letterbox-free across phone/tablet/desktop aspect ratios.
- **Node.js** (dev-only, not shipped to players) — [`gen-icons.js`](gen-icons.js) is a small standalone script that hand-encodes the PWA's PNG icons (no image libraries), run locally to (re)generate the files in [`icons/`](icons).

## Architecture

The whole game lives in **[`index.html`](index.html)** — markup, CSS, and game code all in one file, organized into clearly labeled sections (search for `// ---------- <Section> ----------`):

| Section | Responsibility |
|---|---|
| Level definitions | The `LEVELS` array — one plain-data object per level (ground segments, platforms, enemies, collectibles, powerups, goal position, etc.). Adding/tuning a level is just editing data here. |
| Canvas fit | Computes a logical canvas resolution that matches the device's aspect ratio exactly, so the game fills the screen edge-to-edge with no stretching or letterbox bars, on any phone/tablet/desktop shape. Re-runs on resize/rotation. |
| Progress persistence | Reads/writes unlocked levels, best score, and best times to `localStorage`. |
| Player / Input | The player state machine (position, velocity, powerup status) and the keyboard + touch input handlers that drive it. |
| Collision helpers | AABB overlap checks and the solid-terrain list used by movement and by kicked balls (precomputed once per level load, not rebuilt every frame — see below). |
| Update | Per-frame simulation: player physics, enemy AI (patrol/shoot/jump state machines, including the boss's phases), ball/collectible/powerup logic, weather. |
| Draw | Per-frame rendering: parallax backgrounds per theme, procedurally-drawn terrain/platforms/characters, particles, HUD. |
| Game state flow | Screen transitions (title → playing → level-complete/game-over → champion) and the button wiring for each screen. |
| Main loop | The `requestAnimationFrame` loop that ties update + render together every frame. |

**Performance note:** static level geometry (ground shape, platform shape, decorative texture, the terrain collision list) is precomputed once when a level loads rather than recomputed every frame — the render loop just translates/reuses that cached data, since only the camera and moving objects actually change frame to frame.

### PWA shell
- **[`manifest.json`](manifest.json)** — app name, icons, start URL, and display mode, so the browser can offer "Add to Home Screen."
- **[`service-worker.js`](service-worker.js)** — network-first caching for the app shell (`index.html`/`manifest.json`), so players always get the latest deployed version when online, falling back to the cache when offline. Static assets (icons) are cache-first with a background refresh. Bump `CACHE_NAME` here on every deploy to invalidate old caches.
- **[`icons/`](icons)** — the generated PWA icon set, produced by `node gen-icons.js`.

### Hosting
Static files served as-is via **GitHub Pages** from this repo's `main` branch — no build/deploy pipeline, pushing to `main` is the deploy.

## Local development
Just open `index.html` in a browser, or serve the folder with any static file server (e.g. `python3 -m http.server`) — a local server is recommended over `file://` so the service worker and PWA behavior work as they do in production.
