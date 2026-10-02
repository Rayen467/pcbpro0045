(() => {
  'use strict';
  if (window.PCBProAdvancedBoard) return;

  const NS = 'http://www.w3.org/2000/svg';
  const VERSION = '1.1.0';
  const KEY = 'pcbpro0045-board-advanced-v1';
  let state = {
    version: VERSION,
    vias: [],
    zones: [],
    keepouts: [],
    diffPairs: [],
    stack: ['F.Cu','In1.GND','In2.Power','B.Cu'],
    activeLayer: 'F.Cu',
    activeNet: '',
    viaDiameterMm: 0.6,
    viaDrillMm: 0.3,
    zoneClearanceMm: 0.2
  };
  let mode = '';
  let draft = [];
  let pointer = null;
  let overlay = null;
  let hud = null;
  let scheduled = false;

  const lang = () => window.PCBProUX?.lang || localStorage.getItem('pcbpro0045-lang') || 'id';
  const t = (id,en) => lang()==='id' ? id : en;
  const svg = (tag, attrs={}) => { const el=document.createElementNS(NS,tag); for(const[k,v] of Object.entries(attrs)) el.setAttribute(k,String(v)); return el; };
  const esc = (v) => String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function load(){
    try{
      const x=JSON.parse(localStorage.getItem(KEY)||'null');
      if(x&&typeof x==='object') state={...state,...x,version:VERSION,
        vias:Array.isArray(x.vias)?x.vias:[],zones:Array.isArray(x.zones)?x.zones:[],keepouts:Array.isArray(x.keepouts)?x.keepouts:[],diffPairs:Array.isArray(x.diffPairs)?x.diffPairs:[]};
    }catch{}
  }
  function save(){ try{localStorage.setItem(KEY,JSON.stringify(state))}catch{} }
  function stage(){return document.querySelector('.stage.pcbstage')}
  function world(){return stage()?.querySelector('.world')||null}
  function nets(){return window.PCBProWireEngine?.nets || []}
  function netNames(){return nets().map(n=>n.name).filter(Boolean)}
  function board(){return window.PCBProBoardModel}
  function notify(msg,tone='info'){window.PCBProWorkspaceRepair?.notify?.(msg,tone)}

  function clientToWorld(x,y){
    const w=world(); if(!w) return {x:0,y:0};
    const r=w.getBoundingClientRect();
    const sx=r.width/Math.max(1,w.offsetWidth), sy=r.height/Math.max(1,w.offsetHeight);
    return {x:(x-r.left)/Math.max(.0001,sx), y:(y-r.top)/Math.max(.0001,sy)};
  }
  function path(points,close=false){return points.length?`M ${points.map(p=>`${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ')}${close?' Z':''}`:''}
  function pointInPoly(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];const hit=((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y+1e-9)+a.x);if(hit)inside=!inside}return inside}

  function ensureOverlay(){
    const w=world(); if(!w){overlay=null;return null}
    overlay=w.querySelector('[data-advanced-board-overlay]');
    if(!overlay){overlay=svg('svg',{'data-advanced-board-overlay':'1',preserveAspectRatio:'none'});w.appendChild(overlay)}
    overlay.setAttribute('viewBox',`0 0 ${Math.max(1,w.offsetWidth)} ${Math.max(1,w.offsetHeight)}`);
    return overlay;
  }

  function installStyles(){
    if(document.querySelector('#pcbpro-advanced-board-style')) return;
    const s=document.createElement('style'); s.id='pcbpro-advanced-board-style';
    s.textContent=`
      [data-advanced-board-overlay]{position:absolute;inset:0;width:100%;height:100%;z-index:12;overflow:visible;pointer-events:none}
      .ab-via{fill:#e6c46b;stroke:#18130a;stroke-width:2;vector-effect:non-scaling-stroke}.ab-via-hole{fill:#071018;stroke:#fff5;stroke-width:1;vector-effect:non-scaling-stroke}
      .ab-zone{fill:#5a9be022;stroke:#5a9be0;stroke-width:1.5;vector-effect:non-scaling-stroke}.ab-keepout{fill:#e06b5518;stroke:#e06b55;stroke-width:1.5;stroke-dasharray:7 5;vector-effect:non-scaling-stroke}
      .ab-draft{fill:none;stroke:#e8cb72;stroke-width:2;stroke-dasharray:6 4;vector-effect:non-scaling-stroke}.ab-node{fill:#e8cb72;stroke:#071018;stroke-width:1;vector-effect:non-scaling-stroke}
      #pcbpro-advanced-hud{position:absolute;z-index:75;right:14px;top:46px;display:flex;gap:5px;align-items:center;flex-wrap:wrap;max-width:min(740px,72%);padding:6px;border:1px solid #2e4654;background:#09151eed;border-radius:9px;box-shadow:0 12px 34px #0008;backdrop-filter:blur(8px)}
      #pcbpro-advanced-hud b{font:800 8px ui-monospace;color:#67d8c0;padding:0 4px}#pcbpro-advanced-hud button,#pcbpro-advanced-hud select{border:1px solid #2b4653;background:#10212b;color:#c5d4dc;border-radius:7px;padding:7px 8px;font-size:9px;font-weight:800}#pcbpro-advanced-hud button.active{border-color:#e4c05d;background:#3a2f13;color:#ffe28a}
      #pcbpro-advanced-modal{position:fixed;z-index:1950;inset:0;background:#000b;display:grid;place-items:center;padding:16px}.ab-card{width:min(760px,95vw);max-height:84vh;overflow:auto;border:1px solid #304b59;border-radius:13px;background:#0d1821;padding:15px;color:#dce7ed;box-shadow:0 30px 100px #000d}.ab-card h3{font-size:22px;margin:4px 0}.ab-card small{font:800 9px ui-monospace;color:#60d5bd}.ab-card p,.ab-card li{font-size:11px;line-height:1.55;color:#a9bbc5}.ab-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.ab-card label{display:grid;gap:5px;color:#8fa4af;font-size:9px}.ab-card input,.ab-card select{border:1px solid #2d4653;background:#08131b;color:#dce7ed;border-radius:8px;padding:9px}.ab-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.ab-actions button{border:1px solid #2a8c78;background:#176c5c;color:#fff;border-radius:8px;padding:9px 12px;font-weight:800}.ab-actions button.secondary{background:#12232d;border-color:#34505e;color:#cbd9e0}.ab-list{display:grid;gap:7px;margin-top:10px}.ab-row{border:1px solid #243b48;background:#0a141c;border-radius:8px;padding:9px;font-size:10px;color:#b9c9d1}.ab-bad{color:#ef9b86}.ab-good{color:#6adabd}
      @media(max-width:850px){#pcbpro-advanced-hud{left:8px;right:8px;top:46px;max-width:none;overflow:auto;flex-wrap:nowrap}.ab-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  function render(){
    scheduled=false; const ov=ensureOverlay(); if(!ov) return;
    ov.replaceChildren();
    for(const z of state.zones){if(z.points?.length<3)continue;const p=svg('path',{d:path(z.points,true),class:'ab-zone','data-net':z.net||'','data-layer':z.layer||''});ov.appendChild(p)}
    for(const k of state.keepouts){if(k.points?.length<3)continue;ov.appendChild(svg('path',{d:path(k.points,true),class:'ab-keepout'}))}
    for(const v of state.vias){ov.append(svg('circle',{cx:v.x,cy:v.y,r:6,class:'ab-via','data-net':v.net||''}),svg('circle',{cx:v.x,cy:v.y,r:2.4,class:'ab-via-hole'}))}
    if(draft.length){const pts=pointer?[...draft,pointer]:draft;ov.appendChild(svg('path',{d:path(pts,false),class:'ab-draft'}));for(const p of draft)ov.appendChild(svg('circle',{cx:p.x,cy:p.y,r:3,class:'ab-node'}))}
    updateHud();
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(render)}

  function selectNetHtml(){const names=netNames();if(!state.activeNet&&names.length)state.activeNet=names[0];return names.map(n=>`<option value="${esc(n)}"${n===state.activeNet?' selected':''}>${esc(n)}</option>`).join('')||'<option value="">NO NET</option>'}
  function updateHud(){
    const st=stage(); if(!st){hud?.remove();hud=null;return}
    if(!hud){hud=document.createElement('div');hud.id='pcbpro-advanced-hud';st.appendChild(hud)}
    hud.innerHTML=`<b>FIELD PCB · v${VERSION}</b><select data-net>${selectNetHtml()}</select><select data-layer>${state.stack.map(l=>`<option${l===state.activeLayer?' selected':''}>${esc(l)}</option>`).join('')}</select><button data-mode="via" class="${mode==='via'?'active':''}">Via</button><button data-mode="zone" class="${mode==='zone'?'active':''}">Zone</button><button data-mode="keepout" class="${mode==='keepout'?'active':''}">Keepout</button><button data-action="diff">Diff Pair</button><button data-action="stack">Stack</button><button data-action="drc">Adv DRC</button>`;
    hud.querySelector('[data-net]')?.addEventListener('change',e=>{state.activeNet=e.target.value;save()});
    hud.querySelector('[data-layer]')?.addEventListener('change',e=>{state.activeLayer=e.target.value;save()});
    hud.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(mode===b.dataset.mode?'':b.dataset.mode)));
    hud.querySelector('[data-action="diff"]')?.addEventListener('click',openDiffModal);
    hud.querySelector('[data-action="stack"]')?.addEventListener('click',openStackModal);
    hud.querySelector('[data-action="drc"]')?.addEventListener('click',showDrc);
  }
  function setMode(next){mode=next;draft=[];pointer=null;schedule();notify(next?t(`${next.toUpperCase()} aktif. Klik workspace untuk membuat geometri.`,` ${next.toUpperCase()} active. Click workspace to create geometry.`):t('Mode advanced dibatalkan.','Advanced mode cancelled.'))}

  function onCanvasDown(e){
    const st=stage(); if(!st||!mode||e.button!==0||!st.contains(e.target))return;
    if(e.target.closest?.('#pcbpro-advanced-hud,.pcb-board-pad,.footprint,.layer-strip,.stage-info'))return;
    e.preventDefault();e.stopPropagation();const p=clientToWorld(e.clientX,e.clientY);
    if(mode==='via'){
      if(!state.activeNet)return notify(t('Pilih net untuk via dulu.','Choose a net for the via first.'),'warn');
      state.vias.push({id:`VIA_${Date.now()}`,x:p.x,y:p.y,net:state.activeNet,fromLayer:'F.Cu',toLayer:'B.Cu',diameterMm:state.viaDiameterMm,drillMm:state.viaDrillMm});save();emit();schedule();return;
    }
    if(mode==='zone'||mode==='keepout'){draft.push(p);pointer=p;schedule()}
  }
  function onMove(e){if((mode==='zone'||mode==='keepout')&&draft.length){pointer=clientToWorld(e.clientX,e.clientY);schedule()}}
  function onDbl(e){
    if(!stage()?.contains(e.target)||draft.length<3||!['zone','keepout'].includes(mode))return;
    e.preventDefault();e.stopPropagation();
    if(mode==='zone'){
      if(!state.activeNet)return notify(t('Zone butuh net. Pilih net dulu.','Zone needs a net. Choose one first.'),'warn');
      state.zones.push({id:`ZONE_${Date.now()}`,net:state.activeNet,layer:state.activeLayer,clearanceMm:state.zoneClearanceMm,points:[...draft]});
    } else state.keepouts.push({id:`KO_${Date.now()}`,layer:state.activeLayer,points:[...draft],reason:'manual'});
    draft=[];pointer=null;save();emit();schedule();
  }
  function onKey(e){if(['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName))return;if(e.key==='Escape'){draft=[];pointer=null;mode='';schedule()} }

  function emit(){
    try{Object.defineProperty(window.PCBProBoardModel,'zones',{configurable:true,get:()=>structuredClone(state.zones)})}catch{}
    window.dispatchEvent(new CustomEvent('pcbpro:advanced-board-changed',{detail:{model:structuredClone(state)}}));
    window.dispatchEvent(new CustomEvent('pcbpro:board-changed',{detail:{model:window.PCBProBoardModel?.model||null,advanced:structuredClone(state)}}));
    window.PCBProBoardWorkflowBridge?.install?.();
  }

  function trackLengthForNet(name){
    const tracks=(board()?.tracks||[]).filter(x=>x.net===name);let total=0;
    for(const tr of tracks){const a=document.querySelector(`.pcb-board-pad[data-pin="${CSS.escape(tr.from)}"]`),b=document.querySelector(`.pcb-board-pad[data-pin="${CSS.escape(tr.to)}"]`);if(!a||!b)continue;const wa=clientToWorld(a.getBoundingClientRect().left+a.offsetWidth/2,a.getBoundingClientRect().top+a.offsetHeight/2),wb=clientToWorld(b.getBoundingClientRect().left+b.offsetWidth/2,b.getBoundingClientRect().top+b.offsetHeight/2);const pts=[wa,...(tr.corners||[]),wb];for(let i=0;i<pts.length-1;i++)total+=Math.hypot(pts[i+1].x-pts[i].x,pts[i+1].y-pts[i].y)}
    return total;
  }

  function advancedDrc(){
    const out=[]; const names=new Set(netNames()); const outline=board()?.outline||[];
    const pro=window.PCBProProfessional?.state;
    for(const v of state.vias){if(!names.has(v.net))out.push(t(`Via ${v.id}: net ${v.net} tidak ada di schematic.`,`Via ${v.id}: net ${v.net} is not in schematic.`));if(outline.length>=3&&!pointInPoly(v,outline))out.push(t(`Via ${v.id}: berada di luar Edge.Cuts.`,`Via ${v.id}: outside Edge.Cuts.`));for(const k of state.keepouts)if(k.points?.length>=3&&pointInPoly(v,k.points))out.push(t(`Via ${v.id}: masuk area keepout.`,`Via ${v.id}: inside keepout.`));if(pro?.viaDiameterMm&&Number(v.diameterMm||state.viaDiameterMm)<Number(pro.viaDiameterMm))out.push(t(`Via ${v.id}: diameter di bawah professional profile.`,`Via ${v.id}: diameter is below the professional profile.`));if(pro?.viaDrillMm&&Number(v.drillMm||state.viaDrillMm)<Number(pro.viaDrillMm))out.push(t(`Via ${v.id}: drill di bawah professional profile.`,`Via ${v.id}: drill is below the professional profile.`))}
    for(const z of state.zones){if(z.points?.length<3)out.push(t(`Zone ${z.id}: polygon belum valid.`,`Zone ${z.id}: invalid polygon.`));if(!names.has(z.net))out.push(t(`Zone ${z.id}: net ${z.net} tidak ada.`,`Zone ${z.id}: net ${z.net} does not exist.`))}
    for(const k of state.keepouts)if(k.points?.length<3)out.push(t(`Keepout ${k.id}: polygon belum valid.`,`Keepout ${k.id}: invalid polygon.`));
    for(const pair of state.diffPairs){if(!names.has(pair.p)||!names.has(pair.n)){out.push(t(`Diff pair ${pair.name}: salah satu net tidak ada.`,`Diff pair ${pair.name}: one net is missing.`));continue}const lp=trackLengthForNet(pair.p),ln=trackLengthForNet(pair.n);if(!lp||!ln)out.push(t(`Diff pair ${pair.name}: kedua jalur belum diroute lengkap.`,`Diff pair ${pair.name}: both members are not fully routed.`));else{const delta=Math.abs(lp-ln);if(delta>pair.maxSkewWorld)out.push(t(`Diff pair ${pair.name}: mismatch panjang ${delta.toFixed(1)} > batas ${pair.maxSkewWorld}.`,`Diff pair ${pair.name}: length mismatch ${delta.toFixed(1)} > limit ${pair.maxSkewWorld}.`))}}
    return out;
  }
  function showDrc(){
    const base=board()?.drc?.()||[]; const adv=advancedDrc(); const findings=[...base,...adv];
    openModal(`<small>ADVANCED BOARD DRC</small><h3 class="${findings.length?'ab-bad':'ab-good'}">${findings.length?`${findings.length} ${t('temuan','findings')}`:t('Lulus pemeriksaan yang tersedia','Pass available checks')}</h3><p>${t('Pemeriksaan ini sudah membaca track, via, zone, keepout, Edge.Cuts, dan pasangan diferensial yang tersimpan. Ini belum menggantikan sign-off DRC manufaktur penuh.','This check reads stored tracks, vias, zones, keepouts, Edge.Cuts and differential-pair rules. It does not replace full manufacturing sign-off DRC.')}</p>${findings.length?`<ul>${findings.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}<div class="ab-actions"><button data-close>${t('Tutup','Close')}</button></div>`);
  }

  function autoPairCandidates(){
    const names=netNames(); const pairs=[]; const used=new Set();
    for(const n of names){if(used.has(n))continue;const mates=[n.replace(/\+$/,'-'),n.replace(/_P$/i,'_N'),n.replace(/P$/i,'N')].filter(x=>x!==n);const mate=mates.find(x=>names.includes(x));if(mate){pairs.push([n,mate]);used.add(n);used.add(mate)}}return pairs;
  }
  function openDiffModal(){
    const names=netNames(); const cand=autoPairCandidates()[0]||[names[0]||'',names[1]||''];
    openModal(`<small>DIFFERENTIAL PAIR RULE</small><h3>${t('Aturan pasangan diferensial','Differential pair rule')}</h3><p>${t('Tutorial menekankan D+/D− harus diroute berpasangan dengan width/gap yang dikontrol. Di versi ini PCB Pro menyimpan rule dan mengaudit keberadaan + mismatch panjang; paired interactive router penuh masih tahap berikutnya.','The tutorial emphasizes routing D+/D− together with controlled width/gap. This version stores the rule and audits presence + length mismatch; a full interactive paired router is still a next step.')}</p><div class="ab-grid"><label>P net<select data-p>${names.map(n=>`<option${n===cand[0]?' selected':''}>${esc(n)}</option>`).join('')}</select></label><label>N net<select data-n>${names.map(n=>`<option${n===cand[1]?' selected':''}>${esc(n)}</option>`).join('')}</select></label><label>${t('Lebar track (mm)','Track width (mm)')}<input data-w type="number" step="0.01" value="0.15"></label><label>${t('Gap (mm)','Gap (mm)')}<input data-g type="number" step="0.01" value="0.15"></label><label>${t('Batas mismatch panjang (unit canvas)','Max length mismatch (canvas units)')}<input data-s type="number" step="1" value="12"></label></div><div class="ab-list">${state.diffPairs.map(x=>`<div class="ab-row"><b>${esc(x.name)}</b> · ${esc(x.p)} / ${esc(x.n)} · ${x.widthMm}mm / gap ${x.gapMm}mm</div>`).join('')||`<div class="ab-row">${t('Belum ada rule.','No rules yet.')}</div>`}</div><div class="ab-actions"><button data-save>${t('Simpan rule','Save rule')}</button><button class="secondary" data-close>${t('Batal','Cancel')}</button></div>`);
    const m=document.querySelector('#pcbpro-advanced-modal');m.querySelector('[data-save]').onclick=()=>{const p=m.querySelector('[data-p]').value,n=m.querySelector('[data-n]').value;if(!p||!n||p===n)return notify(t('Pilih dua net berbeda.','Choose two different nets.'),'warn');state.diffPairs=state.diffPairs.filter(x=>!(x.p===p&&x.n===n));state.diffPairs.push({name:`${p}/${n}`,p,n,widthMm:Number(m.querySelector('[data-w]').value)||.15,gapMm:Number(m.querySelector('[data-g]').value)||.15,maxSkewWorld:Number(m.querySelector('[data-s]').value)||12});save();m.remove();emit();notify(t('Rule differential pair disimpan.','Differential pair rule saved.'))};
  }
  function openStackModal(){
    openModal(`<small>LAYER STACK</small><h3>${t('Stackup board','Board stackup')}</h3><p>${t('Tutorial menggunakan empat layer: top/bottom routing dengan internal ground/power. PCB Pro sekarang menyimpan stackup sebagai constraint proyek; routing internal penuh belum diklaim.','The tutorial uses four layers: top/bottom routing plus internal ground/power. PCB Pro now stores the stackup as a project constraint; full internal-layer routing is not yet claimed.')}</p><div class="ab-grid"><label>${t('Preset','Preset')}<select data-preset><option value="2">2 Layer · F.Cu / B.Cu</option><option value="4" selected>4 Layer · F.Cu / In1.GND / In2.Power / B.Cu</option></select></label><label>Via Ø / drill (mm)<input data-via value="${state.viaDiameterMm}/${state.viaDrillMm}"></label></div><div class="ab-list"><div class="ab-row">${state.stack.map((x,i)=>`${i+1}. ${esc(x)}`).join('<br>')}</div></div><div class="ab-actions"><button data-save>${t('Terapkan','Apply')}</button><button class="secondary" data-close>${t('Batal','Cancel')}</button></div>`);
    const m=document.querySelector('#pcbpro-advanced-modal');m.querySelector('[data-save]').onclick=()=>{state.stack=m.querySelector('[data-preset]').value==='4'?['F.Cu','In1.GND','In2.Power','B.Cu']:['F.Cu','B.Cu'];const [dia,drill]=m.querySelector('[data-via]').value.split('/').map(Number);if(Number.isFinite(dia))state.viaDiameterMm=dia;if(Number.isFinite(drill))state.viaDrillMm=drill;if(!state.stack.includes(state.activeLayer))state.activeLayer='F.Cu';save();m.remove();emit();schedule();notify(t('Stackup diperbarui.','Stackup updated.'))};
  }
  function openModal(inner){document.querySelector('#pcbpro-advanced-modal')?.remove();const m=document.createElement('div');m.id='pcbpro-advanced-modal';m.innerHTML=`<div class="ab-card">${inner}</div>`;document.body.appendChild(m);m.addEventListener('pointerdown',e=>{if(e.target===m)m.remove()});m.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>m.remove()))}

  function wireToolbar(){
    if(!stage())return;
    const tools=[...document.querySelectorAll('.tools button')];
    for(const b of tools){const name=(b.dataset.pcbTool||b.querySelector('small')?.textContent||'').trim().toLowerCase();if(['via','zone','keepout'].includes(name)){b.classList.remove('pcb-tool-unavailable');b.removeAttribute('title');b.addEventListener('click',()=>setMode(name),{once:true})}}
  }
  function mount(){if(!stage()){hud?.remove();hud=null;return}installStyles();ensureOverlay();wireToolbar();schedule();emit()}
  function start(){load();installStyles();document.addEventListener('pointerdown',onCanvasDown,true);document.addEventListener('pointermove',onMove,{passive:true});document.addEventListener('dblclick',onDbl,true);document.addEventListener('keydown',onKey,true);document.addEventListener('click',()=>setTimeout(mount,0),{passive:true});window.addEventListener('resize',schedule,{passive:true});window.addEventListener('pcbpro:netlist-changed',()=>{if(state.activeNet&&!netNames().includes(state.activeNet))state.activeNet=netNames()[0]||'';schedule()});setTimeout(mount,0)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

  window.PCBProAdvancedBoard={version:VERSION,get model(){return structuredClone(state)},get vias(){return structuredClone(state.vias)},get zones(){return structuredClone(state.zones)},get keepouts(){return structuredClone(state.keepouts)},get diffPairs(){return structuredClone(state.diffPairs)},drc:advancedDrc,showDrc,refresh:mount,clear(){state.vias=[];state.zones=[];state.keepouts=[];state.diffPairs=[];save();emit();schedule()}};
})();