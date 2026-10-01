(() => {
  'use strict';

  if (window.__PCBPRO_PERF_GUARD__) return;

  const VERSION = '1.1.0';

  window.__PCBPRO_PERF_GUARD__ = {
    version: VERSION,
    mode: 'low-spec-safe',
    mutationObserver: 'native'
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