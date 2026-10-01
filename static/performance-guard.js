(() => {
  'use strict';

  if (window.__PCBPRO_PERF_GUARD__) return;

  const VERSION = '1.3.0';
  const NativeMutationObserver = window.MutationObserver;
  const INTERNAL_SELECTOR = [
    '[data-wire-overlay]',
    '[data-dynamic-wires]',
    '.pcb-pin',
    '.pcb-wire-hud',
    '.net[data-live-net="1"]',
    '#pcbpro-jarvis',
    '#pcbpro-assistant-v114',
    '#pcbpro-explain-drawer',
    '#pcbpro-explain-toast',
    '#pcbpro-learning-modal',
    '#pcbpro-deep-modal',
    '#pcbpro-ux-dock',
    '#pcbpro-patch-modal',
    '#pcbpro-kicad-flow',
    '.component-intel',
    '.reality-lab',
    '.live-sim'
  ].join(',');

  function elementFor(node) {
    if (!node) return null;
    return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  }

  function internalNode(node) {
    const el = elementFor(node);
    return Boolean(el?.matches?.(INTERNAL_SELECTOR) || el?.closest?.(INTERNAL_SELECTOR));
  }

  function internalRecord(record) {
    if (internalNode(record.target)) return true;
    if (record.type !== 'childList') return false;
    const changed = [...record.addedNodes, ...record.removedNodes];
    return changed.length > 0 && changed.every(internalNode);
  }

  class PCBProMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.native = new NativeMutationObserver((records) => {
        const external = records.filter((r) => !internalRecord(r));
        if (!external.length) return;
        callback(external, this);
      });
    }
    observe(target, options) { this.native.observe(target, options); }
    disconnect() { this.native.disconnect(); }
    takeRecords() { return this.native.takeRecords().filter((r) => !internalRecord(r)); }
  }

  // Preserve the platform API behavior; only self-generated PCB Pro UI mutations are removed.
  window.MutationObserver = PCBProMutationObserver;

  window.__PCBPRO_PERF_GUARD__ = {
    version: VERSION,
    mode: 'low-spec-safe',
    nativeMutationObserver: NativeMutationObserver
  };

  document.documentElement.dataset.pcbproPerf = 'low-spec-safe';

  const style = document.createElement('style');
  style.id = 'pcbpro-pointer-safety';
  style.textContent = `
    #pcbpro-patch-modal:not(.open),
    #pcbpro-kicad-flow:not(.open){pointer-events:none!important}
    #pcbpro-patch-modal.open,
    #pcbpro-kicad-flow.open{pointer-events:auto!important}
    [data-wire-overlay]{pointer-events:none!important}
    [data-wire-overlay] .wire-hit{pointer-events:stroke!important}
    .pcb-pin{pointer-events:none!important}
    .schematic.pcb-wire-mode .pcb-pin{pointer-events:auto!important}
  `;
  document.head.appendChild(style);
})();