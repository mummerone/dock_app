/**
 * Dock App storage
 * ---------------
 * PERMANENT BOL CONSTRAINT:
 * All pieces with the same PRO (Bill of Lading) must stay on the SAME trailer.
 * Once any piece of a shipment is assigned to a trailer, every remaining piece
 * of that PRO must go into that same trailer. Pieces of one BOL cannot be split
 * across trailers. (Different positions within one trailer are OK.)
 *
 * Helpers below group entries by PRO so callers can enforce / display that rule.
 *
 * Also stores:
 * - pros: one destination per PRO (shared by all pieces of that bill)
 * - outboundTrailers: registry of trailers being loaded out (destination or "open")
 * - loadPlan: last demo/AI load plan (moves + outbound load-outs)
 */

(function (global) {
  const STORAGE_KEY = 'dockApp.entries.v1';
  const LAST_USED_KEY = 'dockApp.lastUsedDims.v1';
  const PROS_KEY = 'dockApp.pros.v1';
  const OUTBOUND_KEY = 'dockApp.outboundTrailers.v1';
  const PLAN_KEY = 'dockApp.loadPlan.v1';

  /**
   * @typedef {Object} DockEntry
   * @property {string} id
   * @property {string} pro
   * @property {string} pieceFraction  e.g. "3/5"
   * @property {string} trailerNumber  equipment ID e.g. "12345" (trailer identity for BOL rule)
   * @property {string} doorNumber     dock door where the trailer sits (e.g. "12")
   * @property {number} section        1-12
   * @property {string} level          "A"|"B"|"C"
   * @property {string} lateral        "Left"|"Middle"|"Right"
   * @property {string} slotLabel      e.g. "12/A/Left"
   * @property {number|null} h
   * @property {number|null} w
   * @property {number|null} d
   * @property {number|null} weight
   * @property {string} timestamp      ISO string
   */

  /**
   * @typedef {Object} ProRecord
   * @property {string} pro
   * @property {string} destination  city, terminal code, or free text
   * @property {string} updatedAt    ISO string
   */

  /**
   * @typedef {Object} OutboundTrailer
   * @property {string} id
   * @property {string} trailerNumber
   * @property {string} doorNumber     optional until spotted
   * @property {string} destination    free text, or "open"
   * @property {string} createdAt      ISO string
   */

  function readAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeAll(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function formatSlot(section, level, lateral) {
    return `${section}/${level}/${lateral}`;
  }

  /**
   * Save a new freight entry. Does not block conflicting trailers in MVP UI,
   * but groupsByPro() exposes data for that permanent rule.
   * @param {Omit<DockEntry,'id'|'timestamp'|'slotLabel'> & {timestamp?: string, destination?: string}} partial
   * @returns {DockEntry}
   */
  function saveEntry(partial) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      pro: String(partial.pro || '').trim(),
      pieceFraction: String(partial.pieceFraction || '').trim(),
      trailerNumber: String(partial.trailerNumber || '').trim(),
      doorNumber: String(partial.doorNumber || '').trim(),
      section: Number(partial.section),
      level: partial.level,
      lateral: partial.lateral,
      slotLabel: formatSlot(partial.section, partial.level, partial.lateral),
      h: partial.h == null || partial.h === '' ? null : Number(partial.h),
      w: partial.w == null || partial.w === '' ? null : Number(partial.w),
      d: partial.d == null || partial.d === '' ? null : Number(partial.d),
      weight: partial.weight == null || partial.weight === '' ? null : Number(partial.weight),
      timestamp: partial.timestamp || new Date().toISOString(),
    };

    const all = readAll();
    all.unshift(entry);
    writeAll(all);

    // Remember last accepted dims for "Custom / Last used"
    setLastUsed({
      h: entry.h,
      w: entry.w,
      d: entry.d,
      weight: entry.weight,
    });

    // Destination lives once per PRO (not copied onto every piece)
    if (partial.destination != null && String(partial.destination).trim() !== '') {
      setProDestination(entry.pro, String(partial.destination).trim());
    }

    return entry;
  }

  function clearAll() {
    writeAll([]);
  }

  // ---------- PRO destination store ----------

  function readPros() {
    try {
      const raw = localStorage.getItem(PROS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writePros(list) {
    localStorage.setItem(PROS_KEY, JSON.stringify(list));
  }

  /**
   * @param {string} pro
   * @returns {ProRecord|null}
   */
  function getPro(pro) {
    const key = String(pro || '').trim();
    if (!key) return null;
    return readPros().find((p) => p.pro === key) || null;
  }

  /**
   * @param {string} pro
   * @returns {string}
   */
  function getProDestination(pro) {
    const rec = getPro(pro);
    return rec ? String(rec.destination || '').trim() : '';
  }

  /**
   * Upsert destination for a PRO. Empty destination clears it.
   * @param {string} pro
   * @param {string} destination
   * @returns {ProRecord|null}
   */
  function setProDestination(pro, destination) {
    const key = String(pro || '').trim();
    if (!key) return null;
    const dest = String(destination || '').trim();
    const list = readPros();
    const idx = list.findIndex((p) => p.pro === key);
    const now = new Date().toISOString();
    if (!dest) {
      if (idx >= 0) {
        list.splice(idx, 1);
        writePros(list);
      }
      return null;
    }
    /** @type {ProRecord} */
    const rec = { pro: key, destination: dest, updatedAt: now };
    if (idx >= 0) list[idx] = rec;
    else list.unshift(rec);
    writePros(list);
    return rec;
  }

  // ---------- Outbound trailer registry ----------

  function readOutboundTrailers() {
    try {
      const raw = localStorage.getItem(OUTBOUND_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeOutboundTrailers(list) {
    localStorage.setItem(OUTBOUND_KEY, JSON.stringify(list));
  }

  /**
   * Register an outbound trailer (loading for a destination, or "open").
   * @param {{ trailerNumber: string, doorNumber?: string, destination?: string }} partial
   * @returns {OutboundTrailer}
   */
  function saveOutboundTrailer(partial) {
    const trailerNumber = String(partial.trailerNumber || '').trim();
    const doorNumber = String(partial.doorNumber || '').trim();
    let destination = String(partial.destination || '').trim();
    if (!destination) destination = 'open';

    /** @type {OutboundTrailer} */
    const row = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      trailerNumber,
      doorNumber,
      destination,
      createdAt: new Date().toISOString(),
    };
    const list = readOutboundTrailers();
    list.unshift(row);
    writeOutboundTrailers(list);
    return row;
  }

  /**
   * @param {string} id
   * @param {{ trailerNumber?: string, doorNumber?: string, destination?: string }} patch
   * @returns {OutboundTrailer|null}
   */
  function updateOutboundTrailer(id, patch) {
    const list = readOutboundTrailers();
    const idx = list.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    const cur = list[idx];
    const next = {
      ...cur,
      trailerNumber:
        patch.trailerNumber != null
          ? String(patch.trailerNumber).trim()
          : cur.trailerNumber,
      doorNumber:
        patch.doorNumber != null ? String(patch.doorNumber).trim() : cur.doorNumber,
      destination:
        patch.destination != null
          ? String(patch.destination).trim() || 'open'
          : cur.destination,
    };
    list[idx] = next;
    writeOutboundTrailers(list);
    return next;
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  function removeOutboundTrailer(id) {
    const list = readOutboundTrailers();
    const next = list.filter((r) => r.id !== id);
    if (next.length === list.length) return false;
    writeOutboundTrailers(next);
    return true;
  }

  // ---------- Load plan (demo / future AI) ----------

  function readLoadPlan() {
    try {
      const raw = localStorage.getItem(PLAN_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  function writeLoadPlan(plan) {
    if (plan == null) {
      localStorage.removeItem(PLAN_KEY);
      return null;
    }
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
    return plan;
  }

  function clearLoadPlan() {
    localStorage.removeItem(PLAN_KEY);
  }

  /**
   * Replace all freight entries in one write (demo seed / bulk import).
   * Does not touch outbound registry or load plan unless caller does.
   * @param {Omit<DockEntry,'id'|'timestamp'|'slotLabel'> & {id?: string, timestamp?: string, slotLabel?: string, destination?: string}[]} rows
   * @returns {DockEntry[]}
   */
  function replaceAllEntries(rows) {
    const list = Array.isArray(rows) ? rows : [];
    /** @type {DockEntry[]} */
    const entries = [];
    for (const partial of list) {
      const section = Number(partial.section);
      const level = partial.level;
      const lateral = partial.lateral;
      const entry = {
        id: partial.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        pro: String(partial.pro || '').trim(),
        pieceFraction: String(partial.pieceFraction || '').trim(),
        trailerNumber: String(partial.trailerNumber || '').trim(),
        doorNumber: String(partial.doorNumber || '').trim(),
        section,
        level,
        lateral,
        slotLabel:
          partial.slotLabel ||
          formatSlot(section, level, lateral),
        h: partial.h == null || partial.h === '' ? null : Number(partial.h),
        w: partial.w == null || partial.w === '' ? null : Number(partial.w),
        d: partial.d == null || partial.d === '' ? null : Number(partial.d),
        weight:
          partial.weight == null || partial.weight === ''
            ? null
            : Number(partial.weight),
        timestamp: partial.timestamp || new Date().toISOString(),
      };
      entries.push(entry);
      if (partial.destination != null && String(partial.destination).trim() !== '') {
        setProDestination(entry.pro, String(partial.destination).trim());
      }
    }
    // Newest-first to match saveEntry / readAll convention
    entries.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    writeAll(entries);
    return entries;
  }

  /**
   * Find outbound trailer already registered for a destination (case-insensitive).
   * Skips "open". Prefers exact match after trim.
   * @param {string} destination
   * @returns {OutboundTrailer|null}
   */
  function outboundForDestination(destination) {
    const dest = String(destination || '').trim().toLowerCase();
    if (!dest || dest === 'open') return null;
    const list = readOutboundTrailers();
    return (
      list.find((r) => String(r.destination || '').trim().toLowerCase() === dest) ||
      null
    );
  }

  /**
   * Group entries by PRO (BOL).
   * Use this whenever you need to apply the same-trailer rule:
   * for a given PRO, all pieces should share one trailer identity.
   *
   * @param {DockEntry[]} [entries]
   * @returns {Record<string, DockEntry[]>}
   */
  function groupsByPro(entries) {
    const list = entries || readAll();
    /** @type {Record<string, DockEntry[]>} */
    const map = {};
    for (const e of list) {
      const key = (e.pro || '(no PRO)').trim() || '(no PRO)';
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return map;
  }

  /**
   * Returns entries already logged for a PRO (BOL).
   * Use with trailerNumbersForPro() to enforce same-PRO = same trailer number.
   * @param {string} pro
   * @returns {DockEntry[]}
   */
  function entriesForPro(pro) {
    const key = String(pro || '').trim();
    return readAll().filter((e) => e.pro === key);
  }

  /**
   * Distinct trailer numbers already used by a PRO.
   * Empty strings are ignored. Permanent rule: a PRO should have at most one.
   * @param {string} pro
   * @returns {string[]}
   */
  function trailerNumbersForPro(pro) {
    const seen = new Set();
    for (const e of entriesForPro(pro)) {
      const t = String(e.trailerNumber || '').trim();
      if (t) seen.add(t);
    }
    return Array.from(seen);
  }


  /**
   * Distinct trailer numbers from all saved entries (non-empty), sorted.
   * Use for load-out trailer picker chips.
   * @returns {string[]}
   */
  function allTrailerNumbers() {
    const seen = new Set();
    for (const e of readAll()) {
      const t = String(e.trailerNumber || '').trim();
      if (t) seen.add(t);
    }
    return Array.from(seen).sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb) && String(na) === a && String(nb) === b) {
        return na - nb;
      }
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }

  /**
   * All entries logged for a given trailer number.
   * @param {string} trailerNumber
   * @returns {DockEntry[]}
   */
  function entriesForTrailer(trailerNumber) {
    const key = String(trailerNumber || '').trim();
    if (!key) return [];
    return readAll().filter((e) => String(e.trailerNumber || '').trim() === key);
  }

  /**
   * Group entries for one trailer by PRO (bill), preserving piece order.
   * @param {string} trailerNumber
   * @returns {{ pro: string, pieces: DockEntry[], destination: string }[]}
   */
  function loadOutByTrailer(trailerNumber) {
    // Oldest first so the list reads like how the trailer was loaded
    const list = entriesForTrailer(trailerNumber).slice().reverse();
    const order = [];
    /** @type {Record<string, DockEntry[]>} */
    const map = {};
    for (const e of list) {
      const pro = (e.pro || '(no PRO)').trim() || '(no PRO)';
      if (!map[pro]) {
        map[pro] = [];
        order.push(pro);
      }
      map[pro].push(e);
    }
    // Within each PRO, sort by piece fraction numerator when possible, else timestamp
    return order.map((pro) => {
      const pieces = map[pro].slice().sort((a, b) => {
        const ma = /^(\d+)/.exec(a.pieceFraction || '');
        const mb = /^(\d+)/.exec(b.pieceFraction || '');
        if (ma && mb) return Number(ma[1]) - Number(mb[1]);
        return String(a.timestamp || '').localeCompare(String(b.timestamp || ''));
      });
      return { pro, pieces, destination: getProDestination(pro) };
    });
  }


  /**
   * Distinct door numbers from saved entries (non-empty), sorted numerically when possible.
   * @returns {string[]}
   */
  function allDoorNumbers() {
    const seen = new Set();
    for (const e of readAll()) {
      const d = String(e.doorNumber || '').trim();
      if (d) seen.add(d);
    }
    return Array.from(seen).sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb) && String(na) === a && String(nb) === b) {
        return na - nb;
      }
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }

  /**
   * Entries logged for a dock door.
   * @param {string} doorNumber
   * @returns {DockEntry[]}
   */
  function entriesForDoor(doorNumber) {
    const key = String(doorNumber || '').trim();
    if (!key) return [];
    return readAll().filter((e) => String(e.doorNumber || '').trim() === key);
  }

  /**
   * Current trailer at a door = trailer on the newest entry for that door.
   * Empty string if door has no usable trailer yet.
   * @param {string} doorNumber
   * @returns {string}
   */
  function currentTrailerAtDoor(doorNumber) {
    const list = entriesForDoor(doorNumber);
    for (const e of list) {
      // readAll is newest-first
      const t = String(e.trailerNumber || '').trim();
      if (t) return t;
    }
    return '';
  }

  /**
   * Text-only dock door board rows: doors that have data, each with current trailer.
   * Grouping is door → trailer (latest trailer wins when a door is reused).
   * @returns {{ doorNumber: string, trailerNumber: string, pieceCount: number, proCount: number }[]}
   */
  function doorsBoard() {
    const doors = allDoorNumbers();
    return doors.map((doorNumber) => {
      const trailerNumber = currentTrailerAtDoor(doorNumber);
      const pieces = trailerNumber
        ? entriesForDoor(doorNumber).filter(
            (e) => String(e.trailerNumber || '').trim() === trailerNumber
          )
        : entriesForDoor(doorNumber);
      const pros = new Set();
      for (const e of pieces) {
        const p = (e.pro || '').trim();
        if (p) pros.add(p);
      }
      return {
        doorNumber,
        trailerNumber,
        pieceCount: pieces.length,
        proCount: pros.size,
      };
    });
  }

  /**
   * PROs on the trailer currently assigned to a door (view-only dock drill-down).
   * Uses same-PRO = same-trailer grouping via loadOutByTrailer on the door's current trailer,
   * filtered to entries that also carry this door number when present.
   * @param {string} doorNumber
   * @returns {{ doorNumber: string, trailerNumber: string, groups: { pro: string, pieces: DockEntry[], destination: string }[] }}
   */
  function dockProsAtDoor(doorNumber) {
    const door = String(doorNumber || '').trim();
    const trailerNumber = currentTrailerAtDoor(door);
    if (!door || !trailerNumber) {
      return { doorNumber: door, trailerNumber: trailerNumber || '', groups: [] };
    }
    // Prefer entries that match both door + current trailer (consistent "what's at door")
    const list = entriesForDoor(door)
      .filter((e) => String(e.trailerNumber || '').trim() === trailerNumber)
      .slice()
      .reverse(); // oldest first for load order
    const order = [];
    /** @type {Record<string, DockEntry[]>} */
    const map = {};
    for (const e of list) {
      const pro = (e.pro || '(no PRO)').trim() || '(no PRO)';
      if (!map[pro]) {
        map[pro] = [];
        order.push(pro);
      }
      map[pro].push(e);
    }
    const groups = order.map((pro) => {
      const pieces = map[pro].slice().sort((a, b) => {
        const ma = /^(\d+)/.exec(a.pieceFraction || '');
        const mb = /^(\d+)/.exec(b.pieceFraction || '');
        if (ma && mb) return Number(ma[1]) - Number(mb[1]);
        return String(a.timestamp || '').localeCompare(String(b.timestamp || ''));
      });
      return { pro, pieces, destination: getProDestination(pro) };
    });
    return { doorNumber: door, trailerNumber, groups };
  }

  function setLastUsed(dims) {
    localStorage.setItem(LAST_USED_KEY, JSON.stringify(dims));
  }

  function getLastUsed() {
    try {
      const raw = localStorage.getItem(LAST_USED_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function formatTimeLocal(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }


  /**
   * Parse piece fraction "a/b" (integers). Returns {a,b} or null if invalid.
   * @param {string} raw
   * @returns {{a:number,b:number}|null}
   */
  function parsePieceFraction(raw) {
    const s = String(raw || "").trim();
    const m = /^(\d+)\s*\/\s*(\d+)$/.exec(s);
    if (!m) return null;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < 1 || a > b) return null;
    return { a, b };
  }

  /**
   * Entries for a PRO on a specific trailer number.
   * @param {string} pro
   * @param {string} trailerNumber
   * @returns {DockEntry[]}
   */
  function entriesForProOnTrailer(pro, trailerNumber) {
    const p = String(pro || "").trim();
    const t = String(trailerNumber || "").trim();
    if (!p || !t) return [];
    return readAll().filter(
      (e) => e.pro === p && String(e.trailerNumber || "").trim() === t
    );
  }

  /**
   * Next required piece numerator for PRO+trailer (1 if none yet).
   * Also returns total if an incomplete sequence is detected from saved fractions.
   * @param {string} pro
   * @param {string} trailerNumber
   * @returns {{ nextNum: number, total: number|null, count: number }}
   */
  function nextPieceForProOnTrailer(pro, trailerNumber) {
    const list = entriesForProOnTrailer(pro, trailerNumber);
    let total = null;
    for (const e of list) {
      const parsed = parsePieceFraction(e.pieceFraction);
      if (parsed) {
        if (total == null) total = parsed.b;
        else if (parsed.b !== total) total = Math.max(total, parsed.b);
      }
    }
    return { nextNum: list.length + 1, total, count: list.length };
  }


  /**
   * Edit a logged bill (PRO) after the fact.
   * - destination updates dockApp.pros.v1 (shared by all pieces; works even if
   *   pieces were saved before destination existed).
   * - trailerNumber / doorNumber update EVERY piece of that PRO together so
   *   piece sequence stays intact and same-PRO = same-trailer holds.
   * Does not require re-entering pieces.
   * @param {string} pro
   * @param {{ destination?: string, trailerNumber?: string, doorNumber?: string }} patch
   * @returns {{ pro: string, destination: string, trailerNumber: string, doorNumber: string, pieceCount: number }|null}
   */
  function updateProBill(pro, patch) {
    const key = String(pro || '').trim();
    if (!key) return null;
    patch = patch || {};

    const pieces = entriesForPro(key);
    if (!pieces.length && patch.destination == null) return null;

    let destination = getProDestination(key);
    if (patch.destination != null) {
      const rec = setProDestination(key, patch.destination);
      destination = rec ? rec.destination : '';
    }

    let trailerNumber = '';
    let doorNumber = '';
    const trailers = trailerNumbersForPro(key);
    if (trailers.length) trailerNumber = trailers[0];
    for (const e of pieces) {
      const d = String(e.doorNumber || '').trim();
      if (d) {
        doorNumber = d;
        break;
      }
    }

    const touchTrailer = Object.prototype.hasOwnProperty.call(patch, 'trailerNumber');
    const touchDoor = Object.prototype.hasOwnProperty.call(patch, 'doorNumber');

    if ((touchTrailer || touchDoor) && pieces.length) {
      const nextTrailer = touchTrailer
        ? String(patch.trailerNumber || '').trim()
        : null;
      const nextDoor = touchDoor ? String(patch.doorNumber || '').trim() : null;
      const all = readAll();
      for (let i = 0; i < all.length; i++) {
        if (String(all[i].pro || '').trim() !== key) continue;
        if (nextTrailer != null) all[i].trailerNumber = nextTrailer;
        if (nextDoor != null) all[i].doorNumber = nextDoor;
      }
      writeAll(all);
      if (nextTrailer != null) trailerNumber = nextTrailer;
      if (nextDoor != null) doorNumber = nextDoor;
    }

    return {
      pro: key,
      destination,
      trailerNumber,
      doorNumber,
      pieceCount: entriesForPro(key).length,
    };
  }

  global.DockStorage = {
    STORAGE_KEY,
    PROS_KEY,
    OUTBOUND_KEY,
    PLAN_KEY,
    readAll,
    saveEntry,
    clearAll,
    replaceAllEntries,
    readLoadPlan,
    writeLoadPlan,
    clearLoadPlan,
    outboundForDestination,
    readPros,
    getPro,
    getProDestination,
    setProDestination,
    updateProBill,
    readOutboundTrailers,
    saveOutboundTrailer,
    updateOutboundTrailer,
    removeOutboundTrailer,
    groupsByPro,
    entriesForPro,
    trailerNumbersForPro,
    allTrailerNumbers,
    entriesForTrailer,
    loadOutByTrailer,
    allDoorNumbers,
    entriesForDoor,
    currentTrailerAtDoor,
    doorsBoard,
    dockProsAtDoor,
    formatSlot,
    getLastUsed,
    setLastUsed,
    formatTimeLocal,
    parsePieceFraction,
    entriesForProOnTrailer,
    nextPieceForProOnTrailer,
  };
})(window);
