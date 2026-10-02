(() => {
  'use strict';
  if (window.PCBProPhysicalDRC) return;

  const VERSION='1.21.0';
  const EPS=1e-9;

  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  const t=(id,en)=>lang()==='id'?id:en;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

  function board(){try{window.PCBProBoardModel?.captureGeometry?.()}catch{}return window.PCBProBoardModel?.model||{tracks:[],outline:[]}}
  function advanced(){return window.PCBProAdvancedBoard?.model||{vias:[],zones:[],keepouts:[]}}
  function rules(){return window.PCBProProfessional?.state||{}}
  function mfg(){return window.PCBProManufacturing?.state||{}}

  function bbox(points){
    if(!Array.isArray(points)||points.length<3)return null;
    const xs=points.map(p=>num(p.x,NaN)).filter(Number.isFinite),ys=points.map(p=>num(p.y,NaN)).filter(Number.isFinite);
    if(xs.length<3||ys.length<3)return null;
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    if(maxX-minX<=EPS||maxY-minY<=EPS)return null;
    return {minX,maxX,minY,maxY,width:maxX-minX,height:maxY-minY};
  }

  function calibration(b){
    const box=bbox(b.outline||[]),widthMm=num(mfg().widthMm),heightMm=num(mfg().heightMm);
    if(!box||widthMm<=0||heightMm<=0)return null;
    return {
      box,widthMm,heightMm,
      point(p){return{x:(num(p.x)-box.minX)/box.width*widthMm,y:(num(p.y)-box.minY)/box.height*heightMm}},
      sx:widthMm/box.width,sy:heightMm/box.height
    };
  }

  function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
  function pointSeg(p,a,b){
    const vx=b.x-a.x,vy=b.y-a.y,den=vx*vx+vy*vy;
    if(den<=EPS)return dist(p,a);
    const q=Math.max(0,Math.min(1,((p.x-a.x)*vx+(p.y-a.y)*vy)/den));
    return Math.hypot(p.x-(a.x+q*vx),p.y-(a.y+q*vy));
  }
  function orient(a,b,c){const v=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);return Math.abs(v)<1e-10?0:(v>0?1:-1)}
  function onSeg(a,b,p){return Math.min(a.x,b.x)-EPS<=p.x&&p.x<=Math.max(a.x,b.x)+EPS&&Math.min(a.y,b.y)-EPS<=p.y&&p.y<=Math.max(a.y,b.y)+EPS}
  function intersects(a,b,c,d){
    const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);
    if(o1!==o2&&o3!==o4)return true;
    return (o1===0&&onSeg(a,b,c))||(o2===0&&onSeg(a,b,d))||(o3===0&&onSeg(c,d,a))||(o4===0&&onSeg(c,d,b));
  }
  function segDist(a,b,c,d){
    if(intersects(a,b,c,d))return 0;
    return Math.min(pointSeg(a,c,d),pointSeg(b,c,d),pointSeg(c,a,b),pointSeg(d,a,b));
  }
  function segs(points,closed=false){
    const out=[];for(let i=0;i<points.length-1;i++)out.push([points[i],points[i+1]]);
    if(closed&&points.length>2)out.push([points.at(-1),points[0]]);
    return out;
  }
  function trackPoints(tr){
    return [tr.start,...(Array.isArray(tr.corners)?tr.corners:[]),tr.end].filter(p=>p&&Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.y)));
  }

  function finding(code,severity,message,detail={}){
    return {code,severity,message,...detail};
  }

  function run(){
    const b=board(),a=advanced(),r=rules(),cal=calibration(b);
    const findings=[],coverage={tracks:0,vias:0,trackPairs:0,viaTrackPairs:0,viaPairs:0,outlineSegments:0};

    if(!cal){
      return {
        version:VERSION,time:new Date().toISOString(),ready:false,calibrated:false,
        findings:[finding('PHYSICAL_SCALE','blocker',t('Physical DRC butuh ukuran board mm dari tab Fabrikasi.','Physical DRC requires physical board dimensions from the Fabrication tab.'))],
        coverage
      };
    }

    const outline=(b.outline||[]).map(cal.point),outlineSegs=segs(outline,true);
    coverage.outlineSegments=outlineSegs.length;

    for(let i=0;i<outlineSegs.length;i++){
      for(let j=i+1;j<outlineSegs.length;j++){
        const adjacent=j===i+1||(i===0&&j===outlineSegs.length-1);
        if(adjacent)continue;
        if(intersects(outlineSegs[i][0],outlineSegs[i][1],outlineSegs[j][0],outlineSegs[j][1])){
          findings.push(finding('OUTLINE_SELF_INTERSECTION','error',t('Edge.Cuts saling berpotongan.','Edge.Cuts self-intersects.'),{segments:[i,j]}));
        }
      }
    }

    const tracks=[];
    for(const tr of b.tracks||[]){
      const pts=trackPoints(tr);
      if(pts.length<2){
        findings.push(finding('TRACK_GEOMETRY','error',t('Track '+tr.id+' tidak punya geometri endpoint lengkap.','Track '+tr.id+' is missing complete endpoint geometry.'),{trackId:tr.id}));
        continue;
      }
      const mm=pts.map(cal.point),widthMm=num(tr.widthMm,0.25);
      tracks.push({...tr,pointsMm:mm,widthMm,segments:segs(mm,false)});
      coverage.tracks++;
      if(widthMm+EPS<num(r.trackWidthMm,0)){
        findings.push(finding('TRACK_WIDTH','error',t('Track '+tr.id+' terlalu sempit: '+widthMm.toFixed(3)+' mm < '+num(r.trackWidthMm).toFixed(3)+' mm.','Track '+tr.id+' is too narrow: '+widthMm.toFixed(3)+' mm < '+num(r.trackWidthMm).toFixed(3)+' mm.'),{trackId:tr.id,actualMm:widthMm,requiredMm:num(r.trackWidthMm)}));
      }
      let edge=Infinity;
      for(const s of segs(mm,false))for(const e of outlineSegs)edge=Math.min(edge,segDist(s[0],s[1],e[0],e[1]));
      const copperEdge=edge-widthMm/2;
      if(Number.isFinite(copperEdge)&&copperEdge+EPS<num(r.edgeClearanceMm,0)){
        findings.push(finding('TRACK_EDGE_CLEARANCE','error',t('Track '+tr.id+' terlalu dekat Edge.Cuts: '+Math.max(0,copperEdge).toFixed(3)+' mm.','Track '+tr.id+' is too close to Edge.Cuts: '+Math.max(0,copperEdge).toFixed(3)+' mm.'),{trackId:tr.id,actualMm:copperEdge,requiredMm:num(r.edgeClearanceMm)}));
      }
    }

    for(let i=0;i<tracks.length;i++)for(let j=i+1;j<tracks.length;j++){
      const A=tracks[i],B=tracks[j];
      if((A.layer||'F.Cu')!==(B.layer||'F.Cu')||A.net===B.net)continue;
      coverage.trackPairs++;
      let center=Infinity;
      for(const sa of A.segments)for(const sb of B.segments)center=Math.min(center,segDist(sa[0],sa[1],sb[0],sb[1]));
      const clearance=center-A.widthMm/2-B.widthMm/2;
      if(clearance+EPS<num(r.clearanceMm,0)){
        findings.push(finding('TRACK_CLEARANCE','error',t('Clearance copper '+A.id+' ↔ '+B.id+' hanya '+Math.max(0,clearance).toFixed(3)+' mm.','Copper clearance '+A.id+' ↔ '+B.id+' is only '+Math.max(0,clearance).toFixed(3)+' mm.'),{tracks:[A.id,B.id],nets:[A.net,B.net],layer:A.layer||'F.Cu',actualMm:clearance,requiredMm:num(r.clearanceMm)}));
      }
    }

    const vias=(a.vias||[]).map(v=>({...v,pointMm:cal.point(v),diameterMm:num(v.diameterMm||v.diameter,0.6),drillMm:num(v.drillMm||v.drill,0.3)}));
    coverage.vias=vias.length;
    const requiredRing=Math.max(0,(num(r.viaDiameterMm)-num(r.viaDrillMm))/2);
    for(const v of vias){
      if(v.diameterMm+EPS<num(r.viaDiameterMm,0))findings.push(finding('VIA_DIAMETER','error',t('Via '+v.id+' diameter '+v.diameterMm.toFixed(3)+' mm di bawah rule.','Via '+v.id+' diameter '+v.diameterMm.toFixed(3)+' mm is below rule.'),{viaId:v.id,actualMm:v.diameterMm,requiredMm:num(r.viaDiameterMm)}));
      if(v.drillMm+EPS<num(r.viaDrillMm,0))findings.push(finding('VIA_DRILL','error',t('Via '+v.id+' drill '+v.drillMm.toFixed(3)+' mm di bawah rule.','Via '+v.id+' drill '+v.drillMm.toFixed(3)+' mm is below rule.'),{viaId:v.id,actualMm:v.drillMm,requiredMm:num(r.viaDrillMm)}));
      const ring=(v.diameterMm-v.drillMm)/2;
      if(ring+EPS<requiredRing)findings.push(finding('ANNULAR_RING','error',t('Via '+v.id+' annular ring '+ring.toFixed(3)+' mm < '+requiredRing.toFixed(3)+' mm.','Via '+v.id+' annular ring '+ring.toFixed(3)+' mm < '+requiredRing.toFixed(3)+' mm.'),{viaId:v.id,actualMm:ring,requiredMm:requiredRing}));
      let edge=Infinity;for(const e of outlineSegs)edge=Math.min(edge,pointSeg(v.pointMm,e[0],e[1]));
      const copperEdge=edge-v.diameterMm/2;
      if(copperEdge+EPS<num(r.edgeClearanceMm,0))findings.push(finding('VIA_EDGE_CLEARANCE','error',t('Via '+v.id+' terlalu dekat Edge.Cuts: '+Math.max(0,copperEdge).toFixed(3)+' mm.','Via '+v.id+' is too close to Edge.Cuts: '+Math.max(0,copperEdge).toFixed(3)+' mm.'),{viaId:v.id,actualMm:copperEdge,requiredMm:num(r.edgeClearanceMm)}));

      for(const tr of tracks){
        if(v.net&&tr.net&&v.net===tr.net)continue;
        coverage.viaTrackPairs++;
        let center=Infinity;for(const s of tr.segments)center=Math.min(center,pointSeg(v.pointMm,s[0],s[1]));
        const clearance=center-v.diameterMm/2-tr.widthMm/2;
        if(clearance+EPS<num(r.clearanceMm,0))findings.push(finding('VIA_TRACK_CLEARANCE','error',t('Via '+v.id+' terlalu dekat track '+tr.id+': '+Math.max(0,clearance).toFixed(3)+' mm.','Via '+v.id+' is too close to track '+tr.id+': '+Math.max(0,clearance).toFixed(3)+' mm.'),{viaId:v.id,trackId:tr.id,actualMm:clearance,requiredMm:num(r.clearanceMm)}));
      }
    }

    for(let i=0;i<vias.length;i++)for(let j=i+1;j<vias.length;j++){
      const A=vias[i],B=vias[j];if(A.net&&B.net&&A.net===B.net)continue;
      coverage.viaPairs++;
      const clearance=dist(A.pointMm,B.pointMm)-A.diameterMm/2-B.diameterMm/2;
      if(clearance+EPS<num(r.clearanceMm,0))findings.push(finding('VIA_CLEARANCE','error',t('Clearance via '+A.id+' ↔ '+B.id+' hanya '+Math.max(0,clearance).toFixed(3)+' mm.','Via clearance '+A.id+' ↔ '+B.id+' is only '+Math.max(0,clearance).toFixed(3)+' mm.'),{vias:[A.id,B.id],actualMm:clearance,requiredMm:num(r.clearanceMm)}));
    }

    const report={
      version:VERSION,time:new Date().toISOString(),calibrated:true,
      profile:r.profile||'custom',dimensionsMm:{width:cal.widthMm,height:cal.heightMm},
      rules:{trackWidthMm:num(r.trackWidthMm),clearanceMm:num(r.clearanceMm),viaDiameterMm:num(r.viaDiameterMm),viaDrillMm:num(r.viaDrillMm),edgeClearanceMm:num(r.edgeClearanceMm),annularRingMm:requiredRing},
      findings,coverage,ready:findings.every(x=>x.severity!=='blocker'&&x.severity!=='error')
    };
    window.dispatchEvent(new CustomEvent('pcbpro:physical-drc',{detail:report}));
    return report;
  }

  function show(){
    const report=run();
    document.querySelector('#pcbpro-physical-drc-modal')?.remove();
    const m=document.createElement('div');m.id='pcbpro-physical-drc-modal';
    const rows=report.findings.map(x=>'<li><b>'+esc(x.code)+'</b> · '+esc(x.message)+'</li>').join('');
    m.innerHTML='<section><header><div><small>PCB PRO · PHYSICAL DRC v'+VERSION+'</small><h3>'+ (report.ready?t('Physical DRC lulus','Physical DRC passed'):t(report.findings.length+' temuan physical DRC',report.findings.length+' physical DRC finding(s)'))+'</h3></div><button data-close>×</button></header><p>'+t('Pemeriksaan ini memakai ukuran board fisik dalam mm dan professional rule profile. Hasil tetap bergantung pada coverage geometri yang tersedia.','These checks use physical board dimensions in mm and the professional rule profile. Results still depend on available geometry coverage.')+'</p>'+(rows?'<ul>'+rows+'</ul>':'<div class="ok">'+t('Tidak ada pelanggaran pada check fisik yang sudah diimplementasikan.','No violations in the implemented physical checks.')+'</div>')+'<footer>'+report.coverage.tracks+' tracks · '+report.coverage.vias+' vias · '+report.coverage.trackPairs+' track-pairs checked</footer></section>';
    document.body.appendChild(m);m.querySelector('[data-close]').onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove()};
  }

  function installStyles(){
    if(document.querySelector('#pcbpro-physical-drc-style'))return;
    const s=document.createElement('style');s.id='pcbpro-physical-drc-style';s.textContent=`
      #pcbpro-physical-drc-modal{position:fixed;z-index:2600;inset:0;background:#000c;display:grid;place-items:center;padding:16px}
      #pcbpro-physical-drc-modal section{width:min(820px,95vw);max-height:86vh;overflow:auto;border:1px solid #36515e;background:#0b1821;color:#dce8ed;border-radius:13px;padding:14px;box-shadow:0 25px 90px #000d}
      #pcbpro-physical-drc-modal header{display:flex;gap:10px;align-items:start;border-bottom:1px solid #203741;padding-bottom:10px}#pcbpro-physical-drc-modal header div{flex:1}#pcbpro-physical-drc-modal small{font:800 8px ui-monospace;color:#63d3bb}#pcbpro-physical-drc-modal h3{margin:4px 0;font-size:17px}#pcbpro-physical-drc-modal button{border:1px solid #35505d;background:#10212a;color:#dce8ed;border-radius:7px;padding:6px 9px}
      #pcbpro-physical-drc-modal p,#pcbpro-physical-drc-modal li{font-size:9px;line-height:1.55;color:#a8bac3}#pcbpro-physical-drc-modal li{margin:6px 0}#pcbpro-physical-drc-modal footer{margin-top:10px;color:#718994;font:800 8px ui-monospace}.ok{border:1px solid #285f53;background:#0e2b25;color:#71d9c1;border-radius:8px;padding:10px;font-size:9px}
    `;document.head.appendChild(s)
  }

  function start(){installStyles()}
  window.PCBProPhysicalDRC={version:VERSION,run,show};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();