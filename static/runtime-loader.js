(() => {
  'use strict';

  if (window.__PCBPRO_RUNTIME_LOADER__) return;
  window.__PCBPRO_RUNTIME_LOADER__ = { version: '1.0.0', loaded: new Set() };
  const state = window.__PCBPRO_RUNTIME_LOADER__;

  function load(src) {
    if (state.loaded.has(src) || document.querySelector(`script[data-pcbpro-runtime="${src}"]`)) return Promise.resolve();
    state.loaded.add(src);
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.pcbproRuntime = src;
      script.onload = () => resolve();
      script.onerror = () => {
        state.loaded.delete(src);
        console.warn('[PCB Pro runtime] failed to load', src);
        resolve();
      };
      document.body.appendChild(script);
    });
  }

  function idle(fn, timeout = 1200) {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => fn(), { timeout });
    } else {
      setTimeout(fn, Math.min(600, timeout));
    }
  }

  function simulatorVisible() {
    return [...document.querySelectorAll('.panel-title span')].some((el) => /SIMULATION|SIMULASI/i.test(el.textContent || ''));
  }

  function maybeLoadReality() {
    if (simulatorVisible()) load('/reality-engine.js');
  }

  async function boot() {
    // Core interaction first. These are intentionally small and delayed until after first paint.
    await load('/wire-engine.js');
    await load('/ux-engine.js');

    // Assistant and component intelligence can wait for an idle slice.
    idle(async () => {
      await load('/assistant-engine.js');
      await load('/assistant-grounding.js');
      await load('/component-intel.js');
    }, 900);

    // Heavy field simulation is loaded only when the Simulator workspace is actually opened.
    document.addEventListener('click', (event) => {
      const tab = event.target?.closest?.('.tabs button');
      if (!tab) return;
      if (/Simulator|Simulasi/i.test(tab.textContent || '')) setTimeout(maybeLoadReality, 0);
    }, { passive: true });

    // Handle restored sessions that already start in Simulator.
    idle(maybeLoadReality, 1800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
