(() => {
  'use strict';
  if (window.PCBProProfessional) return;

  const VERSION='1.18.0';
  const SUPABASE_URL='https://zomawqbdhktfdnyghxut.supabase.co';
  const ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvbWF3cWJkaGt0ZmRueWdoeHV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5MTM2MTIsImV4cCI6MjEwNjQ4OTYxMn0.s55ppUfDs1TawNAWm2L3aTBf6JzptkZ9rTEYsMwrg7o';
  const KEY='pcbpro0045-professional-v118';
  const C=299792458;

  const DEFAULT_STATE={
    profile:'jlc-conservative',
    trackWidthMm:0.15,
    clearanceMm:0.15,
    viaDiameterMm:0.45,
    viaDrillMm:0.20,
    edgeClearanceMm:0.25,
    targetImpedanceOhm:50,
    diffTargetOhm:90,
    diffGapMm:0.15,
    maxSkewPs:5,
    dielectricEr:4.2,
    dielectricHeightMm:0.20,
    copperThicknessMm:0.035
  };

  const PROFILES={
    'safe-prototype':{
      label:'Safe Prototype',
      trackWidthMm:0.20,clearanceMm:0.20,viaDiameterMm:0.60,viaDrillMm:0.30,edgeClearanceMm:0.30,
      note:'Conservative generic prototype profile. Not tied to one fabricator.'
    },
    'jlc-conservative':{
      label:'JLCPCB Conservative 1 oz',
      trackWidthMm:0.15,clearanceMm:0.15,viaDiameterMm:0.45,viaDrillMm:0.20,edgeClearanceMm:0.25,
      note:'Conservative working profile chosen above JLCPCB published minimums. Verify order-specific stackup and capabilities before release.'
    },
    'jlc-capability-edge':{
      label:'JLCPCB Capability Edge 1 oz',
      trackWidthMm:0.10,clearanceMm:0.10,viaDiameterMm:0.25,viaDrillMm:0.15,edgeClearanceMm:0.20,
      note:'Published capability-edge profile. Extreme geometry can increase cost/risk and is not a default recommendation.'
    }
  };

  let state={...DEFAULT_STATE};
  let research=[];
  let patents=[];
  let referenceTools=[];
  let activeTab='audit';
  let evidenceReady=false;

  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  const t=(id,en)=>lang()==='id'?id:en;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const n=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
  const load=()=>{try{state={...DEFAULT_STATE,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{state={...DEFAULT_STATE}}};
  const save=()=>{localStorage.setItem(KEY,JSON.stringify(state));window.dispatchEvent(new CustomEvent('pcbpro:professional-rules-changed',{detail:{...state}}));window.PCBProDatabase?.scheduleSave?.(400)};

  async function publicApi(path){
    const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:{apikey:ANON_KEY,Authorization:`Bearer ${ANON_KEY}`}});
    if(!r.ok)throw new Error(`Evidence DB HTTP ${r.status}`);
    return r.json();
  }

  async function loadEvidence(){
    try{
      const [r,p,tools]=await Promise.all([
        publicApi('eda_research_evidence?select=id,doi,title,year,venue,publisher,evidence_type,peer_reviewed,source_url,tags,implementation_relevance,verification_status&order=year.desc'),
        publicApi('eda_patent_evidence?select=id,patent_number,jurisdiction,title,publication_date,legal_status,assignee,source_url,tags,implementation_note,use_mode&order=publication_date.desc'),
        publicApi('eda_reference_tools?select=id,name,origin_country,vendor,official_url,verified_at,capabilities,implementation_scope,notes&order=name.asc')
      ]);
      research=Array.isArray(r)?r:[];
      patents=Array.isArray(p)?p:[];
      referenceTools=Array.isArray(tools)?tools:[];
      evidenceReady=true;
      window.dispatchEvent(new CustomEvent('pcbpro:professional-evidence-ready',{detail:{research:research.length,patents:patents.length,tools:referenceTools.length}}));
      render();
    }catch(error){
      console.warn('[PCB Pro Professional] evidence load',error);
      evidenceReady=false;
      render();
    }
  }

  function projectComponents(){return window.PCBProProject?.getComponents?.()||[]}
  function boardModel(){return window.PCBProBoardModel?.model||{tracks:[],outline:[]}}
  function advanced(){return window.PCBProAdvancedBoard?.model||{vias:[],zones:[],keepouts:[],diffPairs:[],stack:[]}}

  function status(kind,title,detail){
    return {kind,title,detail};
  }

  function audit(){
    const comps=projectComponents();
    const board=boardModel();
    const adv=advanced();
    const tracks=Array.isArray(board.tracks)?board.tracks:[];
    const vias=Array.isArray(adv.vias)?adv.vias:[];
    const outline=Array.isArray(board.outline)?board.outline:[];
    const findings=[
      ...(window.PCBProBoardModel?.drc?.()||[]),
      ...(window.PCBProAdvancedBoard?.drc?.()||[])
    ];
    const checks=[];

    checks.push(comps.length
      ?status('pass',t('Komponen project','Project components'),`${comps.length} ${t('komponen terbaca dari project state.','components read from project state.')}`)
      :status('warn',t('Project kosong','Empty project'),t('Belum ada komponen untuk diaudit.','No components to audit yet.')));

    const missingFp=comps.filter(c=>!c.footprint||c.footprint==='—').length;
    checks.push(missingFp===0
      ?status('pass',t('Footprint coverage','Footprint coverage'),t('Semua komponen punya footprint field. Tetap verifikasi exact package.','All components have a footprint field. Exact packages still require verification.'))
      :status('warn',t('Footprint belum lengkap','Incomplete footprints'),`${missingFp} ${t('komponen belum punya footprint.','components have no footprint.')}`));

    const unresolved=comps.filter(c=>!c.mpn||c.kind==='template').length;
    checks.push(unresolved===0
      ?status('pass',t('Exact part identity','Exact part identity'),t('Semua komponen punya MPN/non-template identity.','All components have an MPN/non-template identity.'))
      :status('warn',t('Generic / unresolved parts','Generic / unresolved parts'),`${unresolved} ${t('komponen masih generic/template atau tanpa exact MPN.','components remain generic/template or lack exact MPN.')}`));

    checks.push(outline.length>=3
      ?status('pass','Edge.Cuts',`${outline.length} ${t('titik outline tersimpan.','outline points stored.')}`)
      :status('warn','Edge.Cuts',t('Board outline belum valid/tertutup.','Board outline is not yet valid/closed.')));

    const tooThin=tracks.filter(tr=>n(tr.widthMm,.25)<state.trackWidthMm);
    checks.push(tooThin.length===0
      ?status('pass',t('Track width profile','Track width profile'),`${tracks.length} ${t('track berada di atas/equal rule width yang tersimpan.','tracks are at or above the stored width rule.')}`)
      :status('bad',t('Track terlalu tipis','Tracks below profile'),`${tooThin.length} track < ${state.trackWidthMm} mm`));

    const badVias=vias.filter(v=>n(v.diameterMm,state.viaDiameterMm)<state.viaDiameterMm||n(v.drillMm,state.viaDrillMm)<state.viaDrillMm);
    checks.push(badVias.length===0
      ?status('pass',t('Via size profile','Via size profile'),`${vias.length} via ${t('tidak melanggar diameter/drill profile yang bisa dibaca.','do not violate readable diameter/drill profile values.')}`)
      :status('bad',t('Via di bawah profile','Vias below profile'),`${badVias.length} via < Ø${state.viaDiameterMm}/drill ${state.viaDrillMm} mm`));

    checks.push(findings.length===0
      ?status('pass',t('DRC coverage tersedia','Available DRC coverage'),t('Tidak ada finding pada rule engine yang saat ini tersedia. Ini bukan full fab sign-off.','No findings in the currently available rule engines. This is not full fab sign-off.'))
      :status('bad',t('DRC findings','DRC findings'),`${findings.length} finding`));

    checks.push(status('unknown',t('Copper spacing / edge clearance','Copper spacing / edge clearance'),t('Belum ada distance-field/clearance solver lengkap. Nilai profile disimpan, tetapi status tidak boleh dianggap PASS sampai geometry clearance engine tersedia.','A complete distance-field/clearance solver is not available yet. The profile value is stored, but this must not be called PASS until a geometry clearance engine exists.')));

    checks.push(status('unknown',t('SI/PI sign-off','SI/PI sign-off'),t('Impedance/delay calculator di Professional Center adalah screening calculator. Sign-off membutuhkan stackup fab final dan solver/measurement yang sesuai.','The Professional Center impedance/delay calculator is a screening calculator. Sign-off requires the final fab stackup and an appropriate solver/measurement.')));

    return {
      checks,
      stats:{
        components:comps.length,tracks:tracks.length,vias:vias.length,zones:adv.zones?.length||0,
        keepouts:adv.keepouts?.length||0,diffPairs:adv.diffPairs?.length||0,layers:adv.stack?.length||0,
        findings:findings.length
      }
    };
  }

  function microstripZ0(widthMm=state.trackWidthMm,heightMm=state.dielectricHeightMm,er=state.dielectricEr){
    const w=Math.max(0.001,n(widthMm,.15));
    const h=Math.max(0.001,n(heightMm,.2));
    const e=Math.max(1.01,n(er,4.2));
    const u=w/h;
    const ee=(e+1)/2+(e-1)/2*(1/Math.sqrt(1+12/u)+(u<1?0.04*(1-u)*(1-u):0));
    let z;
    if(u<=1) z=(60/Math.sqrt(ee))*Math.log(8/u+0.25*u);
    else z=(120*Math.PI)/(Math.sqrt(ee)*(u+1.393+0.667*Math.log(u+1.444)));
    return {z,ee,u};
  }

  function diffZ0(widthMm,heightMm,er,gapMm){
    const se=microstripZ0(widthMm,heightMm,er);
    const s=Math.max(0.001,n(gapMm,.15));
    const h=Math.max(0.001,n(heightMm,.2));
    const coupling=0.48*Math.exp(-0.96*(s/h));
    return {z:2*se.z*(1-coupling),single:se.z,ee:se.ee};
  }

  function solveWidth(target,height,er,diff=false,gap=state.diffGapMm){
    let lo=0.01,hi=5;
    for(let i=0;i<70;i++){
      const mid=(lo+hi)/2;
      const z=diff?diffZ0(mid,height,er,gap).z:microstripZ0(mid,height,er).z;
      if(z>target)lo=mid;else hi=mid;
    }
    return (lo+hi)/2;
  }

  function delayPsPerMm(erEff){
    return (1e9/C)*Math.sqrt(Math.max(1,n(erEff,3.2))); // seconds/m -> ps/mm numerically *1e9
  }

  function applyProfile(name){
    const p=PROFILES[name];if(!p)return;
    state={...state,profile:name,trackWidthMm:p.trackWidthMm,clearanceMm:p.clearanceMm,viaDiameterMm:p.viaDiameterMm,viaDrillMm:p.viaDrillMm,edgeClearanceMm:p.edgeClearanceMm};
    save();render();
  }

  function installStyles(){
    if(document.querySelector('#pcbpro-professional-style'))return;
    const s=document.createElement('style');s.id='pcbpro-professional-style';s.textContent=`
      #pcbpro-pro-trigger{border:1px solid #6c5430;background:#201a0f;color:#efd184;border-radius:8px;padding:7px 10px;font-size:9px;font-weight:950;letter-spacing:.04em;white-space:nowrap}
      #pcbpro-pro-trigger:hover{background:#332814;border-color:#c89d48}
      #pcbpro-pro-modal{position:fixed;z-index:2850;inset:0;background:#000c;display:grid;place-items:center;padding:14px}
      .pp-card{width:min(1120px,97vw);height:min(790px,94vh);background:#07131b;border:1px solid #35515f;border-radius:14px;display:grid;grid-template-rows:auto auto 1fr;overflow:hidden;box-shadow:0 30px 120px #000e;color:#dce9ee}
      .pp-head{display:flex;gap:10px;align-items:center;padding:11px 13px;border-bottom:1px solid #213944;background:#0a1821}.pp-head div{flex:1}.pp-head small{display:block;color:#d9b45b;font:900 8px ui-monospace}.pp-head b{font-size:15px}.pp-head button,.pp-tabs button,.pp-btn{border:1px solid #304b58;background:#10212b;color:#c2d3db;border-radius:8px;padding:7px 9px;font-size:8px;font-weight:900}.pp-tabs{display:flex;gap:5px;padding:8px 10px;border-bottom:1px solid #203842;overflow:auto}.pp-tabs button.active{border-color:#d2ac52;background:#382c12;color:#ffe398}
      .pp-body{overflow:auto;padding:12px}.pp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.pp-statgrid{display:grid;grid-template-columns:repeat(7,minmax(90px,1fr));gap:6px;margin-bottom:10px}.pp-stat{border:1px solid #223c48;background:#0b1a22;border-radius:9px;padding:9px}.pp-stat small{display:block;font:800 7px ui-monospace;color:#748f9c}.pp-stat b{font-size:18px}.pp-row{border:1px solid #223b47;background:#0a1820;border-radius:9px;padding:10px;margin-bottom:7px}.pp-row.pass{border-left:3px solid #43b99f}.pp-row.warn{border-left:3px solid #d6ad54}.pp-row.bad{border-left:3px solid #d56e60}.pp-row.unknown{border-left:3px solid #718391}.pp-row b{font-size:10px}.pp-row p{margin:5px 0 0;font-size:9px;line-height:1.55;color:#9cb1ba}
      .pp-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.pp-form label{display:grid;gap:4px;font-size:8px;color:#88a0aa}.pp-form input,.pp-form select{border:1px solid #2d4754;background:#08141b;color:#d6e4e9;border-radius:7px;padding:8px;font-size:9px}.pp-actions{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.pp-note{border:1px solid #6a5530;background:#261f11;border-radius:9px;padding:9px;font-size:9px;line-height:1.55;color:#d9c58e}
      .pp-table{width:100%;border-collapse:collapse;font-size:8px}.pp-table th,.pp-table td{padding:7px;border-bottom:1px solid #1c333d;text-align:left;vertical-align:top}.pp-table th{color:#819aa5;position:sticky;top:0;background:#07131b}.pp-table a{color:#69d2bd}.pp-tags{display:flex;gap:3px;flex-wrap:wrap}.pp-tag{font:800 6px ui-monospace;border:1px solid #294654;border-radius:999px;padding:2px 5px;color:#8fb0bc}.pp-kpi{font-size:24px;color:#f1d27e}.pp-split{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pp-source{font-size:8px;color:#718a96}.pp-red{color:#ef9780}.pp-green{color:#64d3b8}.pp-roadmap{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.pp-roadmap .pp-row{margin:0}
      @media(max-width:820px){.pp-card{width:100%;height:100%;border-radius:0}.pp-grid,.pp-split,.pp-form,.pp-roadmap{grid-template-columns:1fr}.pp-statgrid{grid-template-columns:repeat(2,1fr)}}
    `;document.head.appendChild(s)
  }

  function mountTrigger(){
    installStyles();
    const actions=document.querySelector('.top-actions');if(!actions)return;
    if(document.querySelector('#pcbpro-pro-trigger'))return;
    const b=document.createElement('button');b.id='pcbpro-pro-trigger';b.type='button';b.textContent='PRO';b.title=t('Professional Engineering Center','Professional Engineering Center');b.addEventListener('click',()=>open('audit'));
    const explain=document.querySelector('#pcbpro-explain-trigger');if(explain)actions.insertBefore(b,explain);else actions.appendChild(b);
  }

  function tabs(){
    const list=[
      ['audit',t('Audit','Audit')],
      ['constraints',t('Rules & DFM','Rules & DFM')],
      ['impedance',t('SI / Timing','SI / Timing')],
      ['evidence',t('Jurnal 5 Tahun','5-Year Evidence')],
      ['patents',t('Patent Watch','Patent Watch')],
      ['reference',t('Tools China','China Tool Baseline')],
      ['roadmap',t('Upgrade Map','Upgrade Map')]
    ];
    return list.map(([id,label])=>`<button data-tab="${id}" class="${activeTab===id?'active':''}">${esc(label)}</button>`).join('');
  }

  function statGrid(stats){
    return `<div class="pp-statgrid">
      ${Object.entries(stats).map(([k,v])=>`<div class="pp-stat"><small>${esc(k.toUpperCase())}</small><b>${esc(v)}</b></div>`).join('')}
    </div>`;
  }

  function auditHtml(){
    const a=audit();
    return `${statGrid(a.stats)}
      <div class="pp-note"><b>${t('Professional gate','Professional gate')}:</b> ${t('PASS hanya berarti check yang benar-benar diimplementasikan lulus. UNKNOWN tidak dihitung PASS. Release profesional tetap perlu exact-part verification, full geometry DRC/DFM, SI/PI/thermal fidelity yang sesuai risiko, dan CAM/manufacturing review.','PASS only means the checks that actually exist have passed. UNKNOWN is not counted as PASS. Professional release still requires exact-part verification, full geometry DRC/DFM, risk-appropriate SI/PI/thermal fidelity, and CAM/manufacturing review.')}</div>
      <div style="margin-top:10px">${a.checks.map(x=>`<div class="pp-row ${x.kind}"><b>${esc(x.title)}</b><p>${esc(x.detail)}</p></div>`).join('')}</div>`;
  }

  function constraintsHtml(){
    const p=PROFILES[state.profile]||PROFILES['jlc-conservative'];
    return `<div class="pp-grid">
      <section class="pp-row"><b>${t('Process / DFM profile','Process / DFM profile')}</b><p>${esc(p.note)}</p>
        <div class="pp-form" style="margin-top:8px"><label>Profile<select data-prof-profile>${Object.entries(PROFILES).map(([id,x])=>`<option value="${id}" ${state.profile===id?'selected':''}>${esc(x.label)}</option>`).join('')}</select></label></div>
      </section>
      <section class="pp-row"><b>${t('Source snapshot','Source snapshot')}</b><p>JLCPCB capability snapshot · 2026-10-02. ${t('Published 1 oz minimum width/spacing: 0.10/0.10 mm; multilayer 0.09/0.09 mm; min via hole/diameter 0.15/0.25 mm; routed-edge copper clearance 0.20 mm. Profile konservatif sengaja lebih longgar.','Published 1 oz minimum width/spacing: 0.10/0.10 mm; multilayer 0.09/0.09 mm; min via hole/diameter 0.15/0.25 mm; routed-edge copper clearance 0.20 mm. The conservative profile intentionally stays above those limits.')}</p></section>
    </div>
    <div class="pp-form" style="margin-top:10px">
      <label>Track width min (mm)<input data-k="trackWidthMm" type="number" step="0.01" value="${state.trackWidthMm}"></label>
      <label>Clearance min (mm)<input data-k="clearanceMm" type="number" step="0.01" value="${state.clearanceMm}"></label>
      <label>Edge clearance (mm)<input data-k="edgeClearanceMm" type="number" step="0.01" value="${state.edgeClearanceMm}"></label>
      <label>Via diameter (mm)<input data-k="viaDiameterMm" type="number" step="0.01" value="${state.viaDiameterMm}"></label>
      <label>Via drill (mm)<input data-k="viaDrillMm" type="number" step="0.01" value="${state.viaDrillMm}"></label>
      <label>Max skew (ps)<input data-k="maxSkewPs" type="number" step="0.1" value="${state.maxSkewPs}"></label>
      <label>Target Z0 (Ω)<input data-k="targetImpedanceOhm" type="number" step="1" value="${state.targetImpedanceOhm}"></label>
      <label>Diff target (Ω)<input data-k="diffTargetOhm" type="number" step="1" value="${state.diffTargetOhm}"></label>
      <label>Diff gap (mm)<input data-k="diffGapMm" type="number" step="0.01" value="${state.diffGapMm}"></label>
    </div>
    <div class="pp-actions"><button class="pp-btn" data-save-rules>${t('Simpan rules','Save rules')}</button><button class="pp-btn" data-run-audit>${t('Run audit','Run audit')}</button></div>
    <div class="pp-note">${t('Saat ini width/via/outline bisa dicek dari geometry yang tersedia. Clearance matrix lengkap, annular-ring solver, soldermask/sliver, drill-to-copper, plane split, acid-trap, teardrop legality, dan order-specific stackup belum boleh dianggap terverifikasi sampai engine-nya ada.','Width/via/outline can currently be checked from available geometry. Full clearance matrices, annular-ring solver, soldermask/sliver, drill-to-copper, plane splits, acid-trap, teardrop legality, and order-specific stackup are not verified until those engines exist.')}</div>`;
  }

  function impedanceHtml(){
    const se=microstripZ0(state.trackWidthMm,state.dielectricHeightMm,state.dielectricEr);
    const diff=diffZ0(state.trackWidthMm,state.dielectricHeightMm,state.dielectricEr,state.diffGapMm);
    const seWidth=solveWidth(state.targetImpedanceOhm,state.dielectricHeightMm,state.dielectricEr,false);
    const diffWidth=solveWidth(state.diffTargetOhm,state.dielectricHeightMm,state.dielectricEr,true,state.diffGapMm);
    const delay=delayPsPerMm(se.ee);
    return `<div class="pp-split">
      <section class="pp-row"><b>${t('Stackup screening input','Stackup screening input')}</b>
        <div class="pp-form" style="grid-template-columns:1fr 1fr;margin-top:8px">
          <label>εr<input data-si="dielectricEr" type="number" step="0.01" value="${state.dielectricEr}"></label>
          <label>Dielectric height h (mm)<input data-si="dielectricHeightMm" type="number" step="0.01" value="${state.dielectricHeightMm}"></label>
          <label>Copper thickness (mm)<input data-si="copperThicknessMm" type="number" step="0.001" value="${state.copperThicknessMm}"></label>
          <label>Trace width w (mm)<input data-si="trackWidthMm" type="number" step="0.01" value="${state.trackWidthMm}"></label>
          <label>Diff gap s (mm)<input data-si="diffGapMm" type="number" step="0.01" value="${state.diffGapMm}"></label>
          <label>Target Z0 (Ω)<input data-si="targetImpedanceOhm" type="number" step="1" value="${state.targetImpedanceOhm}"></label>
          <label>Target Zdiff (Ω)<input data-si="diffTargetOhm" type="number" step="1" value="${state.diffTargetOhm}"></label>
        </div>
        <div class="pp-actions"><button class="pp-btn" data-si-calc>${t('Hitung ulang','Recalculate')}</button></div>
      </section>
      <section class="pp-row"><b>${t('Screening result','Screening result')}</b>
        <p><span class="pp-kpi">${se.z.toFixed(1)} Ω</span> · ${t('single-ended estimate','single-ended estimate')}</p>
        <p><span class="pp-kpi">${diff.z.toFixed(1)} Ω</span> · ${t('differential rough estimate','differential rough estimate')}</p>
        <p>εeff ≈ ${se.ee.toFixed(3)} · delay ≈ ${delay.toFixed(2)} ps/mm</p>
        <p>${t('Lebar screening untuk target','Screening width for target')} ${state.targetImpedanceOhm} Ω ≈ ${seWidth.toFixed(3)} mm</p>
        <p>${t('Lebar screening untuk target differential','Screening width for differential target')} ${state.diffTargetOhm} Ω ≈ ${diffWidth.toFixed(3)} mm @ gap ${state.diffGapMm} mm</p>
      </section>
    </div>
    <div class="pp-note"><b>${t('Bukan sign-off impedance.','Not impedance sign-off.')}</b> ${t('Rumus browser ini hanya screening microstrip/differential approximation. Copper thickness, soldermask, trapezoidal etch, roughness, exact dielectric construction, via transition dan fabrication tolerance belum dimodelkan penuh. Final width/spacing harus dibandingkan dengan stackup + calculator/field solver pabrik yang dipilih.','This browser formula is only a microstrip/differential screening approximation. Copper thickness, soldermask, trapezoidal etch, roughness, exact dielectric construction, via transition, and fabrication tolerance are not fully modeled. Final width/spacing must be checked against the selected fabricator stackup and calculator/field solver.')}</div>
    <section class="pp-row" style="margin-top:10px"><b>${t('Timing / delay rule','Timing / delay rule')}</b><p>${t('EasyEDA Pro mendokumentasikan constraint mode berbasis delay (ps), pin/via propagation delay, dan konversi length↔delay berdasarkan permittivity stackup. PCB Pro sekarang menyimpan max skew dalam ps; tahap berikutnya adalah menghubungkan route-length aktual + pin delay ke DRC real-time.','EasyEDA Pro documents delay-based constraints in ps, pin/via propagation delay, and length↔delay conversion using stackup permittivity. PCB Pro now stores max skew in ps; the next step is wiring actual route length + pin delay into real-time DRC.')}</p></section>`;
  }

  function evidenceHtml(){
    return `<div class="pp-note"><b>${t('Corpus policy','Corpus policy')}:</b> ${t('Hanya metadata sumber yang sudah diverifikasi dan tahun 2022–2026 yang masuk seed ini. Gue tidak mengklaim sudah membaca atau memvalidasi 100.000 paper. Database-nya dibuat agar bisa berkembang ke 100k+ metadata DOI secara bertahap dengan deduplikasi dan evidence grading.','Only verified source metadata from 2022–2026 is in this seed. I do not claim that 100,000 papers have already been read or validated. The database is designed to grow toward 100k+ DOI metadata records with deduplication and evidence grading.')}</div>
      <p class="pp-source">${evidenceReady?`${research.length} verified research seed records · 2022–2026`:t('Evidence database belum termuat.','Evidence database not loaded.')}</p>
      <table class="pp-table"><thead><tr><th>Year</th><th>Source</th><th>Tags</th><th>${t('Implementasi','Implementation')}</th></tr></thead><tbody>
      ${research.map(x=>`<tr><td>${x.year}</td><td><a href="${esc(x.source_url)}" target="_blank" rel="noreferrer">${esc(x.title)}</a><br><small>${esc(x.venue)} · ${esc(x.doi||'')}</small></td><td><div class="pp-tags">${(x.tags||[]).map(tag=>`<span class="pp-tag">${esc(tag)}</span>`).join('')}</div></td><td>${esc(x.implementation_relevance)}</td></tr>`).join('')}
      </tbody></table>`;
  }

  function patentsHtml(){
    return `<div class="pp-note"><b>${t('Patent-aware, bukan copy patent.','Patent-aware, not patent-copying.')}</b> ${t('Daftar ini dipakai untuk awareness/freedom-to-operate awal. Status hukum dari aggregator bukan legal opinion. Fitur PCB Pro harus diimplementasikan independen dari claim proprietary dan perlu review IP profesional sebelum produk komersial berisiko tinggi.','This list is for initial awareness/freedom-to-operate. Aggregator legal status is not legal advice. PCB Pro features should be implemented independently of proprietary claims, with professional IP review before high-risk commercial use.')}</div>
      <table class="pp-table" style="margin-top:8px"><thead><tr><th>Patent</th><th>Status</th><th>Topic</th><th>${t('Aturan implementasi','Implementation rule')}</th></tr></thead><tbody>
      ${patents.map(x=>`<tr><td><a href="${esc(x.source_url)}" target="_blank" rel="noreferrer">${esc(x.patent_number)}</a><br><small>${esc(x.assignee||'')}</small></td><td>${esc(x.legal_status)}</td><td>${esc(x.title)}<div class="pp-tags">${(x.tags||[]).map(tag=>`<span class="pp-tag">${esc(tag)}</span>`).join('')}</div></td><td>${esc(x.implementation_note)}</td></tr>`).join('')}
      </tbody></table>`;
  }

  function referenceHtml(){
    return `<div class="pp-note">${t('Kiblat China dipakai sebagai benchmark workflow publik, bukan disalin mentah. Fokusnya: browser performance, hierarchy/reuse blocks, design-rule manager, delay/equal-length constraints, differential pair, live DRC, layer stack, auto-placement/routing dengan human review, assembly variants, dan manufacturing handoff.','Chinese tools are used as public workflow benchmarks, not copied wholesale. Focus areas: browser performance, hierarchy/reuse blocks, design-rule management, delay/equal-length constraints, differential pairs, live DRC, layer stack, auto-placement/routing with human review, assembly variants, and manufacturing handoff.')}</div>
      <div style="margin-top:9px">${referenceTools.map(x=>`<section class="pp-row"><b><a href="${esc(x.official_url)}" target="_blank" rel="noreferrer" style="color:#76d7c2">${esc(x.name)}</a> · ${esc(x.vendor)}</b><p>${esc(x.implementation_scope)}</p><small class="pp-source">verified ${esc(x.verified_at)} · ${esc(x.origin_country)}</small></section>`).join('')}</div>`;
  }

  function roadmapHtml(){
    const cards=[
      [t('P0 · Source of Truth','P0 · Source of Truth'),'Typed domain model penuh: components/pins/nets/footprints/pads/tracks/vias/zones/layers/rules + transactional commands + undo/redo.'],
      [t('P0 · Geometry DRC','P0 · Geometry DRC'),'Clearance matrix, drill/annular ring, pad-to-track, edge, zone clearance, mask/sliver, keepout, netclass, real-time violation overlay.'],
      [t('P0 · Manufacturing','P0 · Manufacturing'),'Gerber X2/Excellon/CPL/BOM exporter, CAM viewer, file consistency checks, fab-profile validation, immutable release package.'],
      [t('P1 · High Speed','P1 · High Speed'),'Delay-aware length constraints, pin/via delay, differential paired router, length tuning, stackup field-solver handoff, return-path checks.'],
      [t('P1 · PI/Thermal','P1 · PI/Thermal'),'DC IR-drop/current-density graph, power-plane analysis, thermal network → FEM/CFD handoff, electrothermal iteration, derating.'],
      [t('P1 · Hierarchy','P1 · Hierarchy'),'Hierarchical/reusable schematic blocks, sheet ports, variants, design comparison, module reuse and synchronized updates.'],
      [t('P2 · Smart Placement','P2 · Smart Placement'),'Routability-aware scoring/GNN ranking, functional clustering, decoupling/connector/antenna constraints, deterministic legality gate.'],
      [t('P2 · Assisted Routing','P2 · Assisted Routing'),'Multi-candidate router, congestion/length/via cost, AI/RL ranking, deterministic DRC gate; never let ML bypass legality.'],
      [t('P2 · Digital Twin','P2 · Digital Twin'),'SMT/manufacturing feedback model: design → process → AOI/X-ray/test/yield → model update → design recommendations.']
    ];
    return `<div class="pp-roadmap">${cards.map(([a,b])=>`<div class="pp-row"><b>${esc(a)}</b><p>${esc(b)}</p></div>`).join('')}</div>
      <div class="pp-note" style="margin-top:10px">${t('Prioritasnya sengaja bukan “AI dulu”. Fondasi professional adalah source-of-truth + deterministic checks + manufacturing output. AI/GNN/LLM dipakai untuk ranking, diagnosis, retrieval, planning dan optimization — bukan menggantikan rule legality atau pengukuran fisik.','The priority is intentionally not “AI first”. Professional foundations are source-of-truth, deterministic checks, and manufacturing outputs. AI/GNN/LLM is used for ranking, diagnosis, retrieval, planning, and optimization—not to replace legality rules or physical measurement.')}</div>`;
  }

  function bodyHtml(){
    if(activeTab==='audit')return auditHtml();
    if(activeTab==='constraints')return constraintsHtml();
    if(activeTab==='impedance')return impedanceHtml();
    if(activeTab==='evidence')return evidenceHtml();
    if(activeTab==='patents')return patentsHtml();
    if(activeTab==='reference')return referenceHtml();
    return roadmapHtml();
  }

  function bind(){
    const m=document.querySelector('#pcbpro-pro-modal');if(!m)return;
    m.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{activeTab=b.dataset.tab;render()}));
    m.querySelector('[data-close]')?.addEventListener('click',()=>m.remove());
    m.querySelector('[data-prof-profile]')?.addEventListener('change',e=>applyProfile(e.target.value));
    m.querySelector('[data-save-rules]')?.addEventListener('click',()=>{
      m.querySelectorAll('[data-k]').forEach(i=>state[i.dataset.k]=n(i.value,state[i.dataset.k]));
      save();activeTab='audit';render();
    });
    m.querySelector('[data-run-audit]')?.addEventListener('click',()=>{activeTab='audit';render()});
    m.querySelector('[data-si-calc]')?.addEventListener('click',()=>{
      m.querySelectorAll('[data-si]').forEach(i=>state[i.dataset.si]=n(i.value,state[i.dataset.si]));
      save();render();
    });
  }

  function render(){
    const m=document.querySelector('#pcbpro-pro-modal');if(!m)return;
    m.querySelector('.pp-tabs').innerHTML=tabs();
    m.querySelector('.pp-body').innerHTML=bodyHtml();
    bind();
  }

  function open(tab='audit'){
    activeTab=tab;
    installStyles();
    document.querySelector('#pcbpro-pro-modal')?.remove();
    const m=document.createElement('div');m.id='pcbpro-pro-modal';
    m.innerHTML=`<div class="pp-card"><header class="pp-head"><div><small>PCB PRO · PROFESSIONAL ENGINEERING v${VERSION}</small><b>${t('Professional Design & Evidence Center','Professional Design & Evidence Center')}</b></div><button data-close>×</button></header><nav class="pp-tabs"></nav><main class="pp-body"></main></div>`;
    document.body.appendChild(m);m.addEventListener('pointerdown',e=>{if(e.target===m)m.remove()});render();
  }

  function ragChunks(){
    return [
      ...research.map(x=>({source:'research-evidence',id:x.doi||String(x.id),title:x.title,text:`${x.year} · ${x.venue} · ${(x.tags||[]).join(', ')} · ${x.implementation_relevance}`})),
      ...patents.map(x=>({source:'patent-awareness',id:x.patent_number,title:x.title,text:`${x.legal_status} · ${(x.tags||[]).join(', ')} · ${x.implementation_note}`})),
      ...referenceTools.map(x=>({source:'professional-tool-benchmark',id:x.name,title:x.name,text:`${x.vendor} · ${x.implementation_scope} · ${x.notes}`}))
    ];
  }

  function snapshot(){
    return {
      version:VERSION,state:{...state},audit:audit(),evidence:{research:research.length,patents:patents.length,referenceTools:referenceTools.length,ready:evidenceReady},
      note:'Research corpus is a verified seed, not 100k reviewed papers.'
    };
  }

  function start(){
    load();mountTrigger();loadEvidence();
    document.addEventListener('click',()=>setTimeout(mountTrigger,0),{passive:true});
    window.addEventListener('pcbpro:language',()=>{if(document.querySelector('#pcbpro-pro-modal'))render()});
    window.addEventListener('pcbpro:board-changed',()=>{if(document.querySelector('#pcbpro-pro-modal')&&activeTab==='audit')render()});
    window.addEventListener('pcbpro:netlist-changed',()=>{if(document.querySelector('#pcbpro-pro-modal')&&activeTab==='audit')render()});
  }

  window.PCBProProfessional={version:VERSION,open,audit,snapshot,ragChunks,applyProfile,microstripZ0,diffZ0,solveWidth,get state(){return {...state}},get evidence(){return {research:[...research],patents:[...patents],referenceTools:[...referenceTools]}}};

  window.PCBProExplain?.register?.({
    id:'feature.professional-engine-v118',
    match:['professional','dfm','impedance','signal integrity','power integrity','patent watch','journal evidence'],
    category:'professional-engineering',
    status:'active-screening-and-evidence',
    title:{id:'Professional Design & Evidence Center',en:'Professional Design & Evidence Center'},
    what:{id:'Pusat audit/rules/DFM screening/SI timing/evidence/patent-awareness yang menghubungkan project PCB dengan benchmark tool profesional dan riset 5 tahun terakhir.',en:'Audit/rules/DFM screening/SI timing/evidence/patent-awareness center linking the PCB project with professional-tool benchmarks and recent research.'},
    why:{id:'Supaya upgrade fitur tidak didasarkan pada gimmick. Setiap fitur profesional harus punya requirement, source, implementation boundary, dan verification level.',en:'So upgrades are not based on gimmicks. Every professional feature needs requirements, sources, implementation boundaries, and a verification level.'},
    input:{id:'Project state, board geometry, professional rule profile, evidence database, patent-awareness database.',en:'Project state, board geometry, professional rule profile, evidence database, and patent-awareness database.'},
    process:{id:'Deterministic audit untuk data yang tersedia + screening calculator + evidence retrieval. UNKNOWN tetap UNKNOWN dan tidak berubah menjadi PASS.',en:'Deterministic audit for available data plus screening calculators and evidence retrieval. UNKNOWN remains UNKNOWN and never becomes PASS.'},
    output:{id:'Audit findings, DFM profile, SI/timing estimates, evidence links, patent-watch notes, dan upgrade map.',en:'Audit findings, DFM profiles, SI/timing estimates, evidence links, patent-watch notes, and an upgrade map.'},
    how_to_read:{id:'Screening result bukan sign-off. Journal/patent adalah evidence/context, bukan otomatis implementasi atau legal clearance.',en:'Screening results are not sign-off. Papers/patents are evidence/context, not automatic implementation or legal clearance.'},
    limits:{id:'Corpus 100k belum diklaim terisi. Seed sekarang berisi metadata sumber terverifikasi; arsitektur database disiapkan untuk tumbuh ke skala besar tanpa memalsukan jumlah paper.',en:'A 100k corpus is not claimed as already populated. The current seed contains verified source metadata; the database architecture is prepared to scale without fabricating paper counts.'},
    next:{id:'P0 berikutnya: central domain model penuh, clearance/drill DRC manufacturing-grade, verified footprint pad geometry, STEP body coverage, dan CAM validation lintas fabricator.',en:'Next P0: complete central domain model, manufacturing-grade clearance/drill DRC, verified footprint pad geometry, STEP body coverage, and cross-fabricator CAM validation.'}
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();