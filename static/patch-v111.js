(() => {
  'use strict';
  if (window.PCBProPatchV111) return;
  const VERSION='1.11.0';
  const release={
    id:{title:'Circuit Learning Atlas — 20 Lesson Core + Expanded Knowledge Tree',changes:[
      'Tambah Learning Atlas yang menjadikan 20 judul Engineering Circuit Analysis sebagai tulang punggung pembelajaran, lalu memperluasnya menjadi pohon ilmu bercabang.',
      'Cabang inti mencakup voltage/current/resistance, components, Ohm, power, KCL, KVL, analisis Kirchhoff multi-loop, dependent sources, series/parallel, voltage divider, dan current divider.',
      'Cabang lanjutan mencakup nodal, mesh, supernode/supermesh, superposition, source transformation, Thevenin/Norton, maximum power transfer, RC/RL/RLC, phasor, impedance, Bode/filter, nonlinear, small-signal, dan op-amp.',
      'Cabang field menghubungkan teori ke PCB nyata: parasitics, signal integrity, power integrity, thermal, serta fault analysis/troubleshooting.',
      'Tambah mode Atlas untuk navigasi topik, mode Project yang membaca komponen/net/wire/PCB aktual dan menyarankan topik relevan tanpa mengarang hasil solver, serta mode Referensi.',
      'Tambah Ohm + Power Quick Solver dengan engineering prefix m, µ, k, M untuk belajar sambil menghitung.',
      'Tampilan mendukung Peta Luas vs Mendalam agar materi bisa dipelajari melebar tanpa kehilangan detail konsep, rumus, latihan, dan hubungan antar-topik.'
    ]},
    en:{title:'Circuit Learning Atlas — 20 Lesson Core + Expanded Knowledge Tree',changes:[
      'Added a Learning Atlas that uses the 20 Engineering Circuit Analysis lesson titles as its backbone and expands them into a branching knowledge tree.',
      'Core branches cover voltage/current/resistance, components, Ohm, power, KCL, KVL, multi-loop Kirchhoff analysis, dependent sources, series/parallel, voltage divider, and current divider.',
      'Extended branches cover nodal, mesh, supernode/supermesh, superposition, source transformation, Thevenin/Norton, maximum power transfer, RC/RL/RLC, phasors, impedance, Bode/filter, nonlinear, small-signal, and op-amps.',
      'Field branches connect theory to real PCB concerns: parasitics, signal integrity, power integrity, thermal behavior, and fault analysis/troubleshooting.',
      'Added Atlas navigation, a Project mode that reads actual component/net/wire/PCB state and recommends relevant concepts without fabricating solver results, and a References mode.',
      'Added an Ohm + Power Quick Solver with engineering prefixes m, µ, k, M.',
      'Broad Map vs Deep mode allows wide exploration without losing concepts, formulas, practice prompts, and cross-topic connections.'
    ]}
  };
  function lang(){return window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id'}
  function inject(){
    const body=document.querySelector('#pcbpro-patch-modal .ux-modal-body');
    if(!body||body.querySelector('[data-patch-v111]'))return;
    const l=lang(),r=release[l]||release.id;
    const a=document.createElement('article');a.dataset.patchV111='1';
    a.innerHTML=`<div class="ux-patch-head"><b>v${VERSION}</b><span>2026-10-02</span></div><h3>${r.title}</h3><ul>${r.changes.map(x=>`<li>${x}</li>`).join('')}</ul>`;
    body.prepend(a);
  }
  document.addEventListener('click',e=>{if(e.target?.closest?.('.ux-patches,#pcbpro-ui-trigger'))setTimeout(inject,80)},true);
  const obs=new MutationObserver(()=>inject());obs.observe(document.documentElement,{childList:true,subtree:true});
  window.PCBProPatchV111={version:VERSION,inject};
})();