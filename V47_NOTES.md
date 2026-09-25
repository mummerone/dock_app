# v47 — Nose/tail light freight + axle caps in the planner

Baseline: **v46**. No publish — build + Desktop stage only. **`loadPlan.js` changed.**

## What bosses asked for
Pup trailers were overloading the axles (and the first/last ~4 ft). They want a **restriction on the first 4 feet and the last 4 feet**: freight there must be **light enough**. Do **not** drop freight just to make numbers pretty — **reorder / relocate by weight**. Warnings alone are not enough; the planner must place correctly.

## Section → feet mapping (12 bays nose→tail)

| Zone | Sections | ≈ length on 48–53 ft van | Cap |
| --- | --- | --- | --- |
| **Nose zone** | **1** | first ~4–4.4 ft | **3,200 lb hard** (prefer ≤ ~3,000; UI warn ≥ 2,800) |
| Middle | 2–11 | middle of trailer | (axle half caps apply) |
| **Tail zone** | **12** | last ~4–4.4 ft | **same as nose** |
| Front axle share | 1–6 | nose half | **20,000 lb** |
| Rear axle share | 7–12 | tail half | **20,000 lb** |

## Placement rule (plain English)
1. Still pack **high-and-tight per bay** (floor A → deck B → deck C before leaving a section; city loads floor-only).
2. Slot fill order for weight: **nose → tail → middle** so end zones get first pick of light pieces.
3. In **nose / tail**: choose the **lightest** piece that still fits under the zone + axle remaining budget (prefer staying under soft 3,000 lb).
4. In **middle**: floor gets **heaviest** that fits; decks get shortest/lightest (unchanged Tetris feel).
5. If a slot would bust a nose/tail/axle cap, **skip that slot** and try the next — do not place over the cap.
6. When filling the nose, **reserve** light pieces for the tail so the tail is not left with only heavies.
7. After packing, moves are sorted back to **nose→tail Tetris order** for the forklift demo.
8. Demo seed mixes light + heavy sizes so end zones have light freight available. PROs are rearranged, not deleted.

## UI
- Weight strip: **Front axle · Rear axle · Nose zone · Tail zone** (warn 2,800 / flag 3,200).
- Messages: **“Nose too heavy — use lighter freight here”** / **“Tail too heavy — use lighter freight here”**.
- Top-down keeps Mid-L / Mid-R, deck buttons; nose + tail rows highlight on warn/over.
- Guided tour, Crew, Operator, Solo, Ground unchanged.

## Version
- `sw.js` → `dock-app-v47`, assets `?v=47`
- stamps + SW register → **v47**
- `README.md`, `V47_NOTES.md`

## Desktop stage
`/home/box/Desktop/dock_app_v47/` — includes `loadPlan.js`.


## Test (390×844) — Show boss demo → busiest OUT → Top-down
- Stamp **v47**; console errors: none.
- Weight strip shows Front / Rear / **Nose** / **Tail**.
- Demo trailers: nose & tail **≤ 3,200 lb** (warn band ~2,800–3,200 OK); axles **≤ 20,000 lb**.
- Example busiest OUT: nose ~3,198 · tail ~2,975 · front ~19,913 · rear ~7,706 (all under hard caps).
- Packed pieces this run: **85 / 85** (0 unplaced). Random demo seed varies (~85–135); not dramatically below v46 for same seed family — freight relocated by weight, not dropped.
- Screenshots: `/workspace/screenshots/2026-09-25-v47/`
