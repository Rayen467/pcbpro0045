(() => {
  'use strict';
  if (window.PCBProPatchV123) return;
  const VERSION='1.23.0';
  const release={
    id:{title:'Explain + Auto Route + Live AI Status + Silabus Profesional 2026–2027',changes:[
      'Tambah bantuan langsung untuk fitur: hover menampilkan fungsi dan cara pakai; tombol ? Fungsi & Error membuka katalog fitur dan kamus error engineering yang dapat dicari.',
      'Error AI, integrity, Physical DRC dan manufacturing sekarang punya arti, penyebab umum dan tindakan perbaikan; software engineer tidak harus menebak arti kode.',
      'Tambah Auto Route preview-first dari netlist/pad geometry aktual dengan scope all/satu net, pilihan 1 atau 2 copper layer, strategy speed/completion, width dan detour grid.',
      'Auto Route tidak mengubah board sampai user menekan Apply. Setelah Apply, routing tetap harus melewati DRC/review.',
      'Batas autorouter dijelaskan eksplisit: v1.23 memilih satu layer per koneksi dan belum melakukan mid-route via/layer switching atau inner-layer production routing.',
      'Tambah endpoint status AI Gateway, indikator AI ✓ OIDC/KEY atau AI ✕ error di assistant, dan Tes AI nyata yang memaksa request LLM agar jawaban LOCAL tidak disangka sebagai model.',
      'Assistant Brain tetap memakai local tool/RAG untuk query murah, tetapi sekarang punya forced LLM path untuk diagnosis koneksi provider.',
      'Tambah Silabus Profesional PCB 2026–2027: foundation, schematic/library, stackup/placement/constraints, routing/autorouting, SI/PI/EMC, DFM/PCBA/CAM, bring-up/validation, EDA automation/AI, capstone dan career map.',
      'Silabus profesional digabung ke Learning Atlas dan diindeks oleh RAG assistant sehingga materi teori dan workflow kerja dapat dipanggil saat project aktif.'
    ]},
    en:{title:'Explain + Auto Route + Live AI Status + Professional Syllabus 2026–2027',changes:[
      'Added immediate feature help: hover shows purpose and usage; ? Features & Errors opens a searchable feature catalog and engineering error dictionary.',
      'AI, integrity, Physical DRC, and manufacturing errors now expose meaning, common causes, and fixes instead of forcing software engineers to guess codes.',
      'Added preview-first Auto Route from the actual netlist/pad geometry with all/one-net scope, 1 or 2 copper layers, speed/completion strategy, width, and detour grid.',
      'Auto Route does not mutate the board until Apply is pressed. Applied routing must still pass DRC and human review.',
      'Autorouter limits are explicit: v1.23 selects one layer per connection and does not yet perform mid-route via/layer switching or production inner-layer routing.',
      'Added AI Gateway status endpoint, AI ✓ OIDC/KEY or AI ✕ error indicator in the assistant, and a Real AI test that forces an LLM request so LOCAL responses are not mistaken for model output.',
      'Assistant Brain still prefers local tools/RAG for cheap deterministic queries but now has a forced LLM path for provider diagnosis.',
      'Added Professional PCB Syllabus 2026–2027 covering foundations, schematic/library, stackup/placement/constraints, routing/autorouting, SI/PI/EMC, DFM/PCBA/CAM, bring-up/validation, EDA automation/AI, capstone, and career mapping.',
      'Professional syllabus branches merge into Learning Atlas and are indexed by assistant RAG so theory and job workflow are available in active-project context.'
    ]}
  };
  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  function inject(){
    const body=document.querySelector('#pcbpro-patch-modal .ux-modal-body');
    if(!body||body.querySelector('[data-patch-v123]'))return;
    const r=release[lang()]||release.id;
    const a=document.createElement('article');a.dataset.patchV123='1';
    a.innerHTML='<div class="ux-patch-head"><b>v'+VERSION+'</b><span>2026-10-04</span></div><h3>'+r.title+'</h3><ul>'+r.changes.map(x=>'<li>'+x+'</li>').join('')+'</ul>';
    body.prepend(a);
  }
  document.addEventListener('click',e=>{if(e.target?.closest?.('.ux-patches,#pcbpro-ui-trigger'))setTimeout(inject,80)},true);
  window.PCBProPatchV123={version:VERSION,inject,release};
})();