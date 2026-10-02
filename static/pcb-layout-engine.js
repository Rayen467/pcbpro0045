(() => {
  'use strict';
  if (window.PCBProBoardModel) return;

  const NS='http://www.w3.org/2000/svg';
  const VERSION='1.0.0';
  const KEY='pcbpro0045-board-v1';
  let model={version:VERSION,tracks:[],outline:[]};
  let overlay=null,padLayer=null,hud=null;
  let currentRoute=null,pointerWorld=null,outlineMode=false,currentLayer='F.Cu';
  let scheduled=false,selectedTrack='';

  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  const t=(id,en)=>lang()==='id'?id:en;
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const svg=(tag,attrs={})=>{const el=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,String(v));return el};

  function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(x&&Array.isArray(x.tracks)&&Array.isArray(x.outline))model={version:VERSION,tracks:x.tracks,outline:x.outline}}catch{}}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(model))}catch{}}
  function stage(){return document.querySelector('.stage.pcbstage')}
  function world(){return document.querySelector('.stage.pcbstage .world')}
  function inPcb(){return Boolean(stage())}
  function activeTool(){const b=document.querySelector('.tools button.active');return b?.dataset.pcbTool||String(b?.querySelector('small')?.textContent||b?.textContent||'').trim().toLowerCase()}
  function routeMode(){return inPcb()&&activeTool()==='route'&&!outlineMode}

  function nets(){return window.PCBProWireEngine?.nets||[]}
  function footprintInfo(el){const ref=el.querySelector('span')?.textContent?.trim()||'';return{ref,el}}
  function pinCountForRef(ref){const max=nets().flatMap(n=>n.pinList||String(n.pins||'').split(/[·,;\s]+/)).filter(p=>String(p).startsWith(`${ref}.`)).map(p=>Number(String(p).split('.')[1])).filter(Number.isFinite);return Math.max(2,...max)}
  function specs(ref){const count=pinCountForRef(ref);if(count<=2)return[{n:1,side:'left',pos:50},{n:2,side:'right',pos:50}];const out=[];for(let i=1;i<=count;i++){const left=i<=Math.ceil(count/2);const local=left?i:i-Math.ceil(count/2);const total=left?Math.ceil(count/2):Math.floor(count/2);out.push({n:i,side:left?'left':'right',pos:(local/(total+1))*100})}return out}

  function clientToWorld(x,y){const w=world();if(!w)return{x:0,y:0};const r=w.getBoundingClientRect();const sx=r.width/Math.max(1,w.offsetWidth),sy=r.height/Math.max(1,w.offsetHeight);return{x:(x-r.left)/Math.max(.0001,sx),y:(y-r.top)/Math.max(.0001,sy)}}
  function pinPoint(id){const p=[...document.querySelectorAll('.pcb-board-pad')].find(x=>x.dataset.pin===id);if(!p)return null;const r=p.getBoundingClientRect();return clientToWorld(r.left+r.width/2,r.top+r.height/2)}
  function orth(points,target){const out=[...points],last=out[out.length-1];if(!last)return[target];if(Math.abs(last.x-target.x)<.5||Math.abs(last.y-target.y)<.5){out.push(target);return out}out.push({x:target.x,y:last.y},target);return out}
  function path(points){return points.length?`M ${points.map(p=>`${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ')}`:''}
  function trackPoints(tr,preview=null){const a=pinPoint(tr.from);if(!a)return[];let pts=[a,...(tr.corners||[])];const b=preview||pinPoint(tr.to);if(b)pts=orth(pts,b);return pts}
  function netForPin(pin){return nets().find(n=>(n.pinList||String(n.pins||'').split(/[·,;\s]+/)).includes(pin))||null}
  function sameNet(a,b){const na=netForPin(a),nb=netForPin(b);return na&&nb&&na.name===nb.name?na:null}

  function ensureLayers(){const w=world();if(!w){overlay=null;padLayer=null;return}if(!overlay?.isConnected||overlay.parentElement!==w){overlay=w.querySelector('[data-pcb-layout-overlay]');if(!overlay){overlay=svg('svg',{'data-pcb-layout-overlay':'1',preserveAspectRatio:'none'});w.prepend(overlay)}}if(!padLayer?.isConnected||padLayer.parentElement!==w){padLayer=w.querySelector('[data-pcb-pad-layer]');if(!padLayer){padLayer=document.createElement('div');padLayer.dataset.pcbPadLayer='1';w.appendChild(padLayer)}}}

  function installStyles(){if(document.querySelector('#pcbpro-board-style'))return;const s=document.createElement('style');s.id='pcbpro-board-style';s.textContent=`
    [data-pcb-layout-overlay]{position:absolute;inset:0;width:100%;height:100%;z-index:8;overflow:visible;pointer-events:none}[data-pcb-pad-layer]{position:absolute;inset:0;z-index:30;pointer-events:none}.pcb-board-pad{position:absolute;width:16px;height:16px;border:2px solid #e6c46b;background:#1b1710;border-radius:50%;transform:translate(-50%,-50%);display:grid;place-items:center;color:#fff;font:800 7px ui-monospace;opacity:.25;pointer-events:none;cursor:crosshair}.pcbstage.pcb-route-mode .pcb-board-pad,.pcbstage.pcb-outline-mode .pcb-board-pad{opacity:1}.pcbstage.pcb-route-mode .pcb-board-pad{pointer-events:auto}.pcb-board-pad:hover,.pcb-board-pad.start{background:#7a5d18;box-shadow:0 0 0 4px #e6c46b33}.pcb-track{fill:none;stroke-width:3;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round}.pcb-track[data-layer='F.Cu']{stroke:#e06b55}.pcb-track[data-layer='B.Cu']{stroke:#5c8fe0}.pcb-track.selected{stroke:#fff}.pcb-track-hit{fill:none;stroke:transparent;stroke-width:14;vector-effect:non-scaling-stroke;pointer-events:stroke;cursor:pointer}.pcb-route-preview{fill:none;stroke:#e8cb72;stroke-width:2.5;stroke-dasharray:7 4;vector-effect:non-scaling-stroke}.pcb-rats{fill:none;stroke:#7d8d98;stroke-width:1.2;stroke-dasharray:4 4;vector-effect:non-scaling-stroke;opacity:.7}.pcb-outline{fill:none;stroke:#f1ca5c;stroke-width:2;vector-effect:non-scaling-stroke}.pcb-outline-preview{fill:none;stroke:#f1ca5c;stroke-width:2;stroke-dasharray:6 4;vector-effect:non-scaling-stroke}.pcb-outline-node{fill:#f1ca5c;stroke:#121820;stroke-width:1;vector-effect:non-scaling-stroke}
    #pcbpro-board-hud{position:absolute;z-index:55;left:14px;top:46px;display:flex;align-items:center;gap:6px;border:1px solid #344a57;background:#0a1720ed;border-radius:9px;padding:6px;box-shadow:0 10px 30px #0008}#pcbpro-board-hud b{font:800 8px ui-monospace;color:#67d8c0;padding:0 4px}#pcbpro-board-hud button{border:1px solid #2b4653;background:#10212b;color:#bbccd5;border-radius:7px;padding:7px 9px;font-size:9px;font-weight:800}#pcbpro-board-hud button.active{border-color:#d3ad49;background:#3a2f13;color:#f5d87e}#pcbpro-board-hud .bad{color:#e99a84}#pcbpro-board-hud .good{color:#67d8c0}
    #pcbpro-board-report{position:fixed;z-index:1900;inset:0;background:#000b;display:grid;place-items:center;padding:16px}.pbr-card{width:min(700px,94vw);max-height:82vh;overflow:auto;border:1px solid #304b59;border-radius:13px;background:#0d1821;padding:15px;color:#dce7ed;box-shadow:0 30px 100px #000d}.pbr-card h3{font-size:21px;margin:4px 0}.pbr-card small{font:800 9px ui-monospace;color:#60d5bd}.pbr-card li,.pbr-card p{font-size:11px;line-height:1.55;color:#a9bbc5}.pbr-card button{border:1px solid #2a8c78;background:#176c5c;color:#fff;border-radius:8px;padding:9px 12px;font-weight:800}
  `;document.head.appendChild(s)}

  function syncPads(){const st=stage(),w=world();if(!st||!w)return;ensureLayers();st.classList.toggle('pcb-route-mode',routeMode());st.classList.toggle('pcb-outline-mode',outlineMode);const keep=new Set();for(const fp of st.querySelectorAll('.footprint')){const{ref}=footprintInfo(fp);if(!ref)continue;const fr=fp.getBoundingClientRect(),wr=w.getBoundingClientRect();for(const spec of specs(ref)){const id=`${ref}.${spec.n}`;keep.add(id);let p=padLayer.querySelector(`[data-pin="${CSS.escape(id)}"]`);if(!p){p=document.createElement('span');p.className='pcb-board-pad';p.dataset.pin=id;p.textContent=spec.n;p.title=id;p.addEventListener('pointerdown',onPadDown);padLayer.appendChild(p)}let cx=spec.side==='left'?fr.left:fr.right;let cy=fr.top+fr.height*spec.pos/100;const q=clientToWorld(cx,cy);p.style.left=`${q.x}px`;p.style.top=`${q.y}px`}}
    padLayer.querySelectorAll('.pcb-board-pad').forEach(p=>{if(!keep.has(p.dataset.pin))p.remove()})}

  function requiredEdges(){const edges=[];for(const n of nets()){const pins=n.pinList||String(n.pins||'').split(/[·,;\s]+/).filter(Boolean);for(let i=0;i<pins.length-1;i++)edges.push({net:n.name,a:pins[i],b:pins[i+1]})}return edges}
  function isEdgeRouted(a,b){return model.tracks.some(tr=>(tr.from===a&&tr.to===b)||(tr.from===b&&tr.to===a))}
  function draw(){scheduled=false;const w=world();if(!w)return;ensureLayers();syncPads();overlay.setAttribute('viewBox',`0 0 ${Math.max(1,w.offsetWidth)} ${Math.max(1,w.offsetHeight)}`);overlay.replaceChildren();
    for(const e of requiredEdges()){if(isEdgeRouted(e.a,e.b))continue;const a=pinPoint(e.a),b=pinPoint(e.b);if(a&&b)overlay.append(svg('path',{d:path([a,b]),class:'pcb-rats','data-net':e.net}))}
    if(model.outline.length>=2){const pts=[...model.outline];const d=path(pts)+(model.outline.length>=3?' Z':'');overlay.append(svg('path',{d,class:'pcb-outline'}));for(const p of pts)overlay.append(svg('circle',{cx:p.x,cy:p.y,r:3,class:'pcb-outline-node'}))}
    for(const tr of model.tracks){const pts=trackPoints(tr);if(pts.length<2)continue;const d=path(pts);const vis=svg('path',{d,class:`pcb-track${selectedTrack===tr.id?' selected':''}`,'data-layer':tr.layer||'F.Cu'});const hit=svg('path',{d,class:'pcb-track-hit','data-id':tr.id});hit.addEventListener('pointerdown',(e)=>{if(routeMode()||outlineMode)return;e.preventDefault();e.stopPropagation();selectedTrack=tr.id;schedule()});overlay.append(vis,hit)}
    if(currentRoute&&pointerWorld){const pts=trackPoints({from:currentRoute.from,corners:currentRoute.corners},pointerWorld);if(pts.length>1)overlay.append(svg('path',{d:path(pts),class:'pcb-route-preview'}))}
    if(outlineMode&&pointerWorld&&model.outline.length){overlay.append(svg('path',{d:path([...model.outline,pointerWorld]),class:'pcb-outline-preview'}))}
    updateHud()}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(draw)}

  function onPadDown(e){if(!routeMode()||e.button!==0)return;e.preventDefault();e.stopPropagation();const id=e.currentTarget.dataset.pin;if(!currentRoute){currentRoute={from:id,corners:[]};pointerWorld=pinPoint(id);e.currentTarget.classList.add('start');schedule();return}if(id===currentRoute.from){cancelRoute();return}const net=sameNet(currentRoute.from,id);if(!net){notify(t(`Tidak bisa short ${currentRoute.from} ke ${id}: kedua pin bukan net yang sama.`,`Cannot short ${currentRoute.from} to ${id}: they are not on the same net.`),'bad');return}if(!isEdgeRouted(currentRoute.from,id))model.tracks.push({id:`T${Date.now()}_${Math.random().toString(36).slice(2,6)}`,net:net.name,from:currentRoute.from,to:id,layer:currentLayer,corners:[...currentRoute.corners],widthMm:.25});save();cancelRoute(false);schedule();window.dispatchEvent(new CustomEvent('pcbpro:board-changed',{detail:{model:structuredClone(model)}}))}
  function cancelRoute(redraw=true){currentRoute=null;pointerWorld=null;document.querySelectorAll('.pcb-board-pad.start').forEach(p=>p.classList.remove('start'));if(redraw)schedule()}

  function canvasDown(e){const st=stage();if(!st||!st.contains(e.target)||e.button!==0)return;if(e.target.closest?.('.pcb-board-pad,.footprint,#pcbpro-board-hud,.layer-strip,.stage-info,.floating-card'))return;
    if(outlineMode){e.preventDefault();e.stopPropagation();const p=clientToWorld(e.clientX,e.clientY);model.outline.push(p);pointerWorld=p;save();schedule();return}
    if(routeMode()&&currentRoute){e.preventDefault();e.stopPropagation();const p=clientToWorld(e.clientX,e.clientY),start=currentRoute.corners.length?currentRoute.corners.at(-1):pinPoint(currentRoute.from);if(start&&Math.abs(start.x-p.x)>.5&&Math.abs(start.y-p.y)>.5)currentRoute.corners.push({x:p.x,y:start.y});currentRoute.corners.push(p);pointerWorld=p;schedule()}}
  function pointerMove(e){if((currentRoute&&routeMode())||outlineMode){pointerWorld=clientToWorld(e.clientX,e.clientY);schedule()}}
  function dblClick(e){if(!outlineMode||!stage()?.contains(e.target))return;if(model.outline.length>=3){e.preventDefault();e.stopPropagation();outlineMode=false;pointerWorld=null;save();schedule();notify(t('Edge.Cuts ditutup. Jalankan DRC.','Edge.Cuts closed. Run DRC.'))}}
  function keyDown(e){if(['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName))return;if(e.key==='Escape'){cancelRoute(false);outlineMode=false;pointerWorld=null;schedule()}if((e.key==='Delete'||e.key==='Backspace')&&selectedTrack){model.tracks=model.tracks.filter(x=>x.id!==selectedTrack);selectedTrack='';save();schedule()}if(e.key==='PageUp'){currentLayer='F.Cu';schedule()}if(e.key==='PageDown'){currentLayer='B.Cu';schedule()}}

  function segs(points){const out=[];for(let i=0;i<points.length-1;i++)out.push([points[i],points[i+1]]);return out}
  function orient(a,b,c){return Math.sign((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))}
  function intersect(a,b,c,d){const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);return o1!==o2&&o3!==o4}
  function pointInPoly(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];const hit=((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y+1e-9)+a.x);if(hit)inside=!inside}return inside}
  function drc(){const findings=[];if(model.outline.length<3)findings.push(t('Edge.Cuts belum berupa polygon tertutup.','Edge.Cuts is not a closed polygon.'));const unrouted=requiredEdges().filter(e=>!isEdgeRouted(e.a,e.b));if(unrouted.length)findings.push(`${unrouted.length} ${t('koneksi belum diroute','connection(s) remain unrouted')}: ${unrouted.map(e=>`${e.a}↔${e.b}`).join(', ')}`);
    const tracks=model.tracks.map(tr=>({tr,pts:trackPoints(tr)})).filter(x=>x.pts.length>1);for(let i=0;i<tracks.length;i++)for(let j=i+1;j<tracks.length;j++){const A=tracks[i],B=tracks[j];if(A.tr.layer!==B.tr.layer||A.tr.net===B.tr.net)continue;outer:for(const[a,b]of segs(A.pts))for(const[c,d]of segs(B.pts))if(intersect(a,b,c,d)){findings.push(`${t('Crossing copper antar net','Copper crossing between nets')} ${A.tr.net} / ${B.tr.net} (${A.tr.layer})`);break outer}}
    if(model.outline.length>=3){for(const fp of stage()?.querySelectorAll('.footprint')||[]){const r=fp.getBoundingClientRect();const p=clientToWorld(r.left+r.width/2,r.top+r.height/2);if(!pointInPoly(p,model.outline))findings.push(`${footprintInfo(fp).ref}: ${t('footprint berada di luar Edge.Cuts','footprint lies outside Edge.Cuts')}`)}}return findings}
  function showDrc(){const f=drc();let m=document.querySelector('#pcbpro-board-report');m?.remove();m=document.createElement('div');m.id='pcbpro-board-report';m.innerHTML=`<div class="pbr-card"><small>PCB GEOMETRY DRC · v${VERSION}</small><h3>${f.length?`${f.length} ${t('temuan','findings')}`:t('Lulus basic DRC','Basic DRC pass')}</h3>${f.length?`<ul>${f.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:`<p>${t('Connectivity routing, crossing antar-net satu layer, outline, dan posisi footprint lolos pemeriksaan dasar. Ini belum menggantikan manufacturing-grade clearance/drill DRC.','Routing connectivity, same-layer cross-net crossings, outline and footprint position pass the basic checks. This does not replace manufacturing-grade clearance/drill DRC.')}</p>`}<button>${t('Tutup','Close')}</button></div>`;document.body.appendChild(m);m.querySelector('button').onclick=()=>m.remove();m.onclick=(e)=>{if(e.target===m)m.remove()}}

  function updateHud(){const st=stage();if(!st){hud=null;return}if(!hud?.isConnected){hud=document.createElement('div');hud.id='pcbpro-board-hud';st.appendChild(hud);hud.addEventListener('click',(e)=>{const a=e.target.closest('button')?.dataset.a;if(a==='route'){outlineMode=false;window.PCBProCommand?.clickTool?.('route');schedule()}if(a==='outline'){outlineMode=!outlineMode;cancelRoute(false);schedule()}if(a==='clear-outline'){model.outline=[];save();schedule()}if(a==='drc')showDrc()})}const unrouted=requiredEdges().filter(e=>!isEdgeRouted(e.a,e.b)).length;hud.innerHTML=`<b>${currentLayer}</b><button data-a="route" class="${routeMode()?'active':''}">⌁ ${t('Route','Route')}</button><button data-a="outline" class="${outlineMode?'active':''}">▱ Edge.Cuts</button><button data-a="drc">DRC</button><button data-a="clear-outline">${t('Reset outline','Reset outline')}</button><span class="${unrouted?'bad':'good'}">${unrouted} unrouted · ${model.tracks.length} track</span>`}

  function routePins(from,to,options={}){
    if(!stage())return {ok:false,error:'PCB view is not mounted'};
    ensureLayers();syncPads();
    const a=String(from||''),b=String(to||'');
    if(!pinPoint(a)||!pinPoint(b))return {ok:false,error:`Pad endpoint unavailable: ${!pinPoint(a)?a:b}`};
    const net=sameNet(a,b);
    if(!net)return {ok:false,error:`${a} and ${b} are not on the same schematic net`};
    const existing=model.tracks.find(tr=>(tr.from===a&&tr.to===b)||(tr.from===b&&tr.to===a));
    if(existing)return {ok:true,track:structuredClone(existing),alreadyExisted:true};
    const layer=['F.Cu','B.Cu'].includes(options.layer)?options.layer:currentLayer;
    const corners=Array.isArray(options.corners)?options.corners.filter(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)).map(p=>({x:p.x,y:p.y})):[];
    const widthMm=Number.isFinite(Number(options.widthMm))?Number(options.widthMm):.25;
    const track={id:`T${Date.now()}_${Math.random().toString(36).slice(2,6)}`,net:net.name,from:a,to:b,layer,corners,widthMm};
    model.tracks.push(track);save();schedule();window.dispatchEvent(new CustomEvent('pcbpro:board-changed',{detail:{model:structuredClone(model),source:'typed-command',track:structuredClone(track)}}));
    return {ok:true,track:structuredClone(track),alreadyExisted:false};
  }
  function deleteTrack(id){
    const idx=model.tracks.findIndex(x=>x.id===id);if(idx<0)return false;
    const [removed]=model.tracks.splice(idx,1);save();schedule();window.dispatchEvent(new CustomEvent('pcbpro:board-changed',{detail:{model:structuredClone(model),source:'typed-command',removedTrack:structuredClone(removed)}}));return true;
  }
  function setActiveLayer(layer){
    if(!['F.Cu','B.Cu'].includes(layer))return {ok:false,error:'Layer must be F.Cu or B.Cu'};
    currentLayer=layer;schedule();return {ok:true,layer};
  }

  function mount(){if(!stage())return;ensureLayers();syncPads();updateHud();const fake=world()?.querySelector('svg.rats');if(fake)fake.style.display='none';const card=stage()?.querySelector('.floating-card');if(card)card.style.display='none';schedule()}
  function start(){load();installStyles();document.addEventListener('pointerdown',canvasDown,true);document.addEventListener('pointermove',pointerMove,{passive:true});document.addEventListener('dblclick',dblClick,true);document.addEventListener('keydown',keyDown,true);document.addEventListener('click',()=>setTimeout(mount,0),{passive:true});window.addEventListener('resize',schedule,{passive:true});window.addEventListener('pcbpro:netlist-changed',()=>{model.tracks=model.tracks.filter(tr=>sameNet(tr.from,tr.to));save();schedule()});setTimeout(mount,0)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

  window.PCBProBoardModel={version:VERSION,get tracks(){return structuredClone(model.tracks)},get outline(){return structuredClone(model.outline)},get zones(){return[]},get model(){return structuredClone(model)},get activeLayer(){return currentLayer},drc,showDrc,routePins,deleteTrack,setActiveLayer,clear(){model={version:VERSION,tracks:[],outline:[]};save();schedule()},refresh:mount};
})();
