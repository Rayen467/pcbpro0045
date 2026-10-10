(() => {
  'use strict';
  if (window.PCBProVerificationV125) return;
  const VERSION = '1.25.0';
  let lastReport = null;

  function testEngine(name, run) {
    try {
      const result=run();
      return { name, available: result !== null && result !== undefined, result:result ?? null };
    } catch (error) {
      return {name, available:false, error:String(error?.message || error), result:null};
    }
  }
  function inspect() {
    const components=window.PCBProProject?.getComponents?.() || [];
    const nets=window.PCBProWireEngine?.nets || [];
    const board=window.PCBProBoardModel?.model || {};
    const advanced=window.PCBProAdvancedBoard?.model || {};
    const source={
      components:components.length, nets:nets.length,
      wires:window.PCBProWireEngine?.routes?.length ?? null,
      tracks:board.tracks?.length ?? null,
      vias:advanced.vias?.length ?? null,
      outlineVertices:board.outline?.length ?? null
    };
    const integrity=testEngine('Project integrity',()=>window.PCBProIntegrity?.validate?.());
    const spice=testEngine('SPICE model coverage',()=>window.PCBProSpiceV125?.current?.());
    const physical=testEngine('Physical copper DRC',()=>window.PCBProPhysicalDRC?.run?.());
    const fabrication=testEngine('Manufacturing preflight',()=>window.PCBProManufacturing?.preflight?.());
    const electrical=testEngine('Electrical load schedule',()=>window.PCBProElectrical?.calculate?.());
    const electricalAdvanced=testEngine('Electrical energy and protection',()=>window.PCBProElectricalAdvanced?.analyze?.());
    const electricalCircuits=window.PCBProElectrical?.snapshot?.()?.circuits?.length||0;
    const findings=[];
    function add(code,severity,details){
      findings.push({code,severity,details});
    }
    if (!components.length) add('EMPTY_PROJECT','blocker','Project contains no components.');
    if (!nets.length) add('UNWIRED_PROJECT','blocker','Schematic has no completed nets.');
    if (!integrity.available) add('INTEGRITY_UNAVAILABLE','blocker',integrity.error || 'Domain integrity engine not loaded.');
    else {
      const issues=integrity.result.issues||[];
      const errors=issues.filter(x=>x.severity==='error').length;
      const warnings=issues.filter(x=>x.severity==='warn'||x.severity==='warning').length;
      if(errors)add('INTEGRITY_ERRORS','blocker',errors+' cross-engine integrity errors.');
      if(warnings)add('INTEGRITY_WARNINGS','warning',warnings+' integrity warnings.');
    }
    if(!spice.available) add('SPICE_UNAVAILABLE','blocker',spice.error||'SPICE validation engine not loaded.');
    else for(const i of spice.result.issues||[])add('SPICE_'+i.code, i.severity, (i.ref?i.ref+': ':'')+i.message);
    if(!physical.available) add('DRC_UNAVAILABLE','blocker',physical.error||'Physical DRC engine not loaded.');
    else {
      if(!physical.result.calibrated)add('SCALE_UNCALIBRATED','blocker','Board outline and dimensions in mm are required.');
      for(const i of physical.result.findings||[])add('DRC_'+i.code,(i.severity==='error'||i.severity==='blocker')?'blocker':'warning',i.message);
    }
    if(!fabrication.available) add('FAB_UNAVAILABLE','blocker',fabrication.error||'Manufacturing preflight engine not loaded.');
    else {
      for(const i of fabrication.result.findings||[])add('FAB_'+i.code,'blocker',i.message);
      for(const i of fabrication.result.warnings||[])add('FAB_'+i.code,'warning',i.message);
      if(!fabrication.result.readyForProduction)add('FAB_DRAFT_ONLY','warning','CAM status is not a production candidate; unverified footprint geometry and/or preflight checks remain.');
    }
    if(electricalCircuits){
      if(!electrical.available||!electrical.result.ok)add('ELECTRICAL_UNAVAILABLE','blocker','Electrical calculations are unavailable or invalid.');
      else for(const e of electrical.result.findings||[])
        add('ELEC_'+e.code,e.severity==='warning'?'warning':'warning',(e.ref?e.ref+': ':'')+e.message);
    }
    if(electricalCircuits){
      if(!electricalAdvanced.available)add('ELEC_ADVANCED_UNAVAILABLE','blocker',electricalAdvanced.error||'Advanced electrical verifier unavailable.');
      else for(const f of electricalAdvanced.result.issues||[])
        add('ELEC_ADV_'+f.code,f.severity==='blocker'?'blocker':'warning',(f.ref?f.ref+': ':'')+f.message);
    }
    const blockers=findings.filter(x=>x.severity==='blocker').length, warnings=findings.filter(x=>x.severity==='warning').length;
    const report={
      version:VERSION,
      generatedAt:new Date().toISOString(),
      project:{...source,electricalCircuits},
      verdict:blockers?'BLOCKED':warnings?'REVIEW_REQUIRED':'CHECKS_PASS_NOT_CERTIFIED',
      summary:{blockers,warnings,total:findings.length},
      findings,
      coverage:{
        integrity:integrity.available,
        electrical:electrical.available,
        electricalNotInstallationApproved:true,
        electricalAdvanced:electricalAdvanced.available,
        hourlyEnergyEvidence:electricalAdvanced.result?.analysisAvailable===true,
        electricalStandardComplianceCertified:false,
        spice:spice.available,
        physicalDrc:physical.available && physical.result.calibrated===true,
        manufacturing:fabrication.available,
        manufacturingScope:fabrication.result?.scope || 'unavailable',
        externallySimulated:false,
        measuredOnHardware:false
      },
      note:'Verification records engine findings, not certification, hardware measurement, vendor-model sign-off, or fully validated CAM output.'
    };
    lastReport=report;
    return report;
  }
  function saveReport(){
    const report=inspect();
    const blob=new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'});
    const url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url;a.download='sirkuitlab-verification-'+new Date().toISOString().slice(0,10)+'.json';
    a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
    return report;
  }
  function render(report=inspect()) {
    document.getElementById('pcbpro-verification-dialog')?.remove();
    const dialog=document.createElement('div');dialog.id='pcbpro-verification-dialog';
    dialog.style.cssText='position:fixed;z-index:3400;inset:0;background:#000d;display:grid;place-items:center;padding:14px';
    const card=document.createElement('section');
    card.style.cssText='width:min(850px,97vw);max-height:90vh;overflow:auto;border:1px solid #365764;border-radius:14px;background:#0a1923;color:#dfeaf0;padding:18px;display:grid;gap:11px;font:13px/1.6 system-ui';
    const title=document.createElement('h3');title.textContent='Engineering Verification · SirkuitLab v1.25';title.style.margin='0';
    const status=document.createElement('p');
    status.textContent=report.verdict+' · '+report.summary.blockers+' blockers · '+report.summary.warnings+' warnings';
    status.style.cssText='font-weight:800;color:'+(report.summary.blockers?'#ffb1a0':report.summary.warnings?'#ebce83':'#82ddc8');
    const coverage=document.createElement('p');
    coverage.style.cssText='margin:0;color:#a4bcc7;font-size:12px';
    coverage.textContent=Object.entries(report.project).map(([k,v])=>k+': '+(v??'unknown')).join(' · ');
    const evidence=document.createElement('p');evidence.style.cssText='margin:0;font-size:11px;color:#90a8b3';
    evidence.textContent=report.note+' External SPICE executed: NO. Physical calibration: '+(report.coverage.physicalDrc?'YES':'NO')+'. CAM scope: '+report.coverage.manufacturingScope+'.';
    const list=document.createElement('div');list.style.cssText='display:grid;gap:6px;max-height:45vh;overflow:auto';
    for(const f of report.findings.length?report.findings:[{code:'NO_REPORTED_VIOLATIONS',severity:'info',details:'Implemented checks reported no violations; this does not certify the manufactured board.'}]){
      const row=document.createElement('article');
      row.style.cssText='border-left:3px solid '+(f.severity==='blocker'?'#d97670':f.severity==='warning'?'#c9a158':'#57b89e')+';background:#112731;padding:8px;border-radius:6px';
      const head=document.createElement('strong');head.textContent=f.severity.toUpperCase()+' · '+f.code;
      const p=document.createElement('p');p.textContent=f.details;p.style.cssText='margin:4px 0 0;font-size:11px;color:#bad0db';
      row.append(head,p);list.appendChild(row);
    }
    const actions=document.createElement('div');actions.style.cssText='display:flex;flex-wrap:wrap;gap:8px';
    const add=(caption,fn)=>{
      const b=document.createElement('button');b.textContent=caption;
      b.style.cssText='background:#154b47;border:1px solid #367e74;color:#e6fff9;border-radius:7px;padding:8px 12px;font-weight:700;cursor:pointer';
      b.onclick=fn;actions.appendChild(b);
    };
    add('Run checks again',()=>render(inspect()));
    add('Export JSON report',saveReport);
    add('Open SPICE details',()=>window.PCBProSpiceV125?.show?.());
    add('Close',()=>dialog.remove());
    card.append(title,status,coverage,evidence,list,actions);
    dialog.append(card);
    dialog.onclick=e=>{if(e.target===dialog)dialog.remove()};
    document.body.append(dialog);
  }
  function mount(){
    const host=document.querySelector('.top-actions');
    if(!host || document.getElementById('pcbpro-verification-trigger'))return;
    const b=document.createElement('button');
    b.id='pcbpro-verification-trigger';b.type='button';b.textContent='VERIFY';
    b.title='Combined project integrity / SPICE coverage / physical DRC / CAM preflight';
    b.style.cssText='border:1px solid #507065;background:#142d29;color:#b7e4cd;border-radius:7px;padding:7px 9px;font:800 10px system-ui';
    b.onclick=()=>render();host.append(b);
  }
  function start(){mount();document.addEventListener('click',()=>setTimeout(mount,0),{passive:true})}
  window.PCBProVerificationV125={version:VERSION,inspect,render,saveReport,get lastReport(){return lastReport?structuredClone(lastReport):null}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();