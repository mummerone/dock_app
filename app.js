/**
 * Dock App — main UI controller
 * Permanent rule reminder: same PRO => same trailer (see storage.js groupsByPro).
 */
(function () {
  'use strict';

  const PRESETS = [
    { id: 'gma', label: 'GMA 48×40', sub: '48 × 40 × 48', h: 48, w: 40, d: 48 },
    { id: 'p4848', label: '48×48', sub: '48 × 48 × 48', h: 48, w: 48, d: 48 },
    { id: 'half', label: 'Half pallet', sub: '48 × 20 × 40', h: 48, w: 20, d: 40 },
    { id: 'euro', label: 'Euro', sub: '47 × 32 × 40', h: 47, w: 32, d: 40 },
    { id: 'drum55', label: '55-gal drum', sub: '35 × 23 × 23', h: 35, w: 23, d: 23 },
    { id: 'drum30', label: '30-gal drum', sub: '30 × 19 × 19', h: 30, w: 19, d: 19 },
    { id: 'bucket5', label: '5-gal bucket', sub: '15 × 12 × 12', h: 15, w: 12, d: 12 },
    { id: 'ibc', label: 'IBC 275', sub: '46 × 48 × 40', h: 46, w: 48, d: 40 },
    { id: 'gaylord', label: 'Gaylord', sub: '48 × 40 × 36', h: 48, w: 40, d: 36 },
    { id: 'last', label: 'Custom / Last used', sub: 'Restore last Accept', last: true },
  ];

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
  };

  const el = {
    pro: document.getElementById('proInput'),
    piece: document.getElementById('pieceInput'),
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
  };

  function init() {
    buildSectionChips();
    buildLevelChips();
    buildLateralChips();
    buildPresets();
    bindDimTiles();
    bindNumpad();
    bindActions();
    updateDimsUI();
    updateSlotPreview();
    selectField('h', { clearBuffer: true });
    renderRecent();
    setupSpeechStatus();
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
    state.h = p.h;
    state.w = p.w;
    state.d = p.d;
    state.weight = null; // leave weight empty per requirements
    state.padBuffer = '';
    updateDimsUI();
    selectField('weight', { clearBuffer: true });
    el.parseHint.textContent = `Preset: ${p.label} — enter weight`;
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

  function bindActions() {
    el.speakBtn.addEventListener('click', () => startSpeak({ mode: 'all' }));
    el.respeakBtn.addEventListener('click', () => startSpeak({ mode: 'active' }));
    el.acceptBtn.addEventListener('click', onAccept);
    el.clearListBtn.addEventListener('click', () => {
      if (!confirm('Clear all saved entries on this device?')) return;
      DockStorage.clearAll();
      renderRecent();
      toast('All entries cleared');
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

  function onAccept() {
    const pro = el.pro.value.trim();
    const piece = el.piece.value.trim();

    if (!pro) {
      toast('Enter a PRO number');
      el.pro.focus();
      return;
    }
    if (!piece) {
      toast('Enter piece fraction (e.g. 3/5)');
      el.piece.focus();
      return;
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

    // Soft check for BOL same-trailer awareness (MVP logs; does not block)
    const existing = DockStorage.entriesForPro(pro);
    if (existing.length) {
      // Informational only — permanent rule encoded in data model / grouping
      el.parseHint.textContent = `Note: PRO ${pro} already has ${existing.length} piece(s) logged — keep on same trailer.`;
    }

    DockStorage.saveEntry({
      pro,
      pieceFraction: piece,
      section: state.section,
      level: state.level,
      lateral: state.lateral,
      h: state.h,
      w: state.w,
      d: state.d,
      weight: state.weight,
    });

    renderRecent();
    toast(`Saved PRO ${pro} · ${piece} @ ${state.section}/${state.level}/${state.lateral}`);

    // Ready next piece: bump piece numerator if pattern N/M
    bumpPieceFraction();
    state.weight = null;
    state.padBuffer = '';
    updateDimsUI();
    selectField('weight', { clearBuffer: true });
  }

  function bumpPieceFraction() {
    const m = /^(\d+)\s*\/\s*(\d+)$/.exec(el.piece.value.trim());
    if (!m) return;
    const n = Number(m[1]);
    const total = Number(m[2]);
    if (n < total) el.piece.value = `${n + 1}/${total}`;
  }

  function renderRecent() {
    const entries = DockStorage.readAll();
    if (!entries.length) {
      el.recentList.innerHTML = '<div class="empty-state">No entries yet — Accept one to see it here.</div>';
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
      const title = document.createElement('div');
      title.className = 'pro-group-title';
      const count = (groups[pro] || []).length;
      title.textContent = `PRO ${pro} · ${count} piece(s) · same trailer`;
      wrap.appendChild(title);

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
    div.innerHTML = `
      <div class="entry-top">
        <span class="entry-pro">${escapeHtml(e.pro)} · ${escapeHtml(e.pieceFraction)}</span>
        <span class="entry-slot">${escapeHtml(e.slotLabel)}</span>
      </div>
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
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline cache optional */
    });
  }

  // Expose parse for quick console tests
  window.DockApp = { state, parse: (t) => DockSpeech.parseDimensionsUtterance(t) };

  init();
})();
