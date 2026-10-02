(() => {
  'use strict';
  if (window.PCBProGeometry3D) return;

  const VERSION='1.20.0';
  const KEY='pcbpro0045-3d-v120';
  let yaw=-0.75,pitch=0.9,zoom=1,panX=0,panY=0,drag=null,raf=0;

  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  const t=(id,en)=>lang()==='id'?id:en;
  const clamp=(a,v,b)=>Math.max(a,Math.min(b,v));
  const components=()=>window.PCBProProject?.getComponents?.()||[];
  const board=()=>{try{window.PCBProBoardModel?.captureGeometry?.()}catch{}return window.PCBProBoardModel?.model||{outline:[],tracks:[],placements:[],pads:[],worldSize:null}};
  const advanced=()=>window.PCBProAdvancedBoard?.model||{vias:[],zones:[],keepouts:[]};
  const mfg=()=>window.PCBProManufacturing?.state||{};

  function save(){try{localStorage.setItem(KEY,JSON.stringify({yaw,pitch,zoom,panX,panY}))}catch{}}
  function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(x){yaw=Number.isFinite(x.yaw)?x.yaw:yaw;pitch=Number.isFinite(x.pitch)?x.pitch:pitch;zoom=Number.isFinite(x.zoom)?x.zoom:zoom;panX=Number.isFinite(x.panX)?x.panX:panX;panY=Number.isFinite(x.panY)?x.panY:panY}}catch{}}
  function bbox(points){if(!points?.length)return null;const xs=points.map(p=>Number(p.x)).filter(Number.isFinite),ys=points.map(p=>Number(p.y)).filter(Number.isFinite);if(!xs.length||!ys.length)return null;return{minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}}
  function worldModel(){
    const b=board(),a=advanced(),box=bbox(b.outline||[]);
    const physical=Number(mfg().widthMm)>0&&Number(mfg().heightMm)>0&&box&&box.w>0&&box.h>0;
    const sx=physical?Number(mfg().widthMm)/box.w:1,sy=physical?Number(mfg().heightMm)/box.h:1;
    const toPoint=p=>box?{x:(Number(p.x)-box.minX)*sx,y:(Number(p.y)-box.minY)*sy}:{x:Number(p.x)||0,y:Number(p.y)||0};
    const placements=(b.placements||[]).map(p=>({...p,...toPoint(p)}));
    if(!placements.length&&b.worldSize){
      for(const c of components().filter(x=>x.footprint&&x.footprint!=='—')){
        placements.push({ref:c.id,x:(Number(c.px)||0)/100*b.worldSize.width*sx,y:(Number(c.py)||0)/100*b.worldSize.height*sy,rotationDeg:Number(c.rot)||0});
      }
    }
    return{
      physical,
      unit:physical?'mm':'canvas-unit',
      outline:(b.outline||[]).map(toPoint),
      tracks:(b.tracks||[]).map(tr=>({...tr,pts:[tr.start,...(tr.corners||[]),tr.end].filter(Boolean).map(toPoint)})),
      pads:(b.pads||[]).map(p=>({...p,...toPoint(p)})),
      placements,
      vias:(a.vias||[]).map(v=>({...v,...toPoint(v)})),
      zones:(a.zones||[]).map(z=>({...z,points:(z.points||z.poly||[]).map(toPoint)})),
      components:components()
    }
  }

  function project(p,z,cx,cy,scale){
    const x=p.x,y=p.y;
    const cyaw=Math.cos(yaw),syaw=Math.sin(yaw);
    const xr=x*cyaw-y*syaw,yr=x*syaw+y*cyaw;
    const cp=Math.cos(pitch),sp=Math.sin(pitch);
    const y2=yr*cp-z*sp,z2=yr*sp+z*cp;
    return{x:cx+xr*scale,y:cy+y2*scale,depth:z2};
  }
  function poly(ctx,pts,fill,stroke,width=1){
    if(pts.length<2)return;ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(const p of pts.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke()}
  }
  function line(ctx,pts,stroke,width=1){
    if(pts.length<2)return;ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(const p of pts.slice(1))ctx.lineTo(p.x,p.y);ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke()
  }

  function draw(){
    raf=0;const canvas=document.querySelector('#pcbpro-3d-canvas');if(!canvas)return;
    const rect=canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);
    const w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,rect.width,rect.height);
    ctx.fillStyle='#071018';ctx.fillRect(0,0,rect.width,rect.height);
    const m=worldModel(),bb=bbox(m.outline);
    if(!bb||bb.w<=0||bb.h<=0){
      ctx.fillStyle='#8aa0ac';ctx.font='12px system-ui';ctx.fillText(t('Belum ada Edge.Cuts. Buat outline di tab PCB.','No Edge.Cuts yet. Create a board outline in the PCB tab.'),24,36);updateMeta(m);return;
    }
    const span=Math.max(bb.w,bb.h,1),scale=Math.min(rect.width,rect.height)/span*0.58*zoom,cx=rect.width/2+panX,cy=rect.height/2+panY;
    const ox=(bb.minX+bb.maxX)/2,oy=(bb.minY+bb.maxY)/2;
    const norm=p=>({x:p.x-ox,y:p.y-oy});

    const outlineTop=m.outline.map(p=>project(norm(p),0,cx,cy,scale));
    poly(ctx,outlineTop,'#123f35','#d1b35c',1.6);

    for(const z of m.zones){
      if((z.points||[]).length<3)continue;
      poly(ctx,z.points.map(p=>project(norm(p),0.04,cx,cy,scale)),'rgba(61,124,183,.16)','rgba(91,154,218,.7)',1);
    }

    for(const tr of m.tracks){
      if((tr.pts||[]).length<2)continue;
      const color=(tr.layer||'F.Cu')==='B.Cu'?'#5c8fe0':'#e06b55';
      const width=Math.max(1.2,Math.min(6,(Number(tr.widthMm)||0.25)*(m.physical?scale:3.5)));
      line(ctx,tr.pts.map(p=>project(norm(p),0.08,cx,cy,scale)),color,width);
    }

    for(const v of m.vias){
      const p=project(norm(v),0.1,cx,cy,scale);
      const dia=Number(v.diameterMm||v.diameter||0.6);
      const r=m.physical?Math.max(2,dia*scale/2):4;
      ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle='#d6b95c';ctx.fill();ctx.strokeStyle='#17130b';ctx.lineWidth=1;ctx.stroke();
      ctx.beginPath();ctx.arc(p.x,p.y,Math.max(1,r*.42),0,Math.PI*2);ctx.fillStyle='#071018';ctx.fill();
    }

    const compMap=new Map(m.components.map(c=>[c.id,c]));
    for(const p of m.placements){
      const q=project(norm(p),0.12,cx,cy,scale),comp=compMap.get(p.ref);
      ctx.save();ctx.translate(q.x,q.y);ctx.rotate(-(Number(p.rotationDeg)||0)*Math.PI/180+yaw*.18);
      ctx.strokeStyle='#a6c4b8';ctx.lineWidth=1;ctx.fillStyle='rgba(16,31,40,.86)';
      const bw=42,bh=22;ctx.fillRect(-bw/2,-bh/2,bw,bh);ctx.strokeRect(-bw/2,-bh/2,bw,bh);
      ctx.restore();ctx.fillStyle='#dce8ed';ctx.font='700 8px ui-monospace';ctx.fillText(p.ref,q.x+24,q.y-2);
      if(comp?.footprint){ctx.fillStyle='#728b96';ctx.font='7px ui-monospace';ctx.fillText(String(comp.footprint).slice(0,18),q.x+24,q.y+8)}
    }

    ctx.fillStyle='#718995';ctx.font='8px ui-monospace';
    ctx.fillText(m.physical?t(`Skala geometri: ${Number(mfg().widthMm).toFixed(2)} × ${Number(mfg().heightMm).toFixed(2)} mm`,`Geometry scale: ${Number(mfg().widthMm).toFixed(2)} × ${Number(mfg().heightMm).toFixed(2)} mm`):t('Skala fisik belum dikalibrasi · visualisasi memakai canvas-unit','Physical scale unresolved · visualization uses canvas units'),14,rect.height-14);
    updateMeta(m);
  }

  function schedule(){if(!raf)raf=requestAnimationFrame(draw)}
  function updateMeta(m){
    const meta=document.querySelector('#pcbpro-3d-meta');if(!meta)return;
    const stepBodies=window.PCBProStepBodies?.count?.()||0;
    meta.innerHTML=`<span>${m.outline.length} outline</span><span>${m.tracks.length} tracks</span><span>${m.vias.length} vias</span><span>${m.placements.length} placements</span><span>STEP bodies: ${stepBodies}</span><span>${m.physical?t('physical XY calibrated','physical XY calibrated'):t('scale unresolved','scale unresolved')}</span>`;
  }

  function mount(){
    const panel=[...document.querySelectorAll('.panel')].find(p=>/3D ASSEMBLY/i.test(p.querySelector('.panel-title span')?.textContent||''));
    if(!panel)return;
    installStyles();
    let root=panel.querySelector('#pcbpro-3d-root');
    if(!root){
      panel.querySelector('.cards')?.remove();
      root=document.createElement('div');root.id='pcbpro-3d-root';
      root.innerHTML=`<div class="g3-toolbar"><button data-reset>${t('Reset view','Reset view')}</button><button data-pcb>PCB</button><button data-png>PNG snapshot</button><b>${t('Drag: orbit · Wheel: zoom','Drag: orbit · Wheel: zoom')}</b></div><canvas id="pcbpro-3d-canvas"></canvas><div id="pcbpro-3d-meta"></div><div class="g3-note">${t('Ini adalah 3D geometry viewer dari board outline, copper, via dan placement aktual. Body komponen belum dianggap mekanik akurat sampai STEP/verified body model tersedia.','This is a geometry-driven 3D viewer of the actual board outline, copper, vias, and placements. Component bodies are not treated as mechanically accurate until STEP/verified body models are available.')}</div>`;
      panel.appendChild(root);
      const canvas=root.querySelector('canvas');
      canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;const tool=(document.querySelector('.tools button.active')?.dataset.pcbTool||document.querySelector('.tools button.active small')?.textContent||'orbit').trim().toLowerCase();drag={id:e.pointerId,x:e.clientX,y:e.clientY,yaw,pitch,panX,panY,mode:tool==='pan'?'pan':'orbit'};canvas.setPointerCapture?.(e.pointerId)});
      canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;if(drag.mode==='pan'){panX=drag.panX+(e.clientX-drag.x);panY=drag.panY+(e.clientY-drag.y)}else{yaw=drag.yaw+(e.clientX-drag.x)*.008;pitch=clamp(.2,drag.pitch+(e.clientY-drag.y)*.006,1.45)}save();schedule()});
      canvas.addEventListener('pointerup',e=>{if(drag?.id===e.pointerId)drag=null});
      canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=clamp(.35,zoom*(e.deltaY>0?.9:1.1),3);save();schedule()},{passive:false});
      root.querySelector('[data-reset]').onclick=()=>{yaw=-.75;pitch=.9;zoom=1;panX=0;panY=0;save();schedule()};
      root.querySelector('[data-pcb]').onclick=()=>window.PCBProCommand?.clickView?.('pcb');
      root.querySelector('[data-png]').onclick=()=>{schedule();setTimeout(()=>{const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='pcbpro-3d-geometry.png';a.click()},40)};
    }
    schedule();
  }

  function installStyles(){
    if(document.querySelector('#pcbpro-3d-style'))return;
    const s=document.createElement('style');s.id='pcbpro-3d-style';s.textContent=`
      #pcbpro-3d-root{height:calc(100% - 4px);min-height:360px;display:grid;grid-template-rows:auto minmax(280px,1fr) auto auto;gap:8px}
      .g3-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.g3-toolbar button{border:1px solid #2a4754;background:#10222b;color:#c9d9e0;border-radius:7px;padding:7px 9px;font-size:8px;font-weight:800}.g3-toolbar b{margin-left:auto;color:#718895;font:800 7px ui-monospace}
      #pcbpro-3d-canvas{width:100%;height:100%;min-height:300px;border:1px solid #213844;border-radius:10px;background:#071018;touch-action:none;cursor:grab}#pcbpro-3d-canvas:active{cursor:grabbing}
      #pcbpro-3d-meta{display:flex;gap:6px;flex-wrap:wrap}#pcbpro-3d-meta span{border:1px solid #2a414c;background:#0a1720;border-radius:999px;padding:5px 8px;color:#88a1ad;font:800 7px ui-monospace}.g3-note{border:1px solid #5a4a2c;background:#211c12;color:#cdbb79;border-radius:8px;padding:8px;font-size:8px;line-height:1.5}
    `;document.head.appendChild(s)
  }

  function start(){
    load();installStyles();
    document.addEventListener('click',e=>{const tab=e.target?.closest?.('.tabs button');if(tab&&/^3d$/i.test(String(tab.dataset.pcbView||tab.textContent||'').trim()))setTimeout(mount,30)},{passive:true});
    window.addEventListener('resize',schedule,{passive:true});
    window.addEventListener('pcbpro:board-changed',schedule);
    window.addEventListener('pcbpro:manufacturing-preflight',schedule);
    setTimeout(mount,0);
  }

  window.PCBProGeometry3D={version:VERSION,mount,refresh:schedule,zoomBy(factor=1.15){zoom=clamp(.35,zoom*Number(factor||1),3);save();schedule();return zoom},reset(){yaw=-.75;pitch=.9;zoom=1;panX=0;panY=0;save();schedule()},snapshot:worldModel};

  window.PCBProExplain?.register?.({
    id:'feature.geometry-3d-v120',match:['3d','mechanical preview','board viewer'],category:'mechanical',status:'geometry-driven-preview',
    title:{id:'3D Geometry Viewer',en:'3D Geometry Viewer'},
    what:{id:'Viewer 3D interaktif yang membaca Edge.Cuts, track, via dan placement dari project aktif.',en:'Interactive 3D viewer reading Edge.Cuts, tracks, vias, and placements from the active project.'},
    limits:{id:'Component bodies masih placement proxy sampai verified STEP/body geometry tersedia, sehingga belum boleh dipakai untuk mechanical collision sign-off.',en:'Component bodies remain placement proxies until verified STEP/body geometry is available, so this is not mechanical collision sign-off.'}
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();