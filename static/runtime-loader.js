(() => {
  'use strict';

  if (window.__PCBPRO_RUNTIME_LOADER__) return;
  window.__PCBPRO_RUNTIME_LOADER__ = { version: '1.9.0', loaded: new Set() };
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
    window.PCBProWorkspaceRepair?.repair?.();
  }

  async function boot() {
    await load('/interaction-bridge.js');

    // Editing engines first: schematic connectivity, KiCad-like behavior, then PCB geometry.
    await load('/wire-engine.js?v=2.0.0');
    await load('/ux-engine.js');
    window.PCBProCommand?.stamp?.();
    await load('/kicad-workflow.js');
    await load('/workspace-repair.js');
    await load('/kicad-behavior.js?v=1.0.0');
    await load('/pcb-layout-engine.js?v=1.0.0');
    await load('/board-advanced-engine.js?v=1.0.0');
    await load('/board-workflow-bridge.js?v=1.0.0');
    window.PCBProWireEngine?.refresh?.(0);
    window.PCBProKiCadBehavior?.repair?.();
    window.PCBProBoardModel?.refresh?.();
    window.PCBProAdvancedBoard?.refresh?.();
    window.PCBProBoardWorkflowBridge?.install?.();

    // Assistant and component intelligence stay deferred so the canvas becomes interactive first.
    idle(async () => {
      await load('/assistant-engine.js');
      await load('/assistant-grounding.js');
      await load('/component-intel.js');
      window.PCBProCommand?.stamp?.();
      window.PCBProWorkspaceRepair?.repair?.();
      window.PCBProWireEngine?.refresh?.(0);
      window.PCBProKiCadBehavior?.repair?.();
      window.PCBProBoardModel?.refresh?.();
      window.PCBProAdvancedBoard?.refresh?.();
      window.PCBProBoardWorkflowBridge?.install?.();
    }, 850);

    document.addEventListener('click', (event) => {
      const tab = event.target?.closest?.('.tabs button');
      if (!tab) return;
      const view = tab.dataset.pcbView || tab.textContent || '';
      if (/simulator|simulasi/i.test(view)) setTimeout(maybeLoadLiveSimulation, 0);
      if (/^pcb$/i.test(String(view).trim())) setTimeout(()=>{
        window.PCBProBoardModel?.refresh?.();
        window.PCBProAdvancedBoard?.refresh?.();
        window.PCBProBoardWorkflowBridge?.install?.();
      },0);
    }, { passive: true });

    idle(maybeLoadLiveSimulation, 1700);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();