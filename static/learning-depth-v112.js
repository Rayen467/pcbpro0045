(() => {
  'use strict';
  if (window.PCBProDeepLearning) return;

  const VERSION='1.12.0';
  const DATA_URL='/learning-expansion-v112.json';
  let expansion=null;
  let activeBranch='deep-physics-signals';
  let activeTopic='deep-current-charge';
  let activeTab='topic';
  let merged=false;

  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  const t=(id,en)=>lang()==='id'?id:en;
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  async function loadData(){
    if(expansion) return expansion;
    const r=await fetch(DATA_URL,{cache:'no-store'});
    if(!r.ok) throw new Error(`Deep curriculum HTTP ${r.status}`);
    expansion=await r.json();
    return expansion;
  }

  function mergeCurriculum(){
    const base=window.PCBProLearningCenter?.curriculum;
    if(!base?.branches?.length||!expansion?.branches?.length) return false;
    for(const b of expansion.branches){
      const old=base.branches.find(x=>x.id===b.id);
      if(old){
        const byId=new Map((old.topics||[]).map(x=>[x.id,x]));
        for(const topic of b.topics||[]){
          const target=byId.get(topic.id);
          if(target) Object.assign(target,topic);
          else (old.topics||(old.topics=[])).push(topic);
        }
        old.summary=b.summary||old.summary;
      } else base.branches.push(structuredClone(b));
    }
    base.deepExpansion={version:expansion.version,sourceOutline:expansion.sourceOutline,policy:expansion.policy};
    merged=true;
    window.PCBProLearningCenter?.refresh?.();
    window.dispatchEvent(new CustomEvent('pcbpro:learning-expanded',{detail:{version:VERSION}}));
    return true;
  }

  async function ensureMerged(){
    try{await loadData()}catch(e){console.warn('[PCB Pro Deep Learning]',e);return false}
    for(let i=0;i<30;i++){
      if(mergeCurriculum()) return true;
      await new Promise(r=>setTimeout(r,100));
    }
    return false;
  }

  function installStyles(){
    if(document.querySelector('#pcbpro-deep-learning-style'))return;
    const s=document.createElement('style');s.id='pcbpro-deep-learning-style';s.textContent=`
      #pcbpro-deep-trigger{border:1px solid #3a665c!important;background:#112d27!important;color:#d8fff6!important}
      #pcbpro-deep-trigger:hover{border-color:#67d9c2!important;background:#174237!important}
      #pcbpro-deep-modal{position:fixed;z-index:2520;inset:0;background:#010508df;display:grid;place-items:center;padding:12px;backdrop-filter:blur(8px)}
      .deep-shell{width:min(1510px,98vw);height:min(920px,97vh);display:grid;grid-template-rows:auto 1fr;border:1px solid #36515f;border-radius:16px;background:#071119;color:#dce9ef;overflow:hidden;box-shadow:0 36px 130px #000f}
      .deep-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #20343f;background:#0a1821;min-width:0}.deep-brand{display:grid;gap:2px;min-width:260px}.deep-brand small{font:900 8px ui-monospace;color:#62d9c0;letter-spacing:.08em}.deep-brand b{font-size:14px}.deep-head .tabs{display:flex;gap:5px;flex:1;overflow:auto}.deep-head button{border:1px solid #2d4653;background:#10212b;color:#bfcfd7;border-radius:8px;padding:8px 10px;font-size:9px;font-weight:900;white-space:nowrap}.deep-head button.active{border-color:#57cfb7;background:#153a32;color:#eafffa}.deep-head .close{font-size:17px;line-height:1}
      .deep-body{min-height:0;display:grid;grid-template-columns:260px minmax(0,1fr)}.deep-nav{min-height:0;overflow:auto;padding:9px;border-right:1px solid #20343f;background:#071018}.deep-main{min-height:0;overflow:auto;padding:16px;background:linear-gradient(180deg,#091720,#071018)}
      .deep-nav-title{font:900 8px ui-monospace;color:#6f8b97;margin:4px 5px 8px}.deep-nav button{display:block;width:100%;text-align:left;border:1px solid transparent;background:transparent;color:#9fb4bd;border-radius:9px;padding:10px;margin-bottom:5px}.deep-nav button:hover{background:#10222c;color:#fff}.deep-nav button.active{border-color:#2f7668;background:#12322d;color:#ecfffa}.deep-nav b{display:block;font-size:10px}.deep-nav small{display:block;margin-top:4px;font-size:8px;line-height:1.4;color:#718b96}
      .deep-hero{border-bottom:1px solid #20343f;padding-bottom:13px}.deep-hero small{font:900 8px ui-monospace;color:#5bd7bd}.deep-hero h2{font-size:27px;margin:5px 0 7px;line-height:1.12}.deep-hero p{max-width:980px;margin:0;color:#9eb2bc;font-size:11px;line-height:1.65}.deep-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}.deep-card{border:1px solid #213b48;background:#0b1922;border-radius:11px;padding:12px}.deep-card.wide{grid-column:1/-1}.deep-card h3{font-size:11px;margin:0 0 8px;color:#dfebf0}.deep-card p,.deep-card li{font-size:10px;line-height:1.57;color:#9db1ba}.deep-card ul{margin:0;padding-left:17px}.deep-formula{display:block;border:1px solid #31505d;background:#07131a;color:#ecd47d;border-radius:8px;padding:8px 9px;margin:6px 0;font:800 10px ui-monospace}.deep-note{border-left:3px solid #d1a952;background:#2a221244;padding:8px 10px;border-radius:5px;color:#d7c78f!important}
      .deep-topic-pills{display:flex;gap:6px;flex-wrap:wrap}.deep-topic-pills button{border:1px solid #2c554d;background:#0f2823;color:#bde6dd;border-radius:999px;padding:6px 8px;font-size:8px}.deep-source-map{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.deep-source-item{border:1px solid #223b47;background:#0b1921;border-radius:8px;padding:9px;font-size:9px;color:#9fb1ba}.deep-source-item b{color:#d8e5ea;margin-right:4px}
      .deep-lab{display:grid;gap:12px}.deep-lab-grid{display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));gap:8px}.deep-lab label{display:grid;gap:5px;font-size:8px;color:#8098a3}.deep-lab input{border:1px solid #2c4855;background:#061219;color:#e4eff3;border-radius:8px;padding:9px}.deep-lab button{border:1px solid #2a8c77;background:#176d5c;color:#fff;border-radius:8px;padding:9px 11px;font-weight:900}.deep-result{border:1px solid #2b4b58;background:#061219;border-radius:10px;padding:11px;white-space:pre-wrap;font:800 10px/1.6 ui-monospace;color:#cfe2e9}.deep-table{width:100%;border-collapse:collapse;font-size:9px}.deep-table th,.deep-table td{border-bottom:1px solid #1d3440;padding:7px;text-align:right}.deep-table th:first-child,.deep-table td:first-child{text-align:left}.deep-ok{color:#65d8bd}.deep-warn{color:#e3c46e}.deep-bad{color:#ef9c87}
      .deep-lens{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.deep-stat{border:1px solid #203946;background:#0b1922;border-radius:9px;padding:10px}.deep-stat small{display:block;font:800 7px ui-monospace;color:#6e8995}.deep-stat b{font-size:18px}.deep-recs{display:flex;gap:7px;flex-wrap:wrap}.deep-recs button{border:1px solid #2c6358;background:#103029;color:#c8ece4;border-radius:8px;padding:8px 10px;font-size:9px;font-weight:800}
      @media(max-width:900px){.deep-body{grid-template-columns:210px minmax(0,1fr)}.deep-grid{grid-template-columns:1fr}.deep-card.wide{grid-column:auto}.deep-source-map{grid-template-columns:1fr 1fr}.deep-lab-grid,.deep-lens{grid-template-columns:1fr 1fr}}
      @media(max-width:650px){#pcbpro-deep-modal{padding:0}.deep-shell{width:100vw;height:100dvh;border-radius:0}.deep-head{flex-wrap:wrap}.deep-brand{min-width:0}.deep-body{grid-template-columns:1fr;grid-template-rows:auto 1fr}.deep-nav{display:flex;overflow:auto;border-right:0;border-bottom:1px solid #20343f}.deep-nav button{min-width:190px}.deep-main{padding:11px}.deep-source-map,.deep-lab-grid,.deep-lens{grid-template-columns:1fr}.deep-hero h2{font-size:22px}}
    `;document.head.appendChild(s)
  }

  function topicById(id){for(const b of expansion?.branches||[]){const x=(b.topics||[]).find(y=>y.id===id);if(x)return{branch:b,topic:x}}return null}
  function branchById(id){return (expansion?.branches||[]).find(x=>x.id===id)||expansion?.branches?.[0]}

  function mountLearningButton(){
    const head=document.querySelector('#pcbpro-learning-modal .learn-head');
    if(!head)return;
    let b=head.querySelector('#pcbpro-deep-trigger');
    if(!b){b=document.createElement('button');b.id='pcbpro-deep-trigger';b.type='button';b.addEventListener('click',e=>{e.stopPropagation();openModal()});const close=head.querySelector('.close');head.insertBefore(b,close||null)}
    b.textContent=t('◎ Bedah Dalam','◎ Deep Dive');b.title=t('Materi transcript + lab interaktif + kaitan project','Transcript-grounded topics + interactive labs + project links');
  }

  function openModal(){
    document.querySelector('#pcbpro-deep-modal')?.remove();
    const m=document.createElement('div');m.id='pcbpro-deep-modal';m.innerHTML=`<div class="deep-shell"><header class="deep-head"><div class="deep-brand"><small>SOURCE-GROUNDED ELECTRONICS · v${VERSION}</small><b>${t('Bedah Electronics + Project Lens','Deep Electronics + Project Lens')}</b></div><div class="tabs"><button data-tab="topic">${t('Materi','Topics')}</button><button data-tab="source">${t('Peta Sumber','Source Map')}</button><button data-tab="project">Project Lens</button><button data-tab="signal">Signal Lab</button><button data-tab="rc">RC Lab</button><button data-tab="diode">Diode Lab</button></div><button class="close" title="Close">×</button></header><div class="deep-body"><aside class="deep-nav"></aside><main class="deep-main"></main></div></div>`;document.body.appendChild(m);
    m.querySelector('.close').addEventListener('click',()=>m.remove());m.addEventListener('pointerdown',e=>{if(e.target===m)m.remove()});m.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{activeTab=b.dataset.tab;render()}));
    render();
  }

  function render(){
    const m=document.querySelector('#pcbpro-deep-modal');if(!m)return;
    m.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===activeTab));
    const nav=m.querySelector('.deep-nav'),main=m.querySelector('.deep-main');
    if(activeTab==='topic') renderTopicNav(nav,main);
    else {nav.innerHTML=labNavHtml(); if(activeTab==='source')renderSource(main);if(activeTab==='project')renderProject(main);if(activeTab==='signal')renderSignal(main);if(activeTab==='rc')renderRc(main);if(activeTab==='diode')renderDiode(main)}
  }

  function labNavHtml(){return `<div><div class="deep-nav-title">${t('BEDAH COURSE','COURSE DECONSTRUCTION')}</div><button data-switch="topic"><b>${t('Pohon konsep','Concept tree')}</b><small>${t('Topik mendalam yang sudah digabung ke Learning Atlas.','Deep topics merged into the Learning Atlas.')}</small></button><button data-switch="source"><b>${t('25 segmen sumber','25 source segments')}</b><small>${t('Peta isi transcript yang lu kasih.','Map of the supplied transcript.')}</small></button><button data-switch="project"><b>Project Lens</b><small>${t('Hubungkan ilmu dengan komponen/net/PCB aktif.','Relate theory to the active project.')}</small></button></div>`}

  function bindSwitch(nav){nav.querySelectorAll('[data-switch]').forEach(b=>b.addEventListener('click',()=>{activeTab=b.dataset.switch;render()}))}

  function renderTopicNav(nav,main){
    const branch=branchById(activeBranch);if(!branch)return;
    if(!topicById(activeTopic)||topicById(activeTopic).branch.id!==branch.id)activeTopic=branch.topics?.[0]?.id||'';
    nav.innerHTML=`<div class="deep-nav-title">${t('CABANG MATERI','KNOWLEDGE BRANCHES')}</div>${(expansion.branches||[]).map(b=>`<button data-branch="${esc(b.id)}" class="${b.id===activeBranch?'active':''}"><b>${esc(b.title)}</b><small>${esc(b.summary)}</small></button>`).join('')}<div class="deep-nav-title" style="margin-top:14px">${t('TOPIK','TOPICS')}</div>${(branch.topics||[]).map(x=>`<button data-topic="${esc(x.id)}" class="${x.id===activeTopic?'active':''}"><b>${esc(x.title)}</b><small>${esc(x.summary)}</small></button>`).join('')}`;
    nav.querySelectorAll('[data-branch]').forEach(b=>b.addEventListener('click',()=>{activeBranch=b.dataset.branch;activeTopic=branchById(activeBranch)?.topics?.[0]?.id||'';render()}));nav.querySelectorAll('[data-topic]').forEach(b=>b.addEventListener('click',()=>{activeTopic=b.dataset.topic;render()}));
    const found=topicById(activeTopic);main.innerHTML=found?topicHtml(found.branch,found.topic):'';bindTopicLinks(main);
  }

  function topicHtml(branch,x){
    const list=(a)=>`<ul>${(a||[]).map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`;
    return `<section class="deep-hero"><small>${esc(branch.title)} · ${esc(x.level||'')}</small><h2>${esc(x.title)}</h2><p>${esc(x.summary)}</p></section><div class="deep-grid"><section class="deep-card"><h3>${t('Intuisi','Intuition')}</h3><p>${esc(x.intuition||x.summary)}</p></section><section class="deep-card"><h3>${t('Konsep yang harus nyambung','Connected concepts')}</h3>${list(x.concepts)}</section><section class="deep-card"><h3>${t('Model / rumus','Models / formulas')}</h3>${(x.formulas||[]).map(v=>`<code class="deep-formula">${esc(v)}</code>`).join('')||`<p>${t('Tidak ada satu rumus utama untuk topik ini.','No single governing formula for this topic.')}</p>`}</section><section class="deep-card"><h3>${t('Implikasi desain','Design implications')}</h3>${list(x.design)}</section><section class="deep-card"><h3>${t('Batas model','Model limits')}</h3>${list(x.limitations)}</section><section class="deep-card"><h3>${t('Latihan berpikir','Practice')}</h3>${list(x.practice)}</section><section class="deep-card wide"><h3>${t('Cabang lanjut','Continue branching')}</h3><div class="deep-topic-pills">${(x.next||[]).map(id=>{const y=topicById(id);const base=window.PCBProLearningCenter?.curriculum?.branches?.flatMap(b=>b.topics||[]).find(z=>z.id===id);return `<button data-next="${esc(id)}">${esc(y?.topic?.title||base?.title||id)}</button>`}).join('')}</div><p class="deep-note">${t('Sumber transcript dipakai sebagai kerangka isi. Nilai/label yang terlihat seperti error ASR tidak dipromosikan menjadi konstanta engineering terverifikasi; model nyata tetap harus dicek ke datasheet dan konteks project.','The supplied transcript is used as the content framework. Values/labels that look like ASR errors are not promoted into verified engineering constants; real models still require datasheet and project context.')}</p></section></div>`
  }

  function bindTopicLinks(main){main.querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>{const y=topicById(b.dataset.next);if(y){activeBranch=y.branch.id;activeTopic=y.topic.id;activeTab='topic';render()}else{window.PCBProLearningCenter?.open?.();document.querySelector('#pcbpro-deep-modal')?.remove()}}))}

  function renderSource(main){
    main.innerHTML=`<section class="deep-hero"><small>TRANSCRIPT MAP · 25 SEGMENTS</small><h2>${t('Apa isi course yang lu kasih?','What is inside the supplied course?')}</h2><p>${t('Bukan sekadar daftar judul. Peta ini mempertahankan urutan sumber, lalu materi detailnya gue hubungkan ke cabang physics, signals, networks, capacitors, diodes, dan real PCB design.','This preserves the source order and connects the detailed material into physics, signals, networks, capacitors, diodes, and real PCB design branches.')}</p></section><div class="deep-grid"><section class="deep-card wide"><h3>${t('25 penanda segmen dari sumber','25 segment markers from the source')}</h3><div class="deep-source-map">${(expansion.sourceOutline||[]).map((x,i)=>`<div class="deep-source-item"><b>${String(i+1).padStart(2,'0')}</b>${esc(x)}</div>`).join('')}</div></section><section class="deep-card"><h3>${t('Yang course bangun','What the course builds')}</h3><ul><li>charge → current → voltage/energy</li><li>signal/noise → waveform → digital threshold</li><li>sources/resistors → KCL/KVL/dividers</li><li>superposition → ports → Thévenin abstraction</li><li>capacitor physics → dynamics → RC → decoupling/filter</li><li>diode IV → piecewise models → LED/Zener/rectification/protection</li></ul></section><section class="deep-card"><h3>${t('Cara PCB Pro memakainya','How PCB Pro uses it')}</h3><ul><li>${t('Konsep dipakai untuk tutor dan latihan.','Concepts feed the tutor and practice.')}</li><li>${t('Rumus ideal dipisah dari model lapangan.','Ideal equations are separated from field models.')}</li><li>${t('Project aktif menentukan topik mana yang relevan.','The active project selects relevant learning branches.')}</li><li>${t('Lab edukasi tidak disamarkan sebagai hasil simulator project.','Educational labs are not disguised as project simulation results.')}</li></ul></section></div>`;bindSwitch(document.querySelector('#pcbpro-deep-modal .deep-nav'))
  }

  function projectSnapshot(){
    const p=window.PCBProLearningCenter?.project||{};const components=p.components||[];const text=components.map(c=>`${c.id||''} ${c.name||''} ${c.code||''}`).join(' ').toLowerCase();
    const rec=[];const add=id=>{const y=topicById(id);if(y&&!rec.some(r=>r.topic.id===id))rec.push(y)};
    ['deep-current-charge','deep-voltage-energy'].forEach(add);if(/\br\d|resistor/.test(text))['deep-resistor-real','deep-dividers-loading'].forEach(add);if(/\bc\d|capacitor/.test(text))['deep-cap-dynamics','deep-rc-transient','deep-cap-real','deep-decoupling'].forEach(add);if(/\bd\d|diode|led/.test(text))['deep-diode-iv','deep-diode-piecewise','deep-led'].forEach(add);if(/\bu\d|ic|op.?amp|esp|micro/.test(text))add('deep-decoupling');if((p.board?.tracks||[]).length)add('deep-model-ladder');return{...p,components,rec};
  }

  function renderProject(main){const p=projectSnapshot();main.innerHTML=`<section class="deep-hero"><small>PROJECT-AWARE LEARNING</small><h2>Project Lens</h2><p>${t('Ini membaca topology/project state yang tersedia lalu memilih ilmu yang nyambung. Ini bukan hasil measurement dan bukan klaim bahwa circuit sudah benar.','This reads available project state and selects relevant theory. It is not a measurement and does not claim the circuit is correct.')}</p></section><div class="deep-grid"><section class="deep-card wide"><div class="deep-lens"><div class="deep-stat"><small>COMPONENTS</small><b>${p.components.length}</b></div><div class="deep-stat"><small>NETS</small><b>${(p.nets||[]).length}</b></div><div class="deep-stat"><small>WIRES</small><b>${(p.routes||[]).length}</b></div><div class="deep-stat"><small>PCB TRACKS</small><b>${(p.board?.tracks||[]).length}</b></div></div></section><section class="deep-card wide"><h3>${t('Materi yang relevan ke project ini','Topics relevant to this project')}</h3><div class="deep-recs">${p.rec.map(({branch,topic})=>`<button data-deep-topic="${esc(topic.id)}">${esc(topic.title)}</button>`).join('')||'<span>—</span>'}</div></section><section class="deep-card"><h3>${t('Cara pakai','How to use')}</h3><p>${t('Pilih topik, pahami model idealnya, lalu kembali ke schematic/PCB untuk melihat parameter dan limitation yang benar-benar ada di project.','Pick a topic, understand its ideal model, then return to schematic/PCB to inspect parameters and limitations actually present in the project.')}</p></section><section class="deep-card"><h3>${t('Guardrail','Guardrail')}</h3><p>${t('Kalau exact MPN, tolerance, ESR, Vf, VIH/VIL, thermal, atau parasitic tidak ada, PCB Pro tidak boleh mengarang nilainya.','If exact MPN, tolerance, ESR, Vf, VIH/VIL, thermal, or parasitic data is missing, PCB Pro must not invent it.')}</p></section></div>`;main.querySelectorAll('[data-deep-topic]').forEach(b=>b.addEventListener('click',()=>{const y=topicById(b.dataset.deepTopic);activeBranch=y.branch.id;activeTopic=y.topic.id;activeTab='topic';render()}));bindSwitch(document.querySelector('#pcbpro-deep-modal .deep-nav'))}

  function parseNum(v){const s=String(v||'').trim().replace(/,/g,'.');const m=s.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([pnumkMµu]?)/);if(!m)return NaN;const f={p:1e-12,n:1e-9,u:1e-6,'µ':1e-6,m:1e-3,'':1,k:1e3,M:1e6}[m[2]];return Number(m[1])*f}
  function fmt(n,unit=''){if(!Number.isFinite(n))return'—';const a=Math.abs(n);let f=1,p='';if(a&&a<1e-9){f=1e-12;p='p'}else if(a<1e-6){f=1e-9;p='n'}else if(a<1e-3){f=1e-6;p='µ'}else if(a<1){f=1e-3;p='m'}else if(a>=1e6){f=1e6;p='M'}else if(a>=1e3){f=1e3;p='k'}return`${(n/f).toPrecision(5).replace(/\.?0+$/,'')} ${p}${unit}`}

  function renderSignal(main){main.innerHTML=`<section class="deep-hero"><small>EDUCATIONAL MODEL · NOT PROJECT MEASUREMENT</small><h2>Signal / Logic Lab</h2><p>${t('Hubungkan period-frequency dan digital threshold. Nilai VIH/VIL harus lu masukkan dari device/datasheet yang relevan.','Relate period-frequency and digital thresholds. Enter VIH/VIL from the relevant device/datasheet.')}</p></section><div class="deep-grid"><section class="deep-card wide deep-lab"><div class="deep-lab-grid"><label>Period T<input id="dl-t" value="10 ms"></label><label>V sample<input id="dl-v" value="2.4 V"></label><label>VIL<input id="dl-vil" value="0.8 V"></label><label>VIH<input id="dl-vih" value="2.0 V"></label></div><button id="dl-solve-signal">${t('Hitung / klasifikasi','Calculate / classify')}</button><div class="deep-result" id="dl-signal-result">—</div></section></div>`;main.querySelector('#dl-solve-signal').addEventListener('click',()=>{const T=parseNum(main.querySelector('#dl-t').value),v=parseNum(main.querySelector('#dl-v').value),vil=parseNum(main.querySelector('#dl-vil').value),vih=parseNum(main.querySelector('#dl-vih').value);let state='INVALID';let cls='deep-bad';if(Number.isFinite(v)&&Number.isFinite(vil)&&Number.isFinite(vih)&&vih>vil){if(v<=vil){state='LOGIC 0';cls='deep-ok'}else if(v>=vih){state='LOGIC 1';cls='deep-ok'}else{state='UNDEFINED REGION';cls='deep-warn'}}const f=T>0?1/T:NaN;main.querySelector('#dl-signal-result').innerHTML=`f = ${esc(fmt(f,'Hz'))}\nT = ${esc(fmt(T,'s'))}\nstate = <span class="${cls}">${esc(state)}</span>\n\n${t('Catatan: waveform real tetap analog/continuous dan dapat mengalami ringing/overshoot; threshold hanya menginterpretasikan logic state.','Note: the real waveform remains analog/continuous and may ring/overshoot; thresholds only interpret the logic state.')}`})}

  function renderRc(main){main.innerHTML=`<section class="deep-hero"><small>ANALYTIC FIRST-ORDER LAB · NOT LIVE PROJECT SIM</small><h2>RC Transient Lab</h2><p>${t('Hitung response ideal first-order dari initial voltage V0 menuju final voltage Vf. Lab ini sengaja dipisah dari simulator project supaya tidak pura-pura transient solver sudah lengkap.','Compute an ideal first-order response from V0 to Vf. This lab is intentionally separate from the project simulator so it does not pretend full transient simulation is implemented.')}</p></section><div class="deep-grid"><section class="deep-card wide deep-lab"><div class="deep-lab-grid"><label>R<input id="dl-r" value="1 kΩ"></label><label>C<input id="dl-c" value="10 µF"></label><label>V0<input id="dl-v0" value="0 V"></label><label>Vf / Vs<input id="dl-vf" value="10 V"></label></div><button id="dl-solve-rc">${t('Hitung response','Calculate response')}</button><div class="deep-result" id="dl-rc-result">—</div></section></div>`;main.querySelector('#dl-solve-rc').addEventListener('click',()=>{const R=parseNum(main.querySelector('#dl-r').value),C=parseNum(main.querySelector('#dl-c').value),V0=parseNum(main.querySelector('#dl-v0').value),Vf=parseNum(main.querySelector('#dl-vf').value);if(!(R>0&&C>0&&Number.isFinite(V0)&&Number.isFinite(Vf))){main.querySelector('#dl-rc-result').textContent=t('Input tidak valid.','Invalid input.');return}const tau=R*C;const rows=[0,1,2,3,5].map(k=>{const v=Vf+(V0-Vf)*Math.exp(-k);const i=(Vf-V0)/R*Math.exp(-k);return`${k}τ | t=${fmt(k*tau,'s')} | Vc=${fmt(v,'V')} | I=${fmt(i,'A')}`});main.querySelector('#dl-rc-result').textContent=`τ = ${fmt(tau,'s')}\ninitial = ${fmt(V0,'V')} → final = ${fmt(Vf,'V')}\n\n${rows.join('\n')}\n\n${t('Model: ideal R+C first-order, constant R/C/source, no ESR/ESL/source impedance unless included explicitly.','Model: ideal first-order R+C, constant R/C/source, no ESR/ESL/source impedance unless explicitly included.')}`})}

  function renderDiode(main){main.innerHTML=`<section class="deep-hero"><small>PIECEWISE EDUCATIONAL MODEL</small><h2>Diode Region Lab</h2><p>${t('Latihan assumption/region check. Vf dan reverse breakdown bukan angka universal; masukkan nilai model/datasheet yang ingin lu pelajari.','Practice operating-region checks. Vf and reverse breakdown are not universal values; enter the model/datasheet values you want to study.')}</p></section><div class="deep-grid"><section class="deep-card wide deep-lab"><div class="deep-lab-grid"><label>Vd (A−K)<input id="dl-vd" value="0.8 V"></label><label>Vf threshold model<input id="dl-vth" value="0.7 V"></label><label>|Vbreakdown|<input id="dl-vbr" value="75 V"></label></div><button id="dl-solve-diode">${t('Cek region','Check region')}</button><div class="deep-result" id="dl-diode-result">—</div></section></div>`;main.querySelector('#dl-solve-diode').addEventListener('click',()=>{const vd=parseNum(main.querySelector('#dl-vd').value),vf=parseNum(main.querySelector('#dl-vth').value),vbr=Math.abs(parseNum(main.querySelector('#dl-vbr').value));let r='INVALID',eq='—',cls='deep-bad';if(Number.isFinite(vd)&&vf>=0&&vbr>0){if(vd>=vf){r='ON / FORWARD';eq=`${t('piecewise: drop ≈','piecewise: drop ≈')} ${fmt(vf,'V')}`;cls='deep-ok'}else if(vd<=-vbr){r='BREAKDOWN';eq=`${t('reverse clamp model ≈','reverse clamp model ≈')} −${fmt(vbr,'V')}`;cls='deep-warn'}else{r='OFF';eq=t('piecewise: open circuit, I≈0','piecewise: open circuit, I≈0');cls='deep-ok'}}main.querySelector('#dl-diode-result').innerHTML=`region = <span class="${cls}">${esc(r)}</span>\n${esc(eq)}\n\n${t('Untuk circuit nyata, operating point harus diselesaikan bersama external network. Fixed-threshold model tidak memberi current forward secara unik tanpa network/current limiting.','For a real circuit, the operating point must be solved together with the external network. A fixed-threshold model does not uniquely determine forward current without the external network/current limiting.')}`})}

  function observeLearning(){const obs=new MutationObserver(()=>mountLearningButton());obs.observe(document.documentElement,{childList:true,subtree:true});mountLearningButton()}
  async function start(){installStyles();await ensureMerged();observeLearning()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

  window.PCBProDeepLearning={version:VERSION,open:openModal,merge:mergeCurriculum,get data(){return expansion},get merged(){return merged},projectSnapshot};
})();