(() => {
 'use strict';
 if(window.PCBProQuickActions)return;
 const VERSION='1.31.0';
 let open=false,selected=0,filtered=[],previousFocus=null;
 const commands=[
  {key:'schematic',label:'Buka Schematic',category:'Workspace',desc:'Buka editor rangkaian & netlist',view:'Schematic'},
  {key:'pcb',label:'Buka PCB Routing',category:'Workspace',desc:'Board, routing dan DRC',view:'PCB'},
  {key:'sim',label:'Buka Simulator',category:'Workspace',desc:'Simulasi dari komponen nyata',view:'Simulator'},
  {key:'electrical',label:'Buka Electrical',category:'Workspace',desc:'Load schedule, panel dan sistem daya',view:'Electrical'},
  {key:'academy',label:'Buka Learning Academy',category:'Belajar',desc:'42 materi & routing lab',view:'Learning'},
  {key:'harness',label:'Buka Wiring & Harness Planner',category:'Rancang',desc:'Rencana terminal, koneksi dan tes kontinuitas manual',view:'Builder'},
  {key:'builder',label:'Buka System Builder',category:'Rancang',desc:'Robot, smart home, hidroponik, GPS & power tree',view:'Builder'},
  {key:'bom',label:'Buka Bill of Materials',category:'Workspace',desc:'Data komponen PCB',view:'BOM'},
  {key:'fab',label:'Buka Fabrication',category:'Workspace',desc:'Preflight dan CAM (cakupan terbatas)',view:'Fabrication'},
  {key:'rules',label:'Buka Design Rules',category:'Workspace',desc:'Electrical, clearance dan routing checks',view:'Rules'},
  {key:'release',label:'Buka Release Center',category:'Workspace',desc:'Ringkasan rilis dan pemeriksaan',view:'Release'},
  {key:'verify',label:'VERIFY Proyek Nyata',category:'Engineering',desc:'Integrity, SPICE coverage, DRC dan CAM preflight',action:()=>window.PCBProVerificationV125?.render?.()},
  {key:'spice',label:'Lihat SPICE Netlist',category:'Engineering',desc:'Validasi & ekspor untuk simulator eksternal',action:()=>window.PCBProSpiceV125?.show?.()},
  {key:'backup',label:'Ekspor Full Project Backup',category:'Data',desc:'Proyek lengkap, Electrical, Academy & Builder',action:()=>window.PCBProPortableBackup?.exportFile?.()},
  {key:'light',label:'Pakai Light Mode',category:'Tampilan',desc:'Minimalis putih bersih',action:()=>window.PCBProTheme?.setMode?.('light')},
  {key:'dark',label:'Pakai Dark Mode',category:'Tampilan',desc:'Tema gelap engineering',action:()=>window.PCBProTheme?.setMode?.('dark')},
  {key:'system',label:'Pakai System Theme',category:'Tampilan',desc:'Ikuti setting OS/perangkat',action:()=>window.PCBProTheme?.setMode?.('system')}
 ];
 function style(){
  if(document.getElementById('pcbpro-quick-style-v130'))return;
  const el=document.createElement('style');el.id='pcbpro-quick-style-v130';
  el.textContent=[
   '.command-trigger{border:1px solid var(--sl-border,#e0e6ed)!important;background:var(--sl-surface-alt,#f8fafc)!important;color:var(--sl-muted,#586b7f)!important;border-radius:8px!important;padding:5px 12px!important;font-size:11px!important;min-width:150px!important;white-space:nowrap;cursor:pointer}',
   '.command-trigger kbd{padding:2px 5px;background:var(--sl-surface,#fff);border:1px solid var(--sl-border,#e0e6ed);border-radius:4px;font-size:10px;margin-left:6px}',
   '#pcbpro-quick-overlay{position:fixed;inset:0;z-index:25000;background:rgba(6,20,27,.56);display:none;align-items:flex-start;justify-content:center;padding:12vh 16px 20px;backdrop-filter:blur(4px)}',
   '#pcbpro-quick-overlay.open{display:flex}#pcbpro-quick-dialog{width:min(620px,100%);max-height:min(620px,75vh);display:flex;flex-direction:column;border:1px solid var(--sl-border,#e0e6ed);border-radius:16px;background:var(--sl-surface,#fff);box-shadow:0 18px 65px rgba(5,20,30,.25);color:var(--sl-ink,#172332);overflow:hidden}',
   '.pq-input{width:100%;font-size:15px;padding:19px;border:0;border-bottom:1px solid var(--sl-border,#e0e6ed);color:var(--sl-ink,#172332);background:transparent;outline:none}',
   '.pq-results{padding:8px;overflow:auto;max-height:440px}.pq-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;width:100%;padding:11px 14px;border:1px solid transparent;border-radius:9px;cursor:pointer;text-align:left;color:var(--sl-ink,#172332);background:transparent}',
   '.pq-item:hover,.pq-item.active{background:var(--sl-accent-soft,#e6f6f4);border-color:var(--sl-border,#e0e6ed)}',
   '.pq-item b{font-size:13px;display:block}.pq-item small{font-size:11px;color:var(--sl-muted,#586b7f);display:block;margin-top:2px}',
   '.pq-item em{font:650 10px ui-monospace;color:var(--sl-accent-text,#086d71);font-style:normal;margin-top:3px}',
   '.pq-empty{padding:25px;color:var(--sl-muted,#586b7f);text-align:center;font-size:12px}',
   '.pq-foot{border-top:1px solid var(--sl-border,#e0e6ed);padding:10px 15px;color:var(--sl-muted,#586b7f);font-size:11px;background:var(--sl-surface-alt,#f8fafc)}',
   '@media(max-width:900px){.command-trigger{min-width:110px!important}.command-trigger kbd{display:none}}@media(max-width:620px){.command-trigger{padding:4px 8px!important;min-width:0!important}}'
  ].join('');
  document.head.appendChild(el);
 }
 const norm=x=>String(x||'').toLowerCase().normalize('NFKD');
 function search(query){
  const q=norm(query).trim();
  return commands.filter(c=>!q||norm([c.label,c.category,c.desc,c.view||''].join(' ')).includes(q));
 }
 function root(){
  let host=document.getElementById('pcbpro-quick-overlay');
  if(host)return host;
  host=document.createElement('div');
  host.id='pcbpro-quick-overlay';
  host.innerHTML='<div id="pcbpro-quick-dialog" role="dialog" aria-modal="true" aria-label="Cari fitur SirkuitLab">'+
    '<input class="pq-input" type="search" placeholder="Cari: PCB, Electrical, robot, backup, verify…" aria-label="Cari perintah dan workspace">'+
    '<div class="pq-results" role="listbox" aria-label="Hasil perintah"></div>'+
    '<div class="pq-foot">↑ ↓ pilih · Enter jalankan · Esc tutup · Ctrl/⌘ K buka</div></div>';
  host.addEventListener('click',e=>{if(e.target===host)close();});
  const input=host.querySelector('.pq-input');
  input.addEventListener('input',()=>{selected=0;draw(input.value);});
  input.addEventListener('keydown',e=>{
   if(e.key==='ArrowDown'){e.preventDefault();selected=(selected+1)%Math.max(1,filtered.length);draw(input.value);}
   if(e.key==='ArrowUp'){e.preventDefault();selected=(selected-1+Math.max(1,filtered.length))%Math.max(1,filtered.length);draw(input.value);}
   if(e.key==='Enter'){e.preventDefault();if(filtered[selected])execute(filtered[selected]);}
   if(e.key==='Escape'){e.preventDefault();close();}
  });
  document.body.appendChild(host);
  return host;
 }
 function draw(q=''){
  const host=root(),box=host.querySelector('.pq-results');
  filtered=search(q);
  box.replaceChildren();
  if(!filtered.length){const p=document.createElement('p');p.className='pq-empty';p.textContent='Tidak ada perintah yang cocok.';box.appendChild(p);return;}
  filtered.forEach((entry,index)=>{
   const button=document.createElement('button');button.type='button';
   button.className='pq-item'+(selected===index?' active':'');
   button.setAttribute('role','option');button.setAttribute('aria-selected',String(selected===index));
   const text=document.createElement('span'),title=document.createElement('b'),caption=document.createElement('small'),tag=document.createElement('em');
   title.textContent=entry.label;caption.textContent=entry.desc;tag.textContent=entry.category;
   text.append(title,caption);button.append(text,tag);
   button.addEventListener('mouseenter',()=>selected=index);
   button.addEventListener('click',()=>execute(entry));
   box.appendChild(button);
  });
  box.querySelectorAll('.pq-item')[selected]?.scrollIntoView?.({block:'nearest'});
 }
 function execute(command){
  close();
  if(command.view){
    const button=[...document.querySelectorAll('.tabs button')].find(b=>b.textContent?.trim()===command.view);
    if(button){
      button.click();
      if(command.key==='harness')
        setTimeout(()=>document.getElementById('sl-harness-v131')?.scrollIntoView?.({behavior:'smooth',block:'start'}),120);
    }else window.alert('Workspace '+command.view+' belum tersedia.');
    return;
  }
  if(command.action){
    const result=command.action();
    if(result===undefined && command.key==='backup' && !window.PCBProPortableBackup?.exportFile)
      window.alert('Backup engine belum siap.');
  }
 }
 function openDialog(){
  style();
  const overlay=root();
  previousFocus=document.activeElement;
  overlay.classList.add('open');open=true;
  const input=overlay.querySelector('.pq-input');
  input.value='';selected=0;draw('');input.focus();
 }
 function close(){
  const host=document.getElementById('pcbpro-quick-overlay');
  host?.classList.remove('open');
  open=false;
  previousFocus?.focus?.();
 }
 function handleGlobal(e){
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){
   e.preventDefault();
   if(open)close();else openDialog();
   return;
  }
  if(e.key==='Escape' && open){e.preventDefault();close();}
  // Focus should remain inside the modal, even on repeated Tab navigation.
  if(e.key==='Tab'&&open){
    const overlay=root(),controls=[...overlay.querySelectorAll('input,button')];
    const first=controls[0],last=controls[controls.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
 }
 function start(){
  style();
  document.addEventListener('keydown',handleGlobal,true);
 }
 window.PCBProQuickActions={version:VERSION,commands,search,open:openDialog,close,execute,get visible(){return open}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();