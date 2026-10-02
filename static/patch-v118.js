(() => {
  'use strict';
  if (window.PCBProPatchV118) return;
  const VERSION='1.18.0';
  const release={
    id:{title:'Professional Engineering Baseline — China EDA Benchmark + 5-Year Evidence + Patent Watch',changes:[
      'Tambah Professional Design & Evidence Center (tombol PRO) untuk audit project, Rules/DFM, SI/Timing screening, jurnal 5 tahun, patent watch, benchmark tools China, dan upgrade map.',
      'Benchmark workflow memakai dokumentasi publik EasyEDA Pro/JLCEDA Pro dan JLCPCB: browser EDA, hierarchy/reuse blocks, design-rule manager, delay/equal-length constraints, differential pair, live DRC, layer stack, auto placement/routing dengan human review, assembly variants, dan manufacturing handoff.',
      'Tambah DFM profile yang dapat dipilih: Safe Prototype, JLCPCB Conservative 1 oz, dan JLCPCB Capability Edge 1 oz. Profile menyimpan track width, clearance, via diameter/drill, edge clearance, impedance target, diff gap, dan skew budget.',
      'PCB DRC sekarang membaca minimum track width dari Professional profile. Advanced Board DRC juga membaca minimum via diameter/drill dari profile.',
      'Tambah SI/Timing screening calculator: microstrip Z0 estimate, differential rough estimate, effective dielectric, propagation delay ps/mm, dan solver lebar screening untuk target impedance. Hasil diberi label screening, bukan sign-off.',
      'Tambah Supabase evidence library khusus EDA/PCB dengan 12 seed sumber 2022–2025 yang metadata/DOI-nya diverifikasi, 7 patent-awareness records, dan 4 reference-tool records.',
      'Assistant local RAG sekarang ikut mengindeks professional evidence/patent/reference-tool context supaya reasoning tidak hanya mengandalkan model generik.',
      'Patent records dipakai untuk prior-art/freedom-to-operate awareness, bukan untuk menyalin claim proprietary. Legal status aggregator tidak diperlakukan sebagai legal opinion.',
      'Arsitektur evidence database disiapkan untuk skala 100k+ metadata DOI, tapi release ini TIDAK mengklaim sudah membaca atau memverifikasi 100.000 jurnal.',
      'P0 upgrade map dikunci: central typed domain model penuh → full geometry DRC/DFM → manufacturing exporters/CAM validation; AI ditempatkan setelah deterministic legality, bukan sebagai pengganti.'
    ]},
    en:{title:'Professional Engineering Baseline — China EDA Benchmark + 5-Year Evidence + Patent Watch',changes:[
      'Added a Professional Design & Evidence Center (PRO) covering project audit, Rules/DFM, SI/Timing screening, recent research, patent watch, Chinese-tool benchmarks, and an upgrade map.',
      'Workflow benchmarking uses public EasyEDA Pro/JLCEDA Pro and JLCPCB documentation: browser EDA, hierarchy/reuse blocks, design-rule management, delay/equal-length constraints, differential pairs, live DRC, layer stacks, auto placement/routing with human review, assembly variants, and manufacturing handoff.',
      'Added selectable DFM profiles: Safe Prototype, JLCPCB Conservative 1 oz, and JLCPCB Capability Edge 1 oz, storing track width, clearance, via diameter/drill, edge clearance, impedance targets, diff gap, and skew budget.',
      'PCB DRC now reads minimum track width from the Professional profile. Advanced Board DRC reads minimum via diameter/drill from the same profile.',
      'Added SI/Timing screening calculations for microstrip Z0, a rough differential estimate, effective dielectric constant, propagation delay, and target-impedance width solving. Results are explicitly screening, not sign-off.',
      'Added a Supabase EDA/PCB evidence library with 12 verified 2022–2025 research seed records, 7 patent-awareness records, and 4 professional reference-tool records.',
      'Assistant local RAG now indexes professional evidence/patent/reference-tool context.',
      'Patent records are used for prior-art/freedom-to-operate awareness, not to copy proprietary claims. Aggregator legal status is not treated as legal advice.',
      'The evidence database is structured to scale toward 100k+ DOI metadata records, but this release does NOT claim 100,000 papers have already been read or verified.',
      'P0 upgrade order is locked: complete typed domain model → full geometry DRC/DFM → manufacturing exporters/CAM validation; AI follows deterministic legality rather than replacing it.'
    ]}
  };
  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  function inject(){
    const body=document.querySelector('#pcbpro-patch-modal .ux-modal-body');
    if(!body||body.querySelector('[data-patch-v118]'))return;
    const r=release[lang()]||release.id;
    const a=document.createElement('article');a.dataset.patchV118='1';
    a.innerHTML=`<div class="ux-patch-head"><b>v${VERSION}</b><span>2026-10-02</span></div><h3>${r.title}</h3><ul>${r.changes.map(x=>`<li>${x}</li>`).join('')}</ul>`;
    body.prepend(a);
  }
  document.addEventListener('click',e=>{if(e.target?.closest?.('.ux-patches,#pcbpro-ui-trigger'))setTimeout(inject,80)},true);
  window.PCBProPatchV118={version:VERSION,inject,release};
})();