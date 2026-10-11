(() => {
  'use strict';
  if(window.PCBProHarnessV131)return;
  const VERSION='1.31.0', KEY='pcbpro0045-harness-v131';
  const ROLE=['power_out','power_in','ground','signal_out','signal_in','bidirectional','passive','shield'];
  const MODES=['power','ground','signal','data','shield'];
  const STATES=['untested','pass','fail','needs_retest'];
  const MAX_TERMINALS=300, MAX_WIRES=300;
  const clone=x=>structuredClone(x);
  const validText=(s,max=160)=>typeof s==='string'&&s.length<=max;
  const safeId=x=>typeof x==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,23}$/.test(x)&&!['constructor','prototype','__proto__'].includes(x.toLowerCase());
  const valueOK=(n,min,max)=>n===null||(typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max);
  const fresh=()=>({version:VERSION,terminals:[],wires:[],notes:''});
  const safeDeviceIds=(project)=>new Set((project?.devices||[]).map(x=>x.id));
  function validate(value){
    const errors=[],bad=(field,message)=>errors.push({field,message});
    if(!value||typeof value!=='object'||Array.isArray(value))return {ok:false,errors:[{field:'harness',message:'Invalid wiring plan'}]};
    if(!Array.isArray(value.terminals)||value.terminals.length>MAX_TERMINALS)bad('terminals','Maximum 300 terminals');
    if(!Array.isArray(value.wires)||value.wires.length>MAX_WIRES)bad('wires','Maximum 300 wires');
    if(!validText(value.notes,4000))bad('notes','Notes must be under 4000 chars');
    const ids=new Set(),names=new Set();
    for(const [i,t] of (Array.isArray(value.terminals)?value.terminals:[]).entries()){
      const f='terminals.'+i+'.';
      if(!t||typeof t!=='object'){bad(f,'Terminal must be object');continue;}
      if(!safeId(t.id)||ids.has(t.id))bad(f+'id','Invalid/duplicate terminal id');
      ids.add(t.id);
      if(!safeId(t.deviceId))bad(f+'deviceId','Invalid module ID');
      if(!validText(t.name,70)||!t.name.trim())bad(f+'name','Terminal name required');
      const nameKey=String(t.deviceId).toLowerCase()+'.'+String(t.name).trim().toLowerCase();
      if(names.has(nameKey))bad(f+'name','Duplicate physical terminal within module');
      names.add(nameKey);
      if(!ROLE.includes(t.role))bad(f+'role','Unsupported terminal role');
      if(!valueOK(t.nominalV,0,120))bad(f+'nominalV','Terminal voltage must be 0-120 V DC or unknown');
      if(!validText(t.notes,450))bad(f+'notes','Notes too long');
    }
    const wireIds=new Set();
    for(const [i,w] of (Array.isArray(value.wires)?value.wires:[]).entries()){
      const f='wires.'+i+'.';
      if(!w||typeof w!=='object'){bad(f,'Wire must be object');continue;}
      if(!safeId(w.id)||wireIds.has(w.id))bad(f+'id','Invalid/duplicate wire id');
      wireIds.add(w.id);
      if(!safeId(w.from)||!safeId(w.to))bad(f+'endpoint','Invalid terminal IDs');
      if(!MODES.includes(w.mode))bad(f+'mode','Unsupported connection type');
      if(!validText(w.net,100)||!w.net.trim())bad(f+'net','Named net/connection required');
      if(!validText(w.color,36))bad(f+'color','Wire color must be plain text');
      if(!validText(w.gauge,32))bad(f+'gauge','Wire gauge field too long');
      if(!valueOK(w.lengthCm,0,100000))bad(f+'lengthCm','Wire length must be 0-100000 cm or unknown');
      if(!STATES.includes(w.testStatus))bad(f+'testStatus','Unknown test state');
      if(!validText(w.testNote,500))bad(f+'testNote','Test observation too long');
      if(w.testStatus==='pass'&&String(w.testNote||'').trim().length<12)
        bad(f+'testNote','Passed continuity requires written observed evidence (>=12 chars)');
      if(!validText(w.notes,450))bad(f+'notes','Wire notes too long');
    }
    return {ok:errors.length===0,errors};
  }
  function validateForBlueprint(plan,blueprint){
    const form=validate(plan);
    if(!form.ok)return {ok:false,blockers:form.errors.map(x=>({code:'INVALID_DATA',ref:x.field,message:x.message})),warnings:[],summary:{wires:0,passed:0,failed:0,untested:0}};
    const blockers=[],warnings=[];
    const err=(code,ref,message)=>blockers.push({code,ref,message});
    const warn=(code,ref,message)=>warnings.push({code,ref,message});
    const modules=safeDeviceIds(blueprint);
    const terminalById=new Map();
    for(const t of plan.terminals){
      terminalById.set(t.id,t);
      if(!modules.has(t.deviceId))err('ORPHAN_MODULE',t.id,'Terminal refers to module removed from Builder: '+t.deviceId);
    }
    const netForTerminal=new Map(),pairs=new Map();
    for(const w of plan.wires){
      const a=terminalById.get(w.from),b=terminalById.get(w.to);
      if(!a||!b){err('MISSING_TERMINAL',w.id,'Wire points to a missing terminal');continue;}
      if(w.from===w.to||a.deviceId===b.deviceId)err('LOCAL_LOOP',w.id,'Wire endpoints refer to the same terminal or same module; inspect manually');
      const key=[w.from,w.to].sort().join('|');
      if(pairs.has(key))err('DUPLICATE_WIRE',w.id,'Duplicate connection also exists as '+pairs.get(key));
      pairs.set(key,w.id);
      const roles=[a.role,b.role];
      if(roles.includes('power_out')&&roles.includes('ground')||
         roles.includes('power_in')&&roles.includes('ground'))
        err('POWER_TO_GROUND',w.id,'A power terminal is directly tied to a ground terminal in this logical wire');
      if(roles.every(x=>x==='power_out'))err('TWO_POWER_SOURCES',w.id,'Two power-source outputs directly joined');
      if(roles.every(x=>x==='signal_out'))err('TWO_SIGNAL_DRIVERS',w.id,'Two signal outputs connected together');
      if(roles.every(x=>x==='power_in'))warn('NO_POWER_SOURCE',w.id,'Power-input terminals have no source on this connection');
      if(w.mode==='ground'&&!roles.every(x=>x==='ground'||x==='passive'))
        warn('GROUND_ROLE_MISMATCH',w.id,'Named ground route includes a terminal not defined as ground/passive');
      if(w.mode==='power'&&!roles.some(x=>x==='power_out')&&!roles.some(x=>x==='passive'))
        warn('POWER_SOURCE_NOT_IDENTIFIED',w.id,'Power wire has no declared source terminal');
      if(w.mode==='signal'&&roles.some(x=>x==='power_out'||x==='power_in'))
        warn('SIGNAL_ROLE_MISMATCH',w.id,'Signal route includes a power-type terminal');
      if(w.mode==='data'&&roles.some(x=>x==='power_in'||x==='power_out'))
        warn('DATA_ROLE_MISMATCH',w.id,'Data bus route includes a power-type terminal');
      if(a.nominalV!==null&&b.nominalV!==null&&
        Math.abs(a.nominalV-b.nominalV)>0.05&&
        !roles.includes('ground')&&
        (w.mode==='power'||w.mode==='signal'||w.mode==='data'))
        err('VOLTAGE_MISMATCH',w.id,'Declared terminal voltages differ ('+a.nominalV+' V vs '+b.nominalV+' V); verify level shifting/regulator');
      for(const t of [a,b]){
        const existing=netForTerminal.get(t.id)||new Set();existing.add(w.net.trim().toUpperCase());
        netForTerminal.set(t.id,existing);
      }
      if(w.testStatus==='fail')err('CONTINUITY_FAILED',w.id,'A real-world test is recorded as FAIL: '+(w.testNote||'no observation'));
      if(w.testStatus==='untested')warn('NOT_TESTED',w.id,'Continuity verification has not been recorded');
      if(w.testStatus==='needs_retest')warn('RETEST_REQUIRED',w.id,'Wire changed and requires continuity re-test');
      if(!w.gauge.trim())warn('GAUGE_NOT_DEFINED',w.id,'Conductor size is not defined; no ampacity evaluation is possible');
      if(w.lengthCm===null)warn('LENGTH_NOT_DEFINED',w.id,'Physical wire length is unknown; drop/length cannot be evaluated');
    }
    for(const [id,names] of netForTerminal)
      if(names.size>1)err('TERMINAL_ON_MULTIPLE_NETS',id,'Same physical terminal assigned to different nets: '+[...names].join(', '));
    if(plan.wires.length===0)warn('NO_WIRING','project','No logical wires entered yet');
    warn('ELECTRICAL_SIGNOFF_NOT_PROVEN','project','No automatic calculation of ampacity, voltage drop, crimp/connector rating, insulation, fusing, EMC, IEC/PUIL/IPC compliance or physical workmanship');
    const counts={wires:plan.wires.length,passed:plan.wires.filter(x=>x.testStatus==='pass').length,
      failed:plan.wires.filter(x=>x.testStatus==='fail').length,untested:plan.wires.filter(x=>x.testStatus==='untested'||x.testStatus==='needs_retest').length};
    return {ok:true,version:VERSION,scope:'low-voltage-logical-wiring-only',
      blockers,warnings,summary:counts,
      verdict:blockers.length?'BLOCKED':counts.untested?'REVIEW_UNTESTED':'LOGIC_REVIEW_ONLY_NOT_CERTIFIED',
      coverage:{physicalTestsUserRecorded:counts.passed,independentlyVerified:false,wireAmpacityCalculated:false,pcbNetlistLinked:false}};
  }
  let state=fresh(),loadIssue='';
  function snapshot(){return clone(state);}
  function restore(value){
    const v=validate(value);
    if(!v.ok)throw Error(v.errors.map(x=>x.field+': '+x.message).join('; ').slice(0,900));
    localStorage.setItem(KEY,JSON.stringify(value));
    state=clone(value);
    window.dispatchEvent(new CustomEvent('pcbpro:harness-changed',{detail:{wires:state.wires.length}}));
    return snapshot();
  }
  function mutate(update){const next=snapshot();update(next);return restore(next);}
  const idFor=(prefix,rows)=>{let i=1;while(rows.some(x=>x.id===prefix+i))i++;return prefix+i;};
  function addTerminal(deviceId){
    if(!safeDeviceIds(window.PCBProSystemArchitect?.snapshot?.()).has(deviceId))
      throw Error('Choose an existing Builder module first');
    return mutate(p=>p.terminals.push({id:idFor('T',p.terminals),deviceId,
      name:'PIN_'+String(p.terminals.length+1),role:'passive',nominalV:null,notes:''}));
  }
  function updateTerminal(id,key,value){
    if(!['deviceId','name','role','nominalV','notes'].includes(key))throw Error('Unknown terminal field');
    return mutate(p=>{
      const t=p.terminals.find(x=>x.id===id);if(!t)throw Error('Terminal not found');t[key]=value;
      for(const w of p.wires)if(w.from===id||w.to===id){w.testStatus='needs_retest';w.testNote='';}
    });
  }
  function removeTerminal(id){
    return mutate(p=>{p.terminals=p.terminals.filter(x=>x.id!==id);
      p.wires=p.wires.filter(w=>w.from!==id&&w.to!==id);});
  }
  function addWire(from,to){
    const p=snapshot(),ids=new Set(p.terminals.map(t=>t.id));
    if(!ids.has(from)||!ids.has(to)||from===to)throw Error('Choose two different existing terminals');
    const id=idFor('W',p.wires);
    p.wires.push({id,from,to,net:'NET_'+id,mode:'signal',gauge:'',color:'',
      lengthCm:null,testStatus:'untested',testNote:'',notes:''});
    return restore(p);
  }
  function updateWire(id,key,value){
    if(!['from','to','net','mode','gauge','color','lengthCm','testStatus','testNote','notes'].includes(key))
      throw Error('Unknown wire field');
    return mutate(p=>{const w=p.wires.find(x=>x.id===id);if(!w)throw Error('Wire not found');
      w[key]=value;
      if(!['testStatus','testNote'].includes(key)){w.testStatus='needs_retest';w.testNote='';}
    });
  }
  function recordTest(id,status,note){
    if(!STATES.includes(status))throw Error('Unknown status');
    return mutate(p=>{const w=p.wires.find(x=>x.id===id);if(!w)throw Error('Wire not found');
      w.testStatus=status;w.testNote=note;});
  }
  function removeWire(id){return mutate(p=>{p.wires=p.wires.filter(x=>x.id!==id);});}
  function load(){
    try{
      const raw=localStorage.getItem(KEY);
      if(!raw)return;
      const p=JSON.parse(raw);
      if(validate(p).ok)state=p;
      else loadIssue='Wiring plan lama tidak valid; data tidak dihapus.';
    }catch{loadIssue='Wiring plan lokal tidak bisa dibaca; data tidak dihapus.';}
  }
  function csv(plan=state){
    const byId=new Map(plan.terminals.map(t=>[t.id,t]));
    const cols=['Wire ID','Net','Jenis','Modul A','Terminal A','Modul B','Terminal B','Ukuran konduktor','Warna','Panjang cm','Hasil tes','Bukti tes','Catatan'];
    const rows=[cols,...plan.wires.map(w=>{
      const a=byId.get(w.from),b=byId.get(w.to);
      return [w.id,w.net,w.mode,a?.deviceId??'',a?.name??'',b?.deviceId??'',b?.name??'',w.gauge,w.color,w.lengthCm??'',w.testStatus,w.testNote,w.notes];
    })];
    const cell=v=>{let s=String(v??'');if(/^[=+@\t\r-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    return '\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
  }
  function download(name,contents,type){
    const blob=new Blob([contents],{type}),url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=name;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1800);
  }
  function exportCSV(){download('sirkuitlab-wire-schedule.csv',csv(),'text/csv;charset=utf-8');}
  function exportJSON(){download('sirkuitlab-harness-review.json',
    JSON.stringify({format:'sirkuitlab-harness-plan',version:VERSION,plan:snapshot(),
      report:validateForBlueprint(state,window.PCBProSystemArchitect?.snapshot?.())},null,2),'application/json');}
  function reset(){return restore(fresh());}
  window.PCBProHarnessV131={version:VERSION,blank:fresh,validate,validateForBlueprint,
    snapshot,restore,addTerminal,updateTerminal,removeTerminal,addWire,updateWire,recordTest,
    removeWire,reset,csv,exportCSV,exportJSON,get loadIssue(){return loadIssue;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});
  else load();
})();