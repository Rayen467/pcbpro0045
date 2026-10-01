(() => {
  'use strict';
  if (window.PCBProAssistantV114) return;

  const VERSION='1.14.0';
  let root=null;
  let open=true;
  let sending=false;
  let refreshTimer=0;
  const session=[];

  const t=(id,en)=>(window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id')==='id'?id:en;
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const clean=(v)=>String(v??'').trim().replace(/\s+/g,' ');

  function installStyles(){
    if(document.querySelector('#pcbpro-assistant-v114-style'))return;
    const s=document.createElement('style');s.id='pcbpro-assistant-v114-style';s.textContent=`
      #pcbpro-assistant-v114{position:fixed;z-index:980;right:12px;bottom:12px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#dce9ee}
      .pa114-launch{width:50px;height:50px;border:1px solid #317567;border-radius:15px;background:radial-gradient(circle at 35% 30%,#4ad8bd,#177d6c 34%,#0b2730 70%);color:#eafffa;box-shadow:0 18px 55px #000b;font-weight:950}.pa114-launch.hidden{display:none}
      .pa114-panel{width:min(500px,calc(100vw - 24px));height:min(790px,calc(100dvh - 100px));min-width:360px;min-height:520px;resize:both;overflow:hidden;display:grid;grid-template-rows:auto auto 1fr auto;border:1px solid #2d4b58;border-radius:15px;background:#071219f7;box-shadow:0 28px 90px #000c;backdrop-filter:blur(13px)}.pa114-panel.hidden{display:none}
      .pa114-head{display:flex;align-items:center;gap:9px;padding:10px;border-bottom:1px solid #1c333e;background:#0a1820}.pa114-orb{width:31px;height:31px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 30%,#83f3db,#25b498 38%,#0d3137 73%);box-shadow:0 0 20px #38c8ae55;color:#06231e;font:950 8px ui-monospace}.pa114-brand{display:grid;gap:2px;min-width:0;flex:1}.pa114-brand b{font-size:11px}.pa114-brand small{font:800 6.8px ui-monospace;color:#7191a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pa114-head button{border:1px solid #294652;background:#0c1c24;color:#9eb3bd;border-radius:7px;padding:6px 8px;font-size:8px;font-weight:900}.pa114-head .close{font-size:16px;padding:3px 8px}
      .pa114-context{border-bottom:1px solid #1c333e;background:#08151d;padding:8px 9px;display:grid;gap:7px}.pa114-context-top{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.pa114-pill{border:1px solid #2b4a56;border-radius:999px;padding:4px 7px;font:800 7px ui-monospace;color:#96b3be;background:#0b1c24}.pa114-pill.good{border-color:#2f7566;color:#79dec8}.pa114-pill.warn{border-color:#715b31;color:#e5c36f}.pa114-state{font-size:8px;line-height:1.45;color:#78929e}.pa114-chips{display:flex;gap:5px;overflow:auto;scrollbar-width:none}.pa114-chips button{border:1px solid #2b554c;background:#102923;color:#75d8c3;border-radius:7px;padding:5px 7px;font-size:7px;font-weight:800;white-space:nowrap}
      .pa114-log{min-height:0;overflow:auto;padding:10px 8px;scrollbar-width:thin}.pa114-msg{display:grid;grid-template-columns:27px minmax(0,1fr);gap:7px;margin:8px 0}.pa114-msg.user{grid-template-columns:minmax(0,1fr) 27px}.pa114-msg.user .pa114-avatar{grid-column:2}.pa114-msg.user .pa114-bubble{grid-column:1;grid-row:1;background:#10281f;border-color:#28594c}.pa114-avatar{width:27px;height:27px;border-radius:8px;background:#102631;border:1px solid #2a5160;display:grid;place-items:center;color:#5fd9c0;font:900 7px ui-monospace}.pa114-bubble{border:1px solid #213b47;background:#0b1922;border-radius:10px;padding:9px}.pa114-bubble p{margin:0;color:#b0c3cc;font-size:9px;line-height:1.58;white-space:pre-wrap}.pa114-meta{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.pa114-meta span{border:1px solid #294652;border-radius:999px;padding:3px 6px;color:#708d99;font:800 6px ui-monospace}.pa114-meta .local{border-color:#2d6a5d;color:#64ceb6}.pa114-meta .reason{border-color:#7b6335;color:#e3c36f}.pa114-thinking{opacity:.75}.pa114-thinking .pa114-avatar{animation:pa114pulse 1s infinite alternate}@keyframes pa114pulse{to{box-shadow:0 0 20px #43d4b688}}
      .pa114-compose{border-top:1px solid #1d333e;background:#08151d;padding:8px}.pa114-input{display:flex;gap:6px}.pa114-input textarea{flex:1;min-height:42px;max-height:110px;resize:vertical;border:1px solid #2b4855;background:#061118;color:#deebef;border-radius:9px;padding:9px;font-size:9px;line-height:1.4;outline:0}.pa114-input textarea:focus{border-color:#36a98f}.pa114-send{width:68px;border:1px solid #2aae94;background:#178c78;color:white;border-radius:9px;font-size:8px;font-weight:950}.pa114-send:disabled{opacity:.45}.pa114-foot{display:flex;justify-content:space-between;gap:8px;margin-top:6px;color:#526f7d;font:6.5px ui-monospace}.pa114-foot span:last-child{text-align:right}
      @media(max-width:650px){#pcbpro-assistant-v114{right:5px;bottom:5px}.pa114-panel{width:calc(100vw - 10px);height:calc(100dvh - 75px);min-width:0;resize:none}.pa114-brand small{max-width:230px}}
    `;document.head.appendChild(s)
  }

  function projectSummary(){
    const b=window.PCBProAssistantBrain;const s=b?.projectSnapshot?.();if(!s)return null;
    const w=s.workflow;const next=w?.stages?.find(x=>x.id===w.next);const nextLabel=next?.label?.[(window.PCBProUX?.lang||'id')]||next?.label?.id||next?.id||w?.next||'—';
    return {view:s.view,selected:s.selected?.id||null,counts:s.counts,done:w?.done,total:w?.total,next:nextLabel,brain:b.snapshot?.()};
  }

  function refreshContext(){
    if(!root)return;const box=root.querySelector('.pa114-context');if(!box)return;const s=projectSummary();
    if(!s){box.querySelector('.pa114-state').textContent=t('Assistant Brain sedang memuat context project.','Assistant Brain is loading project context.');return}
    box.querySelector('[data-state="view"]').textContent=`VIEW ${s.view||'—'}`;
    box.querySelector('[data-state="focus"]').textContent=s.selected?`FOCUS ${s.selected}`:'FOCUS —';
    box.querySelector('[data-state="workflow"]').textContent=s.done!=null?`FLOW ${s.done}/${s.total}`:'FLOW —';
    box.querySelector('.pa114-state').textContent=t(`Project aktif: ${s.counts.components} komponen · ${s.counts.nets} net · ${s.counts.wires} wire · ${s.counts.tracks} track. Next: ${s.next}.`,`Active project: ${s.counts.components} components · ${s.counts.nets} nets · ${s.counts.wires} wires · ${s.counts.tracks} tracks. Next: ${s.next}.`);
    const brain=window.PCBProAssistantBrain?.snapshot?.();const foot=root.querySelector('.pa114-foot span:first-child');if(foot&&brain)foot.textContent=`LIB ${brain.libraryChunks||0} · MEMORY ${brain.history?.length||0}/${12}`;
  }

  function metaHtml(meta={}){
    const tags=[];const route=String(meta.route||'').toUpperCase();const tier=String(meta.tier||'').toUpperCase();if(route)tags.push(`<span class="${meta.tier==='local'?'local':''}">${esc(route)}</span>`);if(tier)tags.push(`<span class="${meta.tier==='reason'?'reason':''}">${esc(tier)}</span>`);if(meta.libraryHits)tags.push(`<span>LIB ${meta.libraryHits}</span>`);if(meta.model)tags.push(`<span>${esc(meta.model)}</span>`);
    const u=meta.usage||{};const total=u.total_tokens??u.totalTokens;if(Number.isFinite(total))tags.push(`<span>TOK ${total}</span>`);return tags.join('')
  }

  function addMessage(role,text,meta={}){
    if(!root)return;session.push({role,text,meta,time:Date.now()});const log=root.querySelector('.pa114-log');const row=document.createElement('div');row.className=`pa114-msg ${role}`;row.innerHTML=`<div class="pa114-avatar">${role==='user'?'YOU':'AI'}</div><div class="pa114-bubble"><p>${esc(text)}</p>${role==='assistant'?`<div class="pa114-meta">${metaHtml(meta)}</div>`:''}</div>`;log.appendChild(row);log.scrollTop=log.scrollHeight;return row
  }

  function thinking(){const row=addMessage('assistant',t('Gue baca project + library dulu…','Reading project + library…'),{route:'routing'});row.classList.add('pa114-thinking');return row}
  function replaceThinking(row,text,meta){if(!row)return;row.classList.remove('pa114-thinking');row.querySelector('.pa114-bubble p').textContent=text;row.querySelector('.pa114-meta').innerHTML=metaHtml(meta);}

  async function submit(raw){
    const q=clean(raw);if(!q||sending)return;sending=true;addMessage('user',q);const waitRow=thinking();const send=root.querySelector('.pa114-send');if(send)send.disabled=true;
    try{
      const brain=window.PCBProAssistantBrain;if(!brain)throw new Error('Assistant Brain belum dimuat');const result=await brain.ask(q);replaceThinking(waitRow,result.text||t('Tidak ada jawaban.','No answer.'),result.meta||{});refreshContext();
    }catch(e){replaceThinking(waitRow,t(`Assistant error: ${e.message}`,`Assistant error: ${e.message}`),{route:'error',tier:'local'})}
    finally{sending=false;if(send)send.disabled=false;root.querySelector('.pa114-input textarea')?.focus()}
  }

  function explainSelected(){
    const s=window.PCBProAssistantBrain?.projectSnapshot?.();if(s?.selected)return submit(t(`Jelaskan ${s.selected.id} yang lagi gue pilih: fungsi, koneksi, data yang diketahui, risiko, dan langkah berikutnya.`,`Explain selected ${s.selected.id}: function, connectivity, known data, risks, and next step.`));
    return submit(t('Jelaskan view yang lagi gue buka dan apa yang seharusnya gue kerjain di sini.','Explain the current view and what I should work on here.'))
  }

  function mount(){
    if(root)return;installStyles();document.querySelector('#pcbpro-jarvis')?.remove();
    root=document.createElement('div');root.id='pcbpro-assistant-v114';root.innerHTML=`
      <button class="pa114-launch hidden" title="PCB Pro AI Assistant">AI</button>
      <section class="pa114-panel">
        <header class="pa114-head"><div class="pa114-orb">AI</div><div class="pa114-brand"><b>PCB Pro Engineering Assistant</b><small>HYBRID BRAIN · PROJECT TOOLS + LOCAL RAG LIBRARY + WORKING MEMORY + LLM · v${VERSION}</small></div><button class="pa114-memory" title="${t('Reset working memory','Reset working memory')}">MEM</button><button class="close">×</button></header>
        <section class="pa114-context"><div class="pa114-context-top"><span class="pa114-pill good" data-state="view">VIEW —</span><span class="pa114-pill" data-state="focus">FOCUS —</span><span class="pa114-pill" data-state="workflow">FLOW —</span></div><div class="pa114-state"></div><div class="pa114-chips"><button data-q="${t('Gue lagi ngapain sekarang?','What am I working on now?')}">${t('Context','Context')}</button><button data-q="${t('Apa langkah selanjutnya dari project ini?','What is the next step for this project?')}">${t('Next','Next')}</button><button data-q="${t('Analisa project aktif dan kasih masalah paling penting dulu.','Analyze the active project and prioritize the most important issue.')}">${t('Audit AI','AI Audit')}</button><button data-selected>${t('Jelaskan pilihan','Explain selected')}</button><button data-q="${t('Cek wiring dan netlist project ini. Jangan nebak koneksi yang tidak ada.','Check this project wiring and netlist. Do not guess missing connections.')}">Wiring</button></div></section>
        <main class="pa114-log"></main>
        <footer class="pa114-compose"><div class="pa114-input"><textarea placeholder="${t('Ngomong normal aja: apa yang lagi gue kerjain, kenapa DRC ini muncul, sambung mana, komponen ini cocok gak, bantu benerin…','Ask naturally: what am I working on, why did this DRC appear, what connects where, is this part suitable, help me fix it…')}"></textarea><button class="pa114-send">${t('Kirim','Send')}</button></div><div class="pa114-foot"><span>LIB — · MEMORY —</span><span>${t('LOCAL dulu → RAG → LLM kalau perlu','LOCAL first → RAG → LLM when needed')}</span></div></footer>
      </section>`;document.body.appendChild(root);
    const panel=root.querySelector('.pa114-panel'),launch=root.querySelector('.pa114-launch');root.querySelector('.close').addEventListener('click',()=>{open=false;panel.classList.add('hidden');launch.classList.remove('hidden')});launch.addEventListener('click',()=>{open=true;panel.classList.remove('hidden');launch.classList.add('hidden');refreshContext()});
    root.querySelector('.pa114-memory').addEventListener('click',()=>{window.PCBProAssistantBrain?.resetMemory?.();addMessage('assistant',t('Working memory assistant di-reset. Project design tidak diubah.','Assistant working memory reset. Project design was not changed.'),{route:'local',tier:'local'});refreshContext()});
    root.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>submit(b.dataset.q)));root.querySelector('[data-selected]').addEventListener('click',explainSelected);
    const ta=root.querySelector('textarea');root.querySelector('.pa114-send').addEventListener('click',()=>{const q=ta.value;ta.value='';submit(q)});ta.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();const q=ta.value;ta.value='';submit(q)}});
    addMessage('assistant',t('Gue bukan mode chatbot doang. Gue baca project yang sedang lu buka, pakai tool lokal untuk aksi/state, cari library dulu, simpan working context, dan baru manggil LLM kalau pertanyaannya memang butuh reasoning. Tanya aja normal.','I am not operating as a chat-only bot. I read the project you are working on, use local tools for actions/state, retrieve from the library first, keep working context, and call the LLM only when reasoning is needed. Ask naturally.'),{route:'boot',tier:'local'});
    refreshContext();const obs=new MutationObserver(()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(refreshContext,160)});obs.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-pcb-view']});window.addEventListener('pcbpro:language',refreshContext)
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
  window.PCBProAssistantV114={version:VERSION,ask:submit,refresh:refreshContext,open(){root?.querySelector('.pa114-launch')?.click()},get session(){return session.slice()}};
  window.PCBProAssistant={version:VERSION,ask:submit,refresh:refreshContext,open(){root?.querySelector('.pa114-launch')?.click()},get history(){return session.slice()}};
})();
