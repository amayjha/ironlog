# Ironlog — Workout Tracker PWA

A FitNotes-style workout log: daily workouts, exercise library by muscle group,
set logging with PR detection, rest timer, progress graphs, and a body weight
tracker. Installable on your phone as a PWA and works offline after first load.

Data is stored on-device in `localStorage` — no backend, no accounts.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Deploy to Railway

1. Push this folder to a GitHub repo:
   ```bash
   git init && git add -A && git commit -m "Ironlog v1"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```
2. In Railway: **New Project → Deploy from GitHub repo** and pick the repo.
3. Railway (Nixpacks) auto-detects Node, runs `npm run build`, then `npm start`
   (which serves the `dist/` folder via `serve` on Railway's `$PORT`).
4. In the service settings, generate a public domain (Settings → Networking →
   Generate Domain).

Alternatively, deploy with the CLI: `railway init && railway up`.

> Also works on Vercel/Netlify with zero config (build command `npm run build`,
> output directory `dist`) — and on those you can drop the `serve` dependency.

## Install on your phone

Open your deployed URL in the browser, then:
- **iPhone (Safari):** Share → Add to Home Screen
- **Android (Chrome):** Menu (⋮) → Add to Home screen / Install app

After the first load the app is cached by the service worker and works offline
— useful in basement gyms.

## Notes & next steps

- **Data lives per-device** (localStorage). Clearing browser site data clears
  your log. For cross-device sync, swap the `loadData`/`persist` functions in
  `src/App.jsx` for a Supabase table — the rest of the app doesn't change.
- The data model is a single JSON object under the key `ironlog:data`:
  `{ workouts: { "YYYY-MM-DD": [{ exId, sets: [{ w, r, ts }] }] },
     customExercises, body, unit, lastSet }`
- Easy upgrades: export/import JSON backup button, workout templates,
  per-set rest-timer auto-start, notification on timer end.

## Structure

```
ironlog/
├── index.html            # entry, PWA meta tags
├── package.json
├── vite.config.js        # Vite + vite-plugin-pwa (manifest, service worker)
├── railway.json          # Railway build/start config
├── public/
│   ├── icon-192.png
│   └── icon-512.png
└── src/
    ├── main.jsx
    └── App.jsx           # the whole app (screens, storage, styles)
```
