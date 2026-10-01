(() => {
  'use strict';

  if (window.__PCBPRO_RUNTIME_LOADER__) return;
  window.__PCBPRO_RUNTIME_LOADER__ = { version: '1.2.0', loaded: new Set() };
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
    if ('requestIdleCallback' in window) requestIdleCallback(() => fn(), { timeout });
    else setTimeout(fn, Math.min(600, timeout));
  }

  function simulatorVisible() {
    return [...document.querySelectorAll('.panel-title span')].some((el) => /SIMULATION|SIMULASI/i.test(el.textContent || ''));
  }

  async function maybeLoadLiveSimulation() {
    if (!simulatorVisible() && !document.querySelector('.panel[data-real-sim-mounted="1"]')) return;
    await load('/sim-engine.js');
    await load('/live-sim-engine.js');
  }

  async function boot() {
    // Core interaction first. Keep startup light for older / integrated-GPU laptops.
    await load('/wire-engine.js');
    await load('/ux-engine.js');
    await load('/kicad-workflow.js');

    // Assistant is loaded after the workspace is interactive. Its actual LLM runs server-side.
    idle(async () => {
      await load('/assistant-engine.js');
      await load('/assistant-grounding.js');
      await load('/component-intel.js');
    }, 850);

    // Primary simulation is the live solver. The heavier Monte Carlo Reality Lab is loaded
    // only from the explicit "Advanced field analysis" button inside live simulation.
    document.addEventListener('click', (event) => {
      const tab = event.target?.closest?.('.tabs button');
      if (!tab) return;
      if (/Simulator|Simulasi/i.test(tab.textContent || '')) setTimeout(maybeLoadLiveSimulation, 0);
    }, { passive: true });

    idle(maybeLoadLiveSimulation, 1700);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();