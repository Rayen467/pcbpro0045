(() => {
  'use strict';
  if (window.PCBProAssistantV115) return;

  const VERSION='1.23.0';
  let root=null;
  let open=true;
  let sending=false;
  let refreshTimer=0;
  let providerStatus={connected:null,code:'AI_CHECKING',auth_source:null,message:''};
  const session=[];

  const t=(id,en)=>(window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id')==='id'?id:en;
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const clean=(v)=>String(v??'').trim().replace(/\s+/g,' ');

  function installStyles(){
    if(document.querySelector('#pcbpro-assistant-v115-style'))return;
    const s=document.createElement('style');s.id='pcbpro-assistant-v115-style';s.textContent=`
      #pcbpro-assistant-v115{position:fixed;z-index:980;right:12px;bottom:12px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#dce9ee}
      .pa115-launch{width:50px;height:50px;border:1px solid #317567;border-radius:15px;background:radial-gradient(circle at 35% 30%,#4ad8bd,#177d6c 34%,#0b2730 70%);color:#eafffa;box-shadow:0 18px 55px #000b;font-weight:950}.pa115-launch.hidden{display:none}
      .pa115-panel{width:min(500px,calc(100vw - 24px));height:min(790px,calc(100dvh - 100px));min-width:360px;min-height:520px;resize:both;overflow:hidden;display:grid;grid-template-rows:auto auto 1fr auto;border:1px solid #2d4b58;border-radius:15px;background:#071219f7;box-shadow:0 28px 90px #000c;backdrop-filter:blur(13px)}.pa115-panel.hidden{display:none}
      .pa115-head{display:flex;align-items:center;gap:9px;padding:10px;border-bottom:1px solid #1c333e;background:#0a1820}.pa115-orb{width:31px;height:31px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 30%,#83f3db,#25b498 38%,#0d3137 73%);box-shadow:0 0 20px #38c8ae55;color:#06231e;font:950 8px ui-monospace}.pa115-brand{display:grid;gap:2px;min-width:0;flex:1}.pa115-brand b{font-size:11px}.pa115-brand small{font:800 6.8px ui-monospace;color:#7191a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pa115-head button{border:1px solid #294652;background:#0c1c24;color:#9eb3bd;border-radius:7px;padding:6px 8px;font-size:8px;font-weight:900}.pa115-head .close{font-size:16px;padding:3px 8px}
      .pa115-context{border-bottom:1px solid #1c333e;background:#08151d;padding:8px 9px;display:grid;gap:7px}.pa115-context-top{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.pa115-pill{border:1px solid #2b4a56;border-radius:999px;padding:4px 7px;font:800 7px ui-monospace;color:#96b3be;background:#0b1c24}.pa115-pill.good{border-color:#2f7566;color:#79dec8}.pa115-pill.warn{border-color:#715b31;color:#e5c36f}.pa115-pill.bad{border-color:#7c4138;color:#ef9b88;background:#2a1512}.pa115-state{font-size:8px;line-height:1.45;color:#78929e}.pa115-chips{display:flex;gap:5px;overflow:auto;scrollbar-width:none}.pa115-chips button{border:1px solid #2b554c;background:#102923;color:#75d8c3;border-radius:7px;padding:5px 7px;font-size:7px;font-weight:800;white-space:nowrap}
      .pa115-log{min-height:0;overflow:auto;padding:10px 8px;scrollbar-width:thin}.pa115-msg{display:grid;grid-template-columns:27px minmax(0,1fr);gap:7px;margin:8px 0}.pa115-msg.user{grid-template-columns:minmax(0,1fr) 27px}.pa115-msg.user .pa115-avatar{grid-column:2}.pa115-msg.user .pa115-bubble{grid-column:1;grid-row:1;background:#10281f;border-color:#28594c}.pa115-avatar{width:27px;height:27px;border-radius:8px;background:#102631;border:1px solid #2a5160;display:grid;place-items:center;color:#5fd9c0;font:900 7px ui-monospace}.pa115-bubble{border:1px solid #213b47;background:#0b1922;border-radius:10px;padding:9px}.pa115-bubble p{margin:0;color:#b0c3cc;font-size:9px;line-height:1.58;white-space:pre-wrap}.pa115-meta{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.pa115-meta span{border:1px solid #294652;border-radius:999px;padding:3px 6px;color:#708d99;font:800 6px ui-monospace}.pa115-meta .local{border-color:#2d6a5d;color:#64ceb6}.pa115-meta .reason{border-color:#7b6335;color:#e3c36f}.pa115-thinking{opacity:.75}.pa115-thinking .pa115-avatar{animation:pa115pulse 1s infinite alternate}@keyframes pa115pulse{to{box-shadow:0 0 20px #43d4b688}}
      .pa115-compose{border-top:1px solid #1d333e;background:#08151d;padding:8px}.pa115-input{display:flex;gap:6px}.pa115-input textarea{flex:1;min-height:42px;max-height:110px;resize:vertical;border:1px solid #2b4855;background:#061118;color:#deebef;border-radius:9px;padding:9px;font-size:9px;line-height:1.4;outline:0}.pa115-input textarea:focus{border-color:#36a98f}.pa115-send{width:68px;border:1px solid #2aae94;background:#178c78;color:white;border-radius:9px;font-size:8px;font-weight:950}.pa115-send:disabled{opacity:.45}.pa115-foot{display:flex;justify-content:space-between;gap:8px;margin-top:6px;color:#526f7d;font:6.5px ui-monospace}.pa115-foot span:last-child{text-align:right}
      .pa115-plan{margin-top:8px;border:1px solid #6b5732;background:#251e10;border-radius:9px;padding:8px}.pa115-plan-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.pa115-plan-head b{font-size:8px;color:#f1d07b}.pa115-plan-list{margin:7px 0;padding-left:17px}.pa115-plan-list li{font-size:8px;line-height:1.45;color:#c3b589;margin:4px 0}.pa115-plan-actions{display:flex;gap:6px;flex-wrap:wrap}.pa115-plan-actions button{border:1px solid #8a713a;background:#4b3a15;color:#ffdea0;border-radius:7px;padding:6px 8px;font-size:7px;font-weight:900}.pa115-plan-actions button.secondary{border-color:#3b505a;background:#10202a;color:#9db2bc}.pa115-plan-result{margin-top:7px;font-size:8px;line-height:1.45;color:#94afa9;white-space:pre-wrap}
      @media(max-width:650px){#pcbpro-assistant-v115{right:5px;bottom:5px}.pa115-panel{width:calc(100vw - 10px);height:calc(100dvh - 75px);min-width:0;resize:none}.pa115-brand small{max-width:230px}}
    `;document.head.appendChild(s)
  }

  function projectSummary(){
    const b=window.PCBProAssistantBrain;const s=b?.projectSnapshot?.();if(!s)return null;
    const w=s.workflow;const next=w?.stages?.find(x=>x.id===w.next);const nextLabel=next?.label?.[(window.PCBProUX?.lang||'id')]||next?.label?.id||next?.id||w?.next||'—';
    return {view:s.view,selected:s.selected?.id||null,counts:s.counts,done:w?.done,total:w?.total,next:nextLabel,brain:b.snapshot?.()};
  }

  async function checkProvider(showMessage=false){
    const pill=root?.querySelector('[data-state="ai"]');
    if(pill){pill.textContent='AI CHECKING';pill.classList.remove('good','bad')}
    try{
      const r=await fetch('/api/assistant/status',{cache:'no-store'});
      const data=await r.json().catch(()=>({}));
      providerStatus={connected:!!data.connected,code:data.code||('HTTP_'+r.status),auth_source:data.auth_source||null,message:data.message||''};
    }catch(error){
      providerStatus={connected:false,code:'AI_STATUS_FAILED',auth_source:null,message:error?.message||String(error)};
    }
    if(pill){
      pill.textContent=providerStatus.connected?('AI ✓ '+(providerStatus.auth_source==='VERCEL_OIDC_TOKEN'?'OIDC':'KEY')):('AI ✕ '+providerStatus.code);
      pill.classList.toggle('good',!!providerStatus.connected);pill.classList.toggle('bad',providerStatus.connected===false);
      pill.title=providerStatus.connected?t('AI Gateway terhubung. Klik untuk cek ulang.','AI Gateway connected. Click to recheck.'):t('AI Gateway belum terhubung. Klik untuk cek ulang.','AI Gateway is not connected. Click to recheck.');
    }
    if(showMessage)addMessage('assistant',providerStatus.connected?t('AI Gateway terhubung lewat '+providerStatus.auth_source+'. Sekarang tombol “Tes AI nyata” bisa memaksa satu request LLM supaya lu bisa bedain jawaban LOCAL vs model.','AI Gateway is connected through '+providerStatus.auth_source+'. “Real AI test” can now force one LLM request so you can distinguish LOCAL from model output.'):t('AI Gateway belum terhubung: '+providerStatus.code+'. '+(providerStatus.message||''),'AI Gateway is not connected: '+providerStatus.code+'. '+(providerStatus.message||'')),{route:'ai-status',tier:'local'});
    return providerStatus;
  }

  async function forceAiTest(){
    const status=await checkProvider(false);
    if(!status.connected){
      addMessage('assistant',t('Tes AI dibatalkan karena provider belum connected: '+status.code+'. Ini bukan jawaban LLM.','AI test cancelled because the provider is not connected: '+status.code+'. This is not an LLM response.'),{route:'ai-status',tier:'local'});
      return;
    }
    const row=thinking();
    try{
      const result=await window.PCBProAssistantBrain?.forceModel?.(t('Tes koneksi AI nyata. Jawab singkat bahwa model terhubung, sebutkan model yang dipakai jika tersedia, lalu jelaskan satu kalimat fungsi DRC PCB.','Real AI connectivity test. Briefly confirm that the model is connected, name the model if available, then explain PCB DRC in one sentence.'),'fast');
      if(!result)throw new Error('Assistant Brain forceModel unavailable');
      replaceThinking(row,result.text,result.meta||{});
    }catch(error){
      replaceThinking(row,t('Tes AI gagal: '+(error?.message||error),'AI test failed: '+(error?.message||error)),{route:'ai-error',tier:'local'});
    }
  }

  function refreshContext(){
    if(!root)return;const box=root.querySelector('.pa115-context');if(!box)return;const s=projectSummary();
    if(!s){box.querySelector('.pa115-state').textContent=t('Assistant Brain sedang memuat context project.','Assistant Brain is loading project context.');return}
    box.querySelector('[data-state="view"]').textContent=`VIEW ${s.view||'—'}`;
    box.querySelector('[data-state="focus"]').textContent=s.selected?`FOCUS ${s.selected}`:'FOCUS —';
    box.querySelector('[data-state="workflow"]').textContent=s.done!=null?`FLOW ${s.done}/${s.total}`:'FLOW —';
    box.querySelector('.pa115-state').textContent=t(`Project aktif: ${s.counts.components} komponen · ${s.counts.nets} net · ${s.counts.wires} wire · ${s.counts.tracks} track. Next: ${s.next}.`,`Active project: ${s.counts.components} components · ${s.counts.nets} nets · ${s.counts.wires} wires · ${s.counts.tracks} tracks. Next: ${s.next}.`);
    const brain=window.PCBProAssistantBrain?.snapshot?.();const foot=root.querySelector('.pa115-foot span:first-child');if(foot&&brain)foot.textContent=`LIB ${brain.libraryChunks||0} · MEMORY ${brain.history?.length||0}/${12}`;
  }

  function metaHtml(meta={}){
    const tags=[];const route=String(meta.route||'').toUpperCase();const tier=String(meta.tier||'').toUpperCase();if(route)tags.push(`<span class="${meta.tier==='local'?'local':''}">${esc(route)}</span>`);if(tier)tags.push(`<span class="${meta.tier==='reason'?'reason':''}">${esc(tier)}</span>`);if(meta.libraryHits)tags.push(`<span>LIB ${meta.libraryHits}</span>`);if(meta.model)tags.push(`<span>${esc(meta.model)}</span>`);
    const u=meta.usage||{};const total=u.total_tokens??u.totalTokens;if(Number.isFinite(total))tags.push(`<span>TOK ${total}</span>`);return tags.join('')
  }

  function addMessage(role,text,meta={}){
    if(!root)return;session.push({role,text,meta,time:Date.now()});const log=root.querySelector('.pa115-log');const row=document.createElement('div');row.className=`pa115-msg ${role}`;row.innerHTML=`<div class="pa115-avatar">${role==='user'?'YOU':'AI'}</div><div class="pa115-bubble"><p>${esc(text)}</p>${role==='assistant'?`<div class="pa115-meta">${metaHtml(meta)}</div>`:''}</div>`;log.appendChild(row);log.scrollTop=log.scrollHeight;return row
  }

  function thinking(){const row=addMessage('assistant',t('Gue baca project + library dulu…','Reading project + library…'),{route:'routing'});row.classList.add('pa115-thinking');return row}
  function replaceThinking(row,text,meta){if(!row)return;row.classList.remove('pa115-thinking');row.querySelector('.pa115-bubble p').textContent=text;row.querySelector('.pa115-meta').innerHTML=metaHtml(meta);}
  function planBlock(plan){
    const p=window.PCBProCommandBus?.preview?.(plan);if(!p)return '';
    const items=(p.actions||[]).map(a=>`<li><b>${esc(a.command)}</b> — ${esc(a.label)} <small>[${esc(a.risk)} · ${esc(a.adapter)}]</small></li>`).join('');
    return `<div class="pa115-plan"><div class="pa115-plan-head"><b>${t('ACTION PLAN · BELUM DIJALANKAN','ACTION PLAN · NOT EXECUTED')}</b><span>${p.actions.length} ${t('aksi','actions')}</span></div><ol class="pa115-plan-list">${items}</ol><div class="pa115-plan-actions"><button data-run-plan>${t('Jalankan plan','Run plan')}</button><button class="secondary" data-cancel-plan>${t('Batal','Cancel')}</button></div><div class="pa115-plan-result"></div></div>`;
  }

  function attachPlan(row,plan){
    if(!row||!plan?.actions?.length)return;
    const bubble=row.querySelector('.pa115-bubble');bubble.insertAdjacentHTML('beforeend',planBlock(plan));
    const box=bubble.querySelector('.pa115-plan');if(!box)return;
    box.querySelector('[data-cancel-plan]').addEventListener('click',()=>{box.querySelector('.pa115-plan-actions').remove();box.querySelector('.pa115-plan-result').textContent=t('Plan dibatalkan. Project tidak diubah.','Plan cancelled. Project was not changed.')});
    box.querySelector('[data-run-plan]').addEventListener('click',async(e)=>{
      const btn=e.currentTarget;btn.disabled=true;box.querySelector('.pa115-plan-result').textContent=t('Validasi ulang + eksekusi…','Re-validating + executing…');
      const result=await window.PCBProCommandBus?.executePlan?.(plan,{atomic:true});
      if(!result){box.querySelector('.pa115-plan-result').textContent=t('Command Bus tidak tersedia.','Command Bus unavailable.');btn.disabled=false;return}
      const lines=(result.results||[]).map((r,i)=>`${i+1}. ${r.command}: ${r.ok?'OK':'FAILED'}${r.error?` — ${r.error}`:''}`).join('\n');
      box.querySelector('.pa115-plan-result').textContent=result.ok?t(`Plan selesai.\n${lines}`,`Plan completed.\n${lines}`):t(`Plan gagal${result.rolledBack?' dan rollback best-effort dijalankan':''}.\n${lines}\n${result.error||''}`,`Plan failed${result.rolledBack?' and best-effort rollback ran':''}.\n${lines}\n${result.error||''}`);
      box.querySelector('.pa115-plan-actions')?.remove();refreshContext();
      addMessage('assistant',result.ok?t('Gue sudah baca ulang state project setelah action plan. Cek Context/Next atau tanya hasilnya.','I re-read project state after the action plan. Check Context/Next or ask about the result.'):t('Plan tidak selesai bersih. Gue tidak akan menganggap perubahan sukses; lihat hasil command di atas.','The plan did not finish cleanly. I will not treat the change as successful; see the command results above.'),{route:'command-result',tier:'local'});
    });
  }

  async function submit(raw){
    const q=clean(raw);if(!q||sending)return;sending=true;addMessage('user',q);const waitRow=thinking();const send=root.querySelector('.pa115-send');if(send)send.disabled=true;
    try{
      const brain=window.PCBProAssistantBrain;if(!brain)throw new Error('Assistant Brain belum dimuat');const result=await brain.ask(q);replaceThinking(waitRow,result.text||t('Tidak ada jawaban.','No answer.'),result.meta||{});if(result.plan)attachPlan(waitRow,result.plan);refreshContext();
    }catch(e){replaceThinking(waitRow,t(`Assistant error: ${e.message}`,`Assistant error: ${e.message}`),{route:'error',tier:'local'})}
    finally{sending=false;if(send)send.disabled=false;root.querySelector('.pa115-input textarea')?.focus()}
  }

  function explainSelected(){
    const s=window.PCBProAssistantBrain?.projectSnapshot?.();if(s?.selected)return submit(t(`Jelaskan ${s.selected.id} yang lagi gue pilih: fungsi, koneksi, data yang diketahui, risiko, dan langkah berikutnya.`,`Explain selected ${s.selected.id}: function, connectivity, known data, risks, and next step.`));
    return submit(t('Jelaskan view yang lagi gue buka dan apa yang seharusnya gue kerjain di sini.','Explain the current view and what I should work on here.'))
  }

  function mount(){
    if(root)return;installStyles();document.querySelector('#pcbpro-jarvis')?.remove();
    root=document.createElement('div');root.id='pcbpro-assistant-v115';root.innerHTML=`
      <button class="pa115-launch hidden" title="PCB Pro AI Assistant">AI</button>
      <section class="pa115-panel">
        <header class="pa115-head"><div class="pa115-orb">AI</div><div class="pa115-brand"><b>PCB Pro Engineering Assistant</b><small>AI ENGINEERING AGENT · TYPED COMMANDS + PREVIEW + RAG + MEMORY + LLM · v${VERSION}</small></div><button class="pa115-memory" title="${t('Reset working memory','Reset working memory')}">MEM</button><button class="close">×</button></header>
        <section class="pa115-context"><div class="pa115-context-top"><span class="pa115-pill good" data-state="view">VIEW —</span><span class="pa115-pill" data-state="focus">FOCUS —</span><span class="pa115-pill" data-state="workflow">FLOW —</span><button class="pa115-pill" data-state="ai" type="button">AI CHECKING</button></div><div class="pa115-state"></div><div class="pa115-chips"><button data-q="${t('Gue lagi ngapain sekarang?','What am I working on now?')}">${t('Context','Context')}</button><button data-q="${t('Apa langkah selanjutnya dari project ini?','What is the next step for this project?')}">${t('Next','Next')}</button><button data-q="${t('Analisa project aktif dan kasih masalah paling penting dulu.','Analyze the active project and prioritize the most important issue.')}">${t('Audit AI','AI Audit')}</button><button data-selected>${t('Jelaskan pilihan','Explain selected')}</button><button data-q="${t('Cek wiring dan netlist project ini. Jangan nebak koneksi yang tidak ada.','Check this project wiring and netlist. Do not guess missing connections.')}">Wiring</button><button data-ai-test>${t('Tes AI nyata','Real AI test')}</button></div></section>
        <main class="pa115-log"></main>
        <footer class="pa115-compose"><div class="pa115-input"><textarea placeholder="${t('Ngomong normal aja: apa yang lagi gue kerjain, kenapa DRC ini muncul, sambung mana, komponen ini cocok gak, bantu benerin…','Ask naturally: what am I working on, why did this DRC appear, what connects where, is this part suitable, help me fix it…')}"></textarea><button class="pa115-send">${t('Kirim','Send')}</button></div><div class="pa115-foot"><span>LIB — · MEMORY —</span><span>${t('TOOLS → LIBRARY → LLM → PREVIEW → EXECUTE','LOCAL first → RAG → LLM when needed')}</span></div></footer>
      </section>`;document.body.appendChild(root);
    const panel=root.querySelector('.pa115-panel'),launch=root.querySelector('.pa115-launch');root.querySelector('.close').addEventListener('click',()=>{open=false;panel.classList.add('hidden');launch.classList.remove('hidden')});launch.addEventListener('click',()=>{open=true;panel.classList.remove('hidden');launch.classList.add('hidden');refreshContext()});
    root.querySelector('.pa115-memory').addEventListener('click',()=>{window.PCBProAssistantBrain?.resetMemory?.();addMessage('assistant',t('Working memory assistant di-reset. Project design tidak diubah.','Assistant working memory reset. Project design was not changed.'),{route:'local',tier:'local'});refreshContext()});
    root.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>submit(b.dataset.q)));root.querySelector('[data-selected]').addEventListener('click',explainSelected);
    root.querySelector('[data-state="ai"]')?.addEventListener('click',()=>checkProvider(true));
    root.querySelector('[data-ai-test]')?.addEventListener('click',forceAiTest);
    const ta=root.querySelector('textarea');root.querySelector('.pa115-send').addEventListener('click',()=>{const q=ta.value;ta.value='';submit(q)});ta.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();const q=ta.value;ta.value='';submit(q)}});
    addMessage('assistant',t('Gue sekarang punya action planner + typed command bus. Gue baca project, cari library, pakai LLM buat reasoning/planning kalau perlu, lalu untuk aksi kompleks gue kasih preview yang harus lu jalankan—bukan pura-pura bilang sudah berubah.','I now have an action planner plus typed command bus. I read the project, retrieve local knowledge, use the LLM for reasoning/planning when needed, and show a validated preview before complex actions execute.'),{route:'boot',tier:'local'});
    refreshContext();checkProvider(false);const obs=new MutationObserver(()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(refreshContext,160)});obs.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-pcb-view']});window.addEventListener('pcbpro:language',refreshContext)
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
  window.PCBProAssistantV115={version:VERSION,ask:submit,refresh:refreshContext,checkProvider,forceAiTest,open(){root?.querySelector('.pa115-launch')?.click()},get session(){return session.slice()}};
  window.PCBProAssistant={version:VERSION,ask:submit,refresh:refreshContext,checkProvider,forceAiTest,open(){root?.querySelector('.pa115-launch')?.click()},get history(){return session.slice()}};
})();
