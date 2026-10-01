(() => {
  'use strict';
  const VERSION = '0.3.0';
  let db = null;
  let dbError = null;
  let timer = 0;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const lang = () => window.PCBProUX?.lang || localStorage.getItem('pcbpro0045-lang') || 'id';

  async function loadDb() {
    try {
      const res = await fetch('/component-db.json', { cache:'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      db = await res.json();
      dbError = null;
    } catch (error) {
      db = null;
      dbError = error?.message || String(error);
    }
    render();
  }

  function selectedPart() {
    const sections = [...document.querySelectorAll('.inspector section')];
    const properties = sections.find((s) => /PROPERTIES|PROPERTI/i.test(s.textContent || ''));
    const ref = properties?.querySelector('.ins-title b')?.textContent?.trim();
    if (!ref || ref === '—') return null;
    const node = [...document.querySelectorAll('.node')].find((n) => n.querySelector('.ref')?.textContent?.trim() === ref);
    if (!node) return null;
    const value = node.querySelector('b')?.textContent?.trim() || '';
    const name = node.querySelector('small')?.textContent?.trim() || '';
    const footprint = [...(properties?.querySelectorAll('label') || [])].find((l) => /Footprint/i.test(l.querySelector('span')?.textContent || ''))?.querySelector('input')?.value || '';
    const text = `${ref} ${name} ${value}`.toLowerCase();
    let code = ref.replace(/\d.*$/, '').toUpperCase();
    if (/led/.test(text)) code = 'LED';
    else if (/ground/.test(text)) code = 'GND';
    else if (/mosfet/.test(text)) code = 'Q';
    else if (/op-amp/.test(text)) code = 'U';
    return { ref, name, value, footprint, code };
  }

  function exactFor(part) {
    if (!db?.parts || !part) return null;
    const hay = `${part.name} ${part.value}`.toUpperCase();
    return db.parts.find((p) => hay.includes(String(p.mpn).toUpperCase())) || null;
  }

  function genericRequirements(code) {
    return db?.generic_requirements?.[code] || [];
  }

  function formatRating(key, value) {
    const labels = {
      continuous_reverse_voltage_v:'Continuous reverse voltage', repetitive_peak_reverse_voltage_v:'Repetitive peak reverse voltage',
      continuous_forward_current_a:'Continuous forward current', repetitive_peak_forward_current_a:'Repetitive peak forward current',
      max_switching_time_s:'Maximum switching time', vds_max_v:'VDS maximum', family_current_rating_a:'Family current rating',
      supply_min_v:'Supply minimum', supply_max_v:'Supply maximum', gbw_typ_hz:'GBW typical', slew_rate_typ_v_per_us:'Slew rate typical',
      operating_temp_min_c:'Operating temp minimum', operating_temp_max_c:'Operating temp maximum', output_headroom_to_positive_supply_typ_v:'Output headroom to +supply typ.'
    };
    let formatted = value;
    if (/_v$/.test(key)) formatted = `${value} V`;
    else if (/_a$/.test(key)) formatted = `${value} A`;
    else if (/_hz$/.test(key)) formatted = value >= 1e6 ? `${value/1e6} MHz` : `${value/1e3} kHz`;
    else if (/_s$/.test(key)) formatted = value < 1e-6 ? `${value*1e9} ns` : `${value} s`;
    else if (/_c$/.test(key)) formatted = `${value} °C`;
    else if (/_v_per_us$/.test(key)) formatted = `${value} V/µs`;
    return { label: labels[key] || key.replaceAll('_',' '), value: formatted };
  }

  function ensureSection() {
    const inspector = document.querySelector('.inspector');
    if (!inspector) return null;
    let section = inspector.querySelector('.component-intel');
    if (!section) {
      section = document.createElement('section');
      section.className = 'component-intel';
      const first = inspector.querySelector('section');
      if (first?.nextSibling) inspector.insertBefore(section, first.nextSibling); else inspector.appendChild(section);
    }
    return section;
  }

  function render() {
    const section = ensureSection();
    if (!section) return;
    const l = lang();
    const part = selectedPart();
    const title = l === 'id' ? 'DATA KOMPONEN LAPANGAN' : 'FIELD COMPONENT DATA';

    if (!db) {
      section.innerHTML = `<div class="ins-title"><span>${title}</span><b>DB</b></div><div class="ci-db-error"><b>${l==='id'?'Katalog vendor tidak tersedia':'Vendor catalog unavailable'}</b><span>${esc(dbError || 'loading…')}</span></div>`;
      return;
    }
    if (!part) {
      section.innerHTML = `<div class="ins-title"><span>${title}</span><b>DB ${esc(db.schema_version)}</b></div><p class="ci-empty">${l==='id'?'Pilih komponen. Rating exact hanya tampil kalau MPN/vendor cocok dengan katalog terverifikasi.':'Select a component. Exact ratings appear only when the MPN/vendor matches the verified catalog.'}</p>`;
      return;
    }

    const exact = exactFor(part);
    if (!exact) {
      const req = genericRequirements(part.code);
      section.innerHTML = `<div class="ins-title"><span>${title}</span><b>${esc(part.ref)}</b></div>
        <div class="ci-status generic"><i></i><div><b>${l==='id'?'UNRESOLVED · MPN WAJIB':'UNRESOLVED · MPN REQUIRED'}</b><small>${l==='id'?'Tidak ada rating lapangan yang diasumsikan':'No field ratings are assumed'}</small></div></div>
        <h4>${esc(part.name || part.code)}</h4><div class="ci-meta"><span>${l==='id'?'Nilai':'Value'} <b>${esc(part.value || '—')}</b></span><span>Footprint <b>${esc(part.footprint || '—')}</b></span></div>
        <p class="ci-note">${l==='id'?'Komponen ini masih generik. PCB Pro sengaja tidak mengarang current, voltage, thermal, lifetime, atau kualitas tanpa part number exact.':'This component is still generic. PCB Pro intentionally does not invent current, voltage, thermal, lifetime, or quality data without an exact part number.'}</p>
        ${req.length?`<div class="ci-req"><b>${l==='id'?'Data yang masih dibutuhkan':'Still required'}</b><ul>${req.map((x)=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}`;
      return;
    }

    const rows = Object.entries(exact.ratings || {}).map(([k,v]) => formatRating(k,v));
    const warnings = [...(exact.warnings || [])];
    if (exact.mpn === '1N4148' && /SOD[-_ ]?123/i.test(part.footprint)) warnings.unshift(l==='id'?'Footprint project SOD-123 tidak sama dengan referensi Nexperia 1N4148 axial SOD27/DO-35. Pilih MPN SMD exact atau ubah footprint.':'Project SOD-123 footprint does not match the Nexperia 1N4148 axial SOD27/DO-35 reference. Choose an exact SMD MPN or change the footprint.');
    section.innerHTML = `<div class="ins-title"><span>${title}</span><b>${esc(part.ref)}</b></div>
      <div class="ci-status verified"><i></i><div><b>${l==='id'?'VENDOR VERIFIED':'VENDOR VERIFIED'}</b><small>${esc(exact.manufacturer)} · snapshot ${esc(db.verified_at)}</small></div></div>
      <h4>${esc(exact.mpn)}</h4><div class="ci-meta"><span>MPN <b>${esc(exact.mpn)}</b></span><span>Package <b>${esc(exact.package || 'orderable-dependent')}</b></span></div>
      <div class="ci-ratings">${rows.map((r)=>`<div><span>${esc(r.label)}</span><b>${esc(r.value)}</b></div>`).join('')}</div>
      ${warnings.length?`<div class="ci-warn">${warnings.map((w)=>`<p>⚠ ${esc(w)}</p>`).join('')}</div>`:''}
      <div class="ci-sources">${(exact.sources || []).map((s)=>`<a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.type)} ↗</a>`).join('')}</div>`;
  }

  function installStyles() {
    if (document.getElementById('component-intel-style')) return;
    const s = document.createElement('style');
    s.id = 'component-intel-style';
    s.textContent = `.component-intel{background:#0f1922!important}.component-intel h4{font-size:13px;margin:9px 0;color:#e5edf2}.ci-status{display:flex;align-items:center;gap:8px;border:1px solid #2b404d;background:#111f29;border-radius:8px;padding:9px}.ci-status i{width:9px;height:9px;border-radius:50%;flex:0 0 9px}.ci-status.verified i{background:#45c9a9;box-shadow:0 0 10px #45c9a955}.ci-status.generic i{background:#d1ac55}.ci-status b{display:block;font-size:10px;color:#dbe7ed}.ci-status small{display:block;font-size:8px;color:#778c9a;margin-top:2px}.ci-meta{display:grid;gap:4px;margin:8px 0}.ci-meta span{font-size:9px;color:#7890a0}.ci-meta b{color:#c8d7df}.ci-ratings{display:grid;gap:5px}.ci-ratings div{display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid #1d303b;padding:5px 0}.ci-ratings span{font-size:8px;color:#7890a0}.ci-ratings b{font-size:9px;color:#cfe0e7;text-align:right}.ci-note,.ci-db-error{font-size:9px;line-height:1.55;color:#a5b6c2;border:1px solid #29404d;background:#0c1720;border-radius:7px;padding:8px}.ci-db-error{border-color:#684239;color:#e69a85}.ci-db-error span{display:block;margin-top:4px}.ci-warn{border:1px solid #5b4726;background:#241d10;border-radius:7px;padding:7px;margin:7px 0}.ci-warn p{margin:3px 0;color:#d5b766;font-size:9px;line-height:1.5}.ci-sources{display:grid;gap:5px;margin-top:7px}.ci-sources a{border:1px solid #2d5e51;background:#102a23;color:#70d7c0;border-radius:7px;padding:7px;text-align:center;text-decoration:none;font-size:9px}.ci-req{border:1px solid #3e4650;background:#151b22;border-radius:7px;padding:8px;color:#aebfc8;font-size:9px}.ci-req ul{margin:5px 0 0;padding-left:17px}.ci-empty{font-size:9px;color:#738897;line-height:1.5}`;
    document.head.appendChild(s);
  }

  function start() {
    installStyles();
    loadDb();
    const observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(render,100); });
    observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
    window.addEventListener('pcbpro:language',render);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();

  window.PCBProComponentIntel = { version:VERSION, reload:loadDb, render, get database(){return db;}, get databaseError(){return dbError;} };
})();
