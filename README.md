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


## Trailer load-out view

Want to see everything already on a trailer? Use the **Trailer load-out** tab at the top.

1. Tap **Trailer load-out** (next to **Log freight**).
2. Pick a trailer number from the big chips (saved trailers), or type one and tap **Show load-out**.
3. At the top you see a short summary: trailer number, how many bills (PROs), how many pieces, and total weight when available.
4. Below that, freight is grouped by **bill (PRO)**. Under each bill you see every piece: piece number (like `3/5`), slot location (like `12/A/Left`), size (H×W×D), and weight.

Empty trailers show a clear “nothing on this trailer yet” message. The **Log freight** tab still works the same (speak, presets, number pad).

## Dock (Inbound · Outbound · Demo plan)

One **Dock** tab covers inbound doors, outbound trailers, and the demo load planner. Inside Dock, use the big sub-nav buttons:

### Inbound
1. When you **Log freight**, also enter the **Door number** (the dock door where that trailer sits).
2. Tap **Dock** → **Inbound**.
3. At the top: **Load demo inbound trailers** — confirms, then generates 5 high-and-tight inbound trailers for demo (same `seedDemoInbound()` as before; wipes logged freight + last plan).
4. Below that: door board — doors that have freight → tap a door → bills (PROs) → pieces with slot/size/weight.
5. Viewing only on the board — no forklift instructions yet.

### Outbound
1. Tap **Dock** → **Outbound**.
2. Register trailers you are loading out: trailer number, optional door, destination or **Open**.
3. The list below shows registered outbound trailers.

### Demo plan
1. Tap **Dock** → **Demo plan**.
2. This is a **local demo planner** (not ChatGPT / cloud AI).
3. **Run load plan (demo AI)** / **Clear plan**, then plan summary, move list, and planned outbound load-outs.
4. Tip: load demo inbound on **Inbound** first so there is freight to plan.

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
8. Tap **Trailer load-out** anytime to review all bills and pieces on a chosen trailer.
9. Tap **Dock** → **Inbound** for the door board (and **Load demo inbound trailers** at the top).
10. Tap **Dock** → **Outbound** to register trailers you are loading out.
11. Tap **Dock** → **Demo plan** to run the local high-and-tight demo planner.
12. Tap **Edit bill** on Recent, Dock PRO view, or Trailer load-out to set/change destination (and door/trailer) without re-entering pieces.

---

## Files in this folder

| File | What it is |
|------|------------|
| `index.html` | The main page |
| `styles.css` | Look and layout (big buttons, high contrast) |
| `app.js` | Screen logic and buttons |
| `speech.js` | Voice listening and parsing (“48 by 40 by 48, 1200”) |
| `storage.js` | Saves entries, PRO destinations, outbound trailers, and load plans in the browser + groups by PRO |
| `loadPlan.js` | Demo inbound seed + local high-and-tight `runLoadPlan()` (swap body later for a real AI backend) |
| `manifest.json` | Lets the phone “install” it as a home-screen app |
| `sw.js` | Offline cache helper for the PWA (`dock-app-v12`) |
| `icon.svg` | App icon |
| `REQUIREMENTS.md` | Full MVP checklist and the BOL rule |
| `README.md` | This guide |

---

## Caveats (please read)

- **Voice (Web Speech API):** Works best in **Chrome** and **Safari**. Usually needs **https://** or **localhost**. May fail on Firefox or on plain HTTP LAN URLs. Use the number pad if voice is blocked.
- **Data stays in this browser:** Entries are stored in `localStorage` on the device/browser you used. Clearing site data, using a different browser, or a different phone will not show the same list.
- **No sync / no TMS:** This MVP does not talk to company billing software.
- **Not a toy form:** Built for gloves and noise — large taps, high contrast — but it is still an MVP, not a full dock AI system.

---

## Exact run command (copy/paste)

From inside `dock_app_build`:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` on the computer, or `http://<computer-ip>:8080` on a phone on the same Wi‑Fi.
