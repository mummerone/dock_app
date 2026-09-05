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
 * C=second deck. Pack floor first, then decks; slots 1–12 × A–C × L/M/R.
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

  const LEVELS_FLOOR_FIRST = ['A', 'B', 'C'];
  const LATERALS = ['Left', 'Middle', 'Right'];

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

  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function pick(arr) {
    return arr[randInt(0, arr.length - 1)];
  }

  function jitter(n, pct) {
    const f = 1 + (Math.random() * 2 - 1) * pct;
    return Math.max(1, Math.round(n * f));
  }

  /**
   * Ordered slot list for floor-first packing on a deck trailer.
   * Floor (A) nose→rear filling Left/Middle/Right, then B, then C.
   * @returns {{section:number, level:string, lateral:string, slotLabel:string}[]}
   */
  function buildHighTightSlotOrder() {
    const slots = [];
    for (const level of LEVELS_FLOOR_FIRST) {
      for (let section = 1; section <= 12; section++) {
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
      if (!row) {
        const trailerNumber =
          DEMO_OUTBOUND_TRAILERS[i] || String(91000 + i);
        const doorNumber = DEMO_OUTBOUND_DOORS[i] || '';
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
  function seedDemoInbound() {
    // Clear freight + destinations; keep outbound list but ensure stubs
    DockStorage.clearAll();
    // Clear PRO destinations by writing empty list via setting nothing —
    // clear each known pro by replacing pros store indirectly:
    try {
      localStorage.setItem(DockStorage.PROS_KEY, '[]');
    } catch (_) {
      /* ignore */
    }
    DockStorage.clearLoadPlan();

    /** @type {object[]} */
    const rows = [];
    let proSeq = 700100;
    const baseTime = Date.now();

    DEMO_INBOUND.forEach((ib, ibIdx) => {
      // 3–6 PROs per inbound trailer
      const proCount = randInt(3, 6);
      /** @type {{pro:string, dest:string, pieces:object[]}[]} */
      const bills = [];
      let totalPieces = 0;

      for (let p = 0; p < proCount; p++) {
        const dest = pick(DEMO_DESTINATIONS);
        const pieceCount = randInt(2, 8);
        const size = pick(SIZE_POOL);
        const pro = String(proSeq++);
        const pieces = [];
        for (let i = 1; i <= pieceCount; i++) {
          pieces.push({
            pro,
            pieceFraction: `${i}/${pieceCount}`,
            destination: dest,
            h: jitter(size.h, 0.08),
            w: size.w,
            d: size.d,
            weight: jitter(size.weight, 0.12),
          });
        }
        bills.push({ pro, dest, pieces });
        totalPieces += pieceCount;
      }

      // Cap so one inbound trailer stays within ~108 slots with room
      if (totalPieces > 72) {
        // Trim last bill pieces (shouldn't often happen with 3–6 × 2–8)
      }

      const slots = allocateInboundSlots(totalPieces);
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
            destination: bill.dest,
            // Stagger timestamps: older first within trailer for load order
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

    return {
      inboundTrailers: DEMO_INBOUND.length,
      proCount: pros.size,
      pieceCount: rows.length,
      outboundCreated,
      destinations: DEMO_DESTINATIONS.slice(),
    };
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

  /**
   * Local floor-first demo planner.
   * Reads all inbound dock pieces + destinations, assigns PROs to outbound
   * trailers by destination (one trailer per dest when possible), packs
   * floor→decks into slots 1–12 × A–C × L/M/R, returns and persists a plan.
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

    /** Map dest -> outbound trailer row */
    const outboundByDest = {};
    destOrder.forEach((destination) => {
      const row = DockStorage.outboundForDestination(destination);
      if (row) outboundByDest[destination] = row;
    });

    /** @type {object[]} */
    const moves = [];
    /** @type {object[]} */
    const outboundLoadouts = [];

    destOrder.forEach((destination) => {
      const outbound = outboundByDest[destination];
      if (!outbound) return;

      const destShipments = shipments
        .filter((s) => s.destination === destination)
        .sort((a, b) => shipmentVolume(b.pieces) - shipmentVolume(a.pieces));

      const slotOrder = buildHighTightSlotOrder();
      let cursor = 0;
      /** @type {{pro:string, pieces:object[]}[]} */
      const loadGroups = [];

      destShipments.forEach((ship) => {
        // Entire PRO on this one outbound trailer (permanent rule)
        const plannedPieces = [];
        ship.pieces.forEach((e) => {
          const slot =
            slotOrder[cursor] ||
            slotOrder[slotOrder.length - 1] || {
              section: 12,
              level: 'C',
              lateral: 'Right',
              slotLabel: '12/C/Right',
            };
          cursor += 1;
          const fromSlot =
            e.slotLabel ||
            DockStorage.formatSlot(e.section, e.level, e.lateral);
          const toSlot = slot.slotLabel;
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
              door: String(outbound.doorNumber || '').trim(),
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
        });
        loadGroups.push({ pro: ship.pro, pieces: plannedPieces });
      });

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

      outboundLoadouts.push({
        trailerNumber: outbound.trailerNumber,
        doorNumber: String(outbound.doorNumber || '').trim(),
        destination,
        proCount: loadGroups.length,
        pieceCount,
        totalWeight: weightCount ? weightSum : null,
        groups: loadGroups,
      });
    });

    const plan = {
      createdAt: new Date().toISOString(),
      planner: 'demo',
      label: 'demo plan',
      moves,
      outboundLoadouts,
      summary: {
        moveCount: moves.length,
        proCount: shipments.length,
        pieceCount: moves.length,
        outboundCount: outboundLoadouts.length,
        skippedNoDest,
        note:
          skippedNoDest > 0
            ? `${skippedNoDest} bill(s) skipped — no destination set. Tap Edit bill on each, then build again.`
            : 'Packed floor first, then decks B/C; one outbound per destination.',
      },
    };

    DockStorage.writeLoadPlan(plan);
    return plan;
  }

  global.DockLoadPlan = {
    DEMO_DESTINATIONS,
    DEMO_INBOUND,
    buildHighTightSlotOrder,
    ensureOutboundStubs,
    seedDemoInbound,
    runLoadPlan,
  };
})(window);
