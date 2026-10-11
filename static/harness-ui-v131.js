(() => {
 'use strict';
 if(window.PCBProHarnessUIV131)return;
 const VERSION='1.31.0';
 const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 const engine=()=>window.PCBProHarnessV131;
 const architect=()=>window.PCBProSystemArchitect;
 const ROLE=['power_out','power_in','ground','signal_out','signal_in','bidirectional','passive','shield'];
 const MODES=['power','ground','signal','data','shield'];
 const STATES=['untested','pass','fail','needs_retest'];
 let selectedModule='',from='',to='',open=true,lastMessage='';
 function css(){
  if(document.getElementById('sl-harness-style-v131'))return;
  const el=document.createElement('style');el.id='sl-harness-style-v131';
  el.textContent=[
   '#sl-harness-v131{color:var(--sl-ink,#172332)}#sl-harness-v131 *{box-sizing:border-box}',
   '.hw-top{display:flex;justify-content:space-between;align-items:start;gap:10px;flex-wrap:wrap}',
   '.hw-top h3{margin:0;font-size:16px}.hw-top p{margin:4px 0 7px;color:var(--sl-muted,#586b7f);font-size:12px;max-width:780px}',
   '.hw-actions{display:flex;gap:7px;flex-wrap:wrap}',
   '.hw-actions button,#sl-harness-v131 button{border:1px solid var(--sl-border,#e0e6ed);background:var(--sl-surface,#fff);color:var(--sl-ink,#172332);border-radius:8px;padding:8px 10px;cursor:pointer;font:650 11px system-ui}',
   '#sl-harness-v131 button:hover{border-color:var(--sl-accent,#087d80)}',
   '.hw-actions button.hw-accent{background:var(--sl-accent,#087d80);border-color:var(--sl-accent,#087d80);color:white}',
   '.hw-detail{border:1px solid var(--sl-border,#e0e6ed);border-radius:10px;padding:12px;margin:9px 0;background:var(--sl-surface-alt,#f8fafc)}',
   '.hw-detail h4{font-size:13px;margin:2px 0 8px}',
   '.hw-create{display:flex;align-items:end;gap:8px;flex-wrap:wrap;margin:8px 0}',
   '.hw-create label{display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--sl-muted,#586b7f)}',
   '.hw-create :is(input,select){min-height:34px;min-width:125px;background:var(--sl-surface,#fff);color:var(--sl-ink,#172332);border:1px solid var(--sl-border,#e0e6ed);border-radius:7px;padding:7px;font-size:12px}',
   '.hw-create button{min-height:34px}',
   '.hw-table{width:100%;overflow:auto;border:1px solid var(--sl-border,#e0e6ed);border-radius:9px;max-height:350px}',
   '.hw-table table{width:100%;min-width:870px;border-collapse:collapse}',
   '.hw-table th,.hw-table td{padding:8px;border-bottom:1px solid var(--sl-border,#e0e6ed);font-size:11px;text-align:left;white-space:nowrap}',
   '.hw-table th{position:sticky;top:0;background:var(--sl-surface-alt,#f8fafc);color:var(--sl-muted,#586b7f);z-index:1}',
   '.hw-table :is(input,select){background:var(--sl-surface,#fff);color:var(--sl-ink,#172332);border:1px solid var(--sl-border,#e0e6ed);border-radius:7px;padding:7px;font-size:11px;min-height:32px;min-width:80px}',
   '.hw-table input[type=number]{width:90px}.hw-table input[data-field=name]{min-width:110px}.hw-table input[data-wire-key=net]{min-width:110px}',
   '.hw-table select{max-width:155px}.hw-table .hw-test-note{min-width:165px}',
   '.hw-status{display:flex;gap:8px;flex-wrap:wrap;padding:9px 0}.hw-stat{display:block;background:var(--sl-surface-alt,#f8fafc);border:1px solid var(--sl-border,#e0e6ed);border-radius:7px;padding:6px 9px;color:var(--sl-muted,#586b7f);font-size:11px}',
   '.hw-route-map{max-height:270px;overflow:auto;border:1px solid var(--sl-border,#e0e6ed);border-radius:10px;background:var(--sl-surface-alt,#f8fafc);padding:8px}',
   '.hw-route{display:grid;grid-template-columns:minmax(130px,1fr) 80px minmax(130px,1fr);align-items:center;gap:7px;margin:6px 0;font-size:11px}',
   '.hw-device{background:var(--sl-surface,#fff);border:1px solid var(--sl-border,#e0e6ed);border-radius:7px;padding:8px;overflow-wrap:anywhere}',
   '.hw-device b{display:block}.hw-device small{color:var(--sl-muted,#586b7f);display:block}',
   '.hw-link{border-bottom:2px dashed var(--sl-accent,#087d80);text-align:center;font-size:10px;color:var(--sl-accent-text,#086568);overflow-wrap:anywhere}',
   '.hw-link.fail{border-color:#bd4c42;color:#bd4c42}',
   '.hw-issues{display:grid;gap:7px;max-height:330px;overflow:auto}.hw-issue{border:1px solid var(--sl-border,#e0e6ed);border-left:3px solid #b88b42;border-radius:7px;background:var(--sl-surface-alt,#f8fafc);padding:8px}',
   '.hw-issue.bad{border-left-color:#ba4b43}.hw-issue b{font:700 10px ui-monospace,monospace}.hw-issue p{font-size:11px;color:var(--sl-muted,#586b7f);margin:4px 0}',
   '.hw-note{color:var(--sl-muted,#586b7f);font-size:11px!important;line-height:1.65}',
   '.hw-root .hw-empty{padding:16px;color:var(--sl-muted,#586b7f);font-size:12px}',
   '@media(max-width:700px){.hw-route{grid-template-columns:minmax(110px,1fr) 60px minmax(110px,1fr)}.hw-device{padding:6px}}'
  ].join('');
  document.head.appendChild(el);
 }
 function options(rows,current,label=x=>x){
  return rows.map(x=>'<option value="'+esc(x)+'" '+(x===current?'selected':'')+'>'+esc(label(x))+'</option>').join('');
 }
 const td=(html)=>'<td>'+html+'</td>';
 function field(t,key,kind='text'){
  const v=t[key]??'';
  if(key==='role')return '<select data-terminal="'+esc(t.id)+'" data-field="'+key+'">'+options(ROLE,v)+'</select>';
  if(key==='deviceId')return '<select data-terminal="'+esc(t.id)+'" data-field="'+key+'">'+
    options(architect()?.snapshot?.()?.devices?.map(x=>x.id)||[],v)+'</select>';
  return '<input type="'+kind+'" step="any" data-terminal="'+esc(t.id)+'" data-field="'+key+'" value="'+esc(v)+'">';
 }
 function wireField(w,key,choices){
  const a='data-wire="'+esc(w.id)+'" data-wire-key="'+key+'"';
  if(choices)return '<select '+a+'>'+options(choices,w[key])+'</select>';
  return '<input type="'+(['lengthCm'].includes(key)?'number':'text')+'" step="any" '+a+' value="'+esc(w[key]??'')+'">';
 }
 function endpoints(h){
  const map=new Map(h.terminals.map(t=>[t.id,t]));
  return h.terminals.map(t=>({id:t.id,label:t.deviceId+'.'+t.name,term:t})).filter(x=>x.term);
 }
 function show(){
  const root=document.getElementById('sl-harness-v131'),e=engine(),a=architect();
  if(!root||!e||!a)return;
  css();
  const p=e.snapshot(),devices=a.snapshot().devices,check=e.validateForBlueprint(p,a.snapshot());
  if(!devices.some(d=>d.id===selectedModule))selectedModule=devices[0]?.id||'';
  const terms=endpoints(p),ids=terms.map(x=>x.id),label=id=>terms.find(x=>x.id===id)?.label||id;
  if(!ids.includes(from))from=ids[0]||'';
  if(!ids.includes(to))to=ids[1]||ids[0]||'';
  const bad=check.blockers?.length||0,warning=check.warnings?.length||0;
  const map=new Map(p.terminals.map(t=>[t.id,t]));
  root.innerHTML='<div class="hw-top"><div><h3>05 / Wiring & Harness Planner</h3>'+
    '<p>Rencanakan koneksi antar-terminal nyata, susun daftar kabel, cari potensi korslet/konflik net, dan catat hasil tes kontinuitas. Semua terminal harus diambil dari datasheet atau label fisik perangkat.</p></div>'+
    '<div class="hw-actions"><button data-hw-action="csv">Wire Schedule CSV</button><button data-hw-action="json">Review JSON</button>'+
    '<button data-hw-action="toggle">'+(open?'Tutup':'Buka')+' planner</button></div></div>'+
    '<div class="hw-status"><span class="hw-stat">'+p.terminals.length+' terminal</span><span class="hw-stat">'+p.wires.length+' rute</span>'+
    '<span class="hw-stat">'+check.summary.passed+' tes PASS (dicatat pengguna)</span>'+
    '<span class="hw-stat">'+bad+' blocker · '+warning+' review</span></div>'+
    '<p class="hw-note"><b>Lingkup aman:</b> hanya perencanaan kabel DC tegangan rendah. Planner tidak menghitung ampacity, ukuran fuse, isolasi, crimp, tegangan jatuh, PCB copper routing, atau memberi persetujuan instalasi. Tes PASS adalah catatan pengguna, bukan pengukuran aplikasi.</p>'+
    (lastMessage?'<p role="status" class="hw-note">'+esc(lastMessage)+'</p>':'')+
    (open?'<div class="hw-detail"><h4>A. Buat daftar terminal perangkat</h4>'+
    '<div class="hw-create"><label>Modul<select data-hw-select="module">'+options(devices.map(x=>x.id),selectedModule)+'</select></label>'+
    '<button data-hw-action="add-terminal" '+(!selectedModule?'disabled':'')+'>+ Terminal</button></div>'+
    '<div class="hw-table"><table><thead><tr><th>ID</th><th>Modul</th><th>Nama terminal</th><th>Peran</th><th>V nominal*</th><th>Catatan</th><th></th></tr></thead><tbody>'+
    p.terminals.map(t=>'<tr>'+td('<b>'+esc(t.id)+'</b>')+td(field(t,'deviceId'))+
      td(field(t,'name'))+td(field(t,'role'))+td(field(t,'nominalV','number'))+
      td(field(t,'notes'))+td('<button data-hw-delete-terminal="'+esc(t.id)+'">Hapus</button>')+'</tr>').join('')+
    (!p.terminals.length?'<tr><td colspan="7" class="hw-empty">Tambah terminal dari modul Builder. Contoh: MCU.GPIO21 atau SENSOR.SDA.</td></tr>':'')+
    '</tbody></table></div><p class="hw-note">* V nominal hanya perbandingan tegangan yang lu nyatakan, bukan pemodelan catu atau toleransi pin.</p></div>'+
    '<div class="hw-detail"><h4>B. Susun rute wiring / net</h4>'+
    '<div class="hw-create"><label>Dari terminal<select data-hw-select="from">'+options(ids,from,label)+'</select></label>'+
    '<label>Ke terminal<select data-hw-select="to">'+options(ids,to,label)+'</select></label>'+
    '<button data-hw-action="add-wire" '+(ids.length<2?'disabled':'')+'>+ Hubungkan</button></div>'+
    '<div class="hw-table"><table><thead><tr><th>ID</th><th>Net</th><th>Terminal A</th><th>Terminal B</th><th>Jenis</th><th>Ukuran kabel</th><th>Panjang cm</th><th>Warna</th><th>Status tes</th><th>Bukti / catatan tes</th><th></th></tr></thead><tbody>'+
    p.wires.map(w=>'<tr>'+td('<b>'+esc(w.id)+'</b>')+td(wireField(w,'net'))+
      td('<select data-wire="'+esc(w.id)+'" data-wire-key="from">'+options(ids,w.from,label)+'</select>')+
      td('<select data-wire="'+esc(w.id)+'" data-wire-key="to">'+options(ids,w.to,label)+'</select>')+
      td(wireField(w,'mode',MODES))+td(wireField(w,'gauge'))+td(wireField(w,'lengthCm'))+
      td(wireField(w,'color'))+
      td('<select data-test-status="'+esc(w.id)+'">'+options(STATES,w.testStatus)+'</select>')+
      td('<input class="hw-test-note" data-test-note="'+esc(w.id)+'" type="text" maxlength="500" placeholder="Bukti observasi (wajib bila PASS)" value="'+esc(w.testNote)+'"><button data-save-test="'+esc(w.id)+'">Simpan tes</button>')+
      td('<button data-hw-delete-wire="'+esc(w.id)+'">Hapus</button>')+'</tr>').join('')+
    (!p.wires.length?'<tr><td colspan="11" class="hw-empty">Belum ada wire. Pilih dua terminal berbeda.</td></tr>':'')+
    '</tbody></table></div><p class="hw-note">Perubahan kabel/terminal menandai tes lama sebagai butuh pengujian ulang. Tidak ada tes otomatis lewat browser tanpa alat ukur.</p></div>'+
    '<div class="hw-detail"><h4>C. Peta konektivitas konseptual</h4>'+
    '<div class="hw-route-map">'+(p.wires.length?p.wires.map(w=>{
      const at=map.get(w.from),bt=map.get(w.to);
      return '<div class="hw-route"><div class="hw-device"><b>'+esc(at?.deviceId||'Terminal hilang')+'</b><small>'+esc(at?.name||w.from)+'</small></div>'+
        '<div class="hw-link '+(w.testStatus==='fail'?'fail':'')+'">'+esc(w.net)+'<small> '+esc(w.id)+'</small></div>'+
        '<div class="hw-device"><b>'+esc(bt?.deviceId||'Terminal hilang')+'</b><small>'+esc(bt?.name||w.to)+'</small></div></div>';
    }).join(''):'<div class="hw-empty">Belum ada koneksi untuk ditampilkan.</div>')+'</div></div>':'')+
    '<div class="hw-detail"><h4>D. Preflight dan risiko</h4>'+
    '<div class="hw-issues">'+
    check.blockers.slice(0,18).map(x=>'<div class="hw-issue bad"><b>'+esc(x.code)+' · '+esc(x.ref)+'</b><p>'+esc(x.message)+'</p></div>').join('')+
    check.warnings.slice(0,18).map(x=>'<div class="hw-issue"><b>'+esc(x.code)+' · '+esc(x.ref)+'</b><p>'+esc(x.message)+'</p></div>').join('')+
    (!bad&&!warning?'<div class="hw-empty">Tidak ada temuan dari cek konektivitas terbatas. Itu bukan sertifikat aman.</div>':'')+
    (bad+warning>36?'<p class="hw-note">Temuan tambahan tersedia di export JSON.</p>':'')+
    '</div><p class="hw-note">Acuan workmanship: <a href="https://www.ipc.org.cn/standards/ipc-whma-a-620" target="_blank" rel="noopener noreferrer">IPC/WHMA-A-620F (2026)</a>. Standar resmi mencakup crimp, solder, inspeksi dan pengujian lebih luas daripada preflight di sini.</p></div>';
  if(root.dataset.hwBound==='1')return;
  root.dataset.hwBound='1';
  root.addEventListener('click',event=>{
    const node=event.target.closest?.('[data-hw-action],[data-hw-delete-terminal],[data-hw-delete-wire],[data-save-test]');
    if(!node)return;
    const action=node.dataset.hwAction;
    try{
      if(action==='toggle'){open=!open;show();}
      else if(action==='csv')e.exportCSV();
      else if(action==='json')e.exportJSON();
      else if(action==='add-terminal'){e.addTerminal(selectedModule);show();}
      else if(action==='add-wire'){e.addWire(from,to);show();}
      else if(node.dataset.hwDeleteTerminal){e.removeTerminal(node.dataset.hwDeleteTerminal);show();}
      else if(node.dataset.hwDeleteWire){e.removeWire(node.dataset.hwDeleteWire);show();}
      else if(node.dataset.saveTest){
        const id=node.dataset.saveTest;
        const status=root.querySelector('[data-test-status="'+id+'"]')?.value||'untested';
        const note=root.querySelector('[data-test-note="'+id+'"]')?.value||'';
        e.recordTest(id,status,note);lastMessage='Hasil '+id+' disimpan sebagai catatan pengguna.';show();
      }
    }catch(ex){lastMessage=String(ex?.message||ex);show();}
  });
  root.addEventListener('change',event=>{
    const t=event.target;
    try{
      if(t.dataset.hwSelect){
        if(t.dataset.hwSelect==='module')selectedModule=t.value;
        if(t.dataset.hwSelect==='from')from=t.value;
        if(t.dataset.hwSelect==='to')to=t.value;
        return;
      }
      if(t.dataset.terminal&&t.dataset.field){
        const value=t.dataset.field==='nominalV'?(t.value.trim()===''?null:Number(t.value)):t.value;
        e.updateTerminal(t.dataset.terminal,t.dataset.field,value);lastMessage='';
        show();
      }else if(t.dataset.wire&&t.dataset.wireKey){
        const value=t.dataset.wireKey==='lengthCm'?(t.value.trim()===''?null:Number(t.value)):t.value;
        e.updateWire(t.dataset.wire,t.dataset.wireKey,value);lastMessage='';
        show();
      }
    }catch(ex){lastMessage=String(ex?.message||ex);show();}
  });
 }
 window.PCBProHarnessUIV131={version:VERSION,mount:show,render:show};
})();