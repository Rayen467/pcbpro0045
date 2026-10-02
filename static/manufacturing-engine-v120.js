(() => {
  'use strict';
  if (window.PCBProManufacturing) return;

  const VERSION='1.20.0';
  const KEY='pcbpro0045-manufacturing-v120';
  const enc=new TextEncoder();
  let state={widthMm:null,heightMm:null,origin:'outline-min',lastPreflight:null,lastPackage:null};

  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  const t=(id,en)=>lang()==='id'?id:en;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const n=(v,fallback=null)=>Number.isFinite(Number(v))?Number(v):fallback;
  const cleanName=v=>String(v||'pcbpro').trim().replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'pcbpro';

  function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(x&&typeof x==='object')state={...state,...x,lastPreflight:null,lastPackage:null}}catch{}}
  function save(){try{localStorage.setItem(KEY,JSON.stringify({widthMm:state.widthMm,heightMm:state.heightMm,origin:state.origin}))}catch{}}
  function components(){return window.PCBProProject?.getComponents?.()||[]}
  function board(){
    try{window.PCBProBoardModel?.captureGeometry?.()}catch{}
    return window.PCBProBoardModel?.model||{tracks:[],outline:[],placements:[],pads:[],worldSize:null};
  }
  function advanced(){return window.PCBProAdvancedBoard?.model||{vias:[],zones:[],keepouts:[],diffPairs:[]}}
  function professional(){return window.PCBProProfessional?.state||{}}
  function projectName(){return cleanName(localStorage.getItem('pcbpro0045-cloud-project-name')||document.querySelector('.project-pill b')?.textContent||'pcbpro0045')}

  function bbox(points){
    if(!Array.isArray(points)||!points.length)return null;
    const xs=points.map(p=>Number(p.x)).filter(Number.isFinite),ys=points.map(p=>Number(p.y)).filter(Number.isFinite);
    if(!xs.length||!ys.length)return null;
    return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
  }

  function calibration(b){
    const box=bbox(b.outline||[]);
    if(!box||box.width<=0||box.height<=0)return null;
    const widthMm=n(state.widthMm),heightMm=n(state.heightMm);
    if(!(widthMm>0&&heightMm>0))return null;
    return {
      box,widthMm,heightMm,
      point(p){return{x:(Number(p.x)-box.minX)/box.width*widthMm,y:(box.maxY-Number(p.y))/box.height*heightMm}}
    };
  }

  function physicalPadSource(){
    const api=window.PCBProFootprintGeometry;
    if(!api?.getPads)return {ready:false,count:0,pads:[],reason:'No verified physical footprint-pad geometry provider is connected.'};
    const raw=api.getPads();
    const pads=Array.isArray(raw)?raw:[];
    const physical=components().filter(x=>x.footprint&&x.footprint!=='—');
    const expected=physical.reduce((sum,p)=>sum+(Number.isInteger(p.pinCount)&&p.pinCount>0?p.pinCount:0),0);
    const unknownPins=physical.filter(p=>!(Number.isInteger(p.pinCount)&&p.pinCount>0)).map(p=>p.id);
    const valid=pads.filter(p=>{
      const layer=String(p.layer||'F.Cu');
      const shape=String(p.shape||'circle').toLowerCase();
      const sizeOk=shape==='rect'
        ? Number(p.widthMm)>0&&Number(p.heightMm)>0
        : Number(p.diameterMm||p.widthMm)>0;
      return Number.isFinite(Number(p.xMm))&&Number.isFinite(Number(p.yMm))&&['F.Cu','B.Cu','*.Cu'].includes(layer)&&['circle','rect'].includes(shape)&&sizeOk&&p.ref;
    });
    const byRef=new Map();
    for(const p of valid)byRef.set(String(p.ref),(byRef.get(String(p.ref))||0)+1);
    const incomplete=physical.filter(p=>Number.isInteger(p.pinCount)&&p.pinCount>0&&(byRef.get(p.id)||0)<p.pinCount).map(p=>p.id);
    let reason='';
    if(unknownPins.length)reason='Unknown pin count: '+unknownPins.join(', ');
    else if(incomplete.length)reason='Incomplete pad geometry: '+incomplete.join(', ');
    else if(!pads.length||valid.length!==pads.length)reason='Physical footprint-pad geometry is invalid or empty.';
    const ready=pads.length>0&&valid.length===pads.length&&!unknownPins.length&&!incomplete.length&&valid.length>=expected;
    return {ready,count:valid.length,pads:valid,expected,unknownPins,incomplete,reason};
  }

  function preflight(){
    const b=board(),a=advanced(),c=components();
    const findings=[],warnings=[];
    const cal=calibration(b);
    if((b.outline||[]).length<3)findings.push({code:'OUTLINE',message:t('Edge.Cuts belum valid/tertutup.','Edge.Cuts is not a valid closed outline.')});
    if(!cal)findings.push({code:'DIMENSIONS',message:t('Masukkan lebar dan tinggi board fisik dalam mm sebelum CAM export.','Enter physical board width and height in mm before CAM export.')});
    const missingEndpoints=(b.tracks||[]).filter(tr=>!(tr.start&&tr.end));
    if(missingEndpoints.length)findings.push({code:'TRACK_GEOMETRY',message:t(`${missingEndpoints.length} track belum punya endpoint geometri tersimpan. Buka tab PCB sekali agar geometry capture diperbarui.`,`${missingEndpoints.length} track(s) are missing persisted geometry endpoints. Open the PCB tab once to refresh geometry capture.`)});
    const physicalPads=physicalPadSource();
    if(!physicalPads.ready)warnings.push({code:'PAD_GEOMETRY',message:t('Pad fisik footprint belum punya provider geometri terverifikasi; copper Gerber yang dihasilkan hanya mencakup track/via yang diketahui dan BUKAN production release.','Verified physical footprint pad geometry is not connected; generated copper Gerber contains known tracks/vias only and is NOT a production release.')});
    const base=window.PCBProBoardModel?.drc?.()||[],adv=window.PCBProAdvancedBoard?.drc?.()||[];
    if(base.length||adv.length)findings.push({code:'DRC',message:t(`DRC masih punya ${base.length+adv.length} temuan.`,`DRC still has ${base.length+adv.length} finding(s).`)});
    const placements=b.placements||[];
    const physical=c.filter(x=>x.footprint&&x.footprint!=='—');
    const missingPlacement=physical.filter(x=>!placements.some(p=>p.ref===x.id));
    if(missingPlacement.length)warnings.push({code:'CPL',message:t(`${missingPlacement.length} footprint belum punya placement capture untuk CPL.`,`${missingPlacement.length} footprint(s) are missing placement capture for CPL.`)});
    if(!(a.vias||[]).every(v=>Number.isFinite(Number(v.x))&&Number.isFinite(Number(v.y))))findings.push({code:'VIA_GEOMETRY',message:t('Ada via dengan koordinat invalid.','A via has invalid coordinates.')});
    const readyForDraft=findings.length===0;
    const readyForProduction=readyForDraft&&physicalPads.ready;
    const report={
      version:VERSION,time:new Date().toISOString(),readyForDraft,readyForProduction,
      findings,warnings,coverage:{
        outline:(b.outline||[]).length,
        tracks:(b.tracks||[]).length,
        vias:(a.vias||[]).length,
        zones:(a.zones||[]).length,
        placements:placements.length,
        physicalPads:physicalPads.count,
        dimensionsMm:cal?{width:cal.widthMm,height:cal.heightMm}:null
      },
      scope:readyForProduction?'production-candidate':'engineering-draft'
    };
    state.lastPreflight=report;
    window.dispatchEvent(new CustomEvent('pcbpro:manufacturing-preflight',{detail:report}));
    render();
    return report;
  }

  function coordMm(v){return Math.round(v*1e6).toString().padStart(10,'0')}
  function gerberHeader(name){
    return [
      'G04 PCB Pro generated RS-274X engineering output*',
      `G04 Layer: ${name}*`,
      `G04 Generator: PCB Pro ${VERSION}*`,
      '%FSLAX46Y46*%','%MOMM*%','%LPD*%'
    ];
  }
  function apertureMap(tracks,vias=[]){
    const widths=[...new Set(tracks.map(x=>Number(x.widthMm||0.25).toFixed(6)))].sort((a,b)=>Number(a)-Number(b));
    const map=new Map();let d=10;for(const w of widths)map.set(w,d++);
    const viaDias=[...new Set(vias.map(x=>Number(x.diameterMm||x.diameter||0.6).toFixed(6)))].sort((a,b)=>Number(a)-Number(b));
    const viaMap=new Map();for(const w of viaDias)viaMap.set(w,d++);
    return {map,viaMap};
  }
  function trackWorldPoints(tr){
    if(!tr.start||!tr.end)return[];
    const pts=[tr.start,...(Array.isArray(tr.corners)?tr.corners:[])];
    const last=pts[pts.length-1];
    if(Math.abs(last.x-tr.end.x)<0.0001||Math.abs(last.y-tr.end.y)<0.0001)pts.push(tr.end);
    else pts.push({x:tr.end.x,y:last.y},tr.end);
    return pts;
  }
  function gerberCopper(layer,cal,b,a){
    const tracks=(b.tracks||[]).filter(x=>(x.layer||'F.Cu')===layer);
    const vias=a.vias||[];
    const {map,viaMap}=apertureMap(tracks,vias);
    const out=gerberHeader(layer);
    for(const [w,d] of map)out.push(`%ADD${d}C,${w}*%`);
    for(const [dia,d] of viaMap)out.push(`%ADD${d}C,${dia}*%`);
    for(const tr of tracks){
      const d=map.get(Number(tr.widthMm||0.25).toFixed(6));const pts=trackWorldPoints(tr).map(cal.point);
      if(pts.length<2)continue;
      out.push(`D${d}*`,`X${coordMm(pts[0].x)}Y${coordMm(pts[0].y)}D02*`);
      for(const p of pts.slice(1))out.push(`X${coordMm(p.x)}Y${coordMm(p.y)}D01*`);
    }
    for(const v of vias){
      const p=cal.point(v),dia=Number(v.diameterMm||v.diameter||0.6).toFixed(6),d=viaMap.get(dia);
      if(d)out.push(`D${d}*`,`X${coordMm(p.x)}Y${coordMm(p.y)}D03*`);
    }
    out.push('M02*');
    return out.join('\n')+'\n';
  }

  function gerberOutline(cal,b){
    const pts=(b.outline||[]).map(cal.point);const out=gerberHeader('Edge.Cuts');
    out.push('%ADD10C,0.100000*%','D10*');
    if(pts.length){
      out.push(`X${coordMm(pts[0].x)}Y${coordMm(pts[0].y)}D02*`);
      for(const p of pts.slice(1))out.push(`X${coordMm(p.x)}Y${coordMm(p.y)}D01*`);
      out.push(`X${coordMm(pts[0].x)}Y${coordMm(pts[0].y)}D01*`);
    }
    out.push('M02*');return out.join('\n')+'\n';
  }

  function excellon(cal,a){
    const vias=a.vias||[];const drills=[...new Set(vias.map(v=>Number(v.drillMm||v.drill||0.3).toFixed(4)))].sort((x,y)=>Number(x)-Number(y));
    const tools=new Map(drills.map((d,i)=>[d,i+1]));
    const out=['M48','; PCB Pro Excellon drill','METRIC,TZ'];
    for(const [d,i] of tools)out.push(`T${String(i).padStart(2,'0')}C${d}`);
    out.push('%');
    for(const [d,i] of tools){
      out.push(`T${String(i).padStart(2,'0')}`);
      for(const v of vias.filter(x=>Number(x.drillMm||x.drill||0.3).toFixed(4)===d)){
        const p=cal.point(v);out.push(`X${p.x.toFixed(4)}Y${p.y.toFixed(4)}`);
      }
    }
    out.push('M30');return out.join('\n')+'\n';
  }

  function csvCell(v){const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
  function bomCsv(){
    const rows=[['Reference','Name','Value','Footprint','Manufacturer','MPN']];
    for(const p of components().filter(x=>x.footprint&&x.footprint!=='—'))rows.push([p.id,p.name,p.value,p.footprint,p.manufacturer||'',p.mpn||'']);
    return rows.map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';
  }
  function cplCsv(cal,b){
    const map=new Map((b.placements||[]).map(p=>[p.ref,p]));const rows=[['Designator','Mid X(mm)','Mid Y(mm)','Layer','Rotation(deg)']];
    for(const p of components().filter(x=>x.footprint&&x.footprint!=='—')){
      const place=map.get(p.id);if(!place)continue;const q=cal.point(place);
      rows.push([p.id,q.x.toFixed(4),q.y.toFixed(4),'Top',Number(place.rotationDeg||p.rot||0).toFixed(2)]);
    }
    return rows.map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';
  }

  async function sha256(text){const digest=await crypto.subtle.digest('SHA-256',enc.encode(text));return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')}
  function crc32(bytes){
    let crc=0xffffffff;
    for(const byte of bytes){crc^=byte;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}
    return (crc^0xffffffff)>>>0;
  }
  function u16(v){return [v&255,(v>>>8)&255]}
  function u32(v){return [v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255]}
  function zipStore(files){
    const local=[],central=[];let offset=0;
    for(const file of files){
      const name=enc.encode(file.name),data=typeof file.data==='string'?enc.encode(file.data):file.data,crc=crc32(data);
      const lh=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...name]);
      local.push(lh,data);
      const ch=new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...name]);
      central.push(ch);offset+=lh.length+data.length;
    }
    const centralSize=central.reduce((s,x)=>s+x.length,0),eocd=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(centralSize),...u32(offset),...u16(0)]);
    return new Blob([...local,...central,eocd],{type:'application/zip'});
  }
  function downloadBlob(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
  function downloadText(name,text,mime='text/plain'){downloadBlob(name,new Blob([text],{type:mime}))}

  async function buildPackage(){
    const report=preflight();if(!report.readyForDraft)return {ok:false,error:'Preflight blocked',report};
    const b=board(),a=advanced(),cal=calibration(b),name=projectName();
    if(!cal)return {ok:false,error:'Physical calibration missing',report};
    const fcu=gerberCopper('F.Cu',cal,b,a),bcu=gerberCopper('B.Cu',cal,b,a),edge=gerberOutline(cal,b),drill=excellon(cal,a),bom=bomCsv(),cpl=cplCsv(cal,b);
    const files=[
      {name:`${name}-F_Cu.gbr`,data:fcu},
      {name:`${name}-B_Cu.gbr`,data:bcu},
      {name:`${name}-Edge_Cuts.gbr`,data:edge},
      {name:`${name}.drl`,data:drill},
      {name:`${name}-BOM.csv`,data:bom},
      {name:`${name}-CPL.csv`,data:cpl}
    ];
    const manifest={
      generator:`PCB Pro ${VERSION}`,project:name,createdAt:new Date().toISOString(),
      releaseClass:report.readyForProduction?'production-candidate':'ENGINEERING-DRAFT-NOT-FOR-FABRICATION',
      dimensionsMm:report.coverage.dimensionsMm,coverage:report.coverage,preflight:report,
      professionalRules:professional(),
      limitations:report.readyForProduction?[]:[
        'Verified per-footprint physical pad geometry is not connected.',
        'Copper Gerbers include persisted routed tracks and vias only; missing footprint pad flashes make this package unsuitable for fabrication.'
      ],
      files:[]
    };
    for(const f of files)manifest.files.push({name:f.name,sha256:await sha256(f.data),bytes:enc.encode(f.data).length});
    const manifestText=JSON.stringify(manifest,null,2)+'\n';files.push({name:`${name}-MANIFEST.json`,data:manifestText});
    const zip=zipStore(files);
    state.lastPackage={manifest,bytes:zip.size};
    downloadBlob(`${name}-${report.readyForProduction?'manufacturing':'draft-cam'}.zip`,zip);
    window.dispatchEvent(new CustomEvent('pcbpro:manufacturing-exported',{detail:structuredClone(state.lastPackage)}));
    render();
    return {ok:true,releaseClass:manifest.releaseClass,manifest,bytes:zip.size};
  }

  function installStyles(){
    if(document.querySelector('#pcbpro-mfg-style'))return;
    const s=document.createElement('style');s.id='pcbpro-mfg-style';s.textContent=`
      #pcbpro-mfg-root{display:grid;gap:12px}.mfg-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.mfg-card{border:1px solid #203642;background:#0b1821;border-radius:10px;padding:11px}.mfg-card b{display:block;color:#5fd6be;font:800 8px ui-monospace}.mfg-card strong{display:block;font-size:14px;margin:5px 0}.mfg-card p,.mfg-card li{font-size:8px;color:#8197a5;line-height:1.5}.mfg-settings{display:grid;grid-template-columns:repeat(3,minmax(120px,1fr));gap:8px}.mfg-settings label{display:grid;gap:5px;font-size:8px;color:#8297a5}.mfg-settings input{border:1px solid #29414e;background:#08131b;color:#dce7ed;border-radius:7px;padding:8px}.mfg-actions{display:flex;gap:7px;flex-wrap:wrap}.mfg-actions button{border:1px solid #2d5260;background:#10232d;color:#cce0e7;border-radius:7px;padding:8px 10px;font-size:8px;font-weight:800}.mfg-actions button.primary{background:#156f5e;border-color:#2a9a83}.mfg-status{border:1px solid #2a414d;background:#08141c;border-radius:9px;padding:10px}.mfg-status.good{border-color:#2d695a}.mfg-status.bad{border-color:#70473e}.mfg-status h3{font-size:12px;margin:0 0 6px}.mfg-status ul{margin:6px 0;padding-left:18px}
      @media(max-width:850px){.mfg-grid,.mfg-settings{grid-template-columns:1fr}}
    `;document.head.appendChild(s)
  }

  function render(){
    const root=document.querySelector('#pcbpro-mfg-root');if(!root)return;installStyles();
    const r=state.lastPreflight;
    root.innerHTML=`
      <div class="mfg-settings">
        <label>${t('Lebar board fisik (mm)','Physical board width (mm)')}<input data-w type="number" min="0.1" step="0.01" value="${state.widthMm??''}" placeholder="e.g. 50.00"></label>
        <label>${t('Tinggi board fisik (mm)','Physical board height (mm)')}<input data-h type="number" min="0.1" step="0.01" value="${state.heightMm??''}" placeholder="e.g. 30.00"></label>
        <label>${t('Origin CAM','CAM origin')}<input value="Outline min X/Y" disabled></label>
      </div>
      <div class="mfg-actions"><button data-preflight>${t('Jalankan preflight','Run preflight')}</button><button class="primary" data-package>${t('Generate CAM ZIP','Generate CAM ZIP')}</button><button data-bom>BOM CSV</button><button data-cpl>CPL CSV</button></div>
      ${r?`<div class="mfg-status ${r.findings.length?'bad':'good'}"><h3>${r.readyForProduction?t('Production candidate','Production candidate'):r.readyForDraft?t('Engineering draft siap','Engineering draft ready'):t('Export diblokir','Export blocked')}</h3><p>${t('Coverage','Coverage')}: ${r.coverage.tracks} tracks · ${r.coverage.vias} vias · ${r.coverage.placements} placements · ${r.coverage.physicalPads} verified physical pads.</p>${r.findings.length?`<b>BLOCKERS</b><ul>${r.findings.map(x=>`<li>${esc(x.code)} · ${esc(x.message)}</li>`).join('')}</ul>`:''}${r.warnings.length?`<b>LIMITATIONS</b><ul>${r.warnings.map(x=>`<li>${esc(x.code)} · ${esc(x.message)}</li>`).join('')}</ul>`:''}</div>`:`<div class="mfg-status"><h3>${t('Belum dipreflight','Not preflighted yet')}</h3><p>${t('Masukkan ukuran fisik board lalu jalankan preflight. Export tidak menganggap data visual sebagai ukuran mekanik.','Enter physical board dimensions and run preflight. Export does not treat visual canvas scale as mechanical dimensions.')}</p></div>`}
      <div class="mfg-grid"><article class="mfg-card"><b>GERBER RS-274X</b><strong>F.Cu / B.Cu / Edge.Cuts</strong><p>${t('Menghasilkan copper track/via yang geometri fisiknya diketahui. Pad footprint tidak dipalsukan bila physical pad geometry belum tersedia.','Generates known copper track/via geometry. Footprint pads are never fabricated when physical pad geometry is unavailable.')}</p></article><article class="mfg-card"><b>EXCELLON</b><strong>Via drill</strong><p>${t('Drill file dibangun dari via diameter/drill yang tersimpan.','Drill file is generated from stored via diameter/drill geometry.')}</p></article><article class="mfg-card"><b>BOM / CPL / MANIFEST</b><strong>Traceable package</strong><p>${t('ZIP berisi checksum SHA-256, coverage dan release class supaya draft tidak tertukar dengan production candidate.','ZIP includes SHA-256 checksums, coverage and release class so drafts cannot be confused with production candidates.')}</p></article></div>
    `;
    const w=root.querySelector('[data-w]'),h=root.querySelector('[data-h]');
    const applyDims=()=>{state.widthMm=n(w.value);state.heightMm=n(h.value);save();state.lastPreflight=null};
    w.addEventListener('change',applyDims);h.addEventListener('change',applyDims);
    root.querySelector('[data-preflight]').onclick=preflight;
    root.querySelector('[data-package]').onclick=()=>buildPackage().catch(e=>window.PCBProWorkspaceRepair?.notify?.(e?.message||String(e),'warn'));
    root.querySelector('[data-bom]').onclick=()=>downloadText(`${projectName()}-BOM.csv`,bomCsv(),'text/csv');
    root.querySelector('[data-cpl]').onclick=()=>{const b=board(),cal=calibration(b);if(!cal)return window.PCBProWorkspaceRepair?.notify?.(t('Masukkan ukuran board dulu.','Enter board dimensions first.'),'warn');downloadText(`${projectName()}-CPL.csv`,cplCsv(cal,b),'text/csv')};
  }

  function mount(){
    const panel=[...document.querySelectorAll('.panel')].find(p=>/FABRICATION/i.test(p.querySelector('.panel-title span')?.textContent||''));
    if(!panel)return;
    let root=panel.querySelector('#pcbpro-mfg-root');if(!root){root=document.createElement('div');root.id='pcbpro-mfg-root';panel.querySelector('.cards')?.remove();panel.appendChild(root)}
    render();
  }
  function start(){
    load();installStyles();document.addEventListener('click',e=>{const tab=e.target?.closest?.('.tabs button');if(tab&&/fabrication|fabrikasi/i.test(tab.dataset.pcbView||tab.textContent||''))setTimeout(mount,30)},{passive:true});
    window.addEventListener('pcbpro:board-changed',()=>{state.lastPreflight=null;if(document.querySelector('#pcbpro-mfg-root'))render()});
    window.addEventListener('pcbpro:professional-rules-changed',()=>{state.lastPreflight=null;if(document.querySelector('#pcbpro-mfg-root'))render()});
    setTimeout(mount,0);
  }

  window.PCBProManufacturing={version:VERSION,preflight,buildPackage,mount,render,get state(){return structuredClone(state)},get lastPreflight(){return state.lastPreflight?structuredClone(state.lastPreflight):null}};

  window.PCBProExplain?.register?.({
    id:'feature.manufacturing-v120',match:['gerber','excellon','manufacturing export','cam zip','cpl'],category:'manufacturing',status:'active-with-coverage-gates',
    title:{id:'Manufacturing/CAM Export Engine',en:'Manufacturing/CAM Export Engine'},
    what:{id:'Exporter deterministik Gerber/Excellon/BOM/CPL/manifest berbasis geometry project yang tersimpan.',en:'Deterministic Gerber/Excellon/BOM/CPL/manifest exporter based on persisted project geometry.'},
    limits:{id:'Production candidate hanya boleh bila physical footprint-pad geometry terverifikasi tersedia. Tanpa itu output diberi kelas ENGINEERING DRAFT dan tidak boleh dianggap siap fabrikasi.',en:'Production-candidate status requires verified physical footprint-pad geometry. Without it, output is classified ENGINEERING DRAFT and must not be treated as fabrication-ready.'}
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();