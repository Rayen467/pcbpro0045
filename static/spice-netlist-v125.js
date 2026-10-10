(() => {
  'use strict';
  if (window.PCBProSpiceV125) return;
  const VERSION = '1.25.0';
  const MAX_ITEMS = 10000;
  const parsePins = net => Array.isArray(net?.pinList) ? net.pinList.map(String) :
    Array.isArray(net?.pins) ? net.pins.map(String) : String(net?.pins || '').split(/[·,;\s]+/).filter(Boolean);
  const validToken = name => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  const valueNumber = raw => {
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
    const m = String(raw || '').trim().replace(',', '.').match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(meg|[pnumkMGTµμ]?)\s*(Ω|ohm|ohms|F|H|V|A)?$/i);
    if (!m) return NaN;
    const scale = { '': 1, p:1e-12, n:1e-9, u:1e-6, 'µ':1e-6, 'μ':1e-6, m:1e-3, k:1e3, M:1e6, G:1e9, T:1e12, meg:1e6 };
    return Number(m[1]) * (scale[m[2]] ?? scale[m[2].toLowerCase()] ?? NaN);
  };
  const issue = (code, severity, message, ref) => ({ code, severity, message, ...(ref ? { ref } : {}) });
  const isGround = name => /^(GND(?:\s*\/\s*0)?|GROUND|0)$/i.test(name);

  function build(components, nets, options = {}) {
    const issues = [];
    const fail = (code, message, ref) => issues.push(issue(code, 'blocker', message, ref));
    const warn = (code, message, ref) => issues.push(issue(code, 'warning', message, ref));
    if (!Array.isArray(components) || !Array.isArray(nets) ||
      components.length > MAX_ITEMS || nets.length > MAX_ITEMS) {
      return { ok:false, issues:[issue('INPUT','blocker','Invalid component or netlist input.')], lines:[], stats:{} };
    }
    if (!components.length) fail('NO_COMPONENTS','Project has no components. Demo values are never substituted.');
    if (!nets.length) fail('NO_NETS','Project has no real wired nets. Connect pins in Schematic first.');

    const refs = new Set();
    for (const c of components) {
      if (!c || !validToken(c.id || '') || refs.has(c.id)) fail('COMPONENT_REF', 'Invalid or duplicate component reference.', c?.id);
      else refs.add(c.id);
    }

    const pinMap = new Map(), seenNet = new Set(), groundNets = new Set(), netPinCounts = new Map();
    for (const n of nets) {
      const name = String(n?.name || '').trim(), pins = parsePins(n);
      if (!validToken(name) && name !== '0') { fail('NET_NAME', 'Net has an invalid SPICE node name: ' + name); continue; }
      if (seenNet.has(name)) fail('DUPLICATE_NET', 'Duplicate net name: ' + name);
      seenNet.add(name);
      netPinCounts.set(name, pins.length);
      if (isGround(name)) groundNets.add(name);
      for (const p of pins) {
        if (!/^[A-Za-z][A-Za-z0-9_-]*\.\d+$/.test(p)) { fail('PIN_FORMAT','Invalid pin token: ' + p); continue; }
        const ref = p.split('.')[0];
        if (!refs.has(ref)) fail('UNKNOWN_PIN','Net references missing component: ' + p, ref);
        if (pinMap.has(p) && pinMap.get(p) !== name) fail('PIN_MULTI_NET','Pin belongs to multiple nets: ' + p, ref);
        else pinMap.set(p,name);
        if (String(components.find(c => c?.id === ref)?.code || '').toUpperCase() === 'GND') groundNets.add(name);
      }
    }
    if (groundNets.size === 0) fail('NO_GROUND','Ground net is missing. Connect a GND symbol or name a net GND/0.');
    if (groundNets.size > 1) fail('MULTIPLE_GROUNDS','Several different ground nets are not electrically joined: ' + [...groundNets].join(', '));
    const ground = groundNets.size === 1 ? [...groundNets][0] : null;
    const toSpiceNode = name => name === ground ? '0' : name;
    const lines = [
      '* SirkuitLab PCB Pro - simulation input, NOT a certified hardware result',
      '* Generated from actual schematic net connectivity; no placeholder parts or voltages',
      '* Run in ngspice or another compatible SPICE engine; validate vendor models for sign-off'
    ];
    let emitted = 0, genericModels = 0;
    const names = new Set();
    for (const c of components) {
      if (!c || !validToken(c.id || '')) continue;
      const kind = String(c.code || '').toUpperCase();
      if (['GND','J','TP'].includes(kind)) {
        if (kind !== 'GND') warn('NON_ELECTRICAL','Connector or test point has no SPICE behavior.',c.id);
        continue;
      }
      if (!['R','C','L','V','I','D','LED'].includes(kind)) {
        fail('UNSUPPORTED_MODEL','No verified SPICE model mapping for component type "' + kind + '".',c.id);
        continue;
      }
      const n1 = pinMap.get(c.id + '.1'), n2 = pinMap.get(c.id + '.2');
      if (!n1 || !n2) { fail('MISSING_PINS','Pins 1 and 2 must both be connected to real nets.',c.id); continue; }
      if (n1 === n2) { fail('SHORTED_DEVICE','Both pins are connected to the same net.',c.id); continue; }
      if (['R','C','L','V','I'].includes(kind)) {
        const num = valueNumber(c.value);
        if (!Number.isFinite(num) || (['R','C','L'].includes(kind) && num <= 0)) {
          fail('INVALID_VALUE', 'Unsupported or invalid engineering value "' + String(c.value) + '".',c.id);
          continue;
        }
        const inst = c.id.toUpperCase().startsWith(kind) ? c.id : kind + '_' + c.id;
        if (names.has(inst)) { fail('INSTANCE_COLLISION','Duplicate SPICE instance: ' + inst,c.id); continue; }
        names.add(inst);
        lines.push(inst + ' ' + toSpiceNode(n1) + ' ' + toSpiceNode(n2) +
          (kind === 'V' || kind === 'I' ? ' DC ' : ' ') + num.toExponential(12));
        emitted++;
      } else if (options.allowGenericDiodes === true) {
        const inst = c.id.toUpperCase().startsWith('D') ? c.id : 'D_' + c.id;
        if (names.has(inst)) { fail('INSTANCE_COLLISION','Duplicate SPICE instance: ' + inst,c.id); continue; }
        names.add(inst);
        lines.push(inst + ' ' + toSpiceNode(n1) + ' ' + toSpiceNode(n2) + (kind === 'LED' ? ' DEMO_LED' : ' DEMO_DIODE'));
        warn('GENERIC_MODEL','Illustrative generic diode model only; NOT a manufacturer model.',c.id);
        genericModels++;
        emitted++;
      } else {
        fail('MISSING_VENDOR_MODEL','Diode/LED requires a verified vendor model or explicit demo opt-in.',c.id);
      }
    }
    if (!emitted) fail('NO_DEVICES','No simulatable device was generated.');
    if (genericModels) {
      lines.push('.model DEMO_DIODE D(Is=1e-14 N=1)');
      lines.push('.model DEMO_LED D(Is=1e-20 N=2 Rs=18)');
    }
    lines.push('.op', '.end');
    const blockers = issues.filter(x => x.severity === 'blocker');
    return {
      ok:blockers.length === 0, issues,
      lines:blockers.length ? [] : lines,
      stats:{components:components.length, nets:nets.length, mappedDevices:emitted, genericModels, blockers:blockers.length},
      accuracy:'external-solver-input-not-validated'
    };
  }

  function current() {
    return build(
      window.PCBProProject?.getComponents?.() || [],
      window.PCBProWireEngine?.nets || [],
      { allowGenericDiodes:false }
    );
  }
  function downloadText(contents, name) {
    const blob = new Blob([contents],{type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  function exportFile(allowGenericDiodes = false) {
    const result = build(
      window.PCBProProject?.getComponents?.() || [],
      window.PCBProWireEngine?.nets || [],
      {allowGenericDiodes}
    );
    if (!result.ok) {
      show(result);
      return result;
    }
    downloadText(result.lines.join('\n') + '\n','sirkuitlab-design.cir');
    return result;
  }
  function show(report = current()) {
    document.getElementById('pcbpro-spice-dialog')?.remove();
    const modal = document.createElement('div');
    modal.id = 'pcbpro-spice-dialog';
    modal.style.cssText='position:fixed;inset:0;background:#000c;z-index:3300;display:grid;place-items:center;padding:14px';
    const shell = document.createElement('section');
    shell.style.cssText='max-width:720px;width:100%;max-height:88vh;overflow:auto;background:#0b1922;color:#dce8ee;border:1px solid #335868;border-radius:12px;padding:20px;display:grid;gap:12px;font:13px/1.5 system-ui';
    const heading=document.createElement('h3');heading.textContent='SPICE Netlist · Engineering Validation';heading.style.margin='0';
    const summary=document.createElement('p');summary.textContent=(report.ok?'READY TO EXPORT (not hardware sign-off)':'BLOCKED · correct issues before export')+' · '+(report.stats.components ?? 0)+' components · '+(report.stats.nets ?? 0)+' nets · '+(report.stats.mappedDevices ?? 0)+' modeled devices';
    const list=document.createElement('div');list.style.cssText='display:grid;gap:6px;max-height:300px;overflow:auto';
    for(const item of report.issues.length?report.issues:[issue('OK','info','No connectivity/value blockers detected. External SPICE simulation is not yet executed.')]){
      const p=document.createElement('p');p.style.cssText='margin:0;background:#132933;padding:7px;border-radius:6px';
      p.textContent=item.severity.toUpperCase()+' · '+item.code+' · '+(item.ref?item.ref+': ':'')+item.message;list.appendChild(p);
    }
    const actions=document.createElement('div');actions.style.cssText='display:flex;flex-wrap:wrap;gap:8px';
    const add=(text,onclick)=>{const b=document.createElement('button');b.textContent=text;b.style.cssText='background:#154c4b;color:#eaffff;border:1px solid #357e78;border-radius:7px;padding:9px 11px;cursor:pointer';b.onclick=onclick;actions.appendChild(b)};
    add('Export strict .cir',()=>{exportFile(false);if(current().ok)modal.remove();});
    add('Export demo diodes (labeled)',()=>{const r=exportFile(true);if(r.ok)modal.remove();});
    add('Close',()=>modal.remove());
    const note=document.createElement('small');note.textContent='No ngspice execution here: this exports input for an external SPICE solver. Generic diode models are educational only; unsupported ICs are blocked.';
    shell.append(heading,summary,list,note,actions);modal.appendChild(shell);
    modal.onclick=e=>{if(e.target===modal)modal.remove();};
    document.body.appendChild(modal);
  }
  function mount(){
    const host=document.querySelector('.top-actions');
    if(!host || document.getElementById('pcbpro-spice-trigger'))return;
    const button=document.createElement('button');
    button.id='pcbpro-spice-trigger';button.type='button';button.textContent='SPICE';
    button.title='Validate the current schematic and export a real SPICE netlist';
    button.onclick=()=>show();
    button.style.cssText='border:1px solid #2b6661;background:#102823;color:#77d6c5;border-radius:7px;padding:7px 9px;font:800 10px system-ui';
    host.appendChild(button);
  }
  function start(){
    mount();
    document.addEventListener('click',()=>setTimeout(mount,0),{passive:true});
  }
  window.PCBProSpiceV125={version:VERSION,build,current,show,exportFile,parseValue:valueNumber};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();