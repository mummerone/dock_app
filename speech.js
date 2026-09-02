/**
 * Web Speech helpers + utterance parser for dock dimensions.
 * Units are locked: H, W, D in inches; weight in lbs. Never ask for units.
 *
 * Supported examples:
 *   "48 by 40 by 48, 1200"
 *   "48 40 48 1200"
 *   "forty eight by forty by forty eight twelve hundred" (best-effort via digits preferred)
 * Prefer numeric speech; word numbers are lightly supported for common values.
 */

(function (global) {
  const SpeechRecognition =
    global.SpeechRecognition || global.webkitSpeechRecognition || null;

  function isSupported() {
    return Boolean(SpeechRecognition);
  }

  /**
   * Extract up to 4 positive numbers from a spoken phrase.
   * Order: H, W, D, weight.
   * @param {string} transcript
   * @returns {{ h?: number, w?: number, d?: number, weight?: number, rawNumbers: number[], transcript: string }}
   */
  function parseDimensionsUtterance(transcript) {
    const text = String(transcript || '')
      .toLowerCase()
      .replace(/,/g, ' ')
      .replace(/\bby\b/g, ' ')
      .replace(/\bx\b/g, ' ')
      .replace(/[^a-z0-9.\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Prefer digit tokens first
    const digitMatches = text.match(/\d+(?:\.\d+)?/g) || [];
    let nums = digitMatches.map(Number).filter((n) => Number.isFinite(n));

    // If fewer than 4 digits, try a tiny word-number pass for leftovers (optional)
    if (nums.length < 4) {
      const words = wordsToNumberSequence(text);
      if (words.length > nums.length) nums = words;
    }

    const result = {
      transcript: String(transcript || '').trim(),
      rawNumbers: nums.slice(),
    };

    if (nums[0] != null) result.h = nums[0];
    if (nums[1] != null) result.w = nums[1];
    if (nums[2] != null) result.d = nums[2];
    if (nums[3] != null) result.weight = nums[3];

    return result;
  }

  /** Minimal word→number for common dock sizes (not full NLP). */
  function wordsToNumberSequence(text) {
    const map = {
      zero: 0, oh: 0,
      one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
      eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
      sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
      twenty: 20, thirty: 30, forty: 40, fifty: 50,
      sixty: 60, seventy: 70, eighty: 80, ninety: 90,
      hundred: 100, thousand: 1000,
    };

    // Keep digits as-is in stream
    const tokens = text.split(/\s+/).filter(Boolean);
    const out = [];
    let current = null;

    function flush() {
      if (current != null) {
        out.push(current);
        current = null;
      }
    }

    for (const tok of tokens) {
      if (/^\d+(?:\.\d+)?$/.test(tok)) {
        flush();
        out.push(Number(tok));
        continue;
      }
      if (!(tok in map)) {
        // ignore "by", "and", "inches", "pounds", etc.
        if (['and', 'point', 'inches', 'inch', 'pounds', 'pound', 'lbs', 'lb'].includes(tok)) {
          continue;
        }
        flush();
        continue;
      }
      const v = map[tok];
      if (v === 100 || v === 1000) {
        current = (current == null ? 1 : current) * v;
      } else if (current != null && current >= 20 && v < 10) {
        current += v;
      } else if (current != null && current < 100 && v < 100) {
        // e.g. forty eight
        current += v;
      } else {
        flush();
        current = v;
      }
    }
    flush();
    return out;
  }

  /**
   * One-shot listen. Resolves with parse result or rejects on error/abort.
   * @param {{ lang?: string, onStart?: Function, onEnd?: Function, onInterim?: Function }} [opts]
   */
  function listenOnce(opts = {}) {
    if (!isSupported()) {
      return Promise.reject(new Error('Speech recognition is not supported in this browser.'));
    }

    return new Promise((resolve, reject) => {
      const rec = new SpeechRecognition();
      rec.lang = opts.lang || 'en-US';
      rec.interimResults = true;
      rec.maxAlternatives = 3;
      rec.continuous = false;

      let finalText = '';
      let settled = false;

      rec.onstart = () => {
        if (opts.onStart) opts.onStart();
      };

      rec.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res[0].transcript;
          if (res.isFinal) finalText += text + ' ';
          else interim += text;
        }
        if (opts.onInterim) opts.onInterim((finalText + interim).trim());
      };

      rec.onerror = (event) => {
        if (settled) return;
        settled = true;
        reject(new Error(event.error || 'speech-error'));
      };

      rec.onend = () => {
        if (opts.onEnd) opts.onEnd();
        if (settled) return;
        settled = true;
        const text = finalText.trim();
        if (!text) {
          reject(new Error('no-speech'));
          return;
        }
        resolve(parseDimensionsUtterance(text));
      };

      try {
        rec.start();
      } catch (err) {
        settled = true;
        reject(err);
      }

      // Expose stop handle
      listenOnce._active = rec;
    });
  }

  function stopListening() {
    try {
      if (listenOnce._active) listenOnce._active.stop();
    } catch {
      /* ignore */
    }
  }

  global.DockSpeech = {
    isSupported,
    parseDimensionsUtterance,
    listenOnce,
    stopListening,
  };
})(window);
