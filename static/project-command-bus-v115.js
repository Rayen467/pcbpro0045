(() => {
  'use strict';
  if (window.PCBProCommandBus) return;

  const VERSION='1.15.0';
  const MAX_ACTIONS=12;
  let seq=0;
  const listeners=new Set();

  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  const t=(id,en)=>lang()==='id'?id:en;
  const clean=v=>String(v??'').trim().replace(/\s+/g,' ');
  const clone=v=>{try{return structuredClone(v)}catch{return JSON.parse(JSON.stringify(v))}};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));

  const VIEW_ALIASES={
    schematic:['schematic','skematik'],pcb:['pcb'],simulator:['simulator','simulasi'], '3d':['3d'],
    bom:['bom'],fabrication:['fabrication','fabrikasi'],rules:['rules','aturan'],release:['release','rilis']
  };

  function activeView(){
    const b=document.querySelector('.tabs button.active,[role="tab"][aria-selected="true"]');
    return clean(b?.dataset?.pcbView||b?.textContent||'Workspace');
  }
  function clickView(view){
    const key=String(view||'').toLowerCase();
    const aliases=VIEW_ALIASES[key]||[key];
    const tab=[...document.querySelectorAll('.tabs button,[role="tab"]')].find(b=>{
      const x=clean(b.dataset?.pcbView||b.textContent).toLowerCase();
      return aliases.includes(x);
    });
    if(!tab)return false;
    tab.click();
    return true;
  }
  function componentNode(ref){
    const wanted=String(ref||'').toUpperCase();
    return [...document.querySelectorAll('.stage.schematic .node,.node')].find(n=>clean(n.querySelector('.ref')?.textContent).toUpperCase()===wanted)||null;
  }
  function componentValue(ref){
    const n=componentNode(ref);
    return clean(n?.querySelector('b')?.textContent);
  }
  async function ensureView(view){
    const a=VIEW_ALIASES[String(view||'').toLowerCase()]||[String(view||'').toLowerCase()];
    if(a.includes(activeView().toLowerCase()))return true;
    if(!clickView(view))return false;
    await wait(80);
    return true;
  }
  async function selectComponent(ref){
    if(!await ensureView('schematic'))return false;
    const node=componentNode(ref); if(!node)return false;
    node.click(); await wait(50); return true;
  }
  async function setComponentValue(ref,value){
    if(!await selectComponent(ref))return {ok:false,error:`${ref} not found`};
    const inspector=document.querySelector('.inspector');
    const label=[...inspector?.querySelectorAll('label')||[]].find(l=>/value/i.test(clean(l.querySelector('span')?.textContent)));
    const input=label?.querySelector('input');
    if(!input)return {ok:false,error:'Value field unavailable'};
    const old=input.value;
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
    setter?.call(input,String(value));
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    await wait(80);
    return {ok:true,old,newValue:String(value),undo:async()=>{await selectComponent(ref);setter?.call(input,old);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}};
  }
  async function ensureWireReady(){
    if(!await ensureView('schematic'))return false;
    window.PCBProWireEngine?.refresh?.(0); await wait(70);
    return Boolean(window.PCBProWireEngine?.connectPins);
  }
  function routeBetween(from,to){
    return (window.PCBProWireEngine?.routes||[]).find(r=>(r.from===from&&r.to===to)||(r.from===to&&r.to===from))||null;
  }
  async function connectPins(from,to,corners=[]){
    if(!await ensureWireReady())return {ok:false,error:'Wire engine unavailable'};
    const before=(window.PCBProWireEngine?.routes||[]).map(r=>r.id);
    const ok=window.PCBProWireEngine.connectPins(String(from),String(to),Array.isArray(corners)?corners:[]);
    await wait(40);
    const after=window.PCBProWireEngine?.routes||[];
    const created=after.find(r=>!before.includes(r.id));
    if(!ok&&!routeBetween(from,to))return {ok:false,error:`Cannot connect ${from} to ${to}; verify exact pins exist`};
    return {ok:true,wireId:created?.id||routeBetween(from,to)?.id||null,alreadyExisted:!created,undo:created?async()=>window.PCBProProject?.deleteWire?.(created.id):null};
  }
  async function disconnectWire(args){
    if(!await ensureWireReady())return {ok:false,error:'Wire engine unavailable'};
    let route=args.wireId?(window.PCBProWireEngine?.routes||[]).find(r=>r.id===args.wireId):routeBetween(args.from,args.to);
    if(!route)return {ok:false,error:'Wire not found'};
    const saved=clone(route);
    const ok=window.PCBProProject?.deleteWire?.(route.id);
    await wait(40);
    return {ok:Boolean(ok),wireId:route.id,undo:ok?async()=>window.PCBProWireEngine?.connectPins?.(saved.from,saved.to,saved.corners||[]):null};
  }
  async function runErc(){
    const w=window.PCBProWorkflow;
    if(typeof w?.runErc!=='function')return {ok:false,error:'ERC engine unavailable'};
    const findings=w.runErc()||[];
    return {ok:true,findings:Array.isArray(findings)?findings:findings?.findings||findings};
  }
  async function runDrc(){
    if(!await ensureView('pcb'))return {ok:false,error:'PCB view unavailable'};
    await wait(70);
    const basic=typeof window.PCBProBoardModel?.drc==='function'?window.PCBProBoardModel.drc():[];
    const advanced=typeof window.PCBProAdvancedBoard?.drc==='function'?window.PCBProAdvancedBoard.drc():[];
    return {ok:true,findings:[...(Array.isArray(basic)?basic:[]),...(Array.isArray(advanced)?advanced:[])]};
  }
  async function simulator(action){
    if(!await ensureView('simulator'))return {ok:false,error:'Simulator view unavailable'};
    for(let i=0;i<20&&!window.PCBProLiveSimulation;i++)await wait(80);
    const s=window.PCBProLiveSimulation;
    if(!s)return {ok:false,error:'Live simulator not loaded'};
    if(action==='run')s.start?.();
    if(action==='pause')s.pause?.();
    if(action==='reset')s.reset?.();
    if(action==='step')s.solveOnce?.();
    await wait(30);
    return {ok:true,running:Boolean(s.running),lastResult:s.lastResult||null};
  }
  function explainOpen(){
    if(!window.PCBProExplain?.open)return {ok:false,error:'Explanation Center unavailable'};
    window.PCBProExplain.open(null,'overview'); return {ok:true};
  }

  const COMMANDS={
    'navigate.view':{
      risk:'low', adapter:'workspace',
      schema:{required:['view'],properties:{view:{type:'string',enum:Object.keys(VIEW_ALIASES)}}},
      describe:a=>t(`Buka view ${a.view}.`,`Open ${a.view} view.`),
      execute:async a=>({ok:clickView(a.view),view:a.view})
    },
    'schematic.activateWire':{
      risk:'low',adapter:'workspace',
      schema:{properties:{}},
      describe:()=>t('Aktifkan tool Wire pada schematic.','Activate the Wire tool on the schematic.'),
      execute:async()=>{if(!await ensureView('schematic'))return {ok:false,error:'Schematic view unavailable'};const b=[...document.querySelectorAll('.tools button')].find(x=>/^(wire|kabel)$/i.test(clean(x.dataset?.pcbTool||x.querySelector('small')?.textContent||x.textContent)));if(!b)return {ok:false,error:'Wire tool unavailable'};b.click();await wait(30);return {ok:true,mode:'wire'};}
    },
    'component.select':{
      risk:'low',adapter:'ui-bridge',
      schema:{required:['ref'],properties:{ref:{type:'string',pattern:'^[A-Za-z]+\\d+$'}}},
      describe:a=>t(`Pilih komponen ${a.ref}.`,`Select component ${a.ref}.`),
      execute:async a=>({ok:await selectComponent(a.ref),ref:String(a.ref).toUpperCase()})
    },
    'component.setValue':{
      risk:'medium',adapter:'ui-bridge',
      schema:{required:['ref','value'],properties:{ref:{type:'string',pattern:'^[A-Za-z]+\\d+$'},value:{type:'string',minLength:1}}},
      describe:a=>t(`Ubah ${a.ref} menjadi ${a.value}.`,`Set ${a.ref} to ${a.value}.`),
      execute:a=>setComponentValue(a.ref,a.value)
    },
    'schematic.connect':{
      risk:'medium',adapter:'wire-api',
      schema:{required:['from','to'],properties:{from:{type:'string',pattern:'^[A-Za-z]+\\d+\\.\\d+$'},to:{type:'string',pattern:'^[A-Za-z]+\\d+\\.\\d+$'},corners:{type:'array'}}},
      describe:a=>t(`Sambungkan pin ${a.from} → ${a.to}.`,`Connect pin ${a.from} → ${a.to}.`),
      execute:a=>connectPins(a.from,a.to,a.corners||[])
    },
    'schematic.disconnect':{
      risk:'medium',adapter:'wire-api',
      schema:{properties:{wireId:{type:'string'},from:{type:'string'},to:{type:'string'}},oneOf:[['wireId'],['from','to']]},
      describe:a=>t(`Putuskan wire ${a.wireId||`${a.from} ↔ ${a.to}`}.`,`Disconnect wire ${a.wireId||`${a.from} ↔ ${a.to}`}.`),
      execute:disconnectWire
    },
    'schematic.clearWires':{
      risk:'high',adapter:'wire-api',
      schema:{properties:{}},
      describe:()=>t('Hapus semua wire schematic.','Delete all schematic wires.'),
      execute:async()=>{const old=window.PCBProWireEngine?.routes||[];window.PCBProWireEngine?.clear?.();return {ok:true,removed:old.length,undo:async()=>{for(const r of old)window.PCBProWireEngine?.connectPins?.(r.from,r.to,r.corners||[])}}}
    },
    'workflow.runERC':{
      risk:'low',adapter:'workflow-api',schema:{properties:{}},
      describe:()=>t('Jalankan ERC pada project aktif.','Run ERC on the active project.'),execute:runErc
    },
    'pcb.setLayer':{
      risk:'low',adapter:'board-api',
      schema:{required:['layer'],properties:{layer:{type:'string',enum:['f.cu','b.cu']}}},
      describe:a=>t(`Set active copper layer ke ${a.layer}.`,`Set active copper layer to ${a.layer}.`),
      execute:async a=>{if(!await ensureView('pcb'))return {ok:false,error:'PCB view unavailable'};await wait(60);return window.PCBProBoardModel?.setActiveLayer?.(a.layer==='f.cu'?'F.Cu':a.layer==='b.cu'?'B.Cu':a.layer)||{ok:false,error:'Board layer API unavailable'}}
    },
    'pcb.route':{
      risk:'medium',adapter:'board-api',
      schema:{required:['from','to'],properties:{from:{type:'string',pattern:'^[A-Za-z]+\\d+\\.\\d+
      risk:'low',adapter:'board-api',schema:{properties:{}},
      describe:()=>t('Jalankan DRC yang tersedia pada board aktif.','Run the available DRC on the active board.'),execute:runDrc
    },
    'simulation.run':{
      risk:'low',adapter:'simulation-api',schema:{properties:{}},
      describe:()=>t('Jalankan Live Circuit simulator.','Run the Live Circuit simulator.'),execute:()=>simulator('run')
    },
    'simulation.pause':{
      risk:'low',adapter:'simulation-api',schema:{properties:{}},
      describe:()=>t('Pause Live Circuit simulator.','Pause the Live Circuit simulator.'),execute:()=>simulator('pause')
    },
    'simulation.step':{
      risk:'low',adapter:'simulation-api',schema:{properties:{}},
      describe:()=>t('Jalankan satu solve step.','Run one solve step.'),execute:()=>simulator('step')
    },
    'simulation.reset':{
      risk:'medium',adapter:'simulation-api',schema:{properties:{}},
      describe:()=>t('Reset state Live Circuit simulator.','Reset Live Circuit simulator state.'),execute:()=>simulator('reset')
    },
    'explain.open':{
      risk:'low',adapter:'explain-api',schema:{properties:{}},
      describe:()=>t('Buka Explanation Center.','Open the Explanation Center.'),execute:async()=>explainOpen()
    }
  };

  function validateArgs(schema,args){
    const errors=[]; const a=args&&typeof args==='object'?args:{};
    for(const k of schema.required||[])if(a[k]===undefined||a[k]===null||a[k]==='')errors.push(`Missing ${k}`);
    if(schema.oneOf&&!schema.oneOf.some(group=>group.every(k=>a[k]!==undefined&&a[k]!==null&&a[k]!=='')))errors.push(`Need one of: ${schema.oneOf.map(x=>x.join('+')).join(' or ')}`);
    for(const [k,r] of Object.entries(schema.properties||{})){
      if(a[k]===undefined)continue; const v=a[k];
      if(r.type==='string'&&typeof v!=='string')errors.push(`${k} must be string`);
      if(r.type==='array'&&!Array.isArray(v))errors.push(`${k} must be array`);
      if(r.enum&&!r.enum.includes(String(v).toLowerCase()))errors.push(`${k} must be one of ${r.enum.join(', ')}`);
      if(r.pattern&&typeof v==='string'&&!new RegExp(r.pattern).test(v))errors.push(`${k} invalid format`);
      if(r.minLength&&String(v).length<r.minLength)errors.push(`${k} is empty`);
    }
    return errors;
  }
  function validateAction(action){
    const cmd=COMMANDS[action?.command];
    if(!cmd)return {ok:false,errors:[`Unknown command: ${action?.command||'—'}`]};
    const errors=validateArgs(cmd.schema,action.args||{});
    return {ok:!errors.length,errors,risk:cmd.risk,adapter:cmd.adapter};
  }
  function validatePlan(plan){
    const actions=Array.isArray(plan?.actions)?plan.actions:[];
    const errors=[];
    if(!actions.length)errors.push('Plan has no actions');
    if(actions.length>MAX_ACTIONS)errors.push(`Plan exceeds ${MAX_ACTIONS} actions`);
    const checks=actions.map((a,i)=>{const r=validateAction(a);if(!r.ok)errors.push(...r.errors.map(e=>`#${i+1} ${e}`));return r});
    return {ok:!errors.length,errors,checks};
  }
  function preview(plan){
    const validation=validatePlan(plan);
    return {
      id:plan?.id||`P${Date.now()}_${++seq}`,
      summary:clean(plan?.summary||plan?.intent||''),
      validation,
      actions:(plan?.actions||[]).map((a,i)=>({
        index:i,command:a.command,args:clone(a.args||{}),why:clean(a.why||''),
        risk:COMMANDS[a.command]?.risk||'unknown',adapter:COMMANDS[a.command]?.adapter||'unknown',
        label:COMMANDS[a.command]?.describe?.(a.args||{})||a.command
      })),
      requiresConfirmation:(plan?.actions||[]).some(a=>['medium','high'].includes(COMMANDS[a.command]?.risk))
    };
  }
  async function execute(command,args={},options={}){
    const spec=COMMANDS[command];
    if(!spec)return {ok:false,command,error:`Unknown command: ${command}`};
    const validation=validateAction({command,args});
    if(!validation.ok)return {ok:false,command,error:validation.errors.join('; ')};
    const before={view:activeView(),wireCount:window.PCBProWireEngine?.routes?.length??null};
    try{
      const raw=await spec.execute(args,options); const result=raw&&typeof raw==='object'?raw:{ok:Boolean(raw)};
      const undo=result.undo; const publicResult={...result}; delete publicResult.undo;
      const event={id:`C${Date.now()}_${++seq}`,command,args:clone(args),ok:result.ok!==false,risk:spec.risk,adapter:spec.adapter,before,after:{view:activeView(),wireCount:window.PCBProWireEngine?.routes?.length??null},result:clone(publicResult),time:new Date().toISOString()};
      window.dispatchEvent(new CustomEvent('pcbpro:command-executed',{detail:event})); listeners.forEach(fn=>{try{fn(event)}catch{}});
      return {...event,_undo:typeof undo==='function'?undo:null};
    }catch(error){
      return {ok:false,command,args:clone(args),risk:spec.risk,adapter:spec.adapter,error:error?.message||String(error)};
    }
  }
  async function executePlan(plan,{atomic=true}={}){
    const p=preview(plan); if(!p.validation.ok)return {ok:false,plan:p,results:[],error:p.validation.errors.join('; ')};
    const results=[]; const undos=[];
    for(const action of plan.actions){
      const r=await execute(action.command,action.args||{});
      results.push({...r,_undo:undefined});
      if(r._undo)undos.push(r._undo);
      if(!r.ok){
        if(atomic){for(const undo of undos.reverse()){try{await undo()}catch{}}}
        return {ok:false,rolledBack:Boolean(atomic&&undos.length),plan:p,results,error:r.error||`${action.command} failed`};
      }
    }
    window.PCBProWorkflow?.refresh?.();
    window.PCBProAssistantV115?.refresh?.();
    return {ok:true,plan:p,results};
  }
  function manifest(){
    return Object.fromEntries(Object.entries(COMMANDS).map(([name,c])=>[name,{risk:c.risk,adapter:c.adapter,schema:clone(c.schema),description:c.describe?.({view:'pcb',ref:'R1',value:'1 kΩ',from:'R1.1',to:'C1.1'})||name}]));
  }
  async function planFromAI(query,context,retrieval=[]){
    const body={query:clean(query),context,commands:manifest(),retrieval:(retrieval||[]).slice(0,5).map(x=>({source:x.source,id:x.id,title:x.title,text:String(x.text||'').slice(0,1200)}))};
    const r=await fetch('/api/assistant-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data?.error||`Planner HTTP ${r.status}`);
    if(data?.plan?.actions?.length){data.plan.id=data.plan.id||`AI${Date.now()}_${++seq}`;data.plan.source='llm-planner';data.plan.preview=preview(data.plan)}
    return data;
  }
  function on(fn){listeners.add(fn);return()=>listeners.delete(fn)}

  const existing=window.PCBProProject||{};
  window.PCBProProject=Object.assign(existing,{
    command:(input,args)=>typeof input==='string'?execute(input,args||{}):execute(input?.type||input?.command,input?.args||input),
    executePlan,
    commandManifest:manifest
  });

  window.PCBProCommandBus={version:VERSION,manifest,validateAction,validatePlan,preview,execute,executePlan,planFromAI,on,get activeView(){return activeView()}};

  window.PCBProExplain?.register?.({
    id:'feature.command-bus-v115',match:['command bus','typed command','action plan','preview action'],category:'assistant-action',status:'active',
    title:{id:'Typed Project Command Bus',en:'Typed Project Command Bus'},
    what:{id:'Lapisan command terstruktur antara AI dan project. AI tidak menekan DOM secara bebas; ia memilih command yang ada di manifest lalu command divalidasi.',en:'Structured command layer between AI and the project. AI does not freely poke the DOM; it selects commands from a manifest and each command is validated.'},
    why:{id:'Supaya aksi AI bisa dipreview, divalidasi, diaudit, dan gagal secara eksplisit daripada pura-pura berhasil.',en:'So AI actions can be previewed, validated, audited, and fail explicitly instead of pretending success.'},
    input:{id:'Command name + typed args atau action plan dari AI planner.',en:'Command name plus typed args or an AI-planner action plan.'},
    process:{id:'Validate schema → preview risk/adapter → user confirmation untuk plan → execute berurutan → rollback best-effort bila plan atomic gagal.',en:'Validate schema → preview risk/adapter → user confirmation for plans → sequential execution → best-effort rollback if an atomic plan fails.'},
    output:{id:'Result per command + event audit pcbpro:command-executed.',en:'Per-command result plus pcbpro:command-executed audit event.'},
    how_to_read:{id:'adapter wire/workflow/board/simulation memakai engine API; ui-bridge menandakan masih ada legacy UI adapter dan belum source-of-truth API murni.',en:'wire/workflow/board/simulation adapters use engine APIs; ui-bridge marks a legacy UI adapter that is not yet a pure source-of-truth API.'},
    limits:{id:'PCB route pad-to-pad sekarang punya typed command dasar; via/zone/keepout geometry belum diekspos sebagai typed mutation command penuh dan assistant tidak boleh mengarang geometry yang belum didukung.',en:'Basic pad-to-pad PCB routing now has a typed command; via/zone/keepout geometry is not yet fully exposed as typed mutation commands and the assistant must not invent unsupported geometry.'},
    next:{id:'Gunakan AI plan untuk wiring/component/workflow/check/simulation sekarang; perluas board geometry API berikutnya untuk via/zone/keepout dan geometry rules yang lebih lengkap.',en:'Use AI plans for wiring/component/workflow/check/simulation now; extend the board geometry API next for via/zone/keepout and richer geometry rules.'}
  });
})();},to:{type:'string',pattern:'^[A-Za-z]+\\d+\\.\\d+
      risk:'low',adapter:'board-api',schema:{properties:{}},
      describe:()=>t('Jalankan DRC yang tersedia pada board aktif.','Run the available DRC on the active board.'),execute:runDrc
    },
    'simulation.run':{
      risk:'low',adapter:'simulation-api',schema:{properties:{}},
      describe:()=>t('Jalankan Live Circuit simulator.','Run the Live Circuit simulator.'),execute:()=>simulator('run')
    },
    'simulation.pause':{
      risk:'low',adapter:'simulation-api',schema:{properties:{}},
      describe:()=>t('Pause Live Circuit simulator.','Pause the Live Circuit simulator.'),execute:()=>simulator('pause')
    },
    'simulation.step':{
      risk:'low',adapter:'simulation-api',schema:{properties:{}},
      describe:()=>t('Jalankan satu solve step.','Run one solve step.'),execute:()=>simulator('step')
    },
    'simulation.reset':{
      risk:'medium',adapter:'simulation-api',schema:{properties:{}},
      describe:()=>t('Reset state Live Circuit simulator.','Reset Live Circuit simulator state.'),execute:()=>simulator('reset')
    },
    'explain.open':{
      risk:'low',adapter:'explain-api',schema:{properties:{}},
      describe:()=>t('Buka Explanation Center.','Open the Explanation Center.'),execute:async()=>explainOpen()
    }
  };

  function validateArgs(schema,args){
    const errors=[]; const a=args&&typeof args==='object'?args:{};
    for(const k of schema.required||[])if(a[k]===undefined||a[k]===null||a[k]==='')errors.push(`Missing ${k}`);
    if(schema.oneOf&&!schema.oneOf.some(group=>group.every(k=>a[k]!==undefined&&a[k]!==null&&a[k]!=='')))errors.push(`Need one of: ${schema.oneOf.map(x=>x.join('+')).join(' or ')}`);
    for(const [k,r] of Object.entries(schema.properties||{})){
      if(a[k]===undefined)continue; const v=a[k];
      if(r.type==='string'&&typeof v!=='string')errors.push(`${k} must be string`);
      if(r.type==='array'&&!Array.isArray(v))errors.push(`${k} must be array`);
      if(r.enum&&!r.enum.includes(String(v).toLowerCase()))errors.push(`${k} must be one of ${r.enum.join(', ')}`);
      if(r.pattern&&typeof v==='string'&&!new RegExp(r.pattern).test(v))errors.push(`${k} invalid format`);
      if(r.minLength&&String(v).length<r.minLength)errors.push(`${k} is empty`);
    }
    return errors;
  }
  function validateAction(action){
    const cmd=COMMANDS[action?.command];
    if(!cmd)return {ok:false,errors:[`Unknown command: ${action?.command||'—'}`]};
    const errors=validateArgs(cmd.schema,action.args||{});
    return {ok:!errors.length,errors,risk:cmd.risk,adapter:cmd.adapter};
  }
  function validatePlan(plan){
    const actions=Array.isArray(plan?.actions)?plan.actions:[];
    const errors=[];
    if(!actions.length)errors.push('Plan has no actions');
    if(actions.length>MAX_ACTIONS)errors.push(`Plan exceeds ${MAX_ACTIONS} actions`);
    const checks=actions.map((a,i)=>{const r=validateAction(a);if(!r.ok)errors.push(...r.errors.map(e=>`#${i+1} ${e}`));return r});
    return {ok:!errors.length,errors,checks};
  }
  function preview(plan){
    const validation=validatePlan(plan);
    return {
      id:plan?.id||`P${Date.now()}_${++seq}`,
      summary:clean(plan?.summary||plan?.intent||''),
      validation,
      actions:(plan?.actions||[]).map((a,i)=>({
        index:i,command:a.command,args:clone(a.args||{}),why:clean(a.why||''),
        risk:COMMANDS[a.command]?.risk||'unknown',adapter:COMMANDS[a.command]?.adapter||'unknown',
        label:COMMANDS[a.command]?.describe?.(a.args||{})||a.command
      })),
      requiresConfirmation:(plan?.actions||[]).some(a=>['medium','high'].includes(COMMANDS[a.command]?.risk))
    };
  }
  async function execute(command,args={},options={}){
    const spec=COMMANDS[command];
    if(!spec)return {ok:false,command,error:`Unknown command: ${command}`};
    const validation=validateAction({command,args});
    if(!validation.ok)return {ok:false,command,error:validation.errors.join('; ')};
    const before={view:activeView(),wireCount:window.PCBProWireEngine?.routes?.length??null};
    try{
      const raw=await spec.execute(args,options); const result=raw&&typeof raw==='object'?raw:{ok:Boolean(raw)};
      const undo=result.undo; const publicResult={...result}; delete publicResult.undo;
      const event={id:`C${Date.now()}_${++seq}`,command,args:clone(args),ok:result.ok!==false,risk:spec.risk,adapter:spec.adapter,before,after:{view:activeView(),wireCount:window.PCBProWireEngine?.routes?.length??null},result:clone(publicResult),time:new Date().toISOString()};
      window.dispatchEvent(new CustomEvent('pcbpro:command-executed',{detail:event})); listeners.forEach(fn=>{try{fn(event)}catch{}});
      return {...event,_undo:typeof undo==='function'?undo:null};
    }catch(error){
      return {ok:false,command,args:clone(args),risk:spec.risk,adapter:spec.adapter,error:error?.message||String(error)};
    }
  }
  async function executePlan(plan,{atomic=true}={}){
    const p=preview(plan); if(!p.validation.ok)return {ok:false,plan:p,results:[],error:p.validation.errors.join('; ')};
    const results=[]; const undos=[];
    for(const action of plan.actions){
      const r=await execute(action.command,action.args||{});
      results.push({...r,_undo:undefined});
      if(r._undo)undos.push(r._undo);
      if(!r.ok){
        if(atomic){for(const undo of undos.reverse()){try{await undo()}catch{}}}
        return {ok:false,rolledBack:Boolean(atomic&&undos.length),plan:p,results,error:r.error||`${action.command} failed`};
      }
    }
    window.PCBProWorkflow?.refresh?.();
    window.PCBProAssistantV115?.refresh?.();
    return {ok:true,plan:p,results};
  }
  function manifest(){
    return Object.fromEntries(Object.entries(COMMANDS).map(([name,c])=>[name,{risk:c.risk,adapter:c.adapter,schema:clone(c.schema),description:c.describe?.({view:'pcb',ref:'R1',value:'1 kΩ',from:'R1.1',to:'C1.1'})||name}]));
  }
  async function planFromAI(query,context,retrieval=[]){
    const body={query:clean(query),context,commands:manifest(),retrieval:(retrieval||[]).slice(0,5).map(x=>({source:x.source,id:x.id,title:x.title,text:String(x.text||'').slice(0,1200)}))};
    const r=await fetch('/api/assistant-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data?.error||`Planner HTTP ${r.status}`);
    if(data?.plan?.actions?.length){data.plan.id=data.plan.id||`AI${Date.now()}_${++seq}`;data.plan.source='llm-planner';data.plan.preview=preview(data.plan)}
    return data;
  }
  function on(fn){listeners.add(fn);return()=>listeners.delete(fn)}

  const existing=window.PCBProProject||{};
  window.PCBProProject=Object.assign(existing,{
    command:(input,args)=>typeof input==='string'?execute(input,args||{}):execute(input?.type||input?.command,input?.args||input),
    executePlan,
    commandManifest:manifest
  });

  window.PCBProCommandBus={version:VERSION,manifest,validateAction,validatePlan,preview,execute,executePlan,planFromAI,on,get activeView(){return activeView()}};

  window.PCBProExplain?.register?.({
    id:'feature.command-bus-v115',match:['command bus','typed command','action plan','preview action'],category:'assistant-action',status:'active',
    title:{id:'Typed Project Command Bus',en:'Typed Project Command Bus'},
    what:{id:'Lapisan command terstruktur antara AI dan project. AI tidak menekan DOM secara bebas; ia memilih command yang ada di manifest lalu command divalidasi.',en:'Structured command layer between AI and the project. AI does not freely poke the DOM; it selects commands from a manifest and each command is validated.'},
    why:{id:'Supaya aksi AI bisa dipreview, divalidasi, diaudit, dan gagal secara eksplisit daripada pura-pura berhasil.',en:'So AI actions can be previewed, validated, audited, and fail explicitly instead of pretending success.'},
    input:{id:'Command name + typed args atau action plan dari AI planner.',en:'Command name plus typed args or an AI-planner action plan.'},
    process:{id:'Validate schema → preview risk/adapter → user confirmation untuk plan → execute berurutan → rollback best-effort bila plan atomic gagal.',en:'Validate schema → preview risk/adapter → user confirmation for plans → sequential execution → best-effort rollback if an atomic plan fails.'},
    output:{id:'Result per command + event audit pcbpro:command-executed.',en:'Per-command result plus pcbpro:command-executed audit event.'},
    how_to_read:{id:'adapter wire/workflow/board/simulation memakai engine API; ui-bridge menandakan masih ada legacy UI adapter dan belum source-of-truth API murni.',en:'wire/workflow/board/simulation adapters use engine APIs; ui-bridge marks a legacy UI adapter that is not yet a pure source-of-truth API.'},
    limits:{id:'PCB route/via/zone geometry belum diekspos sebagai typed mutation command di v1.15; assistant tidak boleh mengarang route fisik bila command-nya belum ada.',en:'PCB route/via/zone geometry is not yet exposed as a typed mutation command in v1.15; the assistant must not invent physical routes when no command exists.'},
    next:{id:'Gunakan AI plan untuk wiring/component/workflow/check/simulation sekarang; perluas board geometry API untuk route/via/zone setelah source-of-truth mutation endpoint tersedia.',en:'Use AI plans for wiring/component/workflow/check/simulation now; extend the board geometry API for route/via/zone once source-of-truth mutation endpoints exist.'}
  });
})();},layer:{type:'string',enum:['f.cu','b.cu']},widthMm:{type:'number'},corners:{type:'array'}}},
      describe:a=>t(`Route copper ${a.from} → ${a.to}${a.layer?` di ${a.layer}`:''}.`,`Route copper ${a.from} → ${a.to}${a.layer?` on ${a.layer}`:''}.`),
      execute:async a=>{if(!await ensureView('pcb'))return {ok:false,error:'PCB view unavailable'};await wait(80);const layer=a.layer==='f.cu'?'F.Cu':a.layer==='b.cu'?'B.Cu':a.layer;const r=window.PCBProBoardModel?.routePins?.(a.from,a.to,{layer,widthMm:a.widthMm,corners:a.corners});if(!r)return {ok:false,error:'Typed PCB route API unavailable'};return {...r,undo:r.ok&&!r.alreadyExisted&&r.track?.id?async()=>window.PCBProBoardModel?.deleteTrack?.(r.track.id):null}}
    },
    'pcb.runDRC':{
      risk:'low',adapter:'board-api',schema:{properties:{}},
      describe:()=>t('Jalankan DRC yang tersedia pada board aktif.','Run the available DRC on the active board.'),execute:runDrc
    },
    'simulation.run':{
      risk:'low',adapter:'simulation-api',schema:{properties:{}},
      describe:()=>t('Jalankan Live Circuit simulator.','Run the Live Circuit simulator.'),execute:()=>simulator('run')
    },
    'simulation.pause':{
      risk:'low',adapter:'simulation-api',schema:{properties:{}},
      describe:()=>t('Pause Live Circuit simulator.','Pause the Live Circuit simulator.'),execute:()=>simulator('pause')
    },
    'simulation.step':{
      risk:'low',adapter:'simulation-api',schema:{properties:{}},
      describe:()=>t('Jalankan satu solve step.','Run one solve step.'),execute:()=>simulator('step')
    },
    'simulation.reset':{
      risk:'medium',adapter:'simulation-api',schema:{properties:{}},
      describe:()=>t('Reset state Live Circuit simulator.','Reset Live Circuit simulator state.'),execute:()=>simulator('reset')
    },
    'explain.open':{
      risk:'low',adapter:'explain-api',schema:{properties:{}},
      describe:()=>t('Buka Explanation Center.','Open the Explanation Center.'),execute:async()=>explainOpen()
    }
  };

  function validateArgs(schema,args){
    const errors=[]; const a=args&&typeof args==='object'?args:{};
    for(const k of schema.required||[])if(a[k]===undefined||a[k]===null||a[k]==='')errors.push(`Missing ${k}`);
    if(schema.oneOf&&!schema.oneOf.some(group=>group.every(k=>a[k]!==undefined&&a[k]!==null&&a[k]!=='')))errors.push(`Need one of: ${schema.oneOf.map(x=>x.join('+')).join(' or ')}`);
    for(const [k,r] of Object.entries(schema.properties||{})){
      if(a[k]===undefined)continue; const v=a[k];
      if(r.type==='string'&&typeof v!=='string')errors.push(`${k} must be string`);
      if(r.type==='array'&&!Array.isArray(v))errors.push(`${k} must be array`);
      if(r.enum&&!r.enum.includes(String(v).toLowerCase()))errors.push(`${k} must be one of ${r.enum.join(', ')}`);
      if(r.pattern&&typeof v==='string'&&!new RegExp(r.pattern).test(v))errors.push(`${k} invalid format`);
      if(r.minLength&&String(v).length<r.minLength)errors.push(`${k} is empty`);
    }
    return errors;
  }
  function validateAction(action){
    const cmd=COMMANDS[action?.command];
    if(!cmd)return {ok:false,errors:[`Unknown command: ${action?.command||'—'}`]};
    const errors=validateArgs(cmd.schema,action.args||{});
    return {ok:!errors.length,errors,risk:cmd.risk,adapter:cmd.adapter};
  }
  function validatePlan(plan){
    const actions=Array.isArray(plan?.actions)?plan.actions:[];
    const errors=[];
    if(!actions.length)errors.push('Plan has no actions');
    if(actions.length>MAX_ACTIONS)errors.push(`Plan exceeds ${MAX_ACTIONS} actions`);
    const checks=actions.map((a,i)=>{const r=validateAction(a);if(!r.ok)errors.push(...r.errors.map(e=>`#${i+1} ${e}`));return r});
    return {ok:!errors.length,errors,checks};
  }
  function preview(plan){
    const validation=validatePlan(plan);
    return {
      id:plan?.id||`P${Date.now()}_${++seq}`,
      summary:clean(plan?.summary||plan?.intent||''),
      validation,
      actions:(plan?.actions||[]).map((a,i)=>({
        index:i,command:a.command,args:clone(a.args||{}),why:clean(a.why||''),
        risk:COMMANDS[a.command]?.risk||'unknown',adapter:COMMANDS[a.command]?.adapter||'unknown',
        label:COMMANDS[a.command]?.describe?.(a.args||{})||a.command
      })),
      requiresConfirmation:(plan?.actions||[]).some(a=>['medium','high'].includes(COMMANDS[a.command]?.risk))
    };
  }
  async function execute(command,args={},options={}){
    const spec=COMMANDS[command];
    if(!spec)return {ok:false,command,error:`Unknown command: ${command}`};
    const validation=validateAction({command,args});
    if(!validation.ok)return {ok:false,command,error:validation.errors.join('; ')};
    const before={view:activeView(),wireCount:window.PCBProWireEngine?.routes?.length??null};
    try{
      const raw=await spec.execute(args,options); const result=raw&&typeof raw==='object'?raw:{ok:Boolean(raw)};
      const undo=result.undo; const publicResult={...result}; delete publicResult.undo;
      const event={id:`C${Date.now()}_${++seq}`,command,args:clone(args),ok:result.ok!==false,risk:spec.risk,adapter:spec.adapter,before,after:{view:activeView(),wireCount:window.PCBProWireEngine?.routes?.length??null},result:clone(publicResult),time:new Date().toISOString()};
      window.dispatchEvent(new CustomEvent('pcbpro:command-executed',{detail:event})); listeners.forEach(fn=>{try{fn(event)}catch{}});
      return {...event,_undo:typeof undo==='function'?undo:null};
    }catch(error){
      return {ok:false,command,args:clone(args),risk:spec.risk,adapter:spec.adapter,error:error?.message||String(error)};
    }
  }
  async function executePlan(plan,{atomic=true}={}){
    const p=preview(plan); if(!p.validation.ok)return {ok:false,plan:p,results:[],error:p.validation.errors.join('; ')};
    const results=[]; const undos=[];
    for(const action of plan.actions){
      const r=await execute(action.command,action.args||{});
      results.push({...r,_undo:undefined});
      if(r._undo)undos.push(r._undo);
      if(!r.ok){
        if(atomic){for(const undo of undos.reverse()){try{await undo()}catch{}}}
        return {ok:false,rolledBack:Boolean(atomic&&undos.length),plan:p,results,error:r.error||`${action.command} failed`};
      }
    }
    window.PCBProWorkflow?.refresh?.();
    window.PCBProAssistantV115?.refresh?.();
    return {ok:true,plan:p,results};
  }
  function manifest(){
    return Object.fromEntries(Object.entries(COMMANDS).map(([name,c])=>[name,{risk:c.risk,adapter:c.adapter,schema:clone(c.schema),description:c.describe?.({view:'pcb',ref:'R1',value:'1 kΩ',from:'R1.1',to:'C1.1'})||name}]));
  }
  async function planFromAI(query,context,retrieval=[]){
    const body={query:clean(query),context,commands:manifest(),retrieval:(retrieval||[]).slice(0,5).map(x=>({source:x.source,id:x.id,title:x.title,text:String(x.text||'').slice(0,1200)}))};
    const r=await fetch('/api/assistant-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data?.error||`Planner HTTP ${r.status}`);
    if(data?.plan?.actions?.length){data.plan.id=data.plan.id||`AI${Date.now()}_${++seq}`;data.plan.source='llm-planner';data.plan.preview=preview(data.plan)}
    return data;
  }
  function on(fn){listeners.add(fn);return()=>listeners.delete(fn)}

  const existing=window.PCBProProject||{};
  window.PCBProProject=Object.assign(existing,{
    command:(input,args)=>typeof input==='string'?execute(input,args||{}):execute(input?.type||input?.command,input?.args||input),
    executePlan,
    commandManifest:manifest
  });

  window.PCBProCommandBus={version:VERSION,manifest,validateAction,validatePlan,preview,execute,executePlan,planFromAI,on,get activeView(){return activeView()}};

  window.PCBProExplain?.register?.({
    id:'feature.command-bus-v115',match:['command bus','typed command','action plan','preview action'],category:'assistant-action',status:'active',
    title:{id:'Typed Project Command Bus',en:'Typed Project Command Bus'},
    what:{id:'Lapisan command terstruktur antara AI dan project. AI tidak menekan DOM secara bebas; ia memilih command yang ada di manifest lalu command divalidasi.',en:'Structured command layer between AI and the project. AI does not freely poke the DOM; it selects commands from a manifest and each command is validated.'},
    why:{id:'Supaya aksi AI bisa dipreview, divalidasi, diaudit, dan gagal secara eksplisit daripada pura-pura berhasil.',en:'So AI actions can be previewed, validated, audited, and fail explicitly instead of pretending success.'},
    input:{id:'Command name + typed args atau action plan dari AI planner.',en:'Command name plus typed args or an AI-planner action plan.'},
    process:{id:'Validate schema → preview risk/adapter → user confirmation untuk plan → execute berurutan → rollback best-effort bila plan atomic gagal.',en:'Validate schema → preview risk/adapter → user confirmation for plans → sequential execution → best-effort rollback if an atomic plan fails.'},
    output:{id:'Result per command + event audit pcbpro:command-executed.',en:'Per-command result plus pcbpro:command-executed audit event.'},
    how_to_read:{id:'adapter wire/workflow/board/simulation memakai engine API; ui-bridge menandakan masih ada legacy UI adapter dan belum source-of-truth API murni.',en:'wire/workflow/board/simulation adapters use engine APIs; ui-bridge marks a legacy UI adapter that is not yet a pure source-of-truth API.'},
    limits:{id:'PCB route/via/zone geometry belum diekspos sebagai typed mutation command di v1.15; assistant tidak boleh mengarang route fisik bila command-nya belum ada.',en:'PCB route/via/zone geometry is not yet exposed as a typed mutation command in v1.15; the assistant must not invent physical routes when no command exists.'},
    next:{id:'Gunakan AI plan untuk wiring/component/workflow/check/simulation sekarang; perluas board geometry API untuk route/via/zone setelah source-of-truth mutation endpoint tersedia.',en:'Use AI plans for wiring/component/workflow/check/simulation now; extend the board geometry API for route/via/zone once source-of-truth mutation endpoints exist.'}
  });
})();