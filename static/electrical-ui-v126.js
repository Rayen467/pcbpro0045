(() => {
  'use strict';
  if(window.PCBProElectricalUI)return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=(n,d=2)=>Number.isFinite(n)?n.toLocaleString('id-ID',{maximumFractionDigits:d}):'—';
  const core=()=>window.PCBProElectrical;
  const field=(label,key,v)=>'<label><span>'+esc(label)+'</span><input data-config="'+esc(key)+'" value="'+esc(v??'')+'" '+(key==='title'?'type="text" maxlength="120"':'type="number" step="any"')+'></label>';
  function tableInput(c,k,s){
    const attrs='data-circuit="'+esc(c.id)+'" data-field="'+esc(k)+'"';
    if(k==='mode')return '<select '+attrs+'><option value="1p">1Φ</option>'+(s.supply.mode==='3p'?'<option value="3p" '+(c.mode==='3p'?'selected':'')+'>3Φ</option>':'')+'</select>';
    if(k==='phase')return '<select '+attrs+' '+(c.mode==='3p'?'disabled':'')+'>'+['L1','L2','L3'].map(v=>'<option value="'+v+'" '+(c.phase===v?'selected':'')+'>'+v+'</option>').join('')+'</select>';
    if(k==='name')return '<input type="text" maxlength="90" class="el-name" '+attrs+' value="'+esc(c.name)+'">';
    return '<input type="number" step="any" '+attrs+' value="'+esc(c[k]??'')+'">';
  }
  function style(){
    if(document.getElementById('sirkuitlab-electrical-style'))return;
    const el=document.createElement('style');el.id='sirkuitlab-electrical-style';
    el.textContent=[
      '.el-root{height:100%;overflow:auto;padding:17px;background:#091821;color:#dbeaf1;font:13px/1.5 system-ui;box-sizing:border-box}',
      '.el-root *{box-sizing:border-box}.el-header{display:flex;align-items:start;justify-content:space-between;gap:16px;flex-wrap:wrap}',
      '.el-header h2{margin:3px 0;font-size:24px;color:#e8f8f5}.el-header p{margin:0;color:#91afbc;max-width:630px}',
      '.el-tag{color:#66d7bf;font:800 11px ui-monospace;letter-spacing:.08em}.el-buttons{display:flex;flex-wrap:wrap;gap:7px}',
      '.el-root button{background:#173541;border:1px solid #416270;border-radius:7px;padding:8px 10px;color:#e9f6f9;cursor:pointer;font-weight:700}',
      '.el-root button.primary{background:#18745f;border-color:#33a78e}.el-warn{padding:12px;border:1px solid #866438;background:#302618;color:#efcf8b;border-radius:8px;margin:13px 0;font-size:12px}',
      '.el-panel{background:#0d222b;border:1px solid #30505b;border-radius:11px;padding:14px;margin:12px 0}.el-panel h3{font-size:15px;margin:0 0 9px}',
      '.el-inputs{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:9px}',
      '.el-inputs label{display:grid;gap:5px;color:#aec4cc}.el-inputs input,.el-inputs select{width:100%;min-width:0;padding:9px;border:1px solid #3a5b66;background:#0a1a22;color:white;border-radius:6px}',
      '.el-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(162px,1fr));gap:9px}',
      '.el-cards article{padding:12px;background:#102c36;border:1px solid #31535d;border-radius:9px;display:grid;gap:4px}',
      '.el-cards b{font:700 21px ui-monospace;color:#d3f5ed}.el-cards small{color:#96b3be}.el-scroller{max-height:420px;overflow:auto;border:1px solid #31505d;border-radius:7px}',
      '.el-root table{border-collapse:collapse;min-width:100%;width:max-content}.el-root th,.el-root td{padding:7px;border-bottom:1px solid #294752;white-space:nowrap}',
      '.el-root th{position:sticky;top:0;background:#173541;color:#c1d8df;text-align:left}',
      '.el-root td input,.el-root td select{background:#0a1a23;color:#ebf9fa;border:1px solid #395a65;border-radius:5px;padding:7px;width:73px;font-size:12px}',
      '.el-root td input.el-name{width:140px}.el-root td select:disabled{opacity:.4}.el-bottom{display:grid;grid-template-columns:1.25fr .75fr;gap:12px}',
      '.el-svg{overflow:auto;border-radius:7px;border:1px solid #32505b}.el-svg svg{min-width:420px;width:100%;height:auto;display:block}',
      '.el-review{max-height:310px;overflow:auto}.el-review article{border-left:3px solid #d4a453;background:#102933;border-radius:5px;margin:6px 0;padding:8px}',
      '.el-review b{font:800 11px ui-monospace;color:#eed098}.el-review p{margin:4px 0 0;color:#b5cfd7}',
      '.el-foot{font-size:11px;color:#9eb7c0;line-height:1.7}.el-empty{padding:25px!important;text-align:center;color:#a9c2cb}',
      '@media(max-width:930px){.el-bottom{grid-template-columns:1fr}.el-root{padding:10px}.el-header h2{font-size:20px}}'
    ].join('');
    document.head.appendChild(el);
  }
  function render(){
    const root=document.querySelector('[data-electrical-root]');
    if(!root||!core())return;
    const project=core().snapshot(),report=core().calculate(project),sum=report.summary;
    if(!sum)return;
    style();
    const cols=['name','mode','phase','watts','quantity','pf','demand','lengthM','sectionMm2','tempC','breakerA','reactanceOhmKm'];
    const head=['Nama','Fasa','Lajur','W/unit','Qty','PF','Demand','m','Cu mm²','Cu °C','Breaker A','X Ω/km'];
    const rows=report.circuits.map(c=>'<tr><td>'+esc(c.id)+'</td>'+cols.map(k=>'<td>'+tableInput(c,k,project)+'</td>').join('')+
      '<td>'+fmt(c.currentA)+'</td><td>'+fmt(c.drop.percent)+'</td><td><button data-action="remove" data-id="'+esc(c.id)+'">Hapus</button></td></tr>').join('');
    const ph=sum.phaseCurrent;
    root.innerHTML=
      '<header class="el-header"><div><span class="el-tag">SIRKUITLAB · ELECTRICAL ENGINEERING v1.26</span><h2>Sistem Elektro</h2>'+
      '<p>Workspace perencanaan awal kelistrikan tegangan rendah: sumber AC, panel, load schedule, voltage drop dan diagram satu garis.</p></div>'+
      '<div class="el-buttons"><button class="primary" data-action="add">+ Circuit</button><button data-action="csv">Load schedule CSV</button><button data-action="svg">Diagram SVG</button><button data-action="json">Report JSON</button></div></header>'+
      '<div class="el-warn"><b>PERENCANAAN AWAL · BUKAN GAMBARKERJA / PERSETUJUAN INSTALASI.</b> Pemilihan kabel, MCB, RCD, pembumian, hubung singkat, derating dan inspeksi harus diverifikasi profesional berdasarkan PUIL.</div>'+
      (core().notice?'<div class="el-warn">'+esc(core().notice)+'</div>':'')+
      '<section class="el-panel"><h3>01 / Sumber dan kabel feeder</h3><div class="el-inputs">'+
      field('Nama proyek','title',project.title)+
      '<label><span>Pasokan</span><select data-config="mode"><option value="1p" '+(project.supply.mode==='1p'?'selected':'')+'>1Φ L–N</option><option value="3p" '+(project.supply.mode==='3p'?'selected':'')+'>3Φ L–L</option></select></label>'+
      field('Tegangan (V)','voltageV',project.supply.voltageV)+
      field('Panjang feeder (m)','lengthM',project.feeder.lengthM)+
      field('Penampang Cu (mm²)','sectionMm2',project.feeder.sectionMm2)+
      field('Temperatur Cu (°C)','tempC',project.feeder.tempC)+
      field('Reaktansi feeder X (Ω/km)','reactanceOhmKm',project.feeder.reactanceOhmKm)+'</div></section>'+
      '<div class="el-cards"><article><span>Total daya aktif</span><b>'+fmt(sum.watts)+' W</b><small>Daya × kuantitas × demand</small></article>'+
      '<article><span>Daya semu total</span><b>'+fmt(sum.va)+' VA</b><small>Σ P / PF</small></article>'+
      '<article><span>Arus fase terbesar</span><b>'+fmt(sum.peak)+' A</b><small>L1 '+fmt(ph.L1)+' · L2 '+fmt(ph.L2)+' · L3 '+fmt(ph.L3)+'</small></article>'+
      '<article><span>Drop feeder indikatif</span><b>'+fmt(sum.feeder.percent)+'%</b><small>'+fmt(sum.feeder.volts)+' V · Cu resistif</small></article></div>'+
      '<section class="el-panel"><h3>02 / Panel dan sirkuit beban</h3><div class="el-scroller"><table><thead><tr><th>ID</th>'+head.map(x=>'<th>'+x+'</th>').join('')+'<th>Arus A</th><th>Drop %</th><th></th></tr></thead><tbody>'+
      (rows||'<tr><td colspan="16" class="el-empty">Belum ada circuit. Klik + Circuit untuk memulai.</td></tr>')+
      '</tbody></table></div></section>'+
      '<div class="el-bottom"><section class="el-panel"><h3>03 / Diagram satu garis (SLD preview)</h3><div class="el-svg">'+core().sld()+'</div></section>'+
      '<section class="el-panel"><h3>04 / Engineering review</h3><div class="el-review">'+report.findings.map(x=>'<article><b>'+esc(x.code)+(x.ref?' · '+esc(x.ref):'')+
      '</b><p>'+esc(x.message)+'</p></article>').join('')+'</div><p class="el-foot">Acuan pengembangan: PUIL 2020 / SNI 0225 dan prinsip IEC 60364. Asumsi konduktor Cu ρ20=0,017241 Ω·mm²/m, α=0,00393/°C. Bila X kabel kosong, estimasi drop belum memperhitungkan reaktansi. Penanda 5% adalah flag tinjauan ilustratif, bukan batas standar yang diverifikasi.</p></section></div>';
    if(root.dataset.listener==='1')return;
    root.dataset.listener='1';
    root.addEventListener('click',ev=>{
      const el=ev.target.closest('[data-action]');if(!el)return;
      try{
        if(el.dataset.action==='add'){core().add();render();}
        if(el.dataset.action==='remove'){core().remove(el.dataset.id);render();}
        if(['csv','svg','json'].includes(el.dataset.action))core().exportFile(el.dataset.action);
      }catch(e){alert(String(e?.message||e));}
    });
    root.addEventListener('change',ev=>{
      const el=ev.target,key=el.dataset.config,circuit=el.dataset.circuit,prop=el.dataset.field;
      if(!key&&!prop)return;
      const text=key==='title'||key==='mode'||['name','mode','phase'].includes(prop);
      const value=text?el.value:el.value.trim()===''?null:Number(el.value);
      try{
        if(key)core().configure(key,value);else core().update(circuit,prop,value);
      }catch(e){alert(String(e?.message||e));}
      render();
    });
  }
  function start(){
    style();render();
    document.addEventListener('click',ev=>{
      const b=ev.target?.closest?.('.tabs button');
      if(b && b.textContent?.trim()==='Electrical')setTimeout(render,0);
    },{passive:true});
  }
  window.PCBProElectricalUI={version:'1.26.0',mount:render,render};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();