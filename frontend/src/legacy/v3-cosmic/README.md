# iKHWEZI UI v3 — Cosmic / Dark-Gold (Archived)

**Archived:** 2026-06-17  
**Status:** Preserved for rollback — **not imported** by the live app.

This folder is a frozen snapshot of the pre-Ultima interface:
- `App.jsx` — previous app shell
- `pages/` — all route pages
- `components/` — navigation, feed, players, etc.
- `styles/global.css`, `index.css`, `tailwind.config.js`

## Restore (if needed)

1. Copy `pages/*` → `src/pages/`
2. Copy `components/*` → `src/components/`
3. Replace `src/App.jsx` with this `App.jsx`
4. Point `main.jsx` at archived styles if required

The active app uses **`src/ultima/`** (Ultima design system).
