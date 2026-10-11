(() => {
 'use strict';
 if(window.PCBProSystemStudio)return;
 const VERSION='1.30.0';
 const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 const fmt=(n,d=2)=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('id-ID',{maximumFractionDigits:d}):'—';
 const api=()=>window.PCBProSystemArchitect;
 let evidence=null;
 function style(){
   if(document.getElementById('system-studio-style-v130'))return;
   const s=document.createElement('style');s.id='system-studio-style-v130';
   s.textContent=[
    '.sb-root{height:100%;overflow:auto;background:var(--sl-bg,#f5f7fa);color:var(--sl-ink,#172332);padding:20px;font:13px/1.55 system-ui}',
    '.sb-root *{box-sizing:border-box}.sb-wrap{max-width:1500px;margin:auto}',
    '.sb-head{display:flex;justify-content:space-between;align-items:start;gap:15px;flex-wrap:wrap}',
    '.sb-head h2{margin:5px 0;font-size:25px;letter-spacing:-.035em}',
    '.sb-head p,.sb-desc{color:var(--sl-muted,#586b7f);font-size:12px;line-height:1.7}',
    '.sb-tag{font:750 11px ui-monospace;color:var(--sl-accent-text,#087d80);letter-spacing:.09em}',
    '.sb-actions{display:flex;gap:7px;flex-wrap:wrap;align-items:center}',
    '.sb-root button{background:var(--sl-surface,#fff);border:1px solid var(--sl-border,#e0e6ed);color:var(--sl-ink,#172332);border-radius:9px;padding:9px 12px;cursor:pointer;font:650 12px system-ui}',
    '.sb-root button:hover{border-color:var(--sl-accent,#087d80)}.sb-root button.primary{background:var(--sl-accent,#087d80);color:#fff;border-color:var(--sl-accent,#087d80)}',
    '.sb-warn{border:1px solid var(--sl-warn-line,#ebd4a4);background:var(--sl-warn-bg,#fff7e6);color:var(--sl-warn-ink,#805519);border-radius:9px;padding:12px;margin:12px 0;font-size:12px}',
    '.sb-templates{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:13px 0}',
    '.sb-templates button{text-align:left;display:grid;align-content:start;gap:7px;padding:13px;min-height:86px;border-radius:11px}',
    '.sb-templates button.selected{background:var(--sl-accent-soft,#e6f6f4);border-color:var(--sl-accent,#087d80)}',
    '.sb-templates b{font-size:13px}.sb-templates span{font-size:11px;color:var(--sl-muted,#586b7f)}',
    '.sb-layout{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(280px,.6fr);gap:12px;align-items:start}',
    '.sb-card{background:var(--sl-surface,#fff);border:1px solid var(--sl-border,#e0e6ed);border-radius:12px;padding:15px;margin-bottom:12px;box-shadow:var(--sl-shadow,none)}',
    '.sb-card h3{font-size:15px;margin:0 0 10px}.sb-card p{color:var(--sl-muted,#586b7f);font-size:12px}',
    '.sb-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:9px}',
    '.sb-field{display:grid;gap:5px;color:var(--sl-muted,#586b7f);font-size:12px}',
    '.sb-field input,.sb-field textarea{width:100%;border:1px solid var(--sl-border,#e0e6ed);border-radius:8px;background:var(--sl-surface-alt,#f8fafc);color:var(--sl-ink,#172332);padding:9px;min-height:36px;font:13px system-ui}',
    '.sb-field textarea{resize:vertical;line-height:1.6}.sb-full{grid-column:1/-1}',
    '.sb-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}',
    '.sb-metric{background:var(--sl-surface-alt,#f8fafc);border:1px solid var(--sl-border,#e0e6ed);border-radius:9px;padding:10px}',
    '.sb-metric b{font-size:18px;display:block;overflow-wrap:anywhere}.sb-metric span{font-size:11px;color:var(--sl-muted,#586b7f)}',
    '.sb-table-wrap{overflow:auto;border:1px solid var(--sl-border,#e0e6ed);border-radius:9px;max-height:470px}',
    '.sb-root table{border-collapse:collapse;min-width:1050px;width:100%}.sb-root th,.sb-root td{padding:7px;border-bottom:1px solid var(--sl-border,#e0e6ed);text-align:left;white-space:nowrap}',
    '.sb-root th{background:var(--sl-surface-alt,#f8fafc);color:var(--sl-muted,#586b7f);font-size:11px;position:sticky;top:0;z-index:1}',
    '.sb-root td input,.sb-root td select{background:var(--sl-surface-alt,#f8fafc);color:var(--sl-ink,#172332);border:1px solid var(--sl-border,#e0e6ed);border-radius:7px;padding:7px;font-size:11px;width:77px}',
    '.sb-root td input.sb-name{width:170px}.sb-root td input.sb-pins{width:145px}.sb-root td select{width:110px}',
    '.sb-root td input[type=checkbox]{width:18px;height:18px;accent-color:var(--sl-accent,#087d80)}',
    '.sb-issues{display:grid;gap:7px;max-height:380px;overflow:auto}',
    '.sb-issue{background:var(--sl-surface-alt,#f8fafc);padding:9px;border:1px solid var(--sl-border,#e0e6ed);border-left:3px solid var(--sl-accent,#087d80);border-radius:8px}',
    '.sb-issue.blocker{border-left-color:#be5148}.sb-issue.review{border-left-color:#d0a04b}',
    '.sb-issue b{font:700 11px ui-monospace}.sb-issue p{margin:5px 0 0}',
    '.sb-pills{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}',
    '.sb-pill{background:var(--sl-surface-alt,#f8fafc);border:1px solid var(--sl-border,#e0e6ed);color:var(--sl-muted,#586b7f);border-radius:7px;padding:6px 9px;font-size:11px}',
    '.sb-note{font-size:11px!important;line-height:1.65!important}',
    '.sb-root details{background:var(--sl-surface-alt,#f8fafc);border:1px solid var(--sl-border,#e0e6ed);border-radius:8px;padding:9px}',
    '.sb-tree{overflow:auto;border:1px solid var(--sl-border,#e0e6ed);background:var(--sl-surface-alt,#f8fafc);border-radius:10px}.sb-tree svg{display:block;width:100%;min-width:625px;height:auto}',
    '.sb-root summary{cursor:pointer;font-weight:700}.sb-empty{text-align:center;padding:28px!important;color:var(--sl-muted,#586b7f)}',
    '@media(max-width:1100px){.sb-layout{grid-template-columns:1fr}.sb-templates{grid-template-columns:repeat(2,minmax(0,1fr))}}',
    '@media(max-width:600px){.sb-root{padding:10px}.sb-head h2{font-size:20px}.sb-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}'
   ].join('');
   document.head.appendChild(s);
 }
 const input=(label,key,value)=>'<label class="sb-field"><span>'+esc(label)+'</span><input data-config="'+esc(key)+'" '+(key==='name'?'type="text" maxlength="120"':'type="number" step="any"')+' value="'+esc(value??'')+'"></label>';
 function cell(d,key){
  const a='data-module="'+esc(d.id)+'" data-key="'+key+'"';
  if(key==='name')return '<input class="sb-name" type="text" maxlength="160" '+a+' value="'+esc(d.name)+'">';
  if(key==='kind')return '<select '+a+'>'+['controller','sensor','actuator','power','network','safety','mechanical','other'].map(x=>'<option value="'+x+'" '+(d.kind===x?'selected':'')+'>'+x+'</option>').join('')+'</select>';
  if(key==='interface')return '<select '+a+'>'+['none','gpio','adc','pwm','i2c','spi','uart'].map(x=>'<option value="'+x+'" '+(d.interface===x?'selected':'')+'>'+x.toUpperCase()+'</option>').join('')+'</select>';
  if(key==='powerRequired'||key==='tested')return '<input type="checkbox" '+a+' '+(d[key]?'checked':'')+' aria-label="'+esc(key)+' '+esc(d.id)+'">';
  if(key==='pins')return '<input class="sb-pins" type="text" placeholder="GPIO21,GPIO22" '+a+' value="'+esc(d.pins.join(','))+'">';
  if(key==='i2cAddress')return '<input type="text" placeholder="0x40" '+a+' value="'+esc(d.i2cAddress??'')+'">';
  return '<input type="number" step="any" placeholder="—" '+a+' value="'+esc(d[key]??'')+'">';
 }
 function nav(view){
  const tab=[...document.querySelectorAll('.tabs button')].find(x=>x.textContent?.trim()===view);
  if(tab)tab.click();
 }
 function powerTree(p){
  const devices=p.devices.slice(0,12),height=Math.max(220,90+devices.length*55);
  const nodes=devices.map((d,i)=>{
   const y=55+i*55,mid=y+22;
   const label=d.name.length>35?d.name.slice(0,34)+'…':d.name;
   const meta=(d.railV===null?'tegangan belum diisi':String(d.railV)+' V')+' · '+d.interface.toUpperCase();
   return '<path d="M270 '+mid+' H334" stroke="var(--sl-accent,#087d80)" stroke-width="2" stroke-dasharray="6 5" fill="none"/>'+
    '<rect x="335" y="'+y+'" width="585" height="44" rx="8" fill="var(--sl-surface-alt,#f8fafc)" stroke="var(--sl-border,#e0e6ed)"/>'+
    '<text x="352" y="'+(y+18)+'" fill="var(--sl-ink,#172332)" font-size="13" font-family="system-ui">'+esc(d.id+' · '+label)+'</text>'+
    '<text x="352" y="'+(y+34)+'" fill="var(--sl-muted,#586b7f)" font-size="10" font-family="system-ui">'+esc(meta)+'</text>';
  }).join('');
  const end=devices.length?55+(devices.length-1)*55+22:115;
  return '<div class="sb-tree"><svg viewBox="0 0 950 '+height+'" role="img" aria-label="Power tree konseptual, bukan PCB routing">'+
   '<rect x="18" y="75" width="185" height="85" rx="12" fill="var(--sl-accent-soft,#e6f6f4)" stroke="var(--sl-accent,#087d80)"/>'+
   '<text x="34" y="99" fill="var(--sl-accent-text,#086d71)" font-size="14" font-family="system-ui" font-weight="700">SOURCE / SUPPLY</text>'+
   '<text x="34" y="121" fill="var(--sl-ink,#172332)" font-size="16" font-family="system-ui">'+esc(p.supply.voltageV===null?'Tegangan belum diisi':p.supply.voltageV+' V')+'</text>'+
   '<text x="34" y="141" fill="var(--sl-muted,#586b7f)" font-size="11" font-family="system-ui">Konverter belum dimodelkan</text>'+
   '<path d="M203 115 H270 V'+end+'" stroke="var(--sl-accent,#087d80)" stroke-dasharray="6 5" stroke-width="2" fill="none"/>'+
   nodes+'<text x="20" y="'+(height-15)+'" fill="var(--sl-muted,#586b7f)" font-size="11" font-family="system-ui">Dependensi konseptual, bukan koneksi listrik/pin.</text>'+
   '</svg></div><p class="sb-note">'+(p.devices.length>12?'12 dari '+p.devices.length+' modul ditampilkan. ':'')+
   'Ini hanya arsitektur; koneksi skematik dan PCB routing harus dibuat serta diuji secara terpisah.</p>';
 }
 function csv(){
  const p=api().snapshot();
  const rows=[['Ref','Modul','Jenis','Interface','Pins controller','I2C address','Rail V','I nominal A','I peak A','Jam per hari','Perlu daya','Diuji fisik','Catatan']];
  for(const d of p.devices)rows.push([d.id,d.name,d.kind,d.interface,d.pins.join('|'),d.i2cAddress??'',d.railV??'',d.nominalA??'',d.peakA??'',d.hoursPerDay??'',d.powerRequired?'YES':'NO',d.tested?'YES':'NO',d.notes]);
  function cellCsv(v){let s=String(v??'');if(/^[=+@\t\r-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
  return rows.map(x=>x.map(cellCsv).join(',')).join('\r\n')+'\r\n';
 }
 function saveCsv(){
  const url=URL.createObjectURL(new Blob([csv()],{type:'text/csv'}));
  const a=document.createElement('a');a.href=url;a.download='sirkuitlab-system-bom.csv';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1600);
 }
 function runCheck(){
  if(!window.PCBProVerificationV125?.inspect)throw Error('Engineering VERIFY belum dimuat.');
  evidence=window.PCBProVerificationV125.inspect();
  render();
 }
 function render(){
  const root=document.querySelector('[data-system-builder-root]'),arch=api();
  if(!root||!arch)return;
  style();
  const project=arch.snapshot(),report=arch.analyze(project),p=report.power||{},
    bad=report.issues.filter(x=>x.severity==='blocker').length;
  const columns=['name','kind','interface','railV','nominalA','peakA','hoursPerDay','pins','i2cAddress','powerRequired','tested'];
  root.innerHTML='<div class="sb-wrap"><header class="sb-head"><div><span class="sb-tag">SIRKUITLAB / SYSTEM BLUEPRINT · 1.30</span>'+
   '<h2>Dari ide menjadi rancangan sistem yang bisa diuji.</h2><p>Pilih contoh proyek, isi kebutuhan daya dan jalur sinyal berdasarkan data komponen, lalu lanjutkan ke schematic dan routing PCB asli.</p></div>'+
   '<div class="sb-actions"><button data-action="json">Export JSON</button><button data-action="csv">BOM CSV</button><button class="primary" data-action="verify">Cek proyek aktual</button></div></header>'+
   '<div class="sb-warn"><b>BLUEPRINT ≠ RANGKAIAN SIAP DIPASANG.</b> Semua rating komponen kosong sampai lu mengisinya. Pemeriksaan power tree ini belum menghitung rugi converter, inrush, proteksi, EMI atau keselamatan instalasi. Hasilnya tidak boleh dipakai untuk menyetujui instalasi AC.</div>'+
   (arch.loadIssue?'<div class="sb-warn">'+esc(arch.loadIssue)+'</div>':'')+
   '<div class="sb-templates">'+arch.templates.map(t=>'<button data-template="'+esc(t.id)+'" class="'+(project.template===t.id?'selected':'')+'"><b>'+esc(t.name)+'</b><span>'+esc(t.subtitle)+'</span></button>').join('')+'</div>'+
   '<div class="sb-layout"><main>'+
   '<section class="sb-card"><h3>01 / Tujuan & catu daya utama</h3><div class="sb-fields">'+
   input('Nama proyek','name',project.name)+input('Supply voltage (V)','voltageV',project.supply.voltageV)+
   input('Kemampuan kontinu (A)','continuousA',project.supply.continuousA)+input('Kemampuan peak (A)','peakA',project.supply.peakA)+
   '<label class="sb-field sb-full"><span>Tujuan / kriteria gagal</span><textarea rows="3" maxlength="1400" data-config="goal">'+esc(project.goal)+'</textarea></label></div></section>'+
   '<section class="sb-card"><div class="sb-head"><h3>02 / Modul dan alokasi GPIO</h3><button data-action="add">+ Modul</button></div>'+
   '<p>Isi pin <b>pada controller</b>, bukan nama pin konektor modul. Untuk I²C urutan harus SDA,SCL. Semua data daya berasal dari datasheet atau pengukuran pengguna.</p>'+
   '<div class="sb-table-wrap"><table><thead><tr><th>ID</th>'+['Modul','Kategori','Bus','Rail V','Nom A','Peak A','Jam/hari','Pins controller','I²C addr','Daya','Diuji',''].map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+
   (project.devices.length?project.devices.map(d=>'<tr><td><b>'+esc(d.id)+'</b></td>'+columns.map(k=>'<td>'+cell(d,k)+'</td>').join('')+
    '<td><button data-action="remove" data-id="'+esc(d.id)+'">Hapus</button></td></tr>').join(''):
    '<tr><td colspan="13" class="sb-empty">Belum ada modul. Pilih template atau klik + Modul.</td></tr>')+
   '</tbody></table></div>'+
   '<p class="sb-note">I²C boleh berbagi dua GPIO pada bus yang sama, asalkan alamat 7-bit berbeda. Pin ganda pada protokol lain ditandai konflik; ini belum memvalidasi pinout ESP32 tertentu.</p></section>'+
   '<section class="sb-card"><h3>03 / Power tree konseptual</h3>'+powerTree(project)+'</section>'+
   '<section class="sb-card"><h3>04 / Buka editor untuk implementasi</h3><p>Blueprint sengaja tidak membuat wiring/PCB otomatis yang bisa salah. Cocokkan datasheet dan bentuk netlist di editor asli.</p>'+
   '<div class="sb-actions">'+['Learning','Schematic','PCB','Electrical','Rules','Fabrication'].map(x=>'<button data-view="'+x+'">'+x+' →</button>').join('')+'</div></section>'+
   '</main><aside><section class="sb-card"><h3>Power budget awal</h3><div class="sb-metrics">'+
   '<div class="sb-metric"><b>'+fmt(p.nominalLoadW)+' W</b><span>Beban nominal</span></div>'+
   '<div class="sb-metric"><b>'+fmt(p.peakLoadW)+' W</b><span>Beban peak</span></div>'+
   '<div class="sb-metric"><b>'+fmt(p.dailyWh)+' Wh</b><span>Energi/hari</span></div></div>'+
   '<div class="sb-pills"><span class="sb-pill">Supply kontinu: '+fmt(p.sourceContinuousW)+' W</span><span class="sb-pill">Supply peak: '+fmt(p.sourcePeakW)+' W</span></div>'+
   '<p class="sb-note">Jika ada data beban belum lengkap, hasil terkait tampil —. Jumlah W lintas rail hanya pendekatan kebutuhan output, bukan analisis konverter atau jaminan catu aman.</p></section>'+
   '<section class="sb-card"><h3>Review rekayasa</h3><div class="sb-pills"><span class="sb-pill">'+bad+' blocker</span><span class="sb-pill">'+(report.issues.length-bad)+' review</span><span class="sb-pill">'+report.coverage.complete+'/'+report.coverage.required+' data terisi</span></div>'+
   '<p class="sb-note">'+esc(report.status)+' — kelengkapan data bukan nilai keselamatan.</p>'+
   '<div class="sb-issues">'+report.issues.slice(0,25).map(x=>'<div class="sb-issue '+esc(x.severity)+'"><b>'+esc(x.code)+' · '+esc(x.ref)+'</b><p>'+esc(x.message)+'</p></div>').join('')+
   (report.issues.length>25?'<p>Temuan tambahan dapat dilihat di export JSON.</p>':'')+'</div></section>'+
   '<section class="sb-card"><h3>VERIFY proyek PCB aktual</h3>'+
   (evidence?'<div class="sb-pills"><span class="sb-pill">'+esc(evidence.verdict)+'</span><span class="sb-pill">'+evidence.summary.blockers+' blockers</span><span class="sb-pill">'+evidence.summary.warnings+' warnings</span></div>'+
   '<details><summary>Lihat '+evidence.findings.length+' temuan</summary><div class="sb-issues">'+evidence.findings.slice(0,25).map(x=>'<div class="sb-issue '+(x.severity==='blocker'?'blocker':'review')+'"><b>'+esc(x.code)+'</b><p>'+esc(x.details)+'</p></div>').join('')+'</div></details>':
   '<p>Belum diperiksa sesi ini. Tombol Cek proyek aktual memanggil integrity, SPICE coverage, physical DRC dan manufacturing preflight dari proyek yang aktif.</p>')+
   '</section></aside></div></div>';
  if(root.dataset.boundBuilder==='1')return;
  root.dataset.boundBuilder='1';
  root.addEventListener('click',e=>{
   const view=e.target.closest?.('[data-view]');if(view){nav(view.dataset.view);return;}
   const tmpl=e.target.closest?.('[data-template]');
   if(tmpl){
    if(arch.snapshot().devices.length&&!confirm('Ganti blueprint dan hapus modul blueprint saat ini? Ekspor JSON dahulu jika ingin mengarsipkan.'))return;
    try{arch.useTemplate(tmpl.dataset.template);evidence=null;render();}catch(err){alert(err.message)}
    return;
   }
   const b=e.target.closest?.('[data-action]');if(!b)return;
   try{
    if(b.dataset.action==='add'){arch.addDevice();evidence=null;render();}
    if(b.dataset.action==='remove'){arch.removeDevice(b.dataset.id);evidence=null;render();}
    if(b.dataset.action==='json')arch.exportJson();
    if(b.dataset.action==='csv')saveCsv();
    if(b.dataset.action==='verify')runCheck();
   }catch(err){alert(err.message);}
  });
  root.addEventListener('change',e=>{
   const el=e.target,key=el.dataset?.config,id=el.dataset?.module,field=el.dataset?.key;
   if(!key&&!field)return;
   try{
    if(key)arch.configure(key,['name','goal','notes'].includes(key)?el.value:(el.value.trim()===''?null:Number(el.value)));
    else{
     let val;
     if(['powerRequired','tested'].includes(field))val=el.checked;
     else if(['railV','nominalA','peakA','hoursPerDay'].includes(field))val=el.value.trim()===''?null:Number(el.value);
     else if(field==='pins')val=el.value.split(/[,;\s]+/).filter(Boolean);
     else if(field==='i2cAddress')val=el.value.trim()||null;
     else val=el.value;
     arch.updateDevice(id,field,val);
    }
    evidence=null;
   }catch(err){alert(String(err.message||err));}
   render();
  });
 }
 function start(){
  style();render();
  document.addEventListener('click',e=>{
   const tab=e.target.closest?.('.tabs button');
   if(tab?.textContent?.trim()==='Builder')setTimeout(render,0);
  },{passive:true});
 }
 window.PCBProSystemStudio={version:VERSION,render,mount:render,csv,saveCsv,get evidence(){return evidence}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();