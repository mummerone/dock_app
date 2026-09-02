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
 */

(function (global) {
  const STORAGE_KEY = 'dockApp.entries.v1';
  const LAST_USED_KEY = 'dockApp.lastUsedDims.v1';

  /**
   * @typedef {Object} DockEntry
   * @property {string} id
   * @property {string} pro
   * @property {string} pieceFraction  e.g. "3/5"
   * @property {string} trailerNumber  equipment ID e.g. "12345" (trailer identity for BOL rule)
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
   * @param {Omit<DockEntry,'id'|'timestamp'|'slotLabel'> & {timestamp?: string}} partial
   * @returns {DockEntry}
   */
  function saveEntry(partial) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      pro: String(partial.pro || '').trim(),
      pieceFraction: String(partial.pieceFraction || '').trim(),
      trailerNumber: String(partial.trailerNumber || '').trim(),
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

    return entry;
  }

  function clearAll() {
    writeAll([]);
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
   * @returns {{ pro: string, pieces: DockEntry[] }[]}
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
      return { pro, pieces };
    });
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

  global.DockStorage = {
    STORAGE_KEY,
    readAll,
    saveEntry,
    clearAll,
    groupsByPro,
    entriesForPro,
    trailerNumbersForPro,
    allTrailerNumbers,
    entriesForTrailer,
    loadOutByTrailer,
    formatSlot,
    getLastUsed,
    setLastUsed,
    formatTimeLocal,
    parsePieceFraction,
    entriesForProOnTrailer,
    nextPieceForProOnTrailer,
  };
})(window);
