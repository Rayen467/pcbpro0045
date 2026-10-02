(() => {
  'use strict';
  if (window.PCBProIntegrity) return;

  const VERSION='1.21.0';
  const LOG_KEY='pcbpro0045-integrity-log-v121';
  let lastReport=null;
  let timer=0;

  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  const t=(id,en)=>lang()==='id'?id:en;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const uniq=a=>[...new Set(a)];

  function components(){return window.PCBProProject?.getComponents?.()||[]}
  function wires(){return window.PCBProWireEngine?.routes||[]}
  function nets(){return window.PCBProWireEngine?.nets||[]}
  function board(){return window.PCBProBoardModel?.model||{tracks:[],outline:[],placements:[],pads:[]}}
  function advanced(){return window.PCBProAdvancedBoard?.model||{vias:[],zones:[],keepouts:[],diffPairs:[]}}
  function pro(){return window.PCBProProfessional?.state||{}}
  function mfg(){return window.PCBProManufacturing?.state||{}}

  function pinRef(id){
    const m=String(id||'').match(/^(.+)\.(\d+)$/);
    return m?{ref:m[1],pin:Number(m[2])}:null;
  }
  function componentMap(){return new Map(components().map(c=>[c.id,c]))}
  function netNames(){return new Set(nets().map(n=>n.name).filter(Boolean))}
  function issue(code,severity,message,detail={}){return{code,severity,message,...detail}}

  function validate(){
    const comps=components(),wireList=wires(),netList=nets(),b=board(),a=advanced();
    const issues=[],refs=new Map(),ids=[];
    for(const c of comps){
      ids.push(c.id);
      if(refs.has(c.id))issues.push(issue('DUPLICATE_COMPONENT_REF','error',t('Reference komponen duplikat: '+c.id+'.','Duplicate component reference: '+c.id+'.'),{ref:c.id}));
      refs.set(c.id,c);
      if(!c.id)issues.push(issue('EMPTY_COMPONENT_REF','error',t('Ada komponen tanpa reference.','A component has no reference.')));
      if(Number.isInteger(c.pinCount)&&c.pinCount<1)issues.push(issue('INVALID_PIN_COUNT','error',t(c.id+': pinCount tidak valid. ',c.id+': invalid pinCount.'),{ref:c.id,pinCount:c.pinCount}));
    }

    const wireIds=new Set();
    for(const w of wireList){
      if(wireIds.has(w.id))issues.push(issue('DUPLICATE_WIRE_ID','error',t('Wire ID duplikat: '+w.id+'.','Duplicate wire ID: '+w.id+'.'),{wireId:w.id}));
      wireIds.add(w.id);
      for(const endpoint of [w.from,w.to]){
        const p=pinRef(endpoint);
        if(!p||!refs.has(p.ref)){
          issues.push(issue('ORPHAN_WIRE_ENDPOINT','error',t('Wire '+w.id+' menunjuk pin yang tidak ada: '+endpoint+'.','Wire '+w.id+' points to a missing pin: '+endpoint+'.'),{wireId:w.id,pin:endpoint}));
          continue;
        }
        const comp=refs.get(p.ref);
        if(Number.isInteger(comp.pinCount)&&p.pin>comp.pinCount)issues.push(issue('WIRE_PIN_RANGE','error',t(endpoint+' melebihi pinCount '+comp.pinCount+'.',endpoint+' exceeds pinCount '+comp.pinCount+'.'),{wireId:w.id,pin:endpoint}));
      }
      if(w.from===w.to)issues.push(issue('WIRE_SELF_LOOP','error',t('Wire '+w.id+' self-loop.','Wire '+w.id+' is a self-loop.'),{wireId:w.id}));
    }

    const seenNetPins=new Set();
    for(const net of netList){
      const list=net.pinList||String(net.pins||'').split(/[·,;\s]+/).filter(Boolean);
      for(const endpoint of list){
        const p=pinRef(endpoint);
        if(!p||!refs.has(p.ref))issues.push(issue('ORPHAN_NET_PIN','error',t('Net '+net.name+' berisi pin orphan '+endpoint+'.','Net '+net.name+' contains orphan pin '+endpoint+'.'),{net:net.name,pin:endpoint}));
        const key=net.name+'|'+endpoint;
        if(seenNetPins.has(key))issues.push(issue('DUPLICATE_NET_PIN','warn',t('Pin '+endpoint+' muncul berulang pada net '+net.name+'.','Pin '+endpoint+' appears repeatedly on net '+net.name+'.'),{net:net.name,pin:endpoint}));
        seenNetPins.add(key);
      }
    }

    const trackIds=new Set();
    for(const tr of b.tracks||[]){
      if(trackIds.has(tr.id))issues.push(issue('DUPLICATE_TRACK_ID','error',t('Track ID duplikat: '+tr.id+'.','Duplicate track ID: '+tr.id+'.'),{trackId:tr.id}));
      trackIds.add(tr.id);
      for(const endpoint of [tr.from,tr.to]){
        const p=pinRef(endpoint);
        if(!p||!refs.has(p.ref))issues.push(issue('ORPHAN_TRACK_ENDPOINT','error',t('Track '+tr.id+' menunjuk pad yang tidak ada: '+endpoint+'.','Track '+tr.id+' points to a missing pad: '+endpoint+'.'),{trackId:tr.id,pin:endpoint}));
      }
      const matching=netList.find(n=>{
        const pins=n.pinList||String(n.pins||'').split(/[·,;\s]+/).filter(Boolean);
        return pins.includes(tr.from)&&pins.includes(tr.to);
      });
      if(!matching)issues.push(issue('TRACK_NET_MISMATCH','error',t('Track '+tr.id+' tidak lagi cocok dengan schematic connectivity.','Track '+tr.id+' no longer matches schematic connectivity.'),{trackId:tr.id,from:tr.from,to:tr.to}));
      else if(tr.net&&matching.name!==tr.net)issues.push(issue('TRACK_NET_NAME_MISMATCH','warn',t('Track '+tr.id+' menyimpan net '+tr.net+' tetapi schematic menghasilkan '+matching.name+'.','Track '+tr.id+' stores net '+tr.net+' but schematic derives '+matching.name+'.'),{trackId:tr.id}));
    }

    const placementRefs=new Set();
    for(const p of b.placements||[]){
      placementRefs.add(p.ref);
      if(!refs.has(p.ref))issues.push(issue('ORPHAN_PLACEMENT','warn',t('Placement orphan: '+p.ref+'.','Orphan placement: '+p.ref+'.'),{ref:p.ref}));
    }
    for(const c of comps.filter(x=>x.footprint&&x.footprint!=='—')){
      if((b.placements||[]).length&& !placementRefs.has(c.id))issues.push(issue('MISSING_PLACEMENT','warn',t(c.id+' punya footprint tetapi placement PCB belum tercapture.',c.id+' has a footprint but no PCB placement is captured.'),{ref:c.id}));
    }

    const knownNetNames=netNames();
    for(const v of a.vias||[])if(v.net&&!knownNetNames.has(v.net))issues.push(issue('ORPHAN_VIA_NET','error',t('Via '+v.id+' memakai net yang sudah tidak ada: '+v.net+'.','Via '+v.id+' uses a missing net: '+v.net+'.'),{viaId:v.id,net:v.net}));
    for(const z of a.zones||[])if(z.net&&!knownNetNames.has(z.net))issues.push(issue('ORPHAN_ZONE_NET','error',t('Zone '+z.id+' memakai net yang sudah tidak ada: '+z.net+'.','Zone '+z.id+' uses a missing net: '+z.net+'.'),{zoneId:z.id,net:z.net}));
    for(const pair of a.diffPairs||[]){
      if(!knownNetNames.has(pair.p)||!knownNetNames.has(pair.n))issues.push(issue('ORPHAN_DIFF_PAIR','warn',t('Diff pair '+pair.name+' refer ke net yang hilang.','Diff pair '+pair.name+' references a missing net.'),{pair:pair.name}));
    }

    const report={
      version:VERSION,time:new Date().toISOString(),
      counts:{
        components:comps.length,wires:wireList.length,nets:netList.length,
        tracks:(b.tracks||[]).length,vias:(a.vias||[]).length,zones:(a.zones||[]).length,
        placements:(b.placements||[]).length,pads:(b.pads||[]).length
      },
      issues,
      summary:{
        error:issues.filter(x=>x.severity==='error').length,
        warn:issues.filter(x=>x.severity==='warn').length,
        total:issues.length
      },
      healthy:!issues.some(x=>x.severity==='error'),
      sourceOfTruth:{
        components:'PCBProProject',
        schematicConnectivity:'PCBProWireEngine',
        pcbGeometry:'PCBProBoardModel',
        advancedGeometry:'PCBProAdvancedBoard',
        rules:'PCBProProfessional',
        manufacturing:'PCBProManufacturing'
      }
    };
    lastReport=report;
    remember(report);
    updateBadge();
    window.dispatchEvent(new CustomEvent('pcbpro:integrity-report',{detail:structuredClone(report)}));
    return report;
  }

  function remember(report){
    try{
      const old=JSON.parse(localStorage.getItem(LOG_KEY)||'[]');
      const signature=JSON.stringify({e:report.summary.error,w:report.summary.warn,c:report.counts,codes:uniq(report.issues.map(x=>x.code)).sort()});
      if(old[0]?.signature===signature)return;
      old.unshift({time:report.time,signature,summary:report.summary,counts:report.counts,codes:uniq(report.issues.map(x=>x.code)).sort()});
      localStorage.setItem(LOG_KEY,JSON.stringify(old.slice(0,40)));
    }catch{}
  }

  async function fingerprint(){
    const snapshot={components:components(),wires:wires(),nets:nets(),board:board(),advanced:advanced(),professional:pro(),manufacturing:{widthMm:mfg().widthMm??null,heightMm:mfg().heightMm??null}};
    const bytes=new TextEncoder().encode(JSON.stringify(snapshot));
    const hash=await crypto.subtle.digest('SHA-256',bytes);
    return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
  }

  function repair(){
    const before=validate(),actions=[];
    for(const x of before.issues){
      if(x.code==='ORPHAN_WIRE_ENDPOINT'&&x.wireId){
        const ok=window.PCBProProject?.deleteWire?.(x.wireId);
        if(ok)actions.push('delete wire '+x.wireId);
      }
      if((x.code==='ORPHAN_TRACK_ENDPOINT'||x.code==='TRACK_NET_MISMATCH')&&x.trackId){
        const ok=window.PCBProBoardModel?.deleteTrack?.(x.trackId);
        if(ok)actions.push('delete track '+x.trackId);
      }
    }
    window.PCBProWireEngine?.refresh?.(0);
    window.PCBProBoardModel?.refresh?.();
    const after=validate();
    return {ok:after.summary.error===0,before,after,actions};
  }

  function installStyles(){
    if(document.querySelector('#pcbpro-integrity-style'))return;
    const s=document.createElement('style');s.id='pcbpro-integrity-style';s.textContent=`
      #pcbpro-integrity-trigger{border:1px solid #31505d;background:#0f2029;color:#b8cbd4;border-radius:8px;padding:7px 9px;font:900 8px ui-monospace;white-space:nowrap}
      #pcbpro-integrity-trigger[data-state="ok"]{border-color:#2d7464;color:#6ad8c0;background:#102b25}#pcbpro-integrity-trigger[data-state="warn"]{border-color:#755e31;color:#dfc06e;background:#2a2212}#pcbpro-integrity-trigger[data-state="bad"]{border-color:#7d443b;color:#ef9b88;background:#2b1613}
      #pcbpro-integrity-modal{position:fixed;z-index:2700;inset:0;background:#000c;display:grid;place-items:center;padding:16px}.pi-card{width:min(900px,96vw);max-height:88vh;overflow:auto;background:#091720;border:1px solid #35505d;border-radius:13px;color:#dce8ed;padding:14px;box-shadow:0 25px 90px #000d}.pi-head{display:flex;align-items:start;gap:8px;border-bottom:1px solid #213943;padding-bottom:10px}.pi-head div{flex:1}.pi-head small{font:800 8px ui-monospace;color:#63d3bb}.pi-head h3{margin:4px 0}.pi-head button,.pi-actions button{border:1px solid #35505d;background:#10222b;color:#dce8ed;border-radius:7px;padding:7px 10px;font-size:8px;font-weight:800}.pi-actions{display:flex;gap:7px;margin:10px 0;flex-wrap:wrap}.pi-summary{display:flex;gap:6px;flex-wrap:wrap}.pi-summary span{border:1px solid #2d4652;border-radius:999px;padding:5px 8px;font:800 7px ui-monospace}.pi-issue{border:1px solid #263f4a;border-left-width:3px;border-radius:8px;padding:8px;margin:6px 0;background:#0b1a22}.pi-issue.error{border-left-color:#df7765}.pi-issue.warn{border-left-color:#d8ad55}.pi-issue b{font-size:8px}.pi-issue p{margin:4px 0 0;color:#91a7b1;font-size:8px;line-height:1.45}.pi-empty{border:1px solid #2d6758;background:#0f2923;color:#72dac2;border-radius:8px;padding:10px;font-size:9px}
    `;document.head.appendChild(s)
  }

  function updateBadge(){
    const b=document.querySelector('#pcbpro-integrity-trigger');if(!b)return;
    const r=lastReport;
    if(!r){b.textContent='INTEGRITY';b.dataset.state='warn';return}
    const state=r.summary.error?'bad':r.summary.warn?'warn':'ok';
    b.dataset.state=state;
    b.textContent='INTEGRITY '+(state==='ok'?'✓':state==='warn'?'!':'✕');
    b.title=r.summary.error+' error · '+r.summary.warn+' warn';
  }

  function mountTrigger(){
    installStyles();
    const actions=document.querySelector('.top-actions');if(!actions||document.querySelector('#pcbpro-integrity-trigger'))return;
    const b=document.createElement('button');b.id='pcbpro-integrity-trigger';b.type='button';b.textContent='INTEGRITY';b.onclick=show;
    const health=document.querySelector('#pcbpro-health-trigger');if(health)actions.insertBefore(b,health);else actions.appendChild(b);
    updateBadge();
  }

  function show(){
    const r=validate();document.querySelector('#pcbpro-integrity-modal')?.remove();
    const m=document.createElement('div');m.id='pcbpro-integrity-modal';
    const rows=r.issues.map(x=>'<article class="pi-issue '+x.severity+'"><b>'+esc(x.code)+' · '+esc(x.severity.toUpperCase())+'</b><p>'+esc(x.message)+'</p></article>').join('');
    m.innerHTML='<section class="pi-card"><header class="pi-head"><div><small>PCB PRO · DOMAIN INTEGRITY v'+VERSION+'</small><h3>'+t('Project Source-of-Truth Audit','Project Source-of-Truth Audit')+'</h3></div><button data-close>×</button></header><div class="pi-actions"><button data-run>'+t('Scan ulang','Run scan')+'</button><button data-repair>'+t('Repair stale wire/track','Repair stale wire/track')+'</button><button data-hash>'+t('Fingerprint project','Fingerprint project')+'</button></div><div class="pi-summary"><span>'+r.counts.components+' components</span><span>'+r.counts.nets+' nets</span><span>'+r.counts.tracks+' tracks</span><span>'+r.summary.error+' error</span><span>'+r.summary.warn+' warn</span></div>'+(rows||'<div class="pi-empty">'+t('Tidak ada konflik cross-engine yang terdeteksi.','No cross-engine conflicts detected.')+'</div>')+'<div data-result></div></section>';
    document.body.appendChild(m);
    m.querySelector('[data-close]').onclick=()=>m.remove();
    m.querySelector('[data-run]').onclick=()=>{m.remove();show()};
    m.querySelector('[data-repair]').onclick=()=>{const out=repair();m.querySelector('[data-result]').textContent=t('Repair: ','Repair: ')+out.actions.join(', ')+(out.actions.length?'':'no safe stale objects found');setTimeout(()=>{m.remove();show()},250)};
    m.querySelector('[data-hash]').onclick=async()=>{m.querySelector('[data-result]').textContent='SHA-256 '+await fingerprint()};
    m.onclick=e=>{if(e.target===m)m.remove()};
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(()=>{try{validate()}catch{}},180)}
  function start(){
    installStyles();mountTrigger();setTimeout(schedule,900);
    for(const ev of ['pcbpro:netlist-changed','pcbpro:board-changed','pcbpro:advanced-board-changed','pcbpro:project-components-changed','pcbpro:professional-rules-changed','pcbpro:manufacturing-calibration-changed'])window.addEventListener(ev,schedule);
    document.addEventListener('click',()=>setTimeout(mountTrigger,0),{passive:true});
  }

  window.PCBProIntegrity={version:VERSION,validate,repair,fingerprint,show,get lastReport(){return lastReport?structuredClone(lastReport):null},history(){try{return JSON.parse(localStorage.getItem(LOG_KEY)||'[]')}catch{return[]}}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();