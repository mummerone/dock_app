/**
 * Dock App — local demo load planner
 * ----------------------------------------------------
 * Phone / GitHub Pages build has no remote planning API.
 * runLoadPlan() is a local demo planner. A real backend can
 * replace the body of runLoadPlan() later while keeping the same shape.
 *
 * Permanent rule: all pieces of the same PRO stay on the same trailer.
 * Prefer one outbound trailer per destination (do not mix destinations
 * on one outbound if avoidable). Deck trailers: A=floor, B=first deck,
 * C=second deck. Section Tetris (high-and-tight): per section nose→tail,
 * place floor A then decks B/C before advancing — never whole-floor-first.
 */
(function (global) {
  'use strict';

  const DEMO_DESTINATIONS = [
    'Salt Lake City',
    'Denver',
    'San Antonio',
    'Missoula Montana',
    'Rapid City South Dakota',
  ];

  /** Outbound stub trailer numbers keyed by destination index */
  const DEMO_OUTBOUND_TRAILERS = ['90001', '90002', '90003', '90004', '90005'];
  const DEMO_OUTBOUND_DOORS = ['21', '22', '23', '24', '25'];

  /** Inbound demo doors / trailers */
  const DEMO_INBOUND = [
    { door: '1', trailer: '81001' },
    { door: '2', trailer: '81002' },
    { door: '3', trailer: '81003' },
    { door: '4', trailer: '81004' },
    { door: '5', trailer: '81005' },
  ];

  /** Per-section stack order: floor then decks (section Tetris). */
  const LEVELS_SECTION_TETRIS = ['A', 'B', 'C'];
  const LATERALS = ['Left', 'Middle', 'Right'];

  /**
   * v48 PUP axle / end-zone weight caps (planner enforces; UI mirrors).
   * 12 sections nose→tail. On a 48–53 ft van each bay ≈ 4–4.4 ft, so:
   *   nose zone (first ~4 ft) = section 1
   *   tail zone (last ~4 ft)  = section 12
   * Front axle share = secs 1–6; rear axle = secs 7–12.
   */
  const PUP_AXLE_CAP_LB = 20000;
  const PUP_ZONE_MAX_LB = 3200; // hard cap nose + tail
  const PUP_ZONE_SOFT_LB = 3000; // prefer staying under
  /** v48: absolute light-only ceiling for sec1/sec12 — heavies skip ends → middle */
  const PUP_END_LIGHT_MAX_LB = 900; // allows seed jitter on ≤800 catalog sizes
  const PUP_NOSE_SECTIONS = [1];
  const PUP_TAIL_SECTIONS = [12];
  const PUP_FRONT_SECTIONS = [1, 2, 3, 4, 5, 6];
  const PUP_REAR_SECTIONS = [7, 8, 9, 10, 11, 12];
  const PUP_MIDDLE_SECTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  /**
   * v50 stacking rule: a piece on a deck (B or C) must be no heavier than the
   * piece directly under it, and never more than this per-piece deck limit.
   */
  const DECK_PIECE_MAX_LB = 1500;
  /** v50 sample freight: pieces per destination (kept even so all 5 forklifts stay busy). */
  const DEMO_PIECES_PER_DEST_MIN = 19;
  const DEMO_PIECES_PER_DEST_MAX = 21;

  const SIZE_POOL = [
    { label: 'GMA pallet', h: 48, w: 48, d: 40, weight: 900 },
    { label: 'GMA tall', h: 60, w: 48, d: 40, weight: 1100 },
    { label: 'GMA short', h: 36, w: 48, d: 40, weight: 700 },
    { label: '48x48', h: 50, w: 48, d: 48, weight: 1200 },
    { label: 'Half pallet', h: 40, w: 48, d: 20, weight: 450 },
    { label: '55-gal drum', h: 35, w: 23, d: 23, weight: 400 },
    { label: '30-gal drum', h: 30, w: 19, d: 19, weight: 250 },
    { label: 'IBC 275', h: 46, w: 48, d: 40, weight: 2200 },
    { label: 'Gaylord', h: 48, w: 40, d: 36, weight: 800 },
    { label: 'Crate', h: 42, w: 36, d: 36, weight: 650 },
    { label: 'Skid low', h: 28, w: 48, d: 40, weight: 550 },
    { label: 'Skid high', h: 72, w: 48, d: 40, weight: 1400 },
  ];

  // ---------------------------------------------------------------------
  // v51: deterministic sample freight. The boss demo always uses the same
  // seed, so every load gives the identical freight, move count, weights and
  // percentages (any screen width, any reload).
  // ---------------------------------------------------------------------
  const DEMO_SEED = 51051;
  let rngSeeded = false;
  let rngState = 0;

  function seedRng(seed) {
    rngSeeded = true;
    rngState = seed >>> 0;
  }

  function unseedRng() {
    rngSeeded = false;
  }

  /** mulberry32: tiny, well-known seeded PRNG. */
  function rand() {
    if (!rngSeeded) return Math.random();
    rngState = (rngState + 0x6d2b79f5) >>> 0;
    let t = rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function randInt(min, max) {
    return min + Math.floor(rand() * (max - min + 1));
  }

  function pick(arr) {
    return arr[randInt(0, arr.length - 1)];
  }

  function jitter(n, pct) {
    const f = 1 + (rand() * 2 - 1) * pct;
    return Math.max(1, Math.round(n * f));
  }

  // ---------------------------------------------------------------------
  // v51 axle model (shared with the app so planned and live numbers match).
  // Each piece's weight is split between the front support (kingpin / dolly,
  // about 3 ft back from the nose) and the rear axle (about 42 ft back) by
  // where it sits: a piece right over the front support is 100% front, a
  // piece over the rear axle is 100% rear, halfway is 50/50. Freight only
  // (trailer weight not included). 12 sections × 4 ft = 48 ft.
  // ---------------------------------------------------------------------
  const SECTION_FT = 4;
  const AXLE_FRONT_SUPPORT_FT = 3;
  const AXLE_REAR_FT = 42;

  /** Share (0–1) of a piece in this section that rides on the rear axle. */
  function axleRearShare(section) {
    const sec = Number(section) || 0;
    if (!sec) return 0.5;
    const x = (sec - 0.5) * SECTION_FT;
    const r = (x - AXLE_FRONT_SUPPORT_FT) / (AXLE_REAR_FT - AXLE_FRONT_SUPPORT_FT);
    return Math.max(0, Math.min(1, r));
  }

  /**
   * Front / rear axle freight weight for pieces with a section (or slot "s/L/l").
   * @param {{section?:number, slot?:string, weight?:number}[]} pieces
   */
  function axleSplit(pieces) {
    let front = 0;
    let rear = 0;
    (pieces || []).forEach((p) => {
      const w = Number(p && p.weight);
      if (!Number.isFinite(w) || w <= 0) return;
      let sec = Number(p.section);
      if (!sec && p.slot) sec = Number(String(p.slot).split('/')[0]);
      const r = axleRearShare(sec);
      rear += w * r;
      front += w * (1 - r);
    });
    return { front, rear };
  }

  /** v51: stack height to the roof (inside height ≈ 108 in, minus load-bar room). */
  const STACK_HEIGHT_MAX_IN = 100;
  /** v51: sample forklift capacity — a piece heavier than this can't be moved. */
  const FORKLIFT_CAPACITY_LB = 5000;
  /** v51: pieces already on the OUT trailers "from earlier in the shift". */
  const DEMO_PRELOAD_KEY = 'dockApp.demoPreload.v1';
  /** v51: demo moves finish every OUT trailer at this section (10 of 12 ≈ 83%). */
  const DEMO_TARGET_END_SECTION = 10;

  /** v51 sample piece types (L×W in inches, weight lb). Lighter, realistic LTL mix. */
  const SAMPLE_POOL_V51 = [
    { kind: 'pallet', h: 48, w: 48, d: 40, weight: 640 },
    { kind: 'pallet', h: 60, w: 48, d: 40, weight: 820 },
    { kind: 'pallet', h: 36, w: 48, d: 40, weight: 460 },
    { kind: 'pallet', h: 50, w: 48, d: 48, weight: 880 },
    { kind: 'half pallet', h: 40, w: 48, d: 20, weight: 320 },
    { kind: 'drum', h: 35, w: 23, d: 23, weight: 400 },
    { kind: 'drum', h: 30, w: 19, d: 19, weight: 240 },
    { kind: 'tote', h: 46, w: 48, d: 40, weight: 1450 },
    { kind: 'gaylord', h: 44, w: 48, d: 40, weight: 520 },
    { kind: 'crate', h: 42, w: 36, d: 36, weight: 450 },
    { kind: 'skid', h: 28, w: 48, d: 40, weight: 380 },
    { kind: 'skid', h: 64, w: 48, d: 40, weight: 980 },
  ];
  /** v51: fragile / no-stack piece type (floor only, nothing on top). */
  const SAMPLE_FRAGILE = { kind: 'fragile cartons', h: 44, w: 48, d: 40, weight: 360, noStack: true };

  /**
   * Section-major high-and-tight slot order (section Tetris).
   * For section 1→12: A L/M/R, then B L/M/R, then C L/M/R.
   * Consuming this list fills floor then decks in each bay before moving aft.
   * Anti-pattern removed: never all floor A across the trailer before any B/C.
   * @returns {{section:number, level:string, lateral:string, slotLabel:string}[]}
   */
  function buildHighTightSlotOrder() {
    const slots = [];
    for (let section = 1; section <= 12; section++) {
      for (const level of LEVELS_SECTION_TETRIS) {
        for (const lateral of LATERALS) {
          slots.push({
            section,
            level,
            lateral,
            slotLabel: `${section}/${level}/${lateral}`,
          });
        }
      }
    }
    return slots;
  }

  /**
   * City / local loads: floor only (level A). No decks B/C.
   * Same section × lateral order as the floor pass of section Tetris.
   * @returns {{section:number, level:string, lateral:string, slotLabel:string}[]}
   */
  function buildFloorOnlySlotOrder() {
    const slots = [];
    for (let section = 1; section <= 12; section++) {
      for (const lateral of LATERALS) {
        slots.push({
          section,
          level: 'A',
          lateral,
          slotLabel: `${section}/A/${lateral}`,
        });
      }
    }
    return slots;
  }

  /**
   * Weight-aware slot order for outbound packing (v48).
   * Fill nose then tail first (light freight), then middle (heavy).
   * Within each section still high-and-tight: A then B/C (or floor-only A).
   * @param {boolean} cityFloorOnly
   */
  function buildWeightAwareSlotOrder(cityFloorOnly) {
    const base = cityFloorOnly
      ? buildFloorOnlySlotOrder()
      : buildHighTightSlotOrder();
    const middle = [];
    const nose = [];
    const tail = [];
    base.forEach((s) => {
      if (PUP_NOSE_SECTIONS.indexOf(s.section) >= 0) nose.push(s);
      else if (PUP_TAIL_SECTIONS.indexOf(s.section) >= 0) tail.push(s);
      else middle.push(s);
    });
    return nose.concat(tail).concat(middle);
  }

  /** Tetris compare for restoring nose→tail load order on moves. */
  function tetrisSlotRank(section, level, lateral) {
    const sec = Number(section) || 0;
    const lv = String(level || 'A').toUpperCase();
    const li = LATERALS.indexOf(lateral);
    const levelRank = lv === 'A' ? 0 : lv === 'B' ? 1 : lv === 'C' ? 2 : 9;
    return sec * 100 + levelRank * 10 + (li >= 0 ? li : 9);
  }

  function sortMovesTetrisOrder(moves) {
    moves.sort((a, b) => {
      const ta = (a && a.to) || {};
      const tb = (b && b.to) || {};
      const ra = tetrisSlotRank(ta.section, ta.level, ta.lateral);
      const rb = tetrisSlotRank(tb.section, tb.level, tb.lateral);
      if (ra !== rb) return ra - rb;
      return String(a.pro || '').localeCompare(String(b.pro || ''));
    });
  }

  /** Clear height wording for ground deck-build orders (inches above floor freight). */
  const DECK_CLEAR_HEIGHT_IN = 45;

  /**
   * Pack pieces of one inbound trailer into contiguous packed slots.
   * @param {number} pieceCount
   * @returns {{section:number, level:string, lateral:string, slotLabel:string}[]}
   */
  function allocateInboundSlots(pieceCount) {
    const order = buildHighTightSlotOrder();
    // Start at a random early section so trailers look differently loaded
    const start = randInt(0, Math.min(18, Math.max(0, order.length - pieceCount - 1)));
    return order.slice(start, start + pieceCount);
  }

  /**
   * Ensure one outbound trailer stub exists per destination (create if missing).
   * @param {string[]} [destinations]
   * @returns {{destination:string, trailer:object, created:boolean}[]}
   */
  function ensureOutboundStubs(destinations) {
    const dests = destinations && destinations.length ? destinations : DEMO_DESTINATIONS;
    const results = [];
    dests.forEach((destination, i) => {
      let row = DockStorage.outboundForDestination(destination);
      let created = false;
      const doorNumber = DEMO_OUTBOUND_DOORS[i] || '';
      if (!row) {
        const trailerNumber =
          DEMO_OUTBOUND_TRAILERS[i] || String(91000 + i);
        // Avoid colliding trailer numbers if somehow reused for another dest
        const existingNums = new Set(
          DockStorage.readOutboundTrailers().map((r) =>
            String(r.trailerNumber || '').trim()
          )
        );
        let tn = trailerNumber;
        let n = 0;
        while (existingNums.has(tn)) {
          n += 1;
          tn = String(Number(trailerNumber) + 100 + n);
        }
        row = DockStorage.saveOutboundTrailer({
          trailerNumber: tn,
          doorNumber,
          destination,
        });
        created = true;
      } else if (!String(row.doorNumber || '').trim() && doorNumber && row.id) {
        // Old saved stubs may lack door — keep map-friendly demo doors 21–25
        const updated = DockStorage.updateOutboundTrailer(row.id, { doorNumber });
        if (updated) row = updated;
      }
      results.push({ destination, trailer: row, created });
    });
    return results;
  }

  /**
   * Build ~5 inbound trailers packed with mixed freight.
   * Clears existing freight entries + PRO destinations first (caller confirms).
   * Creates outbound stubs for the five demo destinations if missing.
   * Does not clear the outbound registry (only adds stubs).
   * @returns {{inboundTrailers:number, proCount:number, pieceCount:number, outboundCreated:number}}
   */

  /**
   * All outbound registry rows for a destination (case-insensitive).
   * @param {string} destination
   * @returns {object[]}
   */
  function outboundTrailersForDestination(destination) {
    const dest = String(destination || '').trim().toLowerCase();
    if (!dest || dest === 'open') return [];
    return DockStorage.readOutboundTrailers().filter(
      (r) => String(r.destination || '').trim().toLowerCase() === dest
    );
  }

  /**
   * Create an extra outbound stub for the same destination when the first is full.
   * Copies cityFloorOnly from the primary when present. Uses free door 26+ and unique trailer #.
   * @param {string} destination
   * @param {object|null} primary
   * @returns {object|null}
   */
  function createExtraOutboundStub(destination, primary) {
    const dest = String(destination || '').trim();
    if (!dest) return null;
    const existing = DockStorage.readOutboundTrailers();
    const usedDoors = new Set(
      existing.map((r) => String(r.doorNumber || '').trim()).filter(Boolean)
    );
    const usedTrailers = new Set(
      existing.map((r) => String(r.trailerNumber || '').trim()).filter(Boolean)
    );
    let doorNum = 26;
    while (usedDoors.has(String(doorNum))) doorNum += 1;
    let trailerNum = 90101;
    while (usedTrailers.has(String(trailerNum))) trailerNum += 1;
    const cityFloorOnly = Boolean(primary && primary.cityFloorOnly);
    return DockStorage.saveOutboundTrailer({
      trailerNumber: String(trailerNum),
      doorNumber: String(doorNum),
      destination: dest,
      cityFloorOnly,
    });
  }

  /**
   * Init per-trailer pack state (unique slots only — never reuse last slot).
   * v48: weight-aware slot order + live section weights for axle/zone caps.
   * @param {object} outbound
   * @returns {object}
   */
  function initTrailerPackState(outbound) {
    const cityFloorOnly = Boolean(outbound && outbound.cityFloorOnly);
    const slotOrder = buildWeightAwareSlotOrder(cityFloorOnly);
    /** @type {Record<number, number>} */
    const sectionWeight = {};
    for (let s = 1; s <= 12; s++) sectionWeight[s] = 0;
    return {
      outbound,
      cityFloorOnly,
      slotOrder,
      cursor: 0,
      usedLabels: new Set(),
      loadGroups: [],
      sectionWeight,
      /** v50: slot label → piece (deck stacking rule) */
      slotPiece: new Map(),
    };
  }

  function freeSlotCount(state) {
    let free = 0;
    for (let c = 0; c < state.slotOrder.length; c++) {
      const lab = state.slotOrder[c].slotLabel;
      if (!state.usedLabels.has(lab)) free += 1;
    }
    return free;
  }

  function sumSections(state, sections) {
    let n = 0;
    for (let i = 0; i < sections.length; i++) {
      n += state.sectionWeight[sections[i]] || 0;
    }
    return n;
  }

  /**
   * Max additional lb allowed in this section given nose/tail zone + axle caps.
   * @param {object} state
   * @param {number} section
   * @returns {number}
   */
  function remainingCapForSection(state, section) {
    const sec = Number(section) || 0;
    let rem = Infinity;
    if (PUP_NOSE_SECTIONS.indexOf(sec) >= 0) {
      rem = Math.min(rem, PUP_ZONE_MAX_LB - sumSections(state, PUP_NOSE_SECTIONS));
    }
    if (PUP_TAIL_SECTIONS.indexOf(sec) >= 0) {
      rem = Math.min(rem, PUP_ZONE_MAX_LB - sumSections(state, PUP_TAIL_SECTIONS));
    }
    if (PUP_FRONT_SECTIONS.indexOf(sec) >= 0) {
      rem = Math.min(rem, PUP_AXLE_CAP_LB - sumSections(state, PUP_FRONT_SECTIONS));
    }
    if (PUP_REAR_SECTIONS.indexOf(sec) >= 0) {
      rem = Math.min(rem, PUP_AXLE_CAP_LB - sumSections(state, PUP_REAR_SECTIONS));
    }
    if (!Number.isFinite(rem)) rem = PUP_AXLE_CAP_LB;
    return Math.max(0, rem);
  }

  /**
   * Next free slot, optionally skipping labels (weight refusal this attempt).
   * Scans from start so gaps left in nose/tail stay usable by later PROs.
   * @param {object} state
   * @param {Set<string>|null} [skipLabels]
   */
  function nextFreeSlot(state, skipLabels) {
    for (let c = 0; c < state.slotOrder.length; c++) {
      const lab = state.slotOrder[c].slotLabel;
      if (state.usedLabels.has(lab)) continue;
      if (skipLabels && skipLabels.has(lab)) continue;
      state.cursor = c;
      return state.slotOrder[c];
    }
    return null;
  }

  /**
   * Place an entire PRO onto one trailer using unique slots only.
   * v48: refuse nose/tail/axle over-cap slots; light-only→ends, heavy→middle.
   * Caller must ensure freeSlotCount(state) >= ship.pieces.length (slot count);
   * weight caps may still force a rollback if nothing legal fits.
   * @returns {{pro:string, pieces:object[]}|null}
   */
  function placeEntireProOnTrailer(ship, state, moves) {
    const destination = ship.destination;
    const outbound = state.outbound;
    const pool = ship.pieces.slice();
    const plannedPieces = [];
    const n = pool.length;
    const startMoveLen = moves.length;
    const startCursor = state.cursor;
    /** @type {Record<number, number>} */
    const startWeights = {};
    for (let s = 1; s <= 12; s++) startWeights[s] = state.sectionWeight[s] || 0;
    /** @type {string[]} */
    const addedLabels = [];
    /** @type {Set<string>} */
    const skipLabels = new Set();
    const rollback = () => {
      moves.length = startMoveLen;
      addedLabels.forEach((lab) => {
        state.usedLabels.delete(lab);
        if (state.slotPiece) state.slotPiece.delete(lab);
      });
      state.cursor = startCursor;
      for (let s = 1; s <= 12; s++) state.sectionWeight[s] = startWeights[s];
    };
    let guard = 0;
    while (plannedPieces.length < n) {
      guard += 1;
      if (guard > state.slotOrder.length + n + 5) {
        rollback();
        return null;
      }
      const slot = nextFreeSlot(state, skipLabels);
      if (!slot) {
        rollback();
        return null;
      }
      const e = takePieceForSlot(pool, slot, state);
      if (!e) {
        // Nothing in this PRO fits this slot under caps — skip slot for this attempt
        skipLabels.add(slot.slotLabel);
        continue;
      }
      state.usedLabels.add(slot.slotLabel);
      addedLabels.push(slot.slotLabel);
      if (state.slotPiece) state.slotPiece.set(slot.slotLabel, e);
      const wAdd = pieceWeight(e);
      state.sectionWeight[slot.section] =
        (state.sectionWeight[slot.section] || 0) + wAdd;
      const fromSlot =
        e.slotLabel ||
        DockStorage.formatSlot(e.section, e.level, e.lateral);
      const toSlot = slot.slotLabel;
      const toDoor =
        String(outbound.doorNumber || '').trim() ||
        (DockStorage.outboundDoorFor
          ? DockStorage.outboundDoorFor({
              trailerNumber: outbound.trailerNumber,
              destination,
            })
          : '');
      moves.push({
        entryId: e.id,
        pro: ship.pro,
        pieceFraction: e.pieceFraction,
        destination,
        from: {
          door: String(e.doorNumber || '').trim(),
          trailer: String(e.trailerNumber || '').trim(),
          slot: fromSlot,
          section: e.section,
          level: e.level,
          lateral: e.lateral,
        },
        to: {
          trailer: outbound.trailerNumber,
          door: toDoor,
          slot: toSlot,
          section: slot.section,
          level: slot.level,
          lateral: slot.lateral,
        },
        h: e.h,
        w: e.w,
        d: e.d,
        weight: e.weight,
      });
      plannedPieces.push({
        entryId: e.id,
        pieceFraction: e.pieceFraction,
        slot: toSlot,
        section: slot.section,
        level: slot.level,
        lateral: slot.lateral,
        h: e.h,
        w: e.w,
        d: e.d,
        weight: e.weight,
        fromDoor: String(e.doorNumber || '').trim(),
        fromTrailer: String(e.trailerNumber || '').trim(),
        fromSlot,
      });
    }
    if (plannedPieces.length !== n) {
      rollback();
      return null;
    }
    const group = { pro: ship.pro, pieces: plannedPieces };
    state.loadGroups.push(group);
    return group;
  }

  function finalizeLoadoutFromState(state, destination) {
    const loadGroups = state.loadGroups;
    const pieceCount = loadGroups.reduce((n, g) => n + g.pieces.length, 0);
    let weightSum = 0;
    let weightCount = 0;
    loadGroups.forEach((g) => {
      g.pieces.forEach((p) => {
        if (p.weight != null && !Number.isNaN(Number(p.weight))) {
          weightSum += Number(p.weight);
          weightCount += 1;
        }
      });
    });
    return {
      trailerNumber: state.outbound.trailerNumber,
      doorNumber: String(state.outbound.doorNumber || '').trim(),
      destination,
      cityFloorOnly: state.cityFloorOnly,
      proCount: loadGroups.length,
      pieceCount,
      totalWeight: weightCount ? weightSum : null,
      groups: loadGroups,
    };
  }

  function seedDemoInbound() {
    // v51: fixed seed → identical sample freight every time
    seedRng(DEMO_SEED);
    try {
      return seedDemoInboundCore();
    } finally {
      unseedRng();
    }
  }

  /** Make one sample piece from a pool type. */
  function makeSamplePiece(type, extra) {
    return Object.assign(
      {
        h: jitter(type.h, 0.06),
        w: type.w,
        d: type.d,
        weight: jitter(type.weight, 0.1),
        kind: type.kind,
        noStack: Boolean(type.noStack),
      },
      extra || {}
    );
  }

  function seedDemoInboundCore() {
    // Clear freight + destinations; keep outbound list but ensure stubs
    DockStorage.clearAll();
    try {
      localStorage.setItem(DockStorage.PROS_KEY, '[]');
      localStorage.removeItem(DEMO_PRELOAD_KEY);
    } catch (_) {
      /* ignore */
    }
    DockStorage.clearLoadPlan();

    /** @type {object[]} */
    const rows = [];
    let proSeq = 700100;
    const baseTime = Date.now();

    // Bills per destination with an EVEN piece count (19–21 each) so every
    // outbound trailer has about the same work. The fraction "3/8" is the one
    // source of truth for a PRO's piece count. One fragile (no-stack) piece
    // per destination.
    const lightPool = SAMPLE_POOL_V51.filter((s) => s.weight <= 700);
    const heavyPool = SAMPLE_POOL_V51.filter((s) => s.weight > 700);
    /** @type {{pro:string, dest:string, pieces:object[]}[]} */
    const allBills = [];
    DEMO_DESTINATIONS.forEach((dest) => {
      let left = randInt(DEMO_PIECES_PER_DEST_MIN, DEMO_PIECES_PER_DEST_MAX);
      let p = 0;
      let fragileDone = false;
      while (left > 0) {
        let pieceCount = Math.min(left, randInt(2, 6));
        if (left - pieceCount === 1) pieceCount += 1;
        left -= pieceCount;
        const size =
          p % 3 === 0 ? pick(lightPool) : p % 3 === 1 ? pick(heavyPool) : pick(SAMPLE_POOL_V51);
        p += 1;
        const pro = String(proSeq++);
        const pieces = [];
        for (let i = 1; i <= pieceCount; i++) {
          let sz = size;
          if (i === 1 || (size.weight > PUP_END_LIGHT_MAX_LB && i === pieceCount)) sz = pick(lightPool);
          if (!fragileDone && p === 2 && i === pieceCount) {
            sz = SAMPLE_FRAGILE;
            fragileDone = true;
          }
          pieces.push(
            makeSamplePiece(sz, { pro, pieceFraction: `${i}/${pieceCount}`, destination: dest })
          );
        }
        allBills.push({ pro, dest, pieces });
      }
    });
    // Shuffle bills, then deal each to the inbound trailer with the fewest pieces
    for (let i = allBills.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      const t = allBills[i];
      allBills[i] = allBills[j];
      allBills[j] = t;
    }
    /** @type {{pro:string, dest:string, pieces:object[]}[][]} */
    const billsByInbound = DEMO_INBOUND.map(() => []);
    const piecesByInbound = DEMO_INBOUND.map(() => 0);
    allBills.forEach((bill) => {
      let best = 0;
      for (let k = 1; k < piecesByInbound.length; k++) {
        if (piecesByInbound[k] < piecesByInbound[best]) best = k;
      }
      billsByInbound[best].push(bill);
      piecesByInbound[best] += bill.pieces.length;
    });

    DEMO_INBOUND.forEach((ib, ibIdx) => {
      const bills = billsByInbound[ibIdx];
      const slots = allocateInboundSlots(piecesByInbound[ibIdx]);
      let slotIdx = 0;
      bills.forEach((bill) => {
        bill.pieces.forEach((piece, pi) => {
          const slot = slots[slotIdx++] || {
            section: ((slotIdx - 1) % 12) + 1,
            level: 'A',
            lateral: 'Middle',
            slotLabel: '1/A/Middle',
          };
          rows.push({
            id: `demo-${ib.trailer}-${bill.pro}-${pi + 1}`,
            pro: bill.pro,
            pieceFraction: piece.pieceFraction,
            trailerNumber: ib.trailer,
            doorNumber: ib.door,
            section: slot.section,
            level: slot.level,
            lateral: slot.lateral,
            slotLabel: slot.slotLabel,
            h: piece.h,
            w: piece.w,
            d: piece.d,
            weight: piece.weight,
            kind: piece.kind,
            noStack: piece.noStack,
            destination: bill.dest,
            timestamp: new Date(
              baseTime - (DEMO_INBOUND.length - ibIdx) * 600000 - slotIdx * 1000
            ).toISOString(),
          });
        });
      });
    });

    DockStorage.replaceAllEntries(rows);
    const stubs = ensureOutboundStubs(DEMO_DESTINATIONS);
    const outboundCreated = stubs.filter((s) => s.created).length;
    const pros = new Set(rows.map((r) => r.pro));

    // v51: freight already on each OUT trailer "from earlier in the shift".
    // Pick how many sections are pre-loaded so this trailer's demo moves
    // finish at the same section as every other trailer (consistent fill %).
    const preloadStore = { seed: DEMO_SEED, trailers: {} };
    let preSeq = 650100;
    DEMO_DESTINATIONS.forEach((dest) => {
      const row = DockStorage.outboundForDestination(dest);
      if (!row) return;
      const city = Boolean(row.cityFloorOnly);
      const demoPieces = rows.filter((r) => r.destination === dest);
      /** @type {object[]} */
      const pool = [];
      for (let b = 0; b < 26; b++) {
        const pro = String(preSeq++);
        const n = randInt(2, 4);
        const type = b % 2 === 0 ? pick(lightPool) : pick(SAMPLE_POOL_V51);
        for (let i = 1; i <= n; i++) {
          pool.push(makeSamplePiece(i === 1 ? pick(lightPool) : type, { pro, pieceFraction: `${i}/${n}` }));
        }
      }
      let best = null;
      for (let P = 2; P <= DEMO_TARGET_END_SECTION - 2; P++) {
        const pre = packTrailerPiecesV50(pool, city, { maxSection: P });
        const preset = pre.placements.map(({ piece, slot }) =>
          Object.assign({}, piece, { section: slot.section, level: slot.level, lateral: slot.lateral })
        );
        const res = packTrailerPiecesV50(demoPieces, city, { preset, minSection: P + 1 });
        if (res.unplaced.length) continue;
        const end = res.endSection;
        const score = end === DEMO_TARGET_END_SECTION ? 0 : end === DEMO_TARGET_END_SECTION + 1 ? 1 : 2 + Math.abs(end - DEMO_TARGET_END_SECTION);
        if (!best || score < best.score || (score === best.score && P > best.P)) {
          best = { P, preset, score, end };
        }
      }
      if (!best) return;
      // Renumber pieces per PRO so fractions match what is actually on board
      /** @type {Map<string, object[]>} */
      const byPro = new Map();
      best.preset.forEach((p) => {
        if (!byPro.has(p.pro)) byPro.set(p.pro, []);
        byPro.get(p.pro).push(p);
      });
      byPro.forEach((list) => {
        list.forEach((p, i) => {
          p.pieceFraction = `${i + 1}/${list.length}`;
        });
      });
      preloadStore.trailers[row.trailerNumber] = {
        destination: dest,
        endSection: best.P,
        pieces: best.preset.map((p) => ({
          pro: p.pro,
          pieceFraction: p.pieceFraction,
          section: p.section,
          level: p.level,
          lateral: p.lateral,
          h: p.h,
          w: p.w,
          d: p.d,
          weight: p.weight,
          kind: p.kind,
          noStack: Boolean(p.noStack),
        })),
      };
    });
    try {
      localStorage.setItem(DEMO_PRELOAD_KEY, JSON.stringify(preloadStore));
    } catch (_) {
      /* ignore */
    }

    return {
      inboundTrailers: DEMO_INBOUND.length,
      proCount: pros.size,
      pieceCount: rows.length,
      outboundCreated,
      destinations: DEMO_DESTINATIONS.slice(),
    };
  }

  /** v51: pre-loaded freight for the sample trailers (only while demo freight is on the dock). */
  function readDemoPreload(entries) {
    const list = entries || DockStorage.readAll();
    if (!list.some((e) => String(e.id || '').indexOf('demo-') === 0)) return null;
    try {
      const store = JSON.parse(localStorage.getItem(DEMO_PRELOAD_KEY) || 'null');
      return store && store.trailers ? store : null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Volume proxy for sorting denser / larger shipments first.
   * @param {{h?:number|null,w?:number|null,d?:number|null}[]} pieces
   */
  function shipmentVolume(pieces) {
    let v = 0;
    for (const e of pieces) {
      const h = Number(e.h) || 36;
      const w = Number(e.w) || 40;
      const d = Number(e.d) || 40;
      v += h * w * d;
    }
    return v;
  }

  function pieceWeight(e) {
    const w = Number(e && e.weight);
    return Number.isFinite(w) ? w : 0;
  }

  function pieceHeight(e) {
    const h = Number(e && e.h);
    return Number.isFinite(h) && h > 0 ? h : 36;
  }

  function shipmentWeight(pieces) {
    return pieces.reduce((n, e) => n + pieceWeight(e), 0);
  }

  /**
   * Soft weight spread: avoid dumping every heaviest PRO only in the nose.
   * Alternate taking from heavy and light ends of a weight-sorted list.
   * @param {{pro:string, destination:string, pieces:object[]}[]} shipments
   */
  function softSpreadProOrder(shipments) {
    const byWeight = shipments.slice().sort((a, b) => {
      const dw = shipmentWeight(b.pieces) - shipmentWeight(a.pieces);
      if (dw !== 0) return dw;
      return shipmentVolume(b.pieces) - shipmentVolume(a.pieces);
    });
    const result = [];
    let i = 0;
    let j = byWeight.length - 1;
    let takeHeavy = true;
    while (i <= j) {
      if (takeHeavy) result.push(byWeight[i++]);
      else result.push(byWeight[j--]);
      takeHeavy = !takeHeavy;
    }
    return result;
  }

  /**
   * Pick the best remaining piece for a slot level (no weight caps):
   * A (floor) → heaviest; B/C (deck) → shortest then lightest.
   * Mutates `pool` (removes chosen piece).
   * @param {object[]} pool
   * @param {string} level
   */
  function takePieceForLevel(pool, level) {
    if (!pool.length) return null;
    const lv = String(level || '').toUpperCase();
    let bestIdx = 0;
    if (lv === 'A') {
      for (let i = 1; i < pool.length; i++) {
        if (pieceWeight(pool[i]) > pieceWeight(pool[bestIdx])) bestIdx = i;
      }
    } else {
      for (let i = 1; i < pool.length; i++) {
        const a = pool[i];
        const b = pool[bestIdx];
        const dh = pieceHeight(a) - pieceHeight(b);
        if (dh < 0 || (dh === 0 && pieceWeight(a) < pieceWeight(b))) bestIdx = i;
      }
    }
    return pool.splice(bestIdx, 1)[0];
  }

  /**
   * v48: pick a piece for a slot under nose/tail/axle remaining caps.
   * Nose + tail → LIGHT freight only (≤ PUP_END_LIGHT_MAX_LB); heavies skip ends
   * and land in the middle on a later slot (redistribute, do not drop).
   * Prefer keeping end zones under soft 3,000. Middle floor A → heaviest that fits;
   * B/C → shortest then lightest.
   * Mutates `pool`. Returns null if nothing fits this slot.
   * @param {object[]} pool
   * @param {{section:number, level:string}} slot
   * @param {object} state
   */
  function takePieceForSlot(pool, slot, state) {
    if (!pool.length) return null;
    const rem = remainingCapForSection(state, slot.section);
    if (rem <= 0) return null;
    const sec = Number(slot.section) || 0;
    const isNose = PUP_NOSE_SECTIONS.indexOf(sec) >= 0;
    const isTail = PUP_TAIL_SECTIONS.indexOf(sec) >= 0;
    const isEnd = isNose || isTail;
    const lv = String(slot.level || '').toUpperCase();
    // v50 deck rule: needs a piece underneath, no heavier than it, ≤ deck limit
    let deckMax = Infinity;
    if (lv === 'B' || lv === 'C') {
      const below =
        state.slotPiece &&
        state.slotPiece.get(`${sec}/${lv === 'B' ? 'A' : 'B'}/${slot.lateral}`);
      if (!below) return null;
      deckMax = Math.min(pieceWeight(below), DECK_PIECE_MAX_LB);
    }

    /** @type {number[]} */
    const fit = [];
    for (let i = 0; i < pool.length; i++) {
      const w = pieceWeight(pool[i]);
      if (w > rem) continue;
      if (w > deckMax) continue;
      // v48 hard rule: no heavy pieces in first/last 4 ft (sec1 / sec12)
      if (isEnd && w > PUP_END_LIGHT_MAX_LB) continue;
      fit.push(i);
    }
    if (!fit.length) return null;

    // Soft target for end zones when possible
    let candidates = fit;
    if (isEnd) {
      const zoneSecs = isNose ? PUP_NOSE_SECTIONS : PUP_TAIL_SECTIONS;
      const cur = sumSections(state, zoneSecs);
      const softFit = fit.filter(
        (i) => cur + pieceWeight(pool[i]) <= PUP_ZONE_SOFT_LB
      );
      if (softFit.length) candidates = softFit;
    }

    // When packing the nose, reserve lightest pieces that still fit the tail budget
    // so the tail does not get stuck with only heavies.
    if (isNose && candidates.length > 1) {
      const tailRem = remainingCapForSection(state, PUP_TAIL_SECTIONS[0]);
      const byLight = pool
        .map((p, i) => ({ i, w: pieceWeight(p) }))
        .filter((x) => x.w > 0 && x.w <= PUP_ZONE_MAX_LB)
        .sort((a, b) => a.w - b.w);
      const reserved = new Set();
      let reservedW = 0;
      for (let k = 0; k < byLight.length; k++) {
        if (reservedW >= tailRem) break;
        const item = byLight[k];
        if (reservedW + item.w > tailRem && reserved.size > 0) continue;
        if (item.w <= tailRem - reservedW || reserved.size === 0) {
          // Reserve only while we still have room; skip if it would blow tail
          if (item.w <= tailRem) {
            reserved.add(item.i);
            reservedW += item.w;
          }
        }
      }
      const unreserved = candidates.filter((i) => !reserved.has(i));
      if (unreserved.length) candidates = unreserved;
    }

    let bestIdx = candidates[0];
    if (isEnd) {
      // Lightest; on decks also prefer shorter
      for (let c = 1; c < candidates.length; c++) {
        const i = candidates[c];
        const dw = pieceWeight(pool[i]) - pieceWeight(pool[bestIdx]);
        if (dw < 0) bestIdx = i;
        else if (
          dw === 0 &&
          lv !== 'A' &&
          pieceHeight(pool[i]) < pieceHeight(pool[bestIdx])
        ) {
          bestIdx = i;
        }
      }
    } else if (lv === 'A') {
      for (let c = 1; c < candidates.length; c++) {
        const i = candidates[c];
        if (pieceWeight(pool[i]) > pieceWeight(pool[bestIdx])) bestIdx = i;
      }
    } else {
      for (let c = 1; c < candidates.length; c++) {
        const i = candidates[c];
        const dh = pieceHeight(pool[i]) - pieceHeight(pool[bestIdx]);
        if (
          dh < 0 ||
          (dh === 0 && pieceWeight(pool[i]) < pieceWeight(pool[bestIdx]))
        ) {
          bestIdx = i;
        }
      }
    }
    return pool.splice(bestIdx, 1)[0];
  }


  // ---------------------------------------------------------------------
  // v50 packer — one pass per trailer, nose → tail, floor then decks.
  // Plain coding rules (no AI):
  //   1. Slots are filled in order: section 1 (nose) → 12 (tail); in each
  //      section the floor (A) Left/Middle/Right first, then Deck 2 (B), then
  //      Deck 3 (C). A part-full trailer therefore sits at the nose, the way
  //      real trailers are loaded.
  //   2. Nose (sec 1) and tail (sec 12): pieces ≤ 900 lb only, zone ≤ 3,000 lb
  //      target (3,200 lb hard cap).
  //   3. Front axle (secs 1–6) and rear axle (secs 7–12) ≤ 20,000 lb each.
  //   4. A deck piece needs a piece directly under it, must be no heavier than
  //      that piece, and no heavier than DECK_PIECE_MAX_LB.
  //   5. Each slot takes the heaviest remaining piece that passes 1–4, so heavy
  //      freight lands on the floor and lighter freight stacks on top.
  // ---------------------------------------------------------------------

  function pieceFractionNum(e) {
    const m = /^(\d+)/.exec(String((e && e.pieceFraction) || ''));
    return m ? Number(m[1]) : 0;
  }

  function slotOrderForTrailer(cityFloorOnly) {
    return cityFloorOnly ? buildFloorOnlySlotOrder() : buildHighTightSlotOrder();
  }

  /**
   * v51: can piece `e` go in `slot` right now?
   * Rules: forklift capacity · fragile = floor only, nothing on top · nose/tail
   * light only (≤900 lb, zone ≤ target) · each axle ≤ 20,000 lb (lever split)
   * · deck piece needs a piece under it, no heavier than it, ≤1,500 lb ·
   * stack fits under the roof (≤100 in).
   * @param {object} ctx { secW, bySlot, axle:{front,rear}, zoneTarget }
   * @returns {boolean}
   */
  function pieceFitsSlotV50(e, slot, ctx) {
    const w = pieceWeight(e);
    if (w > FORKLIFT_CAPACITY_LB) return false;
    const sec = Number(slot.section) || 0;
    const lv = String(slot.level || 'A').toUpperCase();
    if (e.noStack && lv !== 'A') return false;
    const isNose = PUP_NOSE_SECTIONS.indexOf(sec) >= 0;
    const isTail = PUP_TAIL_SECTIONS.indexOf(sec) >= 0;
    if ((isNose || isTail) && w > PUP_END_LIGHT_MAX_LB) return false;
    // v51: every 4 ft section (nose and tail included) stays under the
    // 3,200 lb company limit (planner aims for 3,000) so weight spreads along
    // the floor and both axles share it.
    if ((ctx.secW[sec] || 0) + w > ctx.zoneTarget) return false;
    const r = axleRearShare(sec);
    if (ctx.axle.front + w * (1 - r) > PUP_AXLE_CAP_LB) return false;
    if (ctx.axle.rear + w * r > PUP_AXLE_CAP_LB) return false;
    let stackH = pieceHeight(e);
    if (lv === 'B' || lv === 'C') {
      const belowLevel = lv === 'B' ? 'A' : 'B';
      const below = ctx.bySlot.get(`${sec}/${belowLevel}/${slot.lateral}`);
      if (!below) return false;
      if (below.noStack) return false;
      if (w > pieceWeight(below)) return false;
      if (w > DECK_PIECE_MAX_LB) return false;
      stackH += pieceHeight(below);
      if (lv === 'C') {
        const floor = ctx.bySlot.get(`${sec}/A/${slot.lateral}`);
        stackH += floor ? pieceHeight(floor) : 0;
      }
    }
    if (stackH > STACK_HEIGHT_MAX_IN) return false;
    return true;
  }

  /**
   * Pack a set of pieces into one trailer.
   * @param {object[]} pieces inbound entries
   * @param {boolean} cityFloorOnly
   * @param {{preset?:object[], minSection?:number, maxSection?:number}} [opts]
   *   preset = pieces already on the trailer (with section/level/lateral);
   *   minSection = first section new pieces may use (behind the preset);
   *   maxSection = last section new pieces may use.
   * @returns {{placements:{piece:object, slot:object, below:object|null}[], unplaced:object[], sectionWeight:Record<number,number>, axle:{front:number,rear:number}, endSection:number}}
   */
  function packTrailerPiecesV50(pieces, cityFloorOnly, opts) {
    const o = opts || {};
    const minSec = Number(o.minSection) || 1;
    const maxSec = Number(o.maxSection) || 12;
    const order = slotOrderForTrailer(cityFloorOnly).filter(
      (s) => s.section >= minSec && s.section <= maxSec
    );
    const pool = pieces.slice().sort((a, b) => {
      const dw = pieceWeight(b) - pieceWeight(a);
      if (dw !== 0) return dw;
      const dp = String(a.pro || '').localeCompare(String(b.pro || ''));
      if (dp !== 0) return dp;
      return pieceFractionNum(a) - pieceFractionNum(b);
    });
    /** @type {Record<number, number>} */
    const secW = {};
    for (let s = 1; s <= 12; s++) secW[s] = 0;
    /** @type {Map<string, object>} */
    const bySlot = new Map();
    const axle = { front: 0, rear: 0 };
    (o.preset || []).forEach((p) => {
      const sec = Number(p.section) || 0;
      const w = pieceWeight(p);
      secW[sec] = (secW[sec] || 0) + w;
      bySlot.set(`${sec}/${p.level}/${p.lateral}`, p);
      const r = axleRearShare(sec);
      axle.front += w * (1 - r);
      axle.rear += w * r;
    });
    const ctx = { secW, bySlot, axle, zoneTarget: PUP_ZONE_SOFT_LB };
    const placements = [];
    let endSection = 0;
    for (let c = 0; c < order.length && pool.length; c++) {
      const slot = order[c];
      if (bySlot.has(slot.slotLabel)) continue;
      let idx = -1;
      // Prefer the 3,000 lb target in end zones; never past the 3,200 hard cap
      for (let i = 0; i < pool.length; i++) {
        if (pieceFitsSlotV50(pool[i], slot, ctx)) {
          idx = i;
          break;
        }
      }
      if (idx < 0) continue;
      const e = pool.splice(idx, 1)[0];
      const w = pieceWeight(e);
      secW[slot.section] = (secW[slot.section] || 0) + w;
      const r = axleRearShare(slot.section);
      axle.front += w * (1 - r);
      axle.rear += w * r;
      bySlot.set(slot.slotLabel, e);
      if (slot.section > endSection) endSection = slot.section;
      const lv = String(slot.level || 'A').toUpperCase();
      const below =
        lv === 'B'
          ? bySlot.get(`${slot.section}/A/${slot.lateral}`) || null
          : lv === 'C'
            ? bySlot.get(`${slot.section}/B/${slot.lateral}`) || null
            : null;
      placements.push({ piece: e, slot, below });
    }
    return { placements, unplaced: pool, sectionWeight: secW, axle, endSection };
  }

  /**
   * Build moves + a loadout from a trailer's final packing.
   * @returns {object} loadout
   */
  function finalizeTrailerV50(st, destination, moves) {
    const res = packTrailerPiecesV50(st.pieces, st.cityFloorOnly, st.packOpts);
    const outbound = st.outbound;
    const toDoor =
      String(outbound.doorNumber || '').trim() ||
      (DockStorage.outboundDoorFor
        ? DockStorage.outboundDoorFor({
            trailerNumber: outbound.trailerNumber,
            destination,
          })
        : '');
    /** @type {Map<string, object[]>} */
    const byPro = new Map();
    st.ships.forEach((ship) => byPro.set(ship.pro, []));
    res.placements.forEach(({ piece: e, slot, below }) => {
      const fromSlot =
        e.slotLabel || DockStorage.formatSlot(e.section, e.level, e.lateral);
      const belowInfo = below
        ? {
            pro: below.pro,
            pieceFraction: below.pieceFraction,
            weight: below.weight,
            h: below.h,
            kind: below.kind || '',
          }
        : null;
      moves.push({
        entryId: e.id,
        pro: e.pro,
        pieceFraction: e.pieceFraction,
        destination,
        from: {
          door: String(e.doorNumber || '').trim(),
          trailer: String(e.trailerNumber || '').trim(),
          slot: fromSlot,
          section: e.section,
          level: e.level,
          lateral: e.lateral,
        },
        to: {
          trailer: outbound.trailerNumber,
          door: toDoor,
          slot: slot.slotLabel,
          section: slot.section,
          level: slot.level,
          lateral: slot.lateral,
          below: belowInfo,
        },
        h: e.h,
        w: e.w,
        d: e.d,
        weight: e.weight,
        kind: e.kind || '',
        noStack: Boolean(e.noStack),
      });
      if (!byPro.has(e.pro)) byPro.set(e.pro, []);
      byPro.get(e.pro).push({
        entryId: e.id,
        pieceFraction: e.pieceFraction,
        slot: slot.slotLabel,
        section: slot.section,
        level: slot.level,
        lateral: slot.lateral,
        h: e.h,
        w: e.w,
        d: e.d,
        weight: e.weight,
        kind: e.kind || '',
        noStack: Boolean(e.noStack),
        below: belowInfo,
        fromDoor: String(e.doorNumber || '').trim(),
        fromTrailer: String(e.trailerNumber || '').trim(),
        fromSlot,
      });
    });
    st.loadGroups = [];
    byPro.forEach((pieces, pro) => {
      if (!pieces.length) return;
      pieces.sort((a, b) => pieceFractionNum(a) - pieceFractionNum(b));
      st.loadGroups.push({ pro, pieces });
    });
    const load = finalizeLoadoutFromState(st, destination);
    const preset = (st.packOpts && st.packOpts.preset) || [];
    load.preloaded = preset.map((p) => ({
      pro: p.pro,
      pieceFraction: p.pieceFraction,
      slot: `${p.section}/${p.level}/${p.lateral}`,
      section: p.section,
      level: p.level,
      lateral: p.lateral,
      h: p.h,
      w: p.w,
      d: p.d,
      weight: p.weight,
      kind: p.kind || '',
      noStack: Boolean(p.noStack),
      preloaded: true,
    }));
    load.preloadedCount = load.preloaded.length;
    let endSec = 0;
    load.preloaded.forEach((p) => { if (p.section > endSec) endSec = p.section; });
    res.placements.forEach(({ slot }) => { if (slot.section > endSec) endSec = slot.section; });
    load.endSection = endSec;
    return load;
  }

  /**
   * Local section-Tetris (high-and-tight) demo planner.
   * Reads all inbound dock pieces + destinations, assigns PROs to outbound
   * trailers by destination (one trailer per dest when possible), packs
   * section-by-section nose→tail (A then B/C per bay), returns and persists a plan.
   *
   * Replace the internals of this function later with a real AI backend call;
   * keep the returned plan shape stable for the UI.
   *
   * @returns {object} plan
   */
  function runLoadPlan() {
    const entries = DockStorage.readAll();
    if (!entries.length) {
      const empty = {
        createdAt: new Date().toISOString(),
        planner: 'demo',
        label: 'demo plan',
        moves: [],
        outboundLoadouts: [],
        summary: {
          moveCount: 0,
          proCount: 0,
          pieceCount: 0,
          outboundCount: 0,
          skippedNoDest: 0,
          note: 'Nothing to plan yet. Load demo inbound trailers (Inbound) or log freight first.',
        },
      };
      DockStorage.writeLoadPlan(empty);
      return empty;
    }

    // Collect destinations present on dock freight
    const groups = DockStorage.groupsByPro(entries);
    /** @type {{pro:string, destination:string, pieces:object[]}[]} */
    const shipments = [];
    let skippedNoDest = 0;
    Object.keys(groups).forEach((pro) => {
      const pieces = groups[pro].slice().sort((a, b) => {
        const ma = /^(\d+)/.exec(a.pieceFraction || '');
        const mb = /^(\d+)/.exec(b.pieceFraction || '');
        if (ma && mb) return Number(ma[1]) - Number(mb[1]);
        return String(a.timestamp || '').localeCompare(String(b.timestamp || ''));
      });
      const destination = DockStorage.getProDestination(pro);
      if (!destination) {
        skippedNoDest += 1;
        return;
      }
      shipments.push({ pro, destination, pieces });
    });

    // Unique destinations in stable order (demo list first, then others)
    const destOrder = [];
    const seenDest = new Set();
    DEMO_DESTINATIONS.forEach((d) => {
      if (shipments.some((s) => s.destination === d)) {
        destOrder.push(d);
        seenDest.add(d.toLowerCase());
      }
    });
    shipments.forEach((s) => {
      const key = s.destination.toLowerCase();
      if (!seenDest.has(key)) {
        seenDest.add(key);
        destOrder.push(s.destination);
      }
    });

    ensureOutboundStubs(destOrder);
    const preload = readDemoPreload(entries);

    /** Map dest -> primary outbound trailer row */
    const outboundByDest = {};
    destOrder.forEach((destination) => {
      const row = DockStorage.outboundForDestination(destination);
      if (row) outboundByDest[destination] = row;
    });

    /** @type {object[]} */
    const moves = [];
    /** @type {object[]} */
    const outboundLoadouts = [];
    /** @type {{pro:string, destination:string, pieceCount:number, reason:string, pieces?:object[]}[]} */
    const unplaced = [];
    /** @type {{pro:string, reason:string}[]} */
    const skipped = [];

    let cityFloorOnlyCount = 0;
    let secondStubCount = 0;

    destOrder.forEach((destination) => {
      const primary = outboundByDest[destination];
      if (!primary) return;

      const destShipments = softSpreadProOrder(
        shipments.filter((s) => s.destination === destination)
      );

      // v50: each trailer keeps a list of whole PROs; a PRO is accepted only if
      // the full trailer (old pieces + this PRO) still packs with every rule.
      const newV50State = (outbound) => {
        const st = initTrailerPackState(outbound);
        st.pieces = [];
        st.ships = [];
        // v51: sample trailers start with freight from earlier in the shift
        const pre = preload && preload.trailers[String(outbound.trailerNumber || '').trim()];
        st.packOpts = pre
          ? { preset: pre.pieces, minSection: (Number(pre.endSection) || 0) + 1 }
          : {};
        return st;
      };
      const tryAddShip = (st, ship) => {
        const trial = st.pieces.concat(ship.pieces);
        const res = packTrailerPiecesV50(trial, st.cityFloorOnly, st.packOpts);
        if (res.unplaced.length) return false;
        st.pieces = trial;
        st.ships.push(ship);
        return true;
      };
      const trailerStates = [newV50State(primary)];
      if (trailerStates[0].cityFloorOnly) cityFloorOnlyCount += 1;

      destShipments.forEach((ship) => {
        const n = ship.pieces.length;
        let placed = false;

        // Prefer existing trailers that can take the WHOLE PRO (same-PRO intact).
        for (let ti = 0; ti < trailerStates.length; ti++) {
          if (tryAddShip(trailerStates[ti], ship)) {
            placed = true;
            break;
          }
        }

        // Policy: try one second outbound stub for same dest when full.
        if (!placed && trailerStates.length < 2) {
          const extra = createExtraOutboundStub(destination, primary);
          if (extra) {
            secondStubCount += 1;
            const st = newV50State(extra);
            trailerStates.push(st);
            if (tryAddShip(st, ship)) placed = true;
          }
        }

        if (!placed) {
          const reason = trailerStates.some((s) => s.cityFloorOnly)
            ? 'city_floor_full'
            : 'no_capacity';
          unplaced.push({
            pro: ship.pro,
            destination,
            pieceCount: n,
            reason,
            pieces: ship.pieces.map((e) => ({
              entryId: e.id,
              pieceFraction: e.pieceFraction,
              fromDoor: String(e.doorNumber || '').trim(),
              fromTrailer: String(e.trailerNumber || '').trim(),
            })),
          });
        }
      });

      trailerStates.forEach((st) => {
        if (st.pieces.length) {
          outboundLoadouts.push(finalizeTrailerV50(st, destination, moves));
        }
      });
    });

    // Bills with no destination already counted; mirror into skipped[]
    Object.keys(groups).forEach((pro) => {
      if (!DockStorage.getProDestination(pro)) {
        skipped.push({ pro, reason: 'no_dest' });
      }
    });

    // Restore forklift load order: nose→tail section Tetris (placement used middle-first)
    sortMovesTetrisOrder(moves);

    const packedCount = moves.length;
    const unplacedPieceCount = unplaced.reduce((n, u) => n + (u.pieceCount || 0), 0);
    const totalDestPieces = packedCount + unplacedPieceCount;

    let note;
    if (unplaced.length > 0) {
      note =
        `Demo planner packed ${packedCount}/${totalDestPieces} pieces — ` +
        `${unplaced.length} PRO(s) unplaced (${unplacedPieceCount} piece(s)). ` +
        `Unique slots only (no last-slot reuse). Light freight in nose/tail zones (max 3,200 lb). ` +
        (secondStubCount
          ? `Opened ${secondStubCount} second outbound stub(s). `
          : '') +
        `Use Agent packed this (demo) for leftovers, or free capacity / clear city floor-only.`;
    } else if (skippedNoDest > 0) {
      note = `${skippedNoDest} bill(s) skipped — no destination set. Tap Edit bill on each, then build again.`;
    } else if (cityFloorOnlyCount > 0) {
      note =
        `Packed high-and-tight per bay; light freight in nose/tail (≤3,200 lb), heavy in middle. ` +
        `City loads floor-only. ${cityFloorOnlyCount} city load(s) used floor only (level A) — no decks. ` +
        `Every piece has a unique outbound slot.`;
    } else {
      note =
        'Packed nose→tail, floor first then decks. Nose/tail take light pieces only (900 lb or less, 3,200 lb per zone); each axle ≤20,000 lb; a deck piece is never heavier than the piece under it; fragile pieces stay on the floor with nothing on top; stacks fit under the roof (100 in); every piece is under the 5,000 lb forklift limit. Every piece has a unique outbound slot.';
    }

    const plan = {
      createdAt: new Date().toISOString(),
      planner: 'demo',
      label: 'demo plan',
      moves,
      outboundLoadouts,
      summary: {
        moveCount: packedCount,
        proCount: shipments.length,
        pieceCount: totalDestPieces,
        packedCount,
        unplacedCount: unplaced.length,
        unplacedPieceCount,
        outboundCount: outboundLoadouts.length,
        skippedNoDest,
        cityFloorOnlyCount,
        secondStubCount,
        unplaced,
        skipped,
        note,
      },
    };

    DockStorage.writeLoadPlan(plan);
    return plan;
  }

  /**
   * Ground deck-build orders from a load plan.
   * One order per outbound trailer section that has B/C freight.
   * City floor-only trailers produce no orders.
   * @param {object|null} plan
   * @returns {{id:string, trailerNumber:string, destination:string, section:number, label:string, detail:string}[]}
   */
  function deriveGroundOrders(plan) {
    const orders = [];
    if (!plan) return orders;
    const loads = plan.outboundLoadouts || [];
    const moves = plan.moves || [];

    /** @type {Map<string, {trailerNumber:string, destination:string, cityFloorOnly:boolean, sections:Set<number>}>} */
    const byTrailer = new Map();

    const ensure = (trailerNumber, destination, cityFloorOnly) => {
      const t = String(trailerNumber || '').trim();
      if (!t) return null;
      if (!byTrailer.has(t)) {
        byTrailer.set(t, {
          trailerNumber: t,
          destination: String(destination || '').trim(),
          cityFloorOnly: Boolean(cityFloorOnly),
          sections: new Set(),
        });
      }
      const row = byTrailer.get(t);
      if (destination && !row.destination) row.destination = String(destination).trim();
      if (cityFloorOnly) row.cityFloorOnly = true;
      return row;
    };

    loads.forEach((load) => {
      ensure(load.trailerNumber, load.destination, load.cityFloorOnly);
      if (load.cityFloorOnly) return;
      (load.groups || []).forEach((g) => {
        (g.pieces || []).forEach((p) => {
          const level = String(p.level || '').toUpperCase();
          if (level === 'B' || level === 'C') {
            const sec = Number(p.section);
            if (sec >= 1 && sec <= 12) {
              const row = ensure(load.trailerNumber, load.destination, false);
              if (row && !row.cityFloorOnly) row.sections.add(sec);
            }
          }
        });
      });
    });

    moves.forEach((m) => {
      const to = m.to || {};
      const t = String(to.trailer || '').trim();
      if (!t) return;
      const level = String(to.level || '').toUpperCase();
      const row = ensure(t, m.destination, false);
      // Respect city flag from loadout / registry if already known
      if (!row || row.cityFloorOnly) return;
      if (level === 'B' || level === 'C') {
        const sec = Number(to.section);
        if (sec >= 1 && sec <= 12) row.sections.add(sec);
      }
    });

    // Also honor live outbound registry cityFloorOnly (in case plan predates flag on loadout)
    const registry = typeof DockStorage !== 'undefined' ? DockStorage.readOutboundTrailers() : [];
    registry.forEach((r) => {
      const t = String(r.trailerNumber || '').trim();
      if (!t || !byTrailer.has(t)) return;
      if (r.cityFloorOnly) {
        byTrailer.get(t).cityFloorOnly = true;
        byTrailer.get(t).sections.clear();
      }
    });

    const trailers = Array.from(byTrailer.values()).sort((a, b) =>
      a.trailerNumber.localeCompare(b.trailerNumber, undefined, { numeric: true })
    );

    trailers.forEach((row) => {
      if (row.cityFloorOnly) return;
      const sections = Array.from(row.sections).sort((a, b) => a - b);
      sections.forEach((section) => {
        orders.push({
          id: `${row.trailerNumber}::S${section}`,
          trailerNumber: row.trailerNumber,
          destination: row.destination || '',
          section,
          label: `Build deck · Section ${section} · above ~${DECK_CLEAR_HEIGHT_IN} in`,
          detail: `Trailer ${row.trailerNumber}${row.destination ? ` → ${row.destination}` : ''} — leave clear height above floor freight, then set the deck for section ${section}.`,
        });
      });
    });

    return orders;
  }


  /**
   * Dock-wide forklift crew board (boss demo).
   * One operator per pull (inbound) door — never two on the same door.
   * Prefer different outbound trailers when possible.
   * @param {object|null} plan
   * @param {{ rotate?: number }} [opts] rotate offsets which move is shown per door (Refresh)
   * @returns {{ assignments: object[], note: string, doorCount: number, source: string }}
   */
  function deriveCrewAssignments(plan, opts) {
    const rotate = Math.max(0, Number(opts && opts.rotate) || 0);
    const TARGET = 5;

    /** @type {Map<string, object[]>} door -> candidate rows */
    const byDoor = new Map();

    function addCandidate(row) {
      const door = String(row.fromDoor || '').trim();
      if (!door) return;
      if (!byDoor.has(door)) byDoor.set(door, []);
      byDoor.get(door).push(row);
    }

    const moves = plan && Array.isArray(plan.moves) ? plan.moves : [];
    let source = 'plan';

    if (moves.length) {
      moves.forEach((m) => {
        const toTrailer = (m.to && m.to.trailer) || '';
        const destination = m.destination || '';
        const toDoor =
          (typeof DockStorage !== 'undefined' && DockStorage.outboundDoorFor
            ? DockStorage.outboundDoorFor({
                door: (m.to && m.to.door) || '',
                trailerNumber: toTrailer,
                destination,
              })
            : (m.to && m.to.door) || '') || '';
        addCandidate({
          fromDoor: (m.from && m.from.door) || '',
          fromTrailer: (m.from && m.from.trailer) || '',
          fromSlot: (m.from && m.from.slot) || '',
          toTrailer,
          toDoor,
          toSlot: (m.to && m.to.slot) || '',
          destination,
          pro: m.pro || '',
          pieceFraction: m.pieceFraction || '',
          entryId: m.entryId || '',
        });
      });
    } else {
      // No plan: use live inbound doors, else demo inbound doors
      source = 'inbound';
      const doors = typeof DockStorage !== 'undefined' ? DockStorage.allDoorNumbers() : [];
      if (doors.length) {
        doors.forEach((door) => {
          const entries = DockStorage.entriesForDoor(door);
          if (!entries.length) return;
          // One candidate per distinct inbound trailer on this door (usually one)
          const seenTrl = new Set();
          entries.forEach((e) => {
            const trl = String(e.trailerNumber || '').trim() || '—';
            if (seenTrl.has(trl)) return;
            seenTrl.add(trl);
            const dest =
              (e.destination && String(e.destination).trim()) ||
              (DockStorage.getProDestination && DockStorage.getProDestination(e.pro)) ||
              '';
            const fromSlot =
              e.slotLabel ||
              (DockStorage.formatSlot
                ? DockStorage.formatSlot(e.section, e.level, e.lateral)
                : '');
            let toTrailer = '';
            let toDoor = '';
            if (dest && typeof DockStorage !== 'undefined') {
              const ob = DockStorage.outboundForDestination
                ? DockStorage.outboundForDestination(dest)
                : null;
              if (ob) {
                toTrailer = String(ob.trailerNumber || '').trim();
                toDoor = String(ob.doorNumber || '').trim();
              }
              if (!toDoor && DockStorage.outboundDoorFor) {
                toDoor = DockStorage.outboundDoorFor({
                  trailerNumber: toTrailer,
                  destination: dest,
                });
              }
            }
            addCandidate({
              fromDoor: door,
              fromTrailer: trl,
              fromSlot: fromSlot || '',
              toTrailer,
              toDoor,
              toSlot: '',
              destination: dest || '',
              pro: e.pro || '',
              pieceFraction: e.pieceFraction || '',
              entryId: e.id || '',
            });
          });
        });
      } else {
        source = 'demo';
        DEMO_INBOUND.forEach((ib, i) => {
          addCandidate({
            fromDoor: ib.door,
            fromTrailer: ib.trailer,
            fromSlot: '',
            toTrailer: DEMO_OUTBOUND_TRAILERS[i] || '',
            toDoor: DEMO_OUTBOUND_DOORS[i] || '',
            toSlot: '',
            destination: DEMO_DESTINATIONS[i] || '',
            pro: '',
            pieceFraction: '',
            entryId: '',
          });
        });
      }
    }

    const doors = Array.from(byDoor.keys()).sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb) && String(na) === a && String(nb) === b) {
        return na - nb;
      }
      return a.localeCompare(b, undefined, { numeric: true });
    });

    if (!doors.length) {
      return {
        assignments: [],
        note: 'No pull doors with work yet. Load demo inbound trailers, or build a load plan.',
        doorCount: 0,
        source,
      };
    }

    // Rotate door order so Refresh reshuffles who starts where
    const start = rotate % doors.length;
    const orderedDoors = doors.slice(start).concat(doors.slice(0, start));

    const usedOutbound = new Set();
    /** @type {object[]} */
    const assignments = [];

    orderedDoors.forEach((door, idx) => {
      const bucket = byDoor.get(door) || [];
      if (!bucket.length) return;

      // Prefer a move whose outbound trailer is not already assigned
      const offset = rotate % bucket.length;
      const rotated = bucket.slice(offset).concat(bucket.slice(0, offset));
      let pick = rotated.find((r) => r.toTrailer && !usedOutbound.has(String(r.toTrailer))) || rotated[0];
      if (pick.toTrailer) usedOutbound.add(String(pick.toTrailer));

      // Optional next-up: another row on same door, prefer different outbound
      let next = null;
      for (let i = 0; i < rotated.length; i++) {
        const r = rotated[i];
        if (r === pick) continue;
        if (pick.toTrailer && r.toTrailer && String(r.toTrailer) === String(pick.toTrailer)) continue;
        next = r;
        break;
      }
      if (!next && rotated.length > 1) {
        next = rotated.find((r) => r !== pick) || null;
      }

      const opNum = assignments.length + 1;
      const fromTrl = pick.fromTrailer || '—';
      const toTrl = pick.toTrailer || '';
      const dest = pick.destination || '';
      let toDoor = pick.toDoor || '';
      if (
        !toDoor &&
        typeof DockStorage !== 'undefined' &&
        DockStorage.outboundDoorFor
      ) {
        toDoor = DockStorage.outboundDoorFor({
          trailerNumber: toTrl,
          destination: dest,
        });
      }

      function loadingPhrase(trl, doorNum, destination, slot) {
        const parts = [];
        if (doorNum) parts.push(`Door ${doorNum}`);
        else if (trl) parts.push('Door —');
        if (trl) parts.push(`Trl ${trl}`);
        if (destination) parts.push(destination);
        if (slot) parts.push(`LOAD ${slot}`);
        return parts.join(' · ');
      }

      const toSlot = pick.toSlot || '';
      let line;
      if (toTrl) {
        line =
          `Operator ${opNum} — pulling Door ${door} · Trl ${fromTrl} → loading ${loadingPhrase(toTrl, toDoor, dest, toSlot)}`;
      } else if (dest) {
        const loadBit = toDoor
          ? `loading Door ${toDoor} · ${dest} (no plan yet)`
          : `${dest} (no plan yet)`;
        line = `Operator ${opNum} — pulling Door ${door} · Trl ${fromTrl} → ${loadBit}`;
      } else {
        line = `Operator ${opNum} — pulling Door ${door} · Trl ${fromTrl} (no plan yet)`;
      }

      let nextLine = '';
      if (next) {
        let nextToDoor = next.toDoor || '';
        if (
          !nextToDoor &&
          typeof DockStorage !== 'undefined' &&
          DockStorage.outboundDoorFor
        ) {
          nextToDoor = DockStorage.outboundDoorFor({
            trailerNumber: next.toTrailer || '',
            destination: next.destination || '',
          });
        }
        if (next.toTrailer) {
          nextLine =
            `Next up: Door ${door} · Trl ${next.fromTrailer || fromTrl} → loading ${loadingPhrase(next.toTrailer, nextToDoor, next.destination || '', next.toSlot || '')}`;
        } else if (next.destination) {
          nextLine =
            `Next up: Door ${door} · Trl ${next.fromTrailer || fromTrl} → ` +
            (nextToDoor
              ? `loading Door ${nextToDoor} · ${next.destination}`
              : next.destination);
        }
      }

      assignments.push({
        operator: opNum,
        fromDoor: door,
        fromTrailer: fromTrl,
        fromSlot: pick.fromSlot || '',
        toTrailer: toTrl,
        toDoor: toDoor || '',
        toSlot: pick.toSlot || '',
        destination: dest,
        pro: pick.pro || '',
        pieceFraction: pick.pieceFraction || '',
        line,
        nextLine,
      });
    });

    let note = '';
    if (doors.length < TARGET) {
      note = `Only ${doors.length} door${doors.length === 1 ? '' : 's'} have work — one operator per door.`;
    } else {
      note = 'One operator per pull door so forklifts stay spread out.';
    }
    if (source === 'inbound') {
      note += ' Build a load plan for full pull → load lines.';
    } else if (source === 'demo') {
      note += ' Demo doors (no freight loaded yet).';
    }

    return { assignments, note, doorCount: doors.length, source };
  }


  /**
   * Demo agent second pass — only touches summary.unplaced.
   * May add outbound stubs; writes unique slots or leaves explicit final skips.
   * Stamps planner/label so UI never confuses this with the built-in demo plan.
   * @param {object|null} plan
   * @returns {object|null}
   */
  function runAgentPackDemo(plan) {
    if (!plan || !plan.summary) return plan;
    const pending = Array.isArray(plan.summary.unplaced)
      ? plan.summary.unplaced.slice()
      : [];
    if (!pending.length) {
      plan.summary.agentNote =
        plan.summary.agentNote || 'Planner cleared the dock — agent not needed.';
      DockStorage.writeLoadPlan(plan);
      return plan;
    }

    const entriesById = new Map();
    DockStorage.readAll().forEach((e) => {
      if (e && e.id) entriesById.set(e.id, e);
    });

    const moves = Array.isArray(plan.moves) ? plan.moves.slice() : [];
    /** Rebuild trailer pack states from existing loadouts so we never reuse slots */
    /** @type {Map<string, ReturnType<typeof initTrailerPackState>>} */
    const stateByTrailer = new Map();
    const destTrailerOrder = new Map(); // dest -> trailerNumbers[]

    const ensureState = (outbound) => {
      const key = String(outbound.trailerNumber || '').trim();
      if (!key) return null;
      if (stateByTrailer.has(key)) return stateByTrailer.get(key);
      const st = initTrailerPackState(outbound);
      // Mark slots already used + rebuild sectionWeight so axle/nose caps still apply
      (plan.outboundLoadouts || []).forEach((L) => {
        if (String(L.trailerNumber || '').trim() !== key) return;
        (L.groups || []).forEach((g) => {
          (g.pieces || []).forEach((p) => {
            if (p.slot) {
              st.usedLabels.add(p.slot);
              if (st.slotPiece) st.slotPiece.set(p.slot, p);
              const sec =
                p.section != null
                  ? Number(p.section)
                  : Number(String(p.slot).split('/')[0]) || 0;
              const w = Number(p.weight);
              if (sec >= 1 && sec <= 12 && Number.isFinite(w) && w > 0) {
                st.sectionWeight[sec] = (st.sectionWeight[sec] || 0) + w;
              }
            }
          });
        });
      });
      // Sync cursor to first unused slot in order
      while (
        st.cursor < st.slotOrder.length &&
        st.usedLabels.has(st.slotOrder[st.cursor].slotLabel)
      ) {
        st.cursor += 1;
      }
      // Also count used slots that may be out of order — rebuild free list conceptually
      // by skipping any used label when placing (placeEntireProOnTrailer checks usedLabels)
      stateByTrailer.set(key, st);
      const dest = String(outbound.destination || '').trim();
      if (dest) {
        if (!destTrailerOrder.has(dest)) destTrailerOrder.set(dest, []);
        const arr = destTrailerOrder.get(dest);
        if (arr.indexOf(key) < 0) arr.push(key);
      }
      return st;
    };

    // Seed from registry + existing loadouts
    (plan.outboundLoadouts || []).forEach((L) => {
      const row =
        DockStorage.readOutboundTrailers().find(
          (r) =>
            String(r.trailerNumber || '').trim() ===
            String(L.trailerNumber || '').trim()
        ) || {
          trailerNumber: L.trailerNumber,
          doorNumber: L.doorNumber,
          destination: L.destination,
          cityFloorOnly: L.cityFloorOnly,
        };
      ensureState(row);
    });

    const stillUnplaced = [];
    let stubsAdded = 0;
    let rescued = 0;

    pending.forEach((u) => {
      const destination = u.destination;
      const pieceMetas = u.pieces || [];
      const pieces = [];
      pieceMetas.forEach((pm) => {
        const e = entriesById.get(pm.entryId);
        if (e) pieces.push(e);
      });
      // Fallback: regroup from storage by PRO if ids missing
      if (!pieces.length) {
        const groups = DockStorage.groupsByPro();
        const g = groups[u.pro] || [];
        g.forEach((e) => pieces.push(e));
      }
      if (!pieces.length) {
        stillUnplaced.push(
          Object.assign({}, u, { reason: u.reason || 'no_capacity' })
        );
        return;
      }
      const ship = { pro: u.pro, destination, pieces };
      const n = pieces.length;

      let trailers = outboundTrailersForDestination(destination);
      if (!trailers.length) {
        ensureOutboundStubs([destination]);
        trailers = outboundTrailersForDestination(destination);
      }
      trailers.forEach((t) => ensureState(t));

      let placed = false;
      const tryPlace = () => {
        const keys = destTrailerOrder.get(destination) || trailers.map((t) => String(t.trailerNumber).trim());
        for (let i = 0; i < keys.length; i++) {
          const st = stateByTrailer.get(keys[i]);
          if (!st) continue;
          // Re-sync cursor
          while (
            st.cursor < st.slotOrder.length &&
            st.usedLabels.has(st.slotOrder[st.cursor].slotLabel)
          ) {
            st.cursor += 1;
          }
          // Count truly free unique slots remaining in order
          let free = 0;
          for (let c = st.cursor; c < st.slotOrder.length; c++) {
            if (!st.usedLabels.has(st.slotOrder[c].slotLabel)) free += 1;
          }
          if (free >= n) {
            // Compact: walk cursor to next free each time inside placeEntireProOnTrailer
            const ok = placeEntireProOnTrailer(ship, st, moves);
            if (ok) return true;
          }
        }
        return false;
      };

      placed = tryPlace();

      // May add stubs until packed or give up after a few
      let attempts = 0;
      while (!placed && attempts < 3) {
        attempts += 1;
        const primary = trailers[0] || null;
        const extra = createExtraOutboundStub(destination, primary);
        if (!extra) break;
        stubsAdded += 1;
        trailers = outboundTrailersForDestination(destination);
        ensureState(extra);
        placed = tryPlace();
      }

      if (placed) {
        rescued += 1;
      } else {
        stillUnplaced.push({
          pro: u.pro,
          destination,
          pieceCount: n,
          reason: 'no_capacity',
          pieces: pieceMetas.length
            ? pieceMetas
            : pieces.map((e) => ({
                entryId: e.id,
                pieceFraction: e.pieceFraction,
                fromDoor: String(e.doorNumber || '').trim(),
                fromTrailer: String(e.trailerNumber || '').trim(),
              })),
        });
      }
    });

    // Rebuild outboundLoadouts from states + prior loadouts merge
    const loadoutByTrailer = new Map();
    (plan.outboundLoadouts || []).forEach((L) => {
      loadoutByTrailer.set(String(L.trailerNumber || '').trim(), {
        trailerNumber: L.trailerNumber,
        doorNumber: L.doorNumber,
        destination: L.destination,
        cityFloorOnly: Boolean(L.cityFloorOnly),
        groups: (L.groups || []).map((g) => ({
          pro: g.pro,
          pieces: (g.pieces || []).slice(),
        })),
      });
    });
    stateByTrailer.forEach((st, key) => {
      // Merge agent-added groups into loadout
      const dest = String(st.outbound.destination || '').trim();
      let L = loadoutByTrailer.get(key);
      if (!L) {
        L = {
          trailerNumber: st.outbound.trailerNumber,
          doorNumber: String(st.outbound.doorNumber || '').trim(),
          destination: dest,
          cityFloorOnly: st.cityFloorOnly,
          groups: [],
        };
        loadoutByTrailer.set(key, L);
      }
      // Replace groups with state's full list if state has groups from agent place
      // State's loadGroups only has NEW groups from this pass — append those
      st.loadGroups.forEach((g) => {
        const exists = L.groups.some(
          (og) =>
            og.pro === g.pro &&
            (og.pieces || []).length === (g.pieces || []).length &&
            (og.pieces[0] && g.pieces[0] && og.pieces[0].entryId === g.pieces[0].entryId)
        );
        if (!exists) L.groups.push(g);
      });
    });

    const outboundLoadouts = [];
    loadoutByTrailer.forEach((L) => {
      const pieceCount = L.groups.reduce((n, g) => n + (g.pieces || []).length, 0);
      if (!pieceCount) return;
      let weightSum = 0;
      let weightCount = 0;
      L.groups.forEach((g) => {
        (g.pieces || []).forEach((p) => {
          if (p.weight != null && !Number.isNaN(Number(p.weight))) {
            weightSum += Number(p.weight);
            weightCount += 1;
          }
        });
      });
      outboundLoadouts.push({
        trailerNumber: L.trailerNumber,
        doorNumber: L.doorNumber,
        destination: L.destination,
        cityFloorOnly: L.cityFloorOnly,
        proCount: L.groups.length,
        pieceCount,
        totalWeight: weightCount ? weightSum : null,
        groups: L.groups,
      });
    });

    const packedCount = moves.length;
    const unplacedPieceCount = stillUnplaced.reduce(
      (n, u) => n + (u.pieceCount || 0),
      0
    );
    const totalDestPieces = packedCount + unplacedPieceCount;
    const agentNote =
      stillUnplaced.length === 0
        ? `Agent demo packed remaining freight (${rescued} PRO(s))${stubsAdded ? `; added ${stubsAdded} stub(s)` : ''}. Dock clear.`
        : `Agent demo rescued ${rescued} PRO(s); ${stillUnplaced.length} still unplaced (${unplacedPieceCount} piece(s)). Explicit skips kept.`;

    const summary = Object.assign({}, plan.summary, {
      moveCount: packedCount,
      pieceCount: totalDestPieces,
      packedCount,
      unplacedCount: stillUnplaced.length,
      unplacedPieceCount,
      outboundCount: outboundLoadouts.length,
      unplaced: stillUnplaced,
      agentNote,
      note:
        stillUnplaced.length === 0
          ? `Agent packed ${packedCount}/${totalDestPieces} — dock clear. Unique slots only.`
          : `Agent packed ${packedCount}/${totalDestPieces} — ${stillUnplaced.length} PRO(s) still unplaced.`,
    });

    const next = {
      createdAt: new Date().toISOString(),
      planner: 'agent-demo',
      label: 'agent packed',
      moves,
      outboundLoadouts,
      summary,
    };
    DockStorage.writeLoadPlan(next);
    return next;
  }

  global.DockLoadPlan = {
    axleRearShare,
    axleSplit,
    STACK_HEIGHT_MAX_IN,
    FORKLIFT_CAPACITY_LB,
    PUP_END_LIGHT_MAX_LB,
    DECK_PIECE_MAX_LB,
    DEMO_PRELOAD_KEY,
    DEMO_DESTINATIONS,
    DEMO_INBOUND,
    DECK_CLEAR_HEIGHT_IN,
    buildHighTightSlotOrder,
    buildFloorOnlySlotOrder,
    deriveGroundOrders,
    deriveCrewAssignments,
    ensureOutboundStubs,
    outboundTrailersForDestination,
    createExtraOutboundStub,
    seedDemoInbound,
    runLoadPlan,
    runAgentPackDemo,
  };
})(window);
