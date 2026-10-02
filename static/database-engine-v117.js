(() => {
  'use strict';
  if (window.PCBProDatabase) return;

  const VERSION='1.20.0';
  const SUPABASE_URL='https://zomawqbdhktfdnyghxut.supabase.co';
  const ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvbWF3cWJkaGt0ZmRueWdoeHV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5MTM2MTIsImV4cCI6MjEwNjQ4OTYxMn0.s55ppUfDs1TawNAWm2L3aTBf6JzptkZ9rTEYsMwrg7o';
  const SECRET_KEY='pcbpro0045-cloud-secret-v1';
  const ACTIVE_KEY='pcbpro0045-cloud-active-project';
  const PROJECT_KEY='pcbpro0045-project-v11';
  const WIRE_KEY='pcbpro0045-wiregraph-v2';
  const BOARD_KEY='pcbpro0045-board-v1';
  const ADV_BOARD_KEY='pcbpro0045-board-advanced-v1';
  const PROFESSIONAL_KEY='pcbpro0045-professional-v118';
  const MANUFACTURING_KEY='pcbpro0045-manufacturing-v120';

  let secret=null;
  let status='boot';
  let projects=[];
  let activeId=localStorage.getItem(ACTIVE_KEY)||'';
  let lastFingerprint='';
  let saveTimer=0;
  let pollTimer=0;
  let busy=false;
  let lastError='';

  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  const t=(id,en)=>lang()==='id'?id:en;
  const enc=new TextEncoder();
  const dec=new TextDecoder();
  const clean=v=>String(v??'').trim().replace(/\s+/g,' ');

  function bytesToB64(bytes){
    let s='';const a=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
    for(let i=0;i<a.length;i+=0x8000)s+=String.fromCharCode(...a.subarray(i,i+0x8000));
    return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function b64ToBytes(s){
    const x=String(s||'').replace(/-/g,'+').replace(/_/g,'/');
    const padded=x+'='.repeat((4-x.length%4)%4);
    const bin=atob(padded);const out=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;
  }
  function randomToken(bytes=32){const a=new Uint8Array(bytes);crypto.getRandomValues(a);return bytesToB64(a)}
  async function sha256Hex(input){
    const data=typeof input==='string'?enc.encode(input):input;
    const hash=await crypto.subtle.digest('SHA-256',data);
    return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  function loadSecret(){
    try{
      const parsed=JSON.parse(localStorage.getItem(SECRET_KEY)||'null');
      if(parsed?.ownerToken&&parsed?.aesKey){secret=parsed;return secret}
    }catch{}
    secret={ownerToken:randomToken(32),aesKey:randomToken(32),createdAt:new Date().toISOString()};
    localStorage.setItem(SECRET_KEY,JSON.stringify(secret));
    return secret;
  }
  async function cryptoKey(){
    const s=loadSecret();
    return crypto.subtle.importKey('raw',b64ToBytes(s.aesKey),{name:'AES-GCM'},false,['encrypt','decrypt']);
  }
  async function encryptJson(value){
    const iv=new Uint8Array(12);crypto.getRandomValues(iv);
    const key=await cryptoKey();
    const plain=enc.encode(JSON.stringify(value));
    const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain));
    return {cipher:bytesToB64(cipher),iv:bytesToB64(iv),sha:await sha256Hex(cipher)};
  }
  async function encryptText(value){
    const iv=new Uint8Array(12);crypto.getRandomValues(iv);
    const key=await cryptoKey();
    const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(String(value))));
    return {cipher:bytesToB64(cipher),iv:bytesToB64(iv)};
  }
  async function decryptJson(cipher,iv){
    const key=await cryptoKey();
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64ToBytes(iv)},key,b64ToBytes(cipher));
    return JSON.parse(dec.decode(plain));
  }
  async function decryptText(cipher,iv){
    const key=await cryptoKey();
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64ToBytes(iv)},key,b64ToBytes(cipher));
    return dec.decode(plain);
  }

  async function ownerHash(){return sha256Hex(loadSecret().ownerToken)}
  async function headers(extra={}){
    return {
      apikey:ANON_KEY,
      Authorization:`Bearer ${ANON_KEY}`,
      'x-pcbpro-owner-token':loadSecret().ownerToken,
      'Content-Type':'application/json',
      ...extra
    };
  }
  async function api(path,options={}){
    const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...options,headers:await headers(options.headers||{})});
    const text=await r.text();let data=null;
    try{data=text?JSON.parse(text):null}catch{data=text}
    if(!r.ok){
      const msg=data?.message||data?.error_description||data?.hint||text||`HTTP ${r.status}`;
      throw new Error(msg);
    }
    return data;
  }

  function localJson(key,fallback=null){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
  function getComponents(){
    const direct=window.PCBProProject?.getComponents?.();
    if(Array.isArray(direct))return direct;
    return localJson(PROJECT_KEY,{components:[]})?.components||[];
  }
  function getUi(){
    return window.PCBProProject?.getUiState?.()||{};
  }
  function captureBundle(){
    return {
      format:'pcbpro0045-encrypted-project',
      schemaVersion:VERSION,
      capturedAt:new Date().toISOString(),
      core:{
        components:getComponents(),
        ui:getUi()
      },
      wiring:window.PCBProWireEngine?.routes?{version:window.PCBProWireEngine.version,routes:structuredClone(window.PCBProWireEngine.routes)}:localJson(WIRE_KEY,{version:'2.1.0',routes:[]}),
      board:window.PCBProBoardModel?.model?structuredClone(window.PCBProBoardModel.model):localJson(BOARD_KEY,{version:'1.1.0',tracks:[],outline:[]}),
      advancedBoard:localJson(ADV_BOARD_KEY,null),
      professional:localJson(PROFESSIONAL_KEY,null),
      manufacturing:localJson(MANUFACTURING_KEY,null),
      workflow:window.PCBProWorkflow?.snapshot?.()||null
    };
  }
  function projectName(){
    return clean(document.querySelector('.project-pill b')?.textContent)||'PCB Project';
  }
  async function fingerprintBundle(bundle){
    const stable=structuredClone(bundle||{});
    delete stable.capturedAt;
    return sha256Hex(enc.encode(JSON.stringify(stable)));
  }

  async function saveRemote(id=activeId,name=projectName(),bundle=captureBundle()){
    if(busy)return null;
    busy=true;status='saving';render();
    try{
      const [owner,nameEnc,payloadEnc]=await Promise.all([ownerHash(),encryptText(name),encryptJson(bundle)]);
      const body={
        p_id:id||null,
        p_owner_hash:owner,
        p_encrypted_name:nameEnc.cipher,
        p_name_iv:nameEnc.iv,
        p_encrypted_payload:payloadEnc.cipher,
        p_payload_iv:payloadEnc.iv,
        p_payload_sha256:payloadEnc.sha,
        p_schema_version:VERSION
      };
      const out=await api('rpc/pcbpro_save_project',{method:'POST',body:JSON.stringify(body)});
      const row=Array.isArray(out)?out[0]:out;
      if(row?.project_id){
        activeId=row.project_id;
        localStorage.setItem(ACTIVE_KEY,activeId);
      }
      lastFingerprint=await fingerprintBundle(bundle);
      status='synced';lastError='';
      await refreshProjects(false);
      window.dispatchEvent(new CustomEvent('pcbpro:database-saved',{detail:{projectId:activeId,revision:row?.revision||null}}));
      return row;
    }catch(error){
      status='error';lastError=error?.message||String(error);render();throw error;
    }finally{
      busy=false;render();
    }
  }

  async function listRemote(){
    const rows=await api('pcb_projects?select=id,encrypted_name,name_iv,current_revision,updated_at&order=updated_at.desc');
    const out=[];
    for(const row of Array.isArray(rows)?rows:[]){
      let name='Encrypted project';
      try{name=await decryptText(row.encrypted_name,row.name_iv)}catch{name='Encrypted project (key mismatch)'}
      out.push({...row,name});
    }
    return out;
  }

  async function refreshProjects(shouldRender=true){
    try{
      projects=await listRemote();
      if(shouldRender)render();
      return projects;
    }catch(error){
      status='error';lastError=error?.message||String(error);if(shouldRender)render();return[];
    }
  }

  async function loadProject(id){
    if(!id)return false;
    status='loading';render();
    try{
      const rows=await api(`pcb_projects?id=eq.${encodeURIComponent(id)}&select=id,encrypted_name,name_iv,encrypted_payload,payload_iv,current_revision,updated_at&limit=1`);
      const row=Array.isArray(rows)?rows[0]:null;
      if(!row)throw new Error('Project not found');
      const bundle=await decryptJson(row.encrypted_payload,row.payload_iv);
      const name=await decryptText(row.encrypted_name,row.name_iv);
      if(!Array.isArray(bundle?.core?.components))throw new Error('Encrypted project payload is invalid');

      localStorage.setItem(PROJECT_KEY,JSON.stringify({
        version:VERSION,
        components:bundle.core.components,
        savedAt:'Restored from encrypted database',
        leftWidth:Number(bundle.core?.ui?.leftWidth)||258,
        rightWidth:Number(bundle.core?.ui?.rightWidth)||282
      }));
      if(bundle.wiring)localStorage.setItem(WIRE_KEY,JSON.stringify(bundle.wiring));
      if(bundle.board)localStorage.setItem(BOARD_KEY,JSON.stringify(bundle.board));
      if(bundle.advancedBoard)localStorage.setItem(ADV_BOARD_KEY,JSON.stringify(bundle.advancedBoard));
      if(bundle.professional)localStorage.setItem(PROFESSIONAL_KEY,JSON.stringify(bundle.professional));
      if(bundle.manufacturing)localStorage.setItem(MANUFACTURING_KEY,JSON.stringify(bundle.manufacturing));
      activeId=row.id;localStorage.setItem(ACTIVE_KEY,row.id);
      localStorage.setItem('pcbpro0045-cloud-project-name',name);
      status='loaded';
      location.reload();
      return true;
    }catch(error){
      status='error';lastError=error?.message||String(error);render();return false;
    }
  }

  async function createFromCurrent(name){
    const bundle=captureBundle();
    const old=activeId;activeId='';
    try{return await saveRemote('',clean(name)||`PCB Project ${new Date().toLocaleString('id-ID')}`,bundle)}
    catch(error){activeId=old;throw error}
  }

  async function deleteProject(id){
    if(!id)return false;
    await api(`pcb_projects?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});
    if(activeId===id){activeId='';localStorage.removeItem(ACTIVE_KEY)}
    await refreshProjects();
    return true;
  }

  function exportRecovery(){
    const payload={format:'pcbpro0045-cloud-recovery',version:1,supabaseProject:'zomawqbdhktfdnyghxut',secret:loadSecret()};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');
    a.href=url;a.download='pcbpro0045-recovery-key.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function importRecovery(){
    const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
    input.addEventListener('change',async()=>{
      const file=input.files?.[0];if(!file)return;
      try{
        const data=JSON.parse(await file.text());
        if(data?.format!=='pcbpro0045-cloud-recovery'||data?.supabaseProject!=='zomawqbdhktfdnyghxut'||!data?.secret?.ownerToken||!data?.secret?.aesKey) throw new Error('Invalid PCB Pro recovery key file');
        b64ToBytes(data.secret.ownerToken); b64ToBytes(data.secret.aesKey);
        if(!confirm(t('Recovery key valid. Reload dan ganti identity/key browser sekarang?','Recovery key is valid. Reload and replace the browser identity/key now?')))return;
        localStorage.setItem(SECRET_KEY,JSON.stringify(data.secret));
        localStorage.removeItem(ACTIVE_KEY);
        location.reload();
      }catch(error){
        lastError=error?.message||String(error);status='error';render();
      }
    },{once:true});
    input.click();
  }

  function scheduleSave(delay=1200){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(async()=>{
      try{
        if(!activeId)return;
        const bundle=captureBundle();
        const fp=await fingerprintBundle(bundle);
        if(fp===lastFingerprint)return;
        await saveRemote(activeId,projectName(),bundle);
      }catch{}
    },delay);
  }

  function installStyles(){
    if(document.querySelector('#pcbpro-db-style'))return;
    const s=document.createElement('style');s.id='pcbpro-db-style';s.textContent=`
      #pcbpro-db-projects{margin:0 0 8px;padding:8px;border:1px solid #203643;background:#09151e;border-radius:8px}
      .pdb-head{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:7px}.pdb-head b{font:900 7px ui-monospace;color:#62d7bf;letter-spacing:.08em}.pdb-state{font:800 7px ui-monospace;color:#7f96a3}.pdb-state.error{color:#ee977f}.pdb-actions{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:7px}.pdb-actions button{border:1px solid #294553;background:#10212b;color:#b8cbd4;border-radius:6px;padding:5px 7px;font-size:7px;font-weight:850}.pdb-list{display:grid;gap:4px}.pdb-project{display:grid!important;grid-template-columns:1fr auto;gap:6px;align-items:center!important;padding:7px!important;border:1px solid transparent!important}.pdb-project.active{background:#12352f!important;color:#78e0ca!important;border-color:#285a50!important}.pdb-project small{display:block;font:700 6px ui-monospace;color:#6f8794;margin-top:2px}.pdb-lock{font-size:9px}.pdb-note{margin-top:7px;font-size:6.5px;line-height:1.45;color:#617986}.pdb-error{margin-top:6px;color:#e8927c;font-size:6.5px;line-height:1.4}
    `;document.head.appendChild(s);
  }

  function render(){
    installStyles();
    const tree=document.querySelector('.tree');
    if(!tree)return;
    let root=document.querySelector('#pcbpro-db-projects');
    if(!root){root=document.createElement('section');root.id='pcbpro-db-projects';tree.prepend(root)}
    const stateLabel=status==='synced'?t('TERSINKRON','SYNCED'):status==='saving'?t('MENYIMPAN','SAVING'):status==='loading'?t('MEMUAT','LOADING'):status==='error'?t('ERROR','ERROR'):t('TERHUBUNG','CONNECTED');
    root.innerHTML=`
      <div class="pdb-head"><b>DATABASE · AES-GCM + RLS</b><span class="pdb-state ${status==='error'?'error':''}">${stateLabel}</span></div>
      <div class="pdb-actions">
        <button data-pdb-sync>${t('Sync sekarang','Sync now')}</button>
        <button data-pdb-new>${t('+ Proyek DB','+ DB project')}</button>
        <button data-pdb-key>${t('Backup key','Backup key')}</button>
        <button data-pdb-import-key>${t('Import key','Import key')}</button>
      </div>
      <div class="pdb-list">${projects.map(p=>`
        <button class="pdb-project ${p.id===activeId?'active':''}" data-pdb-open="${p.id}" title="${p.name}">
          <span><b>${p.name.replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}</b><small>rev ${p.current_revision} · ${new Date(p.updated_at).toLocaleString('id-ID')}</small></span><span class="pdb-lock">🔒</span>
        </button>`).join('')}</div>
      <div class="pdb-note">${t('Isi proyek dienkripsi di browser sebelum masuk database. RLS juga mengunci row ke token browser ini. Backup key diperlukan kalau browser/storage hilang.','Project contents are encrypted in the browser before database upload. RLS also binds rows to this browser token. Back up the key in case browser storage is lost.')}</div>
      ${lastError?`<div class="pdb-error">${clean(lastError).slice(0,240)}</div>`:''}`;

    root.querySelector('[data-pdb-sync]')?.addEventListener('click',()=>saveRemote(activeId,projectName(),captureBundle()).catch(()=>{}));
    root.querySelector('[data-pdb-new]')?.addEventListener('click',async()=>{
      const name=prompt(t('Nama proyek database baru','New database project name'),`PCB Project ${projects.length+1}`);
      if(name)await createFromCurrent(name).catch(()=>{});
    });
    root.querySelector('[data-pdb-key]')?.addEventListener('click',exportRecovery);
    root.querySelector('[data-pdb-import-key]')?.addEventListener('click',importRecovery);
    root.querySelectorAll('[data-pdb-open]').forEach(b=>b.addEventListener('click',()=>loadProject(b.dataset.pdbOpen)));
  }

  async function boot(){
    loadSecret();status='connected';render();
    const forceNew=localStorage.getItem('pcbpro0045-cloud-create-new')==='1';
    if(forceNew){
      localStorage.removeItem('pcbpro0045-cloud-create-new');
      activeId='';localStorage.removeItem(ACTIVE_KEY);
    }

    const list=await refreshProjects();

    if(forceNew || !activeId){
      try{
        const preferred=localStorage.getItem('pcbpro0045-cloud-project-name')||projectName();
        await saveRemote('',preferred,captureBundle());
      }catch{}
    }else if(!list.some(p=>p.id===activeId)){
      // Never silently bind a local project to an unrelated remote row.
      activeId='';localStorage.removeItem(ACTIVE_KEY);
      try{await saveRemote('',projectName(),captureBundle())}catch{}
    }else{
      try{
        const bundle=captureBundle();
        lastFingerprint=await fingerprintBundle(bundle);
      }catch{}
    }

    window.addEventListener('pcbpro:project-local-saved',()=>scheduleSave(100));
    window.addEventListener('pcbpro:project-components-changed',()=>scheduleSave(250));
    window.addEventListener('pcbpro:netlist-changed',()=>scheduleSave());
    window.addEventListener('pcbpro:board-changed',()=>scheduleSave());
    window.addEventListener('pcbpro:professional-rules-changed',()=>scheduleSave(350));
    window.addEventListener('pcbpro:manufacturing-preflight',()=>scheduleSave(450));
    window.addEventListener('pcbpro:catalog-ready',render);
    window.addEventListener('pcbpro:project-adapter-ready',()=>scheduleSave(500));

    pollTimer=window.setInterval(async()=>{
      try{
        const bundle=captureBundle();
        const fp=await fingerprintBundle(bundle);
        if(activeId&&fp!==lastFingerprint)scheduleSave(700);
      }catch{}
    },5000);

    window.dispatchEvent(new CustomEvent('pcbpro:database-ready',{detail:{version:VERSION,projectRef:'zomawqbdhktfdnyghxut'}}));
  }

  window.PCBProDatabase={
    version:VERSION,
    list:refreshProjects,
    saveNow:()=>saveRemote(activeId,projectName(),captureBundle()),
    createFromCurrent,
    loadProject,
    deleteProject,
    exportRecovery,
    importRecovery,
    capture:captureBundle,
    scheduleSave,
    snapshot:()=>({version:VERSION,status,activeId,projectCount:projects.length,lastError,encrypted:true,rls:true}),
    get activeProjectId(){return activeId}
  };

  window.PCBProExplain?.register?.({
    id:'feature.encrypted-database-v117',
    match:['database','cloud sync','encrypted project','supabase','aes-gcm','rls'],
    category:'persistence',
    status:'active',
    title:{id:'Encrypted Project Database',en:'Encrypted Project Database'},
    what:{id:'Penyimpanan proyek PCB Pro di Supabase PostgreSQL dengan payload proyek dienkripsi AES-GCM di browser sebelum dikirim.',en:'PCB Pro project persistence in Supabase PostgreSQL with project payloads encrypted via AES-GCM in the browser before upload.'},
    why:{id:'Supaya project tree, komponen, wiring, board geometry, revision, dan state tidak bergantung hanya pada localStorage satu halaman.',en:'So the project tree, components, wiring, board geometry, revisions, and state do not depend solely on page-local storage.'},
    input:{id:'State project aktif + owner token browser + encryption key browser.',en:'Active project state plus a browser owner token and browser encryption key.'},
    process:{id:'Browser mengenkripsi nama/payload → request membawa owner token → RLS mencocokkan SHA-256 token → database menyimpan ciphertext + revision history.',en:'The browser encrypts name/payload → requests carry an owner token → RLS matches the token SHA-256 → the database stores ciphertext plus revision history.'},
    output:{id:'Project row terenkripsi, revision history maksimal 50 snapshot, dan restore project dari database.',en:'Encrypted project rows, up to 50 revision snapshots, and database project restore.'},
    how_to_read:{id:'Status SYNCED berarti ciphertext terbaru berhasil disimpan. Itu berbeda dari manufacturing validation atau simulation correctness.',en:'SYNCED means the latest ciphertext was stored successfully. It is unrelated to manufacturing validation or simulation correctness.'},
    limits:{id:'Encryption key berada di browser. Jika browser storage dihapus tanpa Backup key, ciphertext database tidak dapat didekripsi dari browser baru. Ini belum multi-user account sync.',en:'The encryption key lives in the browser. If browser storage is erased without a Backup key, database ciphertext cannot be decrypted from a new browser. This is not yet multi-user account sync.'},
    next:{id:'Gunakan Backup key; tahap berikutnya bisa menambahkan login/account recovery dan sharing project terkontrol.',en:'Use Backup key; a later step can add login/account recovery and controlled project sharing.'}
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();