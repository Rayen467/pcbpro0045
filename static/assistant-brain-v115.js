(() => {
  'use strict';
  if (window.PCBProAssistantBrain) return;

  const VERSION='1.15.0';
  const MEMORY_KEY='pcbpro0045-assistant-memory-v115';
  const HISTORY_KEY='pcbpro0045-assistant-history-v115';
  const MAX_HISTORY=12;
  const MAX_LIBRARY_CHUNKS=6;
  let chunks=[];
  let libraryReady=false;
  let libraryPromise=null;
  let lastMeta={route:'boot',tier:'local',libraryHits:0};

  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  const t=(id,en)=>lang()==='id'?id:en;
  const clean=(v)=>String(v??'').trim().replace(/\s+/g,' ');
  const safeJson=(raw,fallback)=>{try{return JSON.parse(raw)}catch{return fallback}};
  const getMemory=()=>safeJson(localStorage.getItem(MEMORY_KEY)||'{}',{});
  const setMemory=(v)=>{try{localStorage.setItem(MEMORY_KEY,JSON.stringify(v))}catch{}};
  const getHistory=()=>safeJson(localStorage.getItem(HISTORY_KEY)||'[]',[]).slice(-MAX_HISTORY);
  const setHistory=(v)=>{try{localStorage.setItem(HISTORY_KEY,JSON.stringify(v.slice(-MAX_HISTORY)))}catch{}};
  const normalize=(s)=>clean(s).toLowerCase().replace(/[^a-z0-9µΩ]+/gi,' ');
  const tokens=(s)=>[...new Set(normalize(s).split(/\s+/).filter(x=>x.length>2&&!['yang','dan','untuk','dari','ini','itu','gue','gua','lu','bro','the','and','for','with','what','apa','bisa','gimana','bagaimana'].includes(x)))];
  const hash=(s)=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0).toString(36)};

  function activeView(){
    const active=document.querySelector('.tabs button.active,[role="tab"][aria-selected="true"]');
    if(active)return clean(active.dataset?.pcbView||active.textContent);
    for(const name of ['Schematic','PCB','Simulator','3D','BOM','Fabrication','Rules','Release']){
      const panel=[...document.querySelectorAll('.panel-title span,h2,h3')].find(x=>new RegExp(name,'i').test(x.textContent||''));if(panel)return name
    }
    return 'Workspace';
  }

  function domComponents(){
    const nodes=[...document.querySelectorAll('.stage.schematic .node,.node')];
    if(nodes.length)return nodes.map(n=>({
      id:clean(n.querySelector('.ref')?.textContent),
      name:clean(n.querySelector('small')?.textContent),
      value:clean(n.querySelector('b')?.textContent),
      symbol:clean(n.querySelector('.symbol')?.textContent),
      selected:n.classList.contains('selected')
    })).filter(x=>x.id);
    const stored=safeJson(localStorage.getItem('pcbpro0045-project-v11')||'null',null);
    return Array.isArray(stored?.components)?stored.components.map(c=>({id:c.id||c.ref||'',name:c.name||'',value:c.value||'',symbol:c.symbol||'',selected:false})).filter(x=>x.id):[];
  }

  function netSnapshot(){
    const w=window.PCBProWireEngine;
    if(Array.isArray(w?.nets))return w.nets.map(n=>({name:n.name,pins:n.pins||n.members||[]}));
    return [...document.querySelectorAll('.inspector .net')].map(b=>({name:clean(b.querySelector('b')?.textContent),pins:clean(b.querySelector('small')?.textContent)})).filter(x=>x.name);
  }

  function compactBoard(){
    const b=window.PCBProBoardModel?.model||window.PCBProProject?.board||null;
    if(!b)return null;
    return {
      tracks:Array.isArray(b.tracks)?b.tracks.length:0,
      vias:Array.isArray(b.vias)?b.vias.length:0,
      zones:Array.isArray(b.zones)?b.zones.length:0,
      outline:Array.isArray(b.outline)?b.outline.length:Array.isArray(b.boardOutline)?b.boardOutline.length:0,
      footprints:Array.isArray(b.footprints)?b.footprints.length:0,
      layer:b.activeLayer||b.layer||null
    };
  }

  function simulationSnapshot(){
    const live=window.PCBProLiveSimulation;
    const r=live?.lastResult;
    if(!r)return null;
    const nodes=r.result?.nodeVoltages||r.nodeVoltages||{};
    const devices=r.result?.devices||r.devices||[];
    return {running:Boolean(live?.running),fault:r.fault||'none',warnings:(r.warnings||[]).slice(0,8),nodeVoltages:Object.fromEntries(Object.entries(nodes).slice(0,16)),devices:Array.isArray(devices)?devices.slice(0,12):devices};
  }

  function projectSnapshot(){
    const components=domComponents();
    const selected=components.find(c=>c.selected)||null;
    const workflow=window.PCBProWorkflow?.snapshot?.()||null;
    const nets=netSnapshot();
    const routes=window.PCBProWireEngine?.routes||[];
    const board=compactBoard();
    const explanation=window.PCBProExplain?.snapshot?.()||null;
    return {
      view:activeView(),selected,
      counts:{components:components.length,nets:nets.length,wires:Array.isArray(routes)?routes.length:0,tracks:board?.tracks||0,vias:board?.vias||0,zones:board?.zones||0},
      components:components.slice(0,40),nets:nets.slice(0,40),board,workflow,simulation:simulationSnapshot(),explanation
    };
  }

  function projectFingerprint(s){return hash(JSON.stringify({view:s.view,selected:s.selected?.id,counts:s.counts,next:s.workflow?.next,done:s.workflow?.done,sim:Boolean(s.simulation)}))}

  function addChunk(source,id,title,text,meta={}){
    const body=clean(text);if(!body)return;
    chunks.push({source,id,title:clean(title)||id,text:body,meta,hay:normalize(`${title} ${body} ${id} ${source}`)});
  }

  async function fetchJson(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`${url} HTTP ${r.status}`);return r.json()}

  function flattenLearning(data,source){
    for(const b of data?.branches||[]){
      addChunk(source,b.id,b.title,`${b.summary||''}` ,{type:'branch'});
      for(const x of b.topics||[]) addChunk(source,x.id,x.title,[x.summary,x.intuition,(x.concepts||[]).join(', '),(x.formulas||[]).join(' · '),(x.design||[]).join(' '),(x.limitations||[]).join(' '),(x.practice||[]).join(' ')].filter(Boolean).join(' | '),{type:'topic',branch:b.title});
    }
  }
  function flattenExplanations(data){for(const x of data?.entries||[])addChunk('explanations',x.id,x.title?.id||x.title?.en,[x.what?.id,x.why?.id,x.input?.id,x.process?.id,x.output?.id,x.how_to_read?.id,x.limits?.id,x.next?.id].filter(Boolean).join(' | '),{type:'feature'});}
  function flattenParts(data){for(const p of data?.parts||[])addChunk('component-catalog',p.mpn,p.mpn,`${p.manufacturer||''} ${p.status||''} ${(p.package||[]).join?.(' ')||p.package||''} ${Object.entries(p.ratings||{}).map(([k,v])=>`${k}=${v}`).join(' ')} ${(p.notes||[]).join?.(' ')||''}`,{type:'exact-part',manufacturer:p.manufacturer,status:p.status});}
  function flattenExtendedCatalog(list){
    for(const p of Array.isArray(list)?list:[]){
      addChunk('extended-component-catalog',p.key||p.mpn||p.name,p.name,
        [p.value,p.group,p.mpn,p.manufacturer,(p.tags||[]).join(' '),p.description,p.footprint&&p.footprint!=='—'?p.footprint:''].filter(Boolean).join(' | '),
        {type:p.kind||'template',group:p.group,pins:p.pinCount||0,mpn:p.mpn||'',provenance:p.provenance||'catalog-template'});
    }
  }
  function flattenPatches(data){for(const p of Array.isArray(data)?data:[]){const ch=p.changes?.id||p.changes?.en||[];addChunk('patch-history',`patch-${p.version}`,p.title?.id||p.title?.en||`v${p.version}`,`${p.date||''} ${ch.join(' ')}`,{type:'patch',version:p.version});}}

  async function buildLibrary(){
    if(libraryPromise)return libraryPromise;
    libraryPromise=(async()=>{
      chunks=[];
      const jobs=await Promise.allSettled([
        fetchJson('/learning-curriculum.json'),fetchJson('/learning-expansion-v112.json'),fetchJson('/explanation-registry-v113.json'),fetchJson('/component-db.json'),fetchJson('/patches.json')
      ]);
      if(jobs[0].status==='fulfilled')flattenLearning(jobs[0].value,'learning-atlas');
      if(jobs[1].status==='fulfilled')flattenLearning(jobs[1].value,'deep-learning');
      if(jobs[2].status==='fulfilled')flattenExplanations(jobs[2].value);
      if(jobs[3].status==='fulfilled')flattenParts(jobs[3].value);
      if(jobs[4].status==='fulfilled')flattenPatches(jobs[4].value);
      if(window.PCBProComponentCatalog?.build)flattenExtendedCatalog(window.PCBProComponentCatalog.build());
      if(window.PCBProProfessional?.ragChunks){
        for(const x of window.PCBProProfessional.ragChunks()) addChunk(x.source,x.id,x.title,x.text,{type:'professional-evidence'});
      }
      libraryReady=true;return chunks;
    })();
    return libraryPromise;
  }

  function retrieve(query,snapshot,limit=MAX_LIBRARY_CHUNKS){
    const q=normalize(query);const ts=tokens(query);const selected=snapshot?.selected?.id?.toLowerCase();
    const scored=[];
    for(const c of chunks){let score=0;if(c.hay.includes(q)&&q.length>4)score+=14;for(const tok of ts){if(c.hay.includes(tok))score+=tok.length>6?4:2;if(c.title.toLowerCase().includes(tok))score+=3}if(selected&&c.hay.includes(selected))score+=3;if(c.meta?.type==='exact-part'&&ts.some(x=>c.id.toLowerCase().includes(x)))score+=18;if(score>0)scored.push({...c,score})}
    return scored.sort((a,b)=>b.score-a.score).slice(0,limit).map(({hay,...x})=>x);
  }

  function workflowLocal(snapshot){
    const w=snapshot.workflow;if(!w)return null;
    const next=(w.stages||[]).find(s=>s.id===w.next)||null;
    const label=next?.label?.[lang()]||next?.label?.id||next?.id||w.next||'—';
    const detail=next?.detail?.[lang()]||next?.detail?.id||'';
    return t(`Project sekarang di ${snapshot.view}. Workflow ${w.done??'?'} / ${w.total??'?'} tahap. Langkah berikutnya: ${label}.${detail?` ${detail}`:''}`,`Project is currently in ${snapshot.view}. Workflow ${w.done??'?'} / ${w.total??'?'} stages. Next: ${label}.${detail?` ${detail}`:''}`)
  }

  function stateLocal(query,snapshot){
    const q=normalize(query);
    if(/(lagi ngapain|sedang ngapain|project sekarang|state sekarang|posisi sekarang|yang gue kerjain|yang gua kerjain)/i.test(q)){
      const base=workflowLocal(snapshot)||t(`Lu lagi ada di ${snapshot.view}.`,`You are in ${snapshot.view}.`);
      const sel=snapshot.selected?` ${t('Yang kepilih','Selected')}: ${snapshot.selected.id} (${snapshot.selected.value||snapshot.selected.name||'—'}).`:'';
      return `${base}${sel} ${t('State','State')}: ${snapshot.counts.components} parts · ${snapshot.counts.nets} nets · ${snapshot.counts.wires} wires · ${snapshot.counts.tracks} tracks.`;
    }
    if(/(langkah selanjutnya|next step|habis ini|lanjut apa|setelah ini|apa berikutnya)/i.test(q))return workflowLocal(snapshot);
    if(/(berapa komponen|berapa net|berapa wire|berapa track)/i.test(q))return `${snapshot.counts.components} parts · ${snapshot.counts.nets} nets · ${snapshot.counts.wires} wires · ${snapshot.counts.tracks} tracks.`;
    return null;
  }

  function clickTab(name){
    const aliases={schematic:['schematic','skematik'],pcb:['pcb'],simulator:['simulator','simulasi'],bom:['bom'],fabrication:['fabrication','fabrikasi'],rules:['rules','aturan'],'3d':['3d']};
    const wanted=aliases[name]||[name];const tab=[...document.querySelectorAll('.tabs button,[role="tab"]')].find(b=>wanted.some(a=>normalize(b.dataset?.pcbView||b.textContent)===a));if(!tab)return false;tab.click();return true;
  }
  function clickTool(pattern){const btn=[...document.querySelectorAll('button')].find(b=>pattern.test(clean(b.textContent)));if(!btn)return false;btn.click();return true}

  async function setValue(ref,value){
    const api=window.PCBProProject;
    if(typeof api?.command==='function'){
      try{const r=await api.command({type:'component.setValue',ref:ref.toUpperCase(),value});if(r!==false)return true}catch{}
    }
    if(!clickTab('schematic')){}
    await new Promise(r=>setTimeout(r,30));
    const node=[...document.querySelectorAll('.node')].find(n=>clean(n.querySelector('.ref')?.textContent).toLowerCase()===ref.toLowerCase());
    if(!node)return false;node.click();await new Promise(r=>setTimeout(r,30));
    const labels=[...document.querySelectorAll('.inspector label')];const lab=labels.find(l=>/value/i.test(l.querySelector('span')?.textContent||''));const input=lab?.querySelector('input');if(!input)return false;
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return true;
  }

  async function localAction(query){
    const q=clean(query);const lower=q.toLowerCase();const bus=window.PCBProCommandBus;
    if(!bus)return {handled:false};

    const set=q.match(/(?:ubah|set|ganti)\s+([a-z]+\d+)\s+(?:jadi|ke|=)?\s*([^,;]+)/i);
    if(set){
      const r=await bus.execute('component.setValue',{ref:set[1].toUpperCase(),value:clean(set[2])});
      return {handled:true,text:r.ok?t(`${set[1].toUpperCase()} sudah diubah ke ${clean(set[2])}. Command terverifikasi lewat typed bus dan project state dibaca ulang.`,`${set[1].toUpperCase()} was changed to ${clean(set[2])}. The command ran through the typed bus and project state was re-read.`):t(`Perubahan ${set[1].toUpperCase()} gagal: ${r.error||'command rejected'}.`,`Change to ${set[1].toUpperCase()} failed: ${r.error||'command rejected'}.`),action:'component.setValue',ok:r.ok,result:r};
    }

    const open=q.match(/(?:buka|pindah|lihat)\s+(skematik|schematic|pcb|simulator|simulasi|bom|fabrikasi|fabrication|aturan|rules|3d)/i);
    if(open){
      const map={skematik:'schematic',schematic:'schematic',simulasi:'simulator',simulator:'simulator',fabrikasi:'fabrication',fabrication:'fabrication',aturan:'rules',rules:'rules',pcb:'pcb',bom:'bom','3d':'3d'};const dest=map[open[1].toLowerCase()];
      const r=await bus.execute('navigate.view',{view:dest});
      return {handled:true,text:r.ok?t(`${open[1]} gue buka. Context assistant ikut pindah ke workspace itu.`,`${open[1]} opened. Assistant context follows that workspace.`):t(`Tab ${open[1]} tidak ditemukan.`,`Tab ${open[1]} was not found.`),action:'navigate.view',ok:r.ok,result:r};
    }

    if(/(aktifkan|pilih|pakai|mode)\s+(wire|kabel)/i.test(lower)){
      const r=await bus.execute('schematic.activateWire',{});
      return {handled:true,text:r.ok?t('Wire mode aktif lewat typed command. Klik pin awal, buat corner bila perlu, lalu klik pin tujuan.','Wire mode is active through a typed command. Click the source pin, add corners if needed, then click the destination pin.'):t(`Wire mode gagal: ${r.error||'tool unavailable'}.`,`Wire mode failed: ${r.error||'tool unavailable'}.`),action:'schematic.activateWire',ok:r.ok,result:r};
    }

    if(/(jalankan|run|mulai)\s+(simulasi|simulator|live circuit)/i.test(lower)){
      const r=await bus.execute('simulation.run',{});
      return {handled:true,text:r.ok?t('Live Circuit dijalankan melalui typed command dari netlist/model yang tersedia. Hasil tetap simulation result, bukan measurement.','Live Circuit started through a typed command from the available netlist/models. Results remain simulation results, not measurements.'):t(`Simulator gagal dijalankan: ${r.error||'unavailable'}.`,`Simulator could not start: ${r.error||'unavailable'}.`),action:'simulation.run',ok:r.ok,result:r};
    }

    if(/^(?:jalankan|run)\s+erc$/i.test(lower)){
      const r=await bus.execute('workflow.runERC',{});
      const n=Array.isArray(r.result?.findings)?r.result.findings.length:Array.isArray(r.findings)?r.findings.length:0;
      return {handled:true,text:r.ok?t(`ERC selesai lewat typed command: ${n} finding pada coverage ERC yang tersedia.`,`ERC completed through a typed command: ${n} finding(s) within the available ERC coverage.`):t(`ERC gagal: ${r.error||'unavailable'}.`,`ERC failed: ${r.error||'unavailable'}.`),action:'workflow.runERC',ok:r.ok,result:r};
    }

    if(/^(?:jalankan|run)\s+drc$/i.test(lower)){
      const r=await bus.execute('pcb.runDRC',{});
      const n=Array.isArray(r.result?.findings)?r.result.findings.length:Array.isArray(r.findings)?r.findings.length:0;
      return {handled:true,text:r.ok?t(`DRC selesai lewat typed command: ${n} finding pada rule coverage yang tersedia.`,`DRC completed through a typed command: ${n} finding(s) within the available rule coverage.`):t(`DRC gagal: ${r.error||'unavailable'}.`,`DRC failed: ${r.error||'unavailable'}.`),action:'pcb.runDRC',ok:r.ok,result:r};
    }

    return {handled:false};
  }

  function isActionIntent(q){
    return /\b(sambung|hubungkan|connect|putuskan|disconnect|hapus wire|clear wire|ubah|ganti|set|jalankan|run|reset|pause|buka|pindah|aktifkan|apply|terapkan|perbaiki|fix)\b/i.test(q);
  }

  function isKnowledgeQuery(q){return /(jelas|explain|kenapa|mengapa|apa itu|fungsi|cara kerja|bedanya|rumus|teori|belajar|datasheet|rating|komponen|resistor|capacitor|kapasitor|inductor|diode|led|transistor|mosfet|op.?amp|kcl|kvl|ohm|thevenin|norton|signal|noise|voltage|current|tegangan|arus|pcb|routing|footprint|erc|drc)/i.test(q)}
  function chooseTier(query,hits,snapshot){
    const q=query.toLowerCase();
    if(/(analisa|analisis|diagnos|troubleshoot|kenapa.*(gagal|error|rusak|panas)|bandingkan|trade.?off|desain terbaik|hitung.*dan.*jelas|optimasi|review keseluruhan)/i.test(q))return'reason';
    if(snapshot.counts.components>20&&/(project|desain|circuit|rangkaian)/i.test(q))return'reason';
    if(hits.length&&query.length<220)return'fast';
    return'standard';
  }

  function compactContext(snapshot){
    const selected=snapshot.selected;
    const relevantRefs=new Set([selected?.id].filter(Boolean));
    const selectedNets=snapshot.nets.filter(n=>{
      const p=Array.isArray(n.pins)?n.pins.join(' '):String(n.pins||'');return [...relevantRefs].some(r=>p.includes(`${r}.`))
    });
    return {
      view:snapshot.view,selected,counts:snapshot.counts,
      workflow:snapshot.workflow?{done:snapshot.workflow.done,total:snapshot.workflow.total,next:snapshot.workflow.next,stages:(snapshot.workflow.stages||[]).filter(s=>['blocked','partial','ready'].includes(s.status)).slice(0,6)}:null,
      selectedNets:selectedNets.slice(0,8),
      board:snapshot.board,
      simulation:snapshot.simulation,
      components:snapshot.components.length<=14?snapshot.components:snapshot.components.slice(0,14)
    };
  }

  function updateMemory(query,response,snapshot,meta){
    const old=getMemory();const q=normalize(query);let goal=old.goal||'';
    if(/(mau|pengen|ingin|target|tujuan|lagi bikin|sedang bikin)/i.test(query))goal=clean(query).slice(0,320);
    const unresolved=/belum|blocked|unsupported|error|gagal|kurang/i.test(response)?clean(response).slice(0,360):'';
    setMemory({goal,focus:snapshot.selected?.id||snapshot.view,lastQuery:clean(query).slice(0,320),lastRoute:meta.route,lastTier:meta.tier,lastProjectFingerprint:projectFingerprint(snapshot),unresolved:unresolved||old.unresolved||'',updatedAt:new Date().toISOString()});
    const h=getHistory();h.push({role:'user',content:clean(query).slice(0,1200)});h.push({role:'assistant',content:clean(response).slice(0,1600),hash:hash(normalize(response))});setHistory(h);
  }

  function recentWithoutRepeating(){return getHistory().slice(-8).map(x=>({role:x.role,content:x.content}))}
  function memoryForModel(snapshot){const m=getMemory();return {goal:m.goal||null,focus:snapshot.selected?.id||m.focus||snapshot.view,unresolved:m.unresolved||null,lastRoute:m.lastRoute||null,projectChanged:m.lastProjectFingerprint?m.lastProjectFingerprint!==projectFingerprint(snapshot):true}}

  async function callModel(query,snapshot,hits,tier){
    const body={
      query,mode:tier,
      history:recentWithoutRepeating(),
      memory:memoryForModel(snapshot),
      context:compactContext(snapshot),
      retrieval:hits.map(h=>({source:h.source,id:h.id,title:h.title,text:h.text.slice(0,1700),meta:h.meta,score:h.score}))
    };
    const r=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json().catch(()=>({}));if(!r.ok||!data?.text)throw new Error(data?.error||`AI HTTP ${r.status}`);return {text:clean(data.text),model:data.model||'AI Gateway',usage:data.usage||null,tier:data.tier||tier};
  }

  async function ask(raw){
    const query=clean(raw);if(!query)return {text:'',meta:{route:'empty',tier:'local'}};
    await buildLibrary();let snapshot=projectSnapshot();

    const action=await localAction(query);
    if(action.handled){
      snapshot=projectSnapshot();
      const meta={route:'typed-tool',tier:'local',tool:action.action,ok:action.ok,libraryHits:0};
      lastMeta=meta;updateMemory(query,action.text,snapshot,meta);
      window.PCBProExplain?.registerChange?.({feature:'assistant',title:`Typed command: ${action.action}`,why:'User command executed through PCBProCommandBus.',detail:action.text});
      return {text:action.text,meta};
    }

    let hits=null;
    if(isActionIntent(query)&&window.PCBProCommandBus?.planFromAI){
      hits=retrieve(query,snapshot);
      try{
        const planned=await window.PCBProCommandBus.planFromAI(query,compactContext(snapshot),hits);
        const plan=planned?.plan;
        if(plan?.needs_clarification){
          const text=t(`Gue belum akan mengeksekusi apa pun. Planner butuh data ini dulu: ${plan.needs_clarification}`,`I will not execute anything yet. The planner needs this first: ${plan.needs_clarification}`);
          const meta={route:'plan-clarify',tier:'reason',model:planned.model||null,libraryHits:hits.length};
          lastMeta=meta;updateMemory(query,text,snapshot,meta);return {text,meta,plan:null};
        }
        if(plan?.actions?.length){
          const p=window.PCBProCommandBus.preview(plan);
          if(!p.validation.ok){
            const text=t(`AI planner bikin plan yang ditolak validator: ${p.validation.errors.join('; ')}`,`The AI planner produced a plan rejected by validation: ${p.validation.errors.join('; ')}`);
            const meta={route:'plan-rejected',tier:'local',libraryHits:hits.length};
            lastMeta=meta;updateMemory(query,text,snapshot,meta);return {text,meta};
          }
          const lines=p.actions.map((a,i)=>`${i+1}. ${a.label} [${a.risk}]`).join('\n');
          const text=t(`Gue sudah susun action plan yang valid, tapi BELUM gue jalankan:\n${lines}\n\nTekan “Jalankan plan” kalau preview ini sesuai. Setelah eksekusi gue baca ulang project state dan hasil check yang relevan.`,`I built a valid action plan, but it has NOT been executed:\n${lines}\n\nPress “Run plan” if this preview is correct. After execution I will re-read project state and relevant checks.`);
          const meta={route:'plan-preview',tier:'reason',model:planned.model||null,usage:planned.usage||null,libraryHits:hits.length,actions:p.actions.length};
          lastMeta=meta;updateMemory(query,text,snapshot,meta);return {text,meta,plan};
        }
      }catch(error){
        // Planner failure does not block a normal grounded explanation.
        lastMeta={route:'planner-fallback',tier:'local',error:error.message,libraryHits:hits?.length||0};
      }
    }

    const local=stateLocal(query,snapshot);
    if(local){const meta={route:'project-state',tier:'local',libraryHits:0};lastMeta=meta;updateMemory(query,local,snapshot,meta);return {text:local,meta}}

    if(!hits)hits=retrieve(query,snapshot);
    const tier=chooseTier(query,hits,snapshot);
    try{
      const model=await callModel(query,snapshot,hits,tier);
      const recent=getHistory().filter(x=>x.role==='assistant').slice(-2).map(x=>normalize(x.content));
      let text=model.text;
      if(recent.includes(normalize(text))){
        text=t(`${text}\n\nCatatan: ini masih kesimpulan yang sama karena state project belum berubah. Kalau lu mau, ubah parameter/design atau tanya bagian spesifik supaya analisisnya bergerak.`,`${text}\n\nNote: this is still the same conclusion because the project state has not changed. Change a parameter/design or ask about a specific part to move the analysis forward.`)
      }
      const meta={route:hits.length?'rag+llm':'llm',tier:model.tier,model:model.model,usage:model.usage,libraryHits:hits.length,librarySources:[...new Set(hits.map(h=>h.source))]};lastMeta=meta;updateMemory(query,text,snapshot,meta);return {text,meta,retrieval:hits}
    }catch(error){
      const best=hits[0];let text;
      if(best&&isKnowledgeQuery(query))text=t(`AI model lagi tidak tersedia, tapi library lokal nemu materi relevan: ${best.title}. ${best.text.slice(0,900)}\n\nSumber library: ${best.source}.`,`The AI model is unavailable, but the local library found relevant material: ${best.title}. ${best.text.slice(0,900)}\n\nLibrary source: ${best.source}.`);
      else text=t(`AI model lagi tidak tersedia. Gue tetap bisa baca project lokal, workflow, netlist, library, dan typed tools yang ada. Error provider: ${error.message}`,`The AI model is unavailable. I can still read local project state, workflow, netlist, library, and typed tools. Provider error: ${error.message}`);
      const meta={route:best?'library-fallback':'local-fallback',tier:'local',error:error.message,libraryHits:hits.length};lastMeta=meta;updateMemory(query,text,snapshot,meta);return {text,meta,retrieval:hits}
    }
  }

  async function forceModel(raw,tier='fast'){
    const query=clean(raw);if(!query)return {text:'',meta:{route:'forced-llm',tier:'local',error:'empty query'}};
    await buildLibrary();const snapshot=projectSnapshot();const hits=retrieve(query,snapshot);
    const model=await callModel(query,snapshot,hits,['fast','standard','reason'].includes(tier)?tier:'fast');
    const meta={route:'forced-llm',tier:model.tier,model:model.model,usage:model.usage,libraryHits:hits.length,librarySources:[...new Set(hits.map(h=>h.source))]};
    lastMeta=meta;updateMemory(query,model.text,snapshot,meta);return {text:model.text,meta,retrieval:hits};
  }

  function resetMemory(){try{localStorage.removeItem(MEMORY_KEY);localStorage.removeItem(HISTORY_KEY)}catch{};return true}
  function snapshot(){return {version:VERSION,libraryReady,libraryChunks:chunks.length,memory:getMemory(),history:getHistory(),project:projectSnapshot(),lastMeta}}

  buildLibrary();
  window.addEventListener('pcbpro:catalog-ready',()=>{libraryPromise=null;libraryReady=false;buildLibrary().catch(()=>{})});
  window.addEventListener('pcbpro:professional-evidence-ready',()=>{libraryPromise=null;libraryReady=false;buildLibrary().catch(()=>{})});
  window.PCBProAssistantBrain={version:VERSION,ask,forceModel,retrieve:(q)=>retrieve(q,projectSnapshot()),projectSnapshot,snapshot,resetMemory,rebuildLibrary:()=>{libraryPromise=null;libraryReady=false;return buildLibrary()},get lastMeta(){return lastMeta}};

  window.PCBProExplain?.register?.({
    id:'feature.hybrid-assistant-v114',match:['hybrid assistant','assistant brain','token budget','rag','library'],category:'assistant',status:'active',
    title:{id:'Hybrid AI Engineering Agent',en:'Hybrid AI Engineering Agent'},
    what:{id:'Orchestrator yang menggabungkan project tools, local library/RAG, working memory, dan LLM.',en:'Orchestrator combining project tools, local library/RAG, working memory, and an LLM.'},
    why:{id:'Supaya pertanyaan sederhana tidak selalu membakar token dan pertanyaan kompleks tetap mendapat reasoning model.',en:'So simple questions do not always spend model tokens while complex questions still get model reasoning.'},
    input:{id:'Pertanyaan + project state + retrieval library + working memory.',en:'Question + project state + library retrieval + working memory.'},
    process:{id:'Tool/state lokal didahulukan, library mengambil potongan relevan, lalu LLM dipanggil hanya dengan context yang dibutuhkan.',en:'Local tools/state run first, the library retrieves relevant chunks, then the LLM receives only the context it needs.'},
    output:{id:'Jawaban/action dengan metadata route, model tier, dan jumlah library hits.',en:'Answer/action with route metadata, model tier, and library-hit count.'},
    how_to_read:{id:'LOCAL berarti tanpa LLM; RAG+LLM berarti library + model; REASON berarti model reasoning untuk masalah lebih kompleks.',en:'LOCAL means no LLM; RAG+LLM means library plus model; REASON means model reasoning for more complex problems.'},
    limits:{id:'Working memory berada di browser/project session dan bukan pengganti project source-of-truth atau physical measurement.',en:'Working memory lives in the browser/project session and does not replace project source of truth or physical measurements.'},
    next:{id:'Gunakan pertanyaan natural; assistant memilih jalur termurah yang masih cukup untuk menjawab dengan benar.',en:'Ask naturally; the assistant chooses the cheapest route that is still sufficient for a correct answer.'}
  });
})();
