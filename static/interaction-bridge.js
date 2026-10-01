(() => {
  'use strict';

  if (window.PCBProCommand) return;

  const VERSION = '1.0.0';
  const viewAliases = {
    schematic:['schematic','skematik'], pcb:['pcb'], simulator:['simulator','simulasi'],
    '3d':['3d'], bom:['bom'], fabrication:['fabrication','fabrikasi'], rules:['rules','aturan'], release:['release','rilis']
  };
  const toolAliases = {
    select:['select','pilih'], place:['place','tempatkan'], wire:['wire','kabel'], bus:['bus'],
    'net label':['net label','label net'], junction:['junction','sambungan'], 'no connect':['no connect','tidak terhubung'],
    power:['power','daya'], pan:['pan','geser'], measure:['measure','ukur'], annotate:['annotate','anotasi'],
    route:['route','jalur'], via:['via'], zone:['zone'], keepout:['keepout'], dimension:['dimension'], tune:['tune'],
    'layer swap':['layer swap'], ratsnest:['ratsnest']
  };

  const norm = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g,' ');
  const findCanonical = (raw, table) => {
    const text = norm(raw);
    for (const [canonical, aliases] of Object.entries(table)) if (aliases.includes(text)) return canonical;
    return text;
  };

  function stamp() {
    document.querySelectorAll('.tabs button').forEach((b) => {
      const raw = b.textContent;
      b.dataset.pcbView = b.dataset.pcbView || findCanonical(raw, viewAliases);
    });
    document.querySelectorAll('.tools button').forEach((b) => {
      const raw = b.querySelector('small')?.textContent || b.textContent;
      b.dataset.pcbTool = b.dataset.pcbTool || findCanonical(raw, toolAliases);
    });
  }

  function findView(name) {
    stamp();
    const canonical = findCanonical(name, viewAliases);
    return [...document.querySelectorAll('.tabs button')].find((b) => b.dataset.pcbView === canonical || findCanonical(b.textContent, viewAliases) === canonical) || null;
  }

  function findTool(name) {
    stamp();
    const canonical = findCanonical(name, toolAliases);
    return [...document.querySelectorAll('.tools button')].find((b) => b.dataset.pcbTool === canonical || findCanonical(b.querySelector('small')?.textContent || b.textContent, toolAliases) === canonical) || null;
  }

  function clickView(name) {
    const button = findView(name);
    if (!button) return false;
    button.click();
    setTimeout(stamp, 0);
    return true;
  }

  function clickTool(name) {
    const button = findTool(name);
    if (!button) return false;
    button.click();
    setTimeout(stamp, 0);
    return true;
  }

  document.addEventListener('click', () => setTimeout(stamp, 0), { passive:true });
  window.addEventListener('pcbpro:language', () => setTimeout(stamp, 0));
  window.addEventListener('load', stamp, { once:true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', stamp, { once:true });
  else stamp();

  window.PCBProCommand = { version:VERSION, stamp, findView, findTool, clickView, clickTool };
})();