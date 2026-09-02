# Dock App — MVP Requirements

**What this is:** A mobile-first web tool for LTL (Less-Than-Truckload) dock drivers to log freight size, weight, PRO number, piece fraction, trailer number, and trailer slot. The company TMS/billing software stays separate. This app only captures physical freight + location data.

**Who uses it:** Drivers on a phone, often wearing gloves, on a noisy dock.

---

## Permanent constraint (non-negotiable)

**All pieces with the same PRO (Bill of Lading) must stay on the same trailer.**

- Once any piece of a shipment is assigned to a trailer (by **trailer number**), every remaining piece of that PRO must go on that same trailer.
- Pieces of one BOL **cannot** be split across trailers (different trailer numbers).
- Pieces **may** occupy different positions (section/level/lateral) within the same trailer.
- The data model and helpers encode this rule (group entries by PRO). Future load-planning logic must reserve space for the whole remaining shipment once the first piece is committed.

---

## MVP scope (implement all)

### 1. Platform
- Mobile-first Progressive Web App (PWA) capable single-page app
- No login, no backend
- Works with a simple static file server
- Large tap targets, high contrast (glove-friendly dock UI)

### 2. Identification fields
- **PRO number** — typed text input
- **Piece fraction** — typed (e.g. `3/5` meaning piece 3 of 5)
- **Trailer number** — typed text/number input for the equipment ID of the trailer at the door (e.g. `12345`). Separate from trailer *slot* position. Used as trailer identity for the same-PRO = same-trailer BOL rule.

### 3. Trailer slot
- **Section:** 1–12 (nose to rear)
- **Level:** A–C (bottom to top, for decked trailers)
- **Lateral:** Left / Middle / Right
- Display format: `12/A/Left`

### 4. Dimension & weight entry
- Units locked: **inches** for H/W/D, **pounds** for weight — never ask for units
- Big **Speak Dimensions** button using Web Speech API when available
- Parse utterances such as:
  - `"48 by 40 by 48, 1200"`
  - `"48 40 48 1200"`
  - as Height, Width, Depth (inches), then Weight (lbs)
- Large fields; big **Accept** and **Re-speak** buttons
- Tap one field to re-speak or edit just that value
- Large glove-friendly on-screen number pad as backup
- Listening visual indicator while speech is active

### 5. Size presets
Auto-fill H/W/D; leave weight empty for the driver to enter:

| Preset | H × W × D (in) |
|--------|----------------|
| GMA (48×40) | 48 × 40 × 48 (typical stack height placeholder; base pallet is 48×40) |
| 48×48 | 48 × 48 × 48 |
| Half pallet | 48 × 20 × 40 |
| Euro | 47 × 32 × 40 |
| 55-gal drum | 35 × 23 × 23 |
| 30-gal drum | 30 × 19 × 19 |
| 5-gal bucket | 15 × 12 × 12 |
| IBC 275 | 46 × 48 × 40 |
| Gaylord | 48 × 40 × 36 |
| Custom / Last used | Restores last accepted H/W/D (and weight if saved) |

### 6. Persistence & list
- On **Accept**, save entry to `localStorage`: PRO, piece fraction, trailer number, slot, H/W/D, weight, timestamp
- Show recent entries on screen (include trailer number)
- Helper that groups entries by PRO (supports the BOL-same-trailer rule); trailer number is the trailer identity for that rule (warn if same PRO would go on a different trailer number)

### 7. Docs
- `README.md` — beginner-friendly: open on computer, open on phone over same Wi‑Fi
- `REQUIREMENTS.md` — this file
- Exact static-server command documented

---

## Out of scope for this MVP
- Photo / OCR freight ID
- AI load planning / forklift queue
- TMS integration / sync
- Login / multi-user accounts
- Backend database

---

## Speech API caveat
Web Speech recognition typically works in **Chrome** and **Safari**, and usually requires **HTTPS** or **localhost**. It may not work on plain HTTP over a LAN IP, or in Firefox.
