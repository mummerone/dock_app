# v45 — Guided tour polish (Vision Critic)

Baseline: **v44**. No publish — build + Desktop stage only. `loadPlan.js` untouched.

## User decision
Keep pausing at **every** action (do **not** reduce to one-per-forklift). Queue same-tick multi-forklift actions one-by-one.

## Critic fixes
1. **Light both ends** — pulse/ring the forklift badge **and** the named OUT chip (door tile / god pill fallback). Scroll so both stay in view when possible.
2. **Dock callout at an edge** — prefer bottom on phone (flip to top when needed). Max-width ~340px at 390 viewport. Arrow still aims at the forklift. Repositions on resize/scroll. z-index above sticky chrome. Outside tap still does **not** dismiss.
3. **Boss payoff in the pop-up** — one-line status header: `Moved N of T · X of Y working · nobody stacked` (honest counts).
4. **Short copy** — bold lead (`Forklift N · inbound door A → OUT B (DEST) · nose, floor`), smaller detail (piece/dims/lb), optional why line. Cap ~3 lines. Keep `Action N of T`.
5. **Pause toggle matches reality** — checked when guided mode is on; Show boss demo turns guided **ON** and checks the box; label `Pause at each action (guided tour)`; localStorage `dockApp.crewTourPause.v1`. Continue stays primary; Play without stops turns guided off and unchecks.

## Optional (done)
- Operator **Start my jobs** hero CTA unified to orange (same family as Show boss demo).
- Softened Solo/Crew jargon hint to plain words.

## Kept
Continue, Play without stops, every-action pause, same-tick queue one-by-one, 44px taps, no outside-tap dismiss, no `loadPlan.js` changes, Operator map-free, Solo/Crew(5)/Ground, forklift spread, v43 side-view fit, honest banner counts.

## Version
- `sw.js` → `dock-app-v45`, assets `?v=45`
- stamps + SW register → **v45**
- `README.md`, `V45_NOTES.md`

## Desktop stage
`/home/box/Desktop/dock_app_v45/` — `app.js`, `styles.css`, `index.html`, `sw.js`, `README.md`, `V45_NOTES.md`
