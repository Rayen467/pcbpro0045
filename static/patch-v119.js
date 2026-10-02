(() => {
  'use strict';
  if (window.PCBProPatchV119) return;
  const VERSION='1.19.0';
  const release={
    id:{title:'Stability & Integration Pass — Placeholder Removal, Real Engine Bridges, Self-Test',changes:[
      'Core workspace naik ke v1.19.0 dan stale placeholder actions diganti dengan bridge ke ERC, PCB DRC, Live Circuit, Project Database, Professional Rules, Route, Via dan Zone engine yang benar-benar tersedia.',
      'Hapus fake schematic wire, fake ratsnest, dan illustrative simulator numbers dari core UI supaya engine gagal-load tidak pernah menampilkan data palsu.',
      'Project Tree tetap navigable; tombol New sekarang membuat project cloud baru secara aman dan tidak boleh menimpa remote project lama.',
      'Perbaiki encrypted autosave fingerprint: capturedAt tidak lagi ikut hash perubahan, sehingga database tidak membuat revision baru setiap polling cycle tanpa perubahan desain.',
      'Tambah Import recovery key agar backup encryption key benar-benar bisa dipakai untuk memulihkan akses project terenkripsi di browser lain/baru.',
      'Full project snapshot export sekarang mengambil components, live nets/wires, board geometry, advanced board, professional profile, workflow dan database status dari engine state.',
      'Workspace Repair tidak lagi memblokir PCB Route/Via/Zone/Keepout atau menampilkan pesan DRC geometry unavailable setelah engine PCB nyata tersedia.',
      'Inspector ERC/DRC sekarang menjalankan checker aktual yang tersedia; PASS selalu dibatasi pada coverage checker yang sudah diimplementasikan.',
      'Extended component metadata kini dipertahankan dan divalidasi saat import: catalog key, group, pin count, kind, manufacturer, MPN, tags dan description tidak hilang.',
      'Tambah /api/health dan System Health self-test: engine presence, project tree, wire diagnostics, board model, encrypted DB, professional evidence, typed command validator, fake-value guard, server health, AI-auth status, dan runtime exception capture.',
      'Build pipeline akan dinaikkan ke strict check + unit test sebelum Vite build setelah stability pass bersih.'
    ]},
    en:{title:'Stability & Integration Pass — Placeholder Removal, Real Engine Bridges, Self-Test',changes:[
      'Raised the core workspace to v1.19.0 and replaced stale placeholder actions with bridges to the available ERC, PCB DRC, Live Circuit, Project Database, Professional Rules, Route, Via, and Zone engines.',
      'Removed fake schematic wires, fake ratsnest lines, and illustrative simulator numbers so an engine-load failure never displays fabricated engineering data.',
      'Project Tree remains navigable; New now creates a safe new cloud project without overwriting the prior remote project.',
      'Fixed encrypted autosave fingerprinting: capturedAt is excluded from change hashes, preventing database revisions on every polling cycle when the design did not change.',
      'Added recovery-key import so the encryption backup can actually restore access on a new browser.',
      'Full project snapshot export now captures components, live nets/wires, board geometry, advanced board state, professional profile, workflow, and database status from engine state.',
      'Workspace Repair no longer blocks PCB Route/Via/Zone/Keepout or reports PCB geometry DRC as unavailable after the real PCB engines are loaded.',
      'Inspector ERC/DRC now invokes the available real checkers; PASS remains explicitly limited to implemented checker coverage.',
      'Extended component metadata is preserved and validated during import: catalog key, group, pin count, kind, manufacturer, MPN, tags, and description.',
      'Added /api/health and a System Health self-test covering engine presence, Project Tree, wire diagnostics, board model, encrypted DB, professional evidence, typed command validation, fake-value guard, server health, AI authentication status, and runtime exception capture.',
      'The build pipeline will be raised to strict checks plus unit tests before Vite build once the stability pass is clean.'
    ]}
  };
  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  function inject(){
    const body=document.querySelector('#pcbpro-patch-modal .ux-modal-body');
    if(!body||body.querySelector('[data-patch-v119]'))return;
    const r=release[lang()]||release.id;
    const a=document.createElement('article');a.dataset.patchV119='1';
    a.innerHTML=`<div class="ux-patch-head"><b>v${VERSION}</b><span>2026-10-02</span></div><h3>${r.title}</h3><ul>${r.changes.map(x=>`<li>${x}</li>`).join('')}</ul>`;
    body.prepend(a);
  }
  document.addEventListener('click',e=>{if(e.target?.closest?.('.ux-patches,#pcbpro-ui-trigger'))setTimeout(inject,80)},true);
  window.PCBProPatchV119={version:VERSION,inject,release};
})();