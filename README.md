# Dock App (MVP)

A simple phone-friendly web tool for dock drivers. You type (or speak) a PRO number, piece count, where the bill is going (destination), trailer number, trailer slot, and the size/weight of each piece of freight. Under **Dock** you can view inbound doors, register outbound trailers, and run the demo load plan. Everything stays on your device — there is no login and no company server involved.

**Important rule:** All pieces with the **same PRO** (same Bill of Lading) must stay on the **same trailer**. The app remembers entries by PRO so you can see that grouping.

---

## What you need

- A computer **or** a phone with a modern browser (Chrome or Safari recommended for voice).
- That’s it. No install from an app store.

---

## How to open it on a computer

1. Open a terminal (on Mac: Terminal; on Windows: Command Prompt or PowerShell).
2. Go into this folder. Example:

```bash
cd /workspace/dock_app_build
```

(Use the real path to wherever you put `dock_app_build` on your machine.)

3. Start a tiny local web server with **one** of these commands:

**Option A — Python (most computers already have it):**

```bash
python3 -m http.server 8080
```

**Option B — Node “serve” (if you have Node.js):**

```bash
npx --yes serve -l 8080
```

4. Open a browser and go to:

```
http://localhost:8080
```

You should see the Dock App screen. Leave the terminal window open while you use the app. To stop the server, press `Ctrl+C` in the terminal.

---

## How to open it on your phone (same Wi‑Fi)

Your phone and computer must be on the **same Wi‑Fi network** (same home or shop network).

1. On the computer, start the server the same way as above.
2. Find your computer’s local IP address:
   - **Mac:** System Settings → Network → Wi‑Fi → Details → look for “IP Address” (often looks like `192.168.1.42`).
   - **Windows:** open Command Prompt and run `ipconfig`. Look for **IPv4 Address** under your Wi‑Fi adapter.
   - **Linux:** run `hostname -I` or `ip a`.
3. On your phone’s browser, type:

```
http://YOUR_COMPUTER_IP:8080
```

Example: `http://192.168.1.42:8080`

4. Bookmark it or “Add to Home Screen” so it feels like an app.

**Note about voice on the phone:** Speaking dimensions usually needs Chrome or Safari. On a phone, voice may only work if the page is served over **HTTPS**, or from `localhost`. Over plain `http://192.168…` some phones block the microphone. The big on-screen number pad always works as a backup.

---


## Trailer load-out (worker job list)

Use **Trailer load-out** to follow a go-get / put list without a developer.

1. Tap **Trailer load-out** (next to **Log freight**).
2. Tap a trailer chip — **OUT** chips are outbound trailers from the last load plan (e.g. after **Dock → Demo plan**). You can also type a number and tap **Show**.
3. **Work list** (when a plan exists for that trailer): numbered steps with door, get-from slot, put-to slot, PRO and piece. Tap a step to mark it done; **Clear done** resets marks for this trailer + plan.
4. **Ready to close**: on an **outbound** trailer, when every Work list step is done, a big banner appears (“All planned pieces are on this trailer. Spot-check, then close.”). Progress only while some steps remain; no banner if there is no Work list.
5. **What is on this trailer**: inventory grouped by bill (PRO) with slots — same PRO stays on one trailer.
6. No plan yet? Empty tips tell you to run **Dock → Demo plan** (or log freight first).

Done marks stay on this device only (`localStorage`). The **Log freight** tab still works the same.

## Dock (Inbound · Outbound · Ground · Demo plan)

One **Dock** tab covers inbound doors, outbound trailers, ground deck-build orders, and the demo load planner. Inside Dock, use the big sub-nav buttons:

### Inbound
1. When you **Log freight**, also enter the **Door number** (the dock door where that trailer sits).
2. Tap **Dock** → **Inbound**.
3. At the top: **Load demo inbound trailers** — confirms, then generates 5 packed demo inbound trailers (same `seedDemoInbound()` as before; wipes logged freight + last plan).
4. Below that: door board — doors that have freight → tap a door → bills (PROs) → pieces with slot/size/weight.
5. Viewing only on the board — no forklift instructions yet.

### Outbound
1. Tap **Dock** → **Outbound**.
2. Register trailers you are loading out: trailer number, optional door, destination or **Open**.
3. Check **City load — floor only** for local / serving-city loads (planner uses level A only — no decks B/C). You can also toggle this on each outbound row later; rebuild the plan to apply.
4. The list below shows registered outbound trailers. When a trailer’s Work list is fully done, a compact **Ready to close** hint appears.

### Ground
1. Tap **Dock** → **Ground**.
2. After you build a load plan, this list shows **deck-build orders** for the ground person: one per outbound section that needs freight on B or C (e.g. “Build deck · Section 2 · above ~45 in”).
3. Tap an order when the deck is built (done marks stay on this device). City floor-only trailers produce **no** deck builds.
4. Empty state: “No deck builds yet. Build a load plan first (non-city trailers may need decks).”

### Demo plan
1. Tap **Dock** → **Demo plan**.
2. Local demo planner on this device (builds a load plan from inbound freight).
3. **Build load plan (demo)** / **Clear plan**, then plan summary, move list (grouped by outbound trailer, collapsible, with counts), and planned outbound load-outs.
4. On Demo plan, sticky chrome is turned off (`plan-scroll-mode`): top bar, main view tabs, and dock sub-tabs all scroll away with the page so they do not cover the long move list.
5. Tip: load demo inbound on **Inbound** first so there is freight to plan.

## Destination on each PRO

When you **Log freight**, fill **Where is it going?** (city, terminal code, or any short note). That destination is saved **once per PRO** — every piece of the same bill shares it. If you log another piece of that PRO later, the destination shows locked; tap **Change destination** if you need to edit it.

## Edit a bill (PRO) after it is logged

Need to fix a destination (or door / trailer) on a bill you already accepted? You do **not** re-enter every piece.

1. On **Recent entries**, tap **Edit bill** on that PRO group.
2. Or open **Dock** → door → bill → **Edit bill** on the PRO view.
3. Or on **Trailer load-out**, tap **Edit bill** under that PRO.
4. The sheet shows **PRO number** (read-only), **Where is it going?**, plus optional **Trailer** and **Door** for all pieces of that bill.
5. Tap **Save**. Destination is stored once for the whole PRO (`dockApp.pros.v1`). Pieces keep their piece numbers and sizes.

Works even if some pieces were logged before destination existed.

---
## How to use it (quick)

1. Enter **PRO** and **piece**. For multi-piece bills enter `1/n` first (or just total `n`), then Accept `2/n`…`n/n` in order — no skipping. After each Accept (except the last), PRO and trailer stay filled, dims/weight/slot clear, and piece auto-advances to the next fraction (locked until the sequence finishes).
2. Enter **Where is it going?** (destination). Later pieces of the same PRO reuse it (locked); use **Change destination** to edit.
3. Enter **Trailer number** (equipment ID, e.g. `12345`) and **Door number** (which dock door that trailer is at).
4. Pick trailer **slot**: **section** (1–12), **level** (A–C), and **Left / Middle / Right**.
5. Tap a **size preset**, or tap **Speak Dimensions**, or use the number pad. Pallet presets fill **W×D only** (enter height yourself); drums / pails / totes include height.
6. Check the big H / W / D / Weight boxes.
7. Tap **Accept** — the entry is saved on this device and shows under Recent Entries.
8. Tap **Trailer load-out** anytime for the work list (after a plan) or inventory on a chosen trailer.
9. Tap **Dock** → **Inbound** for the door board (and **Load demo inbound trailers** at the top).
10. Tap **Dock** → **Outbound** to register trailers you are loading out (optional **City load — floor only**).
11. Tap **Dock** → **Ground** for deck-build orders after a plan.
12. Tap **Dock** → **Demo plan** to build the local demo load plan.
13. Tap **Edit bill** on Recent, Dock PRO view, or Trailer load-out to set/change destination (and door/trailer) without re-entering pieces.

**Out of scope for this demo:** driver route / yard / in-transit status — the company provides those elsewhere.

---

## Files in this folder

v23 Ground deck-build orders, Ready to close, City floor-only packing; network-first SW (`dock-app-v23`).


| File | What it is |
|------|------------|
| `index.html` | The main page |
| `styles.css` | Look and layout (big buttons, high contrast) |
| `app.js` | Screen logic and buttons |
| `speech.js` | Voice listening and parsing (“48 by 40 by 48, 1200”) |
| `storage.js` | Saves entries, PRO destinations, outbound trailers, and load plans in the browser + groups by PRO |
| `loadPlan.js` | Demo inbound seed + local `runLoadPlan()` demo planner |
| `manifest.json` | Lets the phone “install” it as a home-screen app |
| `sw.js` | Offline cache helper for the PWA (`dock-app-v23`) |
| `icon.svg` | App icon |
| `REQUIREMENTS.md` | Full MVP checklist and the BOL rule |
| `README.md` | This guide |

---

## Caveats (please read)

- **Voice (Web Speech API):** Works best in **Chrome** and **Safari**. Usually needs **https://** or **localhost**. May fail on Firefox or on plain HTTP LAN URLs. Use the number pad if voice is blocked.
- **Data stays in this browser:** Entries are stored in `localStorage` on the device/browser you used. Clearing site data, using a different browser, or a different phone will not show the same list.
- **No sync / no TMS:** This MVP does not talk to company billing software. See **Company readiness** below for what a real company would expect next.
- **Not a toy form:** Built for gloves and noise — large taps, high contrast — but it is still an MVP, not a full dock planning system.

---

---

## Company readiness (honest gaps)

This app is a **solid single-phone demo** today: log freight → dock board → demo load plan → outbound Work list, with phone-friendly layout and clear empty states.

### What stays on one phone

Saved in this browser only (`localStorage`):

- Logged freight (PROs, pieces, doors, slots)
- Destinations on bills
- Outbound trailer list
- Load plan, Work list “done” marks, and Ground deck-build “done” marks
- Last-used sizes for the number pad

Another phone, another browser, or clearing site data = **empty / gone**. The footer already says “Data stays on this device.”

### What a company would usually expect shared

1. **One live dock picture** — clerk logs freight; forklift / outbound see the same doors, trailers, and Work list in real time  
2. **Shared progress** — marking a Work list step done updates everyone, not just that phone  
3. **Accounts and roles** — who can log, who can plan, who can only follow the Work list (not “anyone with the link”)  
4. **Backup / history** — yesterday’s trailers don’t vanish if someone hits Clear all or loses a phone  
5. **Multi-terminal / multi-shift** — more than one dock, handoff between shifts  
6. **Office tools** — print or export a plan, search by PRO, maybe TMS/EDI later  

### What this demo is already good for

- Training the flow end-to-end  
- Phone UI for a single worker or a sales / walkthrough demo  
- Proving the rules (same PRO = same trailer, floor-then-deck packing, etc.)  

### Sensible next step if you go beyond demo

**Smallest real upgrade:** a simple shared cloud save (one dock “room,” all phones sync).  

**Not first:** full TMS, cloud AI planner, fancy permissions — those come after sharing works.

---
## Exact run command (copy/paste)

From inside `dock_app_build`:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` on the computer, or `http://<computer-ip>:8080` on a phone on the same Wi‑Fi.
