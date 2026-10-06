# Dock App v54: build notes (2026-10-06)

Built from v53 (commit dc064f9). NOT published.
Changed files: app.js, index.html, styles.css, sw.js (+ this file). loadPlan.js, storage.js and speech.js are unchanged; index.html and sw.js reference them with ?v=54.
Seed 53217 is unchanged, so the plan is the same as v53: 100 moves, 156,379 lb, 320 pieces (220 loaded earlier), Unplaced 0, 9.6 forklift labor hours.
No savings numbers were added. The compare box only does math on the numbers the boss types in.

## Contradictions (Virtual Boss #5)
- **#22 Tight vs "5 of 5 on time".** "Tight" now means *on time, under 15 min to spare* everywhere: the glossary, Stop 6, the trailer box, the pace badge ("on time, tight") and the summary.
  - Stop 6: "A tight departure: OUT 23 (still on time)". The card says OUT 23 is done at 7:45 PM, leaves at 7:55 PM, 10 min spare.
  - Summary headline: "…5 of 5 on time (OUT 23 tight: 10 min to spare)". Stat: "5 of 5 on time · OUT 23 tight (10 min to spare)".
- **#23 Endgame text from the real data.** The "waiting / done" notes are built when the card shows, from the same remaining-move data the map uses. The old notes came from earlier, at decision time.
  - A forklift is called "Done for this run" only when no moves are left in line. The note lists what is left, e.g. "(OUT 21: 1 left, Luis (FL 3) in it; OUT 22: 1 left, Dee (FL 4) in it)".
  - The waiting reason is checked against the live inbound-door count and never assumed. It reads either "the next piece for OUT 21 is ready, and the forklift free longest takes it" or "…at IN door 3, which already has 2 forklifts".
- **#24 One source of truth for forklift status.** The map now has one status per forklift:
  - pulling (at an IN door);
  - just dropped (drawn on its OUT door, "here");
  - Waiting;
  - Done (its own group on the map).
  The card notes use the same status. A forklift that is Done is never narrated moving again. This was checked automatically on all 100 cards at both widths.
  - Handoffs say when they happened: "Maria took over OUT 24 from Ray right after move 23: Ray had just dropped a piece there…".

## Confusions (21)
1. **Floor vs weight.** "100% full by floor space at 76–80% of the weight limit: space-full, not weight-full, normal for LTL". This appears on the landing page, in the summary note and on the trailer row chips ("Floor: 100% full", "Weight: 79% of 40,000 lb").
2. **Move defined.** "1 move = one forklift trip carrying one piece" appears on the landing page, on Stop 1 and in the glossary.
3. **Map key.** It reads: circle = forklift where it is now; "FL 3 coming" = bringing that trailer's next piece; IN / OUT / empty. Forklift labels read "Ray (FL 5)" everywhere.
4. **Travel rule.** Stop 1: "Each move ≈ 4 min handling + 0.5 min per door of travel, rounded up to whole minutes".
5. **Key rules shown open on Stop 1.** This covers the rules, "Reading the map" and the trailer (a "more below ↓" cue shows there is more to scroll). The fold-out now says "More: all rules, timing and sample data".
6. **Phone.** The map is more compact, and the weights show as a 2×2 grid. At 390×844 each stop shows the trailer box with a mini side view and the axle/nose/tail weights under the card text.
7. **Equipment.** "48 ft trailer · 20,000 lb per axle" appears on every trailer box. The full text says 48 ft, 12 × 4 ft sections, front (kingpin) + single rear axle, 20,000 lb each (federal single-axle limit, stricter than a 34,000 lb tandem), and other trailer types become a setting later.
   (A "28 ft pup" label was NOT used: the planner's model is 12 sections × 4 ft = 48 ft, so "28 ft" would contradict the side view and the 4 ft nose/tail.)
8. **40,000 lb basis.** "Weight % = freight ÷ 40,000 lb: the two 20,000 lb axle checks added together, the most freight this demo lets one trailer carry (a demo setting)."
9. **Stop 2 animation.** Each move now plays on the map: a small piece travels from the inbound door to the OUT door (650 ms on a card, shorter during fast play). Reduced-motion is respected, and the animation never blocks taps.
10. **Forklift on the OUT door after a drop.** It is drawn on the OUT chip with "here", and its inbound door no longer shows it.
11. **Labels.** Forklifts read "Ray (FL 5)" in cards, notes, the panel and the summary.
12. **Stop 4 heading matches the picture.** "All 5 forklifts busy at once, each loading a different OUT trailer". The text says who just dropped where and that the other 4 are picking up.
13. **Stop 5.** It has a deck rule box (Deck 2/3 on load bars, ≤1,500 lb, never heavier than the piece under it, stack under 100 in), and the just-placed piece is highlighted in the mini side view.
14. **Stop 6.** The tight explanation is said once (the box hint is not repeated on this stop).
15. **Axle balance rule.** "Balanced = the heavier axle carries no more than 25% more than the lighter". It is stated in the key rules and glossary, and the trailer box shows the real % ("rear carries 2% more").
    All 5 finished trailers are within 6%, and the same number is used everywhere.
16. **Light / heavy.** "light = 900 lb or less; heavy = over 900 lb" appears on Stop 3, in the "why" lines, the key rules and the glossary.
17. **Labor hours scope.** "Forklift time for these 100 moves only (5 forklifts × 115 min). Not included: the 220 pieces loaded earlier, clerks, and breaks."
18. **Busy %.** Each forklift shows "busy 89% (102 min) · waiting 11% (13 min)". The definition: busy = driving + handling ÷ the 115 min run; the rest is waiting, and the note says why.
19. **Side view shows side-by-side pieces.** Each side-view space now draws one block per piece (left/middle/right side by side), both on the card mini view and in the big side view. At 1280 the side view sits above the weight check, under the map.
20. **1280 width.** The map uses the full left column, the 5 inbound doors stretch to match the OUT row, and forklifts sit side by side. The summary uses up to 1180 px with 3-column stats and rows.
21. **Every-move label.** "Every move · Move 12 of 100". The intro reads "Every move · 100 moves, one card each".
- Hazmat: a one-line note on the drums-on-deck "why" (moves 45 and 71): "The sample freight has no hazmat; real hazmat loading rules are coming in the real version."

## Bugs
- **Start reloaded the page on a fresh first run.** No code path reloads or navigates. The likely trigger was the brand-new service worker taking control of the open page on its first install.
  - The worker no longer calls clients.claim(): a new worker never takes over an open page and only serves the next visit.
  - The worker is registered 4 s after the page has fully loaded, so it never installs while the tour starts.
  - Tested in fresh browser profiles (empty storage, no worker): Start plus 21–25 cards while the worker installed gave 0 navigations. If a reload ever does happen, the tour resumes on the same card.
- **Compare box.**
  - Typing saves on every keystroke and updates only the result in place.
  - Changing minutes per move or the $ rate re-renders but keeps typed values (and focus).
  - Values persist through reload and Watch again. A cleared box stays cleared.
- **Watch every move Continue.** The 400 ms double-tap guard is kept, but the button now visibly settles (dimmed) during it, so a tap is never silently eaten. Taps at ~460 ms work even while the piece is still moving on the map (30/30).

## Not built (kept for later, as asked)
TMS import, scans, OS&D photos, export, driver logins, ROI beyond the compare box, trailer type settings, hazmat rules.

## Tests (headless Chrome, 390×844 and 1280×800; screenshots in /workspace/screenshots/2026-10-06-v54/)
- Full walks:
  - Quick tour, 8 stops at both widths.
  - Every move, 101 cards at both widths.
  - No errors.
- Consistency on all 100 cards (both widths):
  - Every forklift is drawn exactly once.
  - The Waiting/Done names in the note equal the map groups.
  - No Done forklift works again.
  - Trailer counts sum to the move number.
- Stress (mixed single, double and triple taps), 20 full runs:
  - Every move: 8 runs at 390 and 4 at 1280.
  - Quick tour: 4 runs at 390 and 4 at 1280.
  - Results: 0 quits, 0 reloads/navigations, 0 skipped cards, 0 errors.
- Fresh profile Start (quick + every): 0 navigations. A returning visit with the worker active: 0 navigations, and the tour resumes.
- Reload mid-tour (every + quick, including during fast play) resumes on the same card. Summary, solo and exit flows are unchanged.
- Determinism: 3 loads give 1 identical result (100 moves, 156,379 lb, all rules legal, front/rear ratios 1.01–1.06).
- Contrast: same single flag as v53 (the *disabled* "Agent packed this (demo)" button, 4.03:1).
