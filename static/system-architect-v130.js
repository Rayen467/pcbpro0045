(() => {
  'use strict';
  if(window.PCBProSystemArchitect)return;

  const VERSION='1.30.0';
  const KEY='pcbpro0045-system-blueprint-v130';
  const INTERFACES=['none','gpio','adc','pwm','i2c','spi','uart'];
  const KINDS=['controller','sensor','actuator','power','network','safety','mechanical','other'];
  const sane=v=>typeof v==='number'&&Number.isFinite(v);
  const clone=x=>structuredClone(x);
  const asNumber=(v,min,max)=>v===null||(sane(v)&&v>=min&&v<=max);
  const blank=()=>({version:VERSION,template:'custom',name:'Proyek sistem baru',
    goal:'',supply:{voltageV:null,continuousA:null,peakA:null},
    devices:[],notes:''});
  const concept=(id,name,kind,iface='none',powerRequired=true)=>({
    id,name,kind,interface:iface,powerRequired,railV:null,nominalA:null,
    peakA:null,hoursPerDay:null,pins:[],i2cAddress:null,notes:'',tested:false
  });
  const templates=[
    {id:'robot',name:'Robot dua roda',subtitle:'ESP32 • Motor driver • sensor • daya',
      goal:'Robot DC rendah tegangan dengan dua roda, pembacaan sensor jarak, dan penghentian aman. Fokus pada routing logis, power tree, stall motor dan tes lapangan.',
      devices:[
        concept('MCU','Controller ESP32 (model belum dipilih)','controller'),
        concept('DRV','Driver motor dual-channel (model belum dipilih)','actuator','pwm'),
        concept('ML','Motor kiri (arus stall belum diketahui)','actuator'),
        concept('MR','Motor kanan (arus stall belum diketahui)','actuator'),
        concept('SNS','Sensor jarak (model belum dipilih)','sensor','i2c'),
        concept('DC','Converter DC/DC (rating belum diketahui)','power'),
        concept('FUSE','Proteksi sumber (rating belum dipilih)','safety','none',false),
        concept('ESTOP','Emergency stop fisik (rangkaian belum dipilih)','safety','none',false)
      ]},
    {id:'smart',name:'Smart desk / smart home',subtitle:'ESP32 • Sensor • MQTT • voice',
      goal:'Sistem smart desk aman berbasis USB/DC rendah tegangan. Sensor memicu LED indikator dan data bisa dibaca melalui Home Assistant. Kontrol suara tidak melewati pemeriksaan izin.',
      devices:[
        concept('MCU','Controller ESP32 (model belum dipilih)','controller'),
        concept('PIR','Sensor gerak PIR (datasheet diperlukan)','sensor','gpio'),
        concept('TMP','Sensor temperatur (model belum dipilih)','sensor','i2c'),
        concept('OUT','LED / indikator DC dengan driver','actuator','gpio'),
        concept('DC','Sumber USB/DC berproteksi','power'),
        concept('SW','Saklar/manual override','safety','none',false)
      ]},
    {id:'hydro',name:'Hidroponik pintar',subtitle:'pH • EC • suhu • pompa DC',
      goal:'Monitoring dan otomasi larutan hidroponik menggunakan sensor terkalibrasi. Dosing dan kontrol pompa harus dibatasi interlock dan kegagalan sensor.',
      devices:[
        concept('MCU','Controller ESP32 (model belum dipilih)','controller'),
        concept('PH','Modul sensor pH + kalibrasi','sensor','adc'),
        concept('EC','Modul EC/TDS + kalibrasi','sensor','adc'),
        concept('TMP','Sensor suhu air (model belum dipilih)','sensor','gpio'),
        concept('PUMP','Pompa sirkulasi melalui driver','actuator','pwm'),
        concept('DOSE','Pompa dosing melalui driver','actuator','gpio'),
        concept('SAFE','Proteksi level air dan interlock','safety','none',false),
        concept('DC','Catu dan konverter berproteksi','power')
      ]},
    {id:'tracker',name:'GPS wearable',subtitle:'GNSS • SOS • daya • komunikasi',
      goal:'Prototipe tag pelacakan bertenaga baterai rendah daya. Lokasi dan geofencing memerlukan GNSS, komunikasi, sumber energi, keamanan data dan uji lapangan.',
      devices:[
        concept('MCU','Mikrokontroler hemat daya (belum dipilih)','controller'),
        concept('GNSS','Receiver GNSS (belum dipilih)','sensor','uart'),
        concept('COMM','Modul komunikasi jarak jauh (belum dipilih)','network','uart'),
        concept('SOS','Tombol SOS (input)','safety','gpio'),
        concept('BUZ','Buzzer/alarm melalui driver','actuator','gpio'),
        concept('BAT','Sumber daya dengan proteksi/charger','power')
      ]}
  ];
  let state=blank(),loadIssue='';

  function validate(p){
    const errors=[],bad=(field,message)=>errors.push({field,message});
    if(!p||typeof p!=='object'||Array.isArray(p))return {ok:false,errors:[{field:'project',message:'Invalid blueprint'}]};
    if(typeof p.name!=='string'||!p.name.trim()||p.name.length>120)bad('name','Project name required (up to 120 chars)');
    if(typeof p.goal!=='string'||p.goal.length>1400)bad('goal','Goal longer than 1400 characters');
    if(typeof p.notes!=='string'||p.notes.length>6000)bad('notes','Project notes longer than 6000 characters');
    if(typeof p.template!=='string'||!['custom',...templates.map(x=>x.id)].includes(p.template))bad('template','Unknown template');
    for(const [key,max] of [['voltageV',120],['continuousA',1000],['peakA',2000]]){
      if(!asNumber(p.supply?.[key],0.000001,max))bad('supply.'+key,'Value out of range or missing null');
    }
    if(p.supply?.continuousA!==null&&p.supply?.peakA!==null&&sane(p.supply?.continuousA)&&sane(p.supply?.peakA)&&p.supply.peakA<p.supply.continuousA)
      bad('supply.peakA','Peak current cannot be smaller than continuous current');
    if(!Array.isArray(p.devices)||p.devices.length>80)bad('devices','Maximum 80 devices');
    const ids=new Set();
    for(const [i,d] of (Array.isArray(p.devices)?p.devices:[]).entries()){
      const loc='devices.'+i+'.';
      if(!d||typeof d!=='object'){bad(loc,'Invalid module');continue;}
      if(!/^[A-Za-z][A-Za-z0-9_-]{0,23}$/.test(d.id||'')||ids.has(d.id))bad(loc+'id','Unique id required');
      ids.add(d.id);
      if(typeof d.name!=='string'||!d.name.trim()||d.name.length>160)bad(loc+'name','Module name required');
      if(!KINDS.includes(d.kind))bad(loc+'kind','Unknown module category');
      if(!INTERFACES.includes(d.interface))bad(loc+'interface','Unknown signal interface');
      if(typeof d.powerRequired!=='boolean')bad(loc+'powerRequired','Invalid power requirement');
      if(typeof d.tested!=='boolean')bad(loc+'tested','Invalid test state');
      if(typeof d.notes!=='string'||d.notes.length>600)bad(loc+'notes','Invalid notes');
      for(const [key,min,max] of [['railV',.000001,120],['nominalA',0,1000],['peakA',0,2000],['hoursPerDay',0,24]]){
        if(!asNumber(d[key],min,max))bad(loc+key,'Invalid numeric value');
      }
      if(sane(d.nominalA)&&sane(d.peakA)&&d.peakA<d.nominalA)bad(loc+'peakA','Peak current below nominal');
      if(!Array.isArray(d.pins)||d.pins.length>12||d.pins.some(x=>typeof x!=='string'||!/^([A-Za-z]+[0-9]{1,3})$/.test(x)))
        bad(loc+'pins','Pins must be names like GPIO21 or D2; maximum 12');
      if(d.i2cAddress!==null&&(typeof d.i2cAddress!=='string'||!/^0x[0-7][0-9a-fA-F]$/.test(d.i2cAddress)))
        bad(loc+'i2cAddress','I²C 7-bit address must look like 0x40');
    }
    return {ok:errors.length===0,errors};
  }
  function newBlueprint(templateId='custom'){
    if(templateId==='custom')return blank();
    const source=templates.find(x=>x.id===templateId);
    if(!source)throw Error('Unknown system blueprint template');
    return {version:VERSION,template:source.id,name:source.name,goal:source.goal,
      supply:{voltageV:null,continuousA:null,peakA:null},
      devices:clone(source.devices),notes:''};
  }
  function analyze(p=state){
    const check=validate(p);
    if(!check.ok)return {ok:false,status:'INVALID_DATA',issues:check.errors.map(x=>({severity:'blocker',code:'SCHEMA_INVALID',ref:x.field,message:x.message})),
      power:null,io:null,coverage:{complete:0,required:0}};
    const issues=[],add=(severity,code,ref,message)=>issues.push({severity,code,ref,message});
    let complete=0,required=0;
    const requireValue=(field,value)=>{required++;if(value!==null&&value!==undefined&&value!=='')complete++;
      else add('blocker','INPUT_MISSING',field,'Data wajib belum diisi; hitungan tidak boleh ditebak.')};
    if(!p.devices.length)add('blocker','NO_MODULES','devices','Belum ada perangkat. Pilih template atau tambah modul.');
    for(const key of ['voltageV','continuousA','peakA'])requireValue('supply.'+key,p.supply[key]);
    if(!p.goal.trim())add('review','GOAL_NOT_SET','goal','Tujuan dan kondisi penggunaan belum dituliskan.');
    const loads=p.devices.filter(d=>d.powerRequired);
    let nominalW=0,peakW=0,dailyWh=0;
    for(const d of loads){
      for(const key of ['railV','nominalA','peakA','hoursPerDay'])requireValue(d.id+'.'+key,d[key]);
      if(sane(d.railV)&&sane(d.nominalA))nominalW+=d.railV*d.nominalA;
      if(sane(d.railV)&&sane(d.peakA))peakW+=d.railV*d.peakA;
      if(sane(d.railV)&&sane(d.nominalA)&&sane(d.hoursPerDay))dailyWh+=d.railV*d.nominalA*d.hoursPerDay;
    }
    const supplyReady=['voltageV','continuousA','peakA'].every(k=>sane(p.supply[k]));
    const allNom=loads.length>0&&loads.every(d=>sane(d.railV)&&sane(d.nominalA));
    const allPeak=loads.length>0&&loads.every(d=>sane(d.railV)&&sane(d.peakA));
    const allDaily=loads.length>0&&loads.every(d=>sane(d.railV)&&sane(d.nominalA)&&sane(d.hoursPerDay));
    const supplyNomW=supplyReady?p.supply.voltageV*p.supply.continuousA:null;
    const supplyPeakW=supplyReady?p.supply.voltageV*p.supply.peakA:null;
    if(supplyReady&&allNom&&nominalW>supplyNomW+1e-7)add('blocker','CONTINUOUS_BUDGET_EXCEEDED','supply','Jumlah daya nominal output melebihi daya nominal sumber yang diinput, bahkan sebelum rugi konversi.');
    if(supplyReady&&allPeak&&peakW>supplyPeakW+1e-7)add('blocker','PEAK_BUDGET_EXCEEDED','supply','Jumlah daya peak melebihi kapasitas peak sumber yang diinput, sebelum rugi konversi.');
    if(supplyReady&&allNom)add('review','CONVERSION_LOSSES_UNKNOWN','supply','Perbandingan daya lintas rail belum menghitung rugi konverter, arus inrush, durasi peak, atau rating pengaman. Lolos nominal bukan berarti desain aman.');
    const pinOwners=new Map(),i2cAddress=new Map(),assignments=[];
    for(const d of p.devices){
      if(d.interface==='none'){
        if(d.pins.length)add('review','PINS_WITHOUT_INTERFACE',d.id,'Pins tercatat tanpa protokol, tentukan antarmukanya.');
        continue;
      }
      if(!d.pins.length){add('blocker','GPIO_UNASSIGNED',d.id,'Belum ada pin kontrol yang ditetapkan.');continue;}
      const key=d.pins.join('|');
      if(d.interface==='i2c'){
        if(d.pins.length!==2)add('blocker','I2C_PIN_COUNT',d.id,'I²C memerlukan urutan dua pin MCU: SDA, SCL.');
        if(!d.i2cAddress)add('blocker','I2C_ADDRESS_MISSING',d.id,'Alamat I²C 7-bit belum diisi.');
        if(d.i2cAddress){
          const addressKey=key+'@'+d.i2cAddress.toLowerCase();
          if(i2cAddress.has(addressKey))add('blocker','I2C_ADDRESS_COLLISION',d.id,'Alamat I²C sama di bus yang sama dengan '+i2cAddress.get(addressKey)+'.');
          i2cAddress.set(addressKey,d.id);
        }
      }else if(d.i2cAddress)add('review','I2C_ADDR_UNUSED',d.id,'Alamat I²C ditulis tetapi interface bukan I²C.');
      for(const pin of d.pins){
        assignments.push({pin,device:d.id,interface:d.interface});
        const owners=pinOwners.get(pin)||[];
        for(const previous of owners){
          const allowed=previous.interface==='i2c'&&d.interface==='i2c'&&previous.bus===key&&d.pins.length===2;
          if(!allowed)add('blocker','PIN_COLLISION',d.id,'Pin controller '+pin+' berbenturan dengan '+previous.id+' ('+previous.interface+').');
        }
        owners.push({id:d.id,interface:d.interface,bus:key});
        pinOwners.set(pin,owners);
      }
    }
    if(p.devices.some(x=>x.kind==='actuator')&&!p.devices.some(x=>x.kind==='safety'))
      add('review','SAFETY_INTERLOCK_MISSING','devices','Ada aktuator tanpa modul keselamatan/interlock yang didefinisikan.');
    if(p.devices.some(x=>!x.tested))add('review','UNTESTED_HARDWARE','devices','Setidaknya satu perangkat belum memiliki pengujian fisik yang ditandai.');
    add('review','PHYSICAL_SIGNOFF_PENDING','project','Kompatibilitas GPIO board, PCB routing, EMC, isolasi, pengaman, efisiensi, beban motor, kualitas catu dan pengukuran hardware belum diverifikasi.');
    return {ok:true,version:VERSION,status:issues.some(x=>x.severity==='blocker')?'INPUTS_INCOMPLETE_OR_BLOCKED':'PRELIMINARY_REVIEW_ONLY',
      issues,coverage:{complete,required},
      power:{nominalLoadW:allNom?nominalW:null,peakLoadW:allPeak?peakW:null,dailyWh:allDaily?dailyWh:null,
        sourceContinuousW:supplyNomW,sourcePeakW:supplyPeakW,conversionLossIncluded:false,
        currentSummingAcrossDifferentRails:false},
      io:{assignments,uniquePins:pinOwners.size,validatedControllerPinout:false}};
  }
  function load(){
    try{
      const raw=localStorage.getItem(KEY);
      if(!raw){state=blank();return;}
      const saved=JSON.parse(raw);
      if(validate(saved).ok)state=saved;
      else{state=blank();loadIssue='Blueprint tersimpan tidak valid; versi lama tidak dihapus secara otomatis.';}
    }catch{state=blank();loadIssue='Blueprint lokal tidak terbaca. Backup yang ada tetap tersedia.';}
  }
  function snapshot(){return clone(state)}
  function replace(next){
    const v=validate(next);
    if(!v.ok)throw Error(v.errors.map(x=>x.field+': '+x.message).join('; ').slice(0,1200));
    localStorage.setItem(KEY,JSON.stringify(next));
    state=clone(next);
    window.dispatchEvent(new CustomEvent('pcbpro:system-builder-changed',{detail:{devices:state.devices.length}}));
    return analyze(state);
  }
  function patch(fn){
    const next=snapshot();
    fn(next);
    return replace(next);
  }
  function useTemplate(id){return replace(newBlueprint(id))}
  function configure(field,value){
    if(['name','goal','notes'].includes(field))return patch(p=>{p[field]=value;});
    if(['voltageV','continuousA','peakA'].includes(field))return patch(p=>{p.supply[field]=value;});
    throw Error('Unknown configuration field');
  }
  function addDevice(){
    const next=snapshot();
    if(next.devices.length>=80)throw Error('Maximum 80 modules');
    let i=1;while(next.devices.some(x=>x.id==='MOD'+i))i++;
    next.devices.push(concept('MOD'+i,'Modul '+i,'other','none'));
    return replace(next);
  }
  function updateDevice(id,key,value){
    const allowed=['name','kind','interface','powerRequired','railV','nominalA','peakA','hoursPerDay','pins','i2cAddress','notes','tested'];
    if(!allowed.includes(key))throw Error('Unknown module field');
    return patch(p=>{const d=p.devices.find(x=>x.id===id);if(!d)throw Error('Module not found');d[key]=value;});
  }
  function removeDevice(id){return patch(p=>{p.devices=p.devices.filter(x=>x.id!==id);});}
  function exportJson(){
    const data={format:'sirkuitlab-system-blueprint',version:VERSION,
      exportedAt:new Date().toISOString(),blueprint:snapshot(),preliminaryAssessment:analyze()};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const u=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=u;a.download='sirkuitlab-system-blueprint.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(u),1600);
  }
  window.PCBProSystemArchitect={version:VERSION,templates,blank,newBlueprint,validate,analyze,
    snapshot,replace,patch,useTemplate,configure,addDevice,updateDevice,removeDevice,exportJson,
    get loadIssue(){return loadIssue}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});
  else load();
})();