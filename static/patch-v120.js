(() => {
  'use strict';
  if (window.PCBProPatchV120) return;
  const VERSION='1.20.0';
  const release={
    id:{title:'Manufacturing + 3D Geometry — CAM Export, Geometry Persistence, Coverage Gates',changes:[
      'PCB geometry sekarang menyimpan endpoint track, pad position, component placement dan world size supaya data tidak hilang saat pindah dari tab PCB ke Fabrikasi/3D.',
      'Tambah Manufacturing/CAM engine: Gerber RS-274X F.Cu/B.Cu/Edge.Cuts, Excellon via drill, BOM CSV, CPL CSV, ZIP tanpa dependency eksternal, SHA-256 manifest dan release classification.',
      'CAM export wajib memakai ukuran fisik board yang dimasukkan user. Canvas visual tidak pernah diam-diam dianggap sebagai ukuran mekanik.',
      'Jika physical footprint-pad geometry terverifikasi belum tersedia, package diberi kelas ENGINEERING-DRAFT-NOT-FOR-FABRICATION. Track/via known geometry tetap bisa diekspor untuk engineering review, tetapi tidak diklaim siap pabrik.',
      'Tambah interactive 3D geometry viewer yang membaca board outline, copper track, via dan component placement aktual, dengan orbit/zoom dan PNG snapshot.',
      'Component body pada 3D tetap diberi batasan sebagai placement proxy sampai STEP/body geometry terverifikasi tersedia; tidak diklaim sebagai mechanical collision sign-off.',
      'Typed Command Bus sekarang punya manufacturing.preflight, manufacturing.exportPackage, mechanical3d.open dan mechanical3d.resetView.',
      'System Health dan regression test diperluas untuk Manufacturing + 3D engine dan persisted PCB geometry.'
    ]},
    en:{title:'Manufacturing + 3D Geometry — CAM Export, Geometry Persistence, Coverage Gates',changes:[
      'PCB geometry now persists track endpoints, pad positions, component placements, and world size so geometry survives navigation away from the PCB view.',
      'Added Manufacturing/CAM engine: Gerber RS-274X F.Cu/B.Cu/Edge.Cuts, Excellon via drill, BOM CSV, CPL CSV, dependency-free ZIP, SHA-256 manifest, and release classification.',
      'CAM export requires user-supplied physical board dimensions. Visual canvas scale is never silently treated as mechanical scale.',
      'When verified physical footprint-pad geometry is unavailable, the package is classified ENGINEERING-DRAFT-NOT-FOR-FABRICATION. Known track/via geometry can still be exported for engineering review but is not claimed fabrication-ready.',
      'Added an interactive geometry-driven 3D viewer using the actual board outline, copper tracks, vias, and component placements, with orbit/zoom and PNG snapshot.',
      '3D component bodies remain placement proxies until verified STEP/body geometry is available and are not claimed as mechanical collision sign-off.',
      'Typed Command Bus now exposes manufacturing.preflight, manufacturing.exportPackage, mechanical3d.open, and mechanical3d.resetView.',
      'System Health and regression tests now cover Manufacturing + 3D engines and persisted PCB geometry.'
    ]}
  };
  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  function inject(){
    const body=document.querySelector('#pcbpro-patch-modal .ux-modal-body');
    if(!body||body.querySelector('[data-patch-v120]'))return;
    const r=release[lang()]||release.id;
    const a=document.createElement('article');a.dataset.patchV120='1';
    a.innerHTML=`<div class="ux-patch-head"><b>v${VERSION}</b><span>2026-10-02</span></div><h3>${r.title}</h3><ul>${r.changes.map(x=>`<li>${x}</li>`).join('')}</ul>`;
    body.prepend(a);
  }
  document.addEventListener('click',e=>{if(e.target?.closest?.('.ux-patches,#pcbpro-ui-trigger'))setTimeout(inject,80)},true);
  window.PCBProPatchV120={version:VERSION,inject,release};
})();