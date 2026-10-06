# Dock App v55: build notes (2026-10-06)

Built from v54 (commit cef8418). NOT published.
Changed files: app.js, loadPlan.js, index.html, styles.css, sw.js (+ this file). storage.js and speech.js are unchanged; index.html and sw.js load them with ?v=55.
The planner's physics are unchanged and seed 53217 is kept. The plan is byte-for-byte the same as v54 (same 100 moves and same slots; only the across-width word "Middle" is now "Center"). Totals: 156,379 lb, 100 moves, 320 pieces (220 loaded earlier), Unplaced 0, 9.6 forklift labor hours.
No savings numbers were added.

## Trailer model: one profile object
`loadPlan.js` → `TRAILER_PROFILES.van48_single` (exported as `DockLoadPlan.TRAILER_PROFILE`). All labels, gauges and checks read from it:
- length 48 ft, 12 sections × 4 ft, levels Floor / Deck 2 / Deck 3
- section groups: Nose 1 · Front 2–4 · Middle 5–8 · Rear 9–11 · Tail 12
- front support: `kind: 'kingpin'` at 3 ft, 20,000 lb (a demo limit, the same as one axle)
- rear: `kind: 'single'` axle at 42 ft, 20,000 lb (the federal single-axle limit; a tandem would be 34,000)
- `tareLb: {front: null, rear: null}` and `freightOnly: true`; freight limit 40,000 lb
- section max 3,200 lb (target 3,000), nose/tail light-piece max 900 lb, deck piece max 1,500 lb, 110 in inside / 100 in stack
- `profileRuleText()` produces the rule sentences, so a rule is said the same way everywhere

The planner constants (axle caps, section cap, end rules, loops over sections) come from the profile. app.js reads the same object (`TP`), and so do the gauges, the equipment line, the glossary-style text, the weight banner and the summary.

**Choice: "freight only", not an estimated tare share.** The demo's rear limit is one single axle at 20,000 lb, and each finished trailer already puts about 14,800–16,000 lb of freight on it. Adding even a rough trailer tare (several thousand lb per end) would push every finished trailer over that limit. Then the gauges, the "within limits ✓" and the planner would disagree, or the limits would have to change. "Freight only" keeps every number consistent with what the planner checks, so the app says it next to every check: on gauges ("Weights on board now (freight only)"), on the weight check, on the summary rows/headline/stat, on the Dock-done stop and in the glossary.

What switching trailers would take:
- **53 ft tandem:** add a profile with `lengthFt: 53`, sections (e.g. 13 × ~4 ft), `rear: {kind: 'tandem', atFt: …, capLb: 34000, label: 'Rear axles (tandem)'}`, new zone ranges, nose/tail section numbers and a freight limit. Then point `TRAILER_PROFILE` at it.
- **28 ft pup:** the same idea with `lengthFt: 28`, 7 sections, and its own kingpin/axle positions and limits.
- Either way, the demo's **sample freight and the "loaded earlier" preload** must be re-tuned and re-seeded (they were built to fill 12 sections exactly). Some demo seed code and a few comments still assume 12 sections. The slot loops, rule text, gauges, side views and support markers already follow the profile.

## Contradictions (must be zero)
13. **3,200 lb rule said once, the same way:** "Every 4 ft section, nose and tail included: 3,200 lb max (company setting)." The planner checks it on every section (it aims for 3,000). The heaviest section on any finished trailer is 3,000 lb. The new "k lb" row in the big side view shows every section's weight.
14. **Moves 22/24:** a forklift that frees up is now given work right after the drop, not at the next move. So a forklift is only shown "Waiting" when it is truly blocked, and the card states the real reason ("the next pieces for OUT 22 and OUT 23 are both at IN door 3, which already has 2 forklifts pulling from it (the most allowed)"). The run order is unchanged: the same 100 moves in the same order. In the seeded run, Waiting now appears on 3 cards (moves 21–23).
15. **Moves 98–99:** the status line counts Done and Waiting from the same status as the map: "3 of 5 forklifts working · 2 done".
16. **"100% full" vs "25 of 36 spaces":** the headline now says "floor full: no floor length left (sections 1–12, nose to tail)". The spaces count was dropped; a note explains that the blocks are pieces and the open deck spots can only take stackable pieces.
17. **Compare box:** "Your labor hours", "Your typical trailer fill %" and "Your $ per labor hour" start empty with grey "e.g." placeholders. Compare lines are computed only from typed values. Typed values stay while the summary is open (sessionStorage) and are cleared for a new run (Watch again).

## Confusions
1. **Readable at 390:** at phone width the card keeps a short trailer summary (counts, pace, "Weights now (freight only): all within limits"). "⤢ Side view" (or tapping the side view on wide screens) opens a full-size trailer view above the card: gauges, balance line, side view with ▲ kingpin / ▲ rear axle, lb per section and the equipment line. All text in the card's trailer box and in that view is at least 12px (measured). Close ✕, Escape or "Close and go back to the card" returns to the same card.
2. **Left / Center / Right** across the width everywhere (chips, slot text, top-down view, help). "Middle" is only the section group 5–8, and the help says so.
3. **Support points drawn:** ▲ kingpin (3 ft) and ▲ rear axle (42 ft) under the side views. The heavy rule is reworded to match the physics: "on the floor, weight shared by kingpin and rear axle"; why-lines give the distance from the nose and the % split.
4. **"Front-heavy for now"** is explained: loading starts at the nose by the kingpin, and pieces near the tail add mostly to the rear axle.
5. **"Back":** "was waiting since move N" is said only if a previous card showed that forklift under Waiting. Otherwise the card just describes the move. Checked on all 100 cards.
6. **Blocking reason is always specific:** trailer already has a forklift, or the inbound door already has 2.
7. **"assigned to" vs "in it":** "OUT 22: 1 left, assigned to Ray (FL 5)".
10. **Sample settings stated:** "the shift starts at 6:00 PM; the 4 min per move is a sample handling time; the departure times are sample times picked for this demo (one is tight on purpose). A real dock uses its own…"
11. **Summary bar:** "Boss demo finished: all 5 trailers loaded…" (no longer "running").
12. **Circle covering "here":** the forklift that just dropped is now one pill on its OUT chip ("4 here"), with "FL 5 coming" under it. No extra ring around the pill.
- **First Continue tap always advances** (the move animation is finished at once). The double-tap guard only ignores a second tap within 400 ms of the last ACCEPTED tap.

## Not built (WANTS)
Trailer types, scans, OS&D, TMS, logins, export, ROI and hazmat were not built. "Coming in the real version" now also lists exceptions (freight that doesn't fit, a late trailer) and other trailer types as a setting.

## Tests (390×844 and 1280×800)
- Quick tour (8 stops) and every move (100 cards): no errors; build stamp v55.
- Map/card/status consistency on all 100 cards at both sizes: 0 problems. Checked: each forklift drawn once, the chips sum to the move number, the Waiting/Done notes match the map, the status-line counts match the map, no "back at work" or "work is handed out", "was waiting" only after a card showed Waiting, every Waiting has a specific reason, and a Done forklift never moves again.
- First tap: 30/30 first taps advanced mid-animation; 30/30 second taps within 400 ms were ignored; taps at ~450 ms advanced.
- Compare: blank by default, placeholders "e.g.", values kept on re-render, blank after Watch again.
- Tap-to-expand view: opens from the button and from the side view, closes by button and Escape, and returns to the same card. Minimum text 12px.
- 20 stress runs × every/quick × both sizes; resume on reload (every and quick, both sizes); plan identical to v54; contrast audit.

### Final results (05:30 MDT)
- Stress: 20 runs each for every-move and quick, at both sizes (80 runs), using single, double and triple taps: 0 bad (no quits, no errors, no page reloads, all reached the summary).
- Resume on reload: every move (move 7 → 7 → 8), quick tour during fast play (stop 3 → 3 → 4), the summary after a reload, and a reload on a Waiting card (move 22: same note and status line) all pass at both sizes.
- Seeded totals: 156,379 lb, 100 moves, Unplaced 0, 9.6 forklift labor hours. 3 repeat runs of the planner gave identical results, and the plan is identical to v54. The heaviest section on any finished trailer is 3,000 lb, and there are no heavy pieces in the nose or tail.
- Contrast audit: one item, unchanged from v54: the disabled "Agent packed this (demo)" button (4.03:1; disabled controls are exempt).
- Known: the small door/city/count labels on the OUT chips on the map are about 10px at 390 (the 12px rule was applied to the card's trailer box, the bigger trailer view and the "here"/"coming" text).
