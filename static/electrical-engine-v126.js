(() => {
  'use strict';
  if (window.PCBProElectrical) return;
  const VERSION='1.26.0', KEY='pcbpro0045-electrical-v126';
  const clone=x=>structuredClone(x);
  const finite=x=>typeof x==='number'&&Number.isFinite(x);
  const blank=()=>({version:VERSION,title:'Instalasi listrik',supply:{mode:'1p',voltageV:230},
    feeder:{lengthM:0,sectionMm2:6,tempC:30,reactanceOhmKm:null},circuits:[]});
  let state=blank(), notice='';
  const phases=['L1','L2','L3'];
  function validate(p){
    const errors=[],bad=(field,message)=>errors.push({field,message});
    if(!p || typeof p!=='object')return {ok:false,errors:[{field:'project',message:'Invalid electrical project'}]};
    if(typeof p.title!=='string'||p.title.length>120)bad('title','Invalid project title');
    if(!['1p','3p'].includes(p.supply?.mode))bad('supply','Invalid supply mode');
    if(!finite(p.supply?.voltageV)||p.supply.voltageV<24||p.supply.voltageV>1000)bad('voltageV','Supply must be 24-1000 V');
    const feeder=p.feeder||{};
    for(const [key,min,max] of [['lengthM',0,100000],['sectionMm2',.01,1000],['tempC',-20,120]]){
      if(!finite(feeder[key])||feeder[key]<min||feeder[key]>max)bad('feeder.'+key,'Out of range');
    }
    if(feeder.reactanceOhmKm!=null&&(!finite(feeder.reactanceOhmKm)||feeder.reactanceOhmKm<0||feeder.reactanceOhmKm>20))bad('feeder.reactance','Out of range');
    if(!Array.isArray(p.circuits)||p.circuits.length>120)bad('circuits','Invalid circuits (maximum 120)');
    const ids=new Set();
    for(const [index,c] of (Array.isArray(p.circuits)?p.circuits:[]).entries()){
      const at='circuits.'+index+'.';
      if(!c||typeof c!=='object'){bad(at,'Invalid circuit');continue}
      if(!/^[A-Za-z][A-Za-z0-9_-]{0,23}$/.test(c.id||'')||ids.has(c.id))bad(at+'id','Invalid/duplicate ID');
      ids.add(c.id);
      if(typeof c.name!=='string'||!c.name.trim()||c.name.length>90)bad(at+'name','Invalid name');
      if(!['1p','3p'].includes(c.mode)||(p.supply.mode==='1p'&&c.mode==='3p'))bad(at+'mode','Phase incompatible with supply');
      if(c.mode==='1p'&&!phases.includes(c.phase))bad(at+'phase','Invalid phase');
      for(const [key,min,max] of [['watts',0.000001,1e8],['pf',.1,1],['demand',0,1],['lengthM',0,100000],['sectionMm2',.01,1000],['tempC',-20,120]]){
        if(!finite(c[key])||c[key]<min||c[key]>max)bad(at+key,'Value outside valid range');
      }
      if(!Number.isInteger(c.quantity)||c.quantity<1||c.quantity>10000)bad(at+'quantity','Quantity 1-10000 required');
      for(const key of ['breakerA','reactanceOhmKm']){
        if(c[key]!=null&&(!finite(c[key])||c[key]<(key==='breakerA'?0.001:0)||c[key]>10000))bad(at+key,'Invalid optional value');
      }
    }
    return {ok:!errors.length,errors};
  }
  const resistance=(area,temp)=>17.241/area*(1+0.00393*(temp-20));
  function voltageDrop(voltage,current,length,section,temp,pf,mode,x){
    const r=resistance(section,temp),sin=Math.sqrt(Math.max(0,1-pf*pf));
    const volts=(mode==='3p'?Math.sqrt(3):2)*current*length/1000*(r*pf+(x??0)*sin);
    return {volts,percent:100*volts/voltage,resistanceOhmKm:r,reactanceIncluded:x!=null};
  }
  function calculate(p=state){
    const checks=validate(p);
    if(!checks.ok)return {ok:false,errors:checks.errors,findings:[],circuits:[],summary:null};
    const findings=[],phaseCurrent={L1:0,L2:0,L3:0};
    let watts=0,va=0;
    const circuits=p.circuits.map(c=>{
      const voltage=c.mode==='3p'?p.supply.voltageV:(p.supply.mode==='3p'?p.supply.voltageV/Math.sqrt(3):p.supply.voltageV);
      const activeW=c.watts*c.quantity*c.demand,apparentVA=activeW/c.pf;
      const currentA=apparentVA/(c.mode==='3p'?Math.sqrt(3)*voltage:voltage);
      const drop=voltageDrop(voltage,currentA,c.lengthM,c.sectionMm2,c.tempC,c.pf,c.mode,c.reactanceOhmKm);
      watts+=activeW;va+=apparentVA;
      if(c.mode==='3p')phases.forEach(key=>phaseCurrent[key]+=currentA);
      else phaseCurrent[p.supply.mode==='1p'?'L1':c.phase]+=currentA;
      if(c.breakerA==null)findings.push({severity:'review',code:'BREAKER_NOT_SET',ref:c.id,message:'Proteksi cabang belum ditentukan/diverifikasi.'});
      else if(currentA>c.breakerA)findings.push({severity:'warning',code:'LOAD_ABOVE_BREAKER',ref:c.id,message:'Arus beban lebih tinggi dari rating breaker input.'});
      if(!drop.reactanceIncluded)findings.push({severity:'review',code:'X_UNMODELED',ref:c.id,message:'Reaktansi kabel belum dimodelkan; drop hanya resistif.'});
      if(drop.percent>5)findings.push({severity:'warning',code:'DROP_REVIEW',ref:c.id,message:'Drop melebihi penanda tinjauan ilustratif 5%, bukan keputusan standar.'});
      return {...c,voltageV:voltage,activeW,apparentVA,currentA,drop};
    });
    const peak=p.supply.mode==='1p'?phaseCurrent.L1:Math.max(...Object.values(phaseCurrent));
    const pf=va?watts/va:1;
    const feeder=voltageDrop(p.supply.voltageV,peak,p.feeder.lengthM,p.feeder.sectionMm2,p.feeder.tempC,pf,p.supply.mode,p.feeder.reactanceOhmKm);
    if(!feeder.reactanceIncluded)findings.push({severity:'review',code:'FEEDER_X_UNMODELED',message:'Reaktansi kabel feeder tidak disertakan.'});
    if(p.supply.mode==='3p'&&(Math.max(...Object.values(phaseCurrent))-Math.min(...Object.values(phaseCurrent))>1e-5))
      findings.push({severity:'review',code:'UNBALANCED_APPROX',message:'Feeder 3 fasa tak seimbang: memakai arus fase terbesar; belum analisis vektor arus netral.'});
    if(!circuits.length)findings.push({severity:'review',code:'NO_LOADS',message:'Belum ada circuit. Tambahkan beban.'});
    findings.push({severity:'review',code:'NOT_VERIFIED',message:'KHA kabel, derating, sistem pembumian, proteksi arus lebih/RCD, arus hubung singkat, koordinasi dan inspeksi lapangan belum diverifikasi.'});
    return {ok:true,errors:[],circuits,summary:{watts,va,phaseCurrent,peak,pf,feeder},findings,
      scope:'PRELIMINARY-NOT-APPROVED-FOR-INSTALLATION'};
  }
  function load(){
    try{
      const raw=localStorage.getItem(KEY);
      if(!raw){state=blank();return}
      const data=JSON.parse(raw),v=validate(data);
      if(!v.ok){notice='Data Elektro tersimpan tidak valid. Modul memakai proyek kosong.';state=blank();}
      else state=data;
    }catch{notice='Data Elektro lokal rusak; workspace dimulai kosong.';state=blank();}
  }
  function save(next){
    const v=validate(next);
    if(!v.ok)throw Error(v.errors.map(e=>e.field+': '+e.message).join('; '));
    localStorage.setItem(KEY,JSON.stringify(next));
    state=clone(next);
    window.dispatchEvent(new CustomEvent('pcbpro:electrical-changed',{detail:{circuits:state.circuits.length}}));
    window.PCBProDatabase?.scheduleSave?.(400);
    return calculate(state);
  }
  function add(){
    if(state.circuits.length>=120)throw Error('Maximum 120 circuits');
    const next=clone(state);
    let i=1;while(next.circuits.some(c=>c.id==='C'+i))i++;
    const phase=state.supply.mode==='1p'?'L1':phases[next.circuits.filter(c=>c.mode==='1p').length%3];
    next.circuits.push({id:'C'+i,name:'Beban '+i,mode:'1p',phase,
      watts:100,quantity:1,pf:1,demand:1,lengthM:10,sectionMm2:2.5,tempC:30,reactanceOhmKm:null,breakerA:null});
    return save(next);
  }
  function update(id,key,value){
    const next=clone(state),c=next.circuits.find(x=>x.id===id);
    if(!c)throw Error('Circuit not found');
    c[key]=value;return save(next);
  }
  function remove(id){const next=clone(state);next.circuits=next.circuits.filter(x=>x.id!==id);return save(next);}
  function configure(key,value){
    const next=clone(state);
    if(key==='title')next.title=value;
    else if(key==='mode'){
      next.supply.mode=value;next.supply.voltageV=value==='3p'?400:230;
      if(value==='1p')next.circuits=next.circuits.map(c=>({...c,mode:'1p',phase:'L1'}));
    }else if(key==='voltageV')next.supply.voltageV=value;
    else next.feeder[key]=value;
    return save(next);
  }
  function reset(){return save(blank())}
  function snapshot(){return clone(state)}
  const safeText=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  function sld(){
    const r=calculate();
    if(!r.ok)throw Error('Electrical project invalid');
    const w=980,h=190+Math.max(1,r.circuits.length)*72;
    const box=(x,y,wide,height)=>'<rect x="'+x+'" y="'+y+'" width="'+wide+'" height="'+height+'" rx="8" fill="#152e38" stroke="#416f80"/>';
    const txt=(x,y,s,size=15)=>'<text x="'+x+'" y="'+y+'" fill="#dfedf0" font-size="'+size+'" font-family="Arial,sans-serif">'+safeText(s)+'</text>';
    const a=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+h+'">',
      '<rect width="100%" height="100%" fill="#071820"/>',
      txt(32,37,'SIRKUITLAB / ELECTRICAL ONE-LINE (PRELIMINARY)',21),
      txt(32,64,state.title+' | '+state.supply.mode+' | '+state.supply.voltageV+' V',14),
      txt(32,84,'NOT A WIRING/PROTECTION APPROVAL - VERIFICATION REQUIRED',12),
      box(32,110,175,54),txt(48,132,'SUPPLY'),txt(48,152,state.supply.voltageV+' V'),
      '<path d="M207 137 H283" stroke="#69dcc7" stroke-width="3"/>',
      box(283,110,215,54),txt(298,131,'MAIN PANEL'),txt(298,150,r.circuits.length+' circuits'),
      '<path d="M498 137 H555 V'+(147+Math.max(0,r.circuits.length-1)*72)+'" fill="none" stroke="#69dcc7" stroke-width="3"/>'];
    for(const [i,c] of r.circuits.entries()){
      const y=147+i*72;
      a.push('<path d="M555 '+y+' H605" stroke="#69dcc7" stroke-width="2"/>',
        box(605,y-26,335,54),txt(622,y-5,c.id+' · '+c.name.slice(0,31)),
        txt(622,y+16,c.mode+' '+c.phase+' / '+Math.round(c.activeW)+' W / '+c.currentA.toFixed(2)+' A',12));
    }
    if(!r.circuits.length)a.push(txt(620,154,'Belum ada circuit',14));
    a.push(txt(32,h-18,'Requires PUIL review, protection study, conductor ampacity & site measurements',11),'</svg>');
    return a.join('');
  }
  function csv(){
    const r=calculate();
    const cells=v=>{let x=String(v??'');if(/^[=+@\t\r-]/.test(x))x="'"+x;return '"'+x.replace(/"/g,'""')+'"';};
    const rows=[['ID','Beban','Fasa','Jalur','W terpakai','VA','Arus A','Tegangan V','m','Penampang Cu mm2','Drop %','Breaker A']];
    for(const c of r.circuits)rows.push([c.id,c.name,c.mode,c.phase,c.activeW,c.apparentVA,c.currentA,c.voltageV,c.lengthM,c.sectionMm2,c.drop.percent,c.breakerA??'']);
    return rows.map(row=>row.map(cells).join(',')).join('\r\n')+'\r\n';
  }
  function download(name,body,type){
    const url=URL.createObjectURL(new Blob([body],{type})),a=document.createElement('a');
    a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function exportFile(type){
    if(type==='svg')download('sirkuitlab-electrical-one-line.svg',sld(),'image/svg+xml');
    if(type==='csv')download('sirkuitlab-electrical-load-schedule.csv',csv(),'text/csv');
    if(type==='json')download('sirkuitlab-electrical-report.json',JSON.stringify({project:snapshot(),report:calculate(),generatedAt:new Date().toISOString()},null,2),'application/json');
  }
  window.PCBProElectrical={
    version:VERSION,validate,calculate,resistance,voltageDrop,snapshot,restore:save,
    configure,add,update,remove,reset,sld,csv,exportFile,get notice(){return notice}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});
  else load();
})();