(() => {
  'use strict';
  if (window.PCBProPatchV113) return;
  const VERSION='1.13.0';
  const release={
    id:{title:'Explain Everything — semua fitur, hasil, status, alur, dan perubahan punya konteks',changes:[
      'Tambah Explanation Center global untuk menjelaskan apa sebuah fitur, kenapa ada, input, proses, output, cara membaca hasil, batasan, dan langkah berikutnya.',
      'Tambah Mode Jelaskan: aktifkan lalu klik elemen apa pun tanpa menjalankan aksinya untuk melihat penjelasan konteks.',
      'Tambah penjelasan dedicated untuk workspace Schematic/PCB/Simulator/3D/BOM/Fabrication, Wire, Move/Drag, Annotation, Footprint, ERC, Edge.Cuts, Placement, Routing, Layers, Ratsnest, DRC, simulation probe, fault injection, advanced analysis, Component Intelligence, Copilot, Learning Atlas, Workflow, Updates, serta status blocked/partial/unavailable.',
      'Tambah penjelasan dari awal sampai hasil dan ladder tingkat kepastian: UI state, derived project state, calculated/simulated, verified datasheet, manufacturing check, physical measurement.',
      'Tambah snapshot penjelasan untuk hasil/check/status yang sedang terlihat agar user bisa tahu angka/status itu berasal dari konteks apa.',
      'Tambah Coverage Audit. Kontrol baru yang belum punya dokumentasi dedicated tetap mendapatkan fallback yang jujur dan masuk daftar utang dokumentasi; tidak ada fungsi teknis yang dikarang.',
      'Tambah API PCBProExplain.register() dan registerChange() agar engine/fitur baru ke depan wajib bisa mendaftarkan penjelasan dan alasan perubahan.',
      'Update history tetap dipisahkan dari test/deploy evidence: catatan patch menjelaskan implementasi, bukan otomatis membuktikan runtime sukses.'
    ]},
    en:{title:'Explain Everything — context for every feature, result, status, flow, and change',changes:[
      'Added a global Explanation Center covering what a feature is, why it exists, inputs, process, output, interpretation, limitations, and next steps.',
      'Added Explain Mode: enable it and click any element without executing its action to inspect its context.',
      'Added dedicated explanations for the primary workspaces, editing/layout/check/simulation/component/assistant/learning/workflow features and major status types.',
      'Added the start-to-result flow and a confidence ladder from UI state through physical measurement.',
      'Added current-result snapshots so visible values/statuses can be interpreted with their source context.',
      'Added Coverage Audit. New undocumented controls receive an honest fallback and are listed as documentation debt; technical behavior is never invented.',
      'Added PCBProExplain.register() and registerChange() APIs so future engines can register explanations and change rationale.',
      'Patch history remains separate from test/deploy evidence: release notes explain implementation but do not by themselves prove runtime success.'
    ]}
  };
  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  function inject(){const body=document.querySelector('#pcbpro-patch-modal .ux-modal-body');if(!body||body.querySelector('[data-patch-v113]'))return;const r=release[lang()]||release.id;const a=document.createElement('article');a.dataset.patchV113='1';a.innerHTML=`<div class="ux-patch-head"><b>v${VERSION}</b><span>2026-10-02</span></div><h3>${r.title}</h3><ul>${r.changes.map(x=>`<li>${x}</li>`).join('')}</ul>`;body.prepend(a)}
  document.addEventListener('click',e=>{if(e.target?.closest?.('.ux-patches,#pcbpro-ui-trigger'))setTimeout(inject,80)},true);
  window.PCBProPatchV113={version:VERSION,inject};
})();
