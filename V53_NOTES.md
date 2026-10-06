# Dock App v53 — build notes (2026-10-06)

Built from v52 (commit 9601075). NOT published. Changed files only: app.js, index.html, loadPlan.js, styles.css, sw.js (+ this file).
storage.js and speech.js are unchanged (index.html/sw.js just reference them with ?v=53).

## P1 — Contradictions
1. **Full and balanced (planner, loadPlan.js).** Demo seed 53217. The "loaded earlier" freight is now chosen so that the demo moves end
   exactly at the tail: every trailer is loaded through section 12 (100% of floor length, 36/36 floor spaces).
   Section 12 is filled first with the heaviest pieces of 900 lb or less (`reserveTail`).
   Result: 100 moves, Unplaced 0, 156,379 lb, all rules legal, deterministic (same result on 3 loads).

   | OUT | Destination | Fill | Front / Rear lb | Ratio |
   |---|---|---|---|---|
   | 21 | Salt Lake City | 100% | 15,922 / 15,603 | 1.02 |
   | 22 | Denver | 100% | 15,661 / 15,899 | 1.02 |
   | 23 | San Antonio | 100% | 15,612 / 14,776 | 1.06 |
   | 24 | Missoula Montana | 100% | 15,859 / 15,158 | 1.05 |
   | 25 | Rapid City South Dakota | 100% | 15,880 / 16,009 | 1.01 |

   - The "last N ft stays open" note is gone (summary, side caption, planner text).
   - Landing: "In the demo, all 5 trailers leave **100% full (floor length)**". The summary headline says the same: "5 trailers out 100% full (floor length)".
   - One-time card note, shown once per tour even across a reload (on the first card where it applies): why a part-loaded trailer is front-heavy, with that trailer's finished front/rear numbers.
   - The trailer box line only states what is true at that moment: "Front-heavy for now…", "Axles balanced now…", or "Rear axle carries more right now".
   - The heavy-piece "why" gives the real split for that section (e.g. "about 21% on the front axle and 79% on the rear"; sec 11 says "over the rear axle").
     The words "both axles share" are gone.
2. **Tight-departure advice.** One wording everywhere (Stop 6, trailer box, panel, glossary): "hold the trailer N min (for a 15 min cushion), or start it earlier next shift.
   Adding a forklift won't speed up this one trailer: never two forklifts in one trailer at the same time."
   There is no "move up the priority list" option, because the planner has no priority setting.
3. **Handoffs.** The planner records the real reason when a different forklift takes over a trailer. The card for the new forklift's first drop says, for example:
   "Dee took over OUT 22 from Maria: Maria was reassigned to OUT 24 (OUT 22's next piece is at inbound door 3, which already has 2 forklifts)",
   or "…Maria had just dropped a piece here, and Dee had been free longer…", or "…after waiting for a free inbound door…".
   "One forklift per trailer (door)" and "No two forklifts load the same trailer" are gone everywhere (card, banner, board hint, glossary);
   the rule now reads "never two forklifts in one trailer at the same time".
4. **Map/summary timing.**
   - A door is never shown "empty" while a forklift is drawn there with its last piece. It turns "empty" when that forklift leaves.
   - All times are whole minutes now: the travel time on each move is rounded up to the whole minute. The clock, "est. done", "loaded at",
     summary "done" and "spare" therefore come from one number, and each trailer's summary done time equals the card clock on its finishing move.
     This was verified for all 5 doors at both widths.
5. **Piece labels.** Boss cards say "piece 2 of 4 for PRO 700110 (loads in slot order)". Label numbers stay on the Operator/clerk screens.
6. **Doors setting.** In the demo, the setting opens at 10, the doors on the map (5 inbound + 5 outbound), with a matching hint.
   Leaving that shown value untouched saves nothing.
7. **Operator from summary.**
   - One state: "Plan ready: 100 moves · not started" with "Tap Start my jobs to get move 1."
   - A new **Back to summary** button appears when the boss demo is finished.
8. **First tap.**
   - Start (intro), Skip to summary and Play without stops always take the first tap.
   - The 400 ms guard applies only to Continue right after a move card appears.
   - A second tap of a double tap that lands on the exact spot where Continue was is ignored.

## P1 — Phone
9. **One fixed card slot at 390.**
   - The card is full width, running from the bottom of the dock map to the bottom of the screen, on every stop and every move (measured: same left/top/width/height on all 101 cards).
   - The map is pinned to the top. Its height no longer changes: doors keep room for 2 forklifts, the "Waiting" row is reserved, and the OUT chip forklift line is reserved.
   - No page text peeks between the map and the card. The OUT panel is fully covered; the card's own "Trailer being loaded" box replaces it.
   - Wide screens also got one fixed slot (top 12, full height, buttons at the bottom).
   - OUT trailer chips shorten city names by whole words ("Missoula", "Rapid City"), so no word is cut in half.

## P2 — Clarity
10. Every weight in the card's trailer box shows its value and limit in lb, e.g. "Nose 2,815 / 3,200 lb".
11. Tiny map key inside the map: forklift (FL n), IN 81001, OUT · loaded/total, empty, and gray = loaded earlier. The old duplicate legend is retired.
12. The landing defines LTL once. "8 stops = 8 key moments"; "100 stops = every single forklift move". The demo now has 100 moves (it had 98), and the buttons say so.
13. Intro:
    - Stop 1 says "Each move ≈ 4 min + travel (change it on the summary)".
    - Gray freight is "loaded by the earlier shift with this same planner".
    - Weights come from the bill of lading (scale weight when available).
    - Departure times are "typed in or imported from your schedule (coming in the real version)". There is no departure-time entry yet, so it is labeled as coming. No TMS is named.
    - "The box on top" is now the labeled **Trailer being loaded** box.
14. 1280:
    - "A space = one section on one level (12 × 3 = 36). Up to 3 pieces sit side by side in one space, so pieces outnumber spaces."
    - While a trailer is loading: "N of 36 spaces in use (M when done)".
    - The weight check uses a bigger font at ≥900 px.
15. Summary:
    - (a) Shows "% of floor length" and "% of legal weight" (freight ÷ 40,000 lb, the two 20,000 lb axles).
    - (b) "Your dock today" compare box: your labor hours and your typical fill %. Blank by default. It shows the hours difference (with $ if a rate is entered) and the fill points.
    - (c) "Busy % assumes no breaks; add breaks to the min-per-move estimate."
    - (d) "Forklift drivers: coming: driver logins…" plus what works today.

## Version
v53 everywhere: styles/scripts ?v=53, 3 build stamps, sw.js CACHE dock-app-v53 + assets ?v=53, app.js registers sw.js?v=53.

## Tests (Chrome via Playwright, 390x844 and 1280x800, both tour modes)
- Walks (Quick: 8 stops; Watch every move: 101 cards = intro + 100 moves), all at both widths:
  - 0 page errors.
  - 0 boss cards with "label".
  - 0 banned phrases ("one forklift per trailer", "stays open", "TMS", "both axles share").
  - 0 "empty" doors with a forklift on them.
  - 0 toasts while a card is open.
  - Never more than 2 forklifts on one inbound door.
  - Every trailer-box weight shows "/ limit lb".
- Phone card pinned: one geometry on every card. At 390: left 6, top 405, width 378, height 439. At 1280: top 12, height 776.
  No page text shows between the map and the card, and nothing peeks at the top of the screen.
- Timing: "est. done" is always later than the clock while pieces are left, and "loaded at" is never later than the clock.
  The summary done times (21: 7:53, 22: 7:55, 23: 7:45, 24: 7:51, 25: 7:48 PM) equal the card clock on each trailer's finishing move.
- Handoffs: 22 plain handoff notes in Watch every move, each with the planner's real reason.
- Summary: the headline matches the landing claim (100% full, floor length).
  - Compare box blank → "Type your own numbers"; filled with 12 h / 80% / $28 → "2.4 h less ($68)" and "+20 points".
  - Operator from summary: one state, and Back to summary works.
  - Doors setting shows 10 with the sample-dock hint.
- Regression at both widths:
  - Unplaced 0, 100 moves, 0 rule violations, plan unchanged after play.
  - Determinism: 3 loads give the same result (100 moves, 156,379 lb, the same per-trailer numbers).
  - Own-freight backup and restore is identical (toast and notice).
  - Scrolling under the tour works, an OUT chip can be tapped under the tour, and the top-down view has 36 cells with Floor/Deck 2/Deck 3.
  - Solo, Crew (5), Ground and Operator all work.
- Resume after reload:
  - Every mode: move 7 → move 7 → move 8. After the summary the reload goes back to the summary; after Solo or Exit, no resume.
  - Quick mode: reload during fast-play goes back to Stop 3 → Stop 4.
- Stress: 20 runs × 4 sets (Quick and Every × 390 and 1280), with single, double, 60 ms and triple taps:
  0 quits, 0 skipped cards, 0 errors, 0 navigations, every run ends on the summary.
- Contrast (WCAG AA): 1 flag at both widths. It is the *disabled* "Agent packed this (demo)" button on the Plan tab (4.03:1).
  Disabled controls are exempt from AA, and this button was not touched in v53.
