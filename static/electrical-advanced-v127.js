(() => {
  'use strict';
  if(window.PCBProElectricalAdvanced) return;
  const VERSION='1.27.0';
  const number=v=>typeof v==='number'&&Number.isFinite(v);
  const fmt=(v,d=2)=>number(v)?v.toLocaleString('id-ID',{maximumFractionDigits:d}):'—';
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const toNum=s=>s===''?null:Number(s);
  const defaults=()=>({pvKWp:0,pvHourlyFactors:null,batteryCapacityKWh:0,batteryMaxKW:null,
    roundtripEfficiency:null,reserveSocPercent:null,tariffRpKWh:null,exportEnabled:false,exportTariffRpKWh:null});
  function energyConfig(project){return {...defaults(),...(project.advanced?.energy||{})};}
  function validate(project) {
    const errors=[],err=(field,message)=>errors.push({field,message});
    if(!project || !Array.isArray(project.circuits))return {ok:false,errors:[{field:'project',message:'Project missing circuits'}]};
    const cfg=energyConfig(project);
    if(!number(cfg.pvKWp)||cfg.pvKWp<0||cfg.pvKWp>1e7)err('pvKWp','PV nameplate must be 0-10,000,000 kWp.');
    if(cfg.pvHourlyFactors!==null){
      if(!Array.isArray(cfg.pvHourlyFactors)||cfg.pvHourlyFactors.length!==24||
        cfg.pvHourlyFactors.some(v=>!number(v)||v<0||v>1))err('pvHourlyFactors','24 hourly factors (0-1) required.');
    }
    if(!number(cfg.batteryCapacityKWh)||cfg.batteryCapacityKWh<0||cfg.batteryCapacityKWh>1e8)err('batteryCapacityKWh','Battery energy capacity invalid.');
    if(cfg.batteryCapacityKWh>0){
      if(!number(cfg.batteryMaxKW)||cfg.batteryMaxKW<=0||cfg.batteryMaxKW>1e7)err('batteryMaxKW','Enter battery charge/discharge power.');
      if(!number(cfg.roundtripEfficiency)||cfg.roundtripEfficiency<=0||cfg.roundtripEfficiency>1)err('roundtripEfficiency','Roundtrip efficiency (0-1] required.');
      if(!number(cfg.reserveSocPercent)||cfg.reserveSocPercent<0||cfg.reserveSocPercent>=100)err('reserveSocPercent','Enter battery reserve SOC 0-99.99%.');
    }
    if(cfg.tariffRpKWh!==null&&(!number(cfg.tariffRpKWh)||cfg.tariffRpKWh<0||cfg.tariffRpKWh>1e10))err('tariffRpKWh','Invalid input tariff.');
    if(typeof cfg.exportEnabled!=='boolean')err('exportEnabled','Export flag must be boolean.');
    if(cfg.exportTariffRpKWh!==null&&(!number(cfg.exportTariffRpKWh)||cfg.exportTariffRpKWh<0||cfg.exportTariffRpKWh>1e10))err('exportTariffRpKWh','Invalid export tariff.');
    for(const [i,c] of project.circuits.entries()){
      const path='circuits.'+i+'.';
      if(c.hoursPerDay!==undefined && c.hoursPerDay!==null &&
         (!number(c.hoursPerDay)||c.hoursPerDay<0||c.hoursPerDay>24))err(path+'hoursPerDay','Operating hours must be between 0 and 24.');
      if(c.startHour!==undefined&&c.startHour!==null&&(!Number.isInteger(c.startHour)||c.startHour<0||c.startHour>23))err(path+'startHour','Start hour must be 0-23.');
      if(c.category!==undefined&&!['general','motor','ev','hvac','it','other'].includes(c.category))err(path+'category','Unknown load category.');
      for(const key of ['prospectiveIkKA','breakerIcuKA','startingMultiplier']){
        if(c[key]!==undefined&&c[key]!==null&&(!number(c[key])||c[key]<=0||c[key]>100000))err(path+key,'Invalid positive value.');
      }
    }
    return {ok:errors.length===0,errors};
  }
  function overlap(hour,start,duration){
    // An hourly integration avoids rounding fractional operating hours and supports shifts past midnight.
    const end=start+duration;
    let result=0;
    for(const offset of [0,24]){
      const left=Math.max(hour+offset,start),right=Math.min(hour+offset+1,end);
      result+=Math.max(0,right-left);
    }
    return Math.min(1,result);
  }
  function phasors(basic){
    const angles={L1:0,L2:-2*Math.PI/3,L3:2*Math.PI/3};
    const sums={L1:{re:0,im:0},L2:{re:0,im:0},L3:{re:0,im:0}};
    const totals={L1:0,L2:0,L3:0};
    for(const c of basic.circuits){
      const lag=Math.acos(Math.max(0,Math.min(1,c.pf)));
      const targets=c.mode==='3p'?['L1','L2','L3']:[basic.supplyMode==='1p'?'L1':c.phase];
      for(const name of targets){
        sums[name].re+=c.currentA*Math.cos(angles[name]-lag);
        sums[name].im+=c.currentA*Math.sin(angles[name]-lag);
        totals[name]+=c.currentA;
      }
    }
    const re=Object.values(sums).reduce((s,i)=>s+i.re,0);
    const im=Object.values(sums).reduce((s,i)=>s+i.im,0);
    return {estimatedFundamentalNeutralA:Math.hypot(re,im),phaseSumOfMagnitudesA:totals,
      caveat:'Fundamental-frequency balanced sinusoidal model only; harmonic/triplen neutral currents and detailed cable phasors are NOT included.'};
  }
  function analyze(project=window.PCBProElectrical?.snapshot?.()){
    const issues=[],add=(severity,code,message,ref)=>issues.push({severity,code,message,...(ref?{ref}:{})});
    if(!project)return {ok:false,issues:[{severity:'blocker',code:'NO_PROJECT',message:'Electrical project not available.'}]};
    const checked=validate(project),base=window.PCBProElectrical?.calculate?.(project);
    if(!checked.ok||!base?.ok){
      return {ok:false,issues:[...checked.errors.map(x=>({severity:'blocker',code:'INVALID_SETTING',message:x.field+': '+x.message})),
        ...(base?.errors||[]).map(x=>({severity:'blocker',code:'INVALID_PROJECT',message:x.field+': '+x.message}))]};
    }
    const cfg=energyConfig(project);
    const basic={circuits:base.circuits,supplyMode:project.supply.mode};
    const neutral=phasors(basic);
    if(project.supply.mode==='3p'&&neutral.estimatedFundamentalNeutralA>0.1)
      add('review','NEUTRAL_FUNDAMENTAL','Perkiraan arus fundamental netral: '+fmt(neutral.estimatedFundamentalNeutralA)+' A; arus harmonisa belum dihitung.');
    for(const c of base.circuits){
      const original=project.circuits.find(x=>x.id===c.id);
      if(original.prospectiveIkKA==null||original.breakerIcuKA==null){
        add('review','FAULT_LEVEL_NOT_ENTERED','Belum ada nilai Ik prospektif dan/atau kemampuan pemutusan proteksi (Icu).',c.id);
      }else if(original.prospectiveIkKA>original.breakerIcuKA){
        add('blocker','BREAKING_CAPACITY_BELOW_FAULT','Icu input '+fmt(original.breakerIcuKA)+' kA lebih kecil daripada Ik input '+fmt(original.prospectiveIkKA)+' kA.',c.id);
      }else add('review','BREAKING_CAPACITY_ONLY','Icu ≥ Ik yang DIINPUT. Koordinasi proteksi, karakteristik trip, dan fault loop belum diverifikasi.',c.id);
      if(original.category==='motor'){
        if(original.startingMultiplier==null)add('review','MOTOR_INRUSH_UNKNOWN','Motor starting current tidak diketahui; isi pengali berdasarkan data peralatan.',c.id);
        else add('review','MOTOR_INRUSH_ESTIMATE','Estimasi arus starting '+fmt(c.currentA*original.startingMultiplier)+' A (pengali input); tidak memvalidasi kurva trip.',c.id);
      }
      if(original.category==='ev')add('review','EV_PROTECTION_REQUIRED','EVSE memerlukan evaluasi proteksi khusus termasuk residual DC fault, RCD, dan pengkabelan sesuai ketentuan lokal/IEC 60364-7-722.',c.id);
      if(original.hoursPerDay==null||original.startHour==null)add('review','OPERATING_HOURS_MISSING','Set jam mulai dan durasi/hari untuk estimasi energi.',c.id);
    }
    if(cfg.pvKWp>0 && cfg.pvHourlyFactors===null)add('blocker','PV_PROFILE_MISSING','Masukkan 24 faktor produksi PV berdasarkan data lokasi/cuaca atau pengukuran; tidak ada profil matahari default.');
    if(cfg.pvKWp>0)add('review','PV_INVERTER_UNMODELED','PV menggunakan profil input di titik produksi AC asumsi; rugi inverter, cuaca dan temperatur tidak dihitung otomatis.');
    if(cfg.batteryCapacityKWh>0)add('review','BATTERY_MODEL_SCOPE','Baterai memakai dispatch PV surplus dan model efisiensi sederhana; BMS, thermal runaway, fire safety dan lifetime tidak dimodelkan.');
    if(cfg.exportEnabled)add('review','EXPORT_PERMISSION','Ekspor energi ke jaringan bersifat hipotesis; izin, proteksi anti-islanding, dan aturan operator jaringan harus diverifikasi.');
    let profile=null;
    const fullyScheduled=project.circuits.every(c=>c.hoursPerDay!=null&&c.startHour!=null);
    if(fullyScheduled && !(cfg.pvKWp>0&&cfg.pvHourlyFactors===null)){
      const eta=cfg.batteryCapacityKWh>0?Math.sqrt(cfg.roundtripEfficiency):1;
      const reserve=cfg.batteryCapacityKWh* ((cfg.reserveSocPercent??0)/100);
      let soc=reserve,loadKWh=0,pvKWh=0,importKWh=0,exportKWh=0,curtailedKWh=0;
      let chargeKWh=0,dischargeKWh=0;
      const hourly=[];
      for(let hour=0;hour<24;hour++){
        const consumed=base.circuits.reduce((sum,c)=>{
          const actual=project.circuits.find(p=>p.id===c.id);
          return sum + c.activeW/1000*overlap(hour,actual.startHour,actual.hoursPerDay);
        },0);
        const generated=cfg.pvKWp*(cfg.pvHourlyFactors?.[hour]||0);
        let deficit=Math.max(0,consumed-generated),surplus=Math.max(0,generated-consumed);
        let charged=0,discharged=0;
        if(cfg.batteryCapacityKWh>0){
          const available=cfg.batteryCapacityKWh-soc;
          charged=Math.min(surplus,cfg.batteryMaxKW,Math.max(0,available)/eta);
          soc+=charged*eta;
          surplus-=charged;
          discharged=Math.min(deficit,cfg.batteryMaxKW,Math.max(0,soc-reserve)*eta);
          soc-=discharged/eta;
          deficit-=discharged;
        }
        const exported=cfg.exportEnabled?surplus:0;
        const curtailed=cfg.exportEnabled?0:surplus;
        loadKWh+=consumed;pvKWh+=generated;importKWh+=deficit;exportKWh+=exported;
        curtailedKWh+=curtailed;chargeKWh+=charged;dischargeKWh+=discharged;
        hourly.push({hour,loadKWh:consumed,pvKWh:generated,gridImportKWh:deficit,
          gridExportKWh:exported,curtailedKWh:curtailed,batterySOCkWh:soc,batteryChargeInputKWh:charged,batteryDischargeOutputKWh:discharged});
      }
      profile={hourly,loadKWh,pvKWh,gridImportKWh:importKWh,gridExportKWh:exportKWh,
        curtailedKWh,batteryChargeInputKWh:chargeKWh,batteryDischargeOutputKWh:dischargeKWh,
        batteryEndingSOCkWh:soc,gridCostRp:cfg.tariffRpKWh==null?null:importKWh*cfg.tariffRpKWh,
        hypotheticalExportRevenueRp:cfg.exportTariffRpKWh==null||!cfg.exportEnabled?null:exportKWh*cfg.exportTariffRpKWh};
    }
    add('review','ELECTRICAL_SIGNOFF_PENDING','Bukan approval instalasi: studi proteksi lengkap, ampacity, derating, harmonisa, pengukuran serta studi aliran daya fisik belum tersedia.');
    return {ok:!issues.some(x=>x.severity==='blocker'),analysisAvailable:!!profile,
      version:VERSION,neutral,profile,issues,coverage:{
        simulation:'deterministic-hourly-energy-only',externalMetersConnected:false,
        fullAcPowerFlow:false,realFaultCalculation:false,gridExportApproved:false
      }};
  }
  function patch(mutator){
    const project=window.PCBProElectrical?.snapshot?.();
    if(!project)throw Error('Electrical core unavailable.');
    const next=structuredClone(project);
    mutator(next);
    const v=validate(next);
    if(!v.ok)throw Error(v.errors.map(e=>e.field+': '+e.message).join('; '));
    window.PCBProElectrical.restore(next);
    window.PCBProElectricalUI?.render?.();
    return analyze(next);
  }
  function configure(key,value){return patch(p=>{p.advanced ||= {};p.advanced.energy={...energyConfig(p),[key]:value};});}
  function configureBattery(config){
    // Capacity, power, efficiency and SOC reserve must be committed together.
    return patch(p=>{p.advanced ||= {};p.advanced.energy={...energyConfig(p),...config};});
  }
  function updateCircuit(id,key,value){return patch(p=>{
    const c=p.circuits.find(x=>x.id===id);
    if(!c)throw Error('Circuit not found');
    c[key]=value;
  });}
  function setProfile(raw){
    const v=String(raw).split(/[,;\s]+/).filter(Boolean).map(Number);
    if(v.length!==24||v.some(n=>!number(n)||n<0||n>1))throw Error('Enter exactly 24 factors from 0 to 1.');
    return configure('pvHourlyFactors',v);
  }
  function exportReport(){
    const report=analyze();
    const blob=new Blob([JSON.stringify({project:window.PCBProElectrical.snapshot(),energyAnalysis:report,
      exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='sirkuitlab-electrical-energy-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
    return report;
  }
  function energyChart(profile){
    if(!profile)return '<p class="ea-muted">Lengkapi jam operasi setiap circuit dan profil PV bila PV diaktifkan. Grafik tidak memakai data buatan.</p>';
    const columns=profile.hourly;
    const max=Math.max(.1,...columns.flatMap(c=>[c.loadKWh,c.pvKWh,c.gridImportKWh]));
    const baseline=173,scale=140/max;
    let bars='';
    for(const h of columns){
      const x=26+h.hour*25;
      const load=h.loadKWh*scale,pv=h.pvKWh*scale,grid=h.gridImportKWh*scale;
      bars+='<rect x="'+x+'" y="'+(baseline-load)+'" width="5" height="'+load+'" fill="#b8d7e3"/>'+
        '<rect x="'+(x+7)+'" y="'+(baseline-pv)+'" width="5" height="'+pv+'" fill="#efb867"/>'+
        '<rect x="'+(x+14)+'" y="'+(baseline-grid)+'" width="5" height="'+grid+'" fill="#54cbb5"/>';
    }
    return '<svg viewBox="0 0 655 210" role="img" aria-label="Hourly load, PV, grid input in kWh">'+
      '<line x1="23" y1="173" x2="642" y2="173" stroke="#7898a6"/>'+
      bars+[0,4,8,12,16,20].map(n=>'<text x="'+(26+n*25)+'" y="191" fill="#8eaeb8" font-size="11">'+n+':00</text>').join('')+
      '<text x="23" y="21" fill="#8eaeb8" font-size="11">kWh per jam</text></svg>';
  }
  function mount(root=document.querySelector('[data-electrical-root]')){
    if(!root||!window.PCBProElectrical)return;
    root.querySelector('#ea-v127')?.remove();
    const p=window.PCBProElectrical.snapshot(),cfg=energyConfig(p),r=analyze(p),pf=r.profile;
    const section=document.createElement('section');
    section.id='ea-v127';
    section.className='el-panel';
    section.style.cssText='border-color:#355f6e;background:linear-gradient(145deg,#102730,#0c1b27)';
    const input=(title,key,value,attrs='')=>
      '<label class="ea-field"><span>'+esc(title)+'</span><input data-energy="'+esc(key)+'" value="'+esc(value??'')+'" type="number" step="any" '+attrs+'></label>';
    const circuitFields=p.circuits.map(c=>
      '<tr><td>'+esc(c.id)+'</td><td>'+esc(c.name)+'</td><td>'+
        '<select data-ref="'+esc(c.id)+'" data-advanced="category">'+
        [['general','Umum'],['motor','Motor'],['ev','EV Charger'],['hvac','HVAC'],['it','IT / Server'],['other','Lainnya']].map(([value,label])=>
          '<option value="'+value+'" '+((c.category||'general')===value?'selected':'')+'>'+label+'</option>').join('')+'</select></td>'+
        ['startHour','hoursPerDay','prospectiveIkKA','breakerIcuKA','startingMultiplier'].map(key=>
          '<td><input aria-label="'+esc(key)+' '+esc(c.id)+'" type="number" step="any" data-ref="'+esc(c.id)+'" data-advanced="'+key+'" value="'+esc(c[key]??'')+'" placeholder="—"></td>').join('')+
      '</tr>').join('');
    const m=r.neutral;
    section.innerHTML=
      '<details open><summary style="cursor:pointer;font:700 16px system-ui;color:#e1f3f2">05 / Energy Intelligence & Proteksi · v1.27</summary>'+
      '<p class="ea-muted">Energy profiling, PV, baterai dan proteksi awal. Input yang kosong ditampilkan sebagai belum diketahui—bukan diasumsikan aman.</p>'+
      '<div class="ea-metrics"><article><span>Arus fundamental netral (indikatif)</span><strong>'+fmt(m.estimatedFundamentalNeutralA)+' A</strong><small>Bukan studi harmonisa / netral sesungguhnya</small></article>'+
      '<article><span>Energi beban harian</span><strong>'+fmt(pf?.loadKWh)+' kWh</strong><small>Jadwal diisi manual</small></article>'+
      '<article><span>Impor energi grid</span><strong>'+fmt(pf?.gridImportKWh)+' kWh</strong><small>PV + dispatch baterai hipotesis</small></article>'+
      '<article><span>Estimasi biaya energi</span><strong>'+(pf?.gridCostRp==null?'Belum ada tarif':'Rp '+fmt(pf.gridCostRp,0))+'</strong><small>Tarif input, bukan tarif resmi PLN</small></article></div>'+
      '<h4 class="ea-h4">Profil beban, motor & kemampuan pemutusan</h4>'+
      '<div class="ea-table"><table><thead><tr><th>Ref</th><th>Nama</th><th>Jenis</th><th>Mulai (0-23)</th><th>Jam/hari</th><th>Ik (kA)</th><th>Icu (kA)</th><th>Starting × In</th></tr></thead><tbody>'+circuitFields+
        (p.circuits.length?'':'<tr><td colspan="8">Tambahkan circuit di tabel utama terlebih dahulu.</td></tr>')+'</tbody></table></div>'+
      '<h4 class="ea-h4">Sistem energi PV, baterai & grid</h4>'+
      '<div class="ea-inputs">'+input('PV kapasitas nameplate (kWp)','pvKWp',cfg.pvKWp)+
      input('Baterai (kWh)','batteryCapacityKWh',cfg.batteryCapacityKWh)+
      input('Daya baterai (kW)','batteryMaxKW',cfg.batteryMaxKW)+
      input('Roundtrip efficiency (0-1)','roundtripEfficiency',cfg.roundtripEfficiency)+
      input('Reserve SOC (%)','reserveSocPercent',cfg.reserveSocPercent)+
      input('Tarif energi (Rp/kWh)','tariffRpKWh',cfg.tariffRpKWh)+
      input('Tarif ekspor hipotetis (Rp/kWh)','exportTariffRpKWh',cfg.exportTariffRpKWh)+
      '<label class="ea-field"><span>Ekspor grid (hanya simulasi)</span><select data-energy="exportEnabled"><option value="false" '+(!cfg.exportEnabled?'selected':'')+'>Tidak, surplus dibatasi</option><option value="true" '+(cfg.exportEnabled?'selected':'')+'>Ya, hipotetis</option></select></label></div>'+
      '<label class="ea-field ea-profile"><span>24 faktor produksi PV AC per jam (0–1), berdasarkan data pengguna; pisahkan koma</span>'+
      '<textarea data-profile rows="2" placeholder="0,0,0,0,... (24 nilai)">'+esc(cfg.pvHourlyFactors?.join(',')??'')+'</textarea></label>'+
      '<div class="ea-actions"><button data-ea="battery">Simpan parameter baterai bersama</button><button data-ea="profile">Simpan profil PV 24 jam</button><button data-ea="report">Export energy & protection report JSON</button></div>'+
      '<div class="ea-chart">'+energyChart(pf)+'</div>'+
      '<div class="ea-key"><span>■ Beban</span><span>■ PV</span><span>■ Impor grid</span></div>'+
      (pf?'<p class="ea-muted">PV produksi: '+fmt(pf.pvKWh)+' kWh · Ekspor (hipotetis): '+fmt(pf.gridExportKWh)+' kWh · Curtailed: '+fmt(pf.curtailedKWh)+
        ' kWh · Battery akhir: '+fmt(pf.batteryEndingSOCkWh)+' kWh</p>':'')+
      '<h4 class="ea-h4">Pemeriksaan & batasan engineering ('+r.issues.length+')</h4>'+
      '<div class="ea-findings">'+r.issues.map(f=>'<div class="ea-issue '+esc(f.severity)+'"><b>'+esc(f.code)+(f.ref?' / '+esc(f.ref):'')+'</b><span>'+esc(f.message)+'</span></div>').join('')+'</div>'+
      '<p class="ea-muted">Referensi arah pengembangan: IEC 60364-8-81:2026 (efisiensi energi), IEC 60364-8-82:2022+A1:2026 (prosumer), IEC 60364-7-722:2018 (EV), dan PUIL/SNI yang berlaku di Indonesia. Ini belum model aliran daya AC, kajian fault-loop, sistem proteksi lengkap, data meter real-time, atau pengesahan instalasi.</p>'+
      '</details>';
    root.appendChild(section);
    const batteryKeys=new Set(['batteryCapacityKWh','batteryMaxKW','roundtripEfficiency','reserveSocPercent']);
    section.querySelectorAll('[data-energy]').forEach(el=>el.addEventListener('change',()=>{
      try{
        const key=el.dataset.energy;
        if(batteryKeys.has(key))return;
        const val=key==='exportEnabled'?el.value==='true':toNum(el.value.trim());
        configure(key,val);
      }catch(e){alert(String(e?.message||e));}
    }));
    section.querySelector('[data-ea="battery"]').onclick=()=>{
      try{
        const values={};
        for(const key of batteryKeys){
          const el=section.querySelector('[data-energy="'+key+'"]');
          values[key]=toNum(el.value.trim());
        }
        configureBattery(values);
      }catch(e){alert(String(e?.message||e));}
    };
    section.querySelectorAll('[data-advanced]').forEach(el=>el.addEventListener('change',()=>{
      try{
        const key=el.dataset.advanced;
        const val=key==='category'?el.value:toNum(el.value.trim());
        updateCircuit(el.dataset.ref,key,val);
      }catch(e){alert(String(e?.message||e));}
    }));
    section.querySelector('[data-ea="profile"]').onclick=()=>{
      try{const raw=section.querySelector('[data-profile]').value;
        if(!raw.trim())configure('pvHourlyFactors',null);
        else setProfile(raw);
      }catch(e){alert(String(e?.message||e));}
    };
    section.querySelector('[data-ea="report"]').onclick=exportReport;
  }
  function start(){
    const styles=document.createElement('style');styles.id='ea-v127-style';
    styles.textContent=[
      '#ea-v127 .ea-muted{color:#98b8c1;font-size:12px;line-height:1.6}',
      '#ea-v127 .ea-h4{font:700 13px system-ui;color:#cee9ed;margin:17px 0 9px}',
      '#ea-v127 .ea-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:8px}',
      '#ea-v127 .ea-metrics article{background:#0c2730;border:1px solid #345660;border-radius:8px;padding:10px;display:grid;gap:5px}',
      '#ea-v127 .ea-metrics span{font-size:11px;color:#a4c8d0}#ea-v127 .ea-metrics strong{font:700 19px system-ui;color:#d3f1eb}#ea-v127 small{font-size:10px;color:#9bb4c3}',
      '#ea-v127 .ea-table{overflow:auto;max-height:350px;border:1px solid #2d5260;border-radius:7px}',
      '#ea-v127 .ea-table input,#ea-v127 .ea-table select{width:88px;background:#0b1d24;border:1px solid #37606a;color:#edf5f6;padding:7px;border-radius:5px}',
      '#ea-v127 .ea-table select{width:118px}#ea-v127 .ea-inputs{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:9px}',
      '#ea-v127 .ea-field{display:grid;gap:5px;color:#acc7d0;font-size:12px}#ea-v127 .ea-field input,#ea-v127 .ea-field select,#ea-v127 textarea{width:100%;background:#0b2029;color:#e4f0f3;border:1px solid #3b606c;border-radius:6px;padding:9px}',
      '#ea-v127 .ea-profile{margin-top:10px}#ea-v127 .ea-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}',
      '#ea-v127 .ea-chart{border:1px solid #32545e;background:#071923;border-radius:8px;padding:10px;margin-top:11px}#ea-v127 .ea-chart svg{width:100%;height:auto}',
      '#ea-v127 .ea-key{display:flex;gap:17px;font-size:11px;padding:8px;color:#9eb8c3}#ea-v127 .ea-key span:first-child{color:#b8d7e3}#ea-v127 .ea-key span:nth-child(2){color:#efb867}#ea-v127 .ea-key span:nth-child(3){color:#54cbb5}',
      '#ea-v127 .ea-findings{max-height:280px;overflow:auto;display:grid;gap:6px}',
      '#ea-v127 .ea-issue{display:grid;gap:2px;padding:7px;border-left:3px solid #d9a959;background:#13303a;color:#b2ccd3;font-size:11px}',
      '#ea-v127 .ea-issue.blocker{border-color:#e88677}#ea-v127 .ea-issue b{color:#e4c89b}'
    ].join('');
    if(!document.getElementById(styles.id))document.head.appendChild(styles);
    mount();
  }
  window.PCBProElectricalAdvanced={version:VERSION,validate,analyze,configure,configureBattery,updateCircuit,setProfile,mount,exportReport,overlap};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();