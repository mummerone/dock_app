# Dock App v56: build notes (2026-10-06)

Built from v55 (the live build, staged copy in /workspace/v55). NOT published.
Changed files: app.js, index.html, styles.css, sw.js (+ this file). loadPlan.js, storage.js and speech.js are unchanged; index.html and sw.js load them with ?v=56 (cache `dock-app-v56`).
The planner and seed 53217 are unchanged, and so is the run: all 100 moves happen in the same order, by the same forklifts, into the same slots as v55 (checked card by card at 390). Totals: 156,379 lb, 100 moves, 320 pieces (220 loaded earlier), Unplaced 0, 9.6 forklift labor hours, moves per forklift 20/20/20/21/19, done 7:55 PM.
The Quick tour is still 8 stops plus the summary. Stops are now at moves 0, 1, 17, 21, 25, 58, 60, 100: (1) the dock, (2) first move, (3) heavy piece, (4) **NEW: a waiting moment**, (5) all 5 busy + who changed trailers, (6) deck stack, (7) tight departure, (8) dock done. The old "OUT 25 fully loaded" stop was dropped to make room.

## Contradictions (must be zero)
1. **Deck stack is real.** The "floating" Deck 3 piece in v55 was a drawing problem: the side view packed each level's pieces to the left, so a Left piece on Deck 3 could look like it sat over an empty spot. Now every piece is drawn in its own third of the width (Left | Center | Right, an empty third stays empty), so a deck piece is drawn right above the piece it sits on. The move order also enforces it: `crewDeckSupportLoaded()` means a Deck 2 piece is never picked before its Floor piece is on board, and a Deck 3 piece never before its Deck 2 piece (the seeded run already obeyed this, so the order did not change; the planner's plan order has 0 floating pieces). Stop 6 names the whole stack with when each piece went in: "This 250 lb drum on Deck 3 (sec 10, Left) sits on the 399 lb drum on Deck 2 (loaded at move 44), which sits on the 429 lb drum on the Floor (loaded at move 30). Both are on board before this piece goes in." In the side views the pieces holding it up get a yellow outline, and the legend says so.
2. **"All on board" only when it's true.** The side-view note uses the counts in the picture at that moment: "Right now 58 of 66 pieces are on board; 8 planned pieces (orange outline) still to load." "All 66 pieces are on board." appears only when nothing is left.
3. **One pickup door.** The door the map draws a forklift at on move N is the door the card says it came from on move N+1 (checked on 99 card pairs per size, e.g. Luis moves 19→20).
4. **Each reason computed once.** Assignments are decided in one place (`crewAssignFreeForklifts`), right after a drop, from the live state the map shows on that card. The reason is stored with the decision and printed once ("Dee (FL 4) takes OUT 23's next piece, from IN 3 (IN 3 has room again: Luis's trip from there just ended)"). The chip under that OUT trailer then shows "FL 4 coming" (or "FL x next" while that forklift is still finishing a drop elsewhere). Nothing re-explains it later, so the two different "why Ray went to OUT 25" texts are gone. Every door-cap claim names the 2 forklifts at that door ("at IN 3, where Sam (FL 1) and Dee (FL 4) are already pulling (2 per inbound door at most)"), and the test checks those two are drawn at that door on that card.

## Confusions
5. **390 wording:** the phone card says "Tap ⤢ Side view to see the stack highlighted." Wide screens keep "highlighted in the side view below".
6. **Travel explained:** Stop 1: "Doors apart = how far apart the IN door and the OUT door sit along the dock wall, as drawn on the map (IN 1–5 sit right above Doors 21–25): IN 2 to Door 22 is 0 doors apart (0 min travel); IN 1 to Door 23 is 2 apart (1 min)." Every card's detail line repeats it for that move ("IN 5 to Door 23: 2 doors apart, 1 min travel (5 min in all)"). Checked on all 100 cards against the map columns.
7. **Stop 5 reshuffles explained:** "Since the last stop: Maria (FL 2): OUT 23 → OUT 24 (after move 23: OUT 24 is free now: Ray just dropped there); Dee (FL 4): OUT 25 → OUT 23 (…); Ray (FL 5): OUT 24 → OUT 25 (…)". The reasons are the stored ones from item 4.
8. **A waiting moment in the Quick tour:** Stop 4 (move 21): "Luis (FL 3) has to wait: every trailer with work left is blocked right now", with the real reason on the card ("the next pieces for OUT 21 and OUT 23 are both at IN 3, where Sam (FL 1) and Dee (FL 4) are already pulling") and Luis under "Waiting" on the map. It says waiting time is part of the forklift labor hours. The summary's labor tile now says "Waiting time included (a forklift waiting is still paid)."
9. **Legend:** the map key has "the piece on its way from its inbound door" (green square). The side-view keys have "this piece (the one on the card)" (yellow) and "yellow outline = the pieces under it, already on board".
10. **Stop 7 (tight) on the phone:** "If anything slips, hold it a few minutes or start loading it earlier next shift."
11. **No repeated reason text:** the floor "Why here" is specific to the move (which spot, and what that section now carries: "Sec 9 now carries 1,538 lb of its 3,200 lb max"). No two consecutive cards have the same why text or the same note at either size (moves 24/25 and 68/69 were the repeats).
12. **1280 layout:** the "Playing moves" pill sits centered at the bottom, fully inside the window (measured 360–920 px of 1280). The summary has 6 tiles in an even 3 × 2 grid ("trailers loaded" and "on time" share one tile, and the $ cost sits inside the labor tile). "Coming in the real version" runs the full width under the two columns (1094 px = the column block).
- **Continue, first tap:** a card that appears on its own (a Quick-tour stop after fast play, the intro, a resumed tour) takes the very first tap at once. Only a second tap within 400 ms of an ACCEPTED tap is ignored. The card is positioned on the frame it appears, so Continue is where it is drawn.

## Optional: prefer tight departures — NOT built
Skipped on purpose. It would change the run order (and the tour stops, the waiting moments and every per-move check). The tight trailer (OUT 23) already leaves on time with 14 min to spare, and the gain would be a few minutes on one trailer. That's not worth the risk this round.

## Not built (WANTS)
Trailer types (28' pup, 53', tandem), true gross with tare and an 80,000 lb check, scans, OS&D, TMS, logins, export, ROI and hazmat were not built. They are still listed under "Coming in the real version".

## Tests (390×844 and 1280×800; Quick tour also at 1024×594)
Scripts: /workspace/v56work/test (runA.sh, runB.sh, walk56, consist56, tap56, test56, resume*, stress56, stack56, probelay, contrast56, expand56). Results: /workspace/v56work/test/results.

### Results
- Walks: quick tour (8 stops) at 390, 1024 and 1280, plus every move (100 cards + summary) at 390 and 1280. The stamp reads v56 and there were 0 errors.
- Consistency on all 100 cards at 390, 1024 and 1280: 0 problems. That covers 99 pickup-door pairs, 4,878 deck-support checks, door-cap claims checked against the map, 100 travel lines and 3 waiting cards.
- Taps: the first tap advanced every time at both sizes (allAdvanced true).
- Stress: quick tour 20 runs at 390 and 20 at 1280, 0 bad. Every move 4 runs at 390 and 3 at 1280, 0 bad.
- Resume on reload: every move, quick tour during fast play, and a waiting card all come back to the same card.
- Totals: identical over 3 runs (156,379 lb, 100 moves, 9.6 h). The heaviest section is 3,000 lb, with no heavy pieces in the nose or tail.
- Contrast: 1 flag, the disabled "Agent packed this (demo)" button (4.03:1). Disabled controls are exempt.
