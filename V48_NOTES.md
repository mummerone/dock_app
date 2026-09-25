# v48 — Fix boss-demo axle overload (root cause) + tour/pause polish

Baseline: **v47**. No publish — build + Desktop stage only. **`loadPlan.js` + `app.js` changed.**

## Root cause (why v47 still failed Vision Critic)

v47’s planner **did** enforce nose ≤ 3,200 / axle ≤ 20,000 on a fresh `runLoadPlan()` (stress-tested: 40/40 seeds under hard caps). Vision Critic still saw **Nose 8,250 / Front axle 22,991 / Tail 0 / rows 5–12 empty / “Heavy piece goes on the floor at the nose.”** because:

1. **`onBossDemo` reused any existing load plan** when `existingMoves.length` — it did **not** re-seed or re-plan. A stale pre-cap (v46-style nose-first Tetris) plan stayed in `localStorage` and was played as the “boss demo.” The UI stamp said v47; the **placement** was still uncapped. That matches Tail 0 + freight jammed in the nose + red axle strip.
2. **Tour “why” text still preferred H&T wording** (`wt ≥ 1200` + `section ≤ 3` → “Heavy piece goes on the floor at the nose”) even when the piece sat in the axle end-zone and contradicted the light-at-ends rule.
3. **End-zone picker was “lightest under 3,200”** — a PRO of only heavies could still put 1,200–2,200 lb pieces in sec1/sec12 (under the zone total cap but not “light freight only”).
4. **Pause toggle ↔ Play without stops** was one-way: unchecking the box did not play through (empty branch).

Caps-on-display-only was **not** the bug for a true fresh plan; **stale plan reuse on the boss-demo entry path** was.

## Fixes

1. **Show boss demo always fresh** — confirm → `seedDemoInbound` + `runLoadPlan` + Crew(5) Play. Never short-circuit on an old plan.
2. **Light-only ends in `loadPlan.js`** — sec1 / sec12 refuse pieces **> 900 lb**; heavies skip end slots and pack in the middle (redistribute, do not delete). Soft 3,000 / hard 3,200 / axle 20k unchanged. Seed guarantees light pieces on each bill. Agent pack rebuilds `sectionWeight` from existing loadout so leftover packing cannot bypass caps.
3. **Tour copy** — end zones say light-at-nose/tail for axle limit; never “Heavy piece goes on the floor at the nose.”
4. **Pause toggle** — checked on boss guided tour; unchecked plays through (same as **Play without stops**); both directions stay synced. Still **every-action** pause (not one-lap).

## Version
- `sw.js` → `dock-app-v48`, assets `?v=48`
- stamps + SW register → **v48**
- `README.md`, `V48_NOTES.md`

## Desktop stage
`/home/box/Desktop/dock_app_v48/` — includes `loadPlan.js`.

## Test (390×844) — fresh Show boss demo → busiest OUT → Top-down
- Stamp **v48**; console errors: none.
- Weight strip: **is-warn** (yellow band only, never red over) — Front 19,970 / Nose 2,988 / Tail 3,149.
- Tour Action 1 why: “Light piece at the nose keeps the axle under the limit.” (no heavy-at-nose lie).
- Pause toggle: **checked**.
- Packed pieces: **105 / 105** (0 unplaced).

| Trailer | Dest | Pieces | Nose | Tail | Front axle | Rear axle | OK |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 90001 | Salt Lake City | 43 | 2,988 | 3,149 | 19,970 | 14,993 | yes |
| 90002 | Denver | 4 | 2,651 | 0 | 2,651 | 0 | yes |
| 90003 | San Antonio | 23 | 3,164 | 3,118 | 12,531 | 3,118 | yes |
| 90004 | Missoula Montana | 22 | 3,118 | 3,025 | 15,846 | 3,025 | yes |
| 90005 | Rapid City South Dakota | 13 | 3,192 | 0 | 12,544 | 0 | yes |

- Screenshots: `/workspace/screenshots/2026-09-25-v48/`

