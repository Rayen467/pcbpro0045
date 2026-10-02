(() => {
  'use strict';
  if (window.PCBProPatchV116) return;
  const VERSION='1.16.0';
  const TOTAL=1484;
  const release={
    id:{title:'Universal Component Catalog — 1,000+ Parts, Audio, Raspberry Pi & Embedded',changes:[
      'Component Library diperluas dari 12 item dasar menjadi sekitar 1.484 entry yang dapat dicari dan difilter berdasarkan kategori.',
      'Catalog generator menambahkan 1.472 entry baru: 1.158 generic/parametric templates, 269 exact part identifiers, dan 45 module/board integration entries; 12 core parts lama tetap dipertahankan.',
      'Tambah kategori besar: passives, EMI/filtering, timing/clock, optoelectronics, connectors, switches/input, diodes/protection, transistors, logic, analog, audio, power management, interface/data, memory, MCU/processor, wireless/RF, sensors, display/HMI, motor/driver, Raspberry Pi, modules/boards, debug/test, sources, dan battery.',
      'Audio sekarang mencakup entry seperti LM386, NE5532, TL072, OPA2134, PAM8403, MAX98357A, TPA2016D2, TPA3116D2, TPA3255, TAS5805M, PCM5102A, WM8960, SGTL5000, audio ADC/DAC, MEMS microphone, speaker/jack, dan template audio lain.',
      'Raspberry Pi sekarang punya kategori khusus untuk Pico, Pico W, Pico 2, Pico 2 W, GPIO header keluarga Zero/3/4/5, serta carrier-interface templates untuk Compute Module.',
      'Library memakai lazy catalog load + search + category filter + Load More agar 1.000+ entry tidak langsung merender seluruh DOM dan memperberat laptop.',
      'Komponen baru membawa metadata pin-count. Wire Engine dan PCB pad engine sekarang membaca pin-count catalog sehingga part 3/14/40-pin tidak otomatis diperlakukan sebagai komponen 2/8-pin.',
      'Part dengan pin-count atau footprint yang belum dapat dipastikan tidak diberi data palsu. Entry generic tidak mengarang rating; exact-part identifier tetap membutuhkan datasheet/package verification sebelum produksi.',
      'Extended component catalog ikut masuk ke local RAG assistant, jadi pencarian komponen dapat dilakukan lokal dulu tanpa membakar token LLM.'
    ]},
    en:{title:'Universal Component Catalog — 1,000+ Parts, Audio, Raspberry Pi & Embedded',changes:[
      'Expanded the Component Library from 12 baseline items to roughly 1,484 searchable, category-filterable entries.',
      'The catalog generator adds 1,472 entries: 1,158 generic/parametric templates, 269 exact part identifiers, and 45 module/board integration entries, while preserving the 12 core parts.',
      'Added broad categories across passives, filtering, timing, optoelectronics, connectors, switches, protection, transistors, logic, analog, audio, power, interfaces, memory, MCUs, wireless, sensors, displays, motors, Raspberry Pi, modules, debug/test, sources, and batteries.',
      'Audio now includes common amplifier, codec, ADC/DAC, MEMS microphone, connector/transducer, and module families.',
      'Raspberry Pi now has a dedicated category covering Pico-family boards, 40-pin GPIO integration templates, and Compute Module carrier-interface templates.',
      'The library uses lazy catalog loading, search, category filtering, and Load More so 1,000+ entries are not all rendered into the DOM at once.',
      'New parts carry pin-count metadata. The schematic Wire Engine and PCB pad engine now honor catalog pin counts instead of forcing complex parts into 2/8-pin assumptions.',
      'Unknown pin counts, footprints, and electrical ratings are not fabricated. Generic templates do not imply verified ratings; exact IDs still require datasheet/package verification.',
      'The extended component catalog is indexed by the assistant local RAG so component lookup can happen locally before spending LLM tokens.'
    ]}
  };

  const explainEntry={
    id:'feature.universal-component-catalog-v116',
    match:['component library','component catalog','raspberry pi','audio component','1000 components'],
    category:'component-data',
    status:'active-expanded-catalog',
    title:{id:'Universal Component Catalog',en:'Universal Component Catalog'},
    what:{id:'Catalog komponen luas untuk schematic/PCB yang menggabungkan generic parametric templates, common exact-part identifiers, dan module/board integration templates.',en:'Broad schematic/PCB component catalog combining generic parametric templates, common exact-part identifiers, and module/board integration templates.'},
    why:{id:'Supaya PCB Pro tidak berhenti pada belasan komponen dasar dan bisa dipakai untuk rangkaian analog, digital, audio, embedded, sensor, power, Raspberry Pi, dan modul umum.',en:'So PCB Pro is not limited to a dozen basic parts and can cover analog, digital, audio, embedded, sensor, power, Raspberry Pi, and common module work.'},
    input:{id:'Search text, category, value/package template, MPN atau module name.',en:'Search text, category, value/package template, MPN, or module name.'},
    process:{id:'Catalog dibuat secara parametric untuk family yang aman digenerasikan, lalu ditambah daftar common exact identifiers/modules. UI hanya merender subset hasil dan Load More untuk menjaga performa.',en:'Safe parametric families are generated programmatically, then common exact identifiers/modules are added. The UI renders only a subset plus Load More to preserve performance.'},
    output:{id:'Entry yang bisa ditempatkan ke project beserta group, value, footprint bila diketahui, pin-count metadata, kind, MPN/tags, dan description.',en:'Placeable project entries carrying group, value, known footprint, pin-count metadata, kind, MPN/tags, and description.'},
    how_to_read:{id:'template = generic design template; exact-id = identitas part/family yang tetap butuh verifikasi datasheet; module = integration-level board/module template.',en:'template = generic design template; exact-id = a part/family identifier that still requires datasheet verification; module = integration-level board/module template.'},
    limits:{id:'Tidak mungkin mengklaim semua komponen elektronik di dunia tersedia. v1.16 menyediakan 1.000+ baseline yang luas; suffix package, vendor variant, ratings, pinout kompleks, model SPICE/IBIS, dan footprint produksi harus tetap diverifikasi untuk exact part.',en:'It is not realistic to claim every electronic component in existence is present. v1.16 provides a broad 1,000+ baseline; package suffixes, vendor variants, ratings, complex pinouts, SPICE/IBIS models, and production footprints still require exact-part verification.'},
    next:{id:'Berikutnya catalog bisa dinaikkan ke source vendor/KiCad terindeks, exact symbol-pin names, package variants, dan model simulation provenance tanpa mengorbankan performa.',en:'Next, the catalog can expand into indexed vendor/KiCad sources, exact symbol pin names, package variants, and simulation-model provenance without sacrificing performance.'}
  };

  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  function inject(){
    const body=document.querySelector('#pcbpro-patch-modal .ux-modal-body');
    if(!body||body.querySelector('[data-patch-v116]'))return;
    const r=release[lang()]||release.id;
    const a=document.createElement('article');
    a.dataset.patchV116='1';
    a.innerHTML=`<div class="ux-patch-head"><b>v${VERSION}</b><span>2026-10-02</span></div><h3>${r.title}</h3><ul>${r.changes.map(x=>`<li>${x}</li>`).join('')}</ul>`;
    body.prepend(a);
  }
  function registerExplanation(){window.PCBProExplain?.register?.(explainEntry)}
  document.addEventListener('click',e=>{if(e.target?.closest?.('.ux-patches,#pcbpro-ui-trigger'))setTimeout(inject,80)},true);
  window.addEventListener('pcbpro:explain-ready',registerExplanation,{once:true});
  setTimeout(registerExplanation,0);
  window.PCBProPatchV116={version:VERSION,inject,release,total:TOTAL};
})();