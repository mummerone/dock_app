# Dock App v52 — notes

Built on live v51 (commit c6a1988). Answers Virtual Boss walkthrough #3 on v51, plus the tour-length decision: the **Quick tour is now the default**. NOT published.

## Changed files (stage only these)
app.js · index.html · loadPlan.js · styles.css · sw.js · V52_NOTES.md
(storage.js, speech.js, manifest.json and icon.svg have not changed. Every asset still loads with ?v=52, so there is one cache version.)

Version: build stamps show v52 (3 places), every ?v=52, SW register `./sw.js?v=52`, CACHE `dock-app-v52`.

## Tour modes
- **Quick tour (default)** — "▶ Watch the boss demo" on the landing page, and "Show boss demo (8 stops)" on Crew.
  - 8 stops, all picked from the real fixed-seed run (`buildQuickTourStops`), never invented:
    1. The dock (intro).
    2. Move 1: inbound door → exact slot.
    3. Move 14: heavy piece in the middle, between the axles.
    4. Move 22: 5 forklifts on 5 different trailers (and why two never share one).
    5. Move 58: Deck 3 stack, lighter on heavier.
    6. Move 61: tight departure on OUT 23, 10 min spare, with what you'd do.
    7. Move 92: OUT 22 truly fully loaded.
    8. Move 98: dock done, all 5 trailers loaded and axle-legal. Continue goes to the summary.
  - Between stops the moves fast-play on the map at 0.3 s each. A slim "▶ Playing moves · Move X of 98 · next: stop N of 8" bar has its own Skip to summary.
  - The card header reads "Stop N of 8" with a small "Move X of 98" pill. Each stop has a title line and one short explanation line.
  - If a kind of moment never happens in a plan, that stop is dropped and the count follows.
- **Watch every move (98 stops)** — a second button on the landing page and on Crew. This is the existing every-move tour, unchanged: a pause at every move with Continue, Play without stops and Skip to summary.
- Watch again repeats the mode you last used.
- Landing copy: "8 stops, about 2 minutes. Or watch every move. Skip to the summary any time. …"

## FIX list
1. **Intermittent tour quit — root cause + fix.**
   - Root cause, two parts:
     - (a) **Tour state lived only in memory.** Any page reload, pull-to-refresh, re-navigation or mobile tab discard put the app back in its default state. The striped banner stayed up, because the demo backup lives in localStorage, but there was no card, and Watch again restarted at 0. That is exactly the symptom reported on move 16.
     - (b) **Taps fell through.** After Continue, the card re-docks and the page scrolls, so a fast second tap at the old Continue spot hit whatever was underneath. On a 390 probe this happened ~40% of the time: Skip to summary, OUT chips, a toast or the panel. A double tap also advanced 2 moves.
   - Fixes:
     - Tour progress is saved (`dockApp.tourProgress.v1`) and resumed after a reload, at the same card, with the note "Picked up where you left off (move N)". A finished tour resumes on the summary.
     - Progress is cleared on Exit demo, on a new boss demo and on Solo/Crew(5).
     - Taps within 400 ms of a card appearing are ignored, and a re-entry guard covers each tour button.
     - Continue is now the bottom, full-width button.
     - Taps never fall through the card.
     - Every card docks in the same place: bottom on phones (sized so the dock map above is never covered, buttons pinned) and a fixed side position on wide screens.
     - The fast-play bar ignores taps for 600 ms after it appears.
     - The page has `overscroll-behavior-y: contain` while the demo is up, which stops pull-to-refresh.
     - Toasts are suppressed while a card is open.
2. **"Finished" notes are true.**
   - "X finished OUT n (every piece loaded)" appears only when that trailer has 0 moves left. All 5 such notes were checked against the chip count (n/n).
   - Otherwise the note gives the real reason:
     - "…was free first and took over OUT 25 (8 moves left; one forklift per trailer)".
     - "moved to OUT Y because OUT X's next piece is at IN door N, which already has 2 forklifts … handed OUT X to the next free forklift".
   - Wait notes name the reason: which trailers already have a forklift, or which inbound door is full. Near the end the note reads "done for this run: OUT 25 is the only trailer with moves left and it already has a forklift".
   - No "back at work" on the final move: it reads "Last move of the run: all 5 outbound trailers are fully loaded."
3. **Deck labels:**
   - Floor, Deck 2 (second level) and Deck 3 (third level) everywhere: cards, why lines, side view, top-down, glossary, help line, plan text, intro rules and Ground orders.
   - Ground orders now name the deck: "Build Deck 2 · Section 4" / "Build Deck 2 + Deck 3".
4. **One counts wording:** "this run: 20 of 20 moved · trailer: 36 pieces on board (16 loaded earlier)", on the card trailer box, the panel and the door-finished notes. The side view and summary use the same shape.
5. **One ID per trailer:**
   - Outbound trailers are 90001–90005 everywhere: card box "OUT 21 · Trl 90001 · Salt Lake City", panel title, OUT chips (new number line) and summary.
   - Inbound trailers are labelled "IN 81001"… on the door board and "from IN door 4 (Trl 81004)" on cards.
6. **Spare minutes:**
   - One function, `crewSpareMin` (floor), drives both the in-run box and the summary. The test shows all 5 doors match (32/25/10/35/22).
   - Wording: "N min spare before 7:40 PM departure", plus "(leaves in N min)", which counts down as the sample clock advances.
7. **83% fill copy is honest.**
   - Each trailer pill reads "83% of floor used".
   - One note explains it: "Every trailer uses sections 1–10 (83%); the last 8 ft stays open for the next pickup, so the tail zone shows 0 lb."
   - The side view says the same. The plan note says the rear stays open when a trailer is not full.
   - The summary headline says "83% full (floor length)" once.
8. **Contrast:**
   - "Doors on this dock" / "Open Operator screen" were white on white (browser default) and now have a dark face. Every `.btn` has its own face.
   - Mic/Step/Build buttons and the top-down loaded cells were darkened.
   - An in-page WCAG audit of all visible buttons, pills, chips and tags across 12 screens at both widths shows 0 failures. The only remaining item is a disabled button, which is exempt.
9. **≥900 px layout:**
   - The app widens to 980 px. During the tour it fills the width left of a fixed 380 px side card.
   - The summary uses a 2-column trailer grid and 2-column crew/start/coming sections, with normal type.
10. **Piece order:**
    - A PRO's pieces load in slot order (nose to tail). When that differs from the label number, the card says so, e.g. "label 3/4 (loads 4th of 4, in slot order)".
    - The intro rules explain why.
11. **Phone intro and toasts:**
    - The intro docks like every other card, under the map.
    - Toasts are hidden when a card opens and stay suppressed while it is open. Tests found 0 toasts over a card at either width in either mode.
12. **Landing:** the false "~2 minutes" line is gone. The quick tour copy is "8 stops, about 2 minutes. Or watch every move." That is honest: 8 cards plus about 30 s of fast-play.
13. **Clarity:**
    - Intro: "each move ≈ 4 min + 0.5 min per door of travel".
    - A collapsed "Rules, timing and sample data" list covers:
      - next free forklift
      - why two forklifts never share a trailer (they would block each other in the doorway, which is why some wait)
      - 2 per inbound door
      - nose to tail plus heavy between the axles (axle balance)
      - federal 20,000 lb axle limit vs the company 3,200 lb per 4 ft section
      - Floor/Deck 2/Deck 3 with an assumed 110 in inside roof height (stacks under 100 in)
      - piece order
      - fragile handling and the 5,000 lb forklift limit
      - sample names and times
    - "Pallet" is used everywhere; "skid" is gone.
    - The tight hint now says "send the next free forklift here first, or hold the trailer", not "add a forklift", which would contradict one forklift per trailer.
- **Summary headline** (new): one big line from computed figures only, e.g. "5 trailers out 83% full (floor length), all axle-legal, 5 of 5 on time · 8.6 labor hours". It adds "· $240 labor" when a rate is entered. There are no savings or baseline claims.

## Tests (390×844 and 1280×800)
- Every-move walk, 98 cards at both widths:
  - 0 console errors; the counter sequence is correct.
  - The 5 count sources agree on every card.
  - Never more than 2 forklifts per inbound door.
  - Card and trailer box always in view; the map is never covered at 390.
  - 0 toasts over a card.
  - 5/5 "finished/fully loaded" notes are true.
  - No "back at work" on the last card.
  - Deck wording correct (34 Deck 2 and 4 Deck 3 cards).
  - Trailer IDs match on every card.
  - Spare matches the summary on all 5 doors.
- Quick tour at both widths: 8 stops, as listed above; the fast-play bar shows between stops; 0 errors; the headline with and without a rate.
- Reload/resume:
  - Reloading at the intro gives the intro; reloading at move 7 gives move 7, and Continue goes to move 8.
  - Reloading after the summary gives the summary.
  - Reloading after starting Solo shows no tour.
  - Reloading after Exit shows no tour, with progress and backup cleared.
- Regression (test52): all passed at both widths:
  - Legality, Unplaced 0.
  - Determinism: 3 loads identical, 98 moves, 134,466 lb, all trailers 83%.
  - Play without stops gives the same plan.
  - OUT chip tappable under the tour; page scroll under the tour.
  - Start card with saved freight; reload banner; again-from-demo.
  - Skip to summary; Exit toast and restore notice; freight restored byte-identical.
  - Solo, Crew(5), Ground and Operator smoke.
- Stress: 22 full runs per mode per width (88 runs). The tap patterns rotate: single click ×6, touch double-tap ×6, click + 2nd click after 60 ms ×5, triple click ×5.
  - Every move, 390 and 1280: 22/22 reached the summary (99 cards each = intro + 98). 0 quits, 0 reloads/navigations, 0 errors, 0 skipped cards.
  - Quick tour, 390 and 1280: 22/22 reached the summary (8 stops each). 0 quits, 0 navigations, 0 errors, 0 skipped stops. Some second taps landed on the fast-play bar and were ignored as designed.
- Note: the two "v50" strings left in index.html are HTML comments recording when a feature was added (`<!-- v50: … -->`). They are not version refs.
