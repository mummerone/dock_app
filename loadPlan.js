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
   * @param {object} outbound
   * @returns {{outbound:object, cityFloorOnly:boolean, slotOrder:object[], cursor:number, usedLabels:Set<string>, loadGroups:object[]}}
   */
  function initTrailerPackState(outbound) {
    const cityFloorOnly = Boolean(outbound && outbound.cityFloorOnly);
    const slotOrder = cityFloorOnly
      ? buildFloorOnlySlotOrder()
      : buildHighTightSlotOrder();
    return {
      outbound,
      cityFloorOnly,
      slotOrder,
      cursor: 0,
      usedLabels: new Set(),
      loadGroups: [],
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

  function nextFreeSlot(state) {
    while (
      state.cursor < state.slotOrder.length &&
      state.usedLabels.has(state.slotOrder[state.cursor].slotLabel)
    ) {
      state.cursor += 1;
    }
    if (state.cursor >= state.slotOrder.length) return null;
    return state.slotOrder[state.cursor];
  }

  /**
   * Place an entire PRO onto one trailer using unique slots only.
   * Caller must ensure freeSlotCount(state) >= ship.pieces.length.
   * @returns {{pro:string, pieces:object[]}|null}
   */
  function placeEntireProOnTrailer(ship, state, moves) {
    const destination = ship.destination;
    const outbound = state.outbound;
    const pool = ship.pieces.slice();
    const plannedPieces = [];
    const n = pool.length;
    // Capacity must be checked by caller; still skip any already-used labels.
    const startMoveLen = moves.length;
    const startCursor = state.cursor;
    /** @type {string[]} */
    const addedLabels = [];
    const rollback = () => {
      moves.length = startMoveLen;
      addedLabels.forEach((lab) => state.usedLabels.delete(lab));
      state.cursor = startCursor;
    };
    for (let i = 0; i < n; i++) {
      const slot = nextFreeSlot(state);
      if (!slot) {
        rollback();
        return null;
      }
      state.cursor += 1;
      state.usedLabels.add(slot.slotLabel);
      addedLabels.push(slot.slotLabel);
      const e = takePieceForLevel(pool, slot.level) || pool.shift();
      if (!e) break;
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
   * Pick the best remaining piece for a slot level:
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

      /** @type {ReturnType<typeof initTrailerPackState>[]} */
      const trailerStates = [initTrailerPackState(primary)];
      if (trailerStates[0].cityFloorOnly) cityFloorOnlyCount += 1;

      destShipments.forEach((ship) => {
        const n = ship.pieces.length;
        let placed = false;

        // Prefer existing trailers that can take the WHOLE PRO (same-PRO intact).
        for (let ti = 0; ti < trailerStates.length; ti++) {
          if (freeSlotCount(trailerStates[ti]) >= n) {
            const ok = placeEntireProOnTrailer(ship, trailerStates[ti], moves);
            if (ok) {
              placed = true;
              break;
            }
          }
        }

        // Policy: try one second outbound stub for same dest when full.
        if (!placed && trailerStates.length < 2) {
          const extra = createExtraOutboundStub(destination, primary);
          if (extra) {
            secondStubCount += 1;
            const st = initTrailerPackState(extra);
            trailerStates.push(st);
            if (freeSlotCount(st) >= n) {
              const ok = placeEntireProOnTrailer(ship, st, moves);
              if (ok) placed = true;
            }
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
        if (st.loadGroups.length) {
          outboundLoadouts.push(finalizeLoadoutFromState(st, destination));
        }
      });
    });

    // Bills with no destination already counted; mirror into skipped[]
    Object.keys(groups).forEach((pro) => {
      if (!DockStorage.getProDestination(pro)) {
        skipped.push({ pro, reason: 'no_dest' });
      }
    });

    const packedCount = moves.length;
    const unplacedPieceCount = unplaced.reduce((n, u) => n + (u.pieceCount || 0), 0);
    const totalDestPieces = packedCount + unplacedPieceCount;

    let note;
    if (unplaced.length > 0) {
      note =
        `Demo planner packed ${packedCount}/${totalDestPieces} pieces — ` +
        `${unplaced.length} PRO(s) unplaced (${unplacedPieceCount} piece(s)). ` +
        `Unique slots only (no last-slot reuse). ` +
        (secondStubCount
          ? `Opened ${secondStubCount} second outbound stub(s). `
          : '') +
        `Use Agent packed this (demo) for leftovers, or free capacity / clear city floor-only.`;
    } else if (skippedNoDest > 0) {
      note = `${skippedNoDest} bill(s) skipped — no destination set. Tap Edit bill on each, then build again.`;
    } else if (cityFloorOnlyCount > 0) {
      note =
        `Packed section-by-section (nose→tail): floor then decks per bay; never whole-floor-first. ` +
        `City loads floor-only. ${cityFloorOnlyCount} city load(s) used floor only (level A) — no decks. ` +
        `Every piece has a unique outbound slot.`;
    } else {
      note =
        'Packed section-by-section (nose→tail): floor then decks per bay; never whole-floor-first. City loads floor-only. Every piece has a unique outbound slot.';
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
      // Mark slots already used in this plan's loadout / moves
      (plan.outboundLoadouts || []).forEach((L) => {
        if (String(L.trailerNumber || '').trim() !== key) return;
        (L.groups || []).forEach((g) => {
          (g.pieces || []).forEach((p) => {
            if (p.slot) {
              st.usedLabels.add(p.slot);
              // Advance cursor past used indices when possible
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
