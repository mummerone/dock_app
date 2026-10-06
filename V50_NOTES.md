# Dock App v50: first-time boss demo

**Goal:** a boss who has never seen the app gets through the demo with zero questions.
v50 answers the 29 questions the Virtual Boss asked on its first v49 walkthrough.

## Files changed vs v49
`app.js`, `styles.css`, `index.html`, `sw.js`, `loadPlan.js` (+ this file).
`storage.js`, `speech.js`, `manifest.json`, `icon.svg` are unchanged.
Version stamp is v50 everywhere: the three stamps, every `?v=50`, the SW register URL, and the `dock-app-v50` cache.

## P1: correctness
1. **Idle forklifts.** Before, a forklift that went idle never got work again. Now any free forklift takes the next move at any OUT door that no other forklift is working. It prefers the same door, then a free inbound door, then the trailer with the most moves left. The rule is still never two forklifts at one OUT door. The sample freight is now spread evenly across destinations (19–21 pieces each), so all 5 keep working until the last ~5 moves.
2. **Fixed count.** The card reads "Move N of T". T is set at the start and never changes, and N is exactly the number of moves done. Idle, switch, and "door finished" events are no longer stops. They show as a small green note on the next card.
3. **Stacking.** A deck piece must have a piece under it, can be no heavier than that piece, and is capped at 1,500 lb. Axle limits, zone limits, and "every piece placed" all still hold.
4. **Reasons.** Each "why" line is built from where the piece actually went: section number → Nose (sec 1) / Middle (2–11) / Tail (sec 12), plus Floor/Deck and the real weight of the piece underneath. Nose labels are correct now: v49 called sections 1–3 "nose", and the trailers only used sections 1–3, so almost every card said "nose".
5. **Piece counts.** "piece k of n" everywhere comes from the PRO's fraction, so there is one source of truth. (The 8 vs 7 mismatch did not show up in 500 test plans.)
6. **Panel follows the card.** Every card switches the trailer panel to the trailer that move loads and highlights the piece just loaded.
7. **Weights.** The big number is LIVE (loaded so far) and grows each move. "planned at full load" is the second line. One rule applies to all four cells: green under 95%, amber "at target" at 95–100%, red over. A plain line explains 3,200 lb vs 20,000 lb and why a nose-first trailer is front-heavy but legal.
8. **Crew before the demo.** Shows "No plan yet. Tap Show boss demo." and "Not started". No fake forklifts.
9. **Confirm toast.** The "Opening confirm…" toast is gone.

## P2: clarity
10. **Hero card.** It sits at the top of the first screen with one line on what the app does and a big "Watch the boss demo" button that goes straight into the Crew boss demo. Log freight still works below it.
11. **Help.** One-line help for PRO, BOL, Section/Level, GMA 48×40, and Voice. A one-line guide under the Dock tabs changes with the tab. Dock opens on Crew by default.
12. **Confirm + backup.** Plain wording. The confirm only appears if you have your own logged freight. That freight is backed up before the demo and restored by "Exit demo" (button on Crew, on the summary, and in the demo bar shown on every screen).
13. **Sample data (labeled).** Forklift names (Forklift 1 · Sam …), a departure time per OUT trailer, and "on pace / tight / late" from moves left × 4 min.
14. **Boss summary.** Trailers, pieces, weight, legal check, minutes, on time, % of floor length and of axle weight per trailer, moves and busy % per forklift, honest low-fill notes (≤5 pieces = consolidation candidate), and a "Coming in the real version" list. Inbound doors turn "empty" as they finish. The map has a legend.
15. **Wide screens.** At ≥900 px the tour card docks to the right of the app with a left arrow, and the map stays visible. At 390 px the card sits at the bottom and the map scrolls above it. OUT chips are never covered.
16. **Cards.** Bold lead (who → which trailer: where), one detail line, one "why" line, plus an optional note. Buttons sit side by side.

Also: "Play without stops" runs one move per 0.45 s (~45 s for a full dock).

## Tests (headless Chrome, 390×844 and 1280×800)
- Full Continue walk at each size: 0 console errors, T fixed, N = card number, 5/5 forklifts working until move ~93–95 of ~100, panel door = card door on every card, zone label = section, reason matches placement, no "getting heavy".
- Fresh plan and after Play without stops: Unplaced 0, 0 heavier-on-lighter decks, 0 heavy end-zone pieces, all zones ≤3,200, all axles ≤20,000.
- Scroll under the tour works, OUT chips stay tappable, and the 1280 card does not overlap the app.
- Backup/restore: a logged piece comes back byte-identical after Exit demo.
- Smoke: Solo, Crew (5) Step, Ground demo, Operator screen, Top-down deck view.
- Planner harness: 200 + 300 random runs, every check 0.
