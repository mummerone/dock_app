# v44 — Guided crew tour (pause at each action)

Baseline: **v43**. No publish — build + Desktop stage only. `loadPlan.js` untouched.

## Goal
A non-technical boss watching Crew demo playback gets a plain-English callout on every new forklift action, with playback frozen until they tap **Continue**.

## Behavior
1. **Auto-pause** on each new action (new pull/load assignment or waiting/idle) during Show boss demo, Play, and Step.
2. **Callout bubble** anchored to the forklift chip (fallback: door tile): arrow pointer, highlight ring, `scrollIntoView({ block: "center" })`, clamped to ~390px viewport (max-width ~340px), flips above/below by space, repositions on resize/scroll. Outside taps do **not** dismiss.
3. Copy uses real plan data (piece, destination, inbound door, OUT door, slot as nose/tail + floor/deck) plus a short why when available. Counter: `Action N of T`.
4. Buttons: primary **Continue** (advance to next move/action, pause again); secondary **Play without stops** (turn off auto-pause and run normally).
5. Guided mode **ON by default**; checkbox **Pause at each action** in Demo controls, saved as `dockApp.crewTourPause.v1`. Same-tick multi-forklift starts are queued one popup at a time.
6. Phone-first: 44px tap targets, z-index above sheets, not hidden by chrome.

## Kept
Crew WALL (no SVG arrows), LOAD SLOT, OUT piece list, Packed/Unplaced, Operator no-map, Solo / Crew (5) / Ground, diversify-by-OUT, v43 spread banner, auto-open busiest OUT (fits 390px), Show boss demo hero.

## Version
- `sw.js` → `dock-app-v44`, assets `?v=44`
- stamps + SW register → **v44**
- `README.md`, `V44_NOTES.md`

## Desktop stage
`/home/box/Desktop/dock_app_v44/` — `app.js`, `styles.css`, `index.html`, `sw.js`, `README.md`, `V44_NOTES.md`
