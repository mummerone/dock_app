# Dock App v51 — notes

Built on live v50 (commit 84d08f1). Answers Virtual Boss walkthrough #2 (47 questions). NOT published.

## Changed files (stage only these)
app.js · index.html · loadPlan.js · storage.js · styles.css · sw.js · V51_NOTES.md
(speech.js, manifest.json, icon.svg are unchanged; index.html still loads speech.js with ?v=51 so every asset uses one cache version.)

Version: stamps v51 (3 places), every ?v=51, SW register `./sw.js?v=51`, CACHE `dock-app-v51`.

## P1 Trust
1. **Fixed sample freight.** A seeded random generator (seed 51051) is used for the sample freight and the load plan, and the crew simulation has no randomness. Every demo load at any width, including after a reload, gives 98 moves, 207 pieces on board and 134,466 lb, with identical per-trailer weights. Crew "Plan ready (N moves)" now counts from the same move list as the tour, so N = T = 98.
2. **One count for all OUT chips.** The dock-wall chip, panel chip switcher, HUD pill, panel header and tour-card trailer box all read the same `outFillForDoor()` count (pieces on board now / total), from the final plan. A test checked all 5 match on every one of the 98 cards.
3. **Rear axle is computed for real.** The planner and the UI share one lever model (front support 3 ft, rear axle 42 ft, 4 ft sections), so every piece's weight is split between the two axles. Planned rear axles are 9,976–11,595 lb. Live values grow move by move.
4. **One set of section names:** Nose (sec 1) / Front (2–4) / Middle (5–8) / Rear (9–11) / Tail (12). Cards, why lines and the top-down view all use them; the top-down rows are labelled.
5. **One source for "forklifts working".** `crewWorkLine()` drives the header pulse, the board hint, the spread banner and the tour status line.
6. **At most 2 forklifts per inbound door**, and never two forklifts on one OUT trailer. The copy now says exactly that: "No two forklifts load the same trailer · at most 2 pull from one inbound door". Waiting forklifts move to the Waiting row instead of sitting on a door.
7. **After the summary**, the header reads "Done — all 5 finished".
8. **One start rule, every time:** no pop-up. Your freight is always backed up first. The tour's first card is the start card, and it mentions your saved freight ("Your own freight (1 PRO) is saved…") only when you have some. The same thing happens from demo mode and on Watch again.
9. **Tour card at 390.** A compact trailer box is pinned at the top of every card: OUT door and destination, pieces on board, leave time and pace, and live Front/Rear axle and Nose/Tail weights. The card can scroll if needed. The why line is never cut off (tested on all 98 cards at both widths).
10. **Door board labels:** the inbound trailer number sits on a dark pill at 0.66–0.72 rem, layered above the cell; the "Trl" prefix shows on wide screens only.
11. **Exit demo buttons** are dark with a yellow border and yellow text, on the banner, the summary and Crew. After Exit you land on Log freight at the top, with a toast and a green notice: "Your freight is back — 1 PRO restored (1 piece)" and a "Show my freight" button. With no freight of your own: "Demo closed — sample freight removed".
12. **Striped banner:** "SAMPLE DEMO — not your dock", plus a line saying whether your freight is saved. It shows on every screen and survives a reload.

## P2 Win the boss
13. **Trailers start partly loaded "earlier in the shift"** (gray hatched in the side and top-down views, and on the legend). That freight counts in the fill %, piece counts, weights and axles. The demo's 98 moves bring every trailer to sec 10, which is **83% of floor length on all 5 trailers**. No light-trailer note appears, because none is light (the note only shows under 50%). All rules are legal and Unplaced is 0.
14. **Skip to summary** button (secondary) on every card, beside Play without stops. Continue stays primary and full width. On the last card only Continue to summary shows.
15. **New landing:** headline "Every trailer out full, legal and on time", 3 ticked bullets and a big Watch the boss demo button. Below it is the "Log freight (dock clerk)" heading. The tagline no longer says "same PRO = same trailer". The voice status reads "Tap mic to speak dimensions (only listens when tapped)".
16. **Crew mode lines:** one line each for Show boss demo, Solo forklift, Crew (5) and Ground, plus "All four are views of the same planner and the same plan."
17. **Plain-word definitions:**
    - Crew help glossary and intro: light ≤ 900 lb, deck (load bar / second level), at target 95–100%, tight < 15 min slack (add a forklift or hold the trailer), OS&D (Over, Short & Damaged), fragile, and the 5,000 lb forklift limit.
    - Weight note: "20,000 lb per single axle is the federal limit; the 3,200 lb nose/tail zones are a company setting".
    - Intro card: sample names come from driver logins, departure times come from the TMS or yard schedule, and drivers get moves on the Operator screen.
    - Pace line shows the tight/late hint.
18. **One size format:** "48×40 in pallet" (L×W in inches, plus kind). List views add "· 48 in tall".
19. **Fragile pieces:** each destination has one fragile carton. It stays on the floor and nothing is stacked on it, and its why line says so. A 5,000 lb forklift capacity check is built into the planner and mentioned in the intro and glossary.
20. **Summary additions:**
    - Labor hours (forklifts × minutes).
    - A "$ per labor hour" input, blank by default; cost appears only once a rate is entered.
    - A minutes-per-move input (default 4) that re-runs the same plan and updates times and on-time counts. Departure times stay fixed.
    - "Busy % is computed from the plan".
    - A "Start using it for real" list with buttons for Doors on this dock and Open Operator screen.
    - An OS&D definition.
21. **Times follow distance:** a move takes the minutes-per-move value plus 0.5 min per door between the inbound door and the OUT door. Whichever forklift is free first takes the next move. Sample order: 2 5 3 4 1 2 5 3 4 1 2 5 4 3 2 1 4 5 3 2…, so it is not 1→5. The intro says this once.

## Tests (headless Chrome, 390×844 and 1280×800)
Results at both widths:
- Full tour: 98 cards, each paused, "Move N of 98" in sequence.
- Chip = panel = switcher = pill = card-box count on every card.
- Never more than 2 forklifts per inbound door.
- Why line never clipped. Card and trailer box always in view.
- Header, board hint and banner always agree. "Done — all 5 finished" at the end.
- 0 console errors.
- Determinism: 3 loads (fresh, then reload + again, then exit + again) were identical: 98 moves, 134,466 lb, same per-trailer figures. 390 and 1280 match each other too.
- Legality (fresh and after Play without stops):
  - 0 violations: duplicate slots, heavy end pieces, deck rules, stacking on fragile, any 4 ft section over 3,200 lb, axles over 20,000 lb, over forklift capacity.
  - Unplaced 0. The plan is unchanged after Play.
- No confirm pop-up from landing, from demo mode, or on reload. The banner shows on reload.
- Skip to summary, summary inputs, Exit (toast, scroll top, freight byte-identical), and Solo / Crew (5) / Ground / Operator smoke tests all pass.

Screenshots: /workspace/screenshots/2026-10-05-v51/

| Trailer | Destination | Pieces (earlier + moved) | lb | Front / Rear axle | Nose | Fill |
|---|---|---|---|---|---|---|
| 90001 | Salt Lake City | 38 (19 + 19) | 26,460 | 16,230 / 10,230 | 2,998 | 83% |
| 90002 | Denver | 36 (16 + 20) | 26,075 | 16,099 / 9,976 | 2,974 | 83% |
| 90003 | San Antonio | 43 (24 + 19) | 26,827 | 16,442 / 10,385 | 3,000 | 83% |
| 90004 | Missoula Montana | 46 (27 + 19) | 27,971 | 16,376 / 11,595 | 2,934 | 83% |
| 90005 | Rapid City South Dakota | 44 (23 + 21) | 27,133 | 16,045 / 11,088 | 2,997 | 83% |
