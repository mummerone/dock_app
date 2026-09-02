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
   * Returns trailers already used by a PRO (from slot labels / any future trailer id).
   * MVP stores slot only; callers can still detect multi-position same-PRO loads.
   * @param {string} pro
   * @returns {DockEntry[]}
   */
  function entriesForPro(pro) {
    const key = String(pro || '').trim();
    return readAll().filter((e) => e.pro === key);
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

  global.DockStorage = {
    STORAGE_KEY,
    readAll,
    saveEntry,
    clearAll,
    groupsByPro,
    entriesForPro,
    formatSlot,
    getLastUsed,
    setLastUsed,
    formatTimeLocal,
  };
})(window);
