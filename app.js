/**
 * Dock App — main UI controller
 * Permanent rule reminder: same PRO => same trailer (see storage.js groupsByPro).
 */
(function () {
  'use strict';

  // Dim mapping: H = vertical height; W = length (first footprint dim in the
  // named size, e.g. 48 in "48×40"); D = width (second footprint dim, e.g. 40).
  // Pallet/skid presets fill W×D only (height varies) — leave H null.
  // Drums, pails, IBC totes, Gaylord include a standard H.
  const PRESETS = [
    { id: 'gma', label: 'GMA 48×40', sub: 'W×D 48×40 — fills W×D only', h: null, w: 48, d: 40, footprintOnly: true },
    { id: 'p4848', label: '48×48', sub: 'W×D 48×48 — fills W×D only', h: null, w: 48, d: 48, footprintOnly: true },
    { id: 'half', label: 'Half pallet', sub: 'W×D 48×20 — fills W×D only', h: null, w: 48, d: 20, footprintOnly: true },
    { id: 'euro', label: 'Euro', sub: 'W×D 47×32 — fills W×D only', h: null, w: 47, d: 32, footprintOnly: true },
    { id: 'drum55', label: '55-gal drum', sub: 'H×W×D 35×23×23 — includes height', h: 35, w: 23, d: 23 },
    { id: 'drum30', label: '30-gal drum', sub: 'H×W×D 30×19×19 — includes height', h: 30, w: 19, d: 19 },
    { id: 'bucket5', label: '5-gal bucket', sub: 'H×W×D 15×12×12 — includes height', h: 15, w: 12, d: 12 },
    { id: 'ibc', label: 'IBC 275', sub: 'H×W×D 46×48×40 — includes height', h: 46, w: 48, d: 40 },
    { id: 'gaylord', label: 'Gaylord', sub: 'H×W×D 48×40×36 — includes height', h: 48, w: 40, d: 36 },
    { id: 'last', label: 'Custom / Last used', sub: 'Restore last Accept', last: true },
  ];

  /** localStorage: done marks for Trailer load-out work steps (per plan + trailer) */
  const LOADOUT_DONE_KEY = 'dockApp.loadoutDone.v1';
  /** localStorage: done marks for Ground deck-build orders (per plan) */
  const GROUND_DONE_KEY = 'dockApp.groundDone.v1';

  const state = {
    section: null,
    level: null,
    lateral: null,
    h: null,
    w: null,
    d: null,
    weight: null,
    activeField: 'h',
    listening: false,
    padBuffer: '',
    view: 'entry', // 'entry' | 'loadout' | 'dock'
    dockSection: 'inbound', // 'inbound' | 'outbound' | 'ground' | 'plan'
    loadoutTrailer: '',
    pieceLocked: false, // mid-sequence: piece field forced to k/n
    destinationLocked: false, // PRO already has a destination — reuse until edited
    dockLevel: 'doors', // 'doors' | 'pros' | 'pieces'
    dockDoor: '',
    dockPro: '',
    editingPro: '', // PRO open in Edit bill sheet
    confirmPending: null, // { action: 'loadDemo'|'clearPlan'|'clearAll' }
  };

  const el = {
    pro: document.getElementById('proInput'),
    piece: document.getElementById('pieceInput'),
    pieceSlashBtn: document.getElementById('pieceSlashBtn'),
    trailerNumber: document.getElementById('trailerNumberInput'),
    doorNumber: document.getElementById('doorNumberInput'),
    sectionChips: document.getElementById('sectionChips'),
    levelChips: document.getElementById('levelChips'),
    lateralChips: document.getElementById('lateralChips'),
    slotPreview: document.getElementById('slotPreview'),
    presetGrid: document.getElementById('presetGrid'),
    speakBtn: document.getElementById('speakBtn'),
    respeakBtn: document.getElementById('respeakBtn'),
    acceptBtn: document.getElementById('acceptBtn'),
    valH: document.getElementById('valH'),
    valW: document.getElementById('valW'),
    valD: document.getElementById('valD'),
    valWeight: document.getElementById('valWeight'),
    tileH: document.getElementById('tileH'),
    tileW: document.getElementById('tileW'),
    tileD: document.getElementById('tileD'),
    tileWeight: document.getElementById('tileWeight'),
    numpad: document.getElementById('numpad'),
    activeFieldLabel: document.getElementById('activeFieldLabel'),
    recentList: document.getElementById('recentList'),
    clearListBtn: document.getElementById('clearListBtn'),
    speechStatus: document.getElementById('speechStatus'),
    speechStatusText: document.getElementById('speechStatusText'),
    listenDot: document.getElementById('listenDot'),
    listenBanner: document.getElementById('listenBanner'),
    listenBannerText: document.getElementById('listenBannerText'),
    parseHint: document.getElementById('parseHint'),
    toast: document.getElementById('toast'),
    tabEntry: document.getElementById('tabEntry'),
    tabLoadout: document.getElementById('tabLoadout'),
    tabDock: document.getElementById('tabDock'),
    viewEntry: document.getElementById('viewEntry'),
    viewLoadout: document.getElementById('viewLoadout'),
    viewDock: document.getElementById('viewDock'),
    dockBoard: document.getElementById('dockBoard'),
    dockBackBtn: document.getElementById('dockBackBtn'),
    dockHint: document.getElementById('dockHint'),
    loadoutTrailerInput: document.getElementById('loadoutTrailerInput'),
    loadoutTrailerList: document.getElementById('loadoutTrailerList'),
    loadoutTrailerChips: document.getElementById('loadoutTrailerChips'),
    loadoutPlanBanner: document.getElementById('loadoutPlanBanner'),
    loadoutShowBtn: document.getElementById('loadoutShowBtn'),
    loadoutSummaryCard: document.getElementById('loadoutSummaryCard'),
    loadoutList: document.getElementById('loadoutList'),
    loadoutWorkCard: document.getElementById('loadoutWorkCard'),
    loadoutWorkList: document.getElementById('loadoutWorkList'),
    loadoutWorkHint: document.getElementById('loadoutWorkHint'),
    loadoutWorkProgress: document.getElementById('loadoutWorkProgress'),
    loadoutClearDoneBtn: document.getElementById('loadoutClearDoneBtn'),
    loadoutInventoryCard: document.getElementById('loadoutInventoryCard'),
    loadoutListHeading: document.getElementById('loadout-list-heading'),
    loadoutInventoryHint: document.getElementById('loadoutInventoryHint'),
    sumTrailer: document.getElementById('sumTrailer'),
    sumPros: document.getElementById('sumPros'),
    sumPieces: document.getElementById('sumPieces'),
    sumWeight: document.getElementById('sumWeight'),
    destination: document.getElementById('destinationInput'),
    destinationLockRow: document.getElementById('destinationLockRow'),
    destinationLockedMsg: document.getElementById('destinationLockedMsg'),
    editDestinationBtn: document.getElementById('editDestinationBtn'),
    dockSubInbound: document.getElementById('dockSubInbound'),
    dockSubOutbound: document.getElementById('dockSubOutbound'),
    dockSubGround: document.getElementById('dockSubGround'),
    dockSubPlan: document.getElementById('dockSubPlan'),
    dockPanelInbound: document.getElementById('dockPanelInbound'),
    dockPanelOutbound: document.getElementById('dockPanelOutbound'),
    dockPanelGround: document.getElementById('dockPanelGround'),
    dockPanelPlan: document.getElementById('dockPanelPlan'),
    outboundTrailerInput: document.getElementById('outboundTrailerInput'),
    outboundDoorInput: document.getElementById('outboundDoorInput'),
    outboundDestInput: document.getElementById('outboundDestInput'),
    outboundCityFloorOnly: document.getElementById('outboundCityFloorOnly'),
    outboundOpenBtn: document.getElementById('outboundOpenBtn'),
    outboundSaveBtn: document.getElementById('outboundSaveBtn'),
    outboundList: document.getElementById('outboundList'),
    loadoutReadyBanner: document.getElementById('loadoutReadyBanner'),
    groundOrdersList: document.getElementById('groundOrdersList'),
    groundOrdersHint: document.getElementById('groundOrdersHint'),
    groundOrdersProgress: document.getElementById('groundOrdersProgress'),
    groundClearDoneBtn: document.getElementById('groundClearDoneBtn'),
    editProOverlay: document.getElementById('editProOverlay'),
    editProNumber: document.getElementById('editProNumber'),
    editProDestination: document.getElementById('editProDestination'),
    editProTrailer: document.getElementById('editProTrailer'),
    editProDoor: document.getElementById('editProDoor'),
    editProCancelBtn: document.getElementById('editProCancelBtn'),
    editProSaveBtn: document.getElementById('editProSaveBtn'),
    loadDemoInboundBtn: document.getElementById('loadDemoInboundBtn'),
    runLoadPlanBtn: document.getElementById('runLoadPlanBtn'),
    clearPlanBtn: document.getElementById('clearPlanBtn'),
    planStatusHint: document.getElementById('planStatusHint'),
    planSummary: document.getElementById('planSummary'),
    planMoveList: document.getElementById('planMoveList'),
    planOutboundList: document.getElementById('planOutboundList'),
    confirmOverlay: document.getElementById('confirmOverlay'),
    confirmHeading: document.getElementById('confirm-heading'),
    confirmMessage: document.getElementById('confirmMessage'),
    confirmCancelBtn: document.getElementById('confirmCancelBtn'),
    confirmOkBtn: document.getElementById('confirmOkBtn'),
  };

  function init() {
    buildSectionChips();
    buildLevelChips();
    buildLateralChips();
    buildPresets();
    bindDimTiles();
    bindNumpad();
    bindActions();
    bindViewTabs();
    bindDockSubnav();
    bindLoadout();
    bindDock();
    bindOutbound();
    bindGround();
    bindPlan();
    bindDestination();
    bindEditPro();
    bindConfirmSheet();
    updateDimsUI();
    updateSlotPreview();
    selectField('h', { clearBuffer: true });
    renderRecent();
    refreshLoadoutTrailerPicker();
    updateLoadoutPlanBanner();
    renderOutboundList();
    renderGround();
    renderPlan();
    setupSpeechStatus();
    bindPieceSequenceWatchers();
    syncPieceSequenceFromStorage();
    syncDestinationFromPro();
    registerServiceWorker();
  }

  function buildSectionChips() {
    el.sectionChips.innerHTML = '';
    for (let i = 1; i <= 12; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = String(i);
      b.dataset.value = String(i);
      b.addEventListener('click', () => {
        state.section = i;
        highlightChips(el.sectionChips, String(i));
        updateSlotPreview();
      });
      el.sectionChips.appendChild(b);
    }
  }

  function buildLevelChips() {
    el.levelChips.innerHTML = '';
    ['A', 'B', 'C'].forEach((lv) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = lv;
      b.dataset.value = lv;
      b.addEventListener('click', () => {
        state.level = lv;
        highlightChips(el.levelChips, lv);
        updateSlotPreview();
      });
      el.levelChips.appendChild(b);
    });
  }

  function buildLateralChips() {
    el.lateralChips.innerHTML = '';
    ['Left', 'Middle', 'Right'].forEach((side) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = side;
      b.dataset.value = side;
      b.addEventListener('click', () => {
        state.lateral = side;
        highlightChips(el.lateralChips, side);
        updateSlotPreview();
      });
      el.lateralChips.appendChild(b);
    });
  }

  function highlightChips(container, value) {
    container.querySelectorAll('.chip').forEach((c) => {
      c.classList.toggle('active', c.dataset.value === value);
    });
  }

  function updateSlotPreview() {
    const s = state.section != null ? state.section : '—';
    const l = state.level || '—';
    const lat = state.lateral || '—';
    el.slotPreview.textContent = `${s}/${l}/${lat}`;
  }

  function buildPresets() {
    el.presetGrid.innerHTML = '';
    PRESETS.forEach((p) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'preset-btn';
      b.innerHTML = `<strong>${p.label}</strong><span>${p.sub}</span>`;
      b.addEventListener('click', () => applyPreset(p));
      el.presetGrid.appendChild(b);
    });
  }

  function applyPreset(p) {
    if (p.last) {
      const last = DockStorage.getLastUsed();
      if (!last) {
        toast('No last-used size yet — Accept an entry first');
        return;
      }
      state.h = last.h;
      state.w = last.w;
      state.d = last.d;
      // Weight left editable; restore if present but still allow override
      state.weight = last.weight;
      state.padBuffer = '';
      updateDimsUI();
      selectField('weight', { clearBuffer: true });
      el.parseHint.textContent = 'Restored last used dimensions';
      return;
    }
    // Pallet/skid: footprint only (W×D). Drums/totes: full H×W×D. Weight always empty.
    state.h = p.footprintOnly ? null : p.h;
    state.w = p.w;
    state.d = p.d;
    state.weight = null;
    state.padBuffer = '';
    updateDimsUI();
    if (p.footprintOnly) {
      selectField('h', { clearBuffer: true });
      el.parseHint.textContent = `Preset: ${p.label} — W×D filled; enter height & weight`;
    } else {
      selectField('weight', { clearBuffer: true });
      el.parseHint.textContent = `Preset: ${p.label} — includes height; enter weight`;
    }
  }

  function bindDimTiles() {
    const tiles = [
      [el.tileH, 'h'],
      [el.tileW, 'w'],
      [el.tileD, 'd'],
      [el.tileWeight, 'weight'],
    ];
    tiles.forEach(([node, field]) => {
      node.addEventListener('click', () => {
        selectField(field, { clearBuffer: true });
        // Tap field = option to re-speak just that value
        if (DockSpeech.isSupported()) {
          el.parseHint.textContent = `Selected ${fieldLabel(field)} — type on pad or tap Speak / Re-speak`;
        }
      });
    });
  }

  function fieldLabel(field) {
    return { h: 'Height', w: 'Width', d: 'Depth', weight: 'Weight' }[field] || field;
  }

  function selectField(field, opts = {}) {
    state.activeField = field;
    if (opts.clearBuffer) state.padBuffer = '';
    [el.tileH, el.tileW, el.tileD, el.tileWeight].forEach((t) => t.classList.remove('selected'));
    const map = { h: el.tileH, w: el.tileW, d: el.tileD, weight: el.tileWeight };
    map[field].classList.add('selected');
    const unit = field === 'weight' ? 'lbs' : 'in';
    el.activeFieldLabel.textContent = `Editing ${fieldLabel(field)} (${unit})`;
  }

  function updateDimsUI() {
    el.valH.textContent = state.h == null ? '—' : String(state.h);
    el.valW.textContent = state.w == null ? '—' : String(state.w);
    el.valD.textContent = state.d == null ? '—' : String(state.d);
    el.valWeight.textContent = state.weight == null ? '—' : String(state.weight);
  }

  function bindNumpad() {
    el.numpad.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-key]');
      if (!btn) return;
      const key = btn.dataset.key;
      if (key === 'clear') {
        state.padBuffer = '';
        state[state.activeField] = null;
        updateDimsUI();
        return;
      }
      if (key === 'back') {
        state.padBuffer = state.padBuffer.slice(0, -1);
        state[state.activeField] = state.padBuffer === '' ? null : Number(state.padBuffer);
        updateDimsUI();
        return;
      }
      // digit
      if (state.padBuffer.length >= 6) return;
      state.padBuffer += key;
      state[state.activeField] = Number(state.padBuffer);
      updateDimsUI();
    });
  }


  function insertSlashIntoPiece() {
    if (state.pieceLocked) return;
    const input = el.piece;
    if (!input) return;
    const slash = '/';
    const start = input.selectionStart;
    const end = input.selectionEnd;
    if (typeof start === 'number' && typeof end === 'number') {
      const before = input.value.slice(0, start);
      const after = input.value.slice(end);
      input.value = before + slash + after;
      const pos = start + 1;
      input.setSelectionRange(pos, pos);
    } else {
      input.value = (input.value || '') + slash;
    }
    input.focus();
  }

  function bindActions() {
    if (el.pieceSlashBtn) {
      el.pieceSlashBtn.addEventListener('click', insertSlashIntoPiece);
    }
    el.speakBtn.addEventListener('click', () => startSpeak({ mode: 'all' }));
    el.respeakBtn.addEventListener('click', () => startSpeak({ mode: 'active' }));
    el.acceptBtn.addEventListener('click', onAccept);
    el.clearListBtn.addEventListener('click', () => {
      openConfirmSheet({
        title: 'Clear all',
        message: 'Clear all saved freight and the load plan on this device? This cannot be undone.',
        action: 'clearAll',
      });
    });
  }

  function setupSpeechStatus() {
    if (!DockSpeech.isSupported()) {
      el.speechStatus.classList.add('unsupported');
      el.speechStatusText.textContent = 'Voice unavailable';
      el.speakBtn.disabled = false; // still clickable to show toast
      el.parseHint.textContent =
        'Voice not supported here — use presets or the number pad. (Chrome/Safari + https or localhost usually required.)';
    } else {
      el.speechStatusText.textContent = 'Voice ready';
    }
  }

  function setListeningUI(on, interimText) {
    state.listening = on;
    el.speechStatus.classList.toggle('listening', on);
    el.listenBanner.classList.toggle('hidden', !on);
    el.speechStatusText.textContent = on ? 'Listening…' : DockSpeech.isSupported() ? 'Voice ready' : 'Voice unavailable';
    if (on && interimText) {
      el.listenBannerText.textContent = interimText;
    } else if (on) {
      el.listenBannerText.textContent = 'Listening… say “48 by 40 by 48, 1200”';
    }
  }

  async function startSpeak({ mode }) {
    if (!DockSpeech.isSupported()) {
      toast('Speech needs Chrome or Safari (https or localhost)');
      return;
    }
    if (state.listening) {
      DockSpeech.stopListening();
      return;
    }

    const single = mode === 'active';
    el.parseHint.textContent = single
      ? `Listening for ${fieldLabel(state.activeField)} only…`
      : 'Listening for H W D weight…';

    try {
      setListeningUI(true);
      const parsed = await DockSpeech.listenOnce({
        onStart: () => setListeningUI(true),
        onEnd: () => setListeningUI(false),
        onInterim: (t) => setListeningUI(true, t),
      });

      applyParsed(parsed, { singleField: single ? state.activeField : null });
    } catch (err) {
      setListeningUI(false);
      const msg = String(err && err.message ? err.message : err);
      if (msg === 'no-speech') toast('No speech heard — try again or use the pad');
      else if (msg === 'not-allowed' || msg.includes('not-allowed')) {
        toast('Mic blocked — allow microphone, or use number pad');
      } else if (msg === 'Speech recognition is not supported in this browser.') {
        toast('Speech not supported in this browser');
      } else {
        toast('Speech failed — use number pad');
        el.parseHint.textContent = `Speech error: ${msg}`;
      }
    }
  }

  function applyParsed(parsed, { singleField }) {
    if (singleField) {
      const n = parsed.rawNumbers[0];
      if (n == null) {
        toast('Could not hear a number');
        el.parseHint.textContent = `Heard: “${parsed.transcript}”`;
        return;
      }
      state[singleField] = n;
      state.padBuffer = String(n);
      updateDimsUI();
      el.parseHint.textContent = `Set ${fieldLabel(singleField)} = ${n}  (heard “${parsed.transcript}”)`;
      return;
    }

    if (parsed.h != null) state.h = parsed.h;
    if (parsed.w != null) state.w = parsed.w;
    if (parsed.d != null) state.d = parsed.d;
    if (parsed.weight != null) state.weight = parsed.weight;
    state.padBuffer = '';
    updateDimsUI();

    const parts = [];
    if (parsed.h != null) parts.push(`H ${parsed.h}`);
    if (parsed.w != null) parts.push(`W ${parsed.w}`);
    if (parsed.d != null) parts.push(`D ${parsed.d}`);
    if (parsed.weight != null) parts.push(`${parsed.weight} lbs`);

    if (!parts.length) {
      el.parseHint.textContent = `Heard “${parsed.transcript}” — no numbers found`;
      toast('No numbers found — try again');
      return;
    }

    el.parseHint.textContent = `Got ${parts.join(' · ')}  (heard “${parsed.transcript}”)`;
    // Advance focus to first missing
    if (state.weight == null) selectField('weight', { clearBuffer: true });
    else selectField('h', { clearBuffer: true });
  }

  function bindPieceSequenceWatchers() {
    const sync = () => {
      syncPieceSequenceFromStorage();
      syncDestinationFromPro();
    };
    el.pro.addEventListener('change', sync);
    el.pro.addEventListener('blur', sync);
    el.trailerNumber.addEventListener('change', sync);
    el.trailerNumber.addEventListener('blur', sync);
  }

  function bindDestination() {
    if (!el.destination) return;
    if (el.editDestinationBtn) {
      el.editDestinationBtn.addEventListener('click', () => {
        setDestinationLocked(false);
        if (el.destination) {
          el.destination.focus();
          el.destination.select();
        }
        toast('Destination unlocked — edit and Accept to save');
      });
    }
  }

  /**
   * When PRO already has a saved destination, fill and lock the field.
   * New PRO (or no destination yet) stays editable.
   */
  function syncDestinationFromPro() {
    if (!el.destination) return;
    const pro = el.pro.value.trim();
    if (!pro) {
      setDestinationLocked(false);
      return;
    }
    const dest = DockStorage.getProDestination(pro);
    if (dest) {
      el.destination.value = dest;
      setDestinationLocked(true);
    } else {
      // New / unknown PRO — unlock; clear field only if it was locked to another PRO
      if (state.destinationLocked) {
        el.destination.value = '';
      }
      setDestinationLocked(false);
    }
  }

  function setDestinationLocked(locked) {
    state.destinationLocked = !!locked;
    if (!el.destination) return;
    el.destination.readOnly = state.destinationLocked;
    el.destination.classList.toggle('dest-locked', state.destinationLocked);
    el.destination.setAttribute('aria-readonly', state.destinationLocked ? 'true' : 'false');
    if (el.destinationLockRow) {
      el.destinationLockRow.classList.toggle('hidden', !state.destinationLocked);
    }
    if (el.destinationLockedMsg && state.destinationLocked) {
      const d = el.destination.value.trim() || '—';
      el.destinationLockedMsg.textContent =
        `Going to: ${d} — same for every piece of this PRO.`;
    }
  }

  /**
   * Normalize piece input before Accept:
   * - "1/5" or "3/5" → {a,b}
   * - bare "5" when starting a new sequence → treat as 1/5
   */
  function normalizePieceInput(raw, { allowBareTotal }) {
    const s = String(raw || '').trim();
    if (!s) return { ok: false, reason: 'Enter piece (e.g. 1/5 or total 5)' };

    const frac = DockStorage.parsePieceFraction(s);
    if (frac) return { ok: true, a: frac.a, b: frac.b, display: `${frac.a}/${frac.b}` };

    if (allowBareTotal && /^\d+$/.test(s)) {
      const n = Number(s);
      if (!Number.isInteger(n) || n < 1) {
        return { ok: false, reason: 'Piece total must be a whole number (1 or more)' };
      }
      return { ok: true, a: 1, b: n, display: `1/${n}`, fromBareTotal: true };
    }

    return { ok: false, reason: 'Piece should look like 1/5 — or type the total pieces, e.g. 5' };
  }

  function setPieceLocked(locked) {
    state.pieceLocked = !!locked;
    if (el.piece) {
      el.piece.readOnly = state.pieceLocked;
      el.piece.classList.toggle('piece-locked', state.pieceLocked);
      el.piece.setAttribute('aria-readonly', state.pieceLocked ? 'true' : 'false');
      el.piece.title = state.pieceLocked
        ? 'Piece is locked until this shipment sequence finishes'
        : '';
    }
    if (el.pieceSlashBtn) {
      el.pieceSlashBtn.disabled = state.pieceLocked;
    }
  }

  /**
   * If this PRO+trailer already has an incomplete multi-piece sequence,
   * force next k/n and lock the piece field.
   */
  function syncPieceSequenceFromStorage() {
    const pro = el.pro.value.trim();
    const trailerNumber = el.trailerNumber.value.trim();
    if (!pro || !trailerNumber) {
      return;
    }

    const info = DockStorage.nextPieceForProOnTrailer(pro, trailerNumber);
    if (info.count > 0 && info.total != null && info.count < info.total) {
      el.piece.value = `${info.nextNum}/${info.total}`;
      setPieceLocked(true);
      el.parseHint.textContent =
        `Continue PRO ${pro}: enter piece ${info.nextNum}/${info.total} next (in order).`;
      return;
    }

    if (state.pieceLocked) {
      setPieceLocked(false);
    }
  }

  function clearSlotSelection() {
    state.section = null;
    state.level = null;
    state.lateral = null;
    el.sectionChips.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    el.levelChips.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    el.lateralChips.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    updateSlotPreview();
  }

  function clearDimsAndWeight() {
    state.h = null;
    state.w = null;
    state.d = null;
    state.weight = null;
    state.padBuffer = '';
    updateDimsUI();
    selectField('h', { clearBuffer: true });
  }

  /**
   * After Accept for k/n: keep PRO + trailer; clear dims/weight + slot;
   * auto-set (k+1)/n when k < n (locked); clear piece when finished.
   */
  function prepareNextPieceAfterAccept(a, b) {
    clearDimsAndWeight();
    clearSlotSelection();

    if (b > 1 && a < b) {
      el.piece.value = `${a + 1}/${b}`;
      setPieceLocked(true);
      // Destination stays locked for remaining pieces
      syncDestinationFromPro();
      el.parseHint.textContent =
        `Saved ${a}/${b}. Next: ${a + 1}/${b} — same PRO, trailer & destination; enter size & slot.`;
    } else {
      el.piece.value = '';
      setPieceLocked(false);
      // Leave PRO/trailer/door/destination filled so driver can clear when ready;
      // destination stays locked for this PRO until they change PRO.
      syncDestinationFromPro();
      el.parseHint.textContent =
        b === 1
          ? 'Shipment complete (1/1). Enter a new PRO when ready.'
          : `Shipment complete (${a}/${b}). Enter a new PRO when ready.`;
    }
  }

  function onAccept() {
    const pro = el.pro.value.trim();
    const trailerNumber = el.trailerNumber.value.trim();
    const pieceRaw = el.piece.value.trim();

    if (!pro) {
      toast('Enter a PRO number');
      el.pro.focus();
      return;
    }
    if (!pieceRaw) {
      toast('Enter piece (e.g. 1/5 or total 5)');
      el.piece.focus();
      return;
    }
    if (!trailerNumber) {
      toast('Enter trailer number');
      el.trailerNumber.focus();
      return;
    }
    const doorNumber = el.doorNumber ? el.doorNumber.value.trim() : '';
    if (!doorNumber) {
      toast('Enter door number');
      if (el.doorNumber) el.doorNumber.focus();
      return;
    }

    const destination = el.destination ? el.destination.value.trim() : '';
    if (!destination) {
      toast('Enter where this PRO is going (destination)');
      if (el.destination) {
        setDestinationLocked(false);
        el.destination.focus();
      }
      return;
    }

    // Existing pieces for this PRO on this trailer determine required next numerator
    const seq = DockStorage.nextPieceForProOnTrailer(pro, trailerNumber);
    const startingFresh = seq.count === 0;
    const normalized = normalizePieceInput(pieceRaw, { allowBareTotal: startingFresh });
    if (!normalized.ok) {
      toast(normalized.reason);
      el.piece.focus();
      return;
    }

    const { a, b, display } = normalized;

    // Forced sequential entry when multi-piece (b > 1): must be next in order
    if (b > 1) {
      const required = seq.nextNum; // count + 1 (or 1 if none)
      if (a !== required) {
        toast(
          required === 1
            ? `Enter pieces in order — start with 1/${b}`
            : `Enter pieces in order — next is ${required}/${b}`
        );
        // If mid-sequence, snap field back to required
        if (seq.count > 0 && seq.total != null) {
          el.piece.value = `${required}/${seq.total || b}`;
          setPieceLocked(true);
        }
        return;
      }
      // Denominator must match an in-progress sequence
      if (seq.count > 0 && seq.total != null && b !== seq.total) {
        toast(`This PRO is ${seq.total} pieces — use ${required}/${seq.total}`);
        el.piece.value = `${required}/${seq.total}`;
        setPieceLocked(true);
        return;
      }
    } else {
      // 1/1 — only valid when no prior pieces yet for this PRO+trailer (or continuing? no, 1/1 is single)
      if (seq.count > 0) {
        toast(`PRO already has ${seq.count} piece(s) on this trailer — continue the sequence`);
        syncPieceSequenceFromStorage();
        return;
      }
    }

    if (state.section == null || !state.level || !state.lateral) {
      toast('Pick section, level, and lateral');
      return;
    }
    if (state.h == null || state.w == null || state.d == null) {
      toast('Need H, W, and D — speak, preset, or pad');
      return;
    }
    if (state.weight == null) {
      toast('Enter weight (lbs)');
      selectField('weight', { clearBuffer: true });
      return;
    }

    // Soft check for BOL same-trailer rule (MVP warns; does not hard-block)
    const existing = DockStorage.entriesForPro(pro);
    const priorTrailers = DockStorage.trailerNumbersForPro(pro);
    if (existing.length) {
      if (priorTrailers.length && !priorTrailers.includes(trailerNumber)) {
        const prior = priorTrailers.join(', ');
        el.parseHint.textContent =
          `Warning: PRO ${pro} was on trailer ${prior} — same PRO must stay on one trailer (you entered ${trailerNumber}).`;
        toast(`Same PRO was on trailer ${prior}`);
      } else if (!startingFresh) {
        el.parseHint.textContent =
          `Note: PRO ${pro} already has ${existing.length} piece(s) on trailer ${trailerNumber} — keep on same trailer.`;
      }
    }

    // Persist normalized fraction (e.g. bare "5" → "1/5")
    el.piece.value = display;

    DockStorage.saveEntry({
      pro,
      pieceFraction: display,
      trailerNumber,
      doorNumber,
      destination,
      section: state.section,
      level: state.level,
      lateral: state.lateral,
      h: state.h,
      w: state.w,
      d: state.d,
      weight: state.weight,
    });

    // Lock destination for remaining pieces of this PRO
    if (el.destination) {
      el.destination.value = destination;
      setDestinationLocked(true);
    }

    renderRecent();
    refreshLoadoutTrailerPicker();
    if (state.view === 'loadout' && state.loadoutTrailer === trailerNumber) {
      renderLoadout(trailerNumber);
    }
    if (state.view === 'dock') {
      if (state.dockSection === 'inbound') renderDock();
      else if (state.dockSection === 'outbound') renderOutboundList();
      else if (state.dockSection === 'plan') renderPlan();
    }
    toast(`Saved PRO ${pro} · ${display} · to ${destination} · door ${doorNumber} · trailer ${trailerNumber} @ ${state.section}/${state.level}/${state.lateral}`);

    prepareNextPieceAfterAccept(a, b);
  }

  function renderRecent() {
    const entries = DockStorage.readAll();
    if (!entries.length) {
      el.recentList.innerHTML = '<div class="empty-state">No freight logged yet. Fill in a shipment above and tap Accept.</div>';
      return;
    }

    // Show newest first, but visually group by PRO using helper (BOL rule)
    const groups = DockStorage.groupsByPro(entries);
    // Preserve recent order: iterate entries, emit group header when PRO changes in display of top N
    const recent = entries.slice(0, 40);
    const seenHeader = new Set();
    const frag = document.createDocumentFragment();

    // Alternate simpler approach: list items, with a small PRO group badge
    // Build ordered unique PROs by first appearance in recent
    const proOrder = [];
    recent.forEach((e) => {
      if (!proOrder.includes(e.pro)) proOrder.push(e.pro);
    });

    proOrder.forEach((pro) => {
      const wrap = document.createElement('div');
      wrap.className = 'pro-group';
      const head = document.createElement('div');
      head.className = 'pro-group-head';
      const title = document.createElement('div');
      title.className = 'pro-group-title';
      const count = (groups[pro] || []).length;
      const trailers = DockStorage.trailerNumbersForPro(pro);
      const trailerNote = trailers.length
        ? `trailer ${trailers.join(', ')}`
        : 'same trailer';
      const dest = DockStorage.getProDestination(pro);
      const destNote = dest ? ` · → ${dest}` : ' · no destination yet';
      title.textContent = `PRO ${pro} · ${count} piece(s) · ${trailerNote}${destNote}`;
      head.appendChild(title);
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn tiny muted-btn edit-pro-btn';
      editBtn.textContent = 'Edit bill';
      editBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openEditPro(pro);
      });
      head.appendChild(editBtn);
      wrap.appendChild(head);

      recent
        .filter((e) => e.pro === pro)
        .forEach((e) => {
          wrap.appendChild(renderEntryCard(e));
        });
      frag.appendChild(wrap);
    });

    el.recentList.innerHTML = '';
    el.recentList.appendChild(frag);
  }

  function renderEntryCard(e) {
    const div = document.createElement('div');
    div.className = 'entry';
    const trailerDisp = e.trailerNumber
      ? escapeHtml(e.trailerNumber)
      : '—';
    const doorDisp = e.doorNumber
      ? escapeHtml(e.doorNumber)
      : '—';
    const dest = DockStorage.getProDestination(e.pro);
    const destLine = dest
      ? `<div class="entry-dest">Going to: ${escapeHtml(dest)}</div>`
      : `<div class="entry-dest entry-dest-missing">No destination yet</div>`;
    div.innerHTML = `
      <div class="entry-top">
        <span class="entry-pro">${escapeHtml(e.pro)} · ${escapeHtml(e.pieceFraction)}</span>
        <span class="entry-slot">${escapeHtml(e.slotLabel)}</span>
      </div>
      <div class="entry-trailer">Door ${doorDisp} · Trailer ${trailerDisp}</div>
      ${destLine}
      <div class="entry-dims">${fmt(e.h)} × ${fmt(e.w)} × ${fmt(e.d)} in · ${fmt(e.weight)} lbs</div>
      <div class="entry-meta">${escapeHtml(DockStorage.formatTimeLocal(e.timestamp))}</div>
    `;
    return div;
  }

  function fmt(n) {
    return n == null ? '—' : String(n);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Strip legacy "high-and-tight" wording from saved plan notes / status. */
  function sanitizePlanNote(note) {
    if (note == null || note === '') return '';
    return String(note)
      .replace(/Packed\s+high-and-tight:?\s*/gi, 'Packed floor first, then decks — ')
      .replace(/high-and-tight/gi, 'Packed floor first, then decks')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+—\s*—/g, ' —')
      .trim();
  }


  function setPanelVisible(panel, on) {
    if (!panel) return;
    panel.classList.toggle('hidden', !on);
    if (on) panel.removeAttribute('hidden');
    else panel.setAttribute('hidden', '');
  }

  function bindViewTabs() {
    if (!el.tabEntry || !el.tabLoadout) return;
    el.tabEntry.addEventListener('click', () => showView('entry'));
    el.tabLoadout.addEventListener('click', () => showView('loadout'));
    if (el.tabDock) el.tabDock.addEventListener('click', () => showView('dock'));
  }

  function bindDockSubnav() {
    if (el.dockSubInbound) {
      el.dockSubInbound.addEventListener('click', () => showDockSection('inbound'));
    }
    if (el.dockSubOutbound) {
      el.dockSubOutbound.addEventListener('click', () => showDockSection('outbound'));
    }
    if (el.dockSubGround) {
      el.dockSubGround.addEventListener('click', () => showDockSection('ground'));
    }
    if (el.dockSubPlan) {
      el.dockSubPlan.addEventListener('click', () => showDockSection('plan'));
    }
  }

  function setPlanScrollMode(on) {
    document.body.classList.toggle('plan-scroll-mode', Boolean(on));
    if (el.viewDock) el.viewDock.classList.toggle('dock-plan-mode', Boolean(on));
  }

  function showDockSection(section) {
    state.dockSection = section;
    const panels = {
      inbound: el.dockPanelInbound,
      outbound: el.dockPanelOutbound,
      ground: el.dockPanelGround,
      plan: el.dockPanelPlan,
    };
    const tabs = {
      inbound: el.dockSubInbound,
      outbound: el.dockSubOutbound,
      ground: el.dockSubGround,
      plan: el.dockSubPlan,
    };
    Object.keys(panels).forEach((key) => {
      setPanelVisible(panels[key], key === section);
    });
    Object.keys(tabs).forEach((key) => {
      const tab = tabs[key];
      if (!tab) return;
      const on = key === section;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    // Demo plan: unstick topbar + view-tabs + dock sub-nav so chrome does not cover moves
    setPlanScrollMode(section === 'plan');
    if (section === 'inbound') renderDock();
    if (section === 'outbound') renderOutboundList();
    if (section === 'ground') renderGround();
    if (section === 'plan') renderPlan();
  }

  function showView(name) {
    state.view = name;
    const views = {
      entry: el.viewEntry,
      loadout: el.viewLoadout,
      dock: el.viewDock,
    };
    const tabs = {
      entry: el.tabEntry,
      loadout: el.tabLoadout,
      dock: el.tabDock,
    };
    Object.keys(views).forEach((key) => {
      setPanelVisible(views[key], key === name);
    });
    Object.keys(tabs).forEach((key) => {
      const tab = tabs[key];
      if (!tab) return;
      const on = key === name;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (name === 'loadout') {
      refreshLoadoutTrailerPicker();
      updateLoadoutPlanBanner();
      const selected = String(state.loadoutTrailer || '').trim();
      if (selected) {
        renderLoadout(selected);
      } else {
        const plan = DockStorage.readLoadPlan();
        const hasOutbound = planOutboundTrailerNumbers(plan).length > 0;
        // Keep input empty when a plan has OUT trailers so the worker taps an OUT chip.
        if (!hasOutbound && el.loadoutTrailerInput && !el.loadoutTrailerInput.value.trim() && el.trailerNumber && el.trailerNumber.value.trim()) {
          el.loadoutTrailerInput.value = el.trailerNumber.value.trim();
        }
        renderLoadout('');
      }
    }
    if (name === 'dock') {
      // Ensure current Dock subsection panel is visible and populated
      showDockSection(state.dockSection || 'inbound');
    } else {
      // Leaving Dock — restore sticky chrome
      setPlanScrollMode(false);
    }
  }

  function bindLoadout() {
    if (!el.loadoutShowBtn) return;
    el.loadoutShowBtn.addEventListener('click', () => {
      const t = el.loadoutTrailerInput.value.trim();
      if (!t) {
        state.loadoutTrailer = '';
        highlightLoadoutChips('');
        renderLoadout('');
        toast('Pick a trailer — type a number or tap a chip');
        el.loadoutTrailerInput.focus();
        return;
      }
      state.loadoutTrailer = t;
      highlightLoadoutChips(t);
      renderLoadout(t);
    });
    el.loadoutTrailerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        el.loadoutShowBtn.click();
      }
    });
    el.loadoutTrailerInput.addEventListener('input', () => {
      if (!el.loadoutTrailerInput.value.trim()) {
        state.loadoutTrailer = '';
        highlightLoadoutChips('');
        renderLoadout('');
      }
    });
    if (el.loadoutClearDoneBtn) {
      el.loadoutClearDoneBtn.addEventListener('click', () => {
        const t = state.loadoutTrailer;
        if (!t) {
          toast('Pick a trailer first — type a number or tap a chip');
          return;
        }
        const plan = DockStorage.readLoadPlan();
        const fp = planFingerprint(plan);
        if (!fp) {
          toast('No done marks to clear for this trailer');
          return;
        }
        clearLoadoutDone(fp, t);
        renderLoadout(t);
        toast('Cleared done marks for this trailer');
      });
    }
    if (el.loadoutWorkList) {
      el.loadoutWorkList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-move-key]');
        if (!btn) return;
        const moveKey = btn.getAttribute('data-move-key');
        const t = state.loadoutTrailer;
        const plan = DockStorage.readLoadPlan();
        const fp = planFingerprint(plan);
        if (!t || !fp || !moveKey) return;
        const done = isLoadoutMoveDone(fp, t, moveKey);
        setLoadoutMoveDone(fp, t, moveKey, !done);
        renderLoadout(t);
        // Refresh compact Ready to close hints elsewhere
        if (state.view === 'dock') {
          if (state.dockSection === 'outbound') renderOutboundList();
          else if (state.dockSection === 'plan') renderPlan();
        }
      });
    }
  }

  /** Collect trailer chips: inbound freight always; OUT chips only from the active load plan. */
  function collectLoadoutTrailerOptions() {
    /** @type {Map<string, {value:string, outbound:boolean}>} */
    const map = new Map();
    const add = (num, outbound) => {
      const v = String(num || '').trim();
      if (!v) return;
      const prev = map.get(v);
      if (prev) {
        if (outbound) prev.outbound = true;
        return;
      }
      map.set(v, { value: v, outbound: !!outbound });
    };

    // Logged freight trailers (stay after Clear plan)
    DockStorage.allTrailerNumbers().forEach((t) => add(t, false));

    // OUT chips come from the saved plan only — so Clear plan drops orphan plan trailers
    const plan = DockStorage.readLoadPlan();
    if (isPlanPresent(plan)) {
      (plan.outboundLoadouts || []).forEach((load) => add(load.trailerNumber, true));
      (plan.moves || []).forEach((m) => {
        if (m.to && m.to.trailer) add(m.to.trailer, true);
        if (m.from && m.from.trailer) add(m.from.trailer, false);
      });
    }

    const list = Array.from(map.values());
    list.sort((a, b) => {
      // Outbound (plan) chips first so workers see go-get targets
      if (a.outbound !== b.outbound) return a.outbound ? -1 : 1;
      const na = Number(a.value);
      const nb = Number(b.value);
      if (!Number.isNaN(na) && !Number.isNaN(nb) && String(na) === a.value && String(nb) === b.value) {
        return na - nb;
      }
      return a.value.localeCompare(b.value, undefined, { numeric: true });
    });
    return list;
  }

  function uniqueSortedTrailers(nums) {
    const set = new Set();
    (nums || []).forEach((n) => {
      const v = String(n || '').trim();
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb) && String(na) === a && String(nb) === b) {
        return na - nb;
      }
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }

  function isPlanPresent(plan) {
    return !!(
      plan &&
      (((plan.moves && plan.moves.length) || (plan.outboundLoadouts && plan.outboundLoadouts.length)))
    );
  }

  function planOutboundTrailerNumbers(plan) {
    const nums = [];
    if (!plan) return nums;
    (plan.outboundLoadouts || []).forEach((load) => nums.push(load.trailerNumber));
    (plan.moves || []).forEach((m) => {
      if (m.to && m.to.trailer) nums.push(m.to.trailer);
    });
    return uniqueSortedTrailers(nums);
  }

  function firstOutboundFromPlan(plan) {
    const loads = (plan && plan.outboundLoadouts) || [];
    for (let i = 0; i < loads.length; i++) {
      const v = String(loads[i].trailerNumber || '').trim();
      if (v) return v;
    }
    const moves = (plan && plan.moves) || [];
    for (let i = 0; i < moves.length; i++) {
      const v = String((moves[i].to && moves[i].to.trailer) || '').trim();
      if (v) return v;
    }
    return '';
  }

  function isOutboundRegistered(trailerNumber) {
    const t = String(trailerNumber || '').trim();
    if (!t) return false;
    return DockStorage.readOutboundTrailers().some((r) => String(r.trailerNumber || '').trim() === t);
  }

  function updateLoadoutPlanBanner() {
    const banner = el.loadoutPlanBanner;
    if (!banner) return;
    const plan = DockStorage.readLoadPlan();
    const outs = planOutboundTrailerNumbers(plan);
    const hasPlan = isPlanPresent(plan);
    banner.classList.toggle('is-empty', !hasPlan);
    if (!hasPlan) {
      banner.textContent =
        'No load plan yet. Go to Dock → Demo plan and tap Build load plan (demo).';
      return;
    }
    const n = outs.length;
    const noun = n === 1 ? 'trailer' : 'trailers';
    const selected = String(state.loadoutTrailer || '').trim();
    if (!selected && n) {
      banner.textContent =
        `Load plan ready — ${n} outbound ${noun}: ${outs.join(', ')}. Tap an OUT chip for the Work list.`;
    } else {
      banner.textContent =
        `Load plan ready — ${n} outbound ${noun}. Tap an OUT chip for the Work list.`;
    }
  }

  function refreshLoadoutTrailerPicker() {
    if (!el.loadoutTrailerChips) return;
    const trailers = collectLoadoutTrailerOptions();
    // datalist
    if (el.loadoutTrailerList) {
      el.loadoutTrailerList.innerHTML = '';
      trailers.forEach((row) => {
        const opt = document.createElement('option');
        opt.value = row.value;
        el.loadoutTrailerList.appendChild(opt);
      });
    }
    el.loadoutTrailerChips.innerHTML = '';
    if (!trailers.length) {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.style.margin = '0';
      hint.textContent =
        'No trailers yet. Log freight first, or go to Dock → Inbound → Load demo inbound, then Demo plan.';
      el.loadoutTrailerChips.appendChild(hint);
      updateLoadoutPlanBanner();
      return;
    }
    trailers.forEach((row) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'trailer-chip' + (row.outbound ? ' trailer-chip-out' : '');
      b.dataset.value = row.value;
      if (row.outbound) {
        b.innerHTML = `<span class="chip-out-tag">OUT</span> ${escapeHtml(row.value)}`;
      } else {
        b.textContent = row.value;
      }
      if (row.value === state.loadoutTrailer) b.classList.add('active');
      b.addEventListener('click', () => {
        el.loadoutTrailerInput.value = row.value;
        state.loadoutTrailer = row.value;
        highlightLoadoutChips(row.value);
        renderLoadout(row.value);
      });
      el.loadoutTrailerChips.appendChild(b);
    });
    updateLoadoutPlanBanner();
  }

  function highlightLoadoutChips(value) {
    if (!el.loadoutTrailerChips) return;
    el.loadoutTrailerChips.querySelectorAll('.trailer-chip').forEach((c) => {
      c.classList.toggle('active', c.dataset.value === value);
    });
  }

  function planFingerprint(plan) {
    if (!plan) return '';
    const created = plan.createdAt || '';
    const n = (plan.moves && plan.moves.length) || 0;
    return `${created}|${n}`;
  }

  function moveDoneKey(m, idx) {
    if (m && m.entryId) return String(m.entryId);
    return `${idx}:${(m && m.pro) || ''}:${(m && m.pieceFraction) || ''}`;
  }

  function readLoadoutDoneStore() {
    try {
      const raw = localStorage.getItem(LOADOUT_DONE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeLoadoutDoneStore(store) {
    try {
      localStorage.setItem(LOADOUT_DONE_KEY, JSON.stringify(store));
    } catch (_) {
      /* ignore quota */
    }
  }

  function loadoutDoneBucketKey(fingerprint, trailer) {
    return `${fingerprint}::${String(trailer || '').trim()}`;
  }

  function isLoadoutMoveDone(fingerprint, trailer, moveKey) {
    const store = readLoadoutDoneStore();
    const bucket = store[loadoutDoneBucketKey(fingerprint, trailer)];
    return !!(bucket && bucket[moveKey]);
  }

  function setLoadoutMoveDone(fingerprint, trailer, moveKey, done) {
    const store = readLoadoutDoneStore();
    const key = loadoutDoneBucketKey(fingerprint, trailer);
    if (!store[key]) store[key] = {};
    if (done) store[key][moveKey] = true;
    else delete store[key][moveKey];
    if (!Object.keys(store[key]).length) delete store[key];
    writeLoadoutDoneStore(store);
  }

  function clearLoadoutDone(fingerprint, trailer) {
    const store = readLoadoutDoneStore();
    delete store[loadoutDoneBucketKey(fingerprint, trailer)];
    writeLoadoutDoneStore(store);
  }

  /**
   * Moves for the selected trailer: prefer outbound (to.trailer), else inbound (from.trailer).
   * @returns {{ role: 'outbound'|'inbound'|null, moves: object[], planIndexes: number[] }}
   */
  function movesForSelectedTrailer(plan, trailerNumber) {
    const t = String(trailerNumber || '').trim();
    const all = (plan && plan.moves) || [];
    if (!t || !all.length) return { role: null, moves: [], planIndexes: [] };

    /** @type {object[]} */
    const outMoves = [];
    /** @type {number[]} */
    const outIdx = [];
    /** @type {object[]} */
    const inMoves = [];
    /** @type {number[]} */
    const inIdx = [];

    all.forEach((m, idx) => {
      const toTr = String((m.to && m.to.trailer) || '').trim();
      const fromTr = String((m.from && m.from.trailer) || '').trim();
      if (toTr === t) {
        outMoves.push(m);
        outIdx.push(idx);
      }
      if (fromTr === t) {
        inMoves.push(m);
        inIdx.push(idx);
      }
    });

    if (outMoves.length) return { role: 'outbound', moves: outMoves, planIndexes: outIdx };
    if (inMoves.length) return { role: 'inbound', moves: inMoves, planIndexes: inIdx };
    return { role: null, moves: [], planIndexes: [] };
  }

  function renderLoadoutWorkList(plan, trailerNumber, filtered) {
    if (!el.loadoutWorkCard || !el.loadoutWorkList) return false;
    const { role, moves, planIndexes } = filtered;
    if (!role || !moves.length) {
      const t = String(trailerNumber || '').trim();
      const outboundStub = t && isOutboundRegistered(t);
      if (t && outboundStub && !isPlanPresent(plan)) {
        el.loadoutWorkCard.classList.remove('hidden');
        el.loadoutWorkList.innerHTML = '<div class="empty-state">No work list yet. Go to Dock → Demo plan and tap Build load plan (demo).</div>';
        if (el.loadoutWorkHint) {
          el.loadoutWorkHint.textContent =
            'No plan moves for this outbound yet. Go to Dock → Demo plan and tap Build load plan (demo).';
        }
        if (el.loadoutWorkProgress) el.loadoutWorkProgress.textContent = '';
        setReadyToCloseBanner(false);
        return false;
      }
      el.loadoutWorkCard.classList.add('hidden');
      el.loadoutWorkList.innerHTML = '';
      if (el.loadoutWorkProgress) el.loadoutWorkProgress.textContent = '';
      setReadyToCloseBanner(false);
      return false;
    }

    const fp = planFingerprint(plan);
    el.loadoutWorkCard.classList.remove('hidden');

    if (el.loadoutWorkHint) {
      el.loadoutWorkHint.textContent =
        role === 'outbound'
          ? 'Go-get steps to load THIS outbound trailer. Tap a step when finished.'
          : 'Steps that pull freight FROM this inbound trailer. Tap a step when finished.';
    }

    let doneCount = 0;
    const frag = document.createDocumentFragment();
    moves.forEach((m, i) => {
      const planIdx = planIndexes[i];
      const key = moveDoneKey(m, planIdx);
      const done = isLoadoutMoveDone(fp, trailerNumber, key);
      if (done) doneCount += 1;

      const fromDoor = (m.from && m.from.door) || '—';
      const fromTr = (m.from && m.from.trailer) || '—';
      const fromSlot = (m.from && m.from.slot) || '—';
      const toTr = (m.to && m.to.trailer) || '—';
      const toSlot = (m.to && m.to.slot) || '—';
      const toDoor = (m.to && m.to.door) || '';
      const dest = m.destination || '';
      const size =
        m.h == null && m.w == null && m.d == null
          ? ''
          : `${fmt(m.h)} × ${fmt(m.w)} × ${fmt(m.d)} in`;
      const wt = m.weight == null ? '' : `${fmt(m.weight)} lbs`;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'loadout-work-step' + (done ? ' is-done' : '');
      btn.setAttribute('data-move-key', key);
      btn.setAttribute('role', 'listitem');
      btn.setAttribute(
        'aria-pressed',
        done ? 'true' : 'false'
      );
      btn.innerHTML = `
        <div class="loadout-work-step-top">
          <span class="loadout-work-num">${i + 1}</span>
          <span class="loadout-work-check" aria-hidden="true">${done ? '✓' : ''}</span>
          <span class="loadout-work-pro">PRO ${escapeHtml(m.pro || '—')} · Piece ${escapeHtml(m.pieceFraction || '—')}</span>
        </div>
        ${dest ? `<div class="loadout-work-dest">Going to: ${escapeHtml(dest)}</div>` : ''}
        <div class="loadout-work-action">
          <span class="loadout-work-get"><strong>Get</strong> Door ${escapeHtml(fromDoor)} · Trl ${escapeHtml(fromTr)} · ${escapeHtml(fromSlot)}</span>
          <span class="loadout-work-arrow" aria-hidden="true">→</span>
          <span class="loadout-work-put"><strong>Put</strong> Trl ${escapeHtml(toTr)}${toDoor ? ` · Door ${escapeHtml(toDoor)}` : ''} · ${escapeHtml(toSlot)}</span>
        </div>
        ${size || wt ? `<div class="loadout-work-meta">${escapeHtml([size, wt].filter(Boolean).join(' · '))}</div>` : ''}
        <div class="loadout-work-tap-hint">${done ? 'Done — tap to undo' : 'Tap when done'}</div>
      `;
      frag.appendChild(btn);
    });

    el.loadoutWorkList.innerHTML = '';
    el.loadoutWorkList.appendChild(frag);

    if (el.loadoutWorkProgress) {
      el.loadoutWorkProgress.textContent = `${doneCount} of ${moves.length} done`;
    }

    // Ready to close: outbound only, Work list non-empty, all steps done
    const allDone = role === 'outbound' && moves.length > 0 && doneCount === moves.length;
    setReadyToCloseBanner(allDone);
    return true;
  }

  function setReadyToCloseBanner(show) {
    const banner = el.loadoutReadyBanner;
    if (!banner) return;
    banner.classList.toggle('hidden', !show);
    if (show) banner.removeAttribute('hidden');
    else banner.setAttribute('hidden', '');
  }

  /** Progress for an outbound trailer Work list: {total, done, allDone} or null if no work. */
  function outboundWorkProgress(plan, trailerNumber) {
    const t = String(trailerNumber || '').trim();
    if (!t || !isPlanPresent(plan)) return null;
    const filtered = movesForSelectedTrailer(plan, t);
    if (filtered.role !== 'outbound' || !filtered.moves.length) return null;
    const fp = planFingerprint(plan);
    let done = 0;
    filtered.moves.forEach((m, i) => {
      const key = moveDoneKey(m, filtered.planIndexes[i]);
      if (isLoadoutMoveDone(fp, t, key)) done += 1;
    });
    const total = filtered.moves.length;
    return { total, done, allDone: done === total && total > 0 };
  }

  function renderLoadoutInventory(groups, opts) {
    const { hasPlan, hasWork, role } = opts;
    if (el.loadoutListHeading) {
      if (hasWork && role === 'outbound') {
        el.loadoutListHeading.textContent = 'What is already planned on this trailer';
      } else {
        el.loadoutListHeading.textContent = 'What is on this trailer';
      }
    }
    if (el.loadoutInventoryHint) {
      el.loadoutInventoryHint.textContent = hasWork && role === 'outbound'
        ? 'Logged freight currently on this trailer (if any). Work list above is your go-get guide.'
        : 'Grouped by bill (PRO). Same PRO stays on one trailer.';
    }

    if (!groups.length) {
      let msg;
      if (!state.loadoutTrailer) {
        msg = 'Pick a trailer first — type a number or tap a chip above.';
      } else if (hasWork) {
        msg =
          role === 'outbound'
            ? 'Nothing logged on this outbound yet. Follow the Work list above to load it.'
            : 'No freight listed on this trailer. Follow the Work list above if steps remain.';
      } else if (hasPlan) {
        msg =
          'Nothing on this trailer, and no work steps for it in the current plan. Try an <strong>OUT</strong> chip, or pick an inbound trailer that has freight.';
      } else if (isOutboundRegistered(state.loadoutTrailer)) {
        msg =
          'No work list yet.<br/>Go to <strong>Dock → Demo plan</strong> and tap <strong>Build load plan (demo)</strong>.';
      } else {
        msg =
          'Nothing on this trailer yet.<br/>Log freight with this trailer number, or go to <strong>Dock → Demo plan</strong> and build a plan.';
      }
      el.loadoutList.innerHTML = `<div class="empty-state">${msg}</div>`;
      return;
    }

    const frag = document.createDocumentFragment();
    groups.forEach((g) => {
      const wrap = document.createElement('div');
      wrap.className = 'loadout-pro';

      const head = document.createElement('div');
      head.className = 'loadout-pro-head';
      const title = document.createElement('h3');
      title.className = 'loadout-pro-title';
      title.textContent = `Bill (PRO) ${g.pro}`;
      head.appendChild(title);
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn tiny muted-btn edit-pro-btn';
      editBtn.textContent = 'Edit bill';
      editBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openEditPro(g.pro);
      });
      head.appendChild(editBtn);
      wrap.appendChild(head);

      const dest = g.destination || DockStorage.getProDestination(g.pro);
      const destEl = document.createElement('div');
      destEl.className = 'loadout-pro-dest';
      destEl.textContent = dest ? `Going to: ${dest}` : 'No destination yet — tap Edit bill';
      wrap.appendChild(destEl);

      const meta = document.createElement('div');
      meta.className = 'loadout-pro-meta';
      meta.textContent = `${g.pieces.length} piece${g.pieces.length === 1 ? '' : 's'}`;
      wrap.appendChild(meta);

      g.pieces.forEach((e) => {
        const piece = document.createElement('div');
        piece.className = 'loadout-piece';
        const slot = e.slotLabel || DockStorage.formatSlot(e.section, e.level, e.lateral);
        const size =
          e.h == null && e.w == null && e.d == null
            ? 'Size —'
            : `${fmt(e.h)} × ${fmt(e.w)} × ${fmt(e.d)} in`;
        const wt = e.weight == null ? 'Weight —' : `${fmt(e.weight)} lbs`;
        piece.innerHTML = `
          <div class="loadout-piece-top">
            <span class="loadout-piece-frac">Piece ${escapeHtml(e.pieceFraction || '—')}</span>
            <span class="loadout-piece-slot">${escapeHtml(slot)}</span>
          </div>
          <div class="loadout-piece-dims">${escapeHtml(size)}</div>
          <div class="loadout-piece-weight">${escapeHtml(wt)}</div>
        `;
        wrap.appendChild(piece);
      });

      frag.appendChild(wrap);
    });

    el.loadoutList.innerHTML = '';
    el.loadoutList.appendChild(frag);
  }

  function renderLoadout(trailerNumber) {
    const t = String(trailerNumber || '').trim();
    state.loadoutTrailer = t;

    if (!t) {
      if (el.loadoutSummaryCard) el.loadoutSummaryCard.classList.add('hidden');
      if (el.sumTrailer) el.sumTrailer.textContent = '—';
      if (el.sumPros) el.sumPros.textContent = '0';
      if (el.sumPieces) el.sumPieces.textContent = '0';
      if (el.sumWeight) el.sumWeight.textContent = '—';
      if (el.loadoutWorkCard) {
        el.loadoutWorkCard.classList.add('hidden');
        if (el.loadoutWorkList) el.loadoutWorkList.innerHTML = '';
      }
      if (el.loadoutWorkProgress) el.loadoutWorkProgress.textContent = '';
      setReadyToCloseBanner(false);
      // Hide empty "What is on this trailer" card until a trailer is chosen
      if (el.loadoutInventoryCard) el.loadoutInventoryCard.classList.add('hidden');
      if (el.loadoutList) el.loadoutList.innerHTML = '';
      if (el.loadoutListHeading) el.loadoutListHeading.textContent = 'What is on this trailer';
      if (el.loadoutInventoryHint) {
        el.loadoutInventoryHint.textContent = 'Grouped by bill (PRO). Same PRO stays on one trailer.';
      }
      highlightLoadoutChips('');
      updateLoadoutPlanBanner();
      return;
    }

    if (el.loadoutInventoryCard) el.loadoutInventoryCard.classList.remove('hidden');

    const groups = DockStorage.loadOutByTrailer(t);
    const allPieces = groups.reduce((n, g) => n + g.pieces.length, 0);

    let weightSum = 0;
    let weightCount = 0;
    groups.forEach((g) => {
      g.pieces.forEach((e) => {
        if (e.weight != null && !Number.isNaN(Number(e.weight))) {
          weightSum += Number(e.weight);
          weightCount += 1;
        }
      });
    });

    const plan = DockStorage.readLoadPlan();
    const hasPlan = isPlanPresent(plan);
    const filtered = movesForSelectedTrailer(plan, t);
    const hasWork = renderLoadoutWorkList(plan, t, filtered);

    // Summary: prefer work-list counts when loading outbound with a plan
    let sumPros = groups.length;
    let sumPieces = allPieces;
    let sumWeightText = weightCount ? `${weightSum.toLocaleString()} lbs` : '—';

    if (hasWork && filtered.role === 'outbound' && plan) {
      const load = (plan.outboundLoadouts || []).find(
        (L) => String(L.trailerNumber || '').trim() === t
      );
      if (load) {
        sumPros = load.proCount != null ? load.proCount : sumPros;
        sumPieces = load.pieceCount != null ? load.pieceCount : filtered.moves.length;
        if (load.totalWeight != null) {
          sumWeightText = `${Number(load.totalWeight).toLocaleString()} lbs`;
        }
      } else {
        sumPros = new Set(filtered.moves.map((m) => m.pro)).size;
        sumPieces = filtered.moves.length;
        let w = 0;
        let wc = 0;
        filtered.moves.forEach((m) => {
          if (m.weight != null && !Number.isNaN(Number(m.weight))) {
            w += Number(m.weight);
            wc += 1;
          }
        });
        sumWeightText = wc ? `${w.toLocaleString()} lbs` : '—';
      }
    }

    el.loadoutSummaryCard.classList.remove('hidden');
    el.sumTrailer.textContent = t || '—';
    el.sumPros.textContent = String(sumPros);
    el.sumPieces.textContent = String(sumPieces);
    el.sumWeight.textContent = sumWeightText;

    renderLoadoutInventory(groups, {
      hasPlan,
      hasWork,
      role: filtered.role,
    });
    updateLoadoutPlanBanner();
  }


  function bindDock() {
    if (!el.dockBackBtn) return;
    el.dockBackBtn.addEventListener('click', () => {
      if (state.dockLevel === 'pieces') {
        state.dockLevel = 'pros';
        state.dockPro = '';
      } else if (state.dockLevel === 'pros') {
        state.dockLevel = 'doors';
        state.dockDoor = '';
        state.dockPro = '';
      }
      renderDock();
    });
  }

  function renderDock() {
    if (!el.dockBoard) return;
    const showBack = state.dockLevel !== 'doors';
    el.dockBackBtn.classList.toggle('hidden', !showBack);

    if (state.dockLevel === 'doors') {
      if (el.dockHint) {
        el.dockHint.textContent =
          'Doors that have a trailer from your logged freight. Tap a door to see bills (PROs). Viewing only.';
      }
      renderDockDoors();
      return;
    }
    if (state.dockLevel === 'pros') {
      if (el.dockHint) {
        el.dockHint.textContent =
          `Door ${state.dockDoor} — tap a bill (PRO) to see pieces and locations. Viewing only.`;
      }
      renderDockPros();
      return;
    }
    if (el.dockHint) {
      el.dockHint.textContent =
        `PRO ${state.dockPro} at door ${state.dockDoor} — pieces with location. Tap Edit bill to change destination, door, or trailer.`;
    }
    renderDockPieces();
  }

  function renderDockDoors() {
    const rows = DockStorage.doorsBoard();
    if (!rows.length) {
      el.dockBoard.innerHTML =
        '<div class="empty-state">No doors yet. Log freight with a door number, or tap Load demo inbound trailers above.</div>';
      return;
    }
    const frag = document.createDocumentFragment();
    rows.forEach((row) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dock-door-row';
      const trailer = row.trailerNumber || '—';
      const counts = `${row.proCount} bill${row.proCount === 1 ? '' : 's'} · ${row.pieceCount} piece${row.pieceCount === 1 ? '' : 's'}`;
      btn.innerHTML = `
        <span class="dock-door-main">
          <span class="dock-door-num">Door ${escapeHtml(row.doorNumber)}</span>
          <span class="dock-door-trailer">Trailer ${escapeHtml(trailer)}</span>
        </span>
        <span class="dock-door-meta">${escapeHtml(counts)}</span>
      `;
      btn.addEventListener('click', () => {
        state.dockDoor = row.doorNumber;
        state.dockPro = '';
        state.dockLevel = 'pros';
        renderDock();
      });
      frag.appendChild(btn);
    });
    el.dockBoard.innerHTML = '';
    el.dockBoard.appendChild(frag);
  }

  function renderDockPros() {
    const data = DockStorage.dockProsAtDoor(state.dockDoor);
    const head = document.createElement('div');
    head.className = 'dock-context';
    head.innerHTML = `
      <div class="dock-context-title">Door ${escapeHtml(data.doorNumber)}</div>
      <div class="dock-context-sub">Trailer ${escapeHtml(data.trailerNumber || '—')}</div>
    `;

    if (!data.groups.length) {
      el.dockBoard.innerHTML = '';
      el.dockBoard.appendChild(head);
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = "No bills on this door's trailer yet.";
      el.dockBoard.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    frag.appendChild(head);
    data.groups.forEach((g) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dock-pro-row';
      const dest = g.destination || DockStorage.getProDestination(g.pro);
      const destHtml = dest
        ? `<span class="dock-pro-dest">Going to: ${escapeHtml(dest)}</span>`
        : '';
      btn.innerHTML = `
        <span class="dock-pro-main">Bill (PRO) ${escapeHtml(g.pro)}</span>
        ${destHtml}
        <span class="dock-pro-meta">${g.pieces.length} piece${g.pieces.length === 1 ? '' : 's'}</span>
      `;
      btn.addEventListener('click', () => {
        state.dockPro = g.pro;
        state.dockLevel = 'pieces';
        renderDock();
      });
      frag.appendChild(btn);
    });
    el.dockBoard.innerHTML = '';
    el.dockBoard.appendChild(frag);
  }

  function renderDockPieces() {
    const data = DockStorage.dockProsAtDoor(state.dockDoor);
    const group = data.groups.find((g) => g.pro === state.dockPro);
    const head = document.createElement('div');
    head.className = 'dock-context';
    const proDest = DockStorage.getProDestination(state.dockPro);
    const destSub = proDest
      ? ` · Going to ${escapeHtml(proDest)}`
      : ' · no destination yet';
    head.innerHTML = `
      <div class="dock-context-top">
        <div>
          <div class="dock-context-title">PRO ${escapeHtml(state.dockPro)}</div>
          <div class="dock-context-sub">Door ${escapeHtml(data.doorNumber)} · Trailer ${escapeHtml(data.trailerNumber || '—')}${destSub}</div>
        </div>
        <button type="button" class="btn tiny muted-btn edit-pro-btn" id="dockEditProBtn">Edit bill</button>
      </div>
    `;
    el.dockBoard.innerHTML = '';
    el.dockBoard.appendChild(head);
    const dockEdit = head.querySelector('#dockEditProBtn');
    if (dockEdit) {
      dockEdit.addEventListener('click', (ev) => {
        ev.preventDefault();
        openEditPro(state.dockPro);
      });
    }

    if (!group || !group.pieces.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No pieces for this bill at this door.';
      el.dockBoard.appendChild(empty);
      return;
    }

    group.pieces.forEach((e) => {
      const piece = document.createElement('div');
      piece.className = 'dock-piece';
      const slot = e.slotLabel || DockStorage.formatSlot(e.section, e.level, e.lateral);
      const size =
        e.h == null && e.w == null && e.d == null
          ? 'Size —'
          : `${fmt(e.h)} × ${fmt(e.w)} × ${fmt(e.d)} in`;
      const wt = e.weight == null ? 'Weight —' : `${fmt(e.weight)} lbs`;
      piece.innerHTML = `
        <div class="dock-piece-top">
          <span class="dock-piece-frac">Piece ${escapeHtml(e.pieceFraction || '—')}</span>
          <span class="dock-piece-slot">${escapeHtml(slot)}</span>
        </div>
        <div class="dock-piece-dims">${escapeHtml(size)}</div>
        <div class="dock-piece-weight">${escapeHtml(wt)}</div>
      `;
      el.dockBoard.appendChild(piece);
    });
  }

  function bindOutbound() {
    if (!el.outboundSaveBtn) return;
    el.outboundSaveBtn.addEventListener('click', () => saveOutboundFromForm(false));
    if (el.outboundOpenBtn) {
      el.outboundOpenBtn.addEventListener('click', () => saveOutboundFromForm(true));
    }
    if (el.outboundTrailerInput) {
      el.outboundTrailerInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveOutboundFromForm(false);
        }
      });
    }
  }

  /**
   * @param {boolean} forceOpen  if true, destination becomes "open"
   */
  function saveOutboundFromForm(forceOpen) {
    if (!el.outboundTrailerInput) return;
    const trailerNumber = el.outboundTrailerInput.value.trim();
    if (!trailerNumber) {
      toast('Enter outbound trailer number');
      el.outboundTrailerInput.focus();
      return;
    }
    const doorNumber = el.outboundDoorInput ? el.outboundDoorInput.value.trim() : '';
    let destination = el.outboundDestInput ? el.outboundDestInput.value.trim() : '';
    if (forceOpen) destination = 'open';
    if (!destination) destination = 'open';

    const cityFloorOnly = !!(el.outboundCityFloorOnly && el.outboundCityFloorOnly.checked);
    DockStorage.saveOutboundTrailer({
      trailerNumber,
      doorNumber,
      destination,
      cityFloorOnly,
    });

    el.outboundTrailerInput.value = '';
    if (el.outboundDoorInput) el.outboundDoorInput.value = '';
    if (el.outboundDestInput) el.outboundDestInput.value = '';
    if (el.outboundCityFloorOnly) el.outboundCityFloorOnly.checked = false;
    renderOutboundList();
    toast(
      destination === 'open'
        ? `Outbound trailer ${trailerNumber} saved as open${cityFloorOnly ? ' · city floor-only' : ''}`
        : `Outbound trailer ${trailerNumber} → ${destination}${cityFloorOnly ? ' · city floor-only' : ''}`
    );
  }

  function renderOutboundList() {
    if (!el.outboundList) return;
    const list = DockStorage.readOutboundTrailers();
    if (!list.length) {
      el.outboundList.innerHTML =
        '<div class="empty-state">No outbound trailers yet. Add a trailer number above, then Save (or tap Open if the destination is not set).</div>';
      return;
    }

    const plan = DockStorage.readLoadPlan();
    const frag = document.createDocumentFragment();
    list.forEach((row) => {
      const div = document.createElement('div');
      div.className = 'outbound-row' + (row.cityFloorOnly ? ' is-city-floor' : '');
      const dest = String(row.destination || 'open').trim() || 'open';
      const isOpen = dest.toLowerCase() === 'open';
      const door = String(row.doorNumber || '').trim();
      const doorText = door ? `Door ${door}` : 'Door not set yet';
      const cityChecked = row.cityFloorOnly ? 'checked' : '';
      const progress = outboundWorkProgress(plan, row.trailerNumber);
      const readyHint = progress && progress.allDone
        ? '<div class="ready-to-close-hint" role="status">Ready to close</div>'
        : '';
      div.innerHTML = `
        <div class="outbound-row-top">
          <span class="outbound-trailer">Trailer ${escapeHtml(row.trailerNumber)}</span>
          <span class="outbound-dest${isOpen ? ' is-open' : ''}">${
            isOpen ? 'Open' : escapeHtml(dest)
          }</span>
        </div>
        <div class="outbound-meta">${escapeHtml(doorText)} · added ${escapeHtml(
          DockStorage.formatTimeLocal(row.createdAt)
        )}${row.cityFloorOnly ? ' · City floor-only' : ''}</div>
        ${readyHint}
        <label class="city-toggle-label compact" for="city-${escapeHtml(row.id)}">
          <input type="checkbox" id="city-${escapeHtml(row.id)}" data-city-toggle="${escapeHtml(row.id)}" ${cityChecked} />
          <span>City load — floor only</span>
        </label>
        <div class="outbound-row-actions">
          <button type="button" class="btn tiny muted-btn" data-remove="${escapeHtml(row.id)}">Remove</button>
        </div>
      `;
      const toggle = div.querySelector('[data-city-toggle]');
      if (toggle) {
        toggle.addEventListener('change', () => {
          DockStorage.updateOutboundTrailer(row.id, { cityFloorOnly: toggle.checked });
          renderOutboundList();
          toast(
            toggle.checked
              ? `Trailer ${row.trailerNumber}: city floor-only (rebuild plan to apply)`
              : `Trailer ${row.trailerNumber}: linehaul decks OK (rebuild plan to apply)`
          );
        });
      }
      const rm = div.querySelector('[data-remove]');
      if (rm) {
        rm.addEventListener('click', () => {
          DockStorage.removeOutboundTrailer(row.id);
          renderOutboundList();
          toast(`Removed outbound trailer ${row.trailerNumber}`);
        });
      }
      frag.appendChild(div);
    });
    el.outboundList.innerHTML = '';
    el.outboundList.appendChild(frag);
  }


  // ---------- Ground deck-build orders ----------

  function readGroundDoneStore() {
    try {
      const raw = localStorage.getItem(GROUND_DONE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeGroundDoneStore(store) {
    try {
      localStorage.setItem(GROUND_DONE_KEY, JSON.stringify(store));
    } catch (_) {
      /* ignore quota */
    }
  }

  function groundDoneBucketKey(fingerprint) {
    return String(fingerprint || '');
  }

  function isGroundOrderDone(fingerprint, orderId) {
    const store = readGroundDoneStore();
    const bucket = store[groundDoneBucketKey(fingerprint)];
    return !!(bucket && bucket[orderId]);
  }

  function setGroundOrderDone(fingerprint, orderId, done) {
    const store = readGroundDoneStore();
    const key = groundDoneBucketKey(fingerprint);
    if (!store[key]) store[key] = {};
    if (done) store[key][orderId] = true;
    else delete store[key][orderId];
    if (!Object.keys(store[key]).length) delete store[key];
    writeGroundDoneStore(store);
  }

  function clearGroundDone(fingerprint) {
    const store = readGroundDoneStore();
    delete store[groundDoneBucketKey(fingerprint)];
    writeGroundDoneStore(store);
  }

  function bindGround() {
    if (el.groundClearDoneBtn) {
      el.groundClearDoneBtn.addEventListener('click', () => {
        const plan = DockStorage.readLoadPlan();
        const fp = planFingerprint(plan);
        if (!fp) {
          toast('No done marks to clear yet');
          return;
        }
        clearGroundDone(fp);
        renderGround();
        toast('Cleared ground done marks');
      });
    }
    if (el.groundOrdersList) {
      el.groundOrdersList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-ground-id]');
        if (!btn) return;
        const orderId = btn.getAttribute('data-ground-id');
        const plan = DockStorage.readLoadPlan();
        const fp = planFingerprint(plan);
        if (!fp || !orderId) return;
        const done = isGroundOrderDone(fp, orderId);
        setGroundOrderDone(fp, orderId, !done);
        renderGround();
      });
    }
  }

  function renderGround() {
    if (!el.groundOrdersList) return;
    const plan = DockStorage.readLoadPlan();
    const orders =
      typeof DockLoadPlan !== 'undefined' && DockLoadPlan.deriveGroundOrders
        ? DockLoadPlan.deriveGroundOrders(plan)
        : [];

    if (!isPlanPresent(plan)) {
      el.groundOrdersList.innerHTML =
        '<div class="empty-state">No deck builds yet. Build a load plan first (non-city trailers may need decks).</div>';
      if (el.groundOrdersHint) {
        el.groundOrdersHint.textContent =
          'Build a load plan on Demo plan first. Then come back here for deck-build orders.';
      }
      if (el.groundOrdersProgress) el.groundOrdersProgress.textContent = '';
      return;
    }

    if (!orders.length) {
      el.groundOrdersList.innerHTML =
        '<div class="empty-state">No deck builds yet. Build a load plan first (non-city trailers may need decks).</div>';
      if (el.groundOrdersHint) {
        el.groundOrdersHint.textContent =
          'This plan has no B/C freight (or all outbound trailers are city floor-only). Floor (A) only — no deck builds.';
      }
      if (el.groundOrdersProgress) el.groundOrdersProgress.textContent = '';
      return;
    }

    if (el.groundOrdersHint) {
      el.groundOrdersHint.textContent =
        'Build these decks before stacking freight on B or C. One order per section. Tap when done.';
    }

    const fp = planFingerprint(plan);
    let doneCount = 0;

    // Group by trailer for readability
    /** @type {Map<string, object[]>} */
    const byTrailer = new Map();
    orders.forEach((o) => {
      const t = o.trailerNumber;
      if (!byTrailer.has(t)) byTrailer.set(t, []);
      byTrailer.get(t).push(o);
    });

    const frag = document.createDocumentFragment();
    let globalNum = 0;
    byTrailer.forEach((list, trailer) => {
      const head = document.createElement('div');
      head.className = 'ground-trailer-head';
      const dest = (list[0] && list[0].destination) || '';
      head.textContent = dest
        ? `Trailer ${trailer} → ${dest}`
        : `Trailer ${trailer}`;
      frag.appendChild(head);

      list.forEach((o) => {
        globalNum += 1;
        const done = isGroundOrderDone(fp, o.id);
        if (done) doneCount += 1;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ground-order-step' + (done ? ' is-done' : '');
        btn.setAttribute('data-ground-id', o.id);
        btn.setAttribute('role', 'listitem');
        btn.setAttribute('aria-pressed', done ? 'true' : 'false');
        btn.innerHTML = `
          <div class="loadout-work-step-top">
            <span class="loadout-work-num">${globalNum}</span>
            <span class="loadout-work-check" aria-hidden="true">${done ? '✓' : ''}</span>
            <span class="loadout-work-pro">${escapeHtml(o.label)}</span>
          </div>
          <div class="ground-order-detail">${escapeHtml(o.detail)}</div>
          <div class="loadout-work-tap-hint">${done ? 'Done — tap to undo' : 'Tap when deck is built'}</div>
        `;
        frag.appendChild(btn);
      });
    });

    el.groundOrdersList.innerHTML = '';
    el.groundOrdersList.appendChild(frag);
    if (el.groundOrdersProgress) {
      el.groundOrdersProgress.textContent = `${doneCount} of ${orders.length} done`;
    }
  }

  function bindEditPro() {
    if (!el.editProOverlay) return;
    if (el.editProCancelBtn) {
      el.editProCancelBtn.addEventListener('click', () => closeEditPro());
    }
    if (el.editProSaveBtn) {
      el.editProSaveBtn.addEventListener('click', () => saveEditPro());
    }
    el.editProOverlay.addEventListener('click', (ev) => {
      if (ev.target === el.editProOverlay) closeEditPro();
    });
    if (el.editProDestination) {
      el.editProDestination.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveEditPro();
        }
      });
    }
  }

  /**
   * Open plain Edit bill sheet for a PRO already on the dock.
   * Destination updates pros store; door/trailer update every piece of that PRO.
   */
  function openEditPro(pro) {
    const key = String(pro || '').trim();
    if (!key || !el.editProOverlay) return;
    state.editingPro = key;
    const dest = DockStorage.getProDestination(key);
    const pieces = DockStorage.entriesForPro(key);
    const trailers = DockStorage.trailerNumbersForPro(key);
    let door = '';
    for (const e of pieces) {
      const d = String(e.doorNumber || '').trim();
      if (d) {
        door = d;
        break;
      }
    }
    if (el.editProNumber) el.editProNumber.value = key;
    if (el.editProDestination) el.editProDestination.value = dest || '';
    if (el.editProTrailer) el.editProTrailer.value = trailers[0] || '';
    if (el.editProDoor) el.editProDoor.value = door;
    el.editProOverlay.classList.remove('hidden');
    el.editProOverlay.removeAttribute('hidden');
    if (el.editProDestination) {
      setTimeout(() => {
        el.editProDestination.focus();
        el.editProDestination.select();
      }, 50);
    }
  }

  function closeEditPro() {
    state.editingPro = '';
    if (!el.editProOverlay) return;
    el.editProOverlay.classList.add('hidden');
    el.editProOverlay.setAttribute('hidden', '');
  }

  function saveEditPro() {
    const pro = state.editingPro || (el.editProNumber && el.editProNumber.value.trim()) || '';
    if (!pro) {
      toast('No bill selected to edit');
      return;
    }
    const destination = el.editProDestination ? el.editProDestination.value.trim() : '';
    const trailerNumber = el.editProTrailer ? el.editProTrailer.value.trim() : '';
    const doorNumber = el.editProDoor ? el.editProDoor.value.trim() : '';

    const result = DockStorage.updateProBill(pro, {
      destination,
      trailerNumber,
      doorNumber,
    });
    if (!result) {
      toast("Couldn't save changes to this bill. Try again.");
      return;
    }

    closeEditPro();
    refreshAfterProEdit(pro);
    // Keep entry form in sync if driver is still on this PRO
    if (el.pro && el.pro.value.trim() === pro) {
      syncDestinationFromPro();
      if (el.trailerNumber && trailerNumber) el.trailerNumber.value = trailerNumber;
      if (el.doorNumber) el.doorNumber.value = doorNumber;
    }
    const destMsg = result.destination
      ? `→ ${result.destination}`
      : 'destination cleared';
    toast(`Updated PRO ${pro} ${destMsg}`);
  }

  function refreshAfterProEdit(pro) {
    renderRecent();
    if (state.loadoutTrailer) renderLoadout(state.loadoutTrailer);
    refreshLoadoutTrailerPicker();
    if (state.view === 'dock') {
      if (state.dockSection === 'inbound') renderDock();
      else if (state.dockSection === 'outbound') renderOutboundList();
      else if (state.dockSection === 'ground') renderGround();
      else if (state.dockSection === 'plan') renderPlan();
    }
    syncPieceSequenceFromStorage();
  }


  function bindConfirmSheet() {
    if (!el.confirmOverlay) return;
    if (el.confirmCancelBtn) {
      el.confirmCancelBtn.addEventListener('click', () => closeConfirmSheet());
    }
    if (el.confirmOkBtn) {
      el.confirmOkBtn.addEventListener('click', () => onConfirmSheetOk());
    }
    el.confirmOverlay.addEventListener('click', (ev) => {
      if (ev.target === el.confirmOverlay) closeConfirmSheet();
    });
  }

  /**
   * In-app confirm sheet — never uses window.confirm (unreliable on phones / PWAs).
   * Opening the sheet is immediate feedback (<100ms).
   */
  function openConfirmSheet({ title, message, action }) {
    if (!el.confirmOverlay) {
      toast("Can't show confirm — refresh the page");
      return;
    }
    state.confirmPending = { action };
    if (el.confirmHeading) el.confirmHeading.textContent = title || 'Confirm';
    if (el.confirmMessage) el.confirmMessage.textContent = message || '';
    el.confirmOverlay.classList.remove('hidden');
    el.confirmOverlay.removeAttribute('hidden');
    if (el.confirmOkBtn) {
      setTimeout(() => el.confirmOkBtn.focus(), 40);
    }
  }

  function closeConfirmSheet() {
    state.confirmPending = null;
    if (!el.confirmOverlay) return;
    el.confirmOverlay.classList.add('hidden');
    el.confirmOverlay.setAttribute('hidden', '');
  }

  function onConfirmSheetOk() {
    const pending = state.confirmPending;
    closeConfirmSheet();
    if (!pending || !pending.action) return;
    if (pending.action === 'seedDemoInbound' || pending.action === 'loadDemo') {
      runSeedDemoInbound();
      return;
    }
    if (pending.action === 'clearPlan') {
      if (typeof doClearPlan === 'function') doClearPlan();
      else {
        DockStorage.clearLoadPlan();
        renderPlan();
        toast('Plan cleared');
      }
      return;
    }
    if (pending.action === 'clearAll') {
      doClearAll();
      return;
    }
  }

  function bindPlan() {
    if (el.loadDemoInboundBtn) {
      el.loadDemoInboundBtn.addEventListener('click', () => onLoadDemoInbound());
    }
    if (el.runLoadPlanBtn) {
      el.runLoadPlanBtn.addEventListener('click', () => onRunLoadPlan());
    }
    if (el.clearPlanBtn) {
      el.clearPlanBtn.addEventListener('click', () => onClearPlan());
    }
  }

  function onClearPlan() {
    if (!DockStorage.readLoadPlan()) {
      toast('No plan to clear yet');
      return;
    }
    openConfirmSheet({
      title: 'Clear plan',
      message: 'Clear the saved load plan from this device? Logged freight stays; only the plan is removed.',
      action: 'clearPlan',
    });
  }


  function doClearAll() {
    try {
      DockStorage.clearAll();
      DockStorage.clearLoadPlan();
      setPieceLocked(false);
      el.piece.value = '';
      // Everything is gone — drop loadout selection
      state.loadoutTrailer = '';
      if (el.loadoutTrailerInput) el.loadoutTrailerInput.value = '';
      renderRecent();
      renderPlan();
      renderOutboundList();
      refreshLoadoutTrailerPicker();
      updateLoadoutPlanBanner();
      if (state.view === 'loadout') {
        renderLoadout('');
      }
      if (state.view === 'dock') {
        if (state.dockSection === 'inbound') renderDock();
        else if (state.dockSection === 'outbound') renderOutboundList();
        else if (state.dockSection === 'ground') renderGround();
        else if (state.dockSection === 'plan') renderPlan();
      }
      renderGround();
      toast('All freight and the load plan were cleared.');
    } catch (err) {
      console.error(err);
      toast("Couldn't clear everything. Try again.");
    }
  }

  function doClearPlan() {
    try {
      DockStorage.clearLoadPlan();
      renderPlan();
      renderGround();
      if (el.planStatusHint) el.planStatusHint.textContent = 'Plan cleared.';
      toast('Plan cleared');
      // Drop plan-only OUT chips; keep inbound freight chips
      const stillFreight = new Set(DockStorage.allTrailerNumbers().map((x) => String(x || '').trim()));
      if (state.loadoutTrailer && !stillFreight.has(String(state.loadoutTrailer).trim())) {
        state.loadoutTrailer = '';
        if (el.loadoutTrailerInput) el.loadoutTrailerInput.value = '';
      }
      refreshLoadoutTrailerPicker();
      updateLoadoutPlanBanner();
      if (state.view === 'loadout') {
        renderLoadout(state.loadoutTrailer || '');
      } else {
        // Still refresh picker chips even when not on load-out screen
        highlightLoadoutChips(state.loadoutTrailer || '');
      }
    } catch (err) {
      console.error(err);
      toast("Couldn't clear the plan. Try again.");
    }
  }

  function onLoadDemoInbound() {
    toast('Opening confirm…');
    if (typeof DockLoadPlan === 'undefined' || !DockLoadPlan.seedDemoInbound) {
      toast("Planner didn't load. Refresh the page and try again.");
      return;
    }
    const existing = DockStorage.readAll().length;
    const msg = existing
      ? `Replace all ${existing} logged piece(s) with demo inbound freight (~5 trailers)? This clears freight + last plan. Outbound stubs for the 5 cities are added if missing.`
      : 'Load demo inbound freight (~5 trailers at doors, mixed destinations)? Outbound stubs for the 5 cities are added if missing.';
    openConfirmSheet({
      title: 'Load demo inbound trailers',
      message: msg,
      action: 'seedDemoInbound',
    });
  }

  function runSeedDemoInbound() {
    try {
      const result = DockLoadPlan.seedDemoInbound();
      state.dockLevel = 'doors';
      state.dockDoor = '';
      state.dockPro = '';
      state.loadoutTrailer = '';
      if (el.loadoutTrailerInput) el.loadoutTrailerInput.value = '';
      renderRecent();
      refreshLoadoutTrailerPicker();
      renderOutboundList();
      renderPlan();
      renderGround();
      if (state.view === 'loadout') renderLoadout('');
      if (state.view === 'dock' && state.dockSection === 'inbound') renderDock();
      if (state.view === 'dock' && state.dockSection === 'outbound') renderOutboundList();
      if (state.view === 'dock' && state.dockSection === 'ground') renderGround();
      if (el.planStatusHint) {
        el.planStatusHint.textContent =
          `Demo loaded: ${result.inboundTrailers} inbound trailers · ${result.proCount} PROs · ${result.pieceCount} pieces` +
          (result.outboundCreated ? ` · ${result.outboundCreated} outbound stub(s) created` : '');
      }
      toast(
        `Demo inbound: ${result.pieceCount} pieces on ${result.inboundTrailers} trailers`
      );
    } catch (err) {
      console.error(err);
      toast("Couldn't load demo freight. Try again, or refresh the page.");
    }
  }

  function onRunLoadPlan() {
    if (typeof DockLoadPlan === 'undefined' || !DockLoadPlan.runLoadPlan) {
      toast("Planner didn't load. Refresh the page and try again.");
      return;
    }
    const plan = DockLoadPlan.runLoadPlan();
    renderPlan();
    renderOutboundList();
    renderGround();
    const s = plan.summary || {};
    const noteSafe = sanitizePlanNote(s.note || '');
    if (el.planStatusHint) {
      el.planStatusHint.textContent = noteSafe
        ? `Plan: ${s.moveCount || 0} moves · ${s.outboundCount || 0} outbound · ${noteSafe}`
        : `Plan ready: ${s.moveCount || 0} moves`;
    }
    refreshLoadoutTrailerPicker();
    updateLoadoutPlanBanner();
    if (!(s.moveCount > 0)) {
      toast(noteSafe || 'Nothing to plan yet — load freight first');
      if (state.view === 'loadout') renderLoadout(state.loadoutTrailer || '');
      return;
    }
    toast(`Plan ready: ${s.moveCount} moves → ${s.outboundCount} outbound`);
    if (state.view === 'loadout') {
      const firstOut = firstOutboundFromPlan(plan);
      if (firstOut) {
        if (el.loadoutTrailerInput) el.loadoutTrailerInput.value = firstOut;
        state.loadoutTrailer = firstOut;
        highlightLoadoutChips(firstOut);
        renderLoadout(firstOut);
      } else {
        renderLoadout(state.loadoutTrailer || '');
      }
    }
  }

  function renderPlan() {
    const plan = DockStorage.readLoadPlan();
    renderPlanSummary(plan);
    renderPlanMoves(plan);
    renderPlanOutbound(plan);
  }

  function renderPlanSummary(plan) {
    if (!el.planSummary) return;
    if (!plan || !(plan.moves && plan.moves.length) && !(plan.outboundLoadouts && plan.outboundLoadouts.length)) {
      const rawNote = plan && plan.summary && plan.summary.note;
      const note = rawNote
        ? `<div class="empty-state">${escapeHtml(sanitizePlanNote(rawNote))}</div>`
        : '<div class="empty-state">No plan yet. On Inbound, load demo inbound trailers (or log freight), then tap Build load plan (demo) above.</div>';
      el.planSummary.innerHTML = note;
      return;
    }
    const s = plan.summary || {};
    const when = plan.createdAt
      ? DockStorage.formatTimeLocal(plan.createdAt)
      : '—';
    const noteSafe = sanitizePlanNote(s.note || '');
    el.planSummary.innerHTML = `
      <div class="plan-summary-grid">
        <div class="summary-row"><span class="summary-label">Planner</span><span class="summary-value">${escapeHtml(plan.label || plan.planner || 'demo')}</span></div>
        <div class="summary-row"><span class="summary-label">Saved</span><span class="summary-value">${escapeHtml(when)}</span></div>
        <div class="summary-row"><span class="summary-label">Moves</span><span class="summary-value">${escapeHtml(String(s.moveCount != null ? s.moveCount : (plan.moves || []).length))}</span></div>
        <div class="summary-row"><span class="summary-label">PROs</span><span class="summary-value">${escapeHtml(String(s.proCount != null ? s.proCount : '—'))}</span></div>
        <div class="summary-row"><span class="summary-label">Outbound</span><span class="summary-value">${escapeHtml(String(s.outboundCount != null ? s.outboundCount : (plan.outboundLoadouts || []).length))}</span></div>
        <div class="summary-row"><span class="summary-label">Skipped</span><span class="summary-value">${escapeHtml(String(s.skippedNoDest || 0))} no destination</span></div>
      </div>
      <p class="hint plan-note">${escapeHtml(noteSafe)}</p>
    `;
  }

  function renderPlanMoves(plan) {
    if (!el.planMoveList) return;
    const moves = (plan && plan.moves) || [];
    if (!moves.length) {
      el.planMoveList.innerHTML =
        '<div class="empty-state">No moves yet. Tap Build load plan (demo) above.</div>';
      return;
    }

    // Group by outbound trailer (fallback: destination) so long plans are scannable
    const groups = new Map();
    moves.forEach((m, idx) => {
      const toTr = (m.to && m.to.trailer) || '';
      const dest = m.destination || '';
      const key = toTr ? `trl:${toTr}` : `dest:${dest || 'unknown'}`;
      if (!groups.has(key)) {
        groups.set(key, {
          trailer: toTr || '—',
          destination: dest || '—',
          items: [],
        });
      }
      const g = groups.get(key);
      if ((!g.destination || g.destination === '—') && dest) g.destination = dest;
      g.items.push({ m, idx });
    });

    const frag = document.createDocumentFragment();
    let groupIndex = 0;
    groups.forEach((g) => {
      const details = document.createElement('details');
      details.className = 'plan-move-group';
      // First group always open; others open too so headers stay visible between groups
      details.open = true;
      if (groupIndex === 0) details.setAttribute('open', '');
      groupIndex += 1;
      const count = g.items.length;
      const trailerLabel =
        g.trailer && g.trailer !== '—'
          ? `Trailer ${g.trailer}`
          : `Destination ${g.destination}`;
      const progress = outboundWorkProgress(plan, g.trailer);
      const readyBit =
        progress && progress.allDone
          ? '<span class="ready-to-close-chip">Ready to close</span>'
          : '';
      const summary = document.createElement('summary');
      summary.className = 'plan-move-group-head';
      // Inner flex row — Safari can break toggle if <summary> itself is display:flex
      summary.innerHTML = `
        <span class="plan-move-group-head-inner">
          <span class="plan-move-group-chevron" aria-hidden="true">▸</span>
          <span class="plan-move-group-text">
            <span class="plan-move-group-label">Outbound group</span>
            <span class="plan-move-group-title">${escapeHtml(trailerLabel)} · ${escapeHtml(g.destination)}</span>
            ${readyBit}
          </span>
          <span class="plan-move-group-count">${count} move${count === 1 ? '' : 's'}</span>
        </span>
      `;
      details.appendChild(summary);

      const body = document.createElement('div');
      body.className = 'plan-move-group-body';
      g.items.forEach(({ m, idx }) => {
        const div = document.createElement('div');
        div.className = 'plan-move-row';
        const fromDoor = (m.from && m.from.door) || '—';
        const fromTr = (m.from && m.from.trailer) || '—';
        const fromSlot = (m.from && m.from.slot) || '—';
        const toTr = (m.to && m.to.trailer) || '—';
        const toSlot = (m.to && m.to.slot) || '—';
        const dest = m.destination || '';
        div.innerHTML = `
          <div class="plan-move-top">
            <span class="plan-move-num">#${idx + 1}</span>
            <span class="plan-move-pro">PRO ${escapeHtml(m.pro || '—')} · ${escapeHtml(m.pieceFraction || '—')}</span>
          </div>
          <div class="plan-move-dest">${escapeHtml(dest || '—')}</div>
          <div class="plan-move-path">
            <span class="plan-from">Door ${escapeHtml(fromDoor)} · Trl ${escapeHtml(fromTr)} · ${escapeHtml(fromSlot)}</span>
            <span class="plan-arrow" aria-hidden="true">→</span>
            <span class="plan-to">Trl ${escapeHtml(toTr)} · ${escapeHtml(toSlot)}</span>
          </div>
        `;
        body.appendChild(div);
      });
      details.appendChild(body);
      frag.appendChild(details);
    });

    el.planMoveList.innerHTML = '';
    el.planMoveList.appendChild(frag);
  }

  function renderPlanOutbound(plan) {
    if (!el.planOutboundList) return;
    const loads = (plan && plan.outboundLoadouts) || [];
    if (!loads.length) {
      el.planOutboundList.innerHTML =
        '<div class="empty-state">No planned load-outs yet. Build a load plan above to see them here.</div>';
      return;
    }
    const frag = document.createDocumentFragment();
    loads.forEach((load) => {
      const wrap = document.createElement('div');
      wrap.className = 'plan-out-trailer';
      const door = load.doorNumber ? ` · Door ${load.doorNumber}` : '';
      const wt =
        load.totalWeight != null
          ? ` · ${Number(load.totalWeight).toLocaleString()} lbs`
          : '';
      const head = document.createElement('div');
      head.className = 'plan-out-head';
      const cityBit = load.cityFloorOnly ? ' · City floor-only' : '';
      const progress = outboundWorkProgress(plan, load.trailerNumber);
      const readyLine =
        progress && progress.allDone
          ? '<div class="ready-to-close-hint">Ready to close</div>'
          : '';
      head.innerHTML = `
        <div class="plan-out-title">Trailer ${escapeHtml(load.trailerNumber)} → ${escapeHtml(load.destination || '—')}</div>
        <div class="plan-out-meta">${load.proCount || 0} bill${(load.proCount || 0) === 1 ? '' : 's'} · ${load.pieceCount || 0} piece${(load.pieceCount || 0) === 1 ? '' : 's'}${escapeHtml(door)}${escapeHtml(wt)}${escapeHtml(cityBit)}</div>
        ${readyLine}
      `;
      wrap.appendChild(head);

      (load.groups || []).forEach((g) => {
        const gEl = document.createElement('div');
        gEl.className = 'plan-out-pro';
        const gHead = document.createElement('div');
        gHead.className = 'plan-out-pro-title';
        gHead.textContent = `Bill (PRO) ${g.pro}`;
        gEl.appendChild(gHead);
        (g.pieces || []).forEach((p) => {
          const piece = document.createElement('div');
          piece.className = 'plan-out-piece';
          const size =
            p.h == null && p.w == null && p.d == null
              ? 'Size —'
              : `${fmt(p.h)} × ${fmt(p.w)} × ${fmt(p.d)} in`;
          const wts = p.weight == null ? 'Weight —' : `${fmt(p.weight)} lbs`;
          piece.innerHTML = `
            <div class="plan-out-piece-top">
              <span>Piece ${escapeHtml(p.pieceFraction || '—')}</span>
              <span class="plan-out-slot">${escapeHtml(p.slot || '—')}</span>
            </div>
            <div class="plan-out-piece-dims">${escapeHtml(size)} · ${escapeHtml(wts)}</div>
            <div class="plan-out-piece-from">from Door ${escapeHtml(p.fromDoor || '—')} / Trl ${escapeHtml(p.fromTrailer || '—')} / ${escapeHtml(p.fromSlot || '—')}</div>
          `;
          gEl.appendChild(piece);
        });
        wrap.appendChild(gEl);
      });
      frag.appendChild(wrap);
    });
    el.planOutboundList.innerHTML = '';
    el.planOutboundList.appendChild(frag);
  }

  let toastTimer = null;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 2800);
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    // Only register when served over http(s) — not file://
    if (!/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.register('./sw.js?v=23').catch(() => {
      /* offline cache optional */
    });
  }

  // Expose parse for quick console tests
  window.DockApp = { state, parse: (t) => DockSpeech.parseDimensionsUtterance(t), showView, renderLoadout, renderDock, renderOutboundList, renderGround, renderPlan, normalizePieceInput, syncPieceSequenceFromStorage, syncDestinationFromPro, openEditPro, closeEditPro, runLoadPlan: () => typeof DockLoadPlan !== 'undefined' && DockLoadPlan.runLoadPlan(), seedDemoInbound: () => typeof DockLoadPlan !== 'undefined' && DockLoadPlan.seedDemoInbound() };

  init();
})();
