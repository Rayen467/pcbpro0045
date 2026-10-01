(() => {
  'use strict';
  if (window.PCBProKiCadBehavior) return;

  const VERSION = '1.0.0';
  let moveMode = '';
  let moveRef = '';
  let rightPan = null;

  const lang = () => window.PCBProUX?.lang || localStorage.getItem('pcbpro0045-lang') || 'id';
  const t = (id, en) => lang() === 'id' ? id : en;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function notify(message, tone='info') {
    const api = window.PCBProWorkspaceRepair;
    if (api?.notify) return api.notify(message, tone);
    let el = document.querySelector('#pcbpro-kicad-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pcbpro-kicad-toast';
      Object.assign(el.style,{position:'fixed',zIndex:'2500',left:'50%',bottom:'24px',transform:'translateX(-50%)',background:'#0d1b24',border:'1px solid #31505e',color:'#d9e7ee',borderRadius:'9px',padding:'10px 13px',fontSize:'11px',boxShadow:'0 18px 60px #000b'});
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.hidden = false;
    clearTimeout(el._timer);
    el._timer = setTimeout(()=>{el.hidden=true},2600);
  }

  function selectedNode() {
    return document.querySelector('.stage.schematic .node.selected') || document.querySelector('.stage.schematic .node');
  }
  function refOf(node) { return node?.querySelector('.ref')?.textContent?.trim() || ''; }

  function clickTool(name) {
    return window.PCBProCommand?.clickTool?.(name) || false;
  }
  function clickView(name) {
    return window.PCBProCommand?.clickView?.(name) || false;
  }

  function disconnectRef(ref) {
    const engine = window.PCBProWireEngine;
    if (!engine || !ref) return 0;
    const routes = engine.routes || [];
    let count = 0;
    for (const r of routes) {
      if (String(r.from).startsWith(`${ref}.`) || String(r.to).startsWith(`${ref}.`)) {
        if (window.PCBProProject?.deleteWire?.(r.id)) count++;
      }
    }
    return count;
  }

  function armMove(mode) {
    const node = selectedNode();
    const ref = refOf(node);
    if (!node || !ref) {
      notify(t('Pilih komponen dulu, lalu tekan M atau G.','Select a component first, then press M or G.'),'warn');
      return;
    }
    clickView('Schematic');
    clickTool('Select');
    moveMode = mode;
    moveRef = ref;
    document.body.dataset.pcbMoveMode = mode;
    node.classList.add('pcb-kicad-move-armed');
    notify(mode === 'move'
      ? t(`${ref}: MOVE aktif. Drag komponen; koneksi ke pin akan diputus seperti Move.`,`${ref}: MOVE armed. Drag the component; pin connections will be detached.`)
      : t(`${ref}: DRAG aktif. Drag komponen; wire tetap terhubung seperti KiCad G.`,`${ref}: DRAG armed. Drag the component; wires stay connected like KiCad G.`));
  }

  function clearMove() {
    moveMode=''; moveRef='';
    delete document.body.dataset.pcbMoveMode;
    document.querySelectorAll('.pcb-kicad-move-armed').forEach((n)=>n.classList.remove('pcb-kicad-move-armed'));
  }

  function nativeSet(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
    setter?.call(input,value);
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function propertyInput(labelName) {
    const props = [...document.querySelectorAll('.inspector section')].find((s)=>/PROPERTIES|PROPERTI/i.test(s.querySelector('.ins-title span')?.textContent || ''));
    return [...(props?.querySelectorAll('label') || [])].find((l)=>String(l.querySelector('span')?.textContent||'').trim().toLowerCase()===labelName.toLowerCase())?.querySelector('input') || null;
  }

  function editValue() {
    const input = propertyInput(lang()==='id'?'Nilai':'Value') || propertyInput('Value');
    if (!input) return notify(t('Pilih komponen dulu.','Select a component first.'),'warn');
    input.focus(); input.select?.();
    notify(t('Edit nilai komponen di inspector, lalu Enter/klik di luar.','Edit the component value in the inspector, then press Enter/click outside.'));
  }

  const footprintPresets = {
    V:['TerminalBlock_1x02_P5.08mm','PinHeader_1x02_P2.54mm'],
    R:['R_Axial_DIN0207_L6.3mm_D2.5mm_P10.16mm','R_0805','R_0603'],
    C:['C_Disc_D5.0mm_W2.5mm_P5.00mm','C_0805','C_0603'],
    LED:['LED_D5.0mm','LED_0603','LED_0805'],
    D:['D_DO-35_SOD27_P10.16mm','D_SOD-123','D_SOD-323'],
    Q:['SOT-23','TO-92_Inline'],
    U:['SOIC-8_3.9x4.9mm_P1.27mm','DIP-8_W7.62mm'],
    SW:['SW_THT','SW_SMD'],
    J:['PinHeader_1x02_P2.54mm','TerminalBlock_1x02_P5.08mm']
  };

  function currentCode() {
    const n = selectedNode();
    const ref = refOf(n);
    const text = `${ref} ${n?.querySelector('small')?.textContent||''}`.toLowerCase();
    if (/led/.test(text)) return 'LED';
    if (/resistor/.test(text)||/^r\d+/i.test(ref)) return 'R';
    if (/capacitor/.test(text)||/^c\d+/i.test(ref)) return 'C';
    if (/source|battery/.test(text)||/^v\d+/i.test(ref)) return 'V';
    if (/diode/.test(text)||/^d\d+/i.test(ref)) return 'D';
    if (/mosfet/.test(text)||/^q\d+/i.test(ref)) return 'Q';
    if (/op-amp/.test(text)||/^u\d+/i.test(ref)) return 'U';
    if (/switch/.test(text)||/^sw\d+/i.test(ref)) return 'SW';
    if (/connector/.test(text)||/^j\d+/i.test(ref)) return 'J';
    return ref.replace(/\d.*$/,'').toUpperCase();
  }

  function footprintPicker() {
    const input = propertyInput('Footprint');
    if (!input) return notify(t('Pilih komponen dulu.','Select a component first.'),'warn');
    const code = currentCode();
    const options = footprintPresets[code] || [];
    let modal = document.querySelector('#pcbpro-footprint-picker');
    modal?.remove();
    modal = document.createElement('div');
    modal.id='pcbpro-footprint-picker';
    modal.innerHTML=`<div class="kfp-card"><div class="kfp-head"><div><small>PCB PRO · FOOTPRINT</small><h3>${esc(refOf(selectedNode()))}</h3></div><button data-close>×</button></div><p>${t('Pilih footprint fisik. Pastikan pitch, jumlah pin, dan ukuran sesuai datasheet/komponen nyata.','Choose a physical footprint. Verify pitch, pin count and dimensions against the actual component/datasheet.')}</p><div class="kfp-options">${options.map((x)=>`<button data-fp="${esc(x)}">${esc(x)}</button>`).join('') || `<span>${t('Belum ada preset untuk komponen ini. Edit field Footprint manual.','No preset for this part yet. Edit the Footprint field manually.')}</span>`}</div><label>${t('Manual','Manual')}<input value="${esc(input.value||'')}"/></label><button class="kfp-apply">${t('Terapkan','Apply')}</button></div>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-close]').onclick=()=>modal.remove();
    modal.addEventListener('pointerdown',(e)=>{if(e.target===modal)modal.remove()});
    modal.querySelectorAll('[data-fp]').forEach((b)=>b.onclick=()=>{modal.querySelector('input').value=b.dataset.fp});
    modal.querySelector('.kfp-apply').onclick=()=>{nativeSet(input,modal.querySelector('input').value.trim());modal.remove();notify(t('Footprint diperbarui. Jalankan ERC lagi.','Footprint updated. Run ERC again.'))};
  }

  function runErc() {
    const findings = window.PCBProWorkflow?.runErc?.() || [];
    let modal=document.querySelector('#pcbpro-erc-report'); modal?.remove();
    modal=document.createElement('div'); modal.id='pcbpro-erc-report';
    modal.innerHTML=`<div class="kfp-card"><div class="kfp-head"><div><small>ERC · ELECTRICAL RULES CHECK</small><h3>${findings.length?`${findings.length} ${t('temuan','findings')}`:t('Lulus','Pass')}</h3></div><button data-close>×</button></div>${findings.length?`<ul>${findings.map((f)=>`<li>${esc(f)}</li>`).join('')}</ul>`:`<p>${t('Tidak ada temuan pada ERC dasar project aktif.','No findings in the active project basic ERC.')}</p>`}<button class="kfp-apply" data-close2>${t('Tutup','Close')}</button></div>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-close]').onclick=()=>modal.remove();
    modal.querySelector('[data-close2]').onclick=()=>modal.remove();
  }

  function annotate() {
    // Persist current Svelte state first so annotation works on the actual project, not stale storage.
    const save = [...document.querySelectorAll('.top-actions button')].find((b)=>/^(Save|Simpan)$/i.test(b.textContent.trim()));
    save?.click();
    setTimeout(()=>{
      try {
        const key='pcbpro0045-project-v11';
        const state=JSON.parse(localStorage.getItem(key)||'null');
        if (!Array.isArray(state?.components) || !state.components.length) return notify(t('Tidak ada komponen untuk dianotasi.','No components to annotate.'),'warn');
        const counters={};
        const map=new Map();
        state.components=state.components.map((c)=>{
          const prefix=String(c.id||c.code||'U').replace(/\d.*$/,'').toUpperCase()||'U';
          counters[prefix]=(counters[prefix]||0)+1;
          const id=`${prefix}${counters[prefix]}`;
          map.set(c.id,id);
          return {...c,id};
        });
        localStorage.setItem(key,JSON.stringify(state));
        const wk='pcbpro0045-wiregraph-v2';
        const wire=JSON.parse(localStorage.getItem(wk)||'null');
        if (Array.isArray(wire?.routes)) {
          wire.routes=wire.routes.map((r)=>{
            const convert=(pin)=>{const [ref,num]=String(pin).split('.');return `${map.get(ref)||ref}.${num||1}`};
            return {...r,from:convert(r.from),to:convert(r.to)};
          });
          localStorage.setItem(wk,JSON.stringify(wire));
        }
        notify(t('Annotation selesai. Project dimuat ulang dengan RefDes berurutan.','Annotation complete. Reloading with sequential RefDes.'));
        setTimeout(()=>location.reload(),450);
      } catch (e) { notify(`${t('Annotation gagal','Annotation failed')}: ${e.message}`,'bad'); }
    },80);
  }

  function switchToPcb() {
    const findings=window.PCBProWorkflow?.runErc?.()||[];
    if (findings.length) {
      notify(t(`ERC masih punya ${findings.length} temuan. PCB tetap bisa dibuka, tapi belum siap sign-off.`,`ERC still has ${findings.length} findings. PCB can open, but it is not ready for sign-off.`),'warn');
    }
    clickView('PCB');
  }

  function rightPanStart(e) {
    const st=e.target.closest?.('.stage');
    if (!st || e.button!==2) return;
    e.preventDefault();
    // Reuse the Svelte pointer engine's middle-button pan path with the same pointer id.
    st.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:1,pointerId:e.pointerId,clientX:e.clientX,clientY:e.clientY,pointerType:e.pointerType||'mouse'}));
    rightPan={id:e.pointerId};
  }

  function installStyles() {
    if (document.querySelector('#pcbpro-kicad-behavior-style')) return;
    const s=document.createElement('style'); s.id='pcbpro-kicad-behavior-style';
    s.textContent=`
      .pcb-kicad-move-armed{outline:2px solid #e8c86c!important;box-shadow:0 0 0 5px #e8c86c22!important}
      #pcbpro-kicad-flowbar{position:absolute;z-index:70;left:14px;bottom:48px;display:flex;gap:6px;align-items:center;padding:6px;border:1px solid #294451;background:#09151ee8;border-radius:9px;box-shadow:0 10px 28px #0007;backdrop-filter:blur(8px)}
      #pcbpro-kicad-flowbar button{border:1px solid #2c4856;background:#10202a;color:#b9ccd5;border-radius:7px;padding:7px 9px;font-size:9px;font-weight:800}#pcbpro-kicad-flowbar button:hover{border-color:#4e7c88;color:#fff}#pcbpro-kicad-flowbar b{font:800 8px ui-monospace;color:#5fd5bc;padding:0 4px}
      #pcbpro-footprint-picker,#pcbpro-erc-report{position:fixed;z-index:1800;inset:0;background:#000b;display:grid;place-items:center;padding:16px}.kfp-card{width:min(620px,94vw);max-height:82vh;overflow:auto;border:1px solid #304b59;border-radius:13px;background:#0d1821;padding:15px;color:#dce7ed;box-shadow:0 30px 100px #000d}.kfp-head{display:flex;justify-content:space-between;align-items:center}.kfp-head small{font:800 9px ui-monospace;color:#5fd5bc}.kfp-head h3{font-size:20px;margin:3px 0}.kfp-head button{width:32px;height:32px;border:1px solid #35515e;border-radius:7px;background:#13232d;color:#dce7ed}.kfp-card p,.kfp-card li{font-size:11px;line-height:1.55;color:#a9bbc5}.kfp-options{display:grid;gap:7px;margin:12px 0}.kfp-options button{border:1px solid #2a4854;background:#10232b;color:#cfe0e7;border-radius:8px;padding:10px;text-align:left}.kfp-card label{display:grid;gap:5px;font-size:9px;color:#7e97a4}.kfp-card input{border:1px solid #2d4653;background:#08131b;color:#dce7ed;border-radius:8px;padding:10px}.kfp-apply{margin-top:10px;border:1px solid #2a8c78;background:#176c5c;color:#fff;border-radius:8px;padding:9px 12px;font-weight:800}
      @media(max-width:800px){#pcbpro-kicad-flowbar{left:8px;right:8px;overflow:auto}#pcbpro-kicad-flowbar b{display:none}}
    `;
    document.head.appendChild(s);
  }

  function mountFlowbar() {
    const stage=document.querySelector('.stage.schematic');
    if (!stage || stage.querySelector('#pcbpro-kicad-flowbar')) return;
    const bar=document.createElement('div'); bar.id='pcbpro-kicad-flowbar';
    bar.innerHTML=`<b>KiCad Flow</b><button data-a="wire">W · ${t('Kabel','Wire')}</button><button data-a="annotate">${t('Anotasi','Annotate')}</button><button data-a="footprint">${t('Footprint','Footprint')}</button><button data-a="erc">ERC</button><button data-a="pcb">→ PCB</button>`;
    bar.querySelector('[data-a="wire"]').onclick=()=>clickTool('wire');
    bar.querySelector('[data-a="annotate"]').onclick=annotate;
    bar.querySelector('[data-a="footprint"]').onclick=footprintPicker;
    bar.querySelector('[data-a="erc"]').onclick=runErc;
    bar.querySelector('[data-a="pcb"]').onclick=switchToPcb;
    stage.appendChild(bar);
  }

  function onKey(e) {
    if (['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName)) return;
    const k=e.key.toLowerCase();
    if (k==='m') { e.preventDefault(); armMove('move'); }
    else if (k==='g') { e.preventDefault(); armMove('drag'); }
    else if (k==='e' || k==='v') { e.preventDefault(); editValue(); }
    else if (k==='f') { e.preventDefault(); footprintPicker(); }
    else if (k==='a' && e.shiftKey) { e.preventDefault(); annotate(); }
    else if (k==='w') { setTimeout(()=>clickTool('wire'),0); }
    else if (e.key==='PageUp') { e.preventDefault(); clickView('PCB'); document.querySelectorAll('.layer-strip button').forEach((b)=>{if(/F\.Cu/i.test(b.textContent))b.click()}); }
    else if (e.key==='PageDown') { e.preventDefault(); clickView('PCB'); document.querySelectorAll('.layer-strip button').forEach((b)=>{if(/B\.Cu/i.test(b.textContent))b.click()}); }
    else if (e.key==='Escape') clearMove();
  }

  function onPointerDown(e) {
    if (e.button===2) return rightPanStart(e);
    if (!moveMode) return;
    const node=e.target.closest?.('.stage.schematic .node');
    if (!node || refOf(node)!==moveRef) return;
    if (moveMode==='move') {
      const broken=disconnectRef(moveRef);
      if (broken) notify(t(`${moveRef}: ${broken} koneksi dilepas. G gunakan Drag kalau wire harus tetap terhubung.`,`${moveRef}: detached ${broken} connection(s). Use G/Drag to preserve wires.`),'warn');
    }
  }

  function onPointerUp(e) {
    if (rightPan?.id===e.pointerId) rightPan=null;
    if (moveMode) setTimeout(clearMove,0);
  }

  function repair() {
    mountFlowbar();
  }

  function start() {
    installStyles();
    document.addEventListener('keydown',onKey,true);
    document.addEventListener('pointerdown',onPointerDown,true);
    document.addEventListener('pointerup',onPointerUp,true);
    document.addEventListener('contextmenu',(e)=>{if(e.target.closest?.('.stage'))e.preventDefault()});
    document.addEventListener('click',()=>setTimeout(repair,0),{passive:true});
    window.addEventListener('pcbpro:language',()=>setTimeout(repair,0));
    repair();
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();

  window.PCBProKiCadBehavior={version:VERSION,armMove,annotate,footprintPicker,runErc,switchToPcb,repair};
})();
