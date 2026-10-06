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
  /** localStorage: how many pull doors the physical dock has (Crew map 1..N) */
  const DOCK_DOOR_COUNT_KEY = 'dockApp.dockDoorCount.v1';
  const DOCK_DOOR_COUNT_MIN = 1;
  const DOCK_DOOR_COUNT_MAX = 80;
  const DOCK_DOOR_COUNT_DEFAULT = 20;

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
    dockSection: 'crew', // v50 default: Crew (boss demo + live map) · 'inbound' | 'outbound' | 'ground' | 'crew' | 'operator' | 'plan'
    crewRotate: 0, // Refresh assignments offset
    crewSelectedOp: null, // selected operator on dock map
    crewOutDoor: null, // selected OUT door for trailer contents panel
    crewOutViewMode: 'side', // 'side' | 'top' — OUT trailer diagram
    crewOutTopDeck: 'A', // 'A'|'B'|'C' — selected deck in top-down view
    crewOutSelectedPieceKey: null, // highlighted piece in top-down / list
    crewOutJustLoadedKey: null, // v50: piece the current tour card just loaded
    crewOutListOpen: false, // v50: piece list folded by default (keeps the screen short)
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
    groundStartDemoBtn: document.getElementById('groundStartDemoBtn'),
    groundStepBtn: document.getElementById('groundStepBtn'),
    groundResetDemoBtn: document.getElementById('groundResetDemoBtn'),
    groundCurrentOrder: document.getElementById('groundCurrentOrder'),
    dockSubCrew: document.getElementById('dockSubCrew'),
    dockPanelCrew: document.getElementById('dockPanelCrew'),
    dockSubOperator: document.getElementById('dockSubOperator'),
    dockPanelOperator: document.getElementById('dockPanelOperator'),
    operatorStartBtn: document.getElementById('operatorStartBtn'),
    operatorDemoPlanBtn: document.getElementById('operatorDemoPlanBtn'),
    operatorStepBtn: document.getElementById('operatorStepBtn'),
    operatorResetBtn: document.getElementById('operatorResetBtn'),
    operatorProgress: document.getElementById('operatorProgress'),
    operatorJobCard: document.getElementById('operatorJobCard'),
    operatorDone: document.getElementById('operatorDone'),
    operatorBackToDockBtn: document.getElementById('operatorBackToDockBtn'),
    operatorBackToSummaryBtn: document.getElementById('operatorBackToSummaryBtn'),
    crewBoardList: document.getElementById('crewBoardList'),
    crewBoardHint: document.getElementById('crewBoardHint'),
    crewRefreshBtn: document.getElementById('crewRefreshBtn'),
    crewDoorCountInput: document.getElementById('crewDoorCountInput'),
    crewDockMap: document.getElementById('crewDockMap'),
    crewFloor: document.getElementById('crewFloor'),
    crewOpDetail: document.getElementById('crewOpDetail'),
    crewOutTrailerPanel: document.getElementById('crewOutTrailerPanel'),
    crewOutTrailerBody: document.getElementById('crewOutTrailerBody'),
    crewOutTrailerCloseBtn: document.getElementById('crewOutTrailerCloseBtn'),
    crewSoloStartBtn: document.getElementById('crewSoloStartBtn'),
    crewMultiStartBtn: document.getElementById('crewMultiStartBtn'),
    crewBossDemoBtn: document.getElementById('crewBossDemoBtn'),
    crewEveryMoveBtn: document.getElementById('crewEveryMoveBtn'),
    crewSoloJobCard: document.getElementById('crewSoloJobCard'),
    crewSoloCopy: document.getElementById('crewSoloCopy'),
    crewBossCopy: document.getElementById('crewBossCopy'),
    crewSpreadBanner: document.getElementById('crewSpreadBanner'),
    crewDemoControlsDetails: document.getElementById('crewDemoControlsDetails'),
    crewDoorCountDetails: document.getElementById('crewDoorCountDetails'),
    crewMapTapHint: document.getElementById('crewMapTapHint'),
    crewStepBtn: document.getElementById('crewStepBtn'),
    crewPlayBtn: document.getElementById('crewPlayBtn'),
    crewStopBtn: document.getElementById('crewStopBtn'),
    crewResetDemoBtn: document.getElementById('crewResetDemoBtn'),
    crewTourPauseToggle: document.getElementById('crewTourPauseToggle'),
    crewDemoProgress: document.getElementById('crewDemoProgress'),
    crewDemoDone: document.getElementById('crewDemoDone'),
    crewGodHud: document.getElementById('crewGodHud'),
    crewGodPulse: document.getElementById('crewGodPulse'),
    crewGodOutPills: document.getElementById('crewGodOutPills'),
    crewMoveQueue: document.getElementById('crewMoveQueue'),
    planAgentBanner: document.getElementById('planAgentBanner'),
    planAgentBannerText: document.getElementById('planAgentBannerText'),
    planAgentPackBtn: document.getElementById('planAgentPackBtn'),
    planAgentHint: document.getElementById('planAgentHint'),
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
    crewExitDemoBtn: document.getElementById('crewExitDemoBtn'),
    heroBossDemoBtn: document.getElementById('heroBossDemoBtn'),
    heroEveryMoveBtn: document.getElementById('heroEveryMoveBtn'),
    demoModeExitBtn: document.getElementById('demoModeExitBtn'),
    dockTabsGuide: document.getElementById('dockTabsGuide'),
    crewMapLegend: document.getElementById('crewMapLegend'),
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
    bindCrew();
    bindOperator();
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
    renderCrew();
    renderOperator();
    renderPlan();
    setupSpeechStatus();
    bindPieceSequenceWatchers();
    syncPieceSequenceFromStorage();
    syncDestinationFromPro();
    updateDemoModeBar();
    try {
      resumeCrewTourAfterReload();
    } catch (e) {
      console.error(e);
    }
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
      el.speechStatusText.textContent = 'Tap mic to speak dimensions (only listens when tapped)';
    }
  }

  function setListeningUI(on, interimText) {
    state.listening = on;
    el.speechStatus.classList.toggle('listening', on);
    el.listenBanner.classList.toggle('hidden', !on);
    el.speechStatusText.textContent = on ? 'Listening…' : DockSpeech.isSupported() ? 'Tap mic to speak dimensions (only listens when tapped)' : 'Voice unavailable';
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
      <div class="entry-dims">${escapeHtml(formatPieceSizeFull(e))} · ${fmt(e.weight)} lb</div>
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

  /** Normalize legacy plan-note wording from older saved plans / status. */
  function sanitizePlanNote(note) {
    if (note == null || note === '') return '';
    return String(note)
      .replace(/Packed\s+floor\s+first,\s+then\s+decks\s+B\/C/gi,
        'Packed section-by-section (nose→tail): Floor, then Deck 2 / Deck 3 per section; never whole-floor-first')
      .replace(/Packed\s+floor\s+first,\s+then\s+decks/gi,
        'Packed section-by-section (nose→tail): Floor, then Deck 2 / Deck 3 per section')
      .replace(/Packed\s+high-and-tight:?\s*/gi,
        'Packed section-by-section (nose→tail): Floor, then Deck 2 / Deck 3 per section — ')
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
    if (el.dockSubCrew) {
      el.dockSubCrew.addEventListener('click', () => showDockSection('crew'));
    }
    if (el.dockSubOperator) {
      el.dockSubOperator.addEventListener('click', () => showDockSection('operator'));
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
      crew: el.dockPanelCrew,
      operator: el.dockPanelOperator,
      plan: el.dockPanelPlan,
    };
    const tabs = {
      inbound: el.dockSubInbound,
      outbound: el.dockSubOutbound,
      ground: el.dockSubGround,
      crew: el.dockSubCrew,
      operator: el.dockSubOperator,
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
    // v50: one plain line explaining the tab you are on
    if (el.dockTabsGuide) {
      const guide = {
        inbound: 'Inbound: trailers being unloaded, door by door.',
        outbound: 'Outbound: trailers being loaded, and where each one is going.',
        ground: 'Ground: the crew that sets the decks so forklifts can stack freight.',
        crew: 'Crew: live forklift map and the boss demo. Start here.',
        operator: "Operator: one forklift driver's screen, one move at a time.",
        plan: 'Plan: the load plan, which piece goes to which trailer slot.',
      };
      el.dockTabsGuide.textContent = guide[section] || '';
    }
    // Demo plan: unstick topbar + view-tabs + dock sub-nav so chrome does not cover moves
    setPlanScrollMode(section === 'plan');
    if (section === 'inbound') renderDock();
    if (section === 'outbound') renderOutboundList();
    if (section === 'ground') renderGround();
    if (section === 'crew') renderCrew();
    if (section === 'operator') renderOperator();
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
      showDockSection(state.dockSection || 'crew');
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
        'No load plan yet. Go to Dock → Plan and tap Build load plan (demo).';
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
        'No trailers yet. Log freight first, or go to Dock → Inbound → Load demo inbound, then Plan.';
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
        el.loadoutWorkList.innerHTML = '<div class="empty-state">No work list yet. Go to Dock → Plan and tap Build load plan (demo).</div>';
        if (el.loadoutWorkHint) {
          el.loadoutWorkHint.textContent =
            'No plan moves for this outbound yet. Go to Dock → Plan and tap Build load plan (demo).';
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
      const toDoor = resolvePutDoor({
        door: (m.to && m.to.door) || '',
        trailer: (m.to && m.to.trailer) || '',
        destination: m.destination || '',
      });
      const dest = m.destination || '';
      const size =
        m.h == null && m.w == null && m.d == null
          ? ''
          : formatPieceSizeFull(m);
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
      const putParts = [];
      if (toDoor) putParts.push(`Door ${toDoor}`);
      else if (toTr && toTr !== '—') putParts.push('Door —');
      putParts.push(`Trl ${toTr}`);
      putParts.push(toSlot);
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
          <span class="loadout-work-put"><strong>Put</strong> ${escapeHtml(putParts.join(' · '))}</span>
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
          'No work list yet.<br/>Go to <strong>Dock → Plan</strong> and tap <strong>Build load plan (demo)</strong>.';
      } else {
        msg =
          'Nothing on this trailer yet.<br/>Log freight with this trailer number, or go to <strong>Dock → Plan</strong> and build a plan.';
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
            : formatPieceSizeFull(e);
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
          : formatPieceSizeFull(e);
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


  // ---------- Ground deck-build orders + walkthrough demo ----------

  /** Local-only ground walkthrough cursor (done marks still in localStorage). */
  let groundDemo = {
    seeded: false,
    /** @type {string|null} current order id when demo is active */
    currentId: null,
  };

  function resetGroundDemoCursor() {
    groundDemo = { seeded: false, currentId: null };
  }

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

  /**
   * First undone order id in Tetris list order, or null if all done / empty.
   * @param {object[]} orders
   * @param {string} fp
   * @returns {string|null}
   */
  function firstUndoneGroundOrderId(orders, fp) {
    for (let i = 0; i < orders.length; i++) {
      if (!isGroundOrderDone(fp, orders[i].id)) return orders[i].id;
    }
    return null;
  }

  /**
   * @param {object[]} orders
   * @param {string|null} id
   * @returns {object|null}
   */
  function findGroundOrder(orders, id) {
    if (!id) return null;
    return orders.find((o) => o.id === id) || null;
  }

  function onGroundStartDemo() {
    const plan = DockStorage.readLoadPlan();
    if (!isPlanPresent(plan)) {
      toast('Build a load plan first (Dock → Plan)');
      return;
    }
    const orders =
      typeof DockLoadPlan !== 'undefined' && DockLoadPlan.deriveGroundOrders
        ? DockLoadPlan.deriveGroundOrders(plan)
        : [];
    if (!orders.length) {
      resetGroundDemoCursor();
      toast('No decks this plan — city/floor-only');
      renderGround();
      return;
    }
    const fp = planFingerprint(plan);
    clearGroundDone(fp);
    groundDemo = {
      seeded: true,
      currentId: orders[0].id,
    };
    toast(`Ground demo — ${orders.length} deck build${orders.length === 1 ? '' : 's'}`);
    renderGround();
  }

  function onGroundStepDemo() {
    const plan = DockStorage.readLoadPlan();
    if (!isPlanPresent(plan)) {
      toast('Build a load plan first (Dock → Plan)');
      return;
    }
    const orders =
      typeof DockLoadPlan !== 'undefined' && DockLoadPlan.deriveGroundOrders
        ? DockLoadPlan.deriveGroundOrders(plan)
        : [];
    if (!orders.length) {
      toast('No decks this plan — city/floor-only');
      renderGround();
      return;
    }
    const fp = planFingerprint(plan);
    if (!groundDemo.seeded) {
      groundDemo = {
        seeded: true,
        currentId: firstUndoneGroundOrderId(orders, fp) || orders[0].id,
      };
      renderGround();
      toast('Ground demo ready — tap Step again to mark done');
      return;
    }
    let curId = groundDemo.currentId || firstUndoneGroundOrderId(orders, fp);
    if (!curId || !findGroundOrder(orders, curId)) {
      curId = firstUndoneGroundOrderId(orders, fp);
    }
    if (!curId) {
      toast('All deck builds done — Reset to run again');
      renderGround();
      return;
    }
    setGroundOrderDone(fp, curId, true);
    const nextId = firstUndoneGroundOrderId(orders, fp);
    groundDemo.currentId = nextId;
    if (!nextId) {
      toast('Ground decks complete');
    }
    renderGround();
  }

  function onGroundResetDemo() {
    const plan = DockStorage.readLoadPlan();
    if (!isPlanPresent(plan)) {
      resetGroundDemoCursor();
      toast('No plan to reset — build a load plan first');
      renderGround();
      return;
    }
    const fp = planFingerprint(plan);
    clearGroundDone(fp);
    const orders =
      typeof DockLoadPlan !== 'undefined' && DockLoadPlan.deriveGroundOrders
        ? DockLoadPlan.deriveGroundOrders(plan)
        : [];
    if (!orders.length) {
      resetGroundDemoCursor();
      toast('No decks this plan — city/floor-only');
      renderGround();
      return;
    }
    groundDemo = { seeded: true, currentId: orders[0].id };
    toast('Ground demo reset');
    renderGround();
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
        if (groundDemo.seeded) {
          const orders =
            typeof DockLoadPlan !== 'undefined' && DockLoadPlan.deriveGroundOrders
              ? DockLoadPlan.deriveGroundOrders(plan)
              : [];
          groundDemo.currentId = orders.length ? orders[0].id : null;
        }
        renderGround();
        toast('Cleared ground done marks');
      });
    }
    if (el.groundStartDemoBtn) {
      el.groundStartDemoBtn.addEventListener('click', () => onGroundStartDemo());
    }
    if (el.groundStepBtn) {
      el.groundStepBtn.addEventListener('click', () => onGroundStepDemo());
    }
    if (el.groundResetDemoBtn) {
      el.groundResetDemoBtn.addEventListener('click', () => onGroundResetDemo());
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
        if (groundDemo.seeded) {
          const orders =
            typeof DockLoadPlan !== 'undefined' && DockLoadPlan.deriveGroundOrders
              ? DockLoadPlan.deriveGroundOrders(plan)
              : [];
          groundDemo.currentId = firstUndoneGroundOrderId(orders, fp);
        }
        renderGround();
      });
    }
  }

  /**
   * Big current-order card for ground walkthrough.
   * @param {object|null} order
   * @param {number} doneCount
   * @param {number} total
   */
  function renderGroundCurrentCard(order, doneCount, total) {
    if (!el.groundCurrentOrder) return;
    if (!order) {
      el.groundCurrentOrder.hidden = true;
      el.groundCurrentOrder.innerHTML = '';
      return;
    }
    el.groundCurrentOrder.hidden = false;
    const dest = order.destination
      ? ` → ${escapeHtml(order.destination)}`
      : '';
    el.groundCurrentOrder.innerHTML = `
      <div class="ground-current-kicker">Current deck build</div>
      <div class="ground-current-title">${escapeHtml(order.label)}</div>
      <div class="ground-current-out">OUT Trl ${escapeHtml(order.trailerNumber)}${dest} · Section ${escapeHtml(String(order.section))}</div>
      <div class="ground-current-detail">${escapeHtml(order.detail)}</div>
      <div class="ground-current-progress">Done ${doneCount} of ${total} deck builds</div>
    `;
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
          'Build a load plan on Plan first. Then come back here for deck-build orders.';
      }
      if (el.groundOrdersProgress) el.groundOrdersProgress.textContent = '';
      renderGroundCurrentCard(null, 0, 0);
      return;
    }

    if (!orders.length) {
      el.groundOrdersList.innerHTML =
        '<div class="empty-state">No decks this plan — city/floor-only.</div>';
      if (el.groundOrdersHint) {
        el.groundOrdersHint.textContent =
          'No decks this plan — city/floor-only. Floor (A) only — nothing for ground to build.';
      }
      if (el.groundOrdersProgress) el.groundOrdersProgress.textContent = 'Done 0 of 0 deck builds';
      renderGroundCurrentCard(null, 0, 0);
      resetGroundDemoCursor();
      return;
    }

    if (el.groundOrdersHint) {
      el.groundOrdersHint.textContent =
        'Ground sets decks so forklifts can load high-and-tight. Same plan as Crew. Tap Done or use Step.';
    }

    const fp = planFingerprint(plan);
    let doneCount = 0;
    orders.forEach((o) => {
      if (isGroundOrderDone(fp, o.id)) doneCount += 1;
    });

    // Keep cursor on first undone when seeded
    if (groundDemo.seeded) {
      const still = findGroundOrder(orders, groundDemo.currentId);
      if (!still || isGroundOrderDone(fp, groundDemo.currentId)) {
        groundDemo.currentId = firstUndoneGroundOrderId(orders, fp);
      }
    }
    const currentId = groundDemo.seeded
      ? groundDemo.currentId
      : firstUndoneGroundOrderId(orders, fp);
    const currentOrder = findGroundOrder(orders, currentId);
    renderGroundCurrentCard(
      groundDemo.seeded || doneCount < orders.length ? currentOrder : null,
      doneCount,
      orders.length
    );

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
        const isCurrent = !done && currentId === o.id;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className =
          'ground-order-step' +
          (done ? ' is-done' : '') +
          (isCurrent ? ' is-current' : '');
        btn.setAttribute('data-ground-id', o.id);
        btn.setAttribute('role', 'listitem');
        btn.setAttribute('aria-pressed', done ? 'true' : 'false');
        btn.innerHTML = `
          <div class="loadout-work-step-top">
            <span class="loadout-work-num">${globalNum}</span>
            <span class="loadout-work-check" aria-hidden="true">${done ? '✓' : isCurrent ? '▶' : ''}</span>
            <span class="loadout-work-pro">${escapeHtml(o.label)}</span>
          </div>
          <div class="ground-order-detail">${escapeHtml(o.detail)}</div>
          <div class="loadout-work-tap-hint">${done ? 'Done — tap to undo' : isCurrent ? 'Current — tap Done or Step' : 'Tap when deck is built'}</div>
        `;
        frag.appendChild(btn);
      });
    });

    el.groundOrdersList.innerHTML = '';
    el.groundOrdersList.appendChild(frag);
    if (el.groundOrdersProgress) {
      el.groundOrdersProgress.textContent = `Done ${doneCount} of ${orders.length} deck builds`;
    }
  }


  // ---------- Crew forklift board + live demo (boss demo) ----------

  /** @type {object[]} */
  let crewAssignmentsCache = [];

  /**
   * Resolve outbound (put) door for display — explicit door, else registry.
   * @param {{ door?: string, trailer?: string, destination?: string }} opts
   * @returns {string}
   */
  function resolvePutDoor(opts) {
    const o = opts || {};
    if (typeof DockStorage !== 'undefined' && DockStorage.outboundDoorFor) {
      return DockStorage.outboundDoorFor({
        door: o.door || '',
        trailerNumber: o.trailer || '',
        destination: o.destination || '',
      });
    }
    return String(o.door || '').trim();
  }

  /**
   * Plain-English detail for a selected operator (tap target).
   * @param {object} a assignment
   * @returns {string} HTML
   */
  function formatCrewOpDetail(a) {
    if (a.idle) {
      return (
        `<div class="crew-op-detail-title">${escapeHtml(crewOpLabel(a.operator))}</div>` +
        `<div class="crew-op-detail-line"><span class="crew-op-detail-label">Status:</span> ${escapeHtml(a.parked ? 'Done for this run: every move that is left is already on another forklift' : 'Waiting: ' + (crewDemo.seeded ? crewWaitReason(a.operator) : 'no move ready'))}</div>`
      );
    }
    if (a.dropping) {
      return (
        `<div class="crew-op-detail-title">${escapeHtml(crewOpLabel(a.operator))}</div>` +
        `<div class="crew-op-detail-line"><span class="crew-op-detail-label">Status:</span> just dropped a piece at OUT ${escapeHtml(String(a.toDoor || '—'))}${a.toSlot ? ' (slot ' + escapeHtml(a.toSlot) + ')' : ''}, picked up at inbound door ${escapeHtml(String(a.pickedFrom || '—'))}</div>`
      );
    }
    const pullParts = [`Door ${a.fromDoor}`, `Trl ${a.fromTrailer || '—'}`];
    if (a.fromSlot) pullParts.push(a.fromSlot);
    const loadParts = [];
    const putDoor = resolvePutDoor({
      door: a.toDoor,
      trailer: a.toTrailer,
      destination: a.destination,
    });
    if (a.toTrailer) {
      loadParts.push(putDoor ? `Door ${putDoor}` : 'Door —');
      loadParts.push(`Trl ${a.toTrailer}`);
      if (a.destination) loadParts.push(a.destination);
    } else if (a.destination) {
      if (putDoor) loadParts.push(`Door ${putDoor}`);
      loadParts.push(`${a.destination} (no plan yet)`);
    } else {
      loadParts.push('No load assigned yet');
    }
    let html = `<div class="crew-op-detail-title">${escapeHtml(crewOpLabel(a.operator))}</div>`;
    html += `<div class="crew-op-detail-line"><span class="crew-op-detail-label">Pulling:</span> ${escapeHtml(pullParts.join(' · '))}</div>`;
    html += `<div class="crew-op-detail-line"><span class="crew-op-detail-label">Loading into:</span> ${escapeHtml(loadParts.join(' · '))}</div>`;
    // Load slot is the forklift’s put target — impossible to miss (equal/greater than pull slot)
    if (a.toSlot) {
      html += `<div class="crew-op-detail-load-slot" role="status"><span class="crew-load-slot-label">LOAD SLOT</span> <span class="crew-load-slot-value">${escapeHtml(a.toSlot)}</span></div>`;
    } else if (a.toTrailer) {
      html += `<div class="crew-op-detail-load-slot is-missing" role="status"><span class="crew-load-slot-label">LOAD SLOT</span> <span class="crew-load-slot-value">—</span></div>`;
    }
    if (a.fromSlot) {
      html += `<div class="crew-op-detail-pull-slot"><span class="crew-op-detail-label">Pull slot:</span> ${escapeHtml(a.fromSlot)}</div>`;
    }
    const meta = [];
    if (a.pro) meta.push(`PRO ${a.pro}`);
    if (a.pieceFraction) meta.push(`piece ${String(a.pieceFraction).replace('/', ' of ')}`);
    if (meta.length) {
      html += `<div class="crew-op-detail-meta">${escapeHtml(meta.join(' · '))}</div>`;
    }
    if (a.nextLine) {
      html += `<div class="crew-op-detail-next">${escapeHtml(a.nextLine)}</div>`;
    }
    return html;
  }

  function updateCrewSelectionUI() {
    const selected = state.crewSelectedOp;
    const a = crewAssignmentsCache.find((x) => x.operator === selected);
    const pullDoor = a && !a.idle && !a.dropping ? String(a.fromDoor || '').trim() : '';
    const outDoor = a && !a.idle ? String(a.toDoor || '').trim() : '';

    if (el.crewFloor) {
      el.crewFloor.querySelectorAll('.crew-op-marker').forEach((btn) => {
        const op = Number(btn.getAttribute('data-op'));
        btn.classList.toggle('is-selected', op === selected);
        btn.setAttribute('aria-pressed', op === selected ? 'true' : 'false');
      });
      el.crewFloor.querySelectorAll('.crew-door-cell[data-door]').forEach((cell) => {
        const d = cell.getAttribute('data-door') || '';
        cell.classList.toggle('is-op-selected', !!selected && !!pullDoor && d === pullDoor);
      });
      el.crewFloor.querySelectorAll('.crew-out-target[data-door]').forEach((chip) => {
        const d = chip.getAttribute('data-door') || '';
        const opHit = !!selected && !!outDoor && d === outDoor;
        const panelHit = !!state.crewOutDoor && d === String(state.crewOutDoor);
        chip.classList.toggle('is-op-selected', opHit);
        chip.classList.toggle('is-panel-open', panelHit);
        chip.setAttribute('aria-pressed', panelHit ? 'true' : 'false');
      });
    }
    if (el.crewBoardList) {
      el.crewBoardList.querySelectorAll('.crew-board-row[data-op]').forEach((row) => {
        const op = Number(row.getAttribute('data-op'));
        row.classList.toggle('is-selected', op === selected);
      });
    }
    if (el.crewOpDetail) {
      if (a) {
        el.crewOpDetail.hidden = false;
        el.crewOpDetail.innerHTML = formatCrewOpDetail(a);
      } else {
        el.crewOpDetail.hidden = true;
        el.crewOpDetail.innerHTML = '';
      }
    }
  }

  /** Local-only live demo simulation (not persisted). */
  const CREW_DEMO_TARGET_OPS = 5;
  const CREW_DEMO_SOLO_OPS = 1;
  const CREW_DEMO_PLAY_MS = 450; // v50: one move per tick, ~45 s for a full dock

  /** Preferred start mode when Reset / Step auto-seed without an explicit button. */
  let crewDemoPreferredMode = 'crew'; // 'solo' | 'crew'

  /** @type {{
   *  seeded: boolean,
   *  mode: string,
   *  targetOps: number,
   *  queue: object[],
   *  active: object[],
   *  doneCount: number,
   *  total: number,
   *  playing: boolean,
   *  playTimer: any,
   *  nextStartSeq: number,
   * }} */
  let crewDemo = emptyCrewDemo();

  /** Dual-flash of pull+OUT doors on Step (~700ms, CSS only — no SVG arrows). */
  const CREW_FLASH_MS = 700;
  let crewFlashDoors = { from: '', to: '', timer: null };

  function flashCrewStepDoors(fromDoor, toDoor) {
    const from = String(fromDoor || '').trim();
    const to = String(toDoor || '').trim();
    if (crewFlashDoors.timer) {
      clearTimeout(crewFlashDoors.timer);
      crewFlashDoors.timer = null;
    }
    crewFlashDoors.from = from;
    crewFlashDoors.to = to;
    if (!from && !to) return;
    crewFlashDoors.timer = setTimeout(() => {
      crewFlashDoors.from = '';
      crewFlashDoors.to = '';
      crewFlashDoors.timer = null;
      if (el.crewFloor) {
        el.crewFloor.querySelectorAll('.is-flash').forEach((n) => n.classList.remove('is-flash'));
      }
    }, CREW_FLASH_MS);
  }


  // ---------- v50: sample crew names + sample clock (demo-only, labeled "sample") ----------
  const CREW_SAMPLE_NAMES = ['Sam', 'Maria', 'Luis', 'Dee', 'Ray', 'Kim', 'Jo', 'Ana'];
  /** Sample estimate: one forklift, pull → drop, in minutes (handling). Editable on the summary. */
  const CREW_MIN_PER_MOVE = 4;
  /** v51: extra travel minutes per door of distance between inbound door and OUT door. */
  const CREW_TRAVEL_MIN_PER_DOOR = 0.5;
  /** v51: at most this many forklifts pulling from one inbound door at once. */
  const CREW_MAX_PER_PULL_DOOR = 2;
  const CREW_MIN_PER_MOVE_KEY = 'dockApp.minPerMove.v1';
  const CREW_RATE_KEY = 'dockApp.laborRate.v1';

  function crewMinPerMoveSetting() {
    try {
      const v = Number(localStorage.getItem(CREW_MIN_PER_MOVE_KEY));
      if (Number.isFinite(v) && v >= 1 && v <= 30) return v;
    } catch (e) {
      /* ignore */
    }
    return CREW_MIN_PER_MOVE;
  }
  /** Sample shift start: 6:00 PM. */
  const CREW_SAMPLE_START_MIN = 18 * 60;
  /** Minutes of slack before each OUT trailer's sample departure (by door order). */
  const CREW_DEPART_SLACK_MIN = [30, 22, 10, 35, 18, 25, 25, 25];
  /** Less than this many minutes to spare = "tight". */
  const CREW_TIGHT_MARGIN_MIN = 15;

  function crewOpName(op) {
    const n = Number(op);
    if (!Number.isFinite(n) || n < 1) return '';
    return CREW_SAMPLE_NAMES[(n - 1) % CREW_SAMPLE_NAMES.length] || '';
  }

  function crewOpLabel(op) {
    // v54: one label everywhere, so names and map numbers match: "Sam (FL 1)"
    const name = crewOpName(op);
    return name ? name + ' (FL ' + op + ')' : 'Forklift ' + op;
  }

  /**
   * v54: ONE source of truth for a forklift's status (map, cards, notes).
   * pulling  = on its way with a piece (drawn at the inbound door it picks from)
   * dropping = just set its piece in the OUT trailer (drawn on that OUT door)
   * waiting  = free, but nothing it may take right now
   * done     = free, and every move that is left is already on another forklift
   */
  function crewOpStatus(a) {
    if (!a) return 'waiting';
    if (a.move) return 'pulling';
    if (a.justDone) return 'dropping';
    if (!crewDemo.queue.length) return 'done';
    return 'waiting';
  }

  /**
   * v53 ONE time rule: the clock shows the minute it is now (rounded down);
   * a "done at" time is the minute by which it is done (rounded up). So at
   * 7:30 on the clock a trailer that finishes at 7:30.4 still shows 42/43 and
   * its finish shows as 7:31 everywhere (card, panel, summary), and
   * spare = departure − done.
   */
  function formatClock(totalMin) {
    const m = Math.max(0, Math.floor((Number(totalMin) || 0) + 1e-6));
    const h24 = Math.floor(m / 60) % 24;
    const mm = m % 60;
    const ap = h24 >= 12 ? 'PM' : 'AM';
    let h = h24 % 12;
    if (h === 0) h = 12;
    return h + ':' + String(mm).padStart(2, '0') + ' ' + ap;
  }

  function formatDoneClock(totalMin) {
    return formatClock(Math.ceil((Number(totalMin) || 0) - 1e-6));
  }

  /** Minutes from the shown clock to a departure. */
  function minutesUntil(depart) {
    return Math.max(0, Math.round(Number(depart) - Math.floor(crewDemoClockMin() + 1e-6)));
  }

  function fmtLb(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    return Math.round(v).toLocaleString('en-US') + ' lb';
  }

  function emptyCrewDemo() {
    return {
      seeded: false,
      mode: 'crew',
      bossMode: false,
      targetOps: CREW_DEMO_TARGET_OPS,
      queue: [],
      active: [],
      doneCount: 0,
      total: 0,
      playing: false,
      playTimer: null,
      nextStartSeq: 0,
      // v50
      allMoves: [],
      lastEvent: null,
      pendingNotes: [],
      opMoveCount: {},
      opBusySteps: {},
      stepsTaken: 0,
      startMin: 18 * 60, // literal: emptyCrewDemo() runs before the v50 consts are declared
      departures: {},
      doorTotals: {},
      doorDoneAt: {},
      // v51: time-based sample clock (minutes)
      clock: 18 * 60,
      minPerMove: 4,
      opBusyMin: {},
      inIdx: {},
      outIdx: {},
      headless: false,
      maxPerPull: 0,
      lastFullCrewSeq: 0,
      // v53: who last worked each OUT trailer, why a forklift left one, and
      // the plain handoff line for the move where a different forklift took over
      doorLastOp: {},
      doorLeaveWhy: {},
      handoffByUid: {},
    };
  }

  // ---------- v45: Guided tour polish (edge dock · both ends lit · short copy) ----------
  // ---------- v48: Top-down trailer view (by deck · Floor/Deck 2/Deck 3 jump) ----------
  // ---------- v50: one card = one completed forklift move ("Move N of T") ----------

  const CREW_TOUR_PAUSE_KEY = 'dockApp.crewTourPause.v1';

  let crewTour = emptyCrewTour();

  function emptyCrewTour() {
    return {
      enabled: readCrewTourEnabled(),
      resumePlay: false,
      queue: [],
      active: null,
      lastShownSeq: 0,
      root: null,
      bubble: null,
      arrow: null,
      highlight: null,
      highlightOut: null,
      statusEl: null,
      textEl: null,
      leadEl: null,
      detailEl: null,
      whyEl: null,
      noteEl: null,
      counterEl: null,
      continueBtn: null,
      blocker: null,
      repositionBound: false,
      // v52: stop policy (see CREW_TOUR_MODES) + tap guards
      mode: 'every',
      shownAt: 0,
      handling: false,
      // v53: the one card that explains "front-heavy while part-loaded"
      frontHeavySeq: null,
    };
  }

  /**
   * v52: which moves get a tour stop. Today the boss demo stops at EVERY move.
   * A later "Quick tour" only needs a new entry here, e.g.
   *   quick: { label: 'Quick tour', isStop: (ev, demo) => KEY_STOPS.has(ev.seq) || ev.doorFinished }
   * advanceCrewTour() runs moves without a stop straight through to the next stop
   * (or to the summary), so the counter, trailer box and summary stay correct.
   */
  const CREW_TOUR_MODES = {
    // Quick tour (default): ~8 key moments picked from the real run (see
    // buildQuickTourStops); the moves in between fast-play on the map.
    quick: {
      label: 'Quick tour',
      isStop: (ev, demo) => Boolean(ev && demo && (demo.quickStops || []).some((s) => s.seq === ev.seq)),
    },
    every: { label: 'Every move', isStop: () => true },
  };

  /** Quick tour: ms per move while fast-playing between stops (visible on the map). */
  const CREW_QUICK_PLAY_MS = 300;

  function crewTourIsQuick() {
    return crewTour.mode === 'quick' && Boolean(crewDemo.quickStops && crewDemo.quickStops.length);
  }

  /** @returns {{seq:number,key:string,title:string}|null} the quick stop for this card */
  function quickStopFor(ev) {
    if (!crewTourIsQuick() || !ev) return null;
    const seq = ev.intro ? 0 : Number(ev.seq) || 0;
    return crewDemo.quickStops.find((s) => s.seq === seq) || null;
  }

  /**
   * v52 Quick tour: pick the key moments from the REAL fixed-seed run (never
   * invented). Each kind is the first matching move after the previous stop;
   * a kind that never happens is simply left out (the stop count follows).
   * @param {object[]} steps per-move facts recorded by simulateCrewRunHeadless
   * @param {object} departures door -> departure minute
   * @param {object} doorDoneAt door -> minute the trailer is fully loaded
   */
  function buildQuickTourStops(steps, departures, doorDoneAt) {
    const stops = [{ seq: 0, key: 'intro' }];
    if (!steps || !steps.length) return stops;
    const total = steps.length;
    let after = 0;
    // spread the stops over the run so the fast-play between them is visible
    const minAt = { heavy: 0.1, crew: 0.22, stack: 0.36, fragile: 0.36, tight: 0.5, finished: 0.5 };
    const take = (key, pred, extra) => {
      const floor = Math.round((minAt[key] || 0) * total);
      const s =
        steps.find((x) => x.seq > after && x.seq >= floor && x.seq < total && pred(x)) ||
        steps.find((x) => x.seq > after && x.seq < total && pred(x));
      if (!s) return null;
      stops.push(Object.assign({ seq: s.seq, key }, extra ? extra(s) : {}));
      after = s.seq;
      return s;
    };
    take('first', (x) => x.seq === 1);
    take('heavy', (x) => x.level === 'A' && x.section >= 2 && x.section <= 11 && !x.noStack && x.weight > PUP_END_LIGHT_MAX_LB_UI);
    take('crew', (x) => x.workingDoors >= Math.min(5, Object.keys(departures || {}).length || 5));
    const stack =
      take('stack', (x) => x.level === 'C' && Number.isFinite(x.belowW) && x.belowW >= x.weight) ||
      take('stack', (x) => x.level === 'B' && Number.isFinite(x.belowW) && x.belowW >= x.weight) ||
      take('fragile', (x) => x.noStack);
    void stack;
    const tightDoors = new Set(
      Object.keys(departures || {}).filter((d) => {
        const done = Number((doorDoneAt || {})[d]);
        const dep = Number(departures[d]);
        if (!Number.isFinite(done) || !Number.isFinite(dep)) return false;
        const spare = crewSpareMin(dep, done);
        return spare >= 0 && spare < CREW_TIGHT_MARGIN_MIN;
      })
    );
    take('tight', (x) => tightDoors.has(String(x.toDoor)));
    take('finished', (x) => x.doorFinished);
    stops.push({ seq: total, key: 'done' });
    return stops;
  }

  /** Title + extra line for a quick-tour stop, from the live state of that card. */
  function quickStopText(stop, ev) {
    const m = (ev && ev.move) || {};
    const d = String(m.toDoor || '');
    const outN = Object.keys(crewDemo.doorTotals || {}).length;
    const ops = crewDemo.active.length || CREW_DEMO_TARGET_OPS;
    switch (stop.key) {
      case 'intro':
        return { title: 'The dock: ' + ops + ' forklifts, ' + outN + ' outbound trailers', extra: crewMoveTimeRuleText() };
      case 'first':
        return { title: 'First move: from an inbound door into an exact slot', extra: 'Every piece gets an exact slot: section (1 = nose … 12 = tail), level (Floor, Deck 2, Deck 3) and side.' };
      case 'heavy':
        return { title: 'Heavy piece (over ' + fmtLb(PUP_END_LIGHT_MAX_LB_UI) + ') rides on the floor, between the axles', extra: 'Heavy = over ' + fmtLb(PUP_END_LIGHT_MAX_LB_UI) + '. It rides on the floor between the axles; the 4 ft nose and tail take light pieces only. Loading still runs nose to tail.' };
      case 'crew': {
        // v54: the heading matches the picture: who is at an inbound door, who just dropped
        const pulling = crewDemo.active.filter((a) => crewOpStatus(a) === 'pulling').length;
        const dropping = crewDemo.active.filter((a) => crewOpStatus(a) === 'dropping');
        const where = dropping.length
          ? crewOpLabel(dropping[0].operator) + ' just dropped at OUT ' + (dropping[0].justDone.toDoor || '?') + '; the other ' + pulling + ' are picking up at inbound doors. '
          : 'All ' + pulling + ' are picking up at inbound doors. ';
        return {
          title: 'All ' + ops + ' forklifts busy at once, each loading a different OUT trailer',
          extra: where + 'One forklift per trailer at a time (two would block the doorway); at most 2 per inbound door.',
        };
      }
      case 'stack':
        return { title: 'A deck stack: lighter piece on a heavier one', extra: 'Deck rule: Deck 2 and 3 sit on load bars. A deck piece is ' + fmtLb(DECK_PIECE_MAX_LB_UI) + ' or less, never heavier than the piece under it; stack under 100 in. Highlighted in the side view below.' };
      case 'fragile':
        return { title: 'Fragile piece: floor only, nothing stacked on top', extra: 'Fragile rule: floor only, and nothing is ever stacked on top of it.' };
      case 'tight': {
        const dep = (crewDemo.departures || {})[d];
        const done = ((crewDemo.fullRun && crewDemo.fullRun.doorDoneAt) || {})[d];
        const spare = Number.isFinite(dep) && Number.isFinite(done) ? crewSpareMin(dep, done) : null;
        return {
          title: spare != null && spare >= 0 ? 'A tight departure: OUT ' + d + ' (still on time)' : 'A late departure: OUT ' + d,
          extra:
            spare != null && spare >= 0 && Number.isFinite(done)
              ? 'Tight = on time, but under ' + CREW_TIGHT_MARGIN_MIN + ' min to spare. OUT ' + d + ': done ' + formatDoneClock(done) +
                ', leaves ' + formatClock(dep) + ' (' + spare + ' min spare). If anything slips, hold it a few minutes or start it earlier. ' +
                'Another forklift won\'t help: one per trailer at a time.'
              : 'Tight = under ' + CREW_TIGHT_MARGIN_MIN + ' min to spare. ' + tightAdvice(spare),
        };
      }
      case 'finished':
        return { title: 'OUT ' + d + ' is fully loaded: every piece on board', extra: '' };
      case 'done': {
        const legal = crewAllTrailersLegal();
        return {
          title: 'Dock done: all ' + outN + ' trailers loaded' + (legal ? ' and axle-legal' : ''),
          extra: legal ? 'Every axle under 20,000 lb and every 4 ft section under 3,200 lb. Continue for the summary.' : 'A trailer is over a limit: see the summary.',
        };
      }
      default:
        return { title: '', extra: '' };
    }
  }

  /**
   * v53: honest tight/late advice. Never two forklifts work one trailer at the
   * same time, so adding a forklift can't speed up this one trailer.
   */
  function tightAdvice(spare) {
    // v54: matches the summary. On time with a small margin = "leaves on time
    // with N min to spare"; only a trailer that really finishes after its
    // departure is called late.
    const noFork = 'Adding a forklift won\'t speed up this one trailer: never two forklifts in one trailer at the same time.';
    if (Number.isFinite(spare) && spare < 0) {
      return 'At this pace it leaves ' + Math.abs(spare) + ' min late: hold it ' + Math.abs(spare) + ' min, or start it earlier next shift. ' + noFork;
    }
    return (
      (Number.isFinite(spare) ? 'It still leaves on time, with ' + spare + ' min to spare. ' : '') +
      'If anything slips (a late inbound, a slow move), hold it a few minutes or start it earlier next shift. ' + noFork
    );
  }

  /** True when every outbound trailer in the plan is inside every weight limit. */
  function crewAllTrailersLegal() {
    const plan = DockStorage.readLoadPlan();
    const loads = (plan && plan.outboundLoadouts) || [];
    if (!loads.length) return false;
    return loads.every((L) => {
      const pieces = piecesForOutboundTrailer(L.trailerNumber);
      if (!pieces.length) return true;
      const w = computePupAxleWeights(pieces);
      return !(w.frontOver || w.rearOver || w.noseOver || w.tailOver);
    });
  }

  function crewTourIsStop(ev) {
    const mode = CREW_TOUR_MODES[crewTour.mode] || CREW_TOUR_MODES.every;
    return Boolean(ev && mode.isStop(ev, crewDemo));
  }

  /** v52: ignore taps that land within this many ms of a card appearing (double-tap guard). */
  const CREW_TOUR_TAP_GUARD_MS = 400;

  /**
   * v53: the 400 ms double-tap guard applies ONLY to Continue right after a
   * move card appears. The intro's Start, Skip to summary and Exit always take
   * the first tap (re-entry is still blocked).
   */
  function crewTourTapAllowed(timeGuard) {
    if (crewTour.handling) return false;
    if (!timeGuard) return true;
    const ev = crewTour.active;
    if (!ev || ev.intro) return true;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return now - (Number(crewTour.shownAt) || 0) >= CREW_TOUR_TAP_GUARD_MS;
  }

  /**
   * v53: a second tap of a fast double tap on Continue/Start must not land on
   * Skip / Play without stops. Only taps on the exact spot where Continue was,
   * within 400 ms, are ignored; any deliberate first tap elsewhere works.
   */
  function crewTourSpilloverTap(ev) {
    const r = crewTour.lastContRect;
    if (!r || !ev || !Number.isFinite(ev.clientX)) return false;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - (Number(crewTour.lastContAt) || 0) >= CREW_TOUR_TAP_GUARD_MS) return false;
    return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
  }

  /** Run a tour button action once, guarded against double taps and re-entry. */
  function crewTourGuardedAction(fn, timeGuard) {
    if (!crewTourTapAllowed(timeGuard)) return;
    crewTour.handling = true;
    try {
      fn();
    } catch (e) {
      console.error(e);
    } finally {
      crewTour.handling = false;
    }
  }

  // ---------- v52: tour progress survives a reload / re-open ----------
  const CREW_TOUR_PROGRESS_KEY = 'dockApp.tourProgress.v1';

  function saveCrewTourProgress(seq, done) {
    try {
      const plan = DockStorage.readLoadPlan();
      localStorage.setItem(
        CREW_TOUR_PROGRESS_KEY,
        JSON.stringify({
          seq: Number(seq) || 0,
          done: Boolean(done),
          mode: crewTour.mode,
          planAt: (plan && plan.createdAt) || '',
          total: crewDemo.total || 0,
          // v53: the front-heavy note is said once per tour, reloads included
          frontHeavySeq: crewTour.frontHeavySeq == null ? null : crewTour.frontHeavySeq,
        })
      );
    } catch (e) {
      /* ignore */
    }
  }

  function clearCrewTourProgress() {
    try {
      localStorage.removeItem(CREW_TOUR_PROGRESS_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function readCrewTourProgress() {
    try {
      return JSON.parse(localStorage.getItem(CREW_TOUR_PROGRESS_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  /**
   * v52: on page load, if a boss demo was in progress (sample data still
   * loaded), put the user back on the card they were on instead of the
   * landing page with no card. The demo is deterministic, so replaying the
   * same plan to move N gives exactly the same dock.
   * @returns {boolean} true if resumed
   */
  function resumeCrewTourAfterReload() {
    const prog = readCrewTourProgress();
    if (!prog || !hasDemoBackup()) return false;
    const plan = DockStorage.readLoadPlan();
    if (!plan || !plan.moves || !plan.moves.length) return false;
    if (prog.planAt && plan.createdAt && prog.planAt !== plan.createdAt) return false;
    setCrewTourEnabled(true, { skipPersist: true });
    const ok = seedCrewDemo(plan, { mode: 'crew', targetOps: CREW_DEMO_TARGET_OPS, bossMode: true });
    if (!ok) return false;
    crewTour.mode = CREW_TOUR_MODES[prog.mode] ? prog.mode : 'every';
    crewTour.frontHeavySeq = Number.isFinite(Number(prog.frontHeavySeq)) && prog.frontHeavySeq !== null ? Number(prog.frontHeavySeq) : null;
    const target = Math.max(0, Math.min(Number(prog.seq) || 0, crewDemo.total));
    crewDemo.headless = true;
    let guard = 0;
    while (crewDemo.doneCount < target && stepCrewDemo() && guard++ < 10000) {
      /* replay to the card the user was on */
    }
    crewDemo.headless = false;
    showView('dock');
    showDockSection('crew');
    if (prog.done || crewDemoAllDone()) {
      crewTour.lastShownSeq = crewDemo.doneCount;
      renderCrew();
      updateCrewDemoChrome();
      return true;
    }
    const ev = crewDemo.lastEvent;
    if (ev && ev.move && ev.move.toDoor) state.crewOutDoor = String(ev.move.toDoor);
    renderCrew();
    updateCrewDemoChrome();
    requestAnimationFrame(() => {
      if (!target || !ev) {
        showCrewTourIntro();
        return;
      }
      crewTour.lastShownSeq = target - 1;
      const idleNote = crewIdleStatusNote();
      const resumed = Object.assign({}, ev, {
        notes: ['Picked up where you left off (move ' + target + ') after the page reloaded.']
          .concat(ev.notes || [])
          .concat(idleNote && !(ev.notes || []).includes(idleNote) ? [idleNote] : []),
      });
      showCrewTourEvent(resumed);
    });
    return true;
  }

  function readCrewTourEnabled() {
    try {
      const raw = localStorage.getItem(CREW_TOUR_PAUSE_KEY);
      if (raw === null || raw === undefined || raw === '') return true;
      return raw === '1' || raw === 'true';
    } catch (e) {
      return true;
    }
  }

  function writeCrewTourEnabled(on) {
    try {
      localStorage.setItem(CREW_TOUR_PAUSE_KEY, on ? '1' : '0');
    } catch (e) {
      /* ignore */
    }
  }

  function setCrewTourEnabled(on, opts) {
    const enabled = Boolean(on);
    crewTour.enabled = enabled;
    if (!(opts && opts.skipPersist)) writeCrewTourEnabled(enabled);
    syncCrewTourToggleUi();
    if (!enabled) {
      dismissCrewTourPopup({ keepResume: false });
      crewTour.queue = [];
      crewTour.active = null;
    }
  }

  function resetCrewTourRun() {
    dismissCrewTourPopup({ keepResume: false });
    crewTour.queue = [];
    crewTour.active = null;
    crewTour.resumePlay = false;
    crewTour.lastShownSeq = 0;
    crewTour.frontHeavySeq = null;
    crewTour.phoneSlot = null;
    crewTour.enabled = readCrewTourEnabled();
    syncCrewTourToggleUi();
  }

  /**
   * v50: queue the newest COMPLETED move (one card per move). Idle / "finished
   * its doors" events are never cards — they ride along as a note.
   * @returns {number} how many events were added
   */
  function queueCrewTourNewActions() {
    if (!crewTour.enabled || !crewDemo.seeded) return 0;
    const ev = crewDemo.lastEvent;
    if (!ev || !ev.seq || ev.seq <= crewTour.lastShownSeq) return 0;
    if (crewTour.active && crewTour.active.seq === ev.seq) return 0;
    if (crewTour.queue.some((q) => q.seq === ev.seq)) return 0;
    crewTour.queue.push(ev);
    return 1;
  }

  function ensureCrewTourDom() {
    if (crewTour.root && document.body.contains(crewTour.root)) return;
    const root = document.createElement('div');
    root.id = 'crewTourRoot';
    root.className = 'crew-tour-root';
    root.hidden = true;
    root.setAttribute('hidden', '');
    root.innerHTML =
      '<div class="crew-tour-blocker" id="crewTourBlocker" aria-hidden="true"></div>' +
      '<div class="crew-tour-highlight" id="crewTourHighlight" aria-hidden="true"></div>' +
      '<div class="crew-tour-highlight crew-tour-highlight-out" id="crewTourHighlightOut" aria-hidden="true"></div>' +
      '<div class="crew-tour-bubble" id="crewTourBubble" role="dialog" aria-modal="false" aria-labelledby="crewTourLead">' +
      '<div class="crew-tour-arrow" id="crewTourArrow" aria-hidden="true"></div>' +
      '<div class="crew-tour-counter" id="crewTourCounter">Move 1 of 1</div>' +
      '<p class="crew-tour-stoptitle" id="crewTourStopTitle" hidden></p>' +
      '<p class="crew-tour-stopextra" id="crewTourStopExtra" hidden></p>' +
      '<div class="crew-tour-trailer" id="crewTourTrailer" aria-live="polite"></div>' +
      '<div class="crew-tour-status" id="crewTourStatus"></div>' +
      '<p class="crew-tour-lead" id="crewTourLead"></p>' +
      '<p class="crew-tour-detail" id="crewTourDetail"></p>' +
      '<p class="crew-tour-why" id="crewTourWhy"></p>' +
      '<p class="crew-tour-note" id="crewTourNote" hidden></p>' +
      '<div class="crew-tour-rules" id="crewTourRules" hidden></div>' +
      '<details class="crew-tour-more" id="crewTourMore" hidden><summary>More: all rules, timing and sample data</summary><div id="crewTourMoreBody"></div></details>' +
      '<div class="crew-tour-scrollcue" id="crewTourScrollCue" aria-hidden="true" hidden>more below ↓</div>' +
      '<div class="crew-tour-actions">' +
      '<button type="button" id="crewTourSkipBtn" class="btn muted-btn crew-tour-skip">Play without stops</button>' +
      '<button type="button" id="crewTourSummaryBtn" class="btn muted-btn crew-tour-tosummary">Skip to summary</button>' +
      '<button type="button" id="crewTourContinueBtn" class="btn accept-btn crew-tour-continue">Continue</button>' +
      '</div></div>';
    document.body.appendChild(root);
    crewTour.root = root;
    crewTour.blocker = root.querySelector('#crewTourBlocker');
    crewTour.highlight = root.querySelector('#crewTourHighlight');
    crewTour.highlightOut = root.querySelector('#crewTourHighlightOut');
    crewTour.bubble = root.querySelector('#crewTourBubble');
    crewTour.arrow = root.querySelector('#crewTourArrow');
    crewTour.statusEl = root.querySelector('#crewTourStatus');
    crewTour.counterEl = root.querySelector('#crewTourCounter');
    crewTour.leadEl = root.querySelector('#crewTourLead');
    crewTour.detailEl = root.querySelector('#crewTourDetail');
    crewTour.whyEl = root.querySelector('#crewTourWhy');
    crewTour.noteEl = root.querySelector('#crewTourNote');
    crewTour.trailerEl = root.querySelector('#crewTourTrailer');
    crewTour.moreEl = root.querySelector('#crewTourMore');
    crewTour.moreBodyEl = root.querySelector('#crewTourMoreBody');
    crewTour.rulesEl = root.querySelector('#crewTourRules');
    crewTour.scrollCue = root.querySelector('#crewTourScrollCue');
    if (crewTour.bubble) crewTour.bubble.addEventListener('scroll', () => updateCrewTourScrollCue(), { passive: true });
    crewTour.stopTitleEl = root.querySelector('#crewTourStopTitle');
    crewTour.stopExtraEl = root.querySelector('#crewTourStopExtra');
    crewTour.textEl = crewTour.leadEl;
    // v52 Quick tour: slim bar while the moves between stops play on the map
    const fast = document.createElement('div');
    fast.id = 'crewTourFastBar';
    fast.className = 'crew-tour-fastbar';
    fast.hidden = true;
    fast.setAttribute('role', 'status');
    fast.innerHTML =
      '<span class="crew-tour-fasttext" id="crewTourFastText"></span>' +
      '<button type="button" class="btn muted-btn crew-tour-fastskip" id="crewTourFastSkip">Skip to summary</button>';
    document.body.appendChild(fast);
    crewTour.fastBar = fast;
    crewTour.fastText = fast.querySelector('#crewTourFastText');
    ['click', 'pointerup', 'touchend'].forEach((type) => fast.addEventListener(type, (ev) => ev.stopPropagation()));
    const fastSkip = fast.querySelector('#crewTourFastSkip');
    if (fastSkip) fastSkip.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      // a second tap from the card's Continue button must not land here
      // (v53: only taps on the spot where Continue just was; any other first tap works)
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const r = crewTour.lastContRect;
      const onOldContinue = r && ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      if (onOldContinue && now - (Number(crewTour.fastShownAt) || 0) < 600) return;
      stopQuickFastPlay();
      onCrewTourSkipToSummary();
    });
    const toSummary = root.querySelector('#crewTourSummaryBtn');
    if (toSummary) toSummary.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (crewTourSpilloverTap(ev)) return;
      crewTourGuardedAction(onCrewTourSkipToSummary);
    });
    const cont = root.querySelector('#crewTourContinueBtn');
    const skip = root.querySelector('#crewTourSkipBtn');
    crewTour.continueBtn = cont;
    if (cont) cont.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      try {
        crewTour.lastContRect = cont.getBoundingClientRect();
        crewTour.lastContAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      } catch (e) {
        crewTour.lastContRect = null;
      }
      crewTourGuardedAction(onCrewTourContinue, true);
    });
    if (skip) skip.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (crewTourSpilloverTap(ev)) return;
      crewTourGuardedAction(onCrewTourSkip);
    });
    // v52: a tap never falls through the card to the page underneath
    if (crewTour.bubble) {
      ['click', 'pointerup', 'touchend'].forEach((type) => {
        crewTour.bubble.addEventListener(type, (ev) => ev.stopPropagation());
      });
    }
    // v49: blocker is pointer-events:none (visual dim only). Do not
    // preventDefault on pointerdown — that froze page + OUT panel scroll.
    if (crewTour.blocker) {
      crewTour.blocker.addEventListener('click', (ev) => {
        ev.stopPropagation();
      });
    }
    if (crewTour.bubble) {
      crewTour.bubble.addEventListener('click', (ev) => ev.stopPropagation());
    }
    if (!crewTour.repositionBound) {
      crewTour.repositionBound = true;
      window.addEventListener('resize', () => {
        if (crewTour.active) positionCrewTourBubble({ skipScroll: true });
      });
      window.addEventListener(
        'scroll',
        () => {
          if (crewTour.active) positionCrewTourBubble({ skipScroll: true });
        },
        true
      );
    }
  }

  /**
   * v50 slot parts from a move (section / level / lateral), slot label as fallback.
   * @param {object|null} move
   * @param {string} [slot]
   */
  function moveSlotParts(move, slot) {
    const raw = String(slot || (move && move.toSlot) || '').trim();
    const parts = raw.split('/');
    let section = move && move.toSection != null ? Number(move.toSection) : NaN;
    if (!Number.isFinite(section) && parts[0]) section = Number(parts[0]);
    const level = String((move && move.toLevel) || parts[1] || '').toUpperCase();
    const lateral = String((move && move.toLateral) || parts[2] || '');
    return { section, level, lateral, raw };
  }

  /** v51: light = 900 lb or less (same number the planner uses for the nose/tail). */
  const PUP_END_LIGHT_MAX_LB_UI =
    typeof DockLoadPlan !== 'undefined' && DockLoadPlan.PUP_END_LIGHT_MAX_LB ? DockLoadPlan.PUP_END_LIGHT_MAX_LB : 900;
  /** v54: per-piece deck limit (same number the planner uses). */
  const DECK_PIECE_MAX_LB_UI =
    typeof DockLoadPlan !== 'undefined' && DockLoadPlan.DECK_PIECE_MAX_LB ? DockLoadPlan.DECK_PIECE_MAX_LB : 1500;
  /** v54: the app's axle-balance rule: the heavier axle carries at most 25% more than the lighter. */
  const AXLE_BALANCE_RATIO = 1.25;

  /** v54: the demo's equipment, said the same way everywhere weights appear. */
  const EQUIP_SHORT = '48 ft trailer · 20,000 lb per axle';
  const EQUIP_LONG =
    'Demo trailer: 48 ft long, 12 sections of 4 ft. Weights are freight only, checked against 20,000 lb on the front (kingpin) ' +
    'and 20,000 lb on the rear axle: the federal single-axle limit, stricter than the 34,000 lb a tandem may carry. ' +
    'Other trailer types (pups, 53 ft, tandems) become a setting in the real version.';
  const WEIGHT_BASIS_TEXT =
    'Weight % = freight ÷ 40,000 lb: the two 20,000 lb axle checks added together, the most freight this demo lets one trailer carry (a demo setting).';

  /** v54: "Each move ≈ 4 min handling + 0.5 min per door of travel". */
  function crewMoveTimeRuleText() {
    const mpm = Number(crewDemo.minPerMove) || CREW_MIN_PER_MOVE;
    return (
      '1 move = one forklift trip carrying one piece. Each move ≈ ' + mpm + ' min handling + ' + CREW_TRAVEL_MIN_PER_DOOR +
      ' min per door of travel, rounded up to whole minutes (change it on the summary).'
    );
  }

  /** v54: biggest front/rear gap (%) on the finished trailers, from the plan. */
  function crewFinishedAxleGapPct() {
    const plan = DockStorage.readLoadPlan();
    const loads = (plan && plan.outboundLoadouts) || [];
    let worst = 0;
    loads.forEach((L) => {
      const pieces = piecesForOutboundTrailer(L.trailerNumber);
      if (!pieces.length) return;
      const w = computePupAxleWeights(pieces);
      const lo = Math.min(w.frontAxle, w.rearAxle);
      const hi = Math.max(w.frontAxle, w.rearAxle);
      if (lo > 0) worst = Math.max(worst, Math.round((hi / lo - 1) * 100));
    });
    return worst;
  }

  /** v51: Nose (sec 1) · Front (2–4) · Middle (5–8) · Rear (9–11) · Tail (12). */
  function sectionZoneName(section) {
    const s = Number(section);
    if (s === 1) return 'Nose';
    if (s >= 2 && s <= 4) return 'Front';
    if (s >= 5 && s <= 8) return 'Middle';
    if (s >= 9 && s <= 11) return 'Rear';
    if (s === 12) return 'Tail';
    return 'Middle';
  }

  /**
   * v51: one size format everywhere — "48×40 in pallet" (L×W in inches, longer side first).
   * @param {{w?:number, d?:number, kind?:string}} p
   */
  function formatPieceSize(p) {
    const w = Number(p && p.w);
    const d = Number(p && p.d);
    const kind = String((p && p.kind) || '').trim();
    if (!(Number.isFinite(w) && Number.isFinite(d) && w > 0 && d > 0)) return kind;
    const L = Math.max(w, d);
    const W = Math.min(w, d);
    return L + '×' + W + ' in' + (kind ? ' ' + kind : '');
  }

  /** v51: list format — "48×40 in pallet · 48 in tall" (same L×W style everywhere). */
  function formatPieceSizeFull(p) {
    const base = formatPieceSize(p) || '';
    const h = Number(p && p.h);
    const tall = Number.isFinite(h) && h > 0 ? h + ' in tall' : '';
    return [base, tall].filter(Boolean).join(' · ') || '—';
  }

  /**
   * Plain location from the ACTUAL slot: "Nose (sec 1) · Floor · Left",
   * "Middle (sec 3) · Deck 2 · Right", "Tail (sec 12) · Floor · Middle".
   * @param {string} slot
   * @param {object|null} move
   * @returns {string}
   */
  function describeLoadSlotShort(slot, move) {
    const p = moveSlotParts(move, slot);
    const bits = [];
    if (Number.isFinite(p.section)) {
      bits.push(sectionZoneName(p.section) + ' (sec ' + p.section + ')');
    }
    if (p.level) bits.push(deckLevelPlainName(p.level));
    if (p.lateral) bits.push(p.lateral);
    if (!bits.length) return p.raw;
    return bits.join(' · ');
  }

  /** Legacy helper name kept for any other callers. */
  function describeLoadSlotPlain(slot, move) {
    return describeLoadSlotShort(slot, move);
  }

  /** Piece total for a PRO = the "n" in its "k/n" fraction (one source of truth). */
  function pieceFractionParts(frac) {
    const mm = /^(\d+)\s*\/\s*(\d+)/.exec(String(frac || '').trim());
    if (!mm) return null;
    return { k: Number(mm[1]), n: Number(mm[2]) };
  }

  /**
   * One short facts line: "PRO 700105 · piece 3 of 8 · pallet 48×40 · 689 lb · from inbound door 2"
   * @param {object} move
   * @returns {string}
   */
  function describePieceDetail(move) {
    const m = move || {};
    const bits = [];
    // v53: no label numbers on boss cards; say where it is in this PRO's loading order
    const ordN = pieceLoadOrdinal(m);
    if (m.pro && ordN && ordN.n > 1) bits.push('piece ' + ordN.k + ' of ' + ordN.n + ' for PRO ' + m.pro + ' (loads in slot order)');
    else if (m.pro) bits.push('PRO ' + m.pro + (ordN && ordN.n === 1 ? ' (1 piece)' : ''));
    const size = formatPieceSize(m);
    if (size) bits.push(size);
    const wt = Number(m.weight);
    if (Number.isFinite(wt) && wt > 0) bits.push(fmtLb(wt));
    if (m.noStack) bits.push('FRAGILE, no stacking');
    if (m.fromDoor) bits.push('from IN door ' + m.fromDoor + (m.fromTrailer ? ' (Trl ' + m.fromTrailer + ')' : ''));
    return bits.join(' · ');
  }

  /**
   * v52: pieces of one PRO load in slot order (nose to tail), not piece-number
   * order. When they differ, say which of this PRO's pieces this is.
   */
  function pieceOrderNote(m, fp) {
    if (!crewDemo.seeded || !m || !m.pro) return '';
    const pending = new Set();
    crewDemo.queue.forEach((x) => pending.add(x.uid));
    crewDemo.active.forEach((a) => a && a.move && pending.add(a.move.uid));
    const same = (crewDemo.allMoves || []).filter(
      (x) => x.pro === m.pro && String(x.toTrailer || '') === String(m.toTrailer || '')
    );
    if (same.length < 2) return '';
    const doneN = same.filter((x) => !pending.has(x.uid)).length;
    if (!doneN || doneN === fp.k) return '';
    return '(loads ' + ordinalWord(doneN) + ' of ' + same.length + ', in slot order)';
  }

  /** v53: k-th of n pieces of this PRO on this trailer, in loading (slot) order. */
  function pieceLoadOrdinal(m) {
    if (!crewDemo.seeded || !m || !m.pro) return null;
    const same = (crewDemo.allMoves || []).filter(
      (x) => x.pro === m.pro && String(x.toTrailer || '') === String(m.toTrailer || '')
    );
    if (!same.length) return null;
    const pending = new Set();
    crewDemo.queue.forEach((x) => pending.add(x.uid));
    crewDemo.active.forEach((a) => a && a.move && pending.add(a.move.uid));
    const k = same.filter((x) => !pending.has(x.uid)).length;
    return { k: Math.max(1, Math.min(same.length, k)), n: same.length };
  }

  function ordinalWord(n) {
    const w = ['', '1st', '2nd', '3rd'];
    return w[n] || n + 'th';
  }

  /**
   * The piece directly under a deck move (planner stores it; fallback = look it up).
   * @param {object} move
   * @returns {{weight:number, pro?:string, pieceFraction?:string}|null}
   */
  function pieceUnderMove(move) {
    if (!move) return null;
    if (move.below && Number.isFinite(Number(move.below.weight))) return move.below;
    const p = moveSlotParts(move);
    if (p.level !== 'B' && p.level !== 'C') return null;
    const belowSlot = p.section + '/' + (p.level === 'B' ? 'A' : 'B') + '/' + p.lateral;
    const hit = (crewDemo.allMoves || []).find(
      (m) =>
        String(m.toTrailer || '') === String(move.toTrailer || '') &&
        String(m.toSlot || '') === belowSlot
    );
    return hit
      ? { weight: Number(hit.weight), pro: hit.pro, pieceFraction: hit.pieceFraction, h: hit.h, kind: hit.kind }
      : null;
  }

  /**
   * v50: ONE "why" line, built from the ACTUAL placement (section, level,
   * weight, piece underneath) — never a canned line that can contradict it.
   * @param {object|null} move
   * @returns {string}
   */
  function describeTourWhy(move) {
    if (!move) return '';
    const p = moveSlotParts(move);
    const wt = Number(move.weight);
    const wtTxt = Number.isFinite(wt) && wt > 0 ? fmtLb(wt) : 'this piece';
    const zone = sectionZoneName(p.section).toLowerCase();
    const onDeck = p.level === 'B' || p.level === 'C';
    if (move.noStack) {
      return (
        'Why here: fragile, so it rides on the floor and nothing is stacked on top. ' +
        'It fills the ' + zone + ' (sec ' + p.section + '), next in nose-to-tail order.'
      );
    }
    if (p.section === 1 || p.section === 12) {
      const where = p.section === 1 ? 'nose' : 'tail';
      const underEnd = onDeck ? pieceUnderMove(move) : null;
      const onTxt = underEnd && Number.isFinite(Number(underEnd.weight))
        ? ', stacked on a ' + fmtLb(underEnd.weight) + ' piece'
        : '';
      return (
        'Why here: light piece (' + wtTxt + onTxt + '; light = 900 lb or less). The ' + where +
        ' is only 4 ft, so it takes light pieces only, 3,200 lb total.'
      );
    }
    if (onDeck) {
      const under = pieceUnderMove(move);
      const deckName = p.level === 'B' ? 'Deck 2 (second level, on load bars above the floor piece)' : 'Deck 3 (third level, on load bars above Deck 2)';
      // v54: drums on a deck: the sample has no hazmat; real hazmat rules are coming
      const hazNote = /drum/i.test(String(move.kind || '')) ? ' The sample freight has no hazmat; real hazmat loading rules are coming in the real version.' : '';
      if (under && Number.isFinite(Number(under.weight))) {
        return (
          'Why here: ' + deckName + '. ' +
          wtTxt + ' sits on a ' + fmtLb(under.weight) + ' piece; a deck piece is ' + fmtLb(DECK_PIECE_MAX_LB_UI) + ' or less, never heavier than the piece under it, and the stack stays under 100 in (110 in inside roof height assumed).' + hazNote
        );
      }
      return 'Why here: ' + deckName + ', lighter than the piece under it.' + hazNote;
    }
    if (Number.isFinite(wt) && wt > PUP_END_LIGHT_MAX_LB_UI) {
      const r = typeof DockLoadPlan !== 'undefined' && DockLoadPlan.axleRearShare ? DockLoadPlan.axleRearShare(p.section) : NaN;
      let split = ', between the axles';
      if (Number.isFinite(r)) {
        const rp = Math.round(r * 100);
        if (rp >= 95) split = ', over the rear axle (the rear axle carries it)';
        else if (rp <= 5) split = ', at the front (the front axle carries it)';
        else split = ', between the axles: about ' + (100 - rp) + '% of its weight sits on the front axle and ' + rp + '% on the rear';
      }
      return (
        'Why here: heavy piece (' + wtTxt + ', over the 900 lb light limit) rides on the floor of the ' + zone + ' (sec ' + p.section + ')' + split +
        '. Lighter freight can stack on top. Each 4 ft section stays under 3,200 lb (company setting).'
      );
    }
    return (
      'Why here: next open floor spot, loading nose to tail. The ' + zone + ' (sec ' + p.section +
      ') fills floor first, then decks, keeping each 4 ft section under 3,200 lb (company setting).'
    );
  }

  /**
   * @param {object} ev
   * @returns {{ lead: string, detail: string, why: string, note: string }}
   */
  function describeCrewTourActionParts(ev) {
    if (ev && ev.intro) {
      const total = Number(crewDemo.total) || 0;
      const outN = Object.keys(crewDemo.doorTotals || {}).length;
      const ops = crewDemo.active.length || Number(crewDemo.targetOps) || 1;
      const inN = new Set((crewDemo.allMoves || []).map((m) => String(m.fromDoor || ''))).size;
      const saved = demoBackupSummary();
      const savedLine = saved.proCount
        ? ' Your own freight (' + saved.proCount + ' PRO' + (saved.proCount === 1 ? '' : 's') +
          ') is saved; tap Exit demo to bring it back.'
        : '';
      const li = (t) => '<li>' + escapeHtml(t) + '</li>';
      const gap = crewFinishedAxleGapPct();
      // v54: the key rules and how to read the map, shown open on the first card
      const rules =
        '<div class="ctr-sub">Key rules (the planner follows them on every move)</div><ul>' +
        li('Nose and tail (the first and last 4 ft section): light pieces only, ' + fmtLb(PUP_END_LIGHT_MAX_LB_UI) + ' or less ("light"; over that is "heavy"), and 3,200 lb max per section.') +
        li('Heavy pieces ride on the floor between the axles.') +
        li('Decks: Deck 2 and Deck 3 sit on load bars. A deck piece is ' + fmtLb(DECK_PIECE_MAX_LB_UI) + ' or less and never heavier than the piece under it. Stacks stay under 100 in (110 in inside height assumed).') +
        li('Fragile: floor only, nothing on top.') +
        li('Axles: 20,000 lb each (federal single-axle limit). Balanced = the heavier axle carries no more than 25% more than the lighter' + (gap ? '; all ' + outN + ' demo trailers finish within ' + gap + '%.' : '.')) +
        li('Forklifts: never two in one trailer at the same time; at most 2 pull from one inbound door; the forklift free longest takes the next move.') +
        '</ul>' +
        '<div class="ctr-sub">Reading the map</div><ul>' +
        li('Circles 1–5 are the forklifts, drawn where they are now: at an inbound door picking up, or on an OUT door right after a drop.') +
        li('"FL 3 coming" under an OUT door = forklift 3 is bringing that trailer\'s next piece. "Waiting" / "Done" = free forklifts.') +
        li('IN 81001 = the inbound trailer at that door. OUT chip = door, trailer, city, pieces loaded / total.') +
        '</ul>' +
        '<p class="ctr-equip">' + escapeHtml(EQUIP_LONG) + '</p>';
      return {
        lead:
          ops + ' forklift' + (ops === 1 ? '' : 's') + ' finish ' + outN + ' outbound trailers: ' + total +
          ' moves from ' + inN + ' inbound trailers.',
        detail:
          crewMoveTimeRuleText() + ' ' +
          'The "Trailer being loaded" box on each card is the trailer that just got a piece. Gray hatched freight was loaded by the earlier shift with this same planner.',
        why: '',
        note: savedLine.trim(),
        rules,
        more:
          '<ul>' +
          li('Whichever forklift is free first takes the next move; far doors take longer, so the order is not 1→5.') +
          li('Never two forklifts in one trailer at the same time: they would block each other in the trailer doorway. A different forklift can take over a trailer later, and the card says who and why. That is why some forklifts wait near the end.') +
          li('At most 2 forklifts pull from one inbound door.') +
          li('Loading goes nose to tail, all the way to the doors (every trailer ends full). Heavy pieces ride on the floor between the axles; the 4 ft nose and tail take light pieces only (900 lb or less). A part-loaded trailer is front-heavy because loading starts at the nose; it evens out as the rear fills.') +
          li('Each axle under 20,000 lb (federal single-axle limit). Each 4 ft section under 3,200 lb (company setting). ' + WEIGHT_BASIS_TEXT) +
          li('Levels: Floor (the trailer floor), Deck 2 (second level) and Deck 3 (third level); Deck 2 and Deck 3 sit on load bars; a deck piece is never heavier than the piece under it. Roof: 110 in inside height assumed; stacks stay under 100 in.') +
          li('A PRO\'s pieces load in slot order (nose to tail). The card says "piece 2 of 4 for PRO …" in loading order; the label numbers are on the Operator screen.') +
          li('Fragile pieces stay on the floor with nothing on top. Every piece is under the 5,000 lb forklift limit.') +
          li('Sample data: forklift names and departure times. For real: weights come from the bill of lading (scale weight when available); departure times are typed in or imported from your schedule (coming in the real version); drivers use the Operator screen, one move at a time.') +
          '</ul>',
      };
    }
    const m = (ev && ev.move) || {};
    const toDoor = m.toDoor || '—';
    const dest = String(m.destination || '').trim();
    const where = describeLoadSlotShort(m.toSlot, m);
    const lead =
      crewOpLabel(ev.op) + ' → OUT ' + toDoor + (dest ? ' ' + dest : '') +
      (where ? ': ' + where : '');
    const notes = (ev.notes || []).slice();
    const handoff = m.uid != null ? (crewDemo.handoffByUid || {})[m.uid] : '';
    if (handoff) notes.unshift(handoff);
    if (ev.doorFinished) {
      const counts = trailerCountsLine(toDoor);
      notes.unshift('OUT ' + toDoor + ' is fully loaded' + (counts ? ' — ' + counts : '') + '.');
    }
    const fh = frontHeavyNoteFor(ev, toDoor);
    if (fh) notes.push(fh);
    return {
      lead,
      detail: describePieceDetail(m),
      why: describeTourWhy(m),
      note: notes.join(' '),
    };
  }

  /**
   * v53: say ONCE per tour (on the first card where it shows) why a part-loaded
   * trailer is front-heavy, with the finished numbers for that trailer.
   */
  function frontHeavyNoteFor(ev, door) {
    if (!ev || ev.intro || !door || door === '—') return '';
    if (crewTour.frontHeavySeq != null && crewTour.frontHeavySeq !== ev.seq) return '';
    const info = resolveOutTrailerForDoor(door, crewAssignmentsCache);
    const pieces = piecesForOutboundTrailer(info.trailerNumber);
    if (!pieces.length) return '';
    const now = computePupAxleWeights(pieces.filter((p) => p.done));
    const full = computePupAxleWeights(pieces);
    const left = pieces.filter((p) => !p.done).length;
    if (!left || !(now.frontAxle > now.rearAxle * 1.25)) return '';
    crewTour.frontHeavySeq = ev.seq;
    return (
      'Why the front axle is heavier right now: loading starts at the nose, so a part-loaded trailer leans on the front axle. ' +
      'It evens out as the rear fills: when full, OUT ' + door + ' has ' + fmtLb(full.frontAxle) + ' front and ' + fmtLb(full.rearAxle) + ' rear.'
    );
  }

  /** @deprecated keep name for any stray callers — returns lead only */
  function describeCrewTourAction(ev) {
    return describeCrewTourActionParts(ev).lead;
  }

  /** Forklifts doing work right now (driving a move or dropping one). */
  function crewWorkingCount() {
    return crewDemo.active.filter((a) => a && (a.move || a.justDone)).length;
  }

  /** Doors (OUT) that still have moves in the queue or on a forklift. */
  function crewDoorsWithWork() {
    const set = new Set();
    crewDemo.queue.forEach((m) => set.add(String(m.toDoor || '')));
    crewDemo.active.forEach((a) => {
      if (a && a.move) set.add(String(a.move.toDoor || ''));
    });
    set.delete('');
    return set;
  }

  function crewRemainingForDoor(door) {
    const d = String(door || '');
    let n = 0;
    crewDemo.queue.forEach((m) => {
      if (String(m.toDoor || '') === d) n += 1;
    });
    crewDemo.active.forEach((a) => {
      if (a && a.move && String(a.move.toDoor || '') === d) n += 1;
    });
    return n;
  }

  /** v51 sample clock: the time the latest move finished (minutes after midnight). */
  function crewDemoClockMin() {
    return Number.isFinite(crewDemo.clock) ? crewDemo.clock : CREW_SAMPLE_START_MIN;
  }

  /**
   * v51: minutes for one move = handling (minutes per move) + travel
   * (0.5 min per door of distance from the inbound door to the OUT door).
   * @param {object} m
   */
  function moveDurationMin(m) {
    const base = Number(crewDemo.minPerMove) || CREW_MIN_PER_MOVE;
    const a = crewDemo.inIdx[String((m && m.fromDoor) || '')];
    const b = crewDemo.outIdx[String((m && m.toDoor) || '')];
    const dist = Number.isFinite(a) && Number.isFinite(b) ? Math.abs(a - b) : 0;
    // v53: whole minutes (travel rounded up), so every clock, "done" time and
    // spare number on the cards, map and summary is the same exact minute
    return Math.ceil(base + dist * CREW_TRAVEL_MIN_PER_DOOR - 1e-9);
  }

  /**
   * On pace / tight / late for one OUT trailer (sample).
   * est. done = now + moves left × 4 min × (open trailers ÷ forklifts, min 1)
   * @param {string} door
   */
  function crewPaceForDoor(door) {
    const d = String(door || '');
    const depart = (crewDemo.departures || {})[d];
    if (!crewDemo.seeded || !Number.isFinite(depart)) return null;
    const left = crewRemainingForDoor(d);
    const now = crewDemoClockMin();
    const doneAt = (crewDemo.doorDoneAt || {})[d];
    if (!left && Number.isFinite(doneAt)) {
      const spare = crewSpareMin(depart, doneAt);
      return {
        depart,
        eta: doneAt,
        left: 0,
        spare,
        status: spare >= 0 ? 'loaded' : 'late',
        label: 'loaded · ' + crewSpareText(spare, depart),
      };
    }
    // v52: the plan is deterministic, so the full-run finish time IS the estimate
    // (same number the summary shows). Fallback: sum of what's left at the door.
    const predicted = crewDemo.fullRun && crewDemo.fullRun.doorDoneAt ? crewDemo.fullRun.doorDoneAt[d] : NaN;
    if (Number.isFinite(predicted) && Number(crewDemo.fullRun.minPerMove || crewDemo.minPerMove) === Number(crewDemo.minPerMove)) {
      const eta = Math.max(now, predicted);
      const spare = crewSpareMin(depart, eta);
      const status = spare < 0 ? 'late' : spare < CREW_TIGHT_MARGIN_MIN ? 'tight' : 'on pace';
      return { depart, eta, left, spare, status, label: crewPaceWord(status) + ' · ' + crewSpareText(spare, depart) };
    }
    // One forklift per OUT door, so a door's moves happen one after another:
    // est. done = now + what's left of the move in progress + each queued move.
    let eta = now;
    crewDemo.active.forEach((a) => {
      if (a && a.move && String(a.move.toDoor || '') === d) {
        eta += Math.max(0, (Number(a.finishAt) || now) - now);
      }
    });
    crewDemo.queue.forEach((m) => {
      if (String(m.toDoor || '') === d) eta += moveDurationMin(m);
    });
    const spare = crewSpareMin(depart, eta);
    const status = spare < 0 ? 'late' : spare < CREW_TIGHT_MARGIN_MIN ? 'tight' : 'on pace';
    return { depart, eta, left, spare, status, label: crewPaceWord(status) + ' · ' + crewSpareText(spare, depart) };
  }

  /** v54: "tight" always says it is still on time (matches the summary's "on time"). */
  function crewPaceWord(status) {
    return status === 'tight' ? 'on time, tight' : status;
  }

  /**
   * Compact header line for the callout.
   * @param {object} ev
   * @returns {string}
   */
  /** v51: ONE line for "how many forklifts are working" (header, card, banner, list). */
  function crewWorkLine() {
    if (!crewDemo.seeded) return 'Not started · no forklifts moving';
    const crewSize = Math.max(1, crewDemo.active.length || Number(crewDemo.targetOps) || 1);
    if (crewDemoAllDone()) {
      return crewSize === 1 ? 'Done — the forklift finished' : 'Done — all ' + crewSize + ' finished';
    }
    const working = crewWorkingCount();
    const waiting = crewSize - working;
    return (
      (crewSize === 1 ? '1 forklift working' : working + ' of ' + crewSize + ' forklifts working') +
      (waiting > 0 ? ' · ' + waiting + ' waiting' : '')
    );
  }

  function crewTourStatusLine(ev) {
    if (!crewDemo.seeded) return '';
    const workBit = crewWorkLine();
    // v51: the trailer's leave time + pace live in the trailer box above, not here
    return workBit + ' · clock ' + formatClock(crewDemoClockMin()) + ' (sample)';
  }

  /**
   * v52: ONE wording for trailer counts everywhere (card note, trailer box, panel):
   * "this run: 20 of 20 moved · trailer: 36 pieces on board (16 loaded earlier)".
   * @param {string} door
   */
  function trailerCountsLine(door) {
    const info = resolveOutTrailerForDoor(String(door || ''), crewAssignmentsCache);
    const pieces = piecesForOutboundTrailer(info.trailerNumber);
    if (!pieces.length) return '';
    const pre = pieces.filter((p) => p.preloaded).length;
    const runTotal = pieces.length - pre;
    const runMoved = pieces.filter((p) => p.done && !p.preloaded).length;
    const onBoard = pieces.filter((p) => p.done).length;
    const board =
      onBoard >= pieces.length
        ? 'trailer: ' + onBoard + ' pieces on board'
        : 'trailer: ' + onBoard + ' of ' + pieces.length + ' pieces on board';
    const preTxt = pre ? ' (' + pre + ' loaded earlier)' : '';
    if (!crewDemo.seeded) return board + preTxt;
    return 'this run: ' + runMoved + ' of ' + runTotal + ' moved · ' + board + preTxt;
  }

  /** v52: ONE rounding for spare minutes everywhere (never overstates slack). */
  function crewSpareMin(depart, doneAt) {
    return Math.floor(Number(depart) - Number(doneAt) + 1e-6);
  }

  /** v52: "10 min spare before 7:40 PM departure" / "3 min late for 7:40 PM departure". */
  function crewSpareText(spare, depart) {
    return spare >= 0
      ? spare + ' min spare before ' + formatClock(depart) + ' departure'
      : Math.abs(spare) + ' min late for ' + formatClock(depart) + ' departure';
  }

  /**
   * v52: floor length used = nose to the last loaded 4 ft section.
   * @param {{slot:string}[]} pieces
   */
  function trailerFillInfo(pieces) {
    let maxSec = 0;
    (pieces || []).forEach((p) => {
      const parsed = parseSlotSectionLevel(p && p.slot);
      if (parsed && parsed.section > maxSec) maxSec = parsed.section;
    });
    const pct = Math.round((maxSec / 12) * 100);
    const openFt = (12 - maxSec) * 4;
    return {
      maxSec,
      pct,
      openFt,
      line:
        maxSec >= 12
          ? '100% of floor length (sections 1–12, nose to tail)'
          : pct + '% of floor length (sections 1–' + maxSec + ')',
    };
  }

  /**
   * v51: compact trailer box pinned inside the tour card, so the trailer
   * title, leave time and live weight check stay in view on a phone.
   * @param {string} door
   * @returns {string}
   */
  function buildTourTrailerStripHtml(door, opts) {
    const o = opts || {};
    const d = String(door || '').trim();
    if (!d) return '';
    const info = resolveOutTrailerForDoor(d, crewAssignmentsCache);
    const pieces = piecesForOutboundTrailer(info.trailerNumber);
    if (!pieces.length) return '';
    const loaded = pieces.filter((p) => p.done);
    const w = computePupAxleWeights(loaded);
    const pace = crewDemo.bossMode ? crewPaceForDoor(d) : null;
    const cells = [
      ['Front axle', w.frontAxle, PUP_AXLE_CAP_LB],
      ['Rear axle', w.rearAxle, PUP_AXLE_CAP_LB],
      ['Nose', w.nose, PUP_ZONE_MAX_LB],
      ['Tail', w.tail, PUP_ZONE_MAX_LB],
    ]
      .map(([label, v, cap]) => {
        const st = weightCellStatus(v, cap);
        // v53: units + the limit next to every value
        return (
          '<span class="cts-cell' + (st.cls ? ' ' + st.cls : '') + '"><span class="cts-label">' +
          escapeHtml(label) + '</span> <b>' + escapeHtml(Math.round(v).toLocaleString('en-US')) + '</b>' +
          '<span class="cts-cap"> / ' + escapeHtml(Math.round(cap).toLocaleString('en-US')) + ' lb</span>' +
          (st.tag ? ' <i>' + escapeHtml(st.tag) + '</i>' : '') + '</span>'
        );
      })
      .join('');
    const paceHtml = pace
      ? '<div class="cts-pace-line">' +
        (pace.left ? 'est. done ' + escapeHtml(formatDoneClock(pace.eta)) + ' · ' : 'loaded at ' + escapeHtml(formatDoneClock(pace.eta)) + ' · ') +
        '<span class="cts-pace is-' + escapeHtml(pace.status.replace(/\s+/g, '-')) + '">' +
        escapeHtml(pace.label) + '</span>' +
        (pace.left ? ' <span class="cts-from-now">(leaves in ' + minutesUntil(pace.depart) + ' min)</span>' : '') +
        '</div>'
      : '';
    // v53: balance line says only what is true right now
    // v54: with the real gap in %, against the app's one rule (balanced = within 25%)
    const left = pieces.length - loaded.length;
    const full = computePupAxleWeights(pieces);
    const gapPct = (a, b) => {
      const lo = Math.min(a, b);
      return lo > 0 ? Math.round((Math.max(a, b) / lo - 1) * 100) : null;
    };
    const fullGap = gapPct(full.frontAxle, full.rearAxle);
    let balance = '';
    if (left > 0 && w.frontAxle > w.rearAxle * AXLE_BALANCE_RATIO) {
      balance = 'Front-heavy for now (loading started at the nose) · when full: ' +
        Math.round(full.frontAxle).toLocaleString('en-US') + ' front / ' + Math.round(full.rearAxle).toLocaleString('en-US') + ' rear lb' +
        (fullGap != null ? ' (' + fullGap + '% apart; balanced = within 25%)' : '');
    } else if (w.frontAxle > 0 || w.rearAxle > 0) {
      const g = gapPct(w.frontAxle, w.rearAxle);
      if (g != null && g <= 25) {
        balance = (left > 0 ? 'Axles balanced now' : 'Axles balanced') + ': ' + (w.rearAxle > w.frontAxle ? 'rear' : 'front') + ' carries ' + g + '% more (balanced = within 25%)';
      } else {
        balance = (w.rearAxle > w.frontAxle ? 'Rear' : 'Front') + ' axle carries more right now' + (g != null ? ' (' + g + '% more)' : '');
      }
    }
    return (
      '<div class="cts-kicker">Trailer being loaded <span class="cts-equip">· ' + escapeHtml(EQUIP_SHORT) + '</span></div>' +
      '<div class="cts-head"><b>OUT ' + escapeHtml(d) + ' · Trl ' + escapeHtml(info.trailerNumber || '—') + ' · ' +
      escapeHtml(info.destination || '') + '</b></div>' +
      '<div class="cts-counts">' + escapeHtml(trailerCountsLine(d)) + '</div>' + paceHtml +
      buildMiniSideViewHtml(pieces) +
      '<div class="cts-cells" aria-label="Weight check, on board now, value / limit in lb">' + cells + '</div>' +
      (balance ? '<div class="cts-balance">' + escapeHtml(balance) + '</div>' : '') +
      (!o.noHint && pace && (pace.status === 'tight' || pace.status === 'late')
        ? '<div class="cts-hint">' +
          (pace.status === 'tight' ? 'Tight = under 15 min to spare. ' : 'Late = loading ends after departure. ') +
          escapeHtml(tightAdvice(pace.spare)) + '</div>'
        : '')
    );
  }

  /**
   * @param {number} op
   * @param {object|null} ev
   * @returns {HTMLElement|null}
   */
  function findCrewTourTarget(op, ev) {
    if (!el.crewFloor) return null;
    const marker = el.crewFloor.querySelector(
      '.crew-op-marker[data-op="' + String(op) + '"]'
    );
    if (marker) return marker;
    const door =
      (ev && ev.move && ev.move.fromDoor) ||
      (ev && ev.lastDoor) ||
      '';
    if (door) {
      const cell = el.crewFloor.querySelector(
        '.crew-door-cell[data-door="' + String(door) + '"]'
      );
      if (cell) return cell;
    }
    return el.crewFloor;
  }

  /**
   * OUT chip (or god-HUD pill) named in the action.
   * @param {object|null} ev
   * @returns {HTMLElement|null}
   */
  function findCrewTourOutTarget(ev) {
    const door =
      (ev && ev.move && ev.move.toDoor) ||
      '';
    const d = String(door || '').trim();
    if (!d) return null;
    if (el.crewFloor) {
      const chip = el.crewFloor.querySelector(
        '.crew-out-target[data-door="' + d + '"]'
      );
      if (chip) return chip;
    }
    if (el.crewGodOutPills) {
      const pill = el.crewGodOutPills.querySelector(
        '.crew-god-pill[data-door="' + d + '"]'
      );
      if (pill) return pill;
    }
    return null;
  }

  function clearCrewTourHighlightClass() {
    if (!el.crewFloor) return;
    el.crewFloor
      .querySelectorAll('.is-tour-target')
      .forEach((n) => n.classList.remove('is-tour-target'));
    if (el.crewGodOutPills) {
      el.crewGodOutPills
        .querySelectorAll('.is-tour-target')
        .forEach((n) => n.classList.remove('is-tour-target'));
    }
  }

  function placeHighlightRing(ringEl, target) {
    if (!ringEl) return;
    if (!target) {
      ringEl.style.display = 'none';
      return;
    }
    const hr = target.getBoundingClientRect();
    const ringPad = 6;
    ringEl.style.display = 'block';
    ringEl.style.left = Math.round(hr.left - ringPad) + 'px';
    ringEl.style.top = Math.round(hr.top - ringPad) + 'px';
    ringEl.style.width = Math.round(hr.width + ringPad * 2) + 'px';
    ringEl.style.height = Math.round(hr.height + ringPad * 2) + 'px';
  }

  function dismissCrewTourPopup(opts) {
    clearCrewTourHighlightClass();
    hideCrewMoveToken();
    if (crewTour.root) {
      crewTour.root.hidden = true;
      crewTour.root.setAttribute('hidden', '');
      crewTour.root.classList.remove('is-open');
    }
    if (crewTour.highlight) crewTour.highlight.style.display = 'none';
    if (crewTour.highlightOut) crewTour.highlightOut.style.display = 'none';
    crewTour.active = null;
    document.body.classList.remove('crew-tour-open');
    if (!(opts && opts.keepResume)) crewTour.resumePlay = false;
  }

  /** v50: wide screens dock the card beside the app column so the map stays visible. */
  function crewTourIsWide() {
    return (window.innerWidth || 0) >= 900;
  }

  /**
   * v50 scroll so the dock map sits fully ABOVE a bottom card (phone) or at
   * the top of the screen with the trailer panel under it (wide).
   */
  function scrollTourTargetsIntoView(primary, outTarget, dock, bubbleH) {
    const vh = window.innerHeight || 844;
    const map = el.crewDockMap;
    try {
      if (map) {
        const r = map.getBoundingClientRect();
        if (dock === 'side') {
          // v53: show the tap hint above the map whole (no half-cut line at the top)
          const hint = document.getElementById('crewMapTapHint');
          const hr = hint && !hint.hidden ? hint.getBoundingClientRect() : null;
          const useHint = hr && hr.height > 0 && r.top - hr.bottom < 40;
          window.scrollBy(0, Math.round(useHint ? hr.top - 4 : r.top - 12));
          return;
        }
        if (dock === 'bottom') {
          // v52: map pinned near the top of the screen, card under it
          const bandBottom = vh - (bubbleH || 0) - 10 - 4;
          if (r.height + 8 <= bandBottom) {
            window.scrollBy(0, Math.round(r.top - 8));
            return;
          }
        } else if (dock === 'top') {
          const bandTop = (bubbleH || 0) + 24;
          if (r.height <= vh - bandTop - 8) {
            window.scrollBy(0, Math.round(r.top - bandTop));
            return;
          }
        }
      }
      if (primary && typeof primary.scrollIntoView === 'function') {
        primary.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });
      }
      if (outTarget && outTarget !== primary) {
        const r2 = outTarget.getBoundingClientRect();
        const botSafe = dock === 'bottom' ? vh - (bubbleH || 0) - 16 : vh - 8;
        if (r2.top < 8 || r2.bottom > botSafe) {
          outTarget.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
        }
      }
    } catch (e) {
      /* ignore */
    }
  }

  function positionCrewTourBubble(opts) {
    if (!crewTour.active || !crewTour.bubble || !crewTour.arrow) return;
    const target = findCrewTourTarget(crewTour.active.op, crewTour.active);
    const outTarget = findCrewTourOutTarget(crewTour.active);
    if (!target) return;

    const pad = 10;
    const arrowSize = 10;
    const vw = window.innerWidth || 390;
    const vh = window.innerHeight || 844;
    const bubble = crewTour.bubble;
    const arrow = crewTour.arrow;
    const wide = crewTourIsWide();
    const appEl = document.getElementById('app');

    bubble.style.left = '0px';
    bubble.style.top = '0px';
    if (wide && appEl) {
      const ar0 = appEl.getBoundingClientRect();
      const room = vw - ar0.right - 28;
      const w = Math.max(260, Math.min(380, room));
      bubble.style.width = w + 'px';
      bubble.style.maxWidth = w + 'px';
    } else {
      bubble.style.width = '';
      bubble.style.maxWidth = Math.min(360, vw - pad * 2) + 'px';
    }
    // v53 phone: ONE fixed slot for every stop and every move: full width,
    // from the bottom edge of the dock map to the bottom of the screen. The map
    // is pinned to the top of the screen, so nothing of the page shows between
    // the map and the card (no half-hidden panel titles, no words cut in half).
    // Extra text scrolls inside the card; the buttons stay pinned at its bottom.
    if (!wide) {
      const side = 6;
      bubble.style.width = vw - side * 2 + 'px';
      bubble.style.maxWidth = vw - side * 2 + 'px';
      const map = el.crewDockMap;
      if (map && !(opts && opts.skipScroll)) {
        try {
          window.scrollBy(0, Math.round(map.getBoundingClientRect().top));
        } catch (e) {
          /* ignore */
        }
      }
      const mapH = map ? Math.round(map.getBoundingClientRect().height) : Math.round(vh * 0.45);
      // computed once per tour run and screen size: the map keeps one height
      // in the boss demo, so the card never moves
      const key = vw + 'x' + vh;
      if (!crewTour.phoneSlot || crewTour.phoneSlot.key !== key) {
        const top = Math.round(Math.min(mapH, vh * 0.55));
        crewTour.phoneSlot = { key, top, height: vh - top };
      }
      const slot = crewTour.phoneSlot;
      bubble.style.left = side + 'px';
      bubble.style.top = slot.top + 'px';
      bubble.style.height = slot.height + 'px';
      bubble.style.maxHeight = slot.height + 'px';
      bubble.setAttribute('data-place', 'bottom');
      bubble.setAttribute('data-dock', 'bottom');
      const tr0 = target.getBoundingClientRect();
      const bw0 = vw - side * 2;
      let arrowLeft = tr0.left + tr0.width / 2 - side - arrowSize;
      arrowLeft = Math.max(16, Math.min(arrowLeft, bw0 - 16 - arrowSize * 2));
      arrow.style.left = Math.round(arrowLeft) + 'px';
      arrow.style.top = '-' + arrowSize + 'px';
      arrow.style.bottom = 'auto';
      arrow.className = 'crew-tour-arrow is-above';
      placeHighlightRing(crewTour.highlight, target);
      placeHighlightRing(crewTour.highlightOut, outTarget);
      clearCrewTourHighlightClass();
      target.classList.add('is-tour-target');
      if (outTarget) outTarget.classList.add('is-tour-target');
      return;
    }
    // v53 wide: one fixed slot too (top 12, full height), buttons at its bottom
    bubble.style.height = vh - 24 + 'px';
    bubble.style.maxHeight = vh - 24 + 'px';
    const br = bubble.getBoundingClientRect();
    const bw = br.width || Math.min(340, vw - pad * 2);
    const bh = br.height || 160;

    // v52: one place per screen size for EVERY card (intro included): bottom on
    // phones, beside the map on wide screens. The card never jumps top<->bottom,
    // so a quick second tap can't land on the page underneath.
    let dock = 'bottom';
    if (wide) dock = 'side';

    if (!(opts && opts.skipScroll)) {
      scrollTourTargetsIntoView(target, outTarget, dock, bh);
    }

    const tr = target.getBoundingClientRect();
    let left;
    let top;
    if (dock === 'side') {
      const ar = appEl ? appEl.getBoundingClientRect() : { right: vw / 2 };
      left = Math.min(vw - bw - 12, ar.right + 18);
      // v53: ONE fixed top on wide screens too; a long card scrolls inside
      top = 12;
    } else {
      top = dock === 'bottom' ? vh - bh - pad : pad;
      top = Math.max(pad, Math.min(top, vh - bh - pad));
      left = tr.left + tr.width / 2 - bw / 2;
      left = Math.max(pad, Math.min(left, vw - bw - pad));
    }

    bubble.style.left = Math.round(left) + 'px';
    bubble.style.top = Math.round(top) + 'px';
    bubble.setAttribute('data-place', dock);
    bubble.setAttribute('data-dock', dock);

    if (dock === 'side') {
      // Arrow on the left edge, aimed at the forklift's height
      const cy = tr.top + tr.height / 2;
      let arrowTop = cy - top - arrowSize;
      arrowTop = Math.max(14, Math.min(arrowTop, bh - 14 - arrowSize * 2));
      arrow.style.left = '-' + arrowSize + 'px';
      arrow.style.top = Math.round(arrowTop) + 'px';
      arrow.style.bottom = 'auto';
      arrow.className = 'crew-tour-arrow is-left';
    } else {
      const targetCx = tr.left + tr.width / 2;
      let arrowLeft = targetCx - left - arrowSize;
      arrowLeft = Math.max(16, Math.min(arrowLeft, bw - 16 - arrowSize * 2));
      arrow.style.left = Math.round(arrowLeft) + 'px';
      if (dock === 'bottom') {
        arrow.style.top = '-' + arrowSize + 'px';
        arrow.style.bottom = 'auto';
        arrow.className = 'crew-tour-arrow is-above';
      } else {
        arrow.style.top = 'auto';
        arrow.style.bottom = '-' + arrowSize + 'px';
        arrow.className = 'crew-tour-arrow is-below';
      }
    }

    placeHighlightRing(crewTour.highlight, target);
    placeHighlightRing(crewTour.highlightOut, outTarget);

    clearCrewTourHighlightClass();
    target.classList.add('is-tour-target');
    if (outTarget) outTarget.classList.add('is-tour-target');
  }

  function showCrewTourEvent(ev) {
    ensureCrewTourDom();
    crewTour.active = ev;
    crewTour.shownAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (el.toast) el.toast.classList.add('hidden');
    if (crewDemo.bossMode) saveCrewTourProgress(ev && ev.intro ? 0 : (ev && ev.seq) || 0, false);
    if (ev.seq) crewTour.lastShownSeq = Math.max(crewTour.lastShownSeq, ev.seq);
    const total = Number(crewDemo.total) || 0;
    // v50 #6: the trailer panel always shows the trailer this move loads
    if (ev.move && ev.move.toDoor) {
      state.crewOutDoor = String(ev.move.toDoor);
      state.crewOutJustLoadedKey = crewOutPieceKey({
        pro: ev.move.pro,
        pieceFraction: ev.move.pieceFraction,
        slot: ev.move.toSlot,
      });
      renderCrewOutTrailerPanel();
      updateCrewSelectionUI();
    }
    const qStop = quickStopFor(ev);
    const qText = qStop ? quickStopText(qStop, ev) : null;
    if (crewTour.counterEl) {
      if (qStop) {
        const n = crewDemo.quickStops.indexOf(qStop) + 1;
        crewTour.counterEl.innerHTML =
          'Stop ' + n + ' of ' + crewDemo.quickStops.length +
          ' <span class="crew-tour-movecount">' + (ev.intro ? total + ' moves in all' : 'Move ' + ev.seq + ' of ' + total) + '</span>';
      } else {
        // v54: say the mode (Every move) on every card
        crewTour.counterEl.textContent = ev.intro
          ? 'Every move · ' + total + ' moves, one card each'
          : 'Every move · Move ' + ev.seq + ' of ' + total;
      }
    }
    if (crewTour.stopTitleEl) {
      crewTour.stopTitleEl.textContent = qText ? qText.title : '';
      crewTour.stopTitleEl.hidden = !(qText && qText.title);
    }
    if (crewTour.statusEl) {
      crewTour.statusEl.textContent = ev.intro
        ? qStop
          ? 'Tap Start: move 1 plays on the map, then the next card explains it. Between later stops the moves play on the map, about 3 a second.'
          : 'Tap Start to see move 1 play on the map.'
        : crewTourStatusLine(ev);
    }
    const parts = describeCrewTourActionParts(ev);
    if (qStop && ev.intro) {
      parts.detail =
        crewDemo.quickStops.length + ' stops = ' + crewDemo.quickStops.length + ' key moments; the ' + total +
        ' forklift moves in between play on the map. The "Trailer being loaded" box on each card is the trailer that just got a piece. ' +
        'Gray hatched freight was loaded by the earlier shift with this same planner.';
    }
    if (crewTour.stopExtraEl) {
      crewTour.stopExtraEl.textContent = qText && qText.extra ? qText.extra : '';
      crewTour.stopExtraEl.hidden = !(qText && qText.extra);
    }
    if (crewTour.trailerEl) {
      const stripDoor = ev.move && ev.move.toDoor ? String(ev.move.toDoor) : String(state.crewOutDoor || '');
      // v54: the tight stop says its advice once (in the blue box), not twice
      crewTour.trailerEl.innerHTML = stripDoor ? buildTourTrailerStripHtml(stripDoor, { noHint: Boolean(qStop && qStop.key === 'tight') }) : '';
      crewTour.trailerEl.hidden = !stripDoor;
    }
    if (crewTour.rulesEl) {
      crewTour.rulesEl.innerHTML = parts.rules || '';
      crewTour.rulesEl.hidden = !parts.rules;
    }
    if (crewTour.leadEl) crewTour.leadEl.textContent = parts.lead;
    if (crewTour.detailEl) {
      crewTour.detailEl.textContent = parts.detail || '';
      crewTour.detailEl.hidden = !parts.detail;
    }
    if (crewTour.whyEl) {
      crewTour.whyEl.textContent = parts.why || '';
      crewTour.whyEl.hidden = !parts.why;
    }
    if (crewTour.noteEl) {
      crewTour.noteEl.textContent = parts.note || '';
      crewTour.noteEl.hidden = !parts.note;
    }
    if (crewTour.moreEl) {
      crewTour.moreEl.hidden = !parts.more;
      crewTour.moreEl.open = false;
      if (crewTour.moreBodyEl) crewTour.moreBodyEl.innerHTML = parts.more || '';
    }
    if (crewTour.continueBtn) {
      crewTour.continueBtn.textContent = ev.intro
        ? 'Start'
        : ev.seq && ev.seq >= total
          ? 'Continue to summary'
          : 'Continue';
    }
    // v51: on the last move, Continue already goes to the summary
    const lastCard = Boolean(ev.seq && ev.seq >= total);
    const sumBtn = crewTour.root && crewTour.root.querySelector('#crewTourSummaryBtn');
    if (sumBtn) sumBtn.hidden = lastCard;
    const playBtn = crewTour.root && crewTour.root.querySelector('#crewTourSkipBtn');
    if (playBtn) playBtn.hidden = lastCard;
    crewTour.root.hidden = false;
    crewTour.root.removeAttribute('hidden');
    crewTour.root.classList.add('is-open');
    document.body.classList.add('crew-tour-open');
    if (crewTour.bubble) crewTour.bubble.scrollTop = 0;
    // v54: show that Continue is settling for the 400 ms double-tap guard
    // (instead of silently ignoring a tap), then it takes the next tap
    if (crewTour.continueBtn) {
      clearTimeout(crewTour.settleTimer);
      const settle = !ev.intro;
      crewTour.continueBtn.classList.toggle('is-settling', settle);
      if (settle) {
        crewTour.settleTimer = setTimeout(() => {
          if (crewTour.continueBtn) crewTour.continueBtn.classList.remove('is-settling');
        }, CREW_TOUR_TAP_GUARD_MS);
      }
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        positionCrewTourBubble();
        updateCrewTourScrollCue();
        // v54: the move plays on the map: the piece travels from the inbound door to the OUT door
        if (ev.move && !ev.intro) animateCrewMoveToken(ev.move, CREW_TOKEN_MS);
      });
    });
    setTimeout(() => {
      positionCrewTourBubble({ skipScroll: true });
      updateCrewTourScrollCue();
    }, 120);
  }

  /** v54: how long the piece takes to travel on the map on a card (ms). */
  const CREW_TOKEN_MS = 650;

  /** v54: "more below" cue when the card has more text than fits. */
  function updateCrewTourScrollCue() {
    const b = crewTour.bubble;
    const cue = crewTour.scrollCue;
    if (!b || !cue) return;
    const more = b.scrollHeight - b.clientHeight - b.scrollTop > 24;
    cue.hidden = !more;
  }

  /**
   * v54: a small piece token travels from the inbound door to the OUT door,
   * so each move visibly "plays on the map". Never blocks a tap: Continue
   * works during the animation (it just ends early).
   */
  function animateCrewMoveToken(move, ms) {
    try {
      if (!move || !el.crewFloor) return;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const from = el.crewFloor.querySelector('.crew-door-cell[data-door="' + String(move.fromDoor || '') + '"]');
      const to = el.crewFloor.querySelector('.crew-out-target[data-door="' + String(move.toDoor || '') + '"]');
      if (!from || !to) return;
      const fr = from.getBoundingClientRect();
      const tr = to.getBoundingClientRect();
      if (!fr.width || !tr.width) return;
      let tok = document.getElementById('crewMoveToken');
      if (!tok) {
        tok = document.createElement('div');
        tok.id = 'crewMoveToken';
        tok.className = 'crew-move-token';
        tok.setAttribute('aria-hidden', 'true');
        document.body.appendChild(tok);
      }
      const x0 = fr.left + fr.width / 2 - 9;
      const y0 = fr.top + Math.min(fr.height / 2, 40) - 9;
      const x1 = tr.left + tr.width / 2 - 9;
      const y1 = tr.top + tr.height / 2 - 9;
      tok.style.transition = 'none';
      tok.style.opacity = '1';
      tok.style.transform = 'translate(' + Math.round(x0) + 'px,' + Math.round(y0) + 'px)';
      tok.hidden = false;
      void tok.offsetWidth;
      tok.style.transition = 'transform ' + ms + 'ms ease-in-out, opacity 200ms ease ' + ms + 'ms';
      tok.style.transform = 'translate(' + Math.round(x1) + 'px,' + Math.round(y1) + 'px)';
      tok.style.opacity = '0';
      clearTimeout(crewTour.tokenTimer);
      crewTour.tokenTimer = setTimeout(() => {
        tok.hidden = true;
      }, ms + 260);
    } catch (e) {
      /* decoration only */
    }
  }

  function hideCrewMoveToken() {
    const tok = document.getElementById('crewMoveToken');
    if (tok) tok.hidden = true;
  }

  /** Intro card (not a move — no "Move N" number). */
  function showCrewTourIntro() {
    showCrewTourEvent({ intro: true, op: 1, seq: 0, move: null });
  }

  /**
   * Pause play and show the next queued tour popup (if any).
   * @returns {boolean} true if a popup is showing / will show
   */
  function pauseForCrewTourIfNeeded() {
    if (!crewTour.enabled) return false;
    queueCrewTourNewActions();
    if (!crewTour.queue.length && !crewTour.active) return false;
    if (crewDemo.playTimer) {
      clearInterval(crewDemo.playTimer);
      crewDemo.playTimer = null;
    }
    if (crewDemo.playing) {
      crewTour.resumePlay = true;
      crewDemo.playing = false;
    }
    if (!crewTour.active && crewTour.queue.length) {
      const next = crewTour.queue.shift();
      showCrewTourEvent(next);
    }
    updateCrewDemoChrome();
    return true;
  }

  /** Tour finished: close the card, show the boss summary. */
  function finishCrewTour() {
    dismissCrewTourPopup({ keepResume: false });
    if (crewDemo.bossMode && crewDemoAllDone()) saveCrewTourProgress(crewDemo.doneCount, true);
    stopCrewDemoPlay();
    renderCrew();
    updateCrewDemoChrome();
    scrollBossPayoffIntoView();
  }

  /** Do one forklift move and show its card (guided tour). */
  function advanceCrewTour() {
    if (!crewDemo.seeded) return;
    if (crewDemoAllDone()) {
      finishCrewTour();
      return;
    }
    // v52: run moves until the next stop (every move today; see CREW_TOUR_MODES)
    let moved = stepCrewDemo();
    let guard = 0;
    while (moved && !crewDemoAllDone() && !crewTourIsStop(crewDemo.lastEvent) && guard++ < 10000) {
      moved = stepCrewDemo();
    }
    if (moved && !crewTourIsStop(crewDemo.lastEvent)) crewTour.lastShownSeq = crewDemo.doneCount;
    renderCrew();
    queueCrewTourNewActions();
    if (crewTour.queue.length) {
      showCrewTourEvent(crewTour.queue.shift());
      updateCrewDemoChrome();
      return;
    }
    if (!moved || crewDemoAllDone()) finishCrewTour();
    else updateCrewDemoChrome();
  }

  function onCrewTourContinue() {
    dismissCrewTourPopup({ keepResume: true });
    if (crewTour.queue.length) {
      showCrewTourEvent(crewTour.queue.shift());
      updateCrewDemoChrome();
      return;
    }
    if (crewDemo.seeded && !crewDemoAllDone()) {
      if (crewTourIsQuick()) startQuickFastPlay();
      else advanceCrewTour();
      return;
    }
    finishCrewTour();
  }

  /** Quick tour: play the moves up to the next key stop at ~0.3 s each, then pause. */
  function startQuickFastPlay() {
    stopQuickFastPlay();
    const nextStop = crewDemo.quickStops.find((s) => s.seq > crewDemo.doneCount);
    const stopN = nextStop ? crewDemo.quickStops.indexOf(nextStop) + 1 : crewDemo.quickStops.length;
    const total = Number(crewDemo.total) || 0;
    const showBar = () => {
      if (!crewTour.fastBar) return;
      if (crewTour.fastBar.hidden) {
        crewTour.fastBar.hidden = false;
        crewTour.fastShownAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      }
      if (crewTour.fastText) {
        crewTour.fastText.textContent =
          '▶ Playing moves · Move ' + crewDemo.doneCount + ' of ' + total +
          ' · next: stop ' + stopN + ' of ' + crewDemo.quickStops.length;
      }
    };
    document.body.classList.add('crew-tour-fastplay');
    showBar();
    try {
      if (el.crewDockMap) el.crewDockMap.scrollIntoView({ behavior: 'auto', block: 'start' });
    } catch (e) {
      /* ignore */
    }
    crewDemo.quickTimer = setInterval(() => {
      if (crewTour.active) return;
      const moved = stepCrewDemo();
      const ev = crewDemo.lastEvent;
      const atStop = moved && crewTourIsStop(ev);
      if (moved && !atStop) crewTour.lastShownSeq = crewDemo.doneCount;
      renderCrew();
      if (moved && !atStop && ev && ev.move) animateCrewMoveToken(ev.move, Math.round(CREW_QUICK_PLAY_MS * 0.8));
      if (atStop) {
        stopQuickFastPlay();
        queueCrewTourNewActions();
        if (crewTour.queue.length) showCrewTourEvent(crewTour.queue.shift());
        updateCrewDemoChrome();
        return;
      }
      if (!moved || crewDemoAllDone()) {
        stopQuickFastPlay();
        finishCrewTour();
        return;
      }
      showBar();
      updateCrewDemoChrome();
    }, CREW_QUICK_PLAY_MS);
  }

  function stopQuickFastPlay() {
    if (crewDemo.quickTimer) {
      clearInterval(crewDemo.quickTimer);
      crewDemo.quickTimer = null;
    }
    if (crewTour.fastBar) crewTour.fastBar.hidden = true;
    document.body.classList.remove('crew-tour-fastplay');
  }

  /** v51: run every remaining move at once and jump to the boss summary. */
  function onCrewTourSkipToSummary() {
    crewTour.queue = [];
    dismissCrewTourPopup({ keepResume: false });
    stopCrewDemoPlay();
    let guard = 0;
    while (crewDemo.seeded && !crewDemoAllDone() && stepCrewDemo() && guard++ < 10000) {
      /* finish the dock */
    }
    crewTour.lastShownSeq = crewDemo.doneCount;
    finishCrewTour();
  }

  function onCrewTourSkip() {
    setCrewTourEnabled(false);
    crewTour.queue = [];
    dismissCrewTourPopup({ keepResume: false });
    toast('Playing without stops');
    if (crewDemo.seeded && !crewDemoAllDone()) {
      startCrewDemoPlay({ fromTourContinue: true });
    } else {
      finishCrewTour();
    }
  }

  function syncCrewTourToggleUi() {
    if (el.crewTourPauseToggle) {
      el.crewTourPauseToggle.checked = !!crewTour.enabled;
    }
  }

  /**
   * @param {'solo'|'crew'|string} [mode]
   * @returns {number}
   */
  function crewTargetOpsForMode(mode) {
    return mode === 'solo' ? CREW_DEMO_SOLO_OPS : CREW_DEMO_TARGET_OPS;
  }

  function stopCrewDemoPlay() {
    if (crewDemo.playTimer) {
      clearInterval(crewDemo.playTimer);
      crewDemo.playTimer = null;
    }
    crewDemo.playing = false;
    stopQuickFastPlay();
  }

  function resetCrewDemoState() {
    stopCrewDemoPlay();
    crewDemo = emptyCrewDemo();
    state.crewOutJustLoadedKey = null;
    resetCrewTourRun();
  }

  /**
   * Normalize plan moves for the live demo queue / map.
   * @param {object|null} plan
   * @returns {object[]}
   */
  function planMovesNormalized(plan) {
    const moves = plan && Array.isArray(plan.moves) ? plan.moves : [];
    return moves
      .map((m, i) => {
        const toTrailer = (m.to && m.to.trailer) || '';
        const destination = m.destination || '';
        const toDoor = resolvePutDoor({
          door: (m.to && m.to.door) || '',
          trailer: toTrailer,
          destination,
        });
        return {
          uid: `${m.entryId || 'm'}-${i}`,
          fromDoor: String((m.from && m.from.door) || '').trim(),
          fromTrailer: String((m.from && m.from.trailer) || '').trim(),
          fromSlot: String((m.from && m.from.slot) || '').trim(),
          toDoor: String(toDoor || '').trim(),
          toTrailer: String(toTrailer || '').trim(),
          toSlot: String((m.to && m.to.slot) || '').trim(),
          toSection: m.to && m.to.section != null ? m.to.section : null,
          toLevel: (m.to && m.to.level) || '',
          toLateral: (m.to && m.to.lateral) || '',
          below: (m.to && m.to.below) || null,
          destination: String(destination || '').trim(),
          pro: m.pro || '',
          pieceFraction: m.pieceFraction || '',
          entryId: m.entryId || '',
          weight: m.weight,
          h: m.h,
          w: m.w,
          d: m.d,
          kind: m.kind || '',
          noStack: Boolean(m.noStack),
        };
      })
      .filter((m) => m.fromDoor);
  }

  /**
   * Load destination key for demo collision checks (OUT door, else trailer).
   * @param {object} move
   * @returns {string}
   */
  function moveLoadKey(move) {
    if (!move) return '';
    const door = String(move.toDoor || '').trim();
    if (door) return `door:${door}`;
    const trailer = String(move.toTrailer || '').trim();
    if (trailer) return `trl:${trailer}`;
    return '';
  }

  /**
   * Round-robin queue by load key so consecutive free picks diversify OUT doors.
   * Per-door order (nose → tail, floor before deck) is preserved.
   * @param {object[]} moves
   * @returns {object[]}
   */
  function diversifyQueueByLoad(moves) {
    /** @type {Map<string, object[]>} */
    const buckets = new Map();
    const order = [];
    moves.forEach((m) => {
      const key = moveLoadKey(m) || '_none';
      if (!buckets.has(key)) {
        buckets.set(key, []);
        order.push(key);
      }
      buckets.get(key).push(m);
    });
    const out = [];
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (const key of order) {
        const bucket = buckets.get(key);
        if (bucket && bucket.length) {
          out.push(bucket.shift());
          progressed = true;
        }
      }
    }
    return out;
  }

  function busyPullDoors(exceptOp) {
    const doors = new Set();
    crewDemo.active.forEach((a) => {
      if (exceptOp != null && a.operator === exceptOp) return;
      if (a.move && a.move.fromDoor) {
        doors.add(String(a.move.fromDoor));
      }
    });
    return doors;
  }

  function busyLoadKeys(exceptOp) {
    const keys = new Set();
    crewDemo.active.forEach((a) => {
      if (exceptOp != null && a.operator === exceptOp) return;
      if (a.move) {
        const key = moveLoadKey(a.move);
        if (key) keys.add(key);
      }
    });
    return keys;
  }

  /**
   * v50 crew rule (plain code, no AI): a free forklift takes the NEXT move
   * (head of the line, so nose→tail and floor-before-deck order holds) of an
   * OUT door that no other forklift is working. Never two forklifts at one
   * OUT door. Preference: stay on the same OUT door → a door whose next pull
   * door is free → the door with the most moves left → lowest door number.
   * @param {number} op
   * @param {string} [preferDoor]
   * @returns {object|null}
   */
  function pickNextMoveForForklift(op, preferDoor) {
    const busyLoad = busyLoadKeys(op);
    const busyPull = busyPullDoors(op);
    // v51: how many forklifts are pulling from each inbound door right now
    /** @type {Map<string, number>} */
    const pullCount = new Map();
    crewDemo.active.forEach((a) => {
      if (a.operator === op || !a.move) return;
      const d = String(a.move.fromDoor || '');
      pullCount.set(d, (pullCount.get(d) || 0) + 1);
    });
    /** @type {Map<string, number>} */
    const heads = new Map();
    /** @type {Map<string, number>} */
    const counts = new Map();
    crewDemo.queue.forEach((m, i) => {
      const k = moveLoadKey(m) || 'uid:' + m.uid;
      counts.set(k, (counts.get(k) || 0) + 1);
      if (!heads.has(k)) heads.set(k, i);
    });
    const pref = String(preferDoor || '');
    let best = null;
    heads.forEach((idx, k) => {
      if (busyLoad.has(k)) return;
      const m = crewDemo.queue[idx];
      if ((pullCount.get(String(m.fromDoor || '')) || 0) >= CREW_MAX_PER_PULL_DOOR) return;
      const cand = {
        idx,
        same: pref && String(m.toDoor || '') === pref ? 1 : 0,
        pullFree: busyPull.has(String(m.fromDoor)) ? 0 : 1,
        n: counts.get(k) || 0,
        door: Number(m.toDoor) || 0,
      };
      if (
        !best ||
        cand.same > best.same ||
        (cand.same === best.same && cand.pullFree > best.pullFree) ||
        (cand.same === best.same && cand.pullFree === best.pullFree && cand.n > best.n) ||
        (cand.same === best.same && cand.pullFree === best.pullFree && cand.n === best.n && cand.door < best.door)
      ) {
        best = cand;
      }
    });
    if (!best) return null;
    return crewDemo.queue.splice(best.idx, 1)[0];
  }

  /**
   * v52: say why a forklift left a trailer — "finished" only when that trailer
   * truly has nothing left.
   */
  function describeDoorSwitch(op, prevDoor, nextDoor) {
    const who = crewOpLabel(op);
    const left = crewRemainingForDoor(prevDoor);
    if (left === 0) {
      return who + ' finished OUT ' + prevDoor + ' (every piece loaded) and moved to OUT ' + nextDoor + '.';
    }
    const taker = crewDemo.active.find(
      (x) => x && x.operator !== op && x.move && String(x.move.toDoor || '') === String(prevDoor)
    );
    const plural = left === 1 ? '' : 's';
    if (taker) {
      crewDemo.doorLeaveWhy[String(prevDoor)] = { op, why: (crewOpName(taker.operator) || crewOpLabel(taker.operator)) + ' was free first and took OUT ' + prevDoor };
      return who + ' moved to OUT ' + nextDoor + ': ' + crewOpLabel(taker.operator) + ' was free first and took over OUT ' + prevDoor +
        ' (' + left + ' move' + plural + ' left; never two forklifts in one trailer at the same time).';
    }
    const head = crewDemo.queue.find((x) => String(x.toDoor || '') === String(prevDoor));
    const why = head
      ? 'OUT ' + prevDoor + '\'s next piece is at inbound door ' + head.fromDoor + ', which already has 2 forklifts'
      : 'OUT ' + prevDoor + ' has no piece ready';
    crewDemo.doorLeaveWhy[String(prevDoor)] = { op, why };
    return who + ' moved to OUT ' + nextDoor + ' because ' + why + '. ' + who + ' handed OUT ' + prevDoor +
      ' to the next free forklift (' + left + ' move' + plural + ' left).';
  }

  /**
   * v53: when a different forklift takes over an OUT trailer, remember the
   * real reason (from the planner's state right now) so the card for that
   * forklift's first drop there can say it plainly.
   */
  function recordCrewHandoff(a, next) {
    const d = String((next && next.toDoor) || '');
    if (!d) return;
    const lastOp = crewDemo.doorLastOp[d];
    crewDemo.doorLastOp[d] = a.operator;
    if (lastOp == null || lastOp === a.operator) return;
    const prevA = crewDemo.active.find((x) => x && x.operator === lastOp);
    // v54: "Sam (FL 1)" labels, and the move after which the handoff happened,
    // so the story reads in order even when the card comes a few moves later
    const prevName = crewOpLabel(lastOp);
    const who = crewOpLabel(a.operator);
    const prevShort = crewOpName(lastOp) || prevName;
    const whoShort = crewOpName(a.operator) || who;
    const afterMove = crewDemo.doneCount;
    let reason;
    const leave = crewDemo.doorLeaveWhy[d];
    if (prevA && prevA.move && String(prevA.move.toDoor || '') !== d) {
      reason = prevShort + ' had been sent to OUT ' + prevA.move.toDoor + (leave && leave.op === lastOp ? ' (' + leave.why + ')' : '');
    } else if (prevA && prevA.justDone) {
      const longer = Number(a.freedAt) < Number(prevA.freedAt);
      reason = prevShort + ' had just dropped a piece there (move ' + afterMove + '), and ' + whoShort +
        (longer ? ' had been free longer' : ' was next in line') + ', so ' + whoShort + ' took the next OUT ' + d + ' move';
    } else {
      reason = prevShort + ' was waiting, and ' + whoShort + ' was free first';
    }
    crewDemo.handoffByUid[next.uid] =
      who + ' took over OUT ' + d + ' from ' + prevName + (afterMove ? ' right after move ' + afterMove : '') + ': ' + reason +
      '. Still never two forklifts in this trailer at the same time.';
  }

  /** @deprecated v49 name kept for stray callers */
  function takeNextNonConflicting() {
    return pickNextMoveForForklift(-1, '');
  }

  /**
   * Seed queue + give the first K forklifts a job on K different OUT doors.
   * Solo mode uses K=1; Crew (multi) uses CREW_DEMO_TARGET_OPS (5).
   * @param {object|null} [plan]
   * @param {{ mode?: string, targetOps?: number, bossMode?: boolean }} [opts]
   * @returns {boolean}
   */
  function seedCrewDemo(plan, opts) {
    const p = plan || DockStorage.readLoadPlan();
    const all = planMovesNormalized(p);
    stopCrewDemoPlay();
    if (!all.length) {
      resetCrewDemoState();
      return false;
    }

    const mode =
      (opts && opts.mode) ||
      crewDemo.mode ||
      crewDemoPreferredMode ||
      'crew';
    const targetOps = Math.max(
      1,
      Number(
        (opts && opts.targetOps) != null
          ? opts.targetOps
          : crewTargetOpsForMode(mode)
      ) || CREW_DEMO_TARGET_OPS
    );
    crewDemoPreferredMode = mode === 'solo' ? 'solo' : 'crew';

    resetCrewTourRun();
    initCrewDemoState(all, {
      mode,
      targetOps,
      bossMode: Boolean(opts && opts.bossMode) && mode !== 'solo',
      minPerMove: crewMinPerMoveSetting(),
    });
    state.crewOutJustLoadedKey = null;

    // v51: sample departures = when the full run finishes each trailer + slack
    // (one trailer gets little slack so "tight" shows up). Same plan → same times.
    const run = simulateCrewRunHeadless(all, { mode, targetOps, minPerMove: crewDemo.minPerMove });
    const doorIds = sortDoorIds(Object.keys(crewDemo.doorTotals));
    doorIds.forEach((d, i) => {
      const doneAt = Number.isFinite(run.doorDoneAt[d]) ? run.doorDoneAt[d] : run.end;
      const slack = CREW_DEPART_SLACK_MIN[i % CREW_DEPART_SLACK_MIN.length];
      crewDemo.departures[d] = Math.ceil((doneAt + slack) / 5) * 5;
    });
    crewDemo.fullRun = run;
    crewDemo.quickStops = crewDemo.bossMode ? buildQuickTourStops(run.steps, crewDemo.departures, run.doorDoneAt) : [];
    state.crewSelectedOp = mode === 'solo' ? 1 : null;
    return true;
  }

  /**
   * v51: build a fresh crew state from plan moves and give each forklift its
   * first job (pure demo state, no screen updates). Sets the global crewDemo.
   */
  function initCrewDemoState(all, opts) {
    const o = opts || {};
    const mode = o.mode === 'solo' ? 'solo' : 'crew';
    const targetOps = Math.max(1, Number(o.targetOps) || CREW_DEMO_TARGET_OPS);
    crewDemo = emptyCrewDemo();
    crewDemo.seeded = true;
    crewDemo.headless = Boolean(o.headless);
    crewDemo.mode = mode;
    crewDemo.bossMode = Boolean(o.bossMode);
    crewDemo.targetOps = targetOps;
    crewDemo.minPerMove = Number(o.minPerMove) || CREW_MIN_PER_MOVE;
    crewDemo.startMin = CREW_SAMPLE_START_MIN;
    crewDemo.clock = CREW_SAMPLE_START_MIN;
    crewDemo.queue = diversifyQueueByLoad(all.slice());
    crewDemo.allMoves = all.slice();
    crewDemo.total = all.length;
    /** @type {Record<string, number>} */
    const doorTotals = {};
    all.forEach((m) => {
      const d = String(m.toDoor || '');
      if (d) doorTotals[d] = (doorTotals[d] || 0) + 1;
    });
    crewDemo.doorTotals = doorTotals;
    sortDoorIds(Object.keys(doorTotals)).forEach((d, i) => {
      crewDemo.outIdx[d] = i;
    });
    sortDoorIds(Array.from(new Set(all.map((m) => String(m.fromDoor || ''))).values()).filter(Boolean)).forEach((d, i) => {
      crewDemo.inIdx[d] = i;
    });
    for (let op = 1; op <= targetOps; op++) {
      crewDemo.opMoveCount[op] = 0;
      crewDemo.opBusySteps[op] = 0;
      crewDemo.opBusyMin[op] = 0;
      const a = {
        operator: op, move: null, justDone: null, lastDoor: '', lastToDoor: '',
        startedAt: 0, finishAt: 0, freedAt: crewDemo.clock, idle: true,
      };
      crewDemo.active.push(a);
      const move = pickNextMoveForForklift(op, '');
      if (move) assignCrewMove(a, move);
    }
    // Drop forklifts that never got a job (fewer OUT doors than forklifts)
    crewDemo.active = crewDemo.active.filter((a, i) => a.move || i === 0);
    trackPullSpread();
    return crewDemo;
  }

  /** v51: a forklift starts a move now; it finishes after handling + travel. */
  function assignCrewMove(a, move) {
    const dur = moveDurationMin(move);
    a.move = move;
    a.idle = false;
    a.lastDoor = move.fromDoor;
    a.startedAt = crewDemo.nextStartSeq++;
    a.startMin = crewDemo.clock;
    a.finishAt = crewDemo.clock + dur;
    crewDemo.opBusyMin[a.operator] = (crewDemo.opBusyMin[a.operator] || 0) + dur;
  }

  /** v51: remember the most forklifts ever pulling from one inbound door at once. */
  function trackPullSpread() {
    /** @type {Record<string, number>} */
    const n = {};
    crewDemo.active.forEach((a) => {
      if (!a.move) return;
      const d = String(a.move.fromDoor || '');
      n[d] = (n[d] || 0) + 1;
    });
    Object.keys(n).forEach((d) => {
      if (n[d] > crewDemo.maxPerPull) crewDemo.maxPerPull = n[d];
    });
  }

  /**
   * v51: run the whole crew demo in memory (no screen) and report when each
   * OUT trailer finishes, total minutes, and moves / busy minutes per forklift.
   * Same plan + same settings → same answer every time.
   */
  function simulateCrewRunHeadless(all, opts) {
    const saved = crewDemo;
    try {
      initCrewDemoState(all, Object.assign({}, opts, { headless: true }));
      let guard = 0;
      const steps = [];
      while (stepCrewDemo() && guard++ < 10000) {
        // v52: facts per move, for the Quick tour's key moments
        const ev = crewDemo.lastEvent || {};
        const m = ev.move || {};
        const p = moveSlotParts(m);
        const doors = new Set(crewDemo.active.filter((a) => a.move).map((a) => String(a.move.toDoor || '')));
        if (m.toDoor) doors.add(String(m.toDoor));
        const below = p.level === 'B' || p.level === 'C' ? pieceUnderMove(m) : null;
        steps.push({
          seq: ev.seq,
          op: ev.op,
          toDoor: String(m.toDoor || ''),
          section: p.section,
          level: p.level,
          weight: Number(m.weight) || 0,
          noStack: Boolean(m.noStack),
          belowW: below ? Number(below.weight) : NaN,
          doorFinished: Boolean(ev.doorFinished),
          workingDoors: doors.size,
        });
      }
      return {
        steps,
        doorDoneAt: Object.assign({}, crewDemo.doorDoneAt),
        start: crewDemo.startMin,
        end: crewDemo.clock,
        minutes: crewDemo.clock - crewDemo.startMin,
        ops: crewDemo.active.length,
        opMoveCount: Object.assign({}, crewDemo.opMoveCount),
        opBusyMin: Object.assign({}, crewDemo.opBusyMin),
        maxPerPull: crewDemo.maxPerPull,
        lastFullCrewSeq: crewDemo.lastFullCrewSeq,
        total: crewDemo.total,
        minPerMove: crewDemo.minPerMove,
      };
    } finally {
      crewDemo = saved;
    }
  }

  function crewDemoAllDone() {
    if (!crewDemo.seeded || !crewDemo.total) return false;
    const anyBusy = crewDemo.active.some((a) => a.move);
    return crewDemo.doneCount >= crewDemo.total && !anyBusy && !crewDemo.queue.length;
  }

  /**
   * v50 step = exactly ONE completed move (so card N = move N = "Moved N").
   *   1. Free forklifts (just dropped, or waiting) take their next job.
   *      Changes (switched doors / nothing left) become a small note on the
   *      next card — never a card of their own.
   *   2. The forklift that started earliest drops its piece.
   * @returns {boolean} true if a move completed
   */
  /**
   * v52: the specific reason a free forklift has nothing to pick right now.
   * @param {number} op
   */
  /**
   * v54: every OUT trailer that still has moves left, counting BOTH the moves
   * in line and the move a forklift is carrying right now.
   * @returns {{door:string,left:number,op:number|null,head:object|null}[]}
   */
  function crewRemainingByDoor() {
    const map = new Map();
    const get = (d) => {
      if (!map.has(d)) map.set(d, { door: d, left: 0, op: null, head: null });
      return map.get(d);
    };
    crewDemo.active.forEach((a) => {
      if (!a || !a.move) return;
      const r = get(String(a.move.toDoor || ''));
      r.left += 1;
      r.op = a.operator;
    });
    crewDemo.queue.forEach((m) => {
      const r = get(String(m.toDoor || ''));
      r.left += 1;
      if (!r.head) r.head = m;
    });
    map.delete('');
    return Array.from(map.values()).sort((x, y) => Number(x.door) - Number(y.door));
  }

  function crewRemainingListText(rows) {
    return rows
      .map((r) => 'OUT ' + r.door + ': ' + r.left + ' left' + (r.op != null ? ', ' + crewOpLabel(r.op) + ' in it' : ''))
      .join('; ');
  }

  /** v54: why a free forklift has nothing to pick right now, from the live data. */
  function crewWaitReason(op) {
    const rows = crewRemainingByDoor();
    const pullCount = {};
    crewDemo.active.forEach((a) => {
      if (!a.move || a.operator === op) return;
      const f = String(a.move.fromDoor || '');
      pullCount[f] = (pullCount[f] || 0) + 1;
    });
    const open = rows.filter((r) => r.head && r.op == null);
    if (!open.length) {
      return 'every trailer with moves left already has a forklift in it (' + crewRemainingListText(rows) +
        '), and two forklifts in one trailer would block each other.';
    }
    // v54: checked against the live pull count, never assumed
    const ready = open.filter((r) => (pullCount[String(r.head.fromDoor || '')] || 0) < CREW_MAX_PER_PULL_DOOR);
    if (ready.length) {
      const list = ready.map((r) => 'OUT ' + r.door).join(', ');
      return 'work is handed out at the start of the next move: the next piece for ' + list + (ready.length === 1 ? ' is' : ' are') +
        ' ready, and the forklift that has been free longest takes ' + (ready.length === 1 ? 'it' : 'one') + '.';
    }
    const byIn = new Map();
    open.forEach((r) => {
      const f = String(r.head.fromDoor || '?');
      if (!byIn.has(f)) byIn.set(f, []);
      byIn.get(f).push('OUT ' + r.door);
    });
    const bits = [];
    byIn.forEach((outs, f) => {
      bits.push('the next piece for ' + outs.join(', ') + (outs.length === 1 ? ' is' : ' are all') + ' at IN door ' + f);
    });
    return bits.join('; ') + (byIn.size === 1 ? ', which already has' : ', and each of those doors already has') + ' 2 forklifts pulling from it (the most allowed).';
  }

  /**
   * v54: ONE status line for the forklifts that are not working, built from the
   * same state the map draws (Waiting / Done), right after this move.
   */
  function crewIdleStatusNote() {
    if (!crewDemo.seeded || crewDemoAllDone()) return '';
    const waiting = crewDemo.active.filter((a) => crewOpStatus(a) === 'waiting');
    const done = crewDemo.active.filter((a) => crewOpStatus(a) === 'done');
    const names = (list) => list.map((a) => crewOpLabel(a.operator)).join(', ');
    const parts = [];
    if (waiting.length) {
      const byReason = new Map();
      waiting.forEach((a) => {
        const r = crewWaitReason(a.operator);
        if (!byReason.has(r)) byReason.set(r, []);
        byReason.get(r).push(a);
      });
      byReason.forEach((list, r) => {
        parts.push('Waiting: ' + names(list) + ', because ' + r);
      });
    }
    if (done.length) {
      const rows = crewRemainingByDoor();
      parts.push(
        'Done for this run: ' + names(done) + '. Every move that is left is already on another forklift (' +
        crewRemainingListText(rows) + ').'
      );
    }
    return parts.join(' ');
  }

  function stepCrewDemo() {
    if (!crewDemo.seeded) return false;
    if (crewDemoAllDone()) {
      stopCrewDemoPlay();
      return false;
    }
    const notes = crewDemo.pendingNotes;
    // v51: free forklifts pick in the order they became free ("next forklift free")
    const freeOps = crewDemo.active
      .filter((a) => !a.move)
      .sort((x, y) => (Number(x.freedAt) || 0) - (Number(y.freedAt) || 0) || x.operator - y.operator);
    freeOps.forEach((a) => {
      if (a.move) return;
      const prev = a.justDone;
      const prevDoor = prev ? String(prev.toDoor || '') : String(a.lastToDoor || '');
      a.justDone = null;
      const next = pickNextMoveForForklift(a.operator, prevDoor);
      const who = crewOpLabel(a.operator);
      if (next) {
        const nextDoor = String(next.toDoor || '');
        if (a.idle && a.waitedNoted) {
          notes.push({ op: a.operator, kind: 'back', door: nextDoor, text: who + ' is back at work on OUT ' + nextDoor + '.' });
          if (prevDoor && nextDoor !== prevDoor) {
            crewDemo.doorLeaveWhy[prevDoor] = { op: a.operator, why: 'after waiting for a free inbound door, OUT ' + nextDoor + ' had the first move ready' };
          }
        } else if (prevDoor && nextDoor !== prevDoor) {
          notes.push({ op: a.operator, kind: 'switch', door: nextDoor, text: describeDoorSwitch(a.operator, prevDoor, nextDoor) });
        }
        recordCrewHandoff(a, next);
        assignCrewMove(a, next);
        a.waitedNoted = false;
      } else {
        a.idle = true;
        // v54: the Waiting / Done line is built after the drop from the same
        // state the map draws (see crewIdleStatusNote), never from here
        if (!a.waitedNoted && (prev || prevDoor)) a.waitedNoted = true;
      }
    });

    trackPullSpread();
    const busy = crewDemo.active.filter((a) => a.move);
    if (!busy.length) {
      stopCrewDemoPlay();
      return false;
    }
    if (busy.length >= crewDemo.active.length) crewDemo.lastFullCrewSeq = crewDemo.doneCount + 1;
    // v51: the forklift whose move finishes first (handling + travel) drops next
    busy.sort((a, b) => (a.finishAt - b.finishAt) || (a.startedAt - b.startedAt));
    const finisher = busy[0];
    const m = finisher.move;
    crewDemo.clock = Math.max(crewDemo.clock, Number(finisher.finishAt) || crewDemo.clock);
    finisher.freedAt = crewDemo.clock;
    crewDemo.active.forEach((a) => {
      if (a.move || a === finisher) {
        crewDemo.opBusySteps[a.operator] = (crewDemo.opBusySteps[a.operator] || 0) + 1;
      }
    });
    crewDemo.stepsTaken += 1;
    finisher.move = null;
    finisher.justDone = m;
    finisher.idle = false;
    finisher.lastDoor = m.fromDoor || finisher.lastDoor;
    finisher.lastToDoor = m.toDoor || '';
    crewDemo.doneCount += 1;
    crewDemo.opMoveCount[finisher.operator] = (crewDemo.opMoveCount[finisher.operator] || 0) + 1;
    if (!crewDemo.headless) flashCrewStepDoors(m.fromDoor || '', m.toDoor || '');
    const clock = crewDemoClockMin();
    const door = String(m.toDoor || '');
    const doorFinished = Boolean(door) && crewRemainingForDoor(door) === 0;
    if (doorFinished) crewDemo.doorDoneAt[door] = clock;
    // v52: notes only when true right now; nothing redundant on the card
    const lastMove = crewDemo.doneCount >= crewDemo.total;
    let evNotes = notes.splice(0).filter((n) => {
      if (!n || typeof n === 'string') return Boolean(n);
      // the lead already says this forklift is on this trailer
      if (n.kind === 'back' && n.op === finisher.operator) return false;
      if (lastMove && (n.kind === 'back' || n.kind === 'wait')) return false;
      return true;
    }).map((n) => (typeof n === 'string' ? n : n.text));
    if (lastMove) {
      const outN = Object.keys(crewDemo.doorTotals || {}).length;
      evNotes = ['Last move of the run: all ' + outN + ' outbound trailers are fully loaded.'];
    } else if (!crewDemo.headless) {
      const idleNote = crewIdleStatusNote();
      if (idleNote) evNotes.push(idleNote);
    }
    crewDemo.lastEvent = {
      seq: crewDemo.doneCount,
      op: finisher.operator,
      move: m,
      notes: evNotes,
      doorFinished,
      clock,
      fp: 'move:' + crewDemo.doneCount,
    };
    if (crewDemoAllDone()) stopCrewDemoPlay();
    return true;
  }

  function startCrewDemoPlay(opts) {
    const fromTour = Boolean(opts && opts.fromTourContinue);
    if (!crewDemo.seeded) {
      const mode = crewDemoPreferredMode === 'solo' ? 'solo' : 'crew';
      const ok = seedCrewDemo(null, { mode, targetOps: crewTargetOpsForMode(mode) });
      if (!ok) {
        toast('No plan yet. Tap Show boss demo.');
        return;
      }
      renderCrew();
    }
    if (crewDemoAllDone()) {
      toast('Dock already loaded — tap Watch again to rerun');
      return;
    }
    stopCrewDemoPlay();

    // Guided tour ON: one move per card (unless Play without stops turned it off)
    if (crewTour.enabled && !fromTour) {
      if (!crewTour.active) advanceCrewTour();
      updateCrewDemoChrome();
      return;
    }

    crewDemo.playing = true;
    crewDemo.playTimer = setInterval(() => {
      if (crewTour.enabled && crewTour.active) return; // frozen on a card
      const moved = stepCrewDemo();
      renderCrew();
      if (crewTour.enabled && pauseForCrewTourIfNeeded()) return;
      if (!moved || crewDemoAllDone()) {
        stopCrewDemoPlay();
        if (crewDemoAllDone()) {
          if (crewDemo.bossMode) saveCrewTourProgress(crewDemo.doneCount, true);
          renderCrew();
          scrollBossPayoffIntoView();
        }
      }
      updateCrewDemoChrome();
    }, CREW_DEMO_PLAY_MS);
    updateCrewDemoChrome();
  }

  /**
   * @param {'solo'|'crew'} mode
   */
  function onCrewStartDemo(mode) {
    const m = mode === 'solo' ? 'solo' : 'crew';
    clearCrewTourProgress(); // Solo / Crew(5) are not the tour: a reload must not jump back into it
    const plan = DockStorage.readLoadPlan();
    const ok = seedCrewDemo(plan, { mode: m, targetOps: crewTargetOpsForMode(m) });
    if (!ok) {
      toast('No plan yet. Tap Show boss demo.');
      renderCrew();
      return;
    }
    if (m === 'solo') {
      toast(`Solo forklift — 1 forklift · ${crewDemo.total} moves · tap Play`);
    } else {
      toast(`Crew demo — ${crewDemo.active.length} forklifts · ${crewDemo.total} moves · tap Play`);
    }
    renderCrew();
  }

  function onCrewStepOnce() {
    // While a tour callout is up, Step acts like Continue
    if (crewTour.enabled && crewTour.active) {
      onCrewTourContinue();
      return;
    }
    if (!crewDemo.seeded) {
      const mode = crewDemoPreferredMode === 'solo' ? 'solo' : 'crew';
      const ok = seedCrewDemo(null, { mode, targetOps: crewTargetOpsForMode(mode) });
      if (!ok) {
        toast('No plan yet. Tap Show boss demo.');
        return;
      }
      renderCrew();
      toast('Demo ready — tap Step once again to do move 1');
      return;
    }
    if (crewDemoAllDone()) {
      toast('Dock loaded — tap Watch again to rerun');
      renderCrew();
      return;
    }
    if (crewTour.enabled) {
      advanceCrewTour();
      return;
    }
    stepCrewDemo();
    renderCrew();
    if (crewDemoAllDone()) scrollBossPayoffIntoView();
  }

  function onCrewResetDemo() {
    const plan = DockStorage.readLoadPlan();
    const mode =
      crewDemo.mode ||
      (crewDemoPreferredMode === 'solo' ? 'solo' : 'crew');
    const boss = Boolean(crewDemo.bossMode);
    const ok = seedCrewDemo(plan, { mode, targetOps: crewTargetOpsForMode(mode), bossMode: boss });
    if (!ok) {
      resetCrewDemoState();
      toast('No plan yet. Tap Show boss demo.');
      renderCrew();
      return;
    }
    toast(mode === 'solo' ? 'Solo demo reset' : 'Crew demo reset');
    renderCrew();
  }

  function formatMoveQueueLine(m) {
    const pull = `Door ${m.fromDoor} · Trl ${m.fromTrailer || '—'}`;
    const putDoor = m.toDoor || '';
    const loadParts = [];
    if (m.toTrailer) {
      loadParts.push(putDoor ? `Door ${putDoor}` : 'Door —');
      loadParts.push(`Trl ${m.toTrailer}`);
      if (m.destination) loadParts.push(m.destination);
    } else if (m.destination) {
      if (putDoor) loadParts.push(`Door ${putDoor}`);
      loadParts.push(m.destination);
    } else {
      loadParts.push('—');
    }
    let line = `${pull} → ${loadParts.join(' · ')}`;
    if (m.pro) line += ` · PRO ${m.pro}`;
    if (m.pieceFraction) line += ` · ${m.pieceFraction}`;
    return line;
  }

  /**
   * Build assignment-shaped rows from live demo active forklifts.
   * @returns {object[]}
   */
  function assignmentsFromCrewDemo() {
    const allDone = crewDemoAllDone();
    return crewDemo.active.map((a) => {
      const m = a.move || a.justDone;
      const st = crewOpStatus(a);
      if (!m || allDone) {
        const isDone = allDone || st === 'done';
        return {
          operator: a.operator,
          fromDoor: '—',
          fromTrailer: '',
          fromSlot: '',
          toTrailer: '',
          toDoor: '',
          toSlot: '',
          destination: '',
          pro: '',
          pieceFraction: '',
          line: isDone
            ? `${crewOpLabel(a.operator)} — done for this run (${crewDemo.opMoveCount[a.operator] || 0} moves)`
            : `${crewOpLabel(a.operator)} — waiting: ${crewWaitReason(a.operator)}`,
          nextLine: '',
          idle: true,
          parked: isDone,
          status: isDone ? 'done' : 'waiting',
          demoMove: null,
        };
      }
      const dropping = !a.move && !!a.justDone;
      const putDoor = m.toDoor || '';
      const loadPhrase = m.toTrailer
        ? `${putDoor ? `Door ${putDoor}` : 'Door —'} · Trl ${m.toTrailer}` +
          (m.destination ? ` · ${m.destination}` : '') +
          (m.toSlot ? ` · LOAD ${m.toSlot}` : '')
        : m.destination || '—';
      return {
        operator: a.operator,
        // v54: a forklift that just dropped is drawn on its OUT door, not back at the inbound door
        fromDoor: dropping ? '' : m.fromDoor,
        pickedFrom: m.fromDoor,
        status: st,
        fromTrailer: m.fromTrailer,
        fromSlot: m.fromSlot,
        toTrailer: m.toTrailer,
        toDoor: putDoor,
        toSlot: m.toSlot,
        destination: m.destination,
        pro: m.pro,
        pieceFraction: m.pieceFraction,
        line: dropping
          ? `${crewOpLabel(a.operator)} — just loaded ${loadPhrase} (from Door ${m.fromDoor})`
          : `${crewOpLabel(a.operator)} — pulling Door ${m.fromDoor} · Trl ${m.fromTrailer || '—'} → loading ${loadPhrase}`,
        nextLine: '',
        idle: false,
        dropping,
        demoMove: m,
      };
    });
  }

  function updateCrewDemoChrome() {
    const solo = crewDemo.seeded && crewDemo.mode === 'solo';
    const boss = crewDemo.seeded && crewDemo.bossMode;
    if (el.crewSoloCopy) {
      el.crewSoloCopy.hidden = !solo;
      el.crewSoloCopy.textContent = solo
        ? 'One forklift — first pull to last put, high-and-tight.'
        : 'Solo = one forklift end-to-end · Crew (5) = five forklifts (tap Play).';
    }
    if (el.crewBossCopy) {
      el.crewBossCopy.hidden = !boss;
      el.crewBossCopy.textContent = boss
        ? 'Boss demo running — sample freight, 5 sample forklifts, never two forklifts in one trailer at the same time.'
        : 'Start here: sample freight, 5 forklifts, 8 key stops (or watch every move).';
    }
    if (el.crewExitDemoBtn) {
      const on = hasDemoBackup();
      el.crewExitDemoBtn.hidden = !on;
    }
    if (el.crewSoloStartBtn) {
      el.crewSoloStartBtn.classList.toggle('is-active-mode', solo || (!crewDemo.seeded && crewDemoPreferredMode === 'solo'));
    }
    if (el.crewMultiStartBtn) {
      const multi = crewDemo.seeded && crewDemo.mode !== 'solo' && !crewDemo.bossMode;
      el.crewMultiStartBtn.classList.toggle(
        'is-active-mode',
        multi || (!crewDemo.seeded && crewDemoPreferredMode !== 'solo')
      );
    }
    if (el.crewBossDemoBtn) {
      el.crewBossDemoBtn.classList.toggle('is-active-mode', boss);
    }
    // Boss: fold Step/Play/Stop/Reset; keep door-count closed
    if (el.crewDemoControlsDetails) {
      if (boss) el.crewDemoControlsDetails.open = false;
      else if (!crewDemo.seeded) el.crewDemoControlsDetails.open = false;
      else el.crewDemoControlsDetails.open = true;
    }
    if (el.crewDoorCountDetails && boss && !state.crewDoorCountUserOpen) {
      el.crewDoorCountDetails.open = false;
    }
    document.body.classList.toggle('crew-boss-mode', Boolean(boss));
    const crewPanel = document.getElementById('dockPanelCrew');
    if (crewPanel) crewPanel.classList.toggle('is-boss-mode', Boolean(boss));
    if (el.crewDemoProgress) {
      if (!crewDemo.seeded) {
        const plan = DockStorage.readLoadPlan();
        const n = plan ? planMovesNormalized(plan).length : 0;
        el.crewDemoProgress.textContent = n
          ? `Plan ready: ${n} moves · not started. Tap Show boss demo, or Crew (5) then Play.`
          : 'No plan yet. Tap Show boss demo.';
      } else {
        const modeLabel = solo ? 'Solo' : boss ? (crewTour.mode === 'every' ? 'Every move' : 'Quick tour') : 'Crew';
        const done = crewDemoAllDone();
        el.crewDemoProgress.textContent =
          `${modeLabel} · Move ${crewDemo.doneCount} of ${crewDemo.total}` +
          (done
            ? ' · all loaded'
            : crewDemo.playing
              ? ' · Playing…'
              : crewTour.enabled && crewTour.active
                ? ' · Paused on this move'
                : '');
      }
    }
    if (el.crewDemoDone) {
      const done = crewDemoAllDone();
      el.crewDemoDone.hidden = !done;
      if (done) {
        const sig = 'done:' + crewDemo.total + ':' + crewDemo.stepsTaken + ':' + hasDemoBackup();
        if (el.crewDemoDone.dataset.sig !== sig) {
          el.crewDemoDone.dataset.sig = sig;
          el.crewDemoDone.innerHTML = buildCrewBossSummaryHtml();
        }
      } else {
        el.crewDemoDone.dataset.sig = '';
        el.crewDemoDone.innerHTML = '';
      }
    }
    if (el.crewPlayBtn) {
      el.crewPlayBtn.textContent = crewDemo.playing ? 'Playing…' : 'Play';
      el.crewPlayBtn.disabled = crewDemo.playing;
    }
    syncCrewTourToggleUi();
    renderCrewSoloJobCard();
    updateDemoModeBar();
  }

  /**
   * Big current-job card for Solo forklift mode (always visible while seeded).
   */
  function renderCrewSoloJobCard() {
    if (!el.crewSoloJobCard) return;
    const solo = crewDemo.seeded && crewDemo.mode === 'solo';
    if (!solo) {
      el.crewSoloJobCard.hidden = true;
      el.crewSoloJobCard.innerHTML = '';
      return;
    }
    el.crewSoloJobCard.hidden = false;
    if (crewDemoAllDone()) {
      el.crewSoloJobCard.innerHTML = `
        <div class="crew-solo-kicker">Solo forklift</div>
        <div class="crew-solo-title">Dock loaded — Ready</div>
        <div class="crew-solo-progress">Move ${crewDemo.doneCount} of ${crewDemo.total}</div>
      `;
      return;
    }
    const active = crewDemo.active[0];
    const m = active && (active.move || active.justDone);
    const justDone = Boolean(active && !active.move && active.justDone);
    if (!m) {
      el.crewSoloJobCard.innerHTML = `
        <div class="crew-solo-kicker">Solo forklift</div>
        <div class="crew-solo-title">Ready — tap Step or Play</div>
        <div class="crew-solo-progress">Move ${crewDemo.doneCount} of ${crewDemo.total}</div>
      `;
      return;
    }
    const pull =
      `Door ${escapeHtml(m.fromDoor || '—')} · Trl ${escapeHtml(m.fromTrailer || '—')}` +
      (m.fromSlot ? ` · ${escapeHtml(m.fromSlot)}` : '');
    const loadSlot = m.toSlot
      ? `<div class="crew-solo-load-slot"><span class="crew-load-slot-label">LOAD SLOT</span> <span class="crew-load-slot-value">${escapeHtml(m.toSlot)}</span></div>`
      : '';
    const outBits = [];
    if (m.toDoor) outBits.push(`Door ${m.toDoor}`);
    if (m.toTrailer) outBits.push(`Trl ${m.toTrailer}`);
    if (m.destination) outBits.push(m.destination);
    const out = outBits.length ? outBits.join(' · ') : '—';
    const proBits = [];
    if (m.pro) proBits.push(`PRO ${m.pro}`);
    const fp = pieceFractionParts(m.pieceFraction);
    if (fp) proBits.push(`piece ${fp.k} of ${fp.n}`);
    el.crewSoloJobCard.innerHTML = `
      <div class="crew-solo-kicker">${justDone ? 'Just loaded' : 'Current job'} · Solo forklift</div>
      <div class="crew-solo-pull"><span class="crew-solo-label">Pull</span> ${pull}</div>
      ${loadSlot}
      <div class="crew-solo-out"><span class="crew-solo-label">OUT</span> ${escapeHtml(out)}</div>
      ${proBits.length ? `<div class="crew-solo-pro">${escapeHtml(proBits.join(' · '))}</div>` : ''}
      <div class="crew-solo-progress">Move ${crewDemo.doneCount} of ${crewDemo.total}</div>
      <div class="crew-solo-tap-hint">Tap OUT on the wall for trailer contents · Step / Play to advance</div>
    `;
  }

  function renderCrewMoveQueue() {
    if (!el.crewMoveQueue) return;
    if (!crewDemo.seeded) {
      el.crewMoveQueue.innerHTML =
        '<div class="empty-state">No plan queue yet. Build a load plan, then Solo forklift or Crew (5).</div>';
      return;
    }
    if (!crewDemo.queue.length) {
      el.crewMoveQueue.innerHTML = crewDemoAllDone()
        ? '<div class="empty-state">Queue empty — all moves done.</div>'
        : '<div class="empty-state">Queue empty — finishing active pulls…</div>';
      return;
    }

    // Group by outbound trailer (same pattern as Plan move list) for glove/boss scan
    const groups = new Map();
    crewDemo.queue.forEach((m, idx) => {
      const toTr = m.toTrailer || '';
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

    // Remember which outbound groups were collapsed so Step/Play re-render
    // does not force everything open (and so expand/collapse stays stable).
    const previouslyOpen = new Map();
    el.crewMoveQueue.querySelectorAll('details.crew-queue-group').forEach((d) => {
      const titleEl = d.querySelector('.plan-move-group-title');
      const key = titleEl ? titleEl.textContent.trim() : '';
      if (key) previouslyOpen.set(key, d.open);
    });

    const frag = document.createDocumentFragment();
    groups.forEach((g) => {
      const details = document.createElement('details');
      details.className = 'plan-move-group crew-queue-group';
      const count = g.items.length;
      const trailerLabel =
        g.trailer && g.trailer !== '—'
          ? `Trailer ${g.trailer}`
          : `Destination ${g.destination}`;
      const titleKey = `${trailerLabel} · ${g.destination}`;
      const keepOpen = previouslyOpen.has(titleKey) ? previouslyOpen.get(titleKey) : true;
      details.open = keepOpen;
      if (keepOpen) details.setAttribute('open', '');
      else details.removeAttribute('open');
      const summary = document.createElement('summary');
      summary.className = 'plan-move-group-head';
      summary.innerHTML = `
        <span class="plan-move-group-head-inner">
          <span class="plan-move-group-chevron" aria-hidden="true">▸</span>
          <span class="plan-move-group-text">
            <span class="plan-move-group-label">Outbound group</span>
            <span class="plan-move-group-title">${escapeHtml(trailerLabel)} · ${escapeHtml(g.destination)}</span>
          </span>
          <span class="plan-move-group-count">${count} move${count === 1 ? '' : 's'}</span>
        </span>
      `;
      details.appendChild(summary);

      const body = document.createElement('div');
      body.className = 'plan-move-group-body';
      g.items.forEach(({ m, idx }) => {
        const row = document.createElement('div');
        row.className = 'crew-queue-row';
        row.setAttribute('role', 'listitem');
        const fromDoor = m.fromDoor || '—';
        const fromTr = m.fromTrailer || '—';
        const fromSlot = m.fromSlot || '';
        const putDoor = m.toDoor || '';
        const toTr = m.toTrailer || '—';
        const toSlot = m.toSlot || '';
        const dest = m.destination || '';
        const pullBits = [`Door ${fromDoor}`, `Trl ${fromTr}`];
        if (fromSlot) pullBits.push(fromSlot);
        const loadBits = [];
        if (putDoor) loadBits.push(`Door ${putDoor}`);
        else if (toTr && toTr !== '—') loadBits.push('Door —');
        if (toTr && toTr !== '—') loadBits.push(`Trl ${toTr}`);
        if (dest) loadBits.push(dest);
        if (!loadBits.length) loadBits.push('—');
        const proBits = [];
        if (m.pro) proBits.push(`PRO ${m.pro}`);
        if (m.pieceFraction) proBits.push(m.pieceFraction);
        const loadSlotHtml = toSlot
          ? `<div class="crew-queue-load-slot"><span class="crew-load-slot-label">LOAD SLOT</span> <span class="crew-load-slot-value">${escapeHtml(toSlot)}</span></div>`
          : '';
        row.innerHTML = `
          <div class="crew-queue-num">#${idx + 1}</div>
          <div class="crew-queue-lines">
            <div class="crew-queue-from">${escapeHtml(pullBits.join(' · '))}</div>
            <div class="crew-queue-to"><span class="crew-queue-arrow" aria-hidden="true">→</span> ${escapeHtml(loadBits.join(' · '))}</div>
            ${loadSlotHtml}
            ${proBits.length ? `<div class="crew-queue-pro">${escapeHtml(proBits.join(' · '))}</div>` : ''}
          </div>
        `;
        body.appendChild(row);
      });
      details.appendChild(body);
      frag.appendChild(details);
    });

    el.crewMoveQueue.innerHTML = '';
    el.crewMoveQueue.appendChild(frag);
  }


  /**
   * Seed Crew (5), start Play, auto-open first OUT trailer fill picture.
   * @param {object|null} plan
   * @returns {boolean}
   */
  function scrollBossPayoffIntoView() {
    const target = crewDemoAllDone() && el.crewDemoDone && !el.crewDemoDone.hidden
      ? el.crewDemoDone
      : el.crewSpreadBanner || el.crewGodHud || el.crewOutTrailerPanel;
    if (!target || typeof target.scrollIntoView !== 'function') return;
    try {
      target.scrollIntoView({ behavior: 'auto', block: 'start' });
    } catch (e) {
      try {
        target.scrollIntoView(true);
      } catch (e2) {
        /* ignore */
      }
    }
  }

  /**
   * v50 one-screen boss summary for "Dock loaded — Ready".
   * @returns {string} HTML
   */
  const BOSS_YOUR_HOURS_KEY = 'dockApp.bossYourHours.v1';
  const BOSS_YOUR_FILL_KEY = 'dockApp.bossYourFill.v1';

  /** v53: a number the boss typed on the summary, or null when blank. */
  function bossNumberSetting(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === '') return null;
      const v = Number(raw);
      return Number.isFinite(v) && v >= 0 ? v : null;
    } catch (e) {
      return null;
    }
  }

  /** v54: compare lines from the stored numbers (inputs are never re-rendered while typing). */
  function bossCompareOutHtml(laborHours, avgFill) {
    const yourHours = bossNumberSetting(BOSS_YOUR_HOURS_KEY);
    const yourFill = bossNumberSetting(BOSS_YOUR_FILL_KEY);
    const rate = crewLaborRateSetting();
    const cmp = [];
    if (yourHours != null) {
      const diff = yourHours - laborHours;
      cmp.push(
        '<li>Labor: planner ' + laborHours.toFixed(1) + ' h vs yours ' + yourHours.toFixed(1) + ' h → <b>' +
        Math.abs(diff).toFixed(1) + ' h ' + (diff >= 0 ? 'less' : 'more') + '</b> with the planner' +
        (rate ? ' (' + (diff >= 0 ? '$' : '−$') + escapeHtml(Math.round(Math.abs(diff) * rate).toLocaleString('en-US')) + ' at $' + escapeHtml(String(rate)) + '/h)' : '') +
        '</li>'
      );
    }
    if (yourFill != null) {
      const pts = avgFill - yourFill;
      cmp.push(
        '<li>Trailer fill: planner ' + avgFill + '% vs yours ' + Math.round(yourFill) + '% → <b>' +
        (pts >= 0 ? '+' : '−') + Math.abs(Math.round(pts)) + ' points</b> of floor length</li>'
      );
    }
    return cmp.length
      ? '<ul class="boss-sum-compare-out">' + cmp.join('') + '</ul>'
      : '<p class="boss-sum-input-hint">Type your own numbers to see the difference. Nothing is filled in for you.</p>';
  }

  function crewLaborRateSetting() {
    try {
      const raw = localStorage.getItem(CREW_RATE_KEY);
      if (raw === null || raw === '') return null;
      const v = Number(raw);
      return Number.isFinite(v) && v > 0 ? v : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * v51: the timing behind the summary. Same minutes/move as the live run →
   * the live numbers; a different value (edited on the summary) → re-run the
   * same plan headless with that value (departure times stay fixed).
   */
  function crewSummaryRun() {
    const mpm = crewMinPerMoveSetting();
    if (mpm === Number(crewDemo.minPerMove) || !Array.isArray(crewDemo.allMoves) || !crewDemo.allMoves.length) {
      return {
        minPerMove: Number(crewDemo.minPerMove) || CREW_MIN_PER_MOVE,
        doorDoneAt: crewDemo.doorDoneAt || {},
        minutes: crewDemoClockMin() - (crewDemo.startMin || CREW_SAMPLE_START_MIN),
        opMoveCount: crewDemo.opMoveCount || {},
        opBusyMin: crewDemo.opBusyMin || {},
      };
    }
    const r = simulateCrewRunHeadless(crewDemo.allMoves, {
      mode: crewDemo.mode,
      targetOps: crewDemo.targetOps,
      bossMode: crewDemo.bossMode,
      minPerMove: mpm,
    });
    return {
      minPerMove: mpm,
      doorDoneAt: r.doorDoneAt,
      minutes: r.minutes,
      opMoveCount: r.opMoveCount,
      opBusyMin: r.opBusyMin,
    };
  }

  function buildCrewBossSummaryHtml() {
    const plan = DockStorage.readLoadPlan();
    const loads = (plan && Array.isArray(plan.outboundLoadouts)) ? plan.outboundLoadouts : [];
    const run = crewSummaryRun();
    const sumObj = (plan && plan.summary) || {};
    const unplacedN = Array.isArray(sumObj.unplaced)
      ? sumObj.unplaced.length
      : Number(sumObj.unplacedCount) || 0;
    const rows = [];
    let allLegal = true;
    let totalLb = 0;
    let totalPieces = 0;
    let totalPre = 0;
    let onTime = 0;
    const tightList = [];
    loads.forEach((L) => {
      const door = resolvePutDoor({
        door: L.doorNumber || '',
        trailer: L.trailerNumber || '',
        destination: L.destination || '',
      });
      const pieces = piecesForOutboundTrailer(L.trailerNumber);
      if (!pieces.length) return;
      const w = computePupAxleWeights(pieces);
      const legal = !(w.frontOver || w.rearOver || w.noseOver || w.tailOver);
      if (!legal) allLegal = false;
      totalLb += w.total;
      totalPieces += pieces.length;
      // Fill % = floor length used, nose to the last occupied 4 ft section
      const fill = trailerFillInfo(pieces);
      const lengthPct = fill.pct;
      const preN = pieces.filter((p) => p.preloaded).length;
      totalPre += preN;
      const depart = (crewDemo.departures || {})[String(door)];
      const doneAt = (run.doorDoneAt || {})[String(door)];
      let timeTxt = '';
      let late = false;
      if (Number.isFinite(depart) && Number.isFinite(doneAt)) {
        const spare = crewSpareMin(depart, doneAt);
        late = spare < 0;
        if (!late) onTime += 1;
        // v54: tight = still on time; said the same way as the tour cards
        const tight = !late && spare < CREW_TIGHT_MARGIN_MIN;
        if (tight) tightList.push({ door, spare });
        timeTxt = 'done ' + formatDoneClock(doneAt) + ' · ' +
          (late ? crewSpareText(spare, depart) : 'on time, ' + crewSpareText(spare, depart) + (tight ? ' (tight: under ' + CREW_TIGHT_MARGIN_MIN + ' min)' : ''));
      }
      // Honest note only when a trailer is genuinely light
      let note = '';
      if (lengthPct < 50) {
        note =
          'Light: only ' + lengthPct + '% of the floor used. Consolidation candidate: hold at the door for more freight, or combine with a trailer going the same way.';
      }
      const weightPct = Math.round((w.total / (2 * PUP_AXLE_CAP_LB)) * 100);
      rows.push({
        door,
        weightPct,
        dest: L.destination || '—',
        trailer: L.trailerNumber || '—',
        pieces: pieces.length,
        preN,
        lb: w.total,
        front: w.frontAxle,
        rear: w.rearAxle,
        lengthPct,
        fill,
        legal,
        timeTxt,
        late,
        note,
      });
    });
    // v53: say the fill rule once; weight also as % of the legal max
    // v54: floor and weight side by side, and why both are normal for LTL
    const secs = Array.from(new Set(rows.map((r) => r.fill.maxSec)));
    const wPcts = rows.map((r) => r.weightPct).sort((a, b) => a - b);
    const wTxt = wPcts.length ? (wPcts[0] === wPcts[wPcts.length - 1] ? wPcts[0] + '%' : wPcts[0] + '–' + wPcts[wPcts.length - 1] + '%') : '';
    const allFloorFull = secs.length === 1 && secs[0] >= 12;
    const fillNote =
      (allFloorFull
        ? 'Floor: 100% full on every trailer (sections 1–12, nose to tail: no floor space left). '
        : 'Floor = % of floor length used (nose to the last loaded 4 ft section). ') +
      (wTxt ? 'Weight: ' + wTxt + ' of the 40,000 lb freight limit. ' : '') +
      (allFloorFull ? 'So these trailers are space-full, not weight-full; that is normal for LTL, where freight runs out of room before it runs out of weight. ' : '') +
      WEIGHT_BASIS_TEXT + ' ' + EQUIP_LONG;
    const ops = crewDemo.active.slice().sort((a, b) => a.operator - b.operator);
    const minutes = Math.max(1, Math.round(run.minutes));
    const laborHours = (ops.length * minutes) / 60;
    const rate = crewLaborRateSetting();
    const opsHtml = ops
      .map((a) => {
        const n = run.opMoveCount[a.operator] || 0;
        const busy = Number(run.opBusyMin[a.operator]) || 0;
        const busyPct = Math.min(100, Math.round((busy / minutes) * 100));
        const waitMin = Math.max(0, minutes - Math.round(busy));
        return (
          '<li><strong>' + escapeHtml(crewOpLabel(a.operator)) + '</strong> · ' +
          n + ' move' + (n === 1 ? '' : 's') + ' · busy ' + busyPct + '% (' + Math.round(busy) + ' min) · waiting ' + (100 - busyPct) + '% (' + waitMin + ' min)</li>'
        );
      })
      .join('');
    const trailerHtml = rows
      .map(
        (r) =>
          '<div class="boss-sum-row' + (r.late ? ' is-late' : '') + '">' +
          '<div class="boss-sum-row-main"><strong>OUT ' + escapeHtml(String(r.door)) + ' · Trl ' + escapeHtml(String(r.trailer)) +
          ' · ' + escapeHtml(r.dest) + '</strong>' +
          ' <span class="boss-sum-fill">Floor: ' + r.lengthPct + '% full</span>' +
          ' <span class="boss-sum-fill is-weight">Weight: ' + r.weightPct + '% of 40,000 lb</span></div>' +
          '<div class="boss-sum-row-facts">' + r.pieces + ' pieces on board' +
          (r.preN ? ' (' + r.preN + ' loaded earlier)' : '') + ' · ' + escapeHtml(fmtLb(r.lb)) +
          ' · axles ' + escapeHtml(Math.round(r.front).toLocaleString('en-US')) + ' / ' +
          escapeHtml(Math.round(r.rear).toLocaleString('en-US')) + ' lb ' +
          (r.legal ? 'legal ✓' : 'OVER a limit ✗') + '</div>' +
          (r.timeTxt ? '<div class="boss-sum-row-time' + (r.late ? ' is-late' : '') + '">' + escapeHtml(r.timeTxt) + '</div>' : '') +
          (r.note ? '<div class="boss-sum-row-note">' + escapeHtml(r.note) + '</div>' : '') +
          '</div>'
      )
      .join('');
    const exitBtn = hasDemoBackup()
      ? '<button type="button" class="btn boss-sum-exit" data-boss-action="exit">Exit demo (bring back my freight)</button>'
      : '';
    // v52: ONE headline from real computed figures only (no invented savings or baseline)
    const pcts = Array.from(new Set(rows.map((r) => r.lengthPct))).sort((a, b) => a - b);
    const pctTxt = pcts.length === 1 ? pcts[0] + '%' : pcts[0] + '–' + pcts[pcts.length - 1] + '%';
    const headline =
      rows.length + ' trailer' + (rows.length === 1 ? '' : 's') + ' out ' + pctTxt + ' full by floor space' +
      (wTxt ? ' (' + wTxt + ' of weight limit)' : '') + ', ' +
      (allLegal ? 'all axle-legal' : 'NOT all axle-legal') + ', ' +
      onTime + ' of ' + rows.length + ' on time' +
      (tightList.length ? ' (' + tightList.map((t) => 'OUT ' + t.door + ' tight: ' + t.spare + ' min to spare').join(', ') + ')' : '') +
      ' · ' + laborHours.toFixed(1) + ' forklift labor hours' +
      (rate ? ' · $' + Math.round(laborHours * rate).toLocaleString('en-US') + ' labor' : '');
    const laborScope =
      'Forklift time for these ' + (crewDemo.total || 0) + ' moves only (' + ops.length + ' forklifts × ' + minutes + ' min). ' +
      'Not included: the ' + totalPre + ' pieces loaded earlier, clerks, and breaks.';
    const costHtml = rate
      ? '<span class="boss-sum-cost"><b>$' + escapeHtml(Math.round(laborHours * rate).toLocaleString('en-US')) +
        '</b> labor (' + laborHours.toFixed(1) + ' h × $' + escapeHtml(String(rate)) + ')</span>'
      : '';
    // v53: "Your dock today" — the boss types their own numbers; blank = no compare
    const yourHours = bossNumberSetting(BOSS_YOUR_HOURS_KEY);
    const yourFill = bossNumberSetting(BOSS_YOUR_FILL_KEY);
    const avgFill = rows.length ? Math.round(rows.reduce((s, r) => s + r.lengthPct, 0) / rows.length) : 0;
    state.bossCompareBasis = { laborHours, avgFill };
    const compareOut = bossCompareOutHtml(laborHours, avgFill);
    const compareHtml =
      '<div class="boss-sum-compare"><div class="boss-sum-sub">Your dock today (compare)</div>' +
      '<div class="boss-sum-compare-inputs">' +
      '<label class="boss-sum-input">Your labor hours for this much freight (' + rows.length + ' trailers, ' + (crewDemo.total || 0) + ' moves) ' +
      '<input type="number" id="bossYourHours" min="0" step="0.1" inputmode="decimal" placeholder="your hours" value="' +
      escapeHtml(yourHours != null ? String(yourHours) : '') + '" /></label>' +
      '<label class="boss-sum-input">Your typical trailer fill % ' +
      '<input type="number" id="bossYourFill" min="0" max="100" step="1" inputmode="numeric" placeholder="your usual" value="' +
      escapeHtml(yourFill != null ? String(yourFill) : '') + '" /></label>' +
      '</div>' +
      '<div id="bossCompareOut">' + compareOut + '</div>' +
      '<p class="boss-sum-input-hint">Your numbers are kept on this phone for next time (also after Watch again). Clear a box to remove it.</p>' +
      '</div>';
    return (
      '<div class="boss-summary" role="status">' +
      '<div class="boss-sum-kicker">Boss summary · sample shift</div>' +
      '<h3 class="boss-sum-title">Dock loaded — Ready</h3>' +
      '<p class="boss-sum-headline">' + escapeHtml(headline) + '</p>' +
      '<div class="boss-sum-stats">' +
      '<span><b>' + rows.length + '</b> trailers loaded</span>' +
      '<span>this run: <b>' + crewDemo.doneCount + ' of ' + (crewDemo.total || crewDemo.doneCount) + '</b> moved · trailers: ' + totalPieces + ' pieces on board' + (totalPre ? ' (' + totalPre + ' loaded earlier)' : '') + ' · ' + escapeHtml(fmtLb(totalLb)) + '</span>' +
      '<span><b>' + (allLegal ? 'All axles + zones legal ✓' : 'Limit problem ✗') + '</b></span>' +
      (unplacedN === 0
        ? '<span><b>Unplaced 0</b> · every piece has a slot</span>'
        : '<span><b>Unplaced ' + unplacedN + '</b> · see Plan</span>') +
      '<span><b>~' + minutes + ' min</b> with ' + ops.length + ' forklift' + (ops.length === 1 ? '' : 's') + '</span>' +
      '<span><b>' + laborHours.toFixed(1) + ' forklift labor hours</b>: ' + escapeHtml(laborScope) + '</span>' +
      costHtml +
      (rows.length ? '<span><b>' + onTime + ' of ' + rows.length + '</b> on time' + (tightList.length ? ' · ' + tightList.map((t) => 'OUT ' + t.door + ' tight (' + t.spare + ' min to spare)').join(', ') : '') + '</span>' : '') +
      '</div>' +
      '<div class="boss-sum-inputs">' +
      '<label class="boss-sum-input">Minutes per move <input type="number" id="bossMinPerMove" min="1" max="30" step="0.5" inputmode="decimal" value="' +
      escapeHtml(String(run.minPerMove)) + '" /></label>' +
      '<label class="boss-sum-input">$ per labor hour <input type="number" id="bossLaborRate" min="0" step="0.5" inputmode="decimal" placeholder="optional" value="' +
      escapeHtml(rate ? String(rate) : '') + '" /></label>' +
      '<p class="boss-sum-input-hint">Minutes per move = handling time; each trip adds 0.5 min per door of travel, rounded up to the whole minute. Change it and the times above recompute. Cost shows only when you enter a rate.</p>' +
      '</div>' +
      compareHtml +
      '<p class="boss-sum-fill-note">' + escapeHtml(fillNote) + '</p>' +
      '<div class="boss-sum-rows">' + trailerHtml + '</div>' +
      '<div class="boss-sum-cols">' +
      '<div class="boss-sum-crew"><div class="boss-sum-sub">Forklifts (sample names)</div><ul>' + opsHtml + '</ul>' +
      '<p class="boss-sum-input-hint">Busy % = minutes driving and handling ÷ the ' + minutes + ' min run. The rest is waiting: for a free inbound door (at most 2 forklifts per door), or because every trailer with moves left already had a forklift in it, mostly near the end. Assumes no breaks; add breaks to the minutes-per-move estimate.</p></div>' +
      '<div class="boss-sum-real"><div class="boss-sum-sub">Start using it for real</div><ol>' +
      '<li>Set your door count <button type="button" class="btn tiny" data-boss-action="doors">Doors on this dock</button>. Departure times: the demo uses sample times; typing them in or importing them from your schedule is coming.</li>' +
      '<li>Forklift drivers: <b>coming: driver logins</b> (each driver signs in and gets only their own moves). Today the Operator screen shows the plan one move at a time on one phone.</li>' +
      '<li>Drivers use the Operator screen on their phone, one move at a time <button type="button" class="btn tiny" data-boss-action="operator">Open Operator screen</button></li>' +
      '</ol></div>' +
      '<div class="boss-sum-next"><div class="boss-sum-sub">Coming in the real version</div><ul>' +
      '<li>Live office view and reports across every phone on the dock</li>' +
      '<li>Operator scans for each move, so every piece has a name on it</li>' +
      '<li>OS&amp;D (Over, Short &amp; Damaged freight) photos attached to the piece and the bill</li>' +
      '<li>Export or share this summary</li>' +
      '</ul></div>' +
      '</div>' +
      '<div class="boss-sum-actions">' +
      '<button type="button" class="btn accept-btn boss-sum-again" data-boss-action="again">Watch again</button>' +
      exitBtn +
      '</div>' +
      '</div>'
    );
  }

  function runBossDemoWithPlan(plan, tourMode) {
    // Boss demo always starts in guided-tour mode (checkbox must match).
    setCrewTourEnabled(true);
    const ok = seedCrewDemo(plan, {
      mode: 'crew',
      targetOps: CREW_DEMO_TARGET_OPS,
      bossMode: true,
    });
    crewTour.mode = tourMode === 'every' ? 'every' : 'quick';
    if (!ok) {
      toast('No plan yet. Tap Show boss demo.');
      renderCrew();
      return false;
    }
    // Open the trailer the first forklift is loading (the intro card points at it)
    const first = crewDemo.active[0] && crewDemo.active[0].move;
    if (first && first.toDoor) {
      state.crewOutDoor = String(first.toDoor);
      state.crewOutViewMode = 'side';
      state.crewOutTopDeck = 'A';
      state.crewOutSelectedPieceKey = null;
    }
    renderCrew();
    updateCrewDemoChrome();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (crewTour.enabled) showCrewTourIntro();
        else startCrewDemoPlay({ fromTourContinue: true });
      });
    });
    return true;
  }

  // ---------- v50: demo backup — the boss demo never loses the user's freight ----------
  const DEMO_BACKUP_KEY = 'dockApp.demoBackup.v1';

  function demoDataKeys() {
    return [
      DockStorage.STORAGE_KEY,
      DockStorage.PROS_KEY,
      DockStorage.OUTBOUND_KEY,
      DockStorage.PLAN_KEY,
      typeof DockLoadPlan !== 'undefined' ? DockLoadPlan.DEMO_PRELOAD_KEY : '',
    ].filter(Boolean);
  }

  /** v51: what the saved (pre-demo) snapshot holds, for the start card + exit toast. */
  function demoBackupSummary() {
    try {
      const snap = JSON.parse(localStorage.getItem(DEMO_BACKUP_KEY) || 'null');
      if (!snap) return { saved: false, proCount: 0, pieceCount: 0 };
      if (Number.isFinite(snap.proCount)) {
        return { saved: true, proCount: snap.proCount, pieceCount: snap.pieceCount || 0 };
      }
      const raw = snap.keys && snap.keys[DockStorage.STORAGE_KEY];
      const list = raw ? JSON.parse(raw) : [];
      const arr = Array.isArray(list) ? list : [];
      const pros = new Set(arr.map((e) => String((e && e.pro) || '').trim()).filter(Boolean));
      return { saved: true, proCount: pros.size, pieceCount: arr.length };
    } catch (e) {
      return { saved: false, proCount: 0, pieceCount: 0 };
    }
  }

  function hasDemoBackup() {
    try {
      return Boolean(localStorage.getItem(DEMO_BACKUP_KEY));
    } catch (e) {
      return false;
    }
  }

  function userHasLoggedData() {
    try {
      if (DockStorage.readAll().length) return true;
      if (DockStorage.readOutboundTrailers().length) return true;
      const plan = DockStorage.readLoadPlan();
      return Boolean(plan && Array.isArray(plan.moves) && plan.moves.length);
    } catch (e) {
      return false;
    }
  }

  /** Save the user's freight/plan before the demo replaces it (only once per demo session). */
  function backupUserDataForDemo() {
    if (hasDemoBackup()) return true;
    try {
      const snap = { at: new Date().toISOString(), keys: {} };
      demoDataKeys().forEach((k) => {
        snap.keys[k] = localStorage.getItem(k);
      });
      try {
        const arr = DockStorage.readAll() || [];
        const pros = new Set(arr.map((e) => String((e && e.pro) || '').trim()).filter(Boolean));
        snap.proCount = pros.size;
        snap.pieceCount = arr.length;
      } catch (e2) {
        snap.proCount = 0;
        snap.pieceCount = 0;
      }
      localStorage.setItem(DEMO_BACKUP_KEY, JSON.stringify(snap));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  /** Exit demo: put the user's own freight + plan back exactly as it was. */
  function exitDemoRestore() {
    let snap = null;
    try {
      snap = JSON.parse(localStorage.getItem(DEMO_BACKUP_KEY) || 'null');
    } catch (e) {
      snap = null;
    }
    if (!snap || !snap.keys) {
      toast('No saved freight to bring back');
      return;
    }
    const restored = demoBackupSummary();
    Object.keys(snap.keys).forEach((k) => {
      const v = snap.keys[k];
      if (v === null || v === undefined) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    });
    localStorage.removeItem(DEMO_BACKUP_KEY);
    clearCrewTourProgress();
    resetCrewDemoState();
    resetOperatorDemoState();
    state.crewOutDoor = null;
    state.crewSelectedOp = null;
    state.dockLevel = 'doors';
    state.dockDoor = '';
    state.dockPro = '';
    state.loadoutTrailer = '';
    if (el.loadoutTrailerInput) el.loadoutTrailerInput.value = '';
    renderRecent();
    refreshLoadoutTrailerPicker();
    updateLoadoutPlanBanner();
    renderOutboundList();
    renderGround();
    renderPlan();
    renderOperator();
    renderCrew();
    if (state.view === 'dock' && state.dockSection === 'inbound') renderDock();
    updateDemoModeBar();
    // v51: land on the freight list, at the top, and say what came back
    dismissCrewTourPopup({ keepResume: false });
    showView('entry');
    try {
      window.scrollTo(0, 0);
    } catch (e) {
      /* ignore */
    }
    const n = restored.proCount || 0;
    const msg = n
      ? 'Your freight is back — ' + n + ' PRO' + (n === 1 ? '' : 's') + ' restored'
      : 'Demo closed — sample freight removed';
    toast(msg);
    const notice = document.getElementById('restoreNotice');
    if (notice) {
      const pc = restored.pieceCount || 0;
      notice.innerHTML = n
        ? '<b>' + escapeHtml(msg) + '</b> (' + pc + ' piece' + (pc === 1 ? '' : 's') +
          '). Sample freight removed. <button type="button" class="btn tiny" data-restore-jump="1">Show my freight</button>'
        : '<b>Demo closed.</b> Sample freight removed; you had no logged freight before the demo.';
      notice.hidden = false;
      const jump = notice.querySelector('[data-restore-jump]');
      if (jump) {
        jump.addEventListener('click', () => {
          const recent = document.getElementById('recentList');
          if (recent) {
            recent.classList.add('is-restored-flash');
            recent.scrollIntoView({ block: 'start', behavior: 'smooth' });
            setTimeout(() => recent.classList.remove('is-restored-flash'), 2400);
          }
        });
      }
    }
  }

  function updateDemoModeBar() {
    const bar = document.getElementById('demoModeBar');
    if (!bar) return;
    const on = hasDemoBackup();
    bar.hidden = !on;
    document.body.classList.toggle('demo-data-on', on);
    const sub = document.getElementById('demoModeSub');
    if (sub && on) {
      const s = demoBackupSummary();
      sub.textContent = s.proCount
        ? 'Your freight (' + s.proCount + ' PRO' + (s.proCount === 1 ? '' : 's') + ') is saved.'
        : 'Sample freight only.';
    }
  }

  /** Seed sample freight + plan and start the boss demo (after backup). */
  function startBossDemoNow(tourMode) {
    backupUserDataForDemo();
    clearCrewTourProgress();
    crewTour.mode = tourMode === 'every' ? 'every' : 'quick';
    crewTour.lastMode = crewTour.mode;
    const notice = document.getElementById('restoreNotice');
    if (notice) notice.hidden = true;
    runSeedDemoInbound();
    const plan =
      typeof DockLoadPlan !== 'undefined' && DockLoadPlan.runLoadPlan
        ? DockLoadPlan.runLoadPlan()
        : null;
    renderPlan();
    renderOutboundList();
    renderGround();
    refreshLoadoutTrailerPicker();
    updateLoadoutPlanBanner();
    updateDemoModeBar();
    if (!plan || !plan.moves || !plan.moves.length) {
      resetCrewDemoState();
      toast('Demo loaded but no moves — check Plan');
      renderCrew();
      return;
    }
    runBossDemoWithPlan(plan, crewTour.mode);
  }

  /** One-tap boss demo: ALWAYS fresh sample freight + fresh plan (never a stale plan).
   * v51 ONE rule, every time: no pop-up. The user's freight is backed up
   * (once per demo session), and the tour's first card is the start card —
   * it mentions the saved freight only when there is some.
   */
  function onBossDemo(tourMode) {
    if (typeof DockLoadPlan === 'undefined' || !DockLoadPlan.seedDemoInbound) {
      toast("Planner didn't load. Refresh the page and try again.");
      return;
    }
    startBossDemoNow(tourMode);
  }

  /** Hero button on the first screen → straight into the Crew boss demo. */
  function onHeroBossDemo(tourMode) {
    showView('dock');
    showDockSection('crew');
    onBossDemo(tourMode);
  }

  function bindCrew() {
    if (el.crewRefreshBtn) {
      el.crewRefreshBtn.addEventListener('click', () => {
        if (crewDemo.seeded) {
          toast('Live demo running — use Reset demo to restart');
          return;
        }
        state.crewRotate = (Number(state.crewRotate) || 0) + 1;
        state.crewSelectedOp = null;
        renderCrew();
        toast('Assignments refreshed');
      });
    }
    if (el.crewBossDemoBtn) {
      el.crewBossDemoBtn.addEventListener('click', () => onBossDemo('quick'));
    }
    if (el.crewEveryMoveBtn) {
      el.crewEveryMoveBtn.addEventListener('click', () => onBossDemo('every'));
    }
    if (el.crewSoloStartBtn) {
      el.crewSoloStartBtn.addEventListener('click', () => onCrewStartDemo('solo'));
    }
    if (el.crewMultiStartBtn) {
      el.crewMultiStartBtn.addEventListener('click', () => onCrewStartDemo('crew'));
    }
    if (el.crewStepBtn) {
      el.crewStepBtn.addEventListener('click', () => onCrewStepOnce());
    }
    if (el.crewPlayBtn) {
      el.crewPlayBtn.addEventListener('click', () => {
        startCrewDemoPlay();
        renderCrew();
      });
    }
    if (el.crewStopBtn) {
      el.crewStopBtn.addEventListener('click', () => {
        stopCrewDemoPlay();
        crewTour.resumePlay = false;
        dismissCrewTourPopup({ keepResume: false });
        // Keep queue cleared so Stop really freezes; fingerprints stay so Continue later is clean after Step/Play
        crewTour.queue = [];
        updateCrewDemoChrome();
        toast('Demo paused');
      });
    }
    if (el.crewResetDemoBtn) {
      el.crewResetDemoBtn.addEventListener('click', () => onCrewResetDemo());
    }
    if (el.crewTourPauseToggle) {
      el.crewTourPauseToggle.checked = readCrewTourEnabled();
      crewTour.enabled = el.crewTourPauseToggle.checked;
      el.crewTourPauseToggle.addEventListener('change', () => {
        setCrewTourEnabled(el.crewTourPauseToggle.checked);
        if (el.crewTourPauseToggle.checked) {
          toast('Pause at each action — on');
          if (crewDemo.seeded && crewDemo.playing) {
            queueCrewTourNewActions();
            pauseForCrewTourIfNeeded();
          } else if (crewDemo.seeded && !crewDemoAllDone()) {
            // Re-enable guided pauses on the next action without forcing play
            queueCrewTourNewActions();
          }
        } else {
          // Unchecked ↔ Play without stops (same path)
          toast('Pause at each action — off · playing through');
          crewTour.queue = [];
          dismissCrewTourPopup({ keepResume: false });
          if (crewDemo.seeded && !crewDemoAllDone()) {
            startCrewDemoPlay({ fromTourContinue: true });
          }
        }
        updateCrewDemoChrome();
      });
    }
    ensureCrewTourDom();
    if (el.crewDoorCountInput) {
      const syncCount = () => {
        const inp = el.crewDoorCountInput;
        // v53: leaving the demo's shown count untouched saves nothing
        if (inp.dataset.demo === '1' && inp.value === inp.dataset.shown) return;
        state.crewDoorCountTouched = true;
        const n = setDockDoorCount(el.crewDoorCountInput.value);
        el.crewDoorCountInput.value = String(n);
        renderCrew();
      };
      el.crewDoorCountInput.addEventListener('change', syncCount);
      el.crewDoorCountInput.addEventListener('blur', syncCount);
    }
    if (el.crewFloor) {
      el.crewFloor.addEventListener('click', (ev) => {
        const outChip = ev.target.closest('.crew-out-target[data-door]');
        if (outChip) {
          const door = outChip.getAttribute('data-door') || '';
          if (door) openCrewOutTrailerPanel(door);
          return;
        }
        const btn = ev.target.closest('.crew-op-marker');
        if (!btn) return;
        const op = Number(btn.getAttribute('data-op'));
        if (!op) return;
        state.crewSelectedOp = state.crewSelectedOp === op ? null : op;
        updateCrewSelectionUI();
      });
    }
    if (el.crewBoardList) {
      el.crewBoardList.addEventListener('click', (ev) => {
        const row = ev.target.closest('.crew-board-row[data-op]');
        if (!row) return;
        const op = Number(row.getAttribute('data-op'));
        if (!op) return;
        state.crewSelectedOp = state.crewSelectedOp === op ? null : op;
        updateCrewSelectionUI();
      });
    }
    if (el.crewOutTrailerCloseBtn) {
      el.crewOutTrailerCloseBtn.addEventListener('click', () => closeCrewOutTrailerPanel());
    }
    // v49: Side/Top-down, deck jumps, piece tap, OUT trailer switcher (event delegation)
    if (el.crewOutTrailerBody && !el.crewOutTrailerBody.dataset.v49Bound) {
      el.crewOutTrailerBody.dataset.v49Bound = '1';
      el.crewOutTrailerBody.addEventListener('click', (ev) => {
        const t = ev.target;
        if (!t || !t.closest) return;
        const switchBtn = t.closest('.crew-out-trailer-switch[data-door]');
        if (switchBtn) {
          const d = String(switchBtn.getAttribute('data-door') || '').trim();
          if (d) {
            // Keep Side/Top-down + deck; only change which OUT is shown
            state.crewOutDoor = d;
            state.crewOutSelectedPieceKey = null;
            renderCrewOutTrailerPanel();
            updateCrewSelectionUI();
          }
          return;
        }
        const viewBtn = t.closest('[data-trailer-view]');
        if (viewBtn) {
          const mode = viewBtn.getAttribute('data-trailer-view') === 'top' ? 'top' : 'side';
          state.crewOutViewMode = mode;
          state.crewOutSelectedPieceKey = null;
          renderCrewOutTrailerPanel();
          return;
        }
        const deckBtn = t.closest('[data-deck-level]');
        if (deckBtn) {
          const L = String(deckBtn.getAttribute('data-deck-level') || 'A').toUpperCase();
          state.crewOutViewMode = 'top';
          state.crewOutTopDeck = L;
          state.crewOutSelectedPieceKey = null;
          renderCrewOutTrailerPanel();
          return;
        }
        const pieceBtn = t.closest('.trailer-top-cell[data-piece-key]');
        if (pieceBtn) {
          const key = pieceBtn.getAttribute('data-piece-key') || '';
          state.crewOutSelectedPieceKey =
            state.crewOutSelectedPieceKey === key ? null : key;
          renderCrewOutTrailerPanel();
          return;
        }
        const listPiece = t.closest('.crew-out-piece[data-piece-key]');
        if (listPiece) {
          const key = listPiece.getAttribute('data-piece-key') || '';
          state.crewOutSelectedPieceKey =
            state.crewOutSelectedPieceKey === key ? null : key;
          renderCrewOutTrailerPanel();
        }
      });
    }
    if (el.crewGodOutPills) {
      el.crewGodOutPills.addEventListener('click', (ev) => {
        const pill = ev.target.closest('.crew-god-pill[data-door]');
        if (!pill) return;
        const door = pill.getAttribute('data-door') || '';
        if (door) openCrewOutTrailerPanel(door);
      });
    }
    // v50: exit demo (restore the user's freight), summary buttons, hero button
    if (el.crewExitDemoBtn) {
      el.crewExitDemoBtn.addEventListener('click', () => exitDemoRestore());
    }
    if (el.demoModeExitBtn) {
      el.demoModeExitBtn.addEventListener('click', () => exitDemoRestore());
    }
    if (el.heroBossDemoBtn) {
      el.heroBossDemoBtn.addEventListener('click', () => onHeroBossDemo('quick'));
    }
    if (el.heroEveryMoveBtn) {
      el.heroEveryMoveBtn.addEventListener('click', () => onHeroBossDemo('every'));
    }
    if (el.crewDemoDone) {
      el.crewDemoDone.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-boss-action]');
        if (!btn) return;
        const act = btn.getAttribute('data-boss-action');
        if (act === 'again') onBossDemo(crewTour.lastMode || 'quick');
        else if (act === 'exit') exitDemoRestore();
        else if (act === 'doors') {
          state.crewDoorCountUserOpen = true;
          if (el.crewDoorCountDetails) {
            el.crewDoorCountDetails.open = true;
            try {
              el.crewDoorCountDetails.scrollIntoView({ block: 'center', behavior: 'smooth' });
            } catch (e) {
              /* ignore */
            }
            if (el.crewDoorCountInput) el.crewDoorCountInput.focus({ preventScroll: true });
          }
        } else if (act === 'operator') {
          showDockSection('operator');
          try {
            window.scrollTo(0, 0);
          } catch (e) {
            /* ignore */
          }
        }
      });
      el.crewDemoDone.addEventListener('change', (ev) => {
        const t = ev.target;
        if (!t || !t.id) return;
        if (t.id === 'bossMinPerMove') {
          const v = Number(t.value);
          if (!(Number.isFinite(v) && v >= 1 && v <= 30)) {
            toast('Minutes per move: 1 to 30');
            return;
          }
          localStorage.setItem(CREW_MIN_PER_MOVE_KEY, String(v));
        } else if (t.id === 'bossLaborRate') {
          const v = Number(t.value);
          if (t.value === '' || !(v > 0)) localStorage.removeItem(CREW_RATE_KEY);
          else localStorage.setItem(CREW_RATE_KEY, String(v));
        } else if (t.id === 'bossYourHours' || t.id === 'bossYourFill') {
          saveBossCompareInput(t);
          return; // v54: never rebuild the summary for these (that wiped what was typed)
        } else return;
        // re-render after the event settles; v54: keep focus + what is typed in the compare box
        setTimeout(() => {
          rerenderBossSummaryKeepingInputs();
        }, 0);
      });
      // v54: the compare box saves on every keystroke and updates its result in place
      el.crewDemoDone.addEventListener('input', (ev) => {
        const t = ev.target;
        if (!t || !t.id) return;
        if (t.id === 'bossYourHours' || t.id === 'bossYourFill') saveBossCompareInput(t);
        else if (t.id === 'bossLaborRate') {
          const v = Number(t.value);
          if (t.value === '' || !(v > 0)) localStorage.removeItem(CREW_RATE_KEY);
          else localStorage.setItem(CREW_RATE_KEY, String(v));
          refreshBossCompareOut();
        }
      });
    }
  }

  /** v54: one rule for the compare box: what is in the box is what is stored. */
  function saveBossCompareInput(t) {
    const key = t.id === 'bossYourHours' ? BOSS_YOUR_HOURS_KEY : BOSS_YOUR_FILL_KEY;
    const raw = String(t.value || '').trim();
    const v = Number(raw);
    const max = t.id === 'bossYourFill' ? 100 : 100000;
    if (raw === '' || !(Number.isFinite(v) && v >= 0 && v <= max)) localStorage.removeItem(key);
    else localStorage.setItem(key, String(v));
    refreshBossCompareOut();
  }

  function refreshBossCompareOut() {
    const out = document.getElementById('bossCompareOut');
    const b = state.bossCompareBasis;
    if (out && b) out.innerHTML = bossCompareOutHtml(b.laborHours, b.avgFill);
  }

  /** v54: rebuild the summary (e.g. minutes per move changed) without losing focus or typing. */
  function rerenderBossSummaryKeepingInputs() {
    if (!el.crewDemoDone) return;
    const active = document.activeElement;
    const focusId = active && el.crewDemoDone.contains(active) ? active.id : '';
    const typed = {};
    el.crewDemoDone.querySelectorAll('input[id]').forEach((i) => {
      typed[i.id] = i.value;
    });
    el.crewDemoDone.innerHTML = buildCrewBossSummaryHtml();
    Object.keys(typed).forEach((id) => {
      const i = document.getElementById(id);
      if (i && id !== 'bossMinPerMove') i.value = typed[id];
    });
    if (focusId) {
      const f = document.getElementById(focusId);
      if (f) f.focus({ preventScroll: true });
    }
  }

  /* ---------- v41: Operator (My jobs) — one move at a time, directions only ---------- */

  /** @type {{ seeded: boolean, moves: object[], index: number, phase: 'pick'|'load', total: number }} */
  let operatorDemo = {
    seeded: false,
    moves: [],
    index: 0,
    phase: 'pick',
    total: 0,
  };

  function resetOperatorDemoState() {
    operatorDemo = {
      seeded: false,
      moves: [],
      index: 0,
      phase: 'pick',
      total: 0,
    };
  }

  /**
   * Seed operator walkthrough from plan moves (same order as planMovesNormalized / solo first-pull sequence).
   * @param {object|null} [plan]
   * @returns {boolean}
   */
  function seedOperatorDemo(plan) {
    const p = plan || DockStorage.readLoadPlan();
    const all = planMovesNormalized(p);
    if (!all.length) {
      resetOperatorDemoState();
      return false;
    }
    // Match solo queue order: first plan move, then diversify remaining by load key
    const first = all[0];
    const rest = diversifyQueueByLoad(all.slice(1));
    const moves = first ? [first].concat(rest) : rest;
    operatorDemo = {
      seeded: true,
      moves,
      index: 0,
      phase: 'pick',
      total: moves.length,
    };
    return true;
  }

  function operatorAllDone() {
    return (
      operatorDemo.seeded &&
      operatorDemo.total > 0 &&
      operatorDemo.index >= operatorDemo.total
    );
  }

  function currentOperatorMove() {
    if (!operatorDemo.seeded) return null;
    if (operatorDemo.index < 0 || operatorDemo.index >= operatorDemo.moves.length) return null;
    return operatorDemo.moves[operatorDemo.index] || null;
  }

  /** Advance pick→load, or load→next pick. @returns {boolean} */
  function advanceOperatorPhase() {
    if (!operatorDemo.seeded || operatorAllDone()) return false;
    if (operatorDemo.phase === 'pick') {
      operatorDemo.phase = 'load';
      return true;
    }
    operatorDemo.index += 1;
    operatorDemo.phase = 'pick';
    return true;
  }

  function onOperatorStart() {
    const plan = DockStorage.readLoadPlan();
    const moves = planMovesNormalized(plan);
    if (!moves.length) {
      toast('Build a load plan first (Dock → Plan)');
      updateOperatorEmptyHint();
      renderOperator();
      return;
    }
    const ok = seedOperatorDemo(plan);
    if (!ok) {
      toast('Build a load plan first (Dock → Plan)');
      renderOperator();
      return;
    }
    toast(`Operator — Move 1 of ${operatorDemo.total} · pick then load`);
    renderOperator();
  }

  function onOperatorUseDemoPlan() {
    const plan = DockStorage.readLoadPlan();
    const existingMoves = planMovesNormalized(plan);
    if (existingMoves.length) {
      const ok = seedOperatorDemo(plan);
      if (ok) {
        toast(`Operator — ${operatorDemo.total} moves from current plan`);
        renderOperator();
      }
      return;
    }
    const freight = DockStorage.readAll().length;
    if (freight > 0) {
      if (typeof DockLoadPlan === 'undefined' || !DockLoadPlan.runLoadPlan) {
        toast("Planner didn't load. Refresh the page and try again.");
        return;
      }
      const built = DockLoadPlan.runLoadPlan();
      renderPlan();
      renderOutboundList();
      renderGround();
      if (built && built.moves && built.moves.length) {
        seedCrewDemo(built);
      } else {
        resetCrewDemoState();
      }
      renderCrew();
      refreshLoadoutTrailerPicker();
      updateLoadoutPlanBanner();
      const ok = seedOperatorDemo(built);
      if (!ok) {
        toast('Nothing to plan yet — load freight first');
        renderOperator();
        return;
      }
      toast(`Operator — ${operatorDemo.total} moves · pick then load`);
      renderOperator();
      return;
    }
    // No freight — one-tap seed inbound + build + start (confirm wipe)
    toast('Opening confirm…');
    if (typeof DockLoadPlan === 'undefined' || !DockLoadPlan.seedDemoInbound) {
      toast("Planner didn't load. Refresh the page and try again.");
      return;
    }
    openConfirmSheet({
      title: 'Use demo plan',
      message:
        'Load demo inbound freight and build a load plan, then start Operator jobs? This replaces logged freight + last plan on this device.',
      action: 'seedDemoAndOperator',
    });
  }

  function onOperatorConfirmPrimary() {
    if (!operatorDemo.seeded) {
      onOperatorStart();
      return;
    }
    if (operatorAllDone()) {
      toast('Dock loaded — Reset to run again');
      renderOperator();
      return;
    }
    const wasPick = operatorDemo.phase === 'pick';
    advanceOperatorPhase();
    if (operatorAllDone()) {
      toast('Dock loaded — Ready');
    } else if (wasPick) {
      toast('Got it — now load');
    } else {
      const n = operatorDemo.index + 1;
      toast(`Loaded — Move ${n} of ${operatorDemo.total}`);
    }
    renderOperator();
  }

  function onOperatorStep() {
    if (!operatorDemo.seeded) {
      const ok = seedOperatorDemo(null);
      if (!ok) {
        toast('Build a load plan first (Dock → Plan)');
        updateOperatorEmptyHint();
        renderOperator();
        return;
      }
      renderOperator();
      toast('Ready — tap Step again (or Got it on forks)');
      return;
    }
    if (operatorAllDone()) {
      toast('Dock loaded — Reset to run again');
      renderOperator();
      return;
    }
    advanceOperatorPhase();
    renderOperator();
    if (operatorAllDone()) toast('Dock loaded — Ready');
  }

  function onOperatorReset() {
    const plan = DockStorage.readLoadPlan();
    const ok = seedOperatorDemo(plan);
    if (!ok) {
      resetOperatorDemoState();
      toast('No plan to reset — build a load plan first');
      updateOperatorEmptyHint();
      renderOperator();
      return;
    }
    toast('Operator reset — Move 1 pick');
    renderOperator();
  }

  function updateOperatorEmptyHint() {
    if (!el.operatorDemoPlanBtn) return;
    const plan = DockStorage.readLoadPlan();
    const hasMoves = planMovesNormalized(plan).length > 0;
    el.operatorDemoPlanBtn.hidden = hasMoves;
  }

  function renderOperator() {
    updateOperatorEmptyHint();
    // Hide Start once a job is active (still seeded and not finished)
    if (el.operatorStartBtn) {
      const hideStart =
        operatorDemo.seeded && !operatorAllDone();
      el.operatorStartBtn.hidden = hideStart;
    }

    if (el.operatorBackToSummaryBtn) {
      // v53: the boss summary is one tap away (no re-run needed)
      el.operatorBackToSummaryBtn.hidden = !(crewDemo.seeded && crewDemo.bossMode && crewDemoAllDone());
    }
    if (el.operatorProgress) {
      if (!operatorDemo.seeded) {
        // v53: ONE state line, matching the card below
        const nMoves = planMovesNormalized(DockStorage.readLoadPlan()).length;
        el.operatorProgress.textContent = nMoves
          ? 'Plan ready: ' + nMoves + ' moves · not started'
          : 'No plan yet';
      } else if (operatorAllDone()) {
        el.operatorProgress.textContent = `Move ${operatorDemo.total} of ${operatorDemo.total} · Remaining 0`;
      } else {
        const n = operatorDemo.index + 1;
        const afterThis = Math.max(0, operatorDemo.total - n);
        el.operatorProgress.textContent =
          `Move ${n} of ${operatorDemo.total} · ${afterThis} after this`;
      }
    }

    if (el.operatorDone) {
      el.operatorDone.hidden = !operatorAllDone();
    }

    if (!el.operatorJobCard) return;

    if (!operatorDemo.seeded) {
      const plan = DockStorage.readLoadPlan();
      const hasMoves = planMovesNormalized(plan).length > 0;
      el.operatorJobCard.innerHTML = hasMoves
        ? `<div class="empty-state">Tap <strong>Start my jobs</strong> to get move 1.</div>`
        : `<div class="empty-state">No plan yet. Load inbound + <strong>Build load plan</strong> on Plan, or tap <strong>Use demo plan</strong>.</div>`;
      return;
    }

    if (operatorAllDone()) {
      el.operatorJobCard.innerHTML = `
        <div class="operator-kicker">Operator</div>
        <div class="operator-title">Dock loaded — Ready</div>
        <div class="operator-phase-tag">All moves complete</div>
        <div class="operator-progress-line">Moved ${operatorDemo.total} of ${operatorDemo.total}</div>
      `;
      return;
    }

    const m = currentOperatorMove();
    if (!m) {
      el.operatorJobCard.innerHTML = `
        <div class="operator-kicker">Operator</div>
        <div class="operator-title">Waiting…</div>
      `;
      return;
    }

    const n = operatorDemo.index + 1;
    const phase = operatorDemo.phase;
    if (phase === 'pick') {
      const fromSlot = m.fromSlot
        ? `<div class="operator-slot"><span class="operator-slot-label">FROM SLOT</span> <span class="operator-slot-value">${escapeHtml(m.fromSlot)}</span></div>`
        : '';
      const proBits = [];
      if (m.pro) proBits.push(`PRO ${m.pro}`);
      if (m.pieceFraction) proBits.push(`piece ${m.pieceFraction}`);
      el.operatorJobCard.innerHTML = `
        <div class="operator-kicker">PICK · Move ${n} of ${operatorDemo.total}</div>
        <div class="operator-title">Go to door ${escapeHtml(m.fromDoor || '—')} trailer ${escapeHtml(m.fromTrailer || '—')}</div>
        <div class="operator-detail">and get ${escapeHtml(proBits.join(' · ') || 'freight')}${m.fromSlot ? ` in position ${escapeHtml(m.fromSlot)}` : ''}.</div>
        ${fromSlot}
        <button type="button" id="operatorConfirmBtn" class="btn accept-btn operator-confirm-btn">Got it on forks</button>
      `;
    } else {
      const loadSlot = m.toSlot
        ? `<div class="operator-slot operator-load-slot"><span class="operator-slot-label">LOAD SLOT</span> <span class="operator-slot-value">${escapeHtml(m.toSlot)}</span></div>`
        : '';
      const destBits = [];
      if (m.toDoor) destBits.push(`door ${m.toDoor}`);
      if (m.toTrailer) destBits.push(`trailer ${m.toTrailer}`);
      if (m.destination) destBits.push(m.destination);
      const destLine = destBits.length ? destBits.join(' · ') : 'outbound';
      const slotPhrase = m.toSlot ? ` in position ${escapeHtml(m.toSlot)}` : '';
      el.operatorJobCard.innerHTML = `
        <div class="operator-kicker">LOAD · Move ${n} of ${operatorDemo.total}</div>
        <div class="operator-title">Go to ${escapeHtml(destLine)}</div>
        <div class="operator-detail">and load${slotPhrase}.</div>
        ${loadSlot}
        <button type="button" id="operatorConfirmBtn" class="btn accept-btn operator-confirm-btn">Loaded</button>
      `;
    }

    const confirmBtn = document.getElementById('operatorConfirmBtn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => onOperatorConfirmPrimary());
    }
  }

  function bindOperator() {
    if (el.operatorStartBtn) {
      el.operatorStartBtn.addEventListener('click', () => onOperatorStart());
    }
    if (el.operatorDemoPlanBtn) {
      el.operatorDemoPlanBtn.addEventListener('click', () => onOperatorUseDemoPlan());
    }
    if (el.operatorStepBtn) {
      el.operatorStepBtn.addEventListener('click', () => onOperatorStep());
    }
    if (el.operatorResetBtn) {
      el.operatorResetBtn.addEventListener('click', () => onOperatorReset());
    }
    if (el.operatorBackToDockBtn) {
      el.operatorBackToDockBtn.addEventListener('click', () => {
        showView('dock');
        showDockSection('inbound');
      });
    }
    if (el.operatorBackToSummaryBtn) {
      el.operatorBackToSummaryBtn.addEventListener('click', () => {
        showView('dock');
        showDockSection('crew');
        renderCrew();
        const sum = el.crewDemoDone;
        if (sum && !sum.hidden) {
          try {
            sum.scrollIntoView({ block: 'start' });
          } catch (e) {
            /* ignore */
          }
        }
      });
    }
  }

  /**
   * Sort door id strings numerically when possible.
   * @param {Iterable<string>} ids
   * @returns {string[]}
   */
  function sortDoorIds(ids) {
    const uniq = Array.from(
      new Set(
        Array.from(ids || [])
          .map((d) => String(d == null ? '' : d).trim())
          .filter(Boolean)
      )
    );
    return uniq.sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }

  /**
   * Highest numeric door id seen in freight / plan / outbound / assignments.
   * Used for default N = max(20, highest).
   * @param {object[]} [list]
   * @returns {number}
   */
  function highestDoorSeenInData(list) {
    let max = 0;
    function consider(d) {
      const n = Number(String(d == null ? '' : d).trim());
      if (Number.isFinite(n) && n > max) max = n;
    }
    collectCrewPullDoors(list || []).forEach(consider);
    collectCrewOutDoors(list || []).forEach(consider);
    return max;
  }

  /**
   * @param {number} n
   * @returns {number}
   */
  function clampDockDoorCount(n) {
    const v = Math.round(Number(n));
    if (!Number.isFinite(v)) return DOCK_DOOR_COUNT_DEFAULT;
    return Math.min(DOCK_DOOR_COUNT_MAX, Math.max(DOCK_DOOR_COUNT_MIN, v));
  }

  /**
   * Default when nothing saved: max(20, highest door in data), capped at 80.
   * @param {object[]} [list]
   * @returns {number}
   */
  function defaultDockDoorCount(list) {
    return clampDockDoorCount(
      Math.max(DOCK_DOOR_COUNT_DEFAULT, highestDoorSeenInData(list))
    );
  }

  /**
   * Saved dock door count, or null if unset / invalid.
   * @returns {number|null}
   */
  function readSavedDockDoorCount() {
    try {
      const raw = localStorage.getItem(DOCK_DOOR_COUNT_KEY);
      if (raw == null || String(raw).trim() === '') return null;
      const n = Number(String(raw).trim());
      if (!Number.isFinite(n)) return null;
      return clampDockDoorCount(n);
    } catch (e) {
      return null;
    }
  }

  /**
   * Effective N for the Crew map (saved setting, else smart default).
   * @param {object[]} [list]
   * @returns {number}
   */
  function getDockDoorCount(list) {
    const saved = readSavedDockDoorCount();
    if (saved != null) return saved;
    return defaultDockDoorCount(list);
  }

  /**
   * Persist N and return clamped value.
   * @param {number|string} n
   * @returns {number}
   */
  function setDockDoorCount(n) {
    const v = clampDockDoorCount(n);
    try {
      localStorage.setItem(DOCK_DOOR_COUNT_KEY, String(v));
    } catch (e) {
      /* ignore quota */
    }
    return v;
  }

  /**
   * Visible pull doors = 1..N union any activity doors above N (or non-numeric).
   * @param {number} n
   * @param {string[]} activityDoors
   * @returns {string[]}
   */
  function visibleCrewPullDoors(n, activityDoors) {
    const count = clampDockDoorCount(n);
    const doors = [];
    for (let i = 1; i <= count; i++) doors.push(String(i));
    const set = new Set(doors);
    (activityDoors || []).forEach((d) => {
      const s = String(d || '').trim();
      if (!s || set.has(s)) return;
      const num = Number(s);
      if (Number.isFinite(num) && num > count) {
        set.add(s);
        doors.push(s);
      } else if (!Number.isFinite(num)) {
        set.add(s);
        doors.push(s);
      }
    });
    return sortDoorIds(doors);
  }

  /**
   * Pull / inbound doors in use: freight doorNumbers, plan move from.door,
   * demo inbound doors when that fallback is active, plus assignment fromDoors.
   * @param {object[]} [list] current crew assignments
   * @returns {string[]}
   */
  function collectCrewPullDoors(list) {
    const set = new Set();
    if (typeof DockStorage !== 'undefined' && DockStorage.allDoorNumbers) {
      DockStorage.allDoorNumbers().forEach((d) => {
        const s = String(d || '').trim();
        if (s) set.add(s);
      });
    }
    const plan =
      typeof DockStorage !== 'undefined' && DockStorage.readLoadPlan
        ? DockStorage.readLoadPlan()
        : null;
    if (plan && Array.isArray(plan.moves)) {
      plan.moves.forEach((m) => {
        const d = String((m.from && m.from.door) || '').trim();
        if (d) set.add(d);
      });
    }
    (list || []).forEach((a) => {
      const d = String(a.fromDoor || '').trim();
      if (d) set.add(d);
    });
    // Demo inbound doors present (DockLoadPlan.DEMO_INBOUND) — same fallback
    // deriveCrewAssignments uses when there is no freight/plan pull data yet.
    if (
      !set.size &&
      typeof DockLoadPlan !== 'undefined' &&
      Array.isArray(DockLoadPlan.DEMO_INBOUND)
    ) {
      DockLoadPlan.DEMO_INBOUND.forEach((ib) => {
        const d = String((ib && ib.door) || '').trim();
        if (d) set.add(d);
      });
    }
    return sortDoorIds(set);
  }

  /**
   * OUT / load doors in use: outbound trailer doorNumbers, plan move to.door,
   * plus assignment toDoors. No hardcoded 21–25.
   * @param {object[]} [list]
   * @returns {string[]}
   */
  function collectCrewOutDoors(list) {
    const set = new Set();
    if (typeof DockStorage !== 'undefined' && DockStorage.readOutboundTrailers) {
      DockStorage.readOutboundTrailers().forEach((row) => {
        const d = String((row && row.doorNumber) || '').trim();
        if (d) set.add(d);
      });
    }
    const plan =
      typeof DockStorage !== 'undefined' && DockStorage.readLoadPlan
        ? DockStorage.readLoadPlan()
        : null;
    if (plan && Array.isArray(plan.moves)) {
      plan.moves.forEach((m) => {
        const d = String((m.to && m.to.door) || '').trim();
        if (d) set.add(d);
      });
    }
    (list || []).forEach((a) => {
      const d = String(a.toDoor || '').trim();
      if (d) set.add(d);
    });
    return sortDoorIds(set);
  }

  /**
   * OUT doors that have planned freight (n > 0). Hides ghost chips like D23 SAT 0/0.
   * @param {object[]} [list]
   * @returns {string[]}
   */
  function collectCrewOutDoorsWithFreight(list) {
    return collectCrewOutDoors(list).filter((d) => outFillForDoor(d, list).n > 0);
  }

  /**
   * Resolve outbound trailer stub for an OUT door (registry, then plan load-outs, then assignments).
   * @param {string} door
   * @param {object[]} [list] crew assignments
   * @returns {{ door: string, trailerNumber: string, destination: string, cityFloorOnly: boolean }}
   */

  /** Short city code for HUD / OUT chips (3–4 letters when possible). */
  function shortDestLabel(destination) {
    const d = String(destination || '').trim();
    if (!d) return '';
    const known = {
      denver: 'DEN',
      'salt lake city': 'SLC',
      'san antonio': 'SAT',
      'missoula montana': 'MSO',
      'rapid city south dakota': 'RAP',
    };
    const key = d.toLowerCase();
    if (known[key]) return known[key];
    const words = d.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0].slice(0, 2) + words[1].slice(0, 2)).toUpperCase();
    }
    return d.slice(0, 4).toUpperCase();
  }

  /**
   * Inbound trailer # for a pull door (assignments, then freight, then plan).
   * @param {string} door
   * @param {object[]} [list]
   * @returns {string}
   */
  function inboundTrailerForDoor(door, list) {
    const d = String(door || '').trim();
    if (!d) return '';
    if (Array.isArray(list)) {
      const hit = list.find((a) => String(a.fromDoor || '').trim() === d && a.fromTrailer);
      if (hit) return String(hit.fromTrailer || '').trim();
    }
    if (typeof DockStorage !== 'undefined' && DockStorage.readAll) {
      const e = DockStorage.readAll().find(
        (row) => String(row.doorNumber || '').trim() === d && row.trailerNumber
      );
      if (e) return String(e.trailerNumber || '').trim();
    }
    const plan =
      typeof DockStorage !== 'undefined' && DockStorage.readLoadPlan
        ? DockStorage.readLoadPlan()
        : null;
    if (plan && Array.isArray(plan.moves)) {
      const m = plan.moves.find(
        (mv) => String((mv.from && mv.from.door) || '').trim() === d
      );
      if (m) return String((m.from && m.from.trailer) || '').trim();
    }
    return '';
  }

  /**
   * OUT fill k/n for a door — same done-key logic as OUT trailer panel.
   * @param {string} door
   * @param {object[]} list
   * @returns {{k:number, n:number, dest:string, shortDest:string, trailerNumber:string}}
   */
  function outFillForDoor(door, list) {
    const info = resolveOutTrailerForDoor(door, list);
    const pieces = piecesForOutboundTrailer(info.trailerNumber);
    const n = pieces.length;
    // v51: one count for chip, switcher, HUD pill and panel — pieces on board now
    // (freight loaded earlier in the shift counts as on board)
    const k = pieces.filter((p) => p.done).length;
    const pre = pieces.filter((p) => p.preloaded).length;
    return {
      k,
      n,
      pre,
      dest: info.destination || '',
      shortDest: shortDestLabel(info.destination || ''),
      trailerNumber: info.trailerNumber || '',
    };
  }

  function renderCrewGodHud(list) {
    if (!el.crewGodPulse && !el.crewGodOutPills) return;
    const rows = list || [];
    const live = rows.filter((a) => a && !a.idle).length;
    const idle = rows.filter((a) => a && a.idle).length;
    const moved = crewDemo.seeded ? crewDemo.doneCount : 0;
    const total = crewDemo.seeded ? crewDemo.total : 0;
    if (el.crewGodPulse) {
      el.crewGodPulse.textContent =
        '● ' + crewWorkLine() + (crewDemo.seeded ? ` · Moved ${moved} of ${total}` : '');
    }
    if (!el.crewGodOutPills) return;
    const outDoors = collectCrewOutDoorsWithFreight(rows);
    if (!outDoors.length) {
      el.crewGodOutPills.innerHTML =
        '<span class="crew-god-pill is-empty">No OUT yet</span>';
      return;
    }
    const frag = document.createDocumentFragment();
    outDoors.forEach((d) => {
      const fill = outFillForDoor(d, rows);
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'crew-god-pill';
      pill.setAttribute('data-door', d);
      pill.setAttribute('role', 'listitem');
      const label = fill.shortDest || 'OUT';
      pill.textContent = `D${d} ${label} ${fill.k}/${fill.n || 0}`;
      pill.title = `OUT Door ${d}` + (fill.dest ? ` · ${fill.dest}` : '') +
        ` · ${fill.k}/${fill.n} loaded`;
      pill.setAttribute(
        'aria-label',
        `OUT Door ${d}, ${fill.dest || 'outbound'}, ${fill.k} of ${fill.n} loaded`
      );
      // Tiny fill bar via CSS custom property
      const pct = fill.n > 0 ? Math.round((fill.k / fill.n) * 100) : 0;
      pill.style.setProperty('--fill-pct', String(pct));
      if (fill.n > 0 && fill.k >= fill.n) pill.classList.add('is-full');
      frag.appendChild(pill);
    });
    el.crewGodOutPills.innerHTML = '';
    el.crewGodOutPills.appendChild(frag);
  }

  function resolveOutTrailerForDoor(door, list) {
    const d = String(door || '').trim();
    let trailerNumber = '';
    let destination = '';
    let cityFloorOnly = false;

    if (d && typeof DockStorage !== 'undefined' && DockStorage.readOutboundTrailers) {
      const row = DockStorage.readOutboundTrailers().find(
        (r) => String((r && r.doorNumber) || '').trim() === d
      );
      if (row) {
        trailerNumber = String(row.trailerNumber || '').trim();
        destination = String(row.destination || '').trim();
        cityFloorOnly = Boolean(row.cityFloorOnly);
      }
    }

    const plan =
      typeof DockStorage !== 'undefined' && DockStorage.readLoadPlan
        ? DockStorage.readLoadPlan()
        : null;
    if (plan && Array.isArray(plan.outboundLoadouts)) {
      const load = plan.outboundLoadouts.find((L) => {
        const ld = resolvePutDoor({
          door: L.doorNumber || '',
          trailer: L.trailerNumber || '',
          destination: L.destination || '',
        });
        if (d && ld === d) return true;
        if (trailerNumber && String(L.trailerNumber || '').trim() === trailerNumber) return true;
        return false;
      });
      if (load) {
        if (!trailerNumber) trailerNumber = String(load.trailerNumber || '').trim();
        if (!destination) destination = String(load.destination || '').trim();
        cityFloorOnly = Boolean(load.cityFloorOnly);
      }
    }

    if ((!trailerNumber || !destination) && Array.isArray(list)) {
      const hit = list.find((a) => !a.idle && String(a.toDoor || '').trim() === d);
      if (hit) {
        if (!trailerNumber) trailerNumber = String(hit.toTrailer || '').trim();
        if (!destination) destination = String(hit.destination || '').trim();
      }
    }

    return { door: d, trailerNumber, destination, cityFloorOnly };
  }

  /**
   * Pieces planned into an outbound trailer — reuse plan outboundLoadouts / moves (no second model).
   * @param {string} trailerNumber
   * @returns {{ pro: string, pieceFraction: string, slot: string, fromDoor: string, fromTrailer: string, fromSlot: string, done: boolean }[]}
   */
  function piecesForOutboundTrailer(trailerNumber) {
    const t = String(trailerNumber || '').trim();
    if (!t) return [];
    const plan =
      typeof DockStorage !== 'undefined' && DockStorage.readLoadPlan
        ? DockStorage.readLoadPlan()
        : null;
    if (!plan) return [];

    /** @type {Set<string>} keys still remaining in demo (pro|piece|slot) */
    const remainingKeys = new Set();
    let trackDone = false;
    if (crewDemo.seeded) {
      trackDone = true;
      const mark = (m) => {
        if (!m) return;
        if (String(m.toTrailer || '').trim() !== t) return;
        remainingKeys.add(
          `${m.pro || ''}|${m.pieceFraction || ''}|${m.toSlot || ''}`
        );
      };
      crewDemo.queue.forEach(mark);
      crewDemo.active.forEach((a) => mark(a && a.move));
    }

    const isDone = (pro, pieceFraction, slot) => {
      if (!trackDone) return false;
      const key = `${pro || ''}|${pieceFraction || ''}|${slot || ''}`;
      return !remainingKeys.has(key);
    };

    const load = (plan.outboundLoadouts || []).find(
      (L) => String(L.trailerNumber || '').trim() === t
    );
    // Prefer outboundLoadouts groups as source of truth (even when empty)
    if (load && Array.isArray(load.groups)) {
      const out = [];
      // v51: freight loaded earlier in the shift (sample demo) — already on board
      (load.preloaded || []).forEach((p) => {
        out.push({
          pro: p.pro || '',
          pieceFraction: p.pieceFraction || '',
          slot: p.slot || '',
          weight: p.weight != null ? Number(p.weight) : null,
          w: p.w,
          d: p.d,
          h: p.h,
          kind: p.kind || '',
          noStack: Boolean(p.noStack),
          fromDoor: '',
          fromTrailer: '',
          fromSlot: '',
          done: true,
          preloaded: true,
        });
      });
      load.groups.forEach((g) => {
        (g.pieces || []).forEach((p) => {
          const pro = g.pro || p.pro || '';
          const pieceFraction = p.pieceFraction || '';
          const slot = p.slot || '';
          out.push({
            pro,
            pieceFraction,
            slot,
            weight: p.weight != null ? Number(p.weight) : null,
            w: p.w,
            d: p.d,
            h: p.h,
            kind: p.kind || '',
            noStack: Boolean(p.noStack),
            fromDoor: p.fromDoor || '',
            fromTrailer: p.fromTrailer || '',
            fromSlot: p.fromSlot || '',
            done: isDone(pro, pieceFraction, slot),
          });
        });
      });
      return out;
    }

    // Fallback: plan moves for this trailer
    const moves = Array.isArray(plan.moves) ? plan.moves : [];
    return moves
      .filter((m) => String((m.to && m.to.trailer) || '').trim() === t)
      .map((m) => {
        const pro = m.pro || '';
        const pieceFraction = m.pieceFraction || '';
        const slot = (m.to && m.to.slot) || '';
        return {
          pro,
          pieceFraction,
          slot,
          weight: m.weight != null ? Number(m.weight) : null,
          fromDoor: (m.from && m.from.door) || '',
          fromTrailer: (m.from && m.from.trailer) || '',
          fromSlot: (m.from && m.from.slot) || '',
          done: isDone(pro, pieceFraction, slot),
        };
      });
  }

  /**
   * Short trailer label for an OUT chip (glove scan).
   * @param {string} door
   * @param {object[]} list
   * @returns {string}
   */
  function outChipTrailerHint(door, list) {
    const info = resolveOutTrailerForDoor(door, list);
    if (info.trailerNumber) return `Trl ${info.trailerNumber}`;
    if (info.destination) return info.destination;
    return '';
  }

  /**
   * Parse slot label like "1/A/Left" safely. Bad labels → null (ignored).
   * @param {string} slot
   * @returns {{section:number, level:string}|null}
   */
  function parseSlotSectionLevel(slot) {
    const full = parseSlotFull(slot);
    if (!full) return null;
    return { section: full.section, level: full.level };
  }

  /**
   * Full slot parse: section / level / lateral (Left|Middle|Right).
   * @param {string} slot
   * @returns {{section:number, level:string, lateral:string}|null}
   */
  function parseSlotFull(slot) {
    const s = String(slot || '').trim();
    if (!s) return null;
    const m = s.match(/^(\d{1,2})\s*\/\s*([A-Ca-c])(?:\s*\/\s*(Left|Middle|Right))?/i);
    if (!m) return null;
    const section = Number(m[1]);
    if (!Number.isFinite(section) || section < 1 || section > 12) return null;
    const lateralRaw = m[3] ? String(m[3]) : '';
    const lateral =
      /^left$/i.test(lateralRaw)
        ? 'Left'
        : /^middle$/i.test(lateralRaw)
          ? 'Middle'
          : /^right$/i.test(lateralRaw)
            ? 'Right'
            : '';
    return { section, level: m[2].toUpperCase(), lateral };
  }

  /** Plain deck name for UI (no jargon). @param {string} level */
  function deckLevelPlainName(level) {
    const L = String(level || '').toUpperCase();
    if (L === 'A') return 'Floor';
    if (L === 'B') return 'Deck 2';
    if (L === 'C') return 'Deck 3';
    return L || '—';
  }

  /**
   * Height line under a deck heading. Uses known ~45 in clear above floor freight.
   * @param {string} level
   */
  function deckHeightPlainLine(level) {
    const L = String(level || '').toUpperCase();
    if (L === 'A') return 'On the trailer floor';
    if (L === 'B') return 'Second level, on load bars above the floor';
    if (L === 'C') return 'Third level, on load bars above Deck 2';
    return '';
  }

  /**
   * Levels that have freight on this trailer (lowest first: Floor → Deck 2 → Deck 3).
   * City floor-only → Floor only. Empty trailer → Floor (empty plan).
   * @param {{slot:string}[]} pieces
   * @param {boolean} cityFloorOnly
   * @returns {string[]}
   */
  function availableDeckLevelsForPieces(pieces, cityFloorOnly) {
    if (cityFloorOnly) return ['A'];
    const have = new Set();
    (pieces || []).forEach((p) => {
      const parsed = parseSlotSectionLevel(p && p.slot);
      if (parsed) have.add(parsed.level);
    });
    const order = ['A', 'B', 'C'];
    const found = order.filter((L) => have.has(L));
    return found.length ? found : ['A'];
  }

  /** Stable key for a planned piece row. */
  function crewOutPieceKey(p) {
    if (!p) return '';
    return `${p.pro || ''}|${p.pieceFraction || ''}|${p.slot || ''}`;
  }

  /** Short cell label for top-down (piece fraction preferred). */
  function topDownPieceShortLabel(p) {
    if (!p) return '';
    const frac = String(p.pieceFraction || '').trim();
    if (frac) return frac;
    const pro = String(p.pro || '').trim();
    if (pro.length > 4) return pro.slice(-4);
    return pro || '·';
  }

  /**
   * Side-view trailer fill picture for OUT panel (nose=1 left → tail=12 right).
   * Each cell = section × level; filled if any Left/Middle/Right is occupied.
   * @param {{slot:string, done:boolean}[]} pieces
   * @param {boolean} cityFloorOnly
   * @returns {string} HTML
   */

  /**
   * v48 PUP axle / nose+tail zone weight limits (display mirrors planner caps).
   * Sections 1–12 nose→tail. Nose zone ≈ first bay (sec 1, ~4 ft). Tail ≈ last bay (sec 12).
   * Axle share: secs 1–6 → front axle, 7–12 → rear axle.
   */
  const PUP_AXLE_CAP_LB = 20000;
  const PUP_ZONE_WARN_LB = 2800;
  const PUP_ZONE_MAX_LB = 3200;
  const PUP_NOSE_WARN_LB = PUP_ZONE_WARN_LB; // alias
  const PUP_NOSE_MAX_LB = PUP_ZONE_MAX_LB;
  const PUP_NOSE_SECTIONS = [1]; // first bay ≈ 4 ft
  const PUP_TAIL_SECTIONS = [12]; // last bay ≈ 4 ft
  const PUP_FRONT_SECTIONS = [1, 2, 3, 4, 5, 6];
  const PUP_REAR_SECTIONS = [7, 8, 9, 10, 11, 12];

  /** v50: ONE rule for all four cells — green < 95%, amber 95–100% ("at target"), red over cap. */
  const WEIGHT_TARGET_RATIO = 0.95;

  function weightCellStatus(value, cap) {
    const v = Number(value) || 0;
    if (v > cap) return { cls: 'is-hot', tag: 'over limit', level: 2 };
    if (v >= cap * WEIGHT_TARGET_RATIO) return { cls: 'is-warm', tag: 'at target', level: 1 };
    return { cls: '', tag: '', level: 0 };
  }

  function computePupAxleWeights(pieces) {
    let front = 0;
    let rear = 0;
    let nose = 0;
    let tail = 0;
    let total = 0;
    let known = false;
    (pieces || []).forEach((p) => {
      const w = Number(p && p.weight);
      if (!Number.isFinite(w) || w < 0) return;
      known = true;
      total += w;
      const parsed = parseSlotSectionLevel(p.slot);
      const sec = parsed ? parsed.section : 0;
      if (PUP_NOSE_SECTIONS.indexOf(sec) >= 0) nose += w;
      if (PUP_TAIL_SECTIONS.indexOf(sec) >= 0) tail += w;
      // v51: same lever split the planner uses (a piece's weight is shared by
      // the front support and the rear axle by where it sits)
      const r =
        typeof DockLoadPlan !== 'undefined' && DockLoadPlan.axleRearShare
          ? DockLoadPlan.axleRearShare(sec)
          : sec >= 7 ? 1 : sec ? 0 : 0.5;
      rear += w * r;
      front += w * (1 - r);
    });
    const fs = weightCellStatus(front, PUP_AXLE_CAP_LB);
    const rs = weightCellStatus(rear, PUP_AXLE_CAP_LB);
    const ns = weightCellStatus(nose, PUP_ZONE_MAX_LB);
    const ts = weightCellStatus(tail, PUP_ZONE_MAX_LB);
    /** @type {string[]} */
    const messages = [];
    if (ns.level === 2) messages.push('Nose over 3,200 lb — use lighter freight here');
    if (ts.level === 2) messages.push('Tail over 3,200 lb — use lighter freight here');
    if (fs.level === 2) messages.push('Front axle over 20,000 lb (' + Math.round(front).toLocaleString('en-US') + ' lb)');
    if (rs.level === 2) messages.push('Rear axle over 20,000 lb (' + Math.round(rear).toLocaleString('en-US') + ' lb)');
    return {
      frontAxle: front,
      rearAxle: rear,
      nose,
      tail,
      total,
      frontOver: fs.level === 2,
      rearOver: rs.level === 2,
      frontWarn: fs.level === 1,
      rearWarn: rs.level === 1,
      noseWarn: ns.level === 1,
      noseOver: ns.level === 2,
      tailWarn: ts.level === 1,
      tailOver: ts.level === 2,
      messages,
      known,
    };
  }

  /**
   * v50 weight strip: LIVE "loaded so far" (grows with each move) as the big
   * number, the planned full-load value as a second line, one amber rule for
   * all four cells, and one plain line on why the limits differ.
   */
  function buildTrailerWeightBannerHtml(pieces) {
    const list = pieces || [];
    const planned = computePupAxleWeights(list);
    if (!planned.known) {
      return (
        '<div class="trailer-weight-banner is-unknown" role="status">' +
        'Weights not on this plan yet — axle check skipped' +
        '</div>'
      );
    }
    const loadedList = list.filter((p) => p && p.done);
    const live = computePupAxleWeights(loadedList);
    const cells = [
      { label: 'Front axle', live: live.frontAxle, plan: planned.frontAxle, cap: PUP_AXLE_CAP_LB, capTxt: 'max 20,000 (federal)' },
      { label: 'Rear axle', live: live.rearAxle, plan: planned.rearAxle, cap: PUP_AXLE_CAP_LB, capTxt: 'max 20,000 (federal)' },
      { label: 'Nose (first 4 ft)', live: live.nose, plan: planned.nose, cap: PUP_ZONE_MAX_LB, capTxt: 'max 3,200 (company)' },
      { label: 'Tail (last 4 ft)', live: live.tail, plan: planned.tail, cap: PUP_ZONE_MAX_LB, capTxt: 'max 3,200 (company)' },
    ];
    let worst = 0;
    const cellHtml = cells
      .map((c) => {
        const st = weightCellStatus(c.live, c.cap);
        const pst = weightCellStatus(c.plan, c.cap);
        worst = Math.max(worst, st.level);
        return (
          '<div class="trailer-weight-cell' + (st.cls ? ' ' + st.cls : '') + '">' +
          '<span class="trailer-weight-label">' + escapeHtml(c.label) + '</span>' +
          '<span class="trailer-weight-val">' + escapeHtml(fmtLb(c.live)) + '</span>' +
          '<span class="trailer-weight-cap">' + escapeHtml(c.capTxt) +
          (st.tag ? ' · <b class="trailer-weight-tag">' + escapeHtml(st.tag) + '</b>' : '') +
          '</span>' +
          '<span class="trailer-weight-plan">planned at full load: ' + escapeHtml(fmtLb(c.plan)) +
          (pst.tag ? ' (' + escapeHtml(pst.tag) + ')' : '') +
          (c.label.indexOf('Tail') === 0 && !c.plan ? ' · tail left open for the next pickup' : '') + '</span>' +
          '</div>'
        );
      })
      .join('');
    const cls =
      'trailer-weight-banner ' + (worst === 2 ? 'is-over' : worst === 1 ? 'is-warn' : 'is-ok');
    const msgs = live.messages.length
      ? '<ul class="trailer-weight-msgs">' +
        live.messages.map((m) => '<li>' + escapeHtml(m) + '</li>').join('') +
        '</ul>'
      : '';
    const title =
      'Weight check · ' + EQUIP_SHORT + ' · on board now: ' + loadedList.length + ' of ' + list.length + ' pieces';
    return (
      '<div class="' + cls + '" role="status">' +
      '<div class="trailer-weight-title">' + escapeHtml(title) + '</div>' +
      '<div class="trailer-weight-grid">' + cellHtml + '</div>' +
      msgs +
      '<p class="trailer-weight-legend">Green = under 95% of the limit · amber "at target" = 95–100%, filled close to the limit on purpose · red = over.</p>' +
      '<p class="trailer-weight-why">' + escapeHtml(EQUIP_LONG) + ' The 3,200 lb nose/tail limit (the first and last 4 ft section) is a company setting. Each piece\'s weight is shared by the front and rear axles by where it sits, so loading from the nose starts front-heavy and evens out as the trailer fills. Balanced = the heavier axle carries no more than 25% more than the lighter.</p>' +
      '</div>'
    );
  }

  /**
   * v54: pieces grouped by space (section/level), Left → Middle → Right, so a
   * side view can draw every piece (up to 3 sit side by side in one space).
   * @returns {Map<string, {p:object, lat:string}[]>}
   */
  function piecesBySpace(pieces) {
    const order = { left: 0, middle: 1, right: 2 };
    const map = new Map();
    (pieces || []).forEach((p) => {
      const f = parseSlotFull(p && p.slot);
      if (!f) return;
      const key = f.section + '/' + f.level;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ p, lat: String(f.lateral || '') });
    });
    map.forEach((arr) =>
      arr.sort((a, b) => {
        const x = order[a.lat.toLowerCase()];
        const y = order[b.lat.toLowerCase()];
        return (x == null ? 1 : x) - (y == null ? 1 : y);
      })
    );
    return map;
  }

  /** v54: one small block per piece in a space (loaded / planned / loaded earlier). */
  function pieceBlocksHtml(arr, justKey) {
    return (arr || [])
      .map(({ p, lat }) => {
        const cls = p.preloaded ? 'is-pre' : p.done ? 'is-loaded' : 'is-planned';
        const just = justKey && crewOutPieceKey(p) === justKey ? ' is-just' : '';
        const t = (lat || 'piece') + ' · ' + (p.preloaded ? 'loaded earlier' : p.done ? 'loaded' : 'planned') +
          (Number.isFinite(Number(p.weight)) ? ' · ' + fmtLb(p.weight) : '');
        return '<i class="tfp ' + cls + just + '" title="' + escapeHtml(t) + '"></i>';
      })
      .join('');
  }

  /**
   * v54: small side view inside the tour card, so the trailer picture stays in
   * view with the card on a phone: 12 sections × Floor / Deck 2 / Deck 3, one
   * block per piece, the piece just loaded outlined.
   */
  function buildMiniSideViewHtml(pieces) {
    const list = pieces || [];
    if (!list.length) return '';
    const bySpace = piecesBySpace(list);
    const justKey = state.crewOutJustLoadedKey ? String(state.crewOutJustLoadedKey) : '';
    const rows = [['C', 'Deck 3'], ['B', 'Deck 2'], ['A', 'Floor']]
      .map(([lvl, name]) => {
        let cells = '';
        for (let sec = 1; sec <= 12; sec++) {
          const arr = bySpace.get(sec + '/' + lvl) || [];
          cells += '<span class="msv-cell' + (arr.length ? '' : ' is-empty') + '">' + pieceBlocksHtml(arr, justKey) + '</span>';
        }
        return '<div class="msv-row"><span class="msv-lvl">' + name + '</span><span class="msv-cells">' + cells + '</span></div>';
      })
      .join('');
    return (
      '<div class="msv" role="img" aria-label="Side view: 12 sections from nose to tail, Floor, Deck 2 and Deck 3; one block per piece">' +
      '<div class="msv-ends"><span>NOSE (sec 1)</span><span>side view · 1 block = 1 piece</span><span>TAIL (12)</span></div>' +
      rows +
      '</div>'
    );
  }

  function buildTrailerFillDiagramHtml(pieces, cityFloorOnly) {
    const levels = cityFloorOnly ? ['A'] : ['C', 'B', 'A'];
    const list = pieces || [];
    const bySpace = piecesBySpace(list);
    const totalPieces = list.length;
    const loadedPieces = list.filter((p) => p && p.done).length;
    /** @type {Map<string, {planned:boolean, loaded:boolean}>} */
    const cellMap = new Map();
    list.forEach((p) => {
      const parsed = parseSlotSectionLevel(p && p.slot);
      if (!parsed) return;
      if (cityFloorOnly && parsed.level !== 'A') return;
      if (!cityFloorOnly && levels.indexOf(parsed.level) < 0) return;
      const key = parsed.section + '/' + parsed.level;
      let cell = cellMap.get(key);
      if (!cell) {
        cell = { planned: false, loaded: false, pre: false };
        cellMap.set(key, cell);
      }
      if (p.preloaded) cell.pre = true;
      // Loaded wins when any piece in this space is done
      if (p.done) cell.loaded = true;
      else cell.planned = true;
    });

    const totalSpaces = 12 * levels.length;
    let usedSpaces = 0;
    let loadedSpaces = 0;
    for (let sec = 1; sec <= 12; sec++) {
      levels.forEach((lvl) => {
        const cell = cellMap.get(sec + '/' + lvl);
        if (cell && (cell.loaded || cell.planned)) usedSpaces += 1;
        if (cell && cell.loaded) loadedSpaces += 1;
      });
    }

    // Same unit as panel header: pieces
    // v52: honest fill copy — same numbers as the summary
    const fillInfo = trailerFillInfo(list);
    const captionMain = !totalPieces
      ? 'Empty trailer'
      : loadedPieces >= totalPieces
        ? 'Loaded nose to tail · ' + fillInfo.line
        : 'Loading nose to tail · when done: ' + fillInfo.line;
    const preInList = list.filter((p) => p.preloaded).length;
    const captionSub =
      'trailer: ' + (loadedPieces === totalPieces ? totalPieces : loadedPieces + ' of ' + totalPieces) + ' pieces on board' +
      (preInList ? ' (' + preInList + ' loaded earlier)' : '') + ' · ' +
      (loadedPieces >= totalPieces
        ? usedSpaces + ' of ' + totalSpaces + ' spaces used'
        : loadedSpaces + ' of ' + totalSpaces + ' spaces in use (' + usedSpaces + ' when done)');
    // v53: say what a "space" is, so pieces vs spaces isn't confusing
    const spacesNote =
      'A space = one section on one level (' + 12 + ' sections × ' + levels.length + (levels.length === 1 ? ' level' : ' levels: Floor, Deck 2, Deck 3') +
      ' = ' + totalSpaces + '). Up to 3 pieces sit side by side in one space (left, middle, right), so pieces outnumber spaces. Each small block is one piece.';

    let rowsHtml = '';
    // v50: highlight the cell the current tour card just loaded
    let justCell = '';
    if (state.crewOutJustLoadedKey) {
      const jp = (pieces || []).find(
        (p) => crewOutPieceKey(p) === String(state.crewOutJustLoadedKey)
      );
      const jParsed = jp ? parseSlotSectionLevel(jp.slot) : null;
      if (jParsed) justCell = jParsed.section + '/' + jParsed.level;
    }
    levels.forEach((lvl) => {
      let cells = '';
      for (let sec = 1; sec <= 12; sec++) {
        const cell = cellMap.get(sec + '/' + lvl);
        let cls = 'trailer-fill-cell is-empty';
        let title = 'Sec ' + sec + ' · ' + lvl + ' · empty';
        if (cell && cell.pre) {
          cls = 'trailer-fill-cell is-loaded is-preloaded';
          title = 'Sec ' + sec + ' · ' + lvl + ' · loaded earlier in the shift';
        } else if (cell && cell.loaded) {
          cls = 'trailer-fill-cell is-loaded';
          title = 'Sec ' + sec + ' · ' + lvl + ' · loaded';
        } else if (cell && cell.planned) {
          cls = 'trailer-fill-cell is-planned';
          title = 'Sec ' + sec + ' · ' + lvl + ' · planned';
        }
        // v54: one block per piece, so 3 pieces side by side show as 3 blocks
        const spaceArr = bySpace.get(sec + '/' + lvl) || [];
        if (spaceArr.length) title += ' · ' + spaceArr.length + ' piece' + (spaceArr.length === 1 ? '' : 's');
        cells +=
          '<span class="' +
          cls +
          (spaceArr.length ? ' has-blocks' : '') +
          (justCell === sec + '/' + lvl ? ' is-just-loaded' : '') +
          '" title="' +
          escapeHtml(title) +
          '" aria-label="' +
          escapeHtml(title) +
          '">' + pieceBlocksHtml(spaceArr, state.crewOutJustLoadedKey ? String(state.crewOutJustLoadedKey) : '') + '</span>';
      }
      const lvlLabel = lvl === 'A' ? 'Floor' : lvl === 'B' ? 'Deck 2 (second level)' : 'Deck 3 (third level)';
      rowsHtml +=
        '<div class="trailer-fill-row" data-level="' +
        lvl +
        '">' +
        '<span class="trailer-fill-level" aria-hidden="true">' +
        escapeHtml(lvl === 'A' ? 'Floor' : lvl === 'B' ? 'Deck 2' : 'Deck 3') +
        '</span>' +
        '<div class="trailer-fill-cells" role="presentation">' +
        cells +
        '</div>' +
        '<span class="trailer-fill-level-sr">' +
        escapeHtml(lvlLabel) +
        '</span>' +
        '</div>';
    });

    return (
      '<div class="trailer-fill-diagram" role="img" aria-label="' +
      escapeHtml(captionMain + '. ' + captionSub) +
      '">' +
      '<div class="trailer-fill-ends" aria-hidden="true">' +
      '<span class="trailer-fill-nose">NOSE</span>' +
      '<span class="trailer-fill-tail">TAIL</span>' +
      '</div>' +
      '<div class="trailer-fill-grid">' +
      rowsHtml +
      '</div>' +
      '<div class="trailer-fill-caption">' +
      escapeHtml(captionMain) +
      '</div>' +
      '<div class="trailer-fill-caption-sub">' +
      escapeHtml(captionSub) +
      '</div>' +
      '<div class="trailer-fill-spaces-note">' + escapeHtml(spacesNote) + '</div>' +
      '<div class="trailer-fill-legend" aria-hidden="true">' +
      '<span><i class="trailer-fill-swatch is-empty"></i> empty</span>' +
      '<span><i class="trailer-fill-swatch is-planned"></i> planned</span>' +
      '<span><i class="trailer-fill-swatch is-loaded"></i> loaded</span>' +
      (list.some((p) => p && p.preloaded)
        ? '<span><i class="trailer-fill-swatch is-loaded is-preloaded"></i> loaded earlier (earlier shift, same planner)</span>'
        : '') +
      '</div>' +
      '</div>'
    );
  }

  /**
   * Loud who’s-where banner near god HUD — busy ops + distinct OUT doors.
   * @param {object[]} list
   */

  /**
   * v48 Top-down (bird's-eye) trailer floor plan for one deck at a time.
   * Nose at top → Tail at bottom. Width columns: Left | Mid-L | Mid-R | Right.
   * Existing SLOT …/Middle pieces span both middle halves (display-only).
   * @param {{slot:string, done:boolean, pro?:string, pieceFraction?:string}[]} pieces
   * @param {boolean} cityFloorOnly
   * @param {string} selectedLevel 'A'|'B'|'C'
   * @returns {string} HTML
   */
  function buildTrailerTopDownDiagramHtml(pieces, cityFloorOnly, selectedLevel) {
    const list = pieces || [];
    const levels = availableDeckLevelsForPieces(list, cityFloorOnly);
    let level = String(selectedLevel || state.crewOutTopDeck || 'A').toUpperCase();
    if (levels.indexOf(level) < 0) level = levels[0] || 'A';
    state.crewOutTopDeck = level;

    const onDeck = list.filter((p) => {
      const parsed = parseSlotFull(p && p.slot);
      if (!parsed) return false;
      return parsed.level === level;
    });

    // Map section → { Left?, Middle?, Right? } piece refs
    /** @type {Map<number, {Left?:object, Middle?:object, Right?:object}>} */
    const bySec = new Map();
    for (let sec = 1; sec <= 12; sec++) bySec.set(sec, {});
    onDeck.forEach((p) => {
      const parsed = parseSlotFull(p.slot);
      if (!parsed || !parsed.lateral) return;
      const row = bySec.get(parsed.section);
      if (!row) return;
      // First wins; unique slots expected
      if (!row[parsed.lateral]) row[parsed.lateral] = p;
    });

    const selectedKey = state.crewOutSelectedPieceKey
      ? String(state.crewOutSelectedPieceKey)
      : '';

    // Deck jump buttons — only decks that exist on this trailer
    let jumps =
      '<div class="trailer-deck-jumps" role="tablist" aria-label="Pick a deck">';
    levels.forEach((L) => {
      const active = L === level;
      jumps +=
        '<button type="button" class="trailer-deck-jump' +
        (active ? ' is-active' : '') +
        '" role="tab" aria-selected="' +
        (active ? 'true' : 'false') +
        '" data-deck-level="' +
        L +
        '">' +
        escapeHtml(deckLevelPlainName(L)) +
        '</button>';
    });
    jumps += '</div>';

    const heightLine = deckHeightPlainLine(level);
    const head =
      '<div class="trailer-top-deck-head">' +
      '<div class="trailer-top-deck-name">' +
      escapeHtml(deckLevelPlainName(level)) +
      '</div>' +
      (heightLine
        ? '<div class="trailer-top-deck-height">' + escapeHtml(heightLine) + '</div>'
        : '') +
      '</div>';

    // Column headers
    const colHead =
      '<div class="trailer-top-colheads" aria-hidden="true">' +
      '<span class="trailer-top-sec-label"></span>' +
      '<span>Left</span><span>Mid-L</span><span>Mid-R</span><span>Right</span>' +
      '</div>';

    function cellHtml(p, extraClass, spanMid) {
      if (!p) {
        return (
          '<span class="trailer-top-cell is-empty' +
          (extraClass ? ' ' + extraClass : '') +
          '" aria-hidden="true"></span>'
        );
      }
      const key = crewOutPieceKey(p);
      const isSel = selectedKey && key === selectedKey;
      let cls = 'trailer-top-cell is-piece';
      cls += p.done ? ' is-loaded' : ' is-planned';
      if (p.preloaded) cls += ' is-preloaded';
      if (p.noStack) cls += ' is-fragile';
      if (isSel) cls += ' is-selected';
      if (state.crewOutJustLoadedKey && key === String(state.crewOutJustLoadedKey))
        cls += ' is-just-loaded';
      if (spanMid) cls += ' is-mid-span';
      if (extraClass) cls += ' ' + extraClass;
      const label = topDownPieceShortLabel(p);
      const titleBits = [
        p.pro ? 'PRO ' + p.pro : '',
        p.pieceFraction ? 'piece ' + p.pieceFraction : '',
        p.slot || '',
        formatPieceSize(p),
        p.noStack ? 'fragile, nothing on top' : '',
        p.preloaded ? 'loaded earlier in the shift' : p.done ? 'loaded' : 'planned',
      ].filter(Boolean);
      return (
        '<button type="button" class="' +
        cls +
        '" data-piece-key="' +
        escapeHtml(key) +
        '" title="' +
        escapeHtml(titleBits.join(' · ')) +
        '" aria-label="' +
        escapeHtml(titleBits.join(' · ')) +
        '">' +
        '<span class="trailer-top-cell-label">' +
        escapeHtml(label) +
        '</span></button>'
      );
    }

    // v50: zone colours follow what is loaded so far during the demo
    const axleSnap = computePupAxleWeights(
      crewDemo.seeded ? list.filter((p) => p && p.done) : list
    );
    let rows = '';
    rows +=
      '<div class="trailer-top-nose-tag" aria-hidden="true">NOSE</div>';
    for (let sec = 1; sec <= 12; sec++) {
      const row = bySec.get(sec) || {};
      const left = row.Left || null;
      const mid = row.Middle || null;
      const right = row.Right || null;
      const isNose = PUP_NOSE_SECTIONS.indexOf(sec) >= 0;
      const isTail = PUP_TAIL_SECTIONS.indexOf(sec) >= 0;
      let rowCls = 'trailer-top-row';
      if (isNose) rowCls += ' is-nose-zone';
      if (isTail) rowCls += ' is-tail-zone';
      if (isNose && axleSnap.noseOver) rowCls += ' is-nose-over';
      else if (isNose && axleSnap.noseWarn) rowCls += ' is-nose-warn';
      if (isTail && axleSnap.tailOver) rowCls += ' is-tail-over';
      else if (isTail && axleSnap.tailWarn) rowCls += ' is-tail-warn';
      rows +=
        '<div class="' +
        rowCls +
        '" data-section="' +
        sec +
        '">' +
        '<span class="trailer-top-sec" aria-hidden="true">' +
        sec +
        (sec === 1 || sec === 2 || sec === 5 || sec === 9 || sec === 12
          ? '<em class="trailer-top-zone">' + escapeHtml(sectionZoneName(sec)) + '</em>'
          : '') +
        '</span>' +
        '<div class="trailer-top-cells">';
      rows += cellHtml(left, 'is-lat-left', false);
      if (mid) {
        // One Middle piece spans Mid-L + Mid-R (half-width columns kept for layout)
        rows += cellHtml(mid, 'is-lat-middle', true);
      } else {
        rows += cellHtml(null, 'is-lat-midl', false);
        rows += cellHtml(null, 'is-lat-midr', false);
      }
      rows += cellHtml(right, 'is-lat-right', false);
      rows += '</div></div>';
    }
    rows +=
      '<div class="trailer-top-tail-tag" aria-hidden="true">TAIL</div>';

    const emptyMsg =
      !list.length
        ? '<div class="trailer-top-empty-msg">Nothing loaded yet</div>'
        : !onDeck.length
          ? '<div class="trailer-top-empty-msg">Nothing on ' +
            escapeHtml(deckLevelPlainName(level)) +
            ' yet</div>'
          : '';

    const captionMain =
      onDeck.length === 0
        ? deckLevelPlainName(level) + ' · empty'
        : crewDemo.seeded
          ? deckLevelPlainName(level) +
            ' · ' +
            onDeck.filter((p) => p.done).length +
            ' of ' +
            onDeck.length +
            ' pieces loaded'
          : deckLevelPlainName(level) +
            ' · ' +
            onDeck.length +
            ' piece' +
            (onDeck.length === 1 ? '' : 's');

    const detail =
      selectedKey
        ? (() => {
            const p = list.find((x) => crewOutPieceKey(x) === selectedKey);
            if (!p) return '';
            const bits = [
              p.pro ? 'PRO ' + p.pro : '',
              p.pieceFraction ? 'piece ' + p.pieceFraction : '',
              p.slot ? 'SLOT ' + p.slot : '',
              p.slot ? sectionZoneName((parseSlotFull(p.slot) || {}).section) : '',
              formatPieceSize(p),
              p.weight ? fmtLb(p.weight) : '',
              p.noStack ? 'Fragile, nothing on top' : '',
              p.preloaded ? 'Loaded earlier in the shift' : p.done ? 'Loaded' : 'Planned',
            ].filter(Boolean);
            return (
              '<div class="trailer-top-piece-detail" role="status">' +
              escapeHtml(bits.join(' · ')) +
              '</div>'
            );
          })()
        : '';

    return (
      '<div class="trailer-topdown-diagram" role="group" aria-label="Top-down trailer view">' +
      jumps +
      head +
      emptyMsg +
      '<div class="trailer-top-plan">' +
      colHead +
      rows +
      '</div>' +
      detail +
      '<div class="trailer-fill-caption">' +
      escapeHtml(captionMain) +
      '</div>' +
      '<div class="trailer-fill-legend" aria-hidden="true">' +
      '<span><i class="trailer-fill-swatch is-empty"></i> empty</span>' +
      '<span><i class="trailer-fill-swatch is-planned"></i> planned</span>' +
      '<span><i class="trailer-fill-swatch is-loaded"></i> loaded</span>' +
      (list.some((p) => p && p.preloaded)
        ? '<span><i class="trailer-fill-swatch is-loaded is-preloaded"></i> loaded earlier (earlier shift, same planner)</span>'
        : '') +
      '</div>' +
      '<div class="trailer-top-mid-hint" aria-hidden="true">Middle splits into Mid-L and Mid-R</div>' +
      '</div>'
    );
  }

  /** Side view | Top-down tab strip for OUT trailer panel. */
  function buildTrailerViewTabsHtml(mode) {
    const m = mode === 'top' ? 'top' : 'side';
    return (
      '<div class="trailer-view-tabs" role="tablist" aria-label="Trailer picture">' +
      '<button type="button" class="trailer-view-tab' +
      (m === 'side' ? ' is-active' : '') +
      '" role="tab" aria-selected="' +
      (m === 'side' ? 'true' : 'false') +
      '" data-trailer-view="side">Side view</button>' +
      '<button type="button" class="trailer-view-tab' +
      (m === 'top' ? ' is-active' : '') +
      '" role="tab" aria-selected="' +
      (m === 'top' ? 'true' : 'false') +
      '" data-trailer-view="top">Top-down</button>' +
      '</div>'
    );
  }

  function renderCrewSpreadBanner(list) {
    const banner = el.crewSpreadBanner;
    if (!banner) return;
    banner.hidden = false;
    if (!crewDemo.seeded) {
      banner.className = 'crew-spread-banner is-hint';
      banner.textContent = 'Tap Show boss demo: 5 sample forklifts finish 5 outbound trailers.';
      return;
    }
    if (crewDemo.mode === 'solo') {
      banner.className = 'crew-spread-banner is-solo';
      banner.textContent = crewDemoAllDone()
        ? 'Done — the forklift finished every move'
        : '1 of 1 forklift working · one door at a time';
      return;
    }
    // v51: literal and checkable — never two forklifts in one OUT trailer at the same time
    /** @type {Map<string, number>} */
    const doorCounts = new Map();
    (list || []).forEach((a) => {
      if (!a || a.idle) return;
      const d = String(a.toDoor || '').trim();
      if (d) doorCounts.set(d, (doorCounts.get(d) || 0) + 1);
    });
    const stacked = [];
    doorCounts.forEach((n, d) => {
      if (n > 1) stacked.push(n + ' forklifts on OUT ' + d);
    });
    if (stacked.length) {
      banner.className = 'crew-spread-banner is-warn';
      banner.textContent = stacked.join(' · ');
      return;
    }
    banner.className = crewDemoAllDone() ? 'crew-spread-banner is-ok is-done' : 'crew-spread-banner is-ok';
    banner.textContent = crewDemoAllDone()
      ? crewWorkLine() + ' · every trailer loaded'
      : crewWorkLine() + ' · never two forklifts in one trailer at the same time';
  }

  /** Force-open OUT trailer panel (no toggle) so boss demo always shows fill. */
  function forceOpenCrewOutTrailerPanel(door) {
    const d = String(door || '').trim();
    if (!d) return;
    state.crewOutDoor = d;
    // Boss demo keeps Side view as the default glance
    state.crewOutViewMode = 'side';
    state.crewOutTopDeck = 'A';
    state.crewOutSelectedPieceKey = null;
    renderCrewOutTrailerPanel();
    updateCrewSelectionUI();
  }

  /**
   * Busiest OUT door (most planned pieces) — boss demo auto-opens this fill.
   * @param {object[]} list
   * @returns {string}
   */
  function busiestOutDoorWithPlannedFreight(list) {
    const doors = collectCrewOutDoorsWithFreight(list);
    let best = '';
    let bestN = -1;
    doors.forEach((d) => {
      const info = resolveOutTrailerForDoor(d, list);
      const pieces = piecesForOutboundTrailer(info.trailerNumber);
      const n = pieces.length;
      if (n > bestN) {
        bestN = n;
        best = String(d);
      }
    });
    return best || (doors.length ? String(doors[0]) : '');
  }

  /** @deprecated alias — prefer busiest */
  function firstOutDoorWithPlannedFreight(list) {
    return busiestOutDoorWithPlannedFreight(list);
  }

  function closeCrewOutTrailerPanel() {
    state.crewOutDoor = null;
    renderCrewOutTrailerPanel();
    updateCrewSelectionUI();
  }

  function openCrewOutTrailerPanel(door) {
    const d = String(door || '').trim();
    if (!d) return;
    const closing = state.crewOutDoor === d;
    state.crewOutDoor = closing ? null : d;
    if (!closing) {
      state.crewOutSelectedPieceKey = null;
      // Default Side view for boss demo continuity; deck resets to Floor
      if (!state.crewOutViewMode) state.crewOutViewMode = 'side';
      state.crewOutTopDeck = 'A';
    }
    renderCrewOutTrailerPanel();
    updateCrewSelectionUI();
  }


  /**
   * v49: OUT trailer switcher chips inside the open panel so other trailers
   * stay reachable without hunting off-screen map chips.
   * @param {string} activeDoor
   * @returns {string}
   */
  function buildCrewOutTrailerSwitcherHtml(activeDoor) {
    const list = crewAssignmentsCache || [];
    const doors = Array.from(new Set(collectCrewOutDoorsWithFreight(list).map(String)));
    if (!doors.length) return '';
    const active = String(activeDoor || '').trim();
    const chips = doors
      .map((d) => {
        const info = resolveOutTrailerForDoor(d, list);
        const fill = outFillForDoor(d, list);
        const dest = String(info.destination || '').trim();
        // v53: shorten by whole words (never cut a word in half)
        let short = dest || 'OUT';
        if (short.length > 14) {
          const words = short.split(/\s+/);
          short = words[0];
          for (let i = 1; i < words.length && (short + ' ' + words[i]).length <= 14; i++) short += ' ' + words[i];
        }
        const label = 'D' + d + (short ? ' · ' + short : '');
        // v51: same source as the panel header and the dock wall chip
        const count = fill.n ? ' · ' + fill.k + '/' + fill.n : '';
        const cls =
          'crew-out-trailer-switch' + (String(d) === active ? ' is-active' : '');
        return (
          '<button type="button" class="' +
          cls +
          '" data-door="' +
          escapeHtml(String(d)) +
          '" aria-pressed="' +
          (String(d) === active ? 'true' : 'false') +
          '">' +
          escapeHtml(label + count) +
          '</button>'
        );
      })
      .join('');
    return '<div class="crew-out-trailer-switcher" role="group" aria-label="Outbound trailers">' + chips + '</div>';
  }

  function renderCrewOutTrailerPanel() {
    const panel = el.crewOutTrailerPanel;
    const body = el.crewOutTrailerBody;
    if (!panel || !body) return;

    const door = state.crewOutDoor ? String(state.crewOutDoor).trim() : '';
    if (!door) {
      panel.hidden = true;
      panel.setAttribute('hidden', '');
      body.innerHTML = '';
      return;
    }

    const info = resolveOutTrailerForDoor(door, crewAssignmentsCache);
    const pieces = piecesForOutboundTrailer(info.trailerNumber);
    const titleTrl = info.trailerNumber || '—';
    const dest = info.destination || '—';
    const doneN = pieces.filter((p) => p.done).length;

    // Keep selected deck valid for this trailer
    const avail = availableDeckLevelsForPieces(pieces, info.cityFloorOnly);
    if (avail.indexOf(String(state.crewOutTopDeck || 'A').toUpperCase()) < 0) {
      state.crewOutTopDeck = avail[0] || 'A';
    }

    const viewMode = state.crewOutViewMode === 'top' ? 'top' : 'side';
    const selectedKey = state.crewOutSelectedPieceKey
      ? String(state.crewOutSelectedPieceKey)
      : '';

    let listHtml = '';
    if (!info.trailerNumber) {
      listHtml =
        '<div class="empty-state">No outbound trailer linked to this OUT door yet. Open an outbound trailer on Dock → Outbound, or build a load plan.</div>';
    } else if (!pieces.length) {
      listHtml =
        '<div class="empty-state">Nothing planned into this trailer yet. Build a load plan first.</div>';
    } else {
      listHtml = pieces
        .map((p) => {
          const key = crewOutPieceKey(p);
          const top = [
            p.pro ? `PRO ${p.pro}` : 'PRO —',
            p.pieceFraction
              ? `piece ${String(p.pieceFraction).replace('/', ' of ')}`
              : '',
            Number(p.weight) > 0 ? fmtLb(p.weight) : '',
            formatPieceSize(p),
            p.noStack ? 'FRAGILE' : '',
          ]
            .filter(Boolean)
            .join(' · ');
          const fromBits = [
            p.fromDoor ? `Door ${p.fromDoor}` : '',
            p.fromTrailer ? `Trl ${p.fromTrailer}` : '',
            p.fromSlot || '',
          ]
            .filter(Boolean)
            .join(' · ');
          const selCls =
            (selectedKey && key === selectedKey ? ' is-selected' : '') +
            (state.crewOutJustLoadedKey && key === String(state.crewOutJustLoadedKey)
              ? ' is-just-loaded'
              : '');
          return (
            `<div class="crew-out-piece${p.done ? ' is-done' : ''}${selCls}" role="listitem" data-piece-key="${escapeHtml(key)}">` +
            `<div class="crew-out-piece-top">${escapeHtml(top)}</div>` +
            `<div class="crew-out-piece-slot"><span class="crew-load-slot-label">SLOT</span> <span class="crew-load-slot-value">${escapeHtml(p.slot || '—')}</span></div>` +
            (p.preloaded
              ? '<div class="crew-out-piece-from">loaded earlier in the shift</div>'
              : `<div class="crew-out-piece-from">from ${escapeHtml(fromBits || '—')}</div>`) +
            (p.done ? '<div class="crew-out-piece-done">' + (p.preloaded ? 'On board' : 'Loaded') + '</div>' : '') +
            `</div>`
          );
        })
        .join('');
    }

    // v52: one wording for counts (same as the card + trailer box; chips show on board/total)
    const progressBit = pieces.length
      ? `<div class="crew-out-trailer-progress">${escapeHtml(trailerCountsLine(door))}</div>`
      : '';

    let diagramHtml = '';
    if (info.trailerNumber) {
      const tabs = buildTrailerViewTabsHtml(viewMode);
      const weightBanner = buildTrailerWeightBannerHtml(pieces);
      if (viewMode === 'top') {
        diagramHtml =
          tabs +
          weightBanner +
          buildTrailerTopDownDiagramHtml(pieces, info.cityFloorOnly, state.crewOutTopDeck);
      } else if (pieces.length) {
        diagramHtml =
          tabs + buildTrailerFillDiagramHtml(pieces, info.cityFloorOnly) + weightBanner; // v54: side view first
      } else {
        diagramHtml =
          tabs +
          weightBanner +
          '<div class="trailer-top-empty-msg">Nothing loaded yet — switch to Top-down for the empty floor plan.</div>';
      }
    }

    // v50: sample departure + pace line (demo only)
    let paceBit = '';
    const pace = crewDemo.bossMode ? crewPaceForDoor(door) : null;
    if (pace) {
      const paceCls =
        pace.status === 'late' ? 'is-late' : pace.status === 'tight' ? 'is-tight' : 'is-ok';
      const detail = pace.left
        ? `est. done ${formatDoneClock(pace.eta)} (${pace.left} move${pace.left === 1 ? '' : 's'} left, leaves in ${minutesUntil(pace.depart)} min)`
        : `loaded at ${formatDoneClock(pace.eta)}`;
      const tightHint =
        pace.status === 'tight' || pace.status === 'late'
          ? `<div class="crew-pace-hint">${pace.status === 'tight' ? 'Tight = under 15 min to spare.' : 'Late = loading ends after departure.'} ${escapeHtml(tightAdvice(pace.spare))}</div>`
          : '';
      paceBit =
        `<div class="crew-out-trailer-pace ${paceCls}">` +
        `<b>Leaves ${escapeHtml(formatClock(pace.depart))}</b> · ${escapeHtml(detail)} · ` +
        `<span class="crew-pace-tag">${escapeHtml(pace.label)}</span>` +
        ` <span class="sample-tag" title="Real departure times are typed in or imported from your schedule">sample time</span>${tightHint}</div>`;
    }
    const listSummary = pieces.length
      ? `Piece list (${pieces.length})`
      : 'Piece list';
    const switcherHtml = buildCrewOutTrailerSwitcherHtml(door);
    body.innerHTML = `
      <div class="crew-out-trailer-head">
        <div class="crew-out-trailer-title">OUT Trailer ${escapeHtml(titleTrl)}</div>
        <div class="crew-out-trailer-meta">Door ${escapeHtml(door)} · ${escapeHtml(dest)}</div>
        ${progressBit}
        ${paceBit}
      </div>
      ${switcherHtml}
      <p class="crew-out-trailer-scroll-hint">Tap a chip above to see another outbound trailer.</p>
      ${diagramHtml}
      <details class="crew-out-piece-details"${state.crewOutListOpen || selectedKey ? ' open' : ''}>
        <summary>${escapeHtml(listSummary)}</summary>
        <div class="crew-out-piece-list" role="list">${listHtml}</div>
      </details>
    `;
    panel.hidden = false;
    panel.removeAttribute('hidden');
    const det = body.querySelector('.crew-out-piece-details');
    if (det) {
      det.addEventListener('toggle', () => {
        state.crewOutListOpen = det.open;
      });
    }

    // Scroll selected piece into view when highlighted from top-down tap
    if (selectedKey) {
      const hit = Array.from(
        body.querySelectorAll('.crew-out-piece[data-piece-key]')
      ).find((n) => n.getAttribute('data-piece-key') === selectedKey);
      if (hit && typeof hit.scrollIntoView === 'function') {
        try {
          hit.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } catch (e) {
          /* ignore */
        }
      }
    }
  }

  function createCrewOpMarker(a) {
    // v54: inside an OUT chip (itself a button) the marker is a plain span
    const btn = document.createElement(a.dropping ? 'span' : 'button');
    if (!a.dropping) btn.type = 'button';
    btn.className = 'crew-op-marker' + (a.idle ? ' is-idle' : '') + (a.dropping ? ' is-at-out' : '');
    btn.setAttribute('data-op', String(a.operator));
    btn.setAttribute('data-door', String(a.dropping ? a.toDoor || '' : a.fromDoor || ''));
    if (a.parked) btn.classList.add('is-parked');
    btn.setAttribute(
      'aria-label',
      a.parked
        ? `${crewOpLabel(a.operator)} done for this run`
        : a.idle
          ? `${crewOpLabel(a.operator)} waiting`
          : a.dropping
            ? `${crewOpLabel(a.operator)} just dropped a piece at OUT door ${a.toDoor}`
            : `${crewOpLabel(a.operator)} picking up at inbound door ${a.fromDoor}, loading OUT door ${a.toDoor}`
    );
    btn.title = btn.getAttribute('aria-label');
    if (!a.dropping) btn.setAttribute('aria-pressed', 'false');
    btn.textContent = String(a.operator);
    return btn;
  }

  /**
   * @param {object[]} list assignments
   */
  function renderCrewMap(list) {
    if (!el.crewFloor || !el.crewDockMap) return;

    const activityPull = collectCrewPullDoors(list);
    const activitySet = new Set(activityPull);
    const doorCount = getDockDoorCount(list);
    let pullDoors;
    /** v50: in the boss demo a door is "busy" only while it still has moves left. */
    let bossRemainingPull = null;
    if (crewDemo.seeded && crewDemo.bossMode) {
      // Boss glance: the inbound doors this plan pulls from (stable, so doors
      // turn "empty" as they finish instead of disappearing)
      const liveDoors = new Set();
      (crewDemo.allMoves || []).forEach((m) => {
        const d = String((m && m.fromDoor) || '').trim();
        if (d) liveDoors.add(d);
      });
      (list || []).forEach((a) => {
        const d = String((a && a.fromDoor) || '').trim();
        if (d && d !== '—') liveDoors.add(d);
      });
      bossRemainingPull = new Set();
      crewDemo.queue.forEach((m) => bossRemainingPull.add(String(m.fromDoor || '')));
      crewDemo.active.forEach((a) => {
        if (a && a.move) bossRemainingPull.add(String(a.move.fromDoor || ''));
      });
      pullDoors = sortDoorIds(Array.from(liveDoors));
      if (!pullDoors.length) {
        pullDoors = visibleCrewPullDoors(doorCount, activityPull).filter((d) =>
          activitySet.has(d)
        );
      }
      if (!pullDoors.length) pullDoors = visibleCrewPullDoors(doorCount, activityPull);
    } else {
      pullDoors = visibleCrewPullDoors(doorCount, activityPull);
    }
    const outDoors = collectCrewOutDoorsWithFreight(list);

    const livePullDoors = new Set(
      (list || [])
        .filter((a) => !a.idle)
        .map((a) => String(a.fromDoor || '').trim())
        .filter(Boolean)
    );

    /** @type {Map<string, object[]>} */
    const opsByPull = new Map();
    /** @type {object[]} */
    const orphanOps = [];
    (list || []).forEach((a) => {
      if (a.dropping && String(a.toDoor || '').trim()) return; // v54: drawn on its OUT door
      const d = String(a.fromDoor || '').trim();
      if (d && pullDoors.indexOf(d) >= 0) {
        if (!opsByPull.has(d)) opsByPull.set(d, []);
        opsByPull.get(d).push(a);
      } else {
        orphanOps.push(a);
      }
    });

    /** @type {Map<string, object[]>} */
    const opsByOut = new Map();
    (list || []).forEach((a) => {
      if (a.idle) return;
      const d = String(a.toDoor || '').trim();
      if (!d) return;
      if (!opsByOut.has(d)) opsByOut.set(d, []);
      opsByOut.get(d).push(a);
    });

    const density =
      pullDoors.length > 30 ? 'high' : pullDoors.length > 16 ? 'med' : 'low';
    el.crewDockMap.dataset.doorCount = String(pullDoors.length);
    el.crewDockMap.classList.toggle('is-boss', Boolean(crewDemo.seeded && crewDemo.bossMode));
    el.crewDockMap.dataset.doorDensity = density;

    const pullN = pullDoors.length;
    const outN = outDoors.length;
    // v53: in the demo the setting opens at the demo dock's real door count
    // (the doors on the map), not the 20+ default for a real dock
    const demoDock = Boolean(crewDemo.seeded && crewDemo.bossMode && !state.crewDoorCountTouched);
    if (el.crewDoorCountInput && document.activeElement !== el.crewDoorCountInput) {
      const shown = demoDock ? pullN + outN : doorCount;
      el.crewDoorCountInput.value = String(shown);
      el.crewDoorCountInput.dataset.shown = String(shown);
      el.crewDoorCountInput.dataset.demo = demoDock ? '1' : '';
    }
    const doorHint = document.getElementById('crewDoorCountHint');
    if (doorHint) {
      doorHint.textContent = demoDock
        ? 'Sample dock: ' + (pullN + outN) + ' doors (' + pullN + ' inbound, ' + outN + ' outbound), as on the map. Type your own count for your dock.'
        : 'Set how many doors your dock has. Empty doors show muted; busy doors light up.';
    }
    const busyN = activityPull.length;
    el.crewDockMap.setAttribute(
      'aria-label',
      `Dock wall map with ${pullN} inbound doors (${busyN} busy), ${outN} outbound load door${outN === 1 ? '' : 's'}`
    );

    el.crewFloor.innerHTML = '';

    const wall = document.createElement('div');
    wall.className = 'crew-inbound-wall';
    wall.setAttribute('aria-label', 'Inbound doors');

    pullDoors.forEach((d) => {
      const cell = document.createElement('div');
      cell.className = 'crew-door-cell';
      cell.setAttribute('data-door', d);

      // v53: a door is never "empty" while a forklift is drawn there pulling;
      // it turns empty once that forklift has left with the last piece
      const pullingNow = livePullDoors.has(d);
      const busy = bossRemainingPull ? bossRemainingPull.has(d) || pullingNow : activitySet.has(d);
      if (busy) {
        cell.classList.add('has-pull');
        cell.title = bossRemainingPull && !bossRemainingPull.has(d)
          ? `Door ${d} — last piece on its way to the trailer (empties when the forklift leaves)`
          : `Door ${d} — freight still to move`;
      } else {
        cell.classList.add('is-empty');
        cell.title = `Door ${d} — empty`;
      }
      if (livePullDoors.has(d)) {
        cell.classList.add('is-live');
      }

      const num = document.createElement('span');
      num.className = 'crew-door-num';
      num.textContent = d;
      cell.appendChild(num);

      const ibTrl = inboundTrailerForDoor(d, list);
      if (bossRemainingPull && !busy) {
        const emp = document.createElement('span');
        emp.className = 'crew-door-trl crew-door-emptied';
        emp.textContent = 'empty';
        cell.appendChild(emp);
      } else if (ibTrl) {
        const trl = document.createElement('span');
        trl.className = 'crew-door-trl';
        trl.textContent = 'IN ' + String(ibTrl);
        trl.title = `Inbound trailer ${ibTrl}`;
        cell.appendChild(trl);
      }

      if (
        crewFlashDoors.from &&
        String(crewFlashDoors.from) === String(d)
      ) {
        cell.classList.add('is-flash');
      }

      const ops = opsByPull.get(d) || [];
      if (ops.length) {
        const badgeRow = document.createElement('div');
        badgeRow.className = 'crew-door-ops';
        ops.forEach((a) => badgeRow.appendChild(createCrewOpMarker(a)));
        cell.appendChild(badgeRow);
      }

      wall.appendChild(cell);
    });

    el.crewFloor.appendChild(wall);

    if (orphanOps.length) {
      const orphanRow = document.createElement('div');
      orphanRow.className = 'crew-orphan-ops';
      orphanRow.setAttribute('aria-label', 'Forklifts not at an inbound door');
      // v54: Waiting and Done shown apart (same status the card text uses)
      const waitOps = orphanOps.filter((a) => !a.parked);
      const doneOps = orphanOps.filter((a) => a.parked);
      [['Waiting:', waitOps], ['Done:', doneOps]].forEach(([txt, ops]) => {
        if (!ops.length) return;
        const grp = document.createElement('span');
        grp.className = 'crew-orphan-group' + (txt === 'Done:' ? ' is-done' : '');
        const lab = document.createElement('span');
        lab.className = 'crew-orphan-label';
        lab.textContent = txt;
        grp.appendChild(lab);
        ops.forEach((a) => grp.appendChild(createCrewOpMarker(a)));
        orphanRow.appendChild(grp);
      });
      el.crewFloor.appendChild(orphanRow);
    } else if (crewDemo.seeded && crewDemo.bossMode) {
      // v53: keep the row's space in the boss demo, so the map never changes
      // height and the phone card keeps ONE fixed position
      const orphanRow = document.createElement('div');
      orphanRow.className = 'crew-orphan-ops is-reserved';
      const lab = document.createElement('span');
      lab.className = 'crew-orphan-label';
      lab.textContent = 'Waiting: none';
      orphanRow.appendChild(lab);
      el.crewFloor.appendChild(orphanRow);
    }

    const outStrip = document.createElement('div');
    outStrip.className = 'crew-out-strip';
    outStrip.setAttribute('aria-label', 'Outbound load doors');

    const outHeading = document.createElement('div');
    outHeading.className = 'crew-out-heading';
    outHeading.textContent = 'OUT';
    outStrip.appendChild(outHeading);

    if (!outN) {
      const emptyOut = document.createElement('div');
      emptyOut.className = 'crew-out-empty';
      emptyOut.textContent = 'No OUT doors yet';
      outStrip.appendChild(emptyOut);
    } else {
      const chipGrid = document.createElement('div');
      chipGrid.className = 'crew-out-chips';
      // Prefer equal-width chips; 5 OUT doors → one even row on phone
      const cols = Math.min(Math.max(outN, 1), 5);
      chipGrid.style.setProperty('--out-cols', String(cols));
      outDoors.forEach((d) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'crew-out-target';
        chip.setAttribute('data-door', d);
        const hint = outChipTrailerHint(d, list);
        chip.setAttribute(
          'title',
          hint ? `OUT Door ${d} — ${hint}. Tap to see what’s inside.` : `OUT Door ${d}. Tap to see what’s inside.`
        );
        chip.setAttribute(
          'aria-label',
          hint
            ? `OUT Door ${d}, ${hint}. Show trailer contents.`
            : `OUT Door ${d}. Show trailer contents.`
        );
        chip.setAttribute('aria-pressed', 'false');

        const fill = outFillForDoor(d, list);
        const label = document.createElement('span');
        label.className = 'crew-out-label';
        label.textContent = 'OUT';
        chip.appendChild(label);

        const doorSpan = document.createElement('span');
        doorSpan.className = 'crew-out-door';
        doorSpan.innerHTML =
          `<span class="crew-out-full">Door ${escapeHtml(d)}</span>` +
          `<span class="crew-out-short" aria-hidden="true">D${escapeHtml(d)}</span>`;
        chip.appendChild(doorSpan);
        // v52: the OUT trailer's ID, same number as the panel and summary
        if (fill.trailerNumber) {
          const idSpan = document.createElement('span');
          idSpan.className = 'crew-out-trlid';
          idSpan.textContent = fill.trailerNumber;
          chip.appendChild(idSpan);
        }

        if (fill.shortDest) {
          const destSpan = document.createElement('span');
          destSpan.className = 'crew-out-dest';
          destSpan.textContent = fill.shortDest;
          chip.appendChild(destSpan);
        }

        const fillSpan = document.createElement('span');
        fillSpan.className = 'crew-out-fill';
        fillSpan.textContent = `${fill.k}/${fill.n || 0}`;
        chip.appendChild(fillSpan);

        if (hint && !fill.shortDest) {
          const trlSpan = document.createElement('span');
          trlSpan.className = 'crew-out-trl';
          trlSpan.textContent = hint;
          chip.appendChild(trlSpan);
        }

        const loaders = opsByOut.get(d) || [];
        if (loaders.length) {
          // v54: "FL 3 coming" = forklift 3 is bringing this trailer's next piece
          // (it is drawn at that inbound door); a circle here = it just dropped one
          const opLine = document.createElement('span');
          opLine.className = 'crew-out-ops';
          loaders.forEach((a) => {
            if (a.dropping) {
              opLine.classList.add('has-marker');
              opLine.appendChild(createCrewOpMarker(a));
              const t = document.createElement('span');
              t.className = 'crew-out-ops-txt';
              t.textContent = 'here';
              opLine.appendChild(t);
            } else {
              const t = document.createElement('span');
              t.className = 'crew-out-ops-txt';
              t.textContent = `FL ${a.operator} coming`;
              opLine.appendChild(t);
            }
          });
          chip.appendChild(opLine);
          chip.classList.add('is-loading');
        } else if (crewDemo.seeded && crewDemo.bossMode) {
          // v53: keep the line's space so the map height never changes
          const opLine = document.createElement('span');
          opLine.className = 'crew-out-ops is-none';
          opLine.textContent = crewDemoAllDone() || crewRemainingForDoor(d) === 0 ? 'done' : 'no FL now';
          chip.appendChild(opLine);
        }

        if (
          crewFlashDoors.to &&
          String(crewFlashDoors.to) === String(d)
        ) {
          chip.classList.add('is-flash');
        }

        const ariaBits = [
          `OUT Door ${d}`,
          fill.dest || '',
          `${fill.k} of ${fill.n} loaded`,
          loaders.length ? loaders.map((a) => crewOpLabel(a.operator) + (a.dropping ? ' just dropped a piece here' : ' is bringing the next piece')).join(', ') : '',
        ].filter(Boolean);
        chip.setAttribute('aria-label', ariaBits.join('. ') + '. Show trailer contents.');
        chip.setAttribute(
          'title',
          ariaBits.join(' · ') + '. Tap to see what’s inside.'
        );

        chipGrid.appendChild(chip);
      });
      outStrip.appendChild(chipGrid);
    }

    el.crewFloor.appendChild(outStrip);
    if (el.crewMapLegend) el.crewMapLegend.hidden = !pullN && !outN;
  }

  function renderCrew() {
    if (!el.crewBoardList) return;
    updateCrewDemoChrome();
    renderCrewMoveQueue();

    let list;
    let note;

    if (crewDemo.seeded) {
      list = assignmentsFromCrewDemo();
      if (crewDemoAllDone()) {
        note = crewWorkLine() + ' · dock loaded, all ' + crewDemo.total + ' moves complete.';
      } else if (crewDemo.mode === 'solo') {
        note =
          'Solo forklift — one op works the whole queue, first pull to last put, high-and-tight.';
      } else {
        note = `${crewWorkLine()} · ${crewDemo.total - crewDemo.doneCount} moves left. Never two forklifts in one trailer at the same time; at most 2 pull from one inbound door.`;
      }
    } else {
      // v50: honest empty state. Nothing moves until a demo or Play starts.
      const plan = DockStorage.readLoadPlan();
      const hasMoves = plan && Array.isArray(plan.moves) && plan.moves.length > 0;
      list = [];
      note = hasMoves
        ? `Plan ready (${planMovesNormalized(plan).length} moves), not started. No forklifts are moving yet.`
        : 'No plan yet. Tap Show boss demo.';
    }

    if (el.crewBoardHint) {
      el.crewBoardHint.textContent = note;
    }

    crewAssignmentsCache = list;

    if (
      state.crewSelectedOp != null &&
      !list.some((a) => a.operator === state.crewSelectedOp)
    ) {
      state.crewSelectedOp = null;
    }

    renderCrewMap(list);
    renderCrewGodHud(list);
    renderCrewSpreadBanner(list);

    if (!list.length) {
      el.crewBoardList.innerHTML = crewDemo.seeded
        ? '<div class="empty-state">No forklifts assigned.</div>'
        : '<div class="empty-state">No forklifts working yet. Tap <b>Show boss demo</b> to watch 5 sample forklifts load the dock.</div>';
      updateCrewSelectionUI();
      renderCrewOutTrailerPanel();
      if (crewTour.active) {
        requestAnimationFrame(() => positionCrewTourBubble({ skipScroll: true }));
      }
      return;
    }

    const frag = document.createDocumentFragment();
    list.forEach((a) => {
      const row = document.createElement('div');
      row.className = 'crew-board-row' + (a.idle ? ' is-idle' : '');
      row.setAttribute('role', 'listitem');
      row.setAttribute('data-op', String(a.operator));
      row.setAttribute('tabindex', '0');
      const main = document.createElement('div');
      main.className = 'crew-board-line';
      main.textContent = a.line;
      row.appendChild(main);
      if (!a.idle && a.toSlot) {
        const slot = document.createElement('div');
        slot.className = 'crew-board-load-slot';
        slot.innerHTML =
          `<span class="crew-load-slot-label">LOAD SLOT</span> ` +
          `<span class="crew-load-slot-value">${escapeHtml(a.toSlot)}</span>`;
        row.appendChild(slot);
      }
      if (a.nextLine) {
        const next = document.createElement('div');
        next.className = 'crew-board-next';
        next.textContent = a.nextLine;
        row.appendChild(next);
      }
      frag.appendChild(row);
    });
    el.crewBoardList.innerHTML = '';
    el.crewBoardList.appendChild(frag);
    updateCrewSelectionUI();
    renderCrewOutTrailerPanel();
    // Map markers were rebuilt — keep tour highlight/arrow on the live chip
    if (crewTour.active) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => positionCrewTourBubble({ skipScroll: true }));
      });
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
      else if (state.dockSection === 'crew') renderCrew();
      else if (state.dockSection === 'operator') renderOperator();
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
  function openConfirmSheet({ title, message, action, okLabel }) {
    if (!el.confirmOverlay) {
      toast("Can't show confirm — refresh the page");
      return;
    }
    state.confirmPending = { action };
    if (el.confirmHeading) el.confirmHeading.textContent = title || 'Confirm';
    if (el.confirmMessage) el.confirmMessage.textContent = message || '';
    if (el.confirmOkBtn) el.confirmOkBtn.textContent = okLabel || 'Confirm';
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
    if (pending.action === 'seedDemoAndOperator') {
      runSeedDemoInbound();
      const plan = typeof DockLoadPlan !== 'undefined' && DockLoadPlan.runLoadPlan
        ? DockLoadPlan.runLoadPlan()
        : null;
      renderPlan();
      renderOutboundList();
      renderGround();
      if (plan && plan.moves && plan.moves.length) {
        seedCrewDemo(plan);
      } else {
        resetCrewDemoState();
      }
      renderCrew();
      refreshLoadoutTrailerPicker();
      updateLoadoutPlanBanner();
      const ok = seedOperatorDemo(plan);
      if (ok) {
        toast(`Operator — ${operatorDemo.total} moves · pick then load`);
      } else {
        toast('Demo loaded but no moves — check Plan');
      }
      renderOperator();
      return;
    }
    if (pending.action === 'seedDemoAndBoss') {
      startBossDemoNow();
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
    if (el.planAgentPackBtn) {
      el.planAgentPackBtn.addEventListener('click', () => onAgentPackDemo());
    }
  }

  function updatePlanAgentUI(plan) {
    const banner = el.planAgentBanner;
    const btn = el.planAgentPackBtn;
    const textEl = el.planAgentBannerText;
    const hint = el.planAgentHint;
    if (!banner || !btn) return;
    const s = (plan && plan.summary) || {};
    const unplaced = Array.isArray(s.unplaced) ? s.unplaced : [];
    const n = unplaced.length || Number(s.unplacedCount) || 0;
    const packed = s.packedCount != null ? s.packedCount : (plan && plan.moves ? plan.moves.length : 0);
    const total =
      s.pieceCount != null
        ? s.pieceCount
        : packed + (s.unplacedPieceCount || 0);

    if (!plan || (!(plan.moves && plan.moves.length) && !n)) {
      banner.hidden = true;
      banner.setAttribute('hidden', '');
      return;
    }

    banner.hidden = false;
    banner.removeAttribute('hidden');

    if (n > 0) {
      btn.disabled = false;
      btn.hidden = false;
      btn.removeAttribute('hidden');
      btn.classList.remove('is-agent-disabled');
      if (textEl) {
        textEl.textContent =
          `Demo planner packed ${packed}/${total} — ${n} PRO(s) need expert pass` +
          (s.unplacedPieceCount ? ` (${s.unplacedPieceCount} pieces)` : '');
      }
      if (hint) {
        hint.hidden = false;
        hint.removeAttribute('hidden');
        hint.textContent =
          'Runs a local second pass on unplaced PROs only. May add outbound stubs. Labels the plan as agent packed.';
      }
    } else {
      btn.disabled = true;
      btn.classList.add('is-agent-disabled');
      if (textEl) {
        textEl.textContent =
          plan.planner === 'agent-demo'
            ? (s.agentNote || 'Agent packed — dock clear.')
            : 'Planner cleared the dock — agent not needed.';
      }
      // One status line only — do not repeat "Planner cleared the dock" in the hint.
      if (hint) {
        hint.textContent = '';
        hint.hidden = true;
        hint.setAttribute('hidden', '');
      }
    }
  }

  function onAgentPackDemo() {
    if (typeof DockLoadPlan === 'undefined' || !DockLoadPlan.runAgentPackDemo) {
      toast("Agent demo didn't load. Refresh and try again.");
      return;
    }
    const plan = DockStorage.readLoadPlan();
    const s = (plan && plan.summary) || {};
    const n = (Array.isArray(s.unplaced) && s.unplaced.length) || Number(s.unplacedCount) || 0;
    if (!n) {
      toast('Planner cleared the dock — agent not needed.');
      updatePlanAgentUI(plan);
      return;
    }
    let next;
    try {
      next = DockLoadPlan.runAgentPackDemo(plan);
    } catch (err) {
      console.error(err);
      toast("Agent pass failed. Try Build plan again.");
      return;
    }
    renderPlan();
    renderOutboundList();
    renderGround();
    state.crewRotate = 0;
    state.crewSelectedOp = null;
    if (next && next.moves && next.moves.length) {
      seedCrewDemo(next);
    } else {
      resetCrewDemoState();
    }
    resetOperatorDemoState();
    renderCrew();
    renderOperator();
    refreshLoadoutTrailerPicker();
    updateLoadoutPlanBanner();
    const ns = (next && next.summary) || {};
    const left = (ns.unplaced && ns.unplaced.length) || 0;
    toast(
      left
        ? `Agent demo: ${ns.packedCount || 0} packed · ${left} still unplaced`
        : `Agent packed — ${ns.packedCount || (next.moves || []).length} moves · dock clear`
    );
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
        else if (state.dockSection === 'crew') renderCrew();
        else if (state.dockSection === 'operator') renderOperator();
        else if (state.dockSection === 'plan') renderPlan();
      }
      renderGround();
      resetCrewDemoState();
      resetOperatorDemoState();
      renderCrew();
      renderOperator();
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
      state.crewRotate = 0;
      state.crewSelectedOp = null;
      resetCrewDemoState();
      resetOperatorDemoState();
      renderCrew();
      renderOperator();
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
    let result;
    try {
      result = DockLoadPlan.seedDemoInbound();
    } catch (err) {
      console.error(err);
      toast("Couldn't load demo freight. Try again, or refresh the page.");
      return;
    }
    try {
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
      state.crewRotate = 0;
      state.crewSelectedOp = null;
      resetCrewDemoState();
      resetOperatorDemoState();
      renderCrew();
      renderOperator();
      if (state.view === 'loadout') renderLoadout('');
      if (state.view === 'dock' && state.dockSection === 'inbound') renderDock();
      if (state.view === 'dock' && state.dockSection === 'outbound') renderOutboundList();
      if (state.view === 'dock' && state.dockSection === 'ground') renderGround();
      if (state.view === 'dock' && state.dockSection === 'crew') renderCrew();
      if (state.view === 'dock' && state.dockSection === 'operator') renderOperator();
      if (el.planStatusHint) {
        el.planStatusHint.textContent =
          `Demo loaded: ${result.inboundTrailers} inbound trailers · ${result.proCount} PROs · ${result.pieceCount} pieces` +
          (result.outboundCreated ? ` · ${result.outboundCreated} outbound stub(s) created` : '');
      }
      toast(
        `Sample freight: ${result.pieceCount} pieces on ${result.inboundTrailers} inbound trailers`
      );
    } catch (err) {
      console.error(err);
      // Freight already saved — don't scare the user with a seed failure toast
      toast(
        `Demo inbound loaded (${result.pieceCount} pieces). Refresh Crew if the map looks stale.`
      );
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
    state.crewRotate = 0;
    state.crewSelectedOp = null;
    if (plan && plan.moves && plan.moves.length) {
      seedCrewDemo(plan);
    } else {
      resetCrewDemoState();
    }
    resetOperatorDemoState();
    renderCrew();
    renderOperator();
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
    const up = (s.unplaced && s.unplaced.length) || s.unplacedCount || 0;
    toast(
      up
        ? `Plan: ${s.moveCount} packed · ${up} PRO(s) unplaced → ${s.outboundCount} outbound`
        : `Plan ready: ${s.moveCount} moves → ${s.outboundCount} outbound`
    );
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
    if (!plan || !(plan.moves && plan.moves.length) && !(plan.outboundLoadouts && plan.outboundLoadouts.length) && !((plan.summary && plan.summary.unplaced && plan.summary.unplaced.length))) {
      const rawNote = plan && plan.summary && plan.summary.note;
      const note = rawNote
        ? `<div class="empty-state">${escapeHtml(sanitizePlanNote(rawNote))}</div>`
        : '<div class="empty-state">No plan yet. On Inbound, load demo inbound trailers (or log freight), then tap Build load plan (demo) above.</div>';
      el.planSummary.innerHTML = note;
      updatePlanAgentUI(plan);
      return;
    }
    const s = plan.summary || {};
    const when = plan.createdAt
      ? DockStorage.formatTimeLocal(plan.createdAt)
      : '—';
    const noteSafe = sanitizePlanNote(s.note || '');
    const unplaced = Array.isArray(s.unplaced) ? s.unplaced : [];
    const packed = s.packedCount != null ? s.packedCount : (plan.moves || []).length;
    const unplacedPcs = s.unplacedPieceCount != null
      ? s.unplacedPieceCount
      : unplaced.reduce((n, u) => n + (u.pieceCount || 0), 0);
    let unplacedHtml = '';
    if (unplaced.length) {
      const lines = unplaced
        .slice(0, 12)
        .map(
          (u) =>
            `<li>PRO ${escapeHtml(u.pro)} → ${escapeHtml(u.destination || '—')} · ${escapeHtml(String(u.pieceCount || 0))} pc · ${escapeHtml(u.reason || 'no_capacity')}</li>`
        )
        .join('');
      const more =
        unplaced.length > 12
          ? `<li>…and ${unplaced.length - 12} more</li>`
          : '';
      unplacedHtml =
        `<div class="plan-unplaced"><div class="summary-label">Unplaced</div><ul class="plan-unplaced-list">${lines}${more}</ul></div>`;
    }
    const agentNote = s.agentNote
      ? `<p class="hint plan-agent-note">${escapeHtml(sanitizePlanNote(s.agentNote))}</p>`
      : '';
    el.planSummary.innerHTML = `
      <div class="plan-summary-grid">
        <div class="summary-row"><span class="summary-label">Planner</span><span class="summary-value">${escapeHtml(plan.label || plan.planner || 'demo')}</span></div>
        <div class="summary-row"><span class="summary-label">Saved</span><span class="summary-value">${escapeHtml(when)}</span></div>
        <div class="summary-row"><span class="summary-label">Packed</span><span class="summary-value">${escapeHtml(String(packed))} moves</span></div>
        <div class="summary-row"><span class="summary-label">Unplaced</span><span class="summary-value">${escapeHtml(String(unplaced.length))} PRO(s) · ${escapeHtml(String(unplacedPcs))} pc</span></div>
        <div class="summary-row"><span class="summary-label">PROs</span><span class="summary-value">${escapeHtml(String(s.proCount != null ? s.proCount : '—'))}</span></div>
        <div class="summary-row"><span class="summary-label">Outbound</span><span class="summary-value">${escapeHtml(String(s.outboundCount != null ? s.outboundCount : (plan.outboundLoadouts || []).length))}</span></div>
        <div class="summary-row"><span class="summary-label">Skipped</span><span class="summary-value">${escapeHtml(String(s.skippedNoDest || 0))} no destination</span></div>
      </div>
      ${unplacedHtml}
      <p class="hint plan-note">${escapeHtml(noteSafe)}</p>
      ${agentNote}
    `;
    updatePlanAgentUI(plan);
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
        const toDoor = resolvePutDoor({
          door: (m.to && m.to.door) || '',
          trailer: (m.to && m.to.trailer) || '',
          destination: dest,
        });
        const toParts = [];
        if (toDoor) toParts.push(`Door ${toDoor}`);
        else if (toTr && toTr !== '—') toParts.push('Door —');
        toParts.push(`Trl ${toTr}`);
        toParts.push(toSlot);
        div.innerHTML = `
          <div class="plan-move-top">
            <span class="plan-move-num">#${idx + 1}</span>
            <span class="plan-move-pro">PRO ${escapeHtml(m.pro || '—')} · ${escapeHtml(m.pieceFraction || '—')}</span>
          </div>
          <div class="plan-move-dest">${escapeHtml(dest || '—')}</div>
          <div class="plan-move-path">
            <span class="plan-from">Door ${escapeHtml(fromDoor)} · Trl ${escapeHtml(fromTr)} · ${escapeHtml(fromSlot)}</span>
            <span class="plan-arrow" aria-hidden="true">→</span>
            <span class="plan-to">${escapeHtml(toParts.join(' · '))}</span>
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
      const doorNum = resolvePutDoor({
        door: load.doorNumber || '',
        trailer: load.trailerNumber || '',
        destination: load.destination || '',
      });
      const door = doorNum ? ` · Door ${doorNum}` : '';
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
              : formatPieceSizeFull(p);
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
  function toast(msg, opts) {
    // v52: never cover a tour card; the card itself says what happened
    if (!(opts && opts.force) && crewTour && crewTour.active && document.body.classList.contains('crew-tour-open')) return;
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 2800);
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    // Only register when served over http(s) — not file://
    if (!/^https?:$/.test(location.protocol)) return;
    // v54: register only after the page has fully loaded and gone quiet, so the
    // first visit (fresh site data) never has the worker installing while the
    // tour starts. The worker never takes over an open page (no clients.claim).
    const go = () => {
      navigator.serviceWorker.register('./sw.js?v=54').catch(() => {
        /* offline cache optional */
      });
    };
    const later = () => setTimeout(go, 4000);
    if (document.readyState === 'complete') later();
    else window.addEventListener('load', later, { once: true });
  }

  // Expose parse for quick console tests
  window.DockApp = { state, parse: (t) => DockSpeech.parseDimensionsUtterance(t), showView, renderLoadout, renderDock, renderOutboundList, renderGround, renderCrew, renderOperator, renderPlan, normalizePieceInput, syncPieceSequenceFromStorage, syncDestinationFromPro, openEditPro, closeEditPro, runLoadPlan: () => typeof DockLoadPlan !== 'undefined' && DockLoadPlan.runLoadPlan(), seedDemoInbound: () => typeof DockLoadPlan !== 'undefined' && DockLoadPlan.seedDemoInbound() };

  init();
})();
