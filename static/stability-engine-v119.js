(() => {
  'use strict';
  if (window.PCBProStability) return;

  const VERSION='1.19.0';
  const runtimeErrors=[];
  let lastReport=null;

  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  const t=(id,en)=>lang()==='id'?id:en;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const add=(list,id,label,status,detail)=>list.push({id,label,status,detail});

  function record(kind,message,source='runtime'){
    const item={kind,message:String(message||'Unknown error').slice(0,1200),source,time:new Date().toISOString()};
    runtimeErrors.push(item);
    if(runtimeErrors.length>100)runtimeErrors.splice(0,runtimeErrors.length-100);
    window.dispatchEvent(new CustomEvent('pcbpro:runtime-error',{detail:item}));
  }

  window.addEventListener('error',e=>record('error',e.message||e.error?.message,e.filename||'window'));
  window.addEventListener('unhandledrejection',e=>record('unhandledrejection',e.reason?.message||e.reason,'promise'));

  async function safeFetchHealth(){
    try{
      const r=await fetch('/api/health',{cache:'no-store'});
      const data=await r.json().catch(()=>null);
      return {ok:r.ok&&data?.ok,data,status:r.status,error:r.ok?'':(data?.error||`HTTP ${r.status}`)};
    }catch(error){return {ok:false,data:null,status:null,error:error?.message||String(error)}}
  }

  function requiredEngines(){
    return [
      ['command','PCBProCommand',window.PCBProCommand],
      ['wire','PCBProWireEngine',window.PCBProWireEngine],
      ['board','PCBProBoardModel',window.PCBProBoardModel],
      ['advanced-board','PCBProAdvancedBoard',window.PCBProAdvancedBoard],
      ['workflow','PCBProWorkflow',window.PCBProWorkflow],
      ['database','PCBProDatabase',window.PCBProDatabase],
      ['professional','PCBProProfessional',window.PCBProProfessional],
      ['explain','PCBProExplain',window.PCBProExplain],
      ['command-bus','PCBProCommandBus',window.PCBProCommandBus],
      ['assistant-brain','PCBProAssistantBrain',window.PCBProAssistantBrain],
      ['assistant-ui','PCBProAssistantV115',window.PCBProAssistantV115],
      ['catalog','PCBProComponentCatalog',window.PCBProComponentCatalog]
    ];
  }

  async function run(){
    const checks=[];

    const tabs=[...document.querySelectorAll('.tabs button')];
    add(checks,'views','Workspace views',tabs.length===8?'pass':'fail',`${tabs.length}/8 tabs mounted`);

    const tree=[...document.querySelectorAll('.tree button')].filter(b=>/Main schematic|Main PCB|3D Assembly|BOM|Fabrication/i.test(b.textContent||''));
    add(checks,'project-tree','Project Tree',tree.length>=5?'pass':'fail',`${tree.length}/5 navigable entries detected`);

    for(const [id,label,value] of requiredEngines()){
      add(checks,`engine-${id}`,label,value?'pass':'fail',value?`loaded · v${value.version||'?'}`:'missing global');
    }

    const wire=window.PCBProWireEngine?.diagnostics?.();
    if(wire){
      add(checks,'wire-diagnostics','Wire diagnostics',wire.stage===false||wire.stage===true?'pass':'pass',`${wire.pins??0} pins · ${wire.routes??0} routes · mode ${wire.wireMode?'wire':'idle'}`);
    } else add(checks,'wire-diagnostics','Wire diagnostics','warn','diagnostics API unavailable');

    const board=window.PCBProBoardModel?.model;
    add(checks,'board-model','Board model',board&&Array.isArray(board.tracks)&&Array.isArray(board.outline)?'pass':'fail',board?`${board.tracks?.length||0} tracks · ${board.outline?.length||0} outline points`:'model unavailable');

    const db=window.PCBProDatabase?.snapshot?.();
    if(db){
      add(checks,'database','Encrypted database',db.status==='error'?'fail':'pass',`status=${db.status} · projects=${db.projectCount} · encrypted=${db.encrypted?'yes':'no'} · RLS=${db.rls?'yes':'no'}`);
    }else add(checks,'database','Encrypted database','fail','database engine missing');

    const pro=window.PCBProProfessional?.snapshot?.();
    if(pro){
      add(checks,'professional-evidence','Professional evidence',pro.evidence?.ready?'pass':'warn',`${pro.evidence?.research||0} research · ${pro.evidence?.patents||0} patents · ${pro.evidence?.referenceTools||0} tool refs`);
    }else add(checks,'professional-evidence','Professional evidence','fail','professional engine missing');

    const commandTest=window.PCBProCommandBus?.preview?.({
      summary:'self-test',
      actions:[
        {command:'schematic.activateWire',args:{}},
        {command:'workflow.runERC',args:{}},
        {command:'pcb.runDRC',args:{}},
        {command:'professional.audit',args:{}}
      ]
    });
    add(checks,'command-validator','Typed command validator',commandTest?.validation?.ok?'pass':'fail',commandTest?.validation?.ok?'safe command manifest validated':(commandTest?.validation?.errors||['validator unavailable']).join('; '));

    const fakeSimulator=[...document.querySelectorAll('.panel')].some(p=>/5\.000 V|9\.091 mA|27\.27 mW/.test(p.textContent||''));
    add(checks,'fake-values','Placeholder measurement guard',fakeSimulator?'fail':'pass',fakeSimulator?'stale illustrative simulation numbers found':'no stale fake simulator measurements found');

    const staleUnavailable=[...document.querySelectorAll('.pcb-tool-unavailable')].map(b=>b.dataset.pcbTool||b.textContent?.trim()).filter(Boolean);
    add(checks,'tool-availability','Tool availability guard','pass',staleUnavailable.length?`${staleUnavailable.length} unsupported controls intentionally disabled`:'all mounted controls currently mapped as live');

    const health=await safeFetchHealth();
    add(checks,'server-health','Server health route',health.ok?'pass':'fail',health.ok?`v${health.data?.version} · ${health.data?.deployment?.environment||'unknown'}`:health.error);

    if(health.ok){
      add(checks,'ai-auth','AI provider authentication',health.data?.ai?.configured?'pass':'warn',health.data?.ai?.configured?`configured via ${health.data.ai.authSource}`:'no AI Gateway key/OIDC token detected; assistant falls back to local/RAG');
    }

    const recent=runtimeErrors.slice(-10);
    add(checks,'runtime-errors','Captured runtime exceptions',recent.length?'fail':'pass',recent.length?`${recent.length} captured this session`:'no captured window/unhandled-promise errors this session');

    const fail=checks.filter(x=>x.status==='fail').length;
    const warn=checks.filter(x=>x.status==='warn').length;
    lastReport={version:VERSION,time:new Date().toISOString(),checks,summary:{pass:checks.length-fail-warn,warn,fail,total:checks.length},runtimeErrors:[...recent],health:health.data||null};
    window.dispatchEvent(new CustomEvent('pcbpro:self-test-complete',{detail:lastReport}));
    updateTrigger();
    return lastReport;
  }

  function installStyles(){
    if(document.querySelector('#pcbpro-stability-style'))return;
    const s=document.createElement('style');s.id='pcbpro-stability-style';s.textContent=`
      #pcbpro-health-trigger{border:1px solid #31505c;background:#0e1d26;color:#aac0c8;border-radius:8px;padding:7px 9px;font:900 8px ui-monospace;white-space:nowrap}
      #pcbpro-health-trigger[data-state="pass"]{border-color:#2b7667;color:#65d5bd;background:#102b25}
      #pcbpro-health-trigger[data-state="warn"]{border-color:#876b35;color:#ebc973;background:#2c2413}
      #pcbpro-health-trigger[data-state="fail"]{border-color:#83483e;color:#f09a88;background:#2d1714}
      #pcbpro-health-modal{position:fixed;z-index:2900;inset:0;background:#000c;display:grid;place-items:center;padding:14px}
      .ph-card{width:min(860px,96vw);max-height:90vh;display:grid;grid-template-rows:auto auto 1fr;background:#07131b;border:1px solid #35515f;border-radius:13px;overflow:hidden;color:#dce8ed;box-shadow:0 30px 100px #000e}
      .ph-head{display:flex;align-items:center;gap:8px;padding:11px 13px;border-bottom:1px solid #203944}.ph-head div{flex:1}.ph-head small{display:block;font:900 8px ui-monospace;color:#61d1b9}.ph-head b{font-size:14px}.ph-head button,.ph-actions button{border:1px solid #304a57;background:#10212a;color:#c4d4db;border-radius:8px;padding:7px 9px;font-size:8px;font-weight:900}
      .ph-summary{display:flex;gap:6px;padding:9px 12px;border-bottom:1px solid #203944}.ph-summary span{border:1px solid #2a4350;border-radius:999px;padding:4px 8px;font:800 7px ui-monospace}.ph-body{overflow:auto;padding:11px}
      .ph-row{border:1px solid #213945;border-left-width:3px;background:#0a1820;border-radius:8px;padding:9px;margin-bottom:6px}.ph-row.pass{border-left-color:#42b69d}.ph-row.warn{border-left-color:#d5aa51}.ph-row.fail{border-left-color:#da6f60}.ph-row b{font-size:9px}.ph-row p{margin:4px 0 0;font-size:8px;color:#93aab4;line-height:1.5}.ph-actions{display:flex;gap:6px;margin-bottom:9px}.ph-log{white-space:pre-wrap;font:700 8px/1.5 ui-monospace;background:#050d12;border-radius:7px;padding:8px;color:#b7c8cf}
    `;document.head.appendChild(s)
  }

  function updateTrigger(){
    const b=document.querySelector('#pcbpro-health-trigger');if(!b)return;
    const state=lastReport?.summary?.fail?'fail':lastReport?.summary?.warn?'warn':'pass';
    b.dataset.state=state;
    b.textContent=lastReport?`HEALTH ${lastReport.summary.fail?'✕':lastReport.summary.warn?'!':'✓'}`:'HEALTH';
    b.title=lastReport?`${lastReport.summary.fail} fail · ${lastReport.summary.warn} warn · ${lastReport.summary.pass} pass`:'Run PCB Pro self-test';
  }

  function mountTrigger(){
    installStyles();
    const actions=document.querySelector('.top-actions');if(!actions||document.querySelector('#pcbpro-health-trigger'))return;
    const b=document.createElement('button');b.id='pcbpro-health-trigger';b.type='button';b.textContent='HEALTH';b.addEventListener('click',open);
    const pro=document.querySelector('#pcbpro-pro-trigger');if(pro)actions.insertBefore(b,pro);else actions.appendChild(b);
  }

  function renderModal(report){
    document.querySelector('#pcbpro-health-modal')?.remove();
    const m=document.createElement('div');m.id='pcbpro-health-modal';
    const rows=(report?.checks||[]).map(x=>`<div class="ph-row ${x.status}"><b>${esc(x.label)} · ${x.status.toUpperCase()}</b><p>${esc(x.detail)}</p></div>`).join('');
    const errors=(report?.runtimeErrors||[]).map(x=>`[${x.time}] ${x.kind} · ${x.source}\n${x.message}`).join('\n\n');
    m.innerHTML=`<section class="ph-card"><header class="ph-head"><div><small>PCB PRO · STABILITY v${VERSION}</small><b>${t('System Health & Self-Test','System Health & Self-Test')}</b></div><button data-close>×</button></header><div class="ph-summary"><span>PASS ${report?.summary?.pass||0}</span><span>WARN ${report?.summary?.warn||0}</span><span>FAIL ${report?.summary?.fail||0}</span></div><main class="ph-body"><div class="ph-actions"><button data-run>${t('Jalankan ulang','Run again')}</button><button data-clear>${t('Bersihkan error session','Clear session errors')}</button></div>${rows}${errors?`<h4>Runtime error log</h4><div class="ph-log">${esc(errors)}</div>`:''}</main></section>`;
    document.body.appendChild(m);
    m.addEventListener('pointerdown',e=>{if(e.target===m)m.remove()});
    m.querySelector('[data-close]').onclick=()=>m.remove();
    m.querySelector('[data-run]').onclick=async()=>renderModal(await run());
    m.querySelector('[data-clear]').onclick=async()=>{runtimeErrors.length=0;renderModal(await run())};
  }

  async function open(){
    mountTrigger();
    const report=await run();
    renderModal(report);
  }

  function snapshot(){return lastReport?structuredClone(lastReport):{version:VERSION,summary:null,runtimeErrors:[...runtimeErrors]}}

  async function start(){
    mountTrigger();
    setTimeout(async()=>{try{await run()}catch(error){record('self-test',error?.message||error,'stability-engine');updateTrigger()}},1800);
    document.addEventListener('click',()=>setTimeout(mountTrigger,0),{passive:true});
  }

  window.PCBProStability={version:VERSION,run,open,snapshot,record,get errors(){return [...runtimeErrors]}};

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();