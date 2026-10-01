(() => {
  'use strict';

  const VERSION = '0.2.0';
  const verifiedAt = '2026-10-01';
  const catalog = {
    '1N4148': {
      identity:'1N4148', vendor:'Nexperia reference', confidence:'vendor',
      title:{id:'Dioda switching kecepatan tinggi',en:'High-speed switching diode'},
      capabilities:{id:['Reverse voltage kontinu 100 V','Repetitive peak forward current 450 mA','Switching time maks. 4 ns','Referensi Nexperia exact-part memakai package SOD27 / DO-35 axial'],en:['100 V continuous reverse voltage','450 mA repetitive peak forward current','Maximum 4 ns switching time','Nexperia exact-part reference uses axial SOD27 / DO-35 package']},
      warnings:{id:['Kalau footprint project SOD-123, identitas part masih ambigu: itu bisa varian/manufaktur lain. Kunci manufacturer part number sebelum fabrikasi.','Jangan memakai 450 mA sebagai arus kerja kontinu; datasheet exact menyebut repetitive peak forward current.'],en:['If the project footprint is SOD-123, part identity is still ambiguous: it may be another variant/manufacturer. Lock the manufacturer part number before fabrication.','Do not treat 450 mA as continuous operating current; the exact reference specifies repetitive peak forward current.']},
      source:'https://www.nexperia.com/product/1N4148', sourceLabel:'Nexperia 1N4148 product data'
    },
    '2N7002': {
      identity:'2N7002', vendor:'Nexperia reference', confidence:'vendor',
      title:{id:'N-channel Trench MOSFET 60 V',en:'60 V N-channel Trench MOSFET'},
      capabilities:{id:['VDS 60 V','Arus nominal keluarga 300 mA pada referensi 2N7002 Nexperia','Logic-level compatible dan very fast switching','VGS(th) referensi: 1 V min, 2 V typ, 2.5 V max pada ID 0.25 mA'],en:['60 V VDS','300 mA family current rating on the Nexperia 2N7002 reference','Logic-level compatible and very fast switching','Reference VGS(th): 1 V min, 2 V typ, 2.5 V max at ID 0.25 mA']},
      warnings:{id:['VGS(th) bukan tegangan gate untuk menjamin RDS(on) rendah. Gunakan kondisi RDS(on) dari datasheet subvariant yang benar.','Rating thermal/RDS(on) bergantung package dan subvariant; pilih MPN exact sebelum sign-off.'],en:['VGS(th) is not the gate voltage that guarantees low RDS(on). Use the correct subvariant datasheet RDS(on) conditions.','Thermal/RDS(on) ratings depend on package and subvariant; select an exact MPN before sign-off.']},
      source:'https://www.nexperia.com/product/2N7002', sourceLabel:'Nexperia 2N7002 product data'
    },
    'LM358': {
      identity:'LM358', vendor:'Texas Instruments reference', confidence:'vendor',
      title:{id:'Dual operational amplifier standar industri',en:'Industry-standard dual operational amplifier'},
      capabilities:{id:['LM358 legacy TI: supply 3–30 V, GBW tip. 0.7 MHz, slew rate tip. 0.3 V/µs, suhu operasi 0–70 °C','LM358B generasi lebih baru: supply 3–36 V, GBW tip. 1.2 MHz, slew rate tip. 0.5 V/µs, suhu operasi -40–85 °C','Dua channel op-amp; input common-mode mencakup ground'],en:['TI legacy LM358: 3–30 V supply, 0.7 MHz typical GBW, 0.3 V/µs typical slew rate, 0–70 °C operation','Newer LM358B: 3–36 V supply, 1.2 MHz typical GBW, 0.5 V/µs typical slew rate, -40–85 °C operation','Dual op amp; input common-mode includes ground']},
      warnings:{id:['LM358 bukan rail-to-rail output. Jangan menganggap output bisa mencapai positive rail.','Library harus membedakan LM358 / LM358A / LM358B / LM358BA karena limit dan performanya tidak sama.'],en:['LM358 is not rail-to-rail at the output. Do not assume output reaches the positive rail.','The library should distinguish LM358 / LM358A / LM358B / LM358BA because limits and performance differ.']},
      source:'https://www.ti.com/product/LM358', sourceLabel:'Texas Instruments LM358 product data'
    }
  };

  const generic = {
    R:{title:{id:'Resistor generik',en:'Generic resistor'},note:{id:'Nilai resistansi diketahui, tetapi rating daya, tolerance, voltage coefficient, TCR, pulse rating, dan reliability tidak boleh diasumsikan tanpa seri/MPN vendor.',en:'Resistance value is known, but power rating, tolerance, voltage coefficient, TCR, pulse rating, and reliability must not be assumed without a vendor series/MPN.'}},
    C:{title:{id:'Kapasitor generik',en:'Generic capacitor'},note:{id:'Capacitance saja tidak cukup. Butuh dielectric, rated voltage, DC-bias derating, ESR, ripple current, tolerance, dan suhu dari MPN exact.',en:'Capacitance alone is insufficient. Exact MPN data is required for dielectric, rated voltage, DC-bias derating, ESR, ripple current, tolerance, and temperature.'}},
    L:{title:{id:'Induktor generik',en:'Generic inductor'},note:{id:'Butuh DCR, saturation current, RMS current, core loss, SRF, tolerance, dan thermal data dari MPN exact.',en:'Exact MPN data is required for DCR, saturation current, RMS current, core loss, SRF, tolerance, and thermal behavior.'}},
    LED:{title:{id:'LED generik',en:'Generic LED'},note:{id:'Warna dan Vf nominal belum cukup untuk sign-off. Butuh MPN untuk IF max, thermal resistance, Vf distribution, luminous intensity, dan derating.',en:'Color and nominal Vf are not enough for sign-off. An MPN is required for IF max, thermal resistance, Vf distribution, luminous intensity, and derating.'}},
    V:{title:{id:'Sumber DC generik',en:'Generic DC source'},note:{id:'Tegangan nominal ada, tetapi source impedance, current limit, ripple, transient response, dan protection belum dimodelkan tanpa model supply exact.',en:'Nominal voltage is known, but source impedance, current limit, ripple, transient response, and protection are not modeled without an exact supply model.'}},
    SW:{title:{id:'Switch generik',en:'Generic switch'},note:{id:'Butuh contact resistance, rated current/voltage, bounce, lifetime, dan package exact.',en:'Exact contact resistance, current/voltage rating, bounce, lifetime, and package data are required.'}},
    J:{title:{id:'Connector generik',en:'Generic connector'},note:{id:'Butuh current-per-pin, voltage rating, contact resistance, temperature rise, mating cycles, dan pitch/series exact.',en:'Exact current-per-pin, voltage rating, contact resistance, temperature rise, mating cycles, and pitch/series are required.'}},
    TP:{title:{id:'Test point generik',en:'Generic test point'},note:{id:'Validasi ukuran pad, probe access, current transient, dan manufacturing clearance terhadap fixture yang akan dipakai.',en:'Validate pad size, probe access, transient current, and manufacturing clearance against the actual fixture.'}},
    GND:{title:{id:'Ground reference',en:'Ground reference'},note:{id:'Ini referensi elektrik/logical, bukan komponen fisik dengan rating tunggal.',en:'This is an electrical/logical reference, not a physical component with a single rating.'}}
  };

  const esc = (v)=>String(v??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function lang(){ return window.PCBProUX?.lang || localStorage.getItem('pcbpro0045-lang') || 'id'; }

  function selectedPart() {
    const properties = [...document.querySelectorAll('.inspector section')].find((s)=>/PROPERTIES|PROPERTI/i.test(s.textContent || ''));
    const ref = properties?.querySelector('.ins-title b')?.textContent?.trim();
    if (!ref || ref === '—') return null;
    const node = [...document.querySelectorAll('.node')].find((n)=>n.querySelector('.ref')?.textContent?.trim()===ref);
    if (!node) return null;
    const value = node.querySelector('b')?.textContent?.trim() || '';
    const name = node.querySelector('small')?.textContent?.trim() || '';
    const footprint = [...properties.querySelectorAll('label')].find((l)=>/Footprint/i.test(l.querySelector('span')?.textContent||''))?.querySelector('input')?.value || '';
    const text = `${ref} ${name} ${value}`;
    let code = ref.replace(/\d.*$/,'').toUpperCase();
    if (/led/i.test(text)) code='LED'; else if (/ground/i.test(text)) code='GND';
    return {ref,name,value,footprint,code};
  }

  function profileFor(part) {
    if (!part) return null;
    const exact = Object.values(catalog).find((p)=>String(part.value).toUpperCase().includes(p.identity.toUpperCase()) || String(part.name).toUpperCase().includes(p.identity.toUpperCase()));
    if (exact) return {...exact,kind:'exact'};
    const g = generic[part.code] || {title:{id:'Komponen generik',en:'Generic component'},note:{id:'MPN/vendor belum ditentukan; capability lapangan belum dapat dikunci.',en:'MPN/vendor is not defined; field capability cannot be locked yet.'}};
    return {identity:part.name||part.ref,vendor:'MPN required',confidence:'generic',kind:'generic',...g};
  }

  function warningsFor(part, profile) {
    const l=lang();
    const rows=[];
    if (profile.kind==='exact' && Array.isArray(profile.warnings?.[l])) rows.push(...profile.warnings[l]);
    if (profile.identity==='1N4148' && /SOD[-_ ]?123/i.test(part.footprint||'')) rows.unshift(l==='id'?'Footprint project SOD-123 tidak cocok dengan referensi exact Nexperia 1N4148 yang axial SOD27/DO-35. Pilih MPN SMD exact atau ganti footprint.':'Project SOD-123 footprint does not match the exact Nexperia 1N4148 axial SOD27/DO-35 reference. Choose an exact SMD MPN or change the footprint.');
    return [...new Set(rows)];
  }

  function description(part=selectedPart()) {
    if (!part) return null;
    const l=lang(), p=profileFor(part), warnings=warningsFor(part,p);
    return {part,profile:p,warnings,
      title:p.title?.[l] || p.title?.en || p.identity,
      capabilities:p.capabilities?.[l] || p.capabilities?.en || [],
      note:p.note?.[l] || p.note?.en || '',
      status:p.confidence==='vendor' ? (l==='id'?'Referensi vendor terverifikasi':'Vendor-grounded reference') : (l==='id'?'Generik — MPN wajib untuk sign-off':'Generic — MPN required for sign-off')
    };
  }

  function render() {
    const inspector=document.querySelector('.inspector');
    if (!inspector) return;
    let section=inspector.querySelector('.component-intel');
    if (!section) {
      section=document.createElement('section');
      section.className='component-intel';
      const properties=inspector.querySelector('section');
      if (properties?.nextSibling) inspector.insertBefore(section,properties.nextSibling); else inspector.appendChild(section);
    }
    const d=description();
    const l=lang();
    if (!d) {
      section.innerHTML=`<div class="ins-title"><span>${l==='id'?'DATA KOMPONEN LAPANGAN':'FIELD COMPONENT DATA'}</span><b>—</b></div><p class="ci-empty">${l==='id'?'Pilih komponen untuk melihat capability, limit, sumber, dan confidence model.':'Select a component to see capabilities, limits, sources, and model confidence.'}</p>`;
      return;
    }
    const p=d.profile;
    const caps=d.capabilities.length?`<ul>${d.capabilities.map((x)=>`<li>${esc(x)}</li>`).join('')}</ul>`:'';
    const note=d.note?`<p class="ci-note">${esc(d.note)}</p>`:'';
    const warns=d.warnings.length?`<div class="ci-warn">${d.warnings.map((x)=>`<p>⚠ ${esc(x)}</p>`).join('')}</div>`:'';
    section.innerHTML=`<div class="ins-title"><span>${l==='id'?'DATA KOMPONEN LAPANGAN':'FIELD COMPONENT DATA'}</span><b>${esc(d.part.ref)}</b></div>
      <div class="ci-status ${p.confidence==='vendor'?'verified':'generic'}"><i></i><div><b>${esc(d.status)}</b><small>${esc(p.vendor || '')} · checked ${verifiedAt}</small></div></div>
      <h4>${esc(d.title)}</h4><div class="ci-meta"><span>${l==='id'?'Nilai':'Value'} <b>${esc(d.part.value)}</b></span><span>Footprint <b>${esc(d.part.footprint || '—')}</b></span></div>${caps}${note}${warns}
      ${p.source?`<a class="ci-source" href="${esc(p.source)}" target="_blank" rel="noreferrer">${l==='id'?'Buka sumber vendor':'Open vendor source'} ↗</a>`:''}`;
  }

  function installStyles(){
    if(document.getElementById('component-intel-style'))return;
    const s=document.createElement('style');s.id='component-intel-style';s.textContent=`
      .component-intel{background:#0f1922!important}.component-intel h4{font-size:13px;margin:8px 0;color:#e4edf2}.ci-status{display:flex;align-items:center;gap:8px;border:1px solid #2b404d;background:#111f29;border-radius:8px;padding:8px}.ci-status i{width:9px;height:9px;border-radius:50%}.ci-status.verified i{background:#45c9a9;box-shadow:0 0 10px #45c9a955}.ci-status.generic i{background:#d1ac55}.ci-status b{display:block;font-size:10px;color:#dbe7ed}.ci-status small{display:block;font-size:8px;color:#778c9a;margin-top:2px}.ci-meta{display:grid;grid-template-columns:1fr;gap:4px;margin:8px 0}.ci-meta span{font-size:9px;color:#7890a0}.ci-meta b{color:#c8d7df}.component-intel ul{margin:7px 0;padding-left:17px;color:#aebfca;font-size:9px;line-height:1.55}.ci-note{font-size:9px;line-height:1.55;color:#a5b6c2;border:1px solid #29404d;background:#0c1720;border-radius:7px;padding:8px}.ci-warn{border:1px solid #5b4726;background:#241d10;border-radius:7px;padding:7px;margin:7px 0}.ci-warn p{margin:3px 0;color:#d5b766;font-size:9px;line-height:1.5}.ci-source{display:block;margin-top:7px;border:1px solid #2d5e51;background:#102a23;color:#70d7c0;border-radius:7px;padding:7px;text-align:center;text-decoration:none;font-size:9px}.ci-empty{font-size:9px;color:#738897;line-height:1.5}`;document.head.appendChild(s);
  }

  function answer(query) {
    const q=String(query||'').toLowerCase();
    const {components=[]}=(()=>{const nodes=[...document.querySelectorAll('.node')];return{components:nodes.map(n=>({id:n.querySelector('.ref')?.textContent?.trim()||'',name:n.querySelector('small')?.textContent?.trim()||'',value:n.querySelector('b')?.textContent?.trim()||''}))}})();
    const hit=Object.keys(catalog).find((k)=>q.includes(k.toLowerCase())) || components.find((c)=>q.includes(c.id.toLowerCase()))?.id;
    let part=null;
    if(hit && catalog[hit]) part={ref:hit,name:hit,value:hit,footprint:'',code:hit};
    else if(hit){const node=[...document.querySelectorAll('.node')].find(n=>n.querySelector('.ref')?.textContent?.trim().toLowerCase()===hit.toLowerCase());if(node){part={ref:hit,name:node.querySelector('small')?.textContent?.trim()||'',value:node.querySelector('b')?.textContent?.trim()||'',footprint:'',code:hit.replace(/\d.*$/,'').toUpperCase()}}}
    else part=selectedPart();
    const d=description(part);
    if(!d)return null;
    const l=lang();
    const lines=[`${d.part.ref}: ${d.title}.`,d.status+'.'];
    if(d.capabilities.length)lines.push((l==='id'?'Capability yang terkunci dari referensi sekarang: ':'Locked capabilities from the current reference: ')+d.capabilities.join('; ')+'.');
    if(d.note)lines.push(d.note);
    if(d.warnings.length)lines.push((l==='id'?'Yang harus dicek sebelum dianggap sesuai lapangan: ':'Checks required before field sign-off: ')+d.warnings.join(' '));
    if(d.profile.source)lines.push((l==='id'?'Sumber vendor: ':'Vendor source: ')+d.profile.source);
    return lines.join('\n\n');
  }

  function start(){installStyles();render();const mo=new MutationObserver(()=>{clearTimeout(mo.t);mo.t=setTimeout(render,120)});mo.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','value']});window.addEventListener('pcbpro:language',render);
    if(typeof window.PCBProAssistantProvider!=='function')window.PCBProAssistantProvider=async(ctx)=>{const q=String(ctx?.query||'');if(/component|komponen|datasheet|rating|capability|kemampuan|kualitas|mpn|1n4148|2n7002|lm358/i.test(q))return answer(q);return null;};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

  window.PCBProComponentIntel={version:VERSION,verifiedAt,catalog,selectedPart,description,answer,refresh:render};
})();