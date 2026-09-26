# v49 — Fix OUT trailer scroll trap (tour blocker + nested max-height)

Baseline: **v48**. No publish — build + Desktop stage only. **`styles.css` + `app.js` changed.**

## Root cause

At 390×844 after **Show boss demo → open OUT trailer panel** (Side / Top-down), users saw cut-off trailer content and could not scroll to the rest of the fill (nose→tail, weight strip, piece list) or reach other OUT trailers.

Two stacked traps:

1. **`#crewTourBlocker` / `.crew-tour-blocker`** — fixed full-viewport overlay with `pointer-events: auto` plus `preventDefault()` on `pointerdown`. While the guided tour was open (boss demo default), that overlay sat on top of the page **and** the panel and ate every touch/pointer — so neither window scroll nor the inner panel scroller moved. `elementsFromPoint` mid-screen returned `#crewTourBlocker`.
2. **`.crew-out-trailer-body`** — `max-height: min(60vh, 520px)` + `overflow-y: auto` nested a second scroll parent (~506px client vs ~5–6k scrollHeight for a busy OUT). Content looked “cut off”; the only way to see the rest was an inner scroll the tour blocker also blocked. OUT map chips / other trailers sat below the fold of that trap.

Not the sticky chrome, axle caps, or diagram `overflow-x: hidden` — those were red herrings for this symptom.

## Fixes

1. **One page scroll parent** — `.crew-out-trailer-body` drops the max-height clamp (`max-height: none; overflow: visible`). Full Side / Top-down diagram, PUP weight strip, and piece list live in document flow; the user scrolls the page.
2. **Tour blocker is visual-only** — `.crew-tour-blocker { pointer-events: none }`. Removed `preventDefault` on blocker `pointerdown`. Dim overlay + callout bubble stay; page scroll, OUT chips, and panel controls work under the tour. Bubble keeps `pointer-events: auto` (Continue / Play without stops).
3. **In-panel OUT switcher** — chips for every freight OUT door inside the open panel so other trailers stay reachable without hunting off-screen map chips. Switching preserves Side/Top-down + deck. Short scroll hint under the title.

## Non-regressions

- Boss demo still fresh-seeds + re-plans (v48), auto-opens busiest OUT, guided tour on.
- Axle / nose / tail caps + weight strip, Mid-L/R, deck jump buttons, Side | Top-down tabs unchanged.
- Tour copy / pause toggle behavior unchanged.

## Version

- `sw.js` → `dock-app-v49`, assets `?v=49`
- stamps + SW register → **v49**
- `README.md`, `V49_NOTES.md`

## Desktop stage

`/home/box/Desktop/dock_app_v49/` — includes `styles.css` + `app.js`.

## Test (390×844) — Show boss demo → OUT panel Side + Top-down

- Stamp **v49**; console errors: none.
- Tour open + blocker `pointer-events: none` — page `scrollBy` works (~400px); mid-stack is content, not `#crewTourBlocker`.
- `.crew-out-trailer-body`: `max-height: none`, `overflow-y: visible`, `clientHeight === scrollHeight` (no nested clamp). Title→last piece page scroll span ≈ **4,400px**.
- In-panel switcher (5 OUT chips) opens other trailers and keeps Top-down; map OUT chips still tappable under tour.
- Weight strip: **is-warn** (not is-over); deck buttons Floor/Deck 2/Deck 3; Mid-L/R present; pause toggle checked; tour Continue visible.
- Screenshots: `/workspace/screenshots/2026-09-26-v49/` (see `10-`…`16-` + `report.json` / `scroll-proof.json`).
