(() => {
  'use strict';
  if (window.PCBProLearningCenter) return;

  const VERSION='1.0.0';
  let data=null;
  let open=false;
  let currentBranch='foundation';
  let currentTopic='voltage-current-resistance';
  let deep=true;
  let query='';

  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  const t=(id,en)=>lang()==='id'?id:en;
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  async function loadData(){
    if(data) return data;
    try{
      const r=await fetch('/learning-curriculum.json',{cache:'no-store'});
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      data=await r.json();
      return data;
    }catch(e){
      console.warn('[PCB Pro Learning] curriculum load failed',e);
      data={branches:[],references:[]};
      return data;
    }
  }

  function installStyles(){
    if(document.querySelector('#pcbpro-learning-style')) return;
    const s=document.createElement('style');
    s.id='pcbpro-learning-style';
    s.textContent=`
      #pcbpro-learning-trigger{border:1px solid #31536a;background:#102432;color:#cfe4ef;border-radius:8px;padding:7px 10px;font-size:10px;font-weight:900;white-space:nowrap}
      #pcbpro-learning-trigger:hover,#pcbpro-learning-trigger.active{border-color:#59d8bc;background:#153b33;color:#e9fffa}
      #pcbpro-learning-modal{position:fixed;z-index:2400;inset:0;background:#02070bd9;backdrop-filter:blur(7px);display:grid;place-items:center;padding:14px}
      .learn-shell{width:min(1500px,98vw);height:min(900px,96vh);display:grid;grid-template-rows:auto 1fr;border:1px solid #304958;background:#09131b;border-radius:16px;overflow:hidden;box-shadow:0 35px 120px #000e;color:#dce8ee}
      .learn-head{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #203541;background:#0b1821;min-width:0}.learn-brand{display:grid;gap:1px;min-width:210px}.learn-brand small{font:800 8px ui-monospace;color:#62dbc0;letter-spacing:.08em}.learn-brand b{font-size:14px}.learn-search{flex:1;min-width:120px;display:flex;align-items:center;gap:7px;border:1px solid #294452;background:#071119;border-radius:9px;padding:0 9px}.learn-search input{width:100%;border:0;outline:0;background:transparent;color:#e3eef3;padding:9px 2px;font-size:11px}.learn-head button{border:1px solid #2b4653;background:#10212b;color:#c6d5dc;border-radius:8px;padding:8px 10px;font-size:9px;font-weight:900}.learn-head button.active{border-color:#4ed4b6;background:#153c33;color:#eafffa}.learn-head .close{font-size:16px;line-height:1;padding:6px 10px}
      .learn-grid{min-height:0;display:grid;grid-template-columns:260px minmax(240px,330px) minmax(0,1fr)}
      .learn-branches,.learn-topics,.learn-detail{min-height:0;overflow:auto;scrollbar-gutter:stable}.learn-branches{border-right:1px solid #203541;background:#081119;padding:9px}.learn-topics{border-right:1px solid #203541;background:#0a151d;padding:9px}.learn-detail{padding:18px;background:linear-gradient(180deg,#0a161f,#081018)}
      .learn-section-title{font:900 8px ui-monospace;color:#668493;letter-spacing:.08em;margin:4px 5px 8px}.learn-branch,.learn-topic{width:100%;display:block;text-align:left;border:1px solid transparent;background:transparent;color:#aebfc7;border-radius:9px;padding:10px;margin-bottom:5px}.learn-branch:hover,.learn-topic:hover{background:#10212b;color:#fff}.learn-branch.active,.learn-topic.active{border-color:#2d7566;background:#12332d;color:#eafff9}.learn-branch b,.learn-topic b{display:block;font-size:10px}.learn-branch small,.learn-topic small{display:block;margin-top:4px;font-size:8px;line-height:1.45;color:#78919d}.learn-topic em{display:inline-block;margin-top:5px;border:1px solid #2a4653;border-radius:999px;padding:2px 6px;font:800 7px ui-monospace;color:#8db2bf;font-style:normal}
      .learn-hero{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;border-bottom:1px solid #203541;padding-bottom:14px}.learn-hero small{font:900 9px ui-monospace;color:#5ed9bd}.learn-hero h2{font-size:27px;line-height:1.1;margin:5px 0 7px}.learn-hero p{margin:0;max-width:850px;color:#9fb3bd;font-size:12px;line-height:1.65}.learn-badge{border:1px solid #355160;border-radius:999px;padding:6px 9px;font:900 8px ui-monospace;color:#8fb7c4;white-space:nowrap}
      .learn-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}.learn-card{border:1px solid #203946;background:#0c1a23;border-radius:11px;padding:12px}.learn-card h3{font-size:11px;margin:0 0 8px;color:#dbe8ee}.learn-card p,.learn-card li{font-size:10px;line-height:1.55;color:#9fb2bc}.learn-card ul{margin:0;padding-left:17px}.learn-formula{display:block;border:1px solid #2d4a57;background:#07131b;border-radius:8px;padding:8px 9px;margin:6px 0;font:800 10px ui-monospace;color:#e7cf75}.learn-next{display:flex;gap:6px;flex-wrap:wrap}.learn-next button{border:1px solid #2c4b58;background:#0e222b;color:#bcd0d8;border-radius:999px;padding:6px 8px;font-size:8px}.learn-next button:hover{border-color:#4ecfb2;color:#fff}.learn-wide{grid-column:1/-1}
      .learn-project{display:grid;gap:10px}.learn-project-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.learn-stat{border:1px solid #203946;background:#0b1921;border-radius:9px;padding:10px}.learn-stat small{display:block;color:#698692;font:800 7px ui-monospace}.learn-stat b{font-size:18px}.learn-rel{display:flex;gap:6px;flex-wrap:wrap}.learn-rel button{border:1px solid #2d665b;background:#103029;color:#c9eee5;border-radius:8px;padding:7px 9px;font-size:9px;font-weight:800}
      .learn-solver{display:grid;grid-template-columns:repeat(3,minmax(120px,1fr));gap:9px}.learn-solver label{display:grid;gap:5px;color:#8199a4;font-size:8px}.learn-solver input{border:1px solid #294653;background:#07131b;color:#e0edf2;border-radius:8px;padding:9px}.learn-solver-actions{display:flex;gap:7px;margin-top:9px}.learn-solver-actions button{border:1px solid #2b8c76;background:#176d5c;color:#fff;border-radius:8px;padding:8px 10px;font-weight:900}.learn-result{margin-top:10px;border:1px solid #2c4b58;background:#07131b;border-radius:9px;padding:10px;font:800 10px ui-monospace;color:#cfe3eb;white-space:pre-wrap}
      .learn-refs a{display:block;color:#76d9c3;text-decoration:none;font-size:10px;margin:8px 0}.learn-refs a:hover{text-decoration:underline}
      @media(max-width:1050px){.learn-grid{grid-template-columns:220px 260px minmax(0,1fr)}.learn-hero h2{font-size:22px}.learn-cards{grid-template-columns:1fr}}
      @media(max-width:780px){#pcbpro-learning-modal{padding:4px}.learn-shell{width:100vw;height:100dvh;border-radius:0}.learn-head{flex-wrap:wrap}.learn-brand{min-width:0}.learn-grid{grid-template-columns:1fr;grid-template-rows:auto auto 1fr}.learn-branches{display:flex;overflow:auto;border-right:0;border-bottom:1px solid #203541}.learn-branch{min-width:190px}.learn-topics{display:flex;overflow:auto;border-right:0;border-bottom:1px solid #203541}.learn-topic{min-width:210px}.learn-detail{padding:12px}.learn-project-summary{grid-template-columns:repeat(2,1fr)}.learn-solver{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  function allTopics(){return (data?.branches||[]).flatMap(b=>b.topics||[])}
  function branchById(id){return (data?.branches||[]).find(b=>b.id===id)||data?.branches?.[0]||null}
  function topicById(id){return allTopics().find(x=>x.id===id)||null}
  function current(){return topicById(currentTopic)||branchById(currentBranch)?.topics?.[0]||null}

  function projectSnapshot(){
    let components=[];
    const dom=[...document.querySelectorAll('.stage.schematic .node')];
    if(dom.length){
      components=dom.map(n=>({
        id:n.querySelector('.ref')?.textContent?.trim()||'',
        code:(n.querySelector('.symbol')?.textContent||'').trim(),
        name:n.querySelector('small')?.textContent?.trim()||'',
        value:n.querySelector('b')?.textContent?.trim()||''
      })).filter(x=>x.id);
    }else{
      try{components=JSON.parse(localStorage.getItem('pcbpro0045-project-v11')||'null')?.components||[]}catch{}
    }
    const nets=window.PCBProWireEngine?.nets||[];
    const routes=window.PCBProWireEngine?.routes||[];
    const board=window.PCBProBoardModel?.model||null;
    const selected=document.querySelector('.stage.schematic .node.selected');
    const selectedRef=selected?.querySelector('.ref')?.textContent?.trim()||'';
    return {components,nets,routes,board,selectedRef};
  }

  function relevantTopicIds(snapshot=projectSnapshot()){
    const ids=new Set(['circuit-basics','voltage-current-resistance','ohms-law','kcl','kvl']);
    const text=snapshot.components.map(c=>`${c.code||''} ${c.name||''} ${c.id||''}`).join(' ').toLowerCase();
    if(/resistor|\br\d/.test(text)) ['resistor','series-parallel','divider-voltage','divider-current','power'].forEach(x=>ids.add(x));
    if(/capacitor|\bc\d/.test(text)) ['capacitor','rc-transient','filters','power-integrity'].forEach(x=>ids.add(x));
    if(/inductor|\bl\d/.test(text)) ['inductor','rl-transient','rlc'].forEach(x=>ids.add(x));
    if(/diode|led|\bd\d/.test(text)) ['diode','nonlinear-analysis','power'].forEach(x=>ids.add(x));
    if(/mosfet|transistor|\bq\d/.test(text)) ['transistor','dependent-sources','small-signal'].forEach(x=>ids.add(x));
    if(/op-amp|\bu\d/.test(text)) ['opamp','dependent-sources','small-signal'].forEach(x=>ids.add(x));
    if(snapshot.routes.length===0) ids.add('open-short');
    if(snapshot.board?.tracks?.length) ['parasitics','signal-integrity'].forEach(x=>ids.add(x));
    return [...ids].filter(x=>topicById(x));
  }

  function topicButton(topic){
    return `<button class="learn-topic ${topic.id===currentTopic?'active':''}" data-topic="${esc(topic.id)}"><b>${esc(topic.title)}</b><small>${esc(topic.summary)}</small><em>${esc(topic.level||'topic')}</em></button>`;
  }

  function renderBranches(){
    const box=document.querySelector('#pcbpro-learning-modal .learn-branches'); if(!box)return;
    const q=query.trim().toLowerCase();
    box.innerHTML=`<div class="learn-section-title">${t('POHON ILMU','KNOWLEDGE TREE')}</div>`+(data.branches||[]).map(b=>{
      const hits=!q||b.title.toLowerCase().includes(q)||b.summary.toLowerCase().includes(q)||(b.topics||[]).some(x=>`${x.title} ${x.summary} ${(x.concepts||[]).join(' ')}`.toLowerCase().includes(q));
      if(!hits)return'';
      return `<button class="learn-branch ${b.id===currentBranch?'active':''}" data-branch="${esc(b.id)}"><b>${esc(b.title)}</b><small>${esc(b.summary)}</small></button>`;
    }).join('');
  }

  function renderTopics(){
    const box=document.querySelector('#pcbpro-learning-modal .learn-topics'); if(!box)return;
    const q=query.trim().toLowerCase();
    let topics=[];
    if(q){topics=allTopics().filter(x=>`${x.title} ${x.summary} ${(x.concepts||[]).join(' ')} ${(x.formulas||[]).join(' ')}`.toLowerCase().includes(q));}
    else topics=branchById(currentBranch)?.topics||[];
    box.innerHTML=`<div class="learn-section-title">${q?t('HASIL PENCARIAN','SEARCH RESULTS'):t('CABANG TOPIK','TOPIC BRANCH')}</div>`+topics.map(topicButton).join('')+(topics.length?'':`<p style="padding:10px;color:#718792;font-size:10px">${t('Tidak ada topik yang cocok.','No matching topics.')}</p>`);
  }

  function detailsHtml(topic){
    if(!topic)return `<p>${t('Pilih topik.','Select a topic.')}</p>`;
    const branch=(data.branches||[]).find(b=>(b.topics||[]).some(x=>x.id===topic.id));
    const concepts=(topic.concepts||[]).map(x=>`<li>${esc(x)}</li>`).join('');
    const formulas=(topic.formulas||[]).map(x=>`<code class="learn-formula">${esc(x)}</code>`).join('');
    const practice=(topic.practice||[]).map(x=>`<li>${esc(x)}</li>`).join('');
    const next=(topic.next||[]).map(id=>topicById(id)).filter(Boolean).map(x=>`<button data-topic="${esc(x.id)}">${esc(x.title)}</button>`).join('');
    return `<div class="learn-hero"><div><small>${esc(branch?.title||'')}</small><h2>${esc(topic.title)}</h2><p>${esc(topic.summary)}</p></div><span class="learn-badge">${esc(topic.level||'topic').toUpperCase()}</span></div>
      <div class="learn-cards">
        <section class="learn-card"><h3>${t('Gambaran besar','Big picture')}</h3><p>${esc(topic.summary)}</p></section>
        <section class="learn-card"><h3>${t('Konsep terkait','Connected concepts')}</h3><ul>${concepts||`<li>${t('Belum ada daftar konsep.','No concept list yet.')}</li>`}</ul></section>
        ${deep?`<section class="learn-card"><h3>${t('Rumus / model','Formula / model')}</h3>${formulas||`<p>${t('Topik ini lebih konseptual; tidak ada satu rumus utama.','This topic is primarily conceptual; there is no single governing formula.')}</p>`}</section>
        <section class="learn-card"><h3>${t('Latihan berpikir','Practice')}</h3><ul>${practice}</ul></section>`:''}
        <section class="learn-card learn-wide"><h3>${t('Cabang berikutnya','Next branches')}</h3><div class="learn-next">${next||`<span style="font-size:10px;color:#78919d">${t('Belum ada cabang berikutnya.','No next branch yet.')}</span>`}</div></section>
      </div>`;
  }

  function renderDetail(){
    const box=document.querySelector('#pcbpro-learning-modal .learn-detail'); if(!box)return;
    box.innerHTML=detailsHtml(current());
  }

  function renderProject(){
    const box=document.querySelector('#pcbpro-learning-modal .learn-detail'); if(!box)return;
    const s=projectSnapshot(); const ids=relevantTopicIds(s);
    box.innerHTML=`<div class="learn-hero"><div><small>PCB PRO · PROJECT LEARNING</small><h2>${t('Belajar dari project aktif','Learn from the active project')}</h2><p>${t('Bagian ini tidak mengarang hasil solver. Ia hanya membaca komponen, net, wire, dan board state yang benar-benar tersedia lalu mengarahkan ke konsep yang relevan.','This section does not fabricate solver results. It only reads components, nets, wires, and board state that actually exist, then points to relevant concepts.')}</p></div></div>
      <div class="learn-project" style="margin-top:14px"><div class="learn-project-summary">
        <div class="learn-stat"><small>COMPONENTS</small><b>${s.components.length}</b></div><div class="learn-stat"><small>NETS</small><b>${s.nets.length}</b></div><div class="learn-stat"><small>WIRES</small><b>${s.routes.length}</b></div><div class="learn-stat"><small>PCB TRACKS</small><b>${s.board?.tracks?.length||0}</b></div>
      </div><section class="learn-card"><h3>${t('Topik yang relevan dengan project ini','Topics relevant to this project')}</h3><div class="learn-rel">${ids.map(id=>{const x=topicById(id);return `<button data-topic="${esc(id)}">${esc(x.title)}</button>`}).join('')}</div></section>
      <section class="learn-card"><h3>${t('Apa yang bisa dipelajari langsung','What you can learn directly')}</h3><ul><li>${t('Ubah value resistor lalu hubungkan ke Ohm/power.','Change a resistor value and connect it to Ohm/power concepts.')}</li><li>${t('Putuskan wire lalu pelajari open circuit dan perubahan netlist.','Break a wire and study open-circuit behavior and netlist changes.')}</li><li>${t('Buat cabang parallel lalu gunakan KCL/current divider.','Create a parallel branch then use KCL/current-divider reasoning.')}</li><li>${t('Buat loop multi-source lalu gunakan KVL/nodal/mesh sesuai kebutuhan.','Create a multi-source loop then apply KVL/nodal/mesh as appropriate.')}</li></ul></section></div>`;
  }

  function parseEng(v){
    const raw=String(v||'').trim().replace(',','.'); if(!raw)return NaN;
    const m=raw.match(/^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*([pnumkKMGTµu]?)/); if(!m)return NaN;
    const map={p:1e-12,n:1e-9,u:1e-6,'µ':1e-6,m:1e-3,'':1,k:1e3,K:1e3,M:1e6,G:1e9,T:1e12};
    return Number(m[1])*(map[m[2]]??1);
  }
  function fmt(v,unit){if(!Number.isFinite(v))return'—';const a=Math.abs(v);const scales=[[1e9,'G'],[1e6,'M'],[1e3,'k'],[1,''],[1e-3,'m'],[1e-6,'µ'],[1e-9,'n'],[1e-12,'p']];const s=scales.find(([x])=>a>=x)||scales.at(-1);return `${(v/s[0]).toPrecision(5).replace(/\.?0+$/,'')} ${s[1]}${unit}`}
  function renderSolver(){
    const box=document.querySelector('#pcbpro-learning-modal .learn-detail'); if(!box)return;
    box.innerHTML=`<div class="learn-hero"><div><small>OHM + POWER QUICK SOLVER</small><h2>${t('Hitung sambil belajar','Calculate while learning')}</h2><p>${t('Isi dua dari V, I, R. Solver menghitung nilai ketiga dan power. Prefix engineering seperti m, µ, k, M didukung.','Enter any two of V, I, R. The solver computes the third value and power. Engineering prefixes such as m, µ, k, M are supported.')}</p></div></div>
      <section class="learn-card" style="margin-top:14px"><div class="learn-solver"><label>Voltage V<input id="learn-v" placeholder="mis. 5 V"></label><label>Current I<input id="learn-i" placeholder="mis. 10 mA"></label><label>Resistance R<input id="learn-r" placeholder="mis. 330 Ω"></label></div><div class="learn-solver-actions"><button data-solve>${t('Hitung','Solve')}</button><button data-clear style="background:#11232d;border-color:#35505d">${t('Bersihkan','Clear')}</button></div><pre class="learn-result">${t('Isi dua nilai untuk mulai.','Enter two values to begin.')}</pre></section>`;
  }

  function renderRefs(){
    const box=document.querySelector('#pcbpro-learning-modal .learn-detail'); if(!box)return;
    box.innerHTML=`<div class="learn-hero"><div><small>LEARNING SOURCES</small><h2>${t('Referensi pengembangan atlas','References used to expand the atlas')}</h2><p>${t('20 judul yang lu kasih jadi tulang punggung. Cabang lanjutannya diperluas memakai struktur kurikulum circuit analysis/electronics standar, bukan ditebak dari judul saja.','Your 20 titles form the backbone. The extended branches are expanded using standard circuit-analysis/electronics curriculum structure rather than guessing from titles alone.')}</p></div></div><section class="learn-card learn-refs" style="margin-top:14px">${(data.references||[]).map(r=>`<a target="_blank" rel="noreferrer" href="${esc(r.url)}">↗ ${esc(r.name)}</a>`).join('')}</section>`;
  }

  let mode='atlas';
  function renderMode(){
    document.querySelectorAll('#pcbpro-learning-modal [data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
    if(mode==='project')renderProject();else if(mode==='solver')renderSolver();else if(mode==='refs')renderRefs();else renderDetail();
  }
  function renderAll(){renderBranches();renderTopics();renderMode()}

  function bindModal(){
    const root=document.querySelector('#pcbpro-learning-modal'); if(!root)return;
    root.addEventListener('click',e=>{
      const branch=e.target.closest('[data-branch]'); if(branch){currentBranch=branch.dataset.branch;currentTopic=branchById(currentBranch)?.topics?.[0]?.id||currentTopic;mode='atlas';renderAll();return}
      const topic=e.target.closest('[data-topic]'); if(topic){const x=topicById(topic.dataset.topic);if(x){currentTopic=x.id;const b=(data.branches||[]).find(z=>(z.topics||[]).some(q=>q.id===x.id));if(b)currentBranch=b.id;mode='atlas';renderAll()}return}
      const m=e.target.closest('[data-mode]');if(m){mode=m.dataset.mode;renderMode();return}
      if(e.target.closest('[data-close-learning]')){closeModal();return}
      if(e.target.closest('[data-deep]')){deep=!deep;e.target.closest('[data-deep]').classList.toggle('active',deep);e.target.closest('[data-deep]').textContent=deep?t('Mendalam','Deep'):t('Peta luas','Broad map');if(mode==='atlas')renderDetail();return}
      if(e.target.matches('[data-solve]')){
        let V=parseEng(document.querySelector('#learn-v')?.value),I=parseEng(document.querySelector('#learn-i')?.value),R=parseEng(document.querySelector('#learn-r')?.value);
        const count=[V,I,R].filter(Number.isFinite).length;let msg='';
        if(count<2)msg=t('Isi minimal dua nilai V, I, R.','Enter at least two values among V, I, R.');
        else{
          if(!Number.isFinite(V))V=I*R; if(!Number.isFinite(I))I=V/R; if(!Number.isFinite(R))R=V/I;
          const P=V*I; msg=`V = ${fmt(V,'V')}\nI = ${fmt(I,'A')}\nR = ${fmt(R,'Ω')}\nP = ${fmt(P,'W')}`;
        }
        document.querySelector('.learn-result').textContent=msg;return;
      }
      if(e.target.matches('[data-clear]')){['#learn-v','#learn-i','#learn-r'].forEach(s=>{const x=document.querySelector(s);if(x)x.value=''});document.querySelector('.learn-result').textContent=t('Isi dua nilai untuk mulai.','Enter two values to begin.');return}
      if(e.target===root)closeModal();
    });
    root.querySelector('.learn-search input')?.addEventListener('input',e=>{query=e.target.value;renderBranches();renderTopics()});
  }

  async function openModal(){
    await loadData(); installStyles();
    document.querySelector('#pcbpro-learning-modal')?.remove();
    const root=document.createElement('div');root.id='pcbpro-learning-modal';
    root.innerHTML=`<div class="learn-shell"><div class="learn-head"><div class="learn-brand"><small>PCB PRO · LEARNING ATLAS v${VERSION}</small><b>${t('Engineering Circuit Analysis — pohon ilmu','Engineering Circuit Analysis — knowledge tree')}</b></div><label class="learn-search"><span>⌕</span><input placeholder="${t('Cari Ohm, KCL, transistor, filter, PCB…','Search Ohm, KCL, transistor, filter, PCB…')}" value="${esc(query)}"></label><button data-mode="atlas" class="active">${t('Atlas','Atlas')}</button><button data-mode="project">${t('Project','Project')}</button><button data-mode="solver">${t('Rumus','Solver')}</button><button data-mode="refs">${t('Referensi','References')}</button><button data-deep class="active">${deep?t('Mendalam','Deep'):t('Peta luas','Broad map')}</button><button class="close" data-close-learning>×</button></div><div class="learn-grid"><aside class="learn-branches"></aside><aside class="learn-topics"></aside><main class="learn-detail"></main></div></div>`;
    document.body.appendChild(root);open=true;document.querySelector('#pcbpro-learning-trigger')?.classList.add('active');bindModal();renderAll();
  }
  function closeModal(){document.querySelector('#pcbpro-learning-modal')?.remove();open=false;document.querySelector('#pcbpro-learning-trigger')?.classList.remove('active')}

  function mountTrigger(){
    installStyles(); const actions=document.querySelector('.top-actions'); if(!actions)return false;
    let b=document.querySelector('#pcbpro-learning-trigger');
    if(!b){b=document.createElement('button');b.id='pcbpro-learning-trigger';b.textContent=t('◉ Belajar','◉ Learn');b.title=t('Peta belajar rangkaian dan PCB','Circuit and PCB learning atlas');b.addEventListener('click',()=>open?closeModal():openModal());const ui=document.querySelector('#pcbpro-ui-trigger');if(ui)actions.insertBefore(b,ui);else actions.appendChild(b)}
    return true;
  }

  function refresh(){mountTrigger();if(open){const b=document.querySelector('#pcbpro-learning-trigger');if(b)b.textContent=t('◉ Belajar','◉ Learn')}}
  function start(){loadData();mountTrigger();document.addEventListener('click',()=>setTimeout(mountTrigger,0),{passive:true});window.addEventListener('pcbpro:language',refresh);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.PCBProLearningCenter={version:VERSION,open:openModal,close:closeModal,refresh,get curriculum(){return data},get project(){return projectSnapshot()}};
})();
