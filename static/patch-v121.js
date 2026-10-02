(() => {
  'use strict';
  if (window.PCBProPatchV121) return;
  const VERSION='1.21.0';
  const release={
    id:{title:'Domain Integrity + Physical DRC — Source-of-Truth Audit dan mm-Calibrated Rules',changes:[
      'Tambah Domain Integrity engine untuk audit cross-engine antara components, schematic wires, derived nets, PCB tracks, placements, pads, vias, zones, differential pairs, rules dan manufacturing state.',
      'Integrity Audit mendeteksi duplicate ref/ID, orphan wire endpoint, pin di luar pinCount, orphan track, track yang tidak lagi cocok dengan schematic net, orphan via/zone net, placement stale, dan diff-pair stale.',
      'Repair mode hanya menghapus stale wire/track yang aman dibuktikan invalid; state lain tetap dilaporkan dan tidak dihapus diam-diam.',
      'Project fingerprint SHA-256 tersedia untuk membandingkan source-of-truth snapshot tanpa bergantung pada timestamp autosave.',
      'Tambah Physical DRC terkalibrasi mm: minimum track width, track-to-track copper clearance, via diameter, via drill, annular ring, via-to-track, via-to-via, copper-to-edge dan Edge.Cuts self-intersection.',
      'Physical DRC memakai ukuran board fisik dari Fabrikasi + rule profile Professional Center. Tanpa kalibrasi mm, hasil ditandai belum siap dan tidak dibuat-buat.',
      'Manufacturing preflight sekarang digate oleh Physical DRC selain logical/advanced DRC sehingga pelanggaran fisik memblokir CAM release.',
      'Rules workspace, Tools menu, Typed Command Bus dan System Health sekarang terhubung langsung ke Integrity Audit dan Physical DRC.'
    ]},
    en:{title:'Domain Integrity + Physical DRC — Source-of-Truth Audit and mm-Calibrated Rules',changes:[
      'Added a Domain Integrity engine that audits cross-engine state across components, schematic wires, derived nets, PCB tracks, placements, pads, vias, zones, differential pairs, rules, and manufacturing state.',
      'Integrity Audit detects duplicate refs/IDs, orphan wire endpoints, pins beyond pinCount, orphan tracks, tracks that no longer match schematic connectivity, orphan via/zone nets, stale placements, and stale diff pairs.',
      'Repair mode only removes stale wires/tracks that are provably invalid; other state is reported and never silently deleted.',
      'A SHA-256 project fingerprint is available for comparing source-of-truth snapshots without autosave timestamps.',
      'Added calibrated Physical DRC in mm: minimum track width, track-to-track copper clearance, via diameter, via drill, annular ring, via-to-track, via-to-via, copper-to-edge, and Edge.Cuts self-intersection.',
      'Physical DRC uses physical board dimensions from Fabrication plus the Professional Center rule profile. Without mm calibration, results are explicitly unresolved rather than guessed.',
      'Manufacturing preflight is now gated by Physical DRC in addition to logical/advanced DRC, so physical violations block CAM release.',
      'Rules workspace, Tools menu, Typed Command Bus, and System Health are directly connected to Integrity Audit and Physical DRC.'
    ]}
  };
  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  function inject(){
    const body=document.querySelector('#pcbpro-patch-modal .ux-modal-body');
    if(!body||body.querySelector('[data-patch-v121]'))return;
    const r=release[lang()]||release.id;
    const a=document.createElement('article');a.dataset.patchV121='1';
    a.innerHTML='<div class="ux-patch-head"><b>v'+VERSION+'</b><span>2026-10-02</span></div><h3>'+r.title+'</h3><ul>'+r.changes.map(x=>'<li>'+x+'</li>').join('')+'</ul>';
    body.prepend(a);
  }
  document.addEventListener('click',e=>{if(e.target?.closest?.('.ux-patches,#pcbpro-ui-trigger'))setTimeout(inject,80)},true);
  window.PCBProPatchV121={version:VERSION,inject,release};
})();