(() => {
  'use strict';

  const NativeMutationObserver = window.MutationObserver;
  if (!NativeMutationObserver || window.__PCBPRO_PERF_GUARD__) return;

  const VERSION = '1.0.0';
  const INTERNAL_SELECTOR = [
    '[data-dynamic-wires]',
    '#pcbpro-jarvis',
    '#pcbpro-ux-dock',
    '#pcbpro-patch-modal',
    '.component-intel',
    '.reality-lab'
  ].join(',');

  const isInternalTarget = (target) => {
    const el = target?.nodeType === Node.ELEMENT_NODE ? target : target?.parentElement;
    return Boolean(el?.closest?.(INTERNAL_SELECTOR));
  };

  class LiteMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.pending = [];
      this.timer = 0;
      this.native = new NativeMutationObserver((records) => {
        const external = records.filter((record) => !isInternalTarget(record.target));
        if (!external.length) return;
        this.pending.push(...external);
        if (this.timer) return;
        this.timer = window.setTimeout(() => {
          this.timer = 0;
          if (document.hidden) {
            this.pending.length = 0;
            return;
          }
          const batch = this.pending.splice(0, this.pending.length);
          try { this.callback(batch, this); } catch (error) { console.error('[PCB Pro perf guard]', error); }
        }, 140);
      });
    }

    observe(target, options = {}) {
      const safe = { ...options };
      const isGlobal = target === document.documentElement || target === document.body;
      if (isGlobal) {
        safe.attributes = false;
        safe.characterData = false;
        safe.attributeOldValue = false;
        safe.characterDataOldValue = false;
        safe.childList = true;
        safe.subtree = true;
      }
      this.native.observe(target, safe);
    }

    disconnect() {
      if (this.timer) clearTimeout(this.timer);
      this.timer = 0;
      this.pending.length = 0;
      this.native.disconnect();
    }

    takeRecords() {
      return this.native.takeRecords().filter((record) => !isInternalTarget(record.target));
    }
  }

  window.MutationObserver = LiteMutationObserver;
  window.__PCBPRO_PERF_GUARD__ = {
    version: VERSION,
    mode: 'low-spec-safe',
    nativeMutationObserver: NativeMutationObserver
  };

  document.documentElement.dataset.pcbproPerf = 'low-spec-safe';
})();
