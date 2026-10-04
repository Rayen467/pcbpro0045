(() => {
  'use strict';
  if (window.PCBProAutoRouter) return;

  const VERSION='1.23.0';
  let lastPlan=null;
  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  const t=(id,en)=>lang()==='id'?id:en;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const board=()=>window.PCBProBoardModel?.model||{tracks:[],pads:[],outline:[],worldSize:null};
  const nets=()=>window.PCBProWireEngine?.nets||[];
  const advanced=()=>window.PCBProAdvancedBoard?.model||{keepouts:[]};

  function pinList(net){return net.pinList||String(net.pins||'').split(/[·,;\s]+/).filter(Boolean)}
  function requiredEdges(){
    const out=[];
    for(const n of nets()){
      const pins=pinList(n);
      for(let i=0;i<pins.length-1;i++)out.push({net:n.name,from:pins[i],to:pins[i+1]});
    }
    return out;
  }
  function routed(edge,b){
    return (b.tracks||[]).some(tr=>(tr.from===edge.from&&tr.to===edge.to)||(tr.from===edge.to&&tr.to===edge.from));
  }
  function padMap(b){return new Map((b.pads||[]).map(p=>[p.id,{x:Number(p.x),y:Number(p.y),ref:p.ref}]))}
  function inside(p,poly){
    if(!poly?.length)return true;let hit=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[i],b=poly[j];
      const cross=((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y+1e-9)+a.x);
      if(cross)hit=!hit;
    } return hit;
  }
  function orient(a,b,c){const v=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);return Math.abs(v)<1e-9?0:(v>0?1:-1)}
  function onSeg(a,b,p){return Math.min(a.x,b.x)-1e-9<=p.x&&p.x<=Math.max(a.x,b.x)+1e-9&&Math.min(a.y,b.y)-1e-9<=p.y&&p.y<=Math.max(a.y,b.y)+1e-9}
  function intersects(a,b,c,d){
    const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);
    if(o1!==o2&&o3!==o4)return true;
    return (o1===0&&onSeg(a,b,c))||(o2===0&&onSeg(a,b,d))||(o3===0&&onSeg(c,d,a))||(o4===0&&onSeg(c,d,b));
  }
  function segments(points){const out=[];for(let i=0;i<points.length-1;i++)out.push([points[i],points[i+1]]);return out}
  function pathLength(points){let n=0;for(const [a,b] of segments(points))n+=Math.hypot(b.x-a.x,b.y-a.y);return n}
  function simplify(points){
    const out=[];
    for(const p of points){
      if(!out.length||Math.hypot(out.at(-1).x-p.x,out.at(-1).y-p.y)>.25)out.push({x:p.x,y:p.y});
    }
    return out;
  }
  function trackPoints(tr){return simplify([tr.start,...(tr.corners||[]),tr.end].filter(Boolean))}
  function clientToWorld(x,y){
    const w=document.querySelector('.stage.pcbstage .world');if(!w)return{x,y};
    const r=w.getBoundingClientRect(),sx=r.width/Math.max(1,w.offsetWidth),sy=r.height/Math.max(1,w.offsetHeight);
    return{x:(x-r.left)/Math.max(.0001,sx),y:(y-r.top)/Math.max(.0001,sy)};
  }
  function footprintRects(){
    const out=[];
    document.querySelectorAll('.stage.pcbstage .footprint').forEach(el=>{
      const r=el.getBoundingClientRect(),a=clientToWorld(r.left,r.top),b=clientToWorld(r.right,r.bottom);
      out.push({ref:el.querySelector('span')?.textContent?.trim()||'',minX:Math.min(a.x,b.x),maxX:Math.max(a.x,b.x),minY:Math.min(a.y,b.y),maxY:Math.max(a.y,b.y)});
    });
    return out;
  }
  function segRect(a,b,r){
    if((a.x>=r.minX&&a.x<=r.maxX&&a.y>=r.minY&&a.y<=r.maxY)||(b.x>=r.minX&&b.x<=r.maxX&&b.y>=r.minY&&b.y<=r.maxY))return true;
    const p1={x:r.minX,y:r.minY},p2={x:r.maxX,y:r.minY},p3={x:r.maxX,y:r.maxY},p4={x:r.minX,y:r.maxY};
    return intersects(a,b,p1,p2)||intersects(a,b,p2,p3)||intersects(a,b,p3,p4)||intersects(a,b,p4,p1);
  }

  function candidates(a,b,grid,strategy){
    const g=Math.max(8,Number(grid)||20),mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    const raw=[
      [a,{x:b.x,y:a.y},b],
      [a,{x:a.x,y:b.y},b],
      [a,{x:mx,y:a.y},{x:mx,y:b.y},b],
      [a,{x:a.x,y:my},{x:b.x,y:my},b]
    ];
    if(strategy!=='speed'){
      for(const d of [g*2,-g*2,g*4,-g*4]){
        raw.push([a,{x:mx+d,y:a.y},{x:mx+d,y:b.y},b]);
        raw.push([a,{x:a.x,y:my+d},{x:b.x,y:my+d},b]);
      }
    }
    return raw.map(simplify);
  }

  function scorePath(points,layer,edge,b,rects){
    let score=pathLength(points);
    const outline=b.outline||[];
    if(outline.length>=3){
      for(const p of points)if(!inside(p,outline))score+=1e7;
    }
    for(const [a,bp] of segments(points)){
      for(const tr of b.tracks||[]){
        if((tr.layer||'F.Cu')!==layer||tr.net===edge.net)continue;
        const tp=trackPoints(tr);
        for(const [c,d] of segments(tp))if(intersects(a,bp,c,d))score+=2e5;
      }
      for(const r of rects){
        if(r.ref===String(edge.from).split('.')[0]||r.ref===String(edge.to).split('.')[0])continue;
        if(segRect(a,bp,r))score+=5e4;
      }
      for(const k of advanced().keepouts||[]){
        const poly=k.points||[];
        if(poly.length>=3){
          const mid={x:(a.x+bp.x)/2,y:(a.y+bp.y)/2};
          if(inside(mid,poly))score+=3e5;
        }
      }
    }
    if(layer==='B.Cu')score+=25;
    return score;
  }

  function makePlan(options={}){
    const b=board(),pads=padMap(b),rects=footprintRects();
    const layers=Number(options.layers)===2?['F.Cu','B.Cu']:[window.PCBProBoardModel?.activeLayer||'F.Cu'];
    const scope=String(options.scope||'all'),ignoreGnd=options.ignoreGnd!==false,strategy=options.strategy==='speed'?'speed':'completion';
    const all=requiredEdges().filter(e=>!routed(e,b)).filter(e=>!(ignoreGnd&&/^(gnd|0)$/i.test(e.net||'')));
    const wanted=scope==='net'&&options.net?all.filter(e=>e.net===options.net):all;
    const routes=[],failed=[];
    for(const edge of wanted){
      const a=pads.get(edge.from),z=pads.get(edge.to);
      if(!a||!z){failed.push({...edge,reason:'PAD_ENDPOINT_MISSING'});continue}
      let best=null;
      for(const layer of layers){
        for(const pts of candidates(a,z,options.grid||20,strategy)){
          const score=scorePath(pts,layer,edge,b,rects);
          if(!best||score<best.score)best={edge,layer,points:pts,score};
        }
      }
      if(!best||best.score>=1e7){failed.push({...edge,reason:'NO_VALID_PATH'});continue}
      routes.push({
        net:edge.net,from:edge.from,to:edge.to,layer:best.layer,
        corners:best.points.slice(1,-1),widthMm:Number(options.widthMm)||0.25,
        score:Math.round(best.score*100)/100
      });
      b.tracks=[...(b.tracks||[]),{...routes.at(-1),start:a,end:z,id:'PREVIEW_'+routes.length}];
    }
    lastPlan={
      version:VERSION,createdAt:new Date().toISOString(),options:{layers:layers.length,scope,net:options.net||null,ignoreGnd,strategy,widthMm:Number(options.widthMm)||0.25},
      total:wanted.length,routes,failed,
      warnings:[
        ...(layers.length===2?[t('Mode 2-layer memilih satu layer per koneksi. Mid-route via/layer switching belum dipakai sampai pad-stack + inner-layer model tervalidasi.','2-layer mode assigns one layer per connection. Mid-route via/layer switching is not used until pad-stack and inner-layer models are validated.')]:[]),
        ...(b.outline?.length<3?[t('Edge.Cuts belum tersedia; routing preview memakai workspace geometry dan harus direview setelah outline dibuat.','Edge.Cuts is missing; routing preview uses workspace geometry and must be reviewed after an outline is created.')]:[])
      ]
    };
    return structuredClone(lastPlan);
  }

  async function apply(plan=lastPlan){
    if(!plan?.routes?.length)return{ok:false,error:'No autoroute preview to apply'};
    const results=[];for(const r of plan.routes){
      const x=window.PCBProBoardModel?.routePins?.(r.from,r.to,{layer:r.layer,corners:r.corners,widthMm:r.widthMm});
      results.push({route:r,ok:!!x?.ok,error:x?.error||null});
    }
    window.PCBProBoardModel?.refresh?.();
    const failed=results.filter(x=>!x.ok);
    const physical=window.PCBProPhysicalDRC?.run?.()||null;
    const out={ok:failed.length===0,total:results.length,applied:results.length-failed.length,failed:failed.length,results,physicalDrc:physical};
    window.dispatchEvent(new CustomEvent('pcbpro:autoroute-applied',{detail:out}));
    return out;
  }

  function installStyles(){
    if(document.querySelector('#pcbpro-autorouter-style'))return;
    const s=document.createElement('style');s.id='pcbpro-autorouter-style';s.textContent=`
      #pcbpro-autoroute-btn{border-color:#8a6a2e!important;color:#f0d179!important;background:#2b2212!important}
      #pcbpro-autorouter-modal{position:fixed;z-index:3050;inset:0;background:#000c;display:grid;place-items:center;padding:14px}.ar-shell{width:min(880px,96vw);max-height:90vh;overflow:auto;border:1px solid #38515d;background:#07141c;color:#dce8ed;border-radius:14px;padding:14px;box-shadow:0 25px 100px #000e}.ar-head{display:flex;align-items:start;gap:8px}.ar-head div{flex:1}.ar-head small{font:900 8px ui-monospace;color:#e0b65e}.ar-head h3{margin:4px 0}.ar-head button,.ar-actions button{border:1px solid #34515e;background:#10222c;color:#d2dfe4;border-radius:7px;padding:8px 10px;font-weight:800}.ar-grid{display:grid;grid-template-columns:repeat(3,minmax(130px,1fr));gap:8px;margin:12px 0}.ar-grid label{display:grid;gap:5px;color:#88a0aa;font-size:8px}.ar-grid input,.ar-grid select{border:1px solid #2d4854;background:#08151d;color:#dce8ed;border-radius:7px;padding:8px}.ar-actions{display:flex;gap:7px;flex-wrap:wrap}.ar-actions .primary{border-color:#2c806d;background:#165f52}.ar-report{margin-top:12px;border:1px solid #263f4a;background:#0a1820;border-radius:9px;padding:10px}.ar-report b{color:#65d7be}.ar-report p,.ar-report li{font-size:9px;color:#9fb2bb;line-height:1.5}.ar-warn{color:#e1bf6c!important}
      @media(max-width:700px){.ar-grid{grid-template-columns:1fr 1fr}}
    `;document.head.appendChild(s)
  }

  function reportHtml(p){
    if(!p)return'<p>'+t('Belum ada preview. Pilih parameter lalu Preview.','No preview yet. Choose parameters then Preview.')+'</p>';
    return '<b>'+p.routes.length+'/'+p.total+' '+t('koneksi punya kandidat route','connections have route candidates')+'</b><p>'+p.failed.length+' '+t('gagal direncanakan','failed to plan')+'.</p>'+
      (p.warnings||[]).map(x=>'<p class="ar-warn">⚠ '+esc(x)+'</p>').join('')+
      '<ul>'+p.routes.slice(0,30).map(r=>'<li>'+esc(r.net)+' · '+esc(r.from)+' → '+esc(r.to)+' · '+esc(r.layer)+' · score '+r.score+'</li>').join('')+'</ul>';
  }

  function open(){
    if(!document.querySelector('.stage.pcbstage')){window.PCBProCommand?.clickView?.('pcb');return setTimeout(open,80)}
    installStyles();document.querySelector('#pcbpro-autorouter-modal')?.remove();
    const netNames=[...new Set(nets().map(n=>n.name).filter(Boolean))];
    const m=document.createElement('div');m.id='pcbpro-autorouter-modal';
    m.innerHTML='<section class="ar-shell"><header class="ar-head"><div><small>PCB PRO · AUTO ROUTER v'+VERSION+'</small><h3>'+t('Auto Route dengan preview','Auto Route with preview')+'</h3><p>'+t('Router membuat kandidat 90° dari netlist aktual, menghindari crossing/footprint/keepout secara cost-based, lalu baru mengubah board setelah Apply.','The router builds 90° candidates from the actual netlist, cost-avoids crossings/footprints/keepouts, and only changes the board after Apply.')+'</p></div><button data-close>×</button></header><div class="ar-grid"><label>'+t('Scope','Scope')+'<select data-scope><option value="all">'+t('Semua unrouted net','All unrouted nets')+'</option><option value="net">'+t('Satu net','One net')+'</option></select></label><label>Net<select data-net>'+netNames.map(n=>'<option>'+esc(n)+'</option>').join('')+'</select></label><label>'+t('Copper layer','Copper layers')+'<select data-layers><option value="1">1 · '+esc(window.PCBProBoardModel?.activeLayer||'F.Cu')+'</option><option value="2">2 · F.Cu + B.Cu</option></select></label><label>'+t('Strategi','Strategy')+'<select data-strategy><option value="completion">'+t('Completion','Completion')+'</option><option value="speed">'+t('Cepat','Speed')+'</option></select></label><label>'+t('Grid detour','Detour grid')+'<input data-grid type="number" min="8" step="2" value="20"></label><label>'+t('Track width mm','Track width mm')+'<input data-width type="number" min="0.05" step="0.05" value="0.25"></label><label><span>'+t('GND','GND')+'</span><select data-gnd><option value="ignore">'+t('Abaikan; pakai zone nanti','Ignore; use zone later')+'</option><option value="route">'+t('Route juga','Route too')+'</option></select></label></div><div class="ar-actions"><button data-preview>'+t('Preview route','Preview routes')+'</button><button class="primary" data-apply disabled>'+t('Apply preview','Apply preview')+'</button><button data-drc>DRC</button></div><div class="ar-report"></div></section>';
    document.body.appendChild(m);const report=m.querySelector('.ar-report'),applyBtn=m.querySelector('[data-apply]');
    const opts=()=>({scope:m.querySelector('[data-scope]').value,net:m.querySelector('[data-net]').value,layers:Number(m.querySelector('[data-layers]').value),strategy:m.querySelector('[data-strategy]').value,grid:Number(m.querySelector('[data-grid]').value),widthMm:Number(m.querySelector('[data-width]').value),ignoreGnd:m.querySelector('[data-gnd]').value==='ignore'});
    m.querySelector('[data-preview]').onclick=()=>{const p=makePlan(opts());report.innerHTML=reportHtml(p);applyBtn.disabled=!p.routes.length};
    applyBtn.onclick=async()=>{applyBtn.disabled=true;const out=await apply(lastPlan);report.insertAdjacentHTML('afterbegin','<p><b>'+t('Applied','Applied')+': '+out.applied+'/'+out.total+'</b></p>');};
    m.querySelector('[data-drc]').onclick=()=>window.PCBProPhysicalDRC?.show?.();
    m.querySelector('[data-close]').onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove()};
    report.innerHTML=reportHtml(lastPlan);
  }

  function mountButton(){
    installStyles();
    const main=[...document.querySelectorAll('.tools button')].find(b=>/auto\s*route/i.test(b.dataset.pcbTool||b.querySelector('small')?.textContent||b.textContent||''));
    if(main){main.classList.remove('pcb-tool-unavailable');main.removeAttribute('disabled');return}
    const host=window.PCBProPcbDock?.slot?.('routing');if(!host||document.querySelector('#pcbpro-autoroute-btn'))return;
    const b=document.createElement('button');b.id='pcbpro-autoroute-btn';b.type='button';b.textContent='⚡ Auto Route';b.onclick=open;host.prepend(b);
  }

  function start(){
    installStyles();mountButton();document.addEventListener('click',()=>setTimeout(mountButton,0),{passive:true});
    window.addEventListener('pcbpro:netlist-changed',()=>{lastPlan=null});
    window.addEventListener('pcbpro:board-changed',e=>{if(e.detail?.source!=='typed-command')lastPlan=null});
  }

  window.PCBProAutoRouter={version:VERSION,open,plan:makePlan,apply,get lastPlan(){return lastPlan?structuredClone(lastPlan):null},capabilities:{layers:2,midRouteViaSwitching:false,preview:true,strategies:['speed','completion']}};
  window.PCBProExplain?.register?.({
    id:'feature.autorouter-v123',match:['auto route','auto router','autoroute'],category:'pcb-routing',status:'draft-router',
    title:{id:'Auto Route',en:'Auto Route'},
    what:{id:'Router otomatis berbasis netlist yang membuat preview jalur orthogonal dan memilih F.Cu/B.Cu berdasarkan cost crossing/obstacle.',en:'Netlist-driven autorouter that previews orthogonal routes and chooses F.Cu/B.Cu using crossing/obstacle cost.'},
    why:{id:'Mempercepat koneksi unrouted tanpa langsung merusak board karena hasil harus dipreview sebelum Apply.',en:'Speeds up unrouted connectivity without immediately mutating the board because routes must be previewed before Apply.'},
    input:{id:'Netlist, pad positions, existing tracks, footprint boxes, keepout, layer count, width, grid dan strategy.',en:'Netlist, pad positions, existing tracks, footprint boxes, keepouts, layer count, width, grid, and strategy.'},
    process:{id:'Mencoba beberapa kandidat 90°, memberi penalti crossing/obstacle/outside-outline, memilih biaya terendah per koneksi.',en:'Tries several 90° candidates, penalizes crossings/obstacles/outside-outline, and selects the lowest-cost connection path.'},
    output:{id:'Preview route plan lalu copper tracks setelah Apply.',en:'A route-plan preview, then copper tracks after Apply.'},
    how_to_read:{id:'Completion rate adalah jumlah koneksi yang mendapat kandidat route, bukan bukti DRC/manufacturing pass.',en:'Completion rate is the number of connections with route candidates, not proof of DRC/manufacturing pass.'},
    limits:{id:'Saat ini maksimum 2 copper layer dan satu layer dipilih per koneksi. Mid-route via switching/inner layers menunggu verified pad-stack + multilayer model.',en:'Currently limited to 2 copper layers with one layer per connection. Mid-route via switching/inner layers wait for verified pad-stack and multilayer models.'},
    next:{id:'Preview → Apply → Physical DRC → manual cleanup/tuning → manufacturing preflight.',en:'Preview → Apply → Physical DRC → manual cleanup/tuning → manufacturing preflight.'}
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();