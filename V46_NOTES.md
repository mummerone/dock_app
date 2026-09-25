# v46 — Top-down trailer view + PUP axle / nose weight

Baseline: **v45**. No publish — build + Desktop stage only. `loadPlan.js` **untouched**.

Small display fix: when an OUT loadout has `groups: []`, the panel trusts that empty list (does not fall back to leftover `moves`). Still no packer changes.

## What bosses asked for
1. **Top-down (bird’s-eye)** view of each OUT trailer, as an alternative to the existing side view.
2. Organize by **deck, lowest first** (Floor → Deck 2 → Deck 3).
3. **Deck jump buttons** — tap Floor / Deck 2 / Deck 3 (only decks that have freight on that trailer).
4. Each deck shows a **height line** then the overhead layout of pieces on that deck.
5. **Middle split** across trailer width: columns **Left | Mid-L | Mid-R | Right**. Existing `…/Middle` slots span both middle halves (display only — packing still uses Left/Middle/Right).
6. **PUP axle / nose weight** live totals with plain-language warn/over flags.

## How to use
1. Dock → Crew → **Show boss demo** (or tap an OUT chip).
2. OUT trailer panel opens on **Side view** (unchanged default).
3. Tap **Top-down**.
4. Tap **Floor**, **Deck 2**, or **Deck 3** to jump decks.
5. Tap a piece rectangle to highlight it and scroll the list.
6. Read **PUP axle check**: Front axle · Rear axle · Nose zone. Red = over limit.

## Weight rules (display + warn; does not change the packer)
| Check | Rule | Cap |
| --- | --- | --- |
| Front axle | Weight in sections **1–6** (nose half) | **20,000 lb** |
| Rear axle | Weight in sections **7–12** (tail half) | **20,000 lb** |
| Nose zone | Weight in section **1** (first bay ≈ 4 ft on a 48–53 ft van) | Warn ≥ **2,800 lb**, hard flag > **3,200 lb** |

Simple axle share: front half of bays → front axle, rear half → rear axle. Pieces without a parseable slot split half/half so the total still shows. Pieces without weight → banner says check skipped.

Over-limit: red cells + messages like **“Nose zone over weight — move freight back”** / **“Front axle over 20,000 lb”**. Does **not** rewrite `loadPlan.js` placements.

## Kept intact
Side-view diagram, guided tour, Show boss demo, Solo, Crew (5), Operator, dock wall, LOAD SLOT, honest Packed/Unplaced counts, forklift spread, Ground.

## Version
- `sw.js` → `dock-app-v46`, assets `?v=46`
- stamps + SW register → **v46**
- `README.md`, `V46_NOTES.md`

## Desktop stage
`/home/box/Desktop/dock_app_v46/` — `app.js`, `styles.css`, `index.html`, `sw.js`, `README.md`, `V46_NOTES.md`
