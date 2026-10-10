(() => {
  'use strict';

  if (window.__PCBPRO_RUNTIME_LOADER__) return;
  window.__PCBPRO_RUNTIME_LOADER__ = { version: '1.25.0', loaded: new Set() };
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
    window.PCBProExplain?.refresh?.();
    window.PCBProAssistantV115?.refresh?.();
  }

  async function maybeLoadDeepLearning() {
    await load('/learning-depth-v112.js?v=1.12.0');
    window.PCBProLearningMergeV112?.merge?.();
    window.PCBProDeepLearning?.merge?.();
    window.PCBProAssistantBrain?.rebuildLibrary?.();
    window.PCBProExplain?.refresh?.();
  }

  async function boot() {
    await load('/interaction-bridge.js');
    await load('/component-catalog-v116.js?v=1.16.0');

    // Editing engines first: schematic connectivity, learning, KiCad-like behavior, PCB geometry, and universal explanation.
    await load('/wire-engine.js?v=2.1.0');
    await load('/ux-engine.js');
    await load('/patch-v110.js');
    await load('/patch-v111.js');
    await load('/patch-v112.js');
    await load('/patch-v113.js');
    await load('/patch-v114.js');
    await load('/patch-v115.js');
    await load('/patch-v116.js');
    await load('/patch-v117.js');
    await load('/patch-v118.js');
    await load('/patch-v119.js');
    await load('/patch-v120.js');
    await load('/patch-v121.js');
    await load('/patch-v122.js');
    await load('/patch-v123.js');
    window.PCBProCommand?.stamp?.();
    await load('/kicad-workflow.js');
    await load('/workspace-repair.js?v=1.4.0');
    await load('/learning-center.js?v=1.0.0');
    await load('/learning-merge-v112.js?v=1.12.0');
    await load('/kicad-behavior.js?v=1.0.0');
    await load('/pcb-command-dock-v122.js?v=1.22.0');
    await load('/pcb-layout-engine.js?v=1.4.0');
    await load('/board-advanced-engine.js?v=1.2.0');
    await load('/board-workflow-bridge.js?v=1.0.0');
    await load('/explain-engine-v113.js?v=1.13.0');
    await load('/learning-professional-v123.js?v=1.23.0');
    await load('/engineering-help-v123.js?v=1.23.0');
    await load('/manufacturing-engine-v120.js?v=1.20.0');
    await load('/geometry-3d-engine-v120.js?v=1.20.0');
    await load('/database-engine-v117.js?v=1.21.0');
    await load('/portable-backup-v124.js?v=1.24.0');
    await load('/professional-engine-v118.js?v=1.21.0');
    await load('/physical-drc-v121.js?v=1.21.0');
    await load('/spice-netlist-v125.js?v=1.25.0');
    await load('/autorouter-v123.js?v=1.23.0');
    await load('/project-command-bus-v115.js?v=1.23.0');
    await load('/domain-integrity-v121.js?v=1.21.0');
    await load('/engineering-verification-v125.js?v=1.25.0');
    await load('/stability-engine-v123.js?v=1.23.0');
    window.PCBProWireEngine?.refresh?.(0);
    window.PCBProKiCadBehavior?.repair?.();
    window.PCBProPcbDock?.refresh?.();
    window.PCBProBoardModel?.refresh?.();
    window.PCBProAdvancedBoard?.refresh?.();
    window.PCBProManufacturing?.mount?.();
    window.PCBProGeometry3D?.mount?.();
    window.PCBProBoardWorkflowBridge?.install?.();
    window.PCBProLearningMergeV112?.merge?.();
    window.PCBProLearningCenter?.refresh?.();
    window.PCBProProfessionalLearning?.ensure?.();
    window.PCBProHelp?.scan?.();
    window.PCBProExplain?.refresh?.();

    // The AI engineering agent is deferred so editing remains responsive. It uses typed commands, local RAG/memory, and LLM planning/reasoning.
    idle(async () => {
      await load('/assistant-brain-v115.js?v=1.23.0');
      await load('/assistant-engine-v115.js?v=1.23.0');
      await load('/component-intel.js');
      window.PCBProCommand?.stamp?.();
      window.PCBProWorkspaceRepair?.repair?.();
      window.PCBProWireEngine?.refresh?.(0);
      window.PCBProKiCadBehavior?.repair?.();
      window.PCBProPcbDock?.refresh?.();
      window.PCBProBoardModel?.refresh?.();
      window.PCBProAdvancedBoard?.refresh?.();
      window.PCBProManufacturing?.mount?.();
      window.PCBProGeometry3D?.refresh?.();
      window.PCBProBoardWorkflowBridge?.install?.();
      window.PCBProPatchV110?.inject?.();
      window.PCBProPatchV111?.inject?.();
      window.PCBProPatchV112?.inject?.();
      window.PCBProPatchV113?.inject?.();
      window.PCBProPatchV114?.inject?.();
      window.PCBProPatchV115?.inject?.();
      window.PCBProPatchV116?.inject?.();
      window.PCBProPatchV117?.inject?.();
      window.PCBProPatchV118?.inject?.();
      window.PCBProPatchV119?.inject?.();
      window.PCBProPatchV120?.inject?.();
      window.PCBProPatchV121?.inject?.();
      window.PCBProPatchV122?.inject?.();
      window.PCBProPatchV123?.inject?.();
      window.PCBProLearningMergeV112?.merge?.();
      window.PCBProLearningCenter?.refresh?.();
      window.PCBProProfessionalLearning?.ensure?.();
      window.PCBProHelp?.scan?.();
      window.PCBProExplain?.refresh?.();
      window.PCBProAssistantV115?.refresh?.();
      window.PCBProStability?.run?.();
    }, 700);

    document.addEventListener('click', async (event) => {
      if (event.target?.closest?.('#pcbpro-learning-trigger')) setTimeout(maybeLoadDeepLearning, 0);
      const tab = event.target?.closest?.('.tabs button');
      if (!tab) return;
      const view = tab.dataset.pcbView || tab.textContent || '';
      if (/simulator|simulasi/i.test(view)) setTimeout(maybeLoadLiveSimulation, 0);
      if (/^3d$/i.test(String(view).trim())) setTimeout(()=>window.PCBProGeometry3D?.mount?.(),0);
      if (/fabrication|fabrikasi/i.test(String(view).trim())) setTimeout(()=>window.PCBProManufacturing?.mount?.(),0);
      if (/^pcb$/i.test(String(view).trim())) setTimeout(()=>{
        window.PCBProPcbDock?.refresh?.();
        window.PCBProBoardModel?.refresh?.();
        window.PCBProAdvancedBoard?.refresh?.();
        window.PCBProBoardWorkflowBridge?.install?.();
        window.PCBProExplain?.refresh?.();
        window.PCBProAssistantV115?.refresh?.();
      },0);
    }, { passive: true });

    idle(maybeLoadLiveSimulation, 1700);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();