(() => {
  'use strict';
  if (window.PCBProHelp) return;

  const VERSION='1.23.0';
  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  const t=(id,en)=>lang()==='id'?id:en;
  const norm=v=>String(v??'').toLowerCase().replace(/[↖✥⌁◉▶◇▱✓✕•·]/g,' ').replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  const FEATURES=[
    ['Schematic','editor','Menyusun hubungan elektrik antar komponen sebelum layout PCB.','Place components, wire exact pins, assign values/footprints, then run ERC.'],
    ['PCB','editor','Mengubah netlist schematic menjadi placement dan jalur copper pada board.','Place footprints, define Edge.Cuts, route nets, add vias/zones, then DRC.'],
    ['Simulator','analysis','Menganalisis model rangkaian yang didukung dari netlist aktif.','Use for supported DC operating-point analysis; unsupported devices must be reported.'],
    ['3D','mechanical','Memvisualisasikan geometri board dan placement yang tersedia.','Use for board geometry review; proxy bodies are not mechanical sign-off.'],
    ['BOM','manufacturing','Daftar komponen proyek untuk procurement dan assembly.','Review ref, value, footprint, MPN/vendor, then export BOM.'],
    ['Fabrication','manufacturing','Preflight dan pembuatan paket CAM dari geometri yang tervalidasi.','Set physical dimensions, run DRC/preflight, then generate CAM outputs.'],
    ['Rules','verification','Mengatur constraint dan menjalankan pemeriksaan desain.','Set clearance/width/via rules before routing and manufacturing preflight.'],
    ['Release','release','Mencatat versi desain dan paket yang siap direview/release.','Use after checks are clean and design evidence is captured.'],

    ['Select','tool','Memilih objek untuk inspeksi, edit, move, rotate, atau delete.','Click an object; use inspector for exact properties.'],
    ['Place','tool','Menempatkan komponen dari library ke canvas.','Choose a library part, then place it on schematic/PCB.'],
    ['Wire','tool','Menyambungkan pin schematic dan membentuk net.','Click source pin, optional corners, then destination pin.'],
    ['Bus','tool','Mengelompokkan beberapa sinyal secara visual/logis.','Use for repeated signal groups; individual nets still need valid connectivity.'],
    ['Net label','tool','Memberi nama net supaya koneksi mudah dibaca dan direferensikan.','Use stable names such as VCC, GND, SDA, CLK.'],
    ['Junction','tool','Menandai titik sambungan elektrik pada cabang wire.','Use only when wires are intended to be electrically joined.'],
    ['No connect','tool','Menandai pin sengaja dibiarkan tidak terhubung.','Use to distinguish intentional NC from accidental floating pins.'],
    ['Power','tool','Menempatkan reference/power symbol pada schematic.','Use for supply rails and reference nodes such as GND.'],
    ['Pan','navigation','Menggeser viewport tanpa mengubah objek desain.','Drag canvas while Pan is active.'],
    ['Measure','inspection','Mengukur jarak/geometri tanpa memodifikasi desain.','Use to inspect spacing; manufacturing checks still use calibrated physical rules.'],
    ['Annotate','tool','Merapikan reference designator seperti R1, R2, C1.','Run before footprint assignment and release.'],

    ['Route','pcb-tool','Menggambar copper track mengikuti konektivitas net schematic.','Start from a pad; route only to a pad on the same net.'],
    ['Auto Route','pcb-tool','Membuat preview routing otomatis untuk koneksi yang belum diroute.','Choose scope/layers, preview first, then apply; always review DRC afterward.'],
    ['Via','pcb-tool','Membuat koneksi tembus antar copper layer.','Use when changing copper layer; drill/diameter must satisfy rules.'],
    ['Zone','pcb-tool','Membuat copper pour/plane untuk net tertentu.','Commonly used for GND/power; refill and DRC after edits.'],
    ['Keepout','pcb-tool','Melarang copper/placement pada area tertentu.','Use around antennas, mounting, creepage, mechanical or RF-sensitive regions.'],
    ['Dimension','pcb-tool','Mendokumentasikan ukuran board/fit mekanik.','Use with physical units; visual canvas scale alone is not a manufacturing dimension.'],
    ['Tune','pcb-tool','Menyesuaikan panjang jalur untuk timing/skew constraints.','Use only when target length/skew is defined.'],
    ['Layer swap','pcb-tool','Mengubah layer routing aktif.','Layer changes may require vias depending on pad/stack geometry.'],
    ['Ratsnest','pcb-tool','Menampilkan koneksi net yang belum diroute.','Each ratline represents remaining logical connectivity, not copper.'],

    ['Run','simulation','Menjalankan solver pada model yang didukung.','Read coverage and unsupported-device warnings before trusting a result.'],
    ['Stop','simulation','Menghentikan update solver.','Stops simulation updates without changing the design.'],
    ['Probe','simulation','Memilih node/device untuk melihat hasil solver.','Probe results are simulated values, not physical measurements.'],
    ['Cursor A','simulation','Cursor pengukuran pertama pada waveform/scope.','Use with Cursor B for delta measurements when waveform support exists.'],
    ['Cursor B','simulation','Cursor pengukuran kedua pada waveform/scope.','Use with Cursor A for delta measurements when waveform support exists.'],
    ['Trace','simulation','Memilih sinyal yang ditampilkan.','Only signals produced by the active solver/model are valid traces.'],

    ['Orbit','3d-tool','Memutar kamera 3D di sekitar board.','Drag the 3D viewer to inspect board geometry.'],
    ['Zoom','3d-tool','Memperbesar atau memperkecil tampilan 3D.','Changes view only, not board dimensions.'],
    ['Section','3d-tool','Konsep potongan mekanik untuk inspeksi internal.','Unavailable until verified mechanical body/section geometry exists.'],
    ['Explode','3d-tool','Memisahkan assembly secara visual untuk inspeksi.','Unavailable until verified component body models exist.'],
    ['Reset','3d-tool','Mengembalikan kamera 3D ke posisi awal.','Use when orbit/pan/zoom makes the model hard to inspect.'],

    ['Refresh','bom-tool','Membaca ulang komponen proyek ke BOM.','Use after component/value/footprint changes.'],
    ['Group','bom-tool','Mengelompokkan item BOM yang identik.','Group only parts with compatible value/footprint/MPN policy.'],
    ['MPN','bom-tool','Menampilkan/menilai Manufacturer Part Number.','Exact ratings require exact MPN/vendor evidence.'],
    ['Supplier','bom-tool','Mengaitkan sumber pengadaan komponen.','Supplier availability is procurement data, not electrical equivalence.'],
    ['Cost','bom-tool','Menghitung estimasi biaya BOM.','Pricing changes over time; treat estimates as dated data.'],
    ['Export CSV','bom-tool','Mengekspor BOM dalam format CSV.','Review MPN and quantity before procurement.'],

    ['Preflight','fab-tool','Menjalankan pemeriksaan sebelum membuat output manufaktur.','Resolve ERC/DRC/integrity and physical-dimension blockers first.'],
    ['Gerber','fab-tool','Mengekspor layer artwork PCB ke format Gerber.','Only release files whose geometry coverage is explicitly production-ready.'],
    ['Drill','fab-tool','Mengekspor data lubang/via untuk proses drilling.','Check finished-hole/drill rules and plated/non-plated intent.'],
    ['Pick & Place','fab-tool','Mengekspor koordinat placement untuk assembly.','Check side, rotation, origin and footprint centroid.'],
    ['Assembly','fab-tool','Membuat paket BOM + placement untuk proses PCBA.','Use together with drawings and validated component data.'],
    ['Archive','fab-tool','Membuat paket release yang dapat dilacak.','Keep manifest/checksums/revision with manufacturing files.'],

    ['Electrical','rule-tool','Membuka/check aturan elektrik dan ERC.','Use to find missing references, floating pins and connectivity issues.'],
    ['Clearance','rule-tool','Jarak minimum antar copper objek.','Set from fabricator capability and voltage/safety requirements.'],
    ['Track width','rule-tool','Lebar minimum/target copper track.','Choose from current, impedance and fabricator constraints.'],
    ['Differential','rule-tool','Constraint pasangan diferensial.','Define pair, impedance/skew targets before routing.'],
    ['Mask','rule-tool','Aturan solder-mask opening/expansion.','Tie to fabrication process and pad technology.'],
    ['Silkscreen','rule-tool','Aturan teks/marking board.','Keep text readable and away from exposed pads.'],

    ['Snapshot','release-tool','Menyimpan snapshot state desain untuk review.','Use before comparison/tag/release.'],
    ['Compare','release-tool','Membandingkan perubahan antar snapshot/revision.','Review connectivity, geometry and rule changes separately.'],
    ['Tag','release-tool','Memberi label revision/milestone.','Use stable revision naming for manufacturing traceability.'],
    ['Notes','release-tool','Menyimpan catatan engineering/release.','Record assumptions, unresolved risks and validation evidence.'],
    ['Package','release-tool','Menyusun artefak release menjadi satu paket.','Package only after required checks have passed.'],

    ['DRC','check','Design Rules Check untuk geometri PCB dan constraint fisik yang sudah diimplementasikan.','A clean DRC means implemented checks passed, not that every manufacturing risk is proven.'],
    ['ERC','check','Electrical Rules Check pada schematic/netlist.','Use before transferring intent into PCB layout.'],
    ['Edge.Cuts','pcb-tool','Outline mekanik board yang dipakai fabrication.','Outline must be valid/closed and calibrated before release.'],
    ['Diff Pair','pcb-tool','Mendefinisikan dua net sebagai pasangan diferensial.','Use with target impedance/skew and consistent reference plane.'],
    ['Stack','pcb-tool','Mengatur urutan copper/dielectric layer.','Stackup drives impedance, return paths, thickness and fabrication cost.'],
    ['Adv DRC','check','Pemeriksaan tambahan untuk via/zone/keepout/diff-pair coverage.','Run together with Physical DRC and manufacturing preflight.'],

    ['Baru','project','Membuat project baru tanpa menimpa project cloud sebelumnya.','Save/export the current project first if needed.'],
    ['Simpan','project','Menyimpan state project aktif.','Confirm the save state/revision indicator after use.'],
    ['Import layout','project','Mengimpor snapshot/layout yang didukung.','Imported data is validated before becoming project state.'],
    ['Export layout','project','Mengekspor snapshot desain, bukan otomatis file pabrik.','Use Fabrication for Gerber/drill outputs.'],
    ['Simulate','simulation','Shortcut untuk membuka/menjalankan simulator.','Simulation requires valid supported connectivity.'],
    ['Workflow','workflow','Menunjukkan tahapan schematic sampai manufacturing.','Use it to see blockers and the next engineering step.'],
    ['Layout Fleksibel','ui','Mengatur ruang Library/Canvas/Inspector.','UI layout changes do not alter engineering data.'],
    ['Belajar','learning','Membuka Learning Atlas dan syllabus engineering.','Use project-aware learning to connect theory with the active design.'],
    ['Penjelasan','help','Membuka Explanation Center untuk fungsi, input, output, batasan dan langkah berikutnya.','Use Explain Mode then click any UI item.'],
    ['HEALTH','diagnostic','Menjalankan self-test runtime dan engine availability.','A HEALTH failure is a software/runtime issue, not automatically an electrical design error.'],
    ['PRO','professional','Membuka rule/evidence center untuk engineering constraints.','Use before DRC, SI/PI review and manufacturing release.'],
    ['UI','ui','Membuka pengaturan bahasa, skala, comfort dan patch notes.','UI settings do not alter the project design.']
  ];

  const ERRORS={
    AI_AUTH_MISSING:{severity:'blocker',meaning:'Server tidak menemukan AI_GATEWAY_API_KEY maupun VERCEL_OIDC_TOKEN.',cause:'AI Gateway authentication belum tersedia pada runtime.',fix:'Di Vercel production, OIDC seharusnya otomatis. Jika status tetap ini, cek project linkage/AI Gateway atau pasang AI_GATEWAY_API_KEY server-side.'},
    AI_GATEWAY_AUTH_FAILED:{severity:'blocker',meaning:'Credential ada tetapi ditolak AI Gateway.',cause:'Token invalid/expired, gateway access, billing/credits, atau project/team mismatch.',fix:'Cek status AI Gateway dan credential server-side. Jangan taruh key di frontend.'},
    AI_GATEWAY_UNREACHABLE:{severity:'error',meaning:'Backend gagal menjangkau AI Gateway.',cause:'Network/provider outage atau request backend gagal.',fix:'Retry lalu lihat status provider; local RAG tetap boleh dipakai sebagai fallback.'},
    AI_GATEWAY_ERROR:{severity:'error',meaning:'AI Gateway mengembalikan HTTP error saat inference.',cause:'Model/provider/credits/request payload.',fix:'Lihat message/status, lalu gunakan model fallback atau perbaiki provider configuration.'},
    AI_EMPTY:{severity:'error',meaning:'Model merespons tanpa text yang bisa dipakai.',cause:'Provider response tidak berisi content.',fix:'Retry/fallback model; jangan anggap aksi project berhasil.'},
    AI_REQUEST_FAILED:{severity:'error',meaning:'Request inference gagal sebelum mendapat jawaban valid.',cause:'Network/runtime exception.',fix:'Cek provider status dan backend logs.'},

    DUPLICATE_COMPONENT_REF:{severity:'error',meaning:'Dua komponen memakai RefDes yang sama.',cause:'Annotasi/reference duplikat.',fix:'Jalankan Annotate atau ubah RefDes sampai unik.'},
    ORPHAN_WIRE_ENDPOINT:{severity:'error',meaning:'Wire menunjuk pin/komponen yang sudah tidak ada.',cause:'Komponen/pin dihapus atau data lama tidak sinkron.',fix:'Integrity Repair dapat menghapus stale wire yang terbukti invalid.'},
    WIRE_PIN_RANGE:{severity:'error',meaning:'Wire menunjuk nomor pin di luar pinCount komponen.',cause:'Symbol/pin metadata tidak cocok.',fix:'Periksa symbol/pinCount dan sambungkan ke pin valid.'},
    TRACK_NET_MISMATCH:{severity:'error',meaning:'Track PCB tidak lagi sesuai connectivity schematic.',cause:'Schematic berubah setelah routing.',fix:'Reroute/delete stale track setelah review perubahan net.'},
    ORPHAN_TRACK_ENDPOINT:{severity:'error',meaning:'Track menunjuk pad/component endpoint yang hilang.',cause:'Placement/footprint berubah atau komponen dihapus.',fix:'Hapus/reroute track setelah sync PCB.'},
    ORPHAN_VIA_NET:{severity:'error',meaning:'Via masih membawa nama net yang tidak ada.',cause:'Net schematic dihapus/rename.',fix:'Assign ke net valid atau hapus via.'},
    ORPHAN_ZONE_NET:{severity:'error',meaning:'Copper zone mengacu ke net yang tidak ada.',cause:'Net dihapus/rename.',fix:'Pilih net valid dan refill zone.'},

    PHYSICAL_SCALE:{severity:'blocker',meaning:'Physical DRC tidak punya skala mm.',cause:'Lebar/tinggi board fisik belum diisi di Fabrication.',fix:'Isi physical board width/height lalu jalankan ulang Physical DRC.'},
    TRACK_WIDTH:{severity:'error',meaning:'Track lebih sempit dari minimum rule.',cause:'Width route di bawah constraint.',fix:'Perbesar width atau ubah rule hanya jika fabricator/current analysis membenarkan.'},
    TRACK_CLEARANCE:{severity:'error',meaning:'Copper dua net terlalu dekat.',cause:'Routing melanggar minimum clearance.',fix:'Reroute atau pindahkan copper sampai clearance memenuhi rule.'},
    TRACK_EDGE_CLEARANCE:{severity:'error',meaning:'Track terlalu dekat Edge.Cuts.',cause:'Copper-to-edge di bawah rule.',fix:'Geser track/outline atau sesuaikan rule berdasarkan fabricator.'},
    VIA_DIAMETER:{severity:'error',meaning:'Diameter via di bawah minimum rule.',cause:'Via terlalu kecil.',fix:'Perbesar via diameter.'},
    VIA_DRILL:{severity:'error',meaning:'Drill via di bawah minimum rule.',cause:'Hole terlalu kecil untuk capability yang dipilih.',fix:'Perbesar drill atau pilih process/fabricator yang mendukung.'},
    ANNULAR_RING:{severity:'error',meaning:'Sisa copper ring di sekitar drill terlalu kecil.',cause:'Diameter via dan drill tidak memberi annular ring cukup.',fix:'Perbesar via atau kecilkan drill sesuai capability.'},
    VIA_TRACK_CLEARANCE:{severity:'error',meaning:'Via dan track beda net terlalu dekat.',cause:'Routing/via placement melanggar clearance.',fix:'Pindahkan via/track.'},
    VIA_CLEARANCE:{severity:'error',meaning:'Dua via beda net terlalu dekat.',cause:'Via spacing melanggar rule.',fix:'Pisahkan via.'},
    OUTLINE_SELF_INTERSECTION:{severity:'error',meaning:'Edge.Cuts berpotongan dengan dirinya sendiri.',cause:'Outline tidak membentuk boundary mekanik valid.',fix:'Edit outline menjadi loop tertutup tanpa self-intersection.'},

    OUTLINE:{severity:'blocker',meaning:'Manufacturing preflight belum punya Edge.Cuts valid.',cause:'Outline kurang titik/tidak valid.',fix:'Buat dan periksa Edge.Cuts.'},
    DIMENSIONS:{severity:'blocker',meaning:'Ukuran fisik board belum ditentukan.',cause:'Canvas visual belum dikalibrasi ke mm.',fix:'Isi width/height fisik di Fabrication.'},
    TRACK_GEOMETRY:{severity:'blocker',meaning:'Track belum punya endpoint geometri yang dapat diekspor.',cause:'Geometry capture belum lengkap.',fix:'Buka PCB, refresh geometry, lalu preflight ulang.'},
    PAD_GEOMETRY:{severity:'warning',meaning:'Physical footprint-pad geometry belum terverifikasi lengkap.',cause:'Pad-stack provider belum memberi semua pad.',fix:'Jangan release ke pabrik sampai pad geometry coverage lengkap.'},
    PHYSICAL_DRC:{severity:'blocker',meaning:'Physical DRC masih punya pelanggaran.',cause:'Width/clearance/via/edge rule gagal.',fix:'Buka Physical DRC, perbaiki findings, lalu preflight ulang.'}
  };

  const featureObjects=FEATURES.map(([label,category,what,use])=>({id:'help.'+norm(label+'-'+category).replace(/[^a-z0-9]+/g,'-'),label,category,what,use}));
  const byLabel=new Map();
  for(const x of featureObjects)byLabel.set(norm(x.label),x);

  function featureRow(label,category){
    return featureObjects.find(x=>norm(x.label)===norm(label)&&x.category===category)||null;
  }
  function matchFeature(el){
    const raw=el?.dataset?.pcbTool||el?.dataset?.pcbView||el?.querySelector?.('small')?.textContent||el?.textContent||el?.getAttribute?.('aria-label')||el?.getAttribute?.('title')||'';
    const key=norm(raw);
    const active=norm(document.querySelector('.tabs button.active')?.dataset?.pcbView||document.querySelector('.tabs button.active')?.textContent||'');
    if(key==='via'){
      if(active==='rules')return featureRow('Via','rule-tool');
      if(active==='pcb')return featureRow('Via','pcb-tool');
    }
    if(byLabel.has(key))return byLabel.get(key);
    for(const [k,v] of byLabel){if(k.length>2&&(key===k||key.startsWith(k+' ')||key.includes(' '+k+' ')))return v}
    return null;
  }

  function registerExplain(){
    const api=window.PCBProExplain;if(!api?.register)return;
    for(const x of featureObjects)api.register({
      id:x.id,match:[x.label],category:x.category,status:'documented',
      title:{id:x.label,en:x.label},
      what:{id:x.what,en:x.what},
      why:{id:x.use,en:x.use},
      input:{id:'Input berasal dari project state, pilihan tool, parameter user, atau object yang sedang dipilih.',en:'Input comes from project state, tool selection, user parameters, or the selected object.'},
      process:{id:'PCB Pro hanya menjalankan engine yang benar-benar tersedia untuk fitur ini; fitur yang belum punya engine harus ditandai unavailable.',en:'PCB Pro only runs engines actually available for this feature; missing engines must be marked unavailable.'},
      output:{id:'Hasil dapat berupa perubahan project state, inspection result, check finding, atau file export tergantung fitur.',en:'Output can be project-state changes, inspection results, check findings, or exported files depending on the feature.'},
      how_to_read:{id:'Bedakan UI state, derived/calculated result, verified data, manufacturing check, dan physical measurement.',en:'Distinguish UI state, derived/calculated results, verified data, manufacturing checks, and physical measurements.'},
      limits:{id:'Jangan anggap PASS/preview sebagai bukti di luar coverage engine yang disebutkan.',en:'Do not treat PASS/preview as proof beyond the stated engine coverage.'},
      next:{id:x.use,en:x.use}
    });
  }

  function tooltipHtml(x){
    return '<b>'+esc(x.label)+'</b><p>'+esc(x.what)+'</p><small>'+esc(x.use)+'</small>';
  }

  function installStyles(){
    if(document.querySelector('#pcbpro-help-v123-style'))return;
    const s=document.createElement('style');s.id='pcbpro-help-v123-style';s.textContent=`
      #pcbpro-help-trigger{border:1px solid #395867;background:#10222c;color:#cfe1e8;border-radius:8px;padding:7px 9px;font:900 8px ui-monospace;white-space:nowrap}
      #pcbpro-quick-help{position:fixed;z-index:2990;width:min(310px,calc(100vw - 24px));pointer-events:none;border:1px solid #38505d;background:#07151df5;color:#dce9ee;border-radius:9px;padding:9px;box-shadow:0 16px 55px #000c}
      #pcbpro-quick-help b{font-size:10px;color:#64d7be}#pcbpro-quick-help p{margin:5px 0;color:#c2d0d6;font-size:9px;line-height:1.45}#pcbpro-quick-help small{color:#8198a3;font-size:8px;line-height:1.45}
      #pcbpro-help-modal{position:fixed;z-index:3000;inset:0;background:#000c;display:grid;place-items:center;padding:14px}.ph-shell{width:min(1050px,97vw);height:min(820px,94vh);display:grid;grid-template-rows:auto auto 1fr;border:1px solid #36515e;background:#07131b;color:#dce8ed;border-radius:14px;overflow:hidden;box-shadow:0 28px 100px #000e}.ph-head{display:flex;align-items:center;gap:8px;padding:11px;border-bottom:1px solid #203742}.ph-head div{flex:1}.ph-head small{font:900 8px ui-monospace;color:#62d8bf}.ph-head h3{margin:3px 0}.ph-head button,.ph-tabs button{border:1px solid #304d5b;background:#10222c;color:#cddce2;border-radius:7px;padding:7px 9px;font-weight:800}.ph-tabs{display:flex;gap:6px;padding:8px 10px;border-bottom:1px solid #203742}.ph-tabs input{flex:1;border:1px solid #2d4754;background:#08141c;color:#dce8ed;border-radius:7px;padding:8px}.ph-body{overflow:auto;padding:12px}.ph-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ph-card{border:1px solid #223b47;background:#0b1922;border-radius:9px;padding:10px}.ph-card b{font-size:10px}.ph-card em{font:800 7px ui-monospace;color:#62d8bf}.ph-card p{font-size:9px;line-height:1.5;color:#9fb2bb;margin:6px 0}.ph-card small{font-size:8px;color:#718994}.ph-error{border-left:3px solid #d8aa55}.ph-error.error,.ph-error.blocker{border-left-color:#dd7662}
      @media(max-width:700px){.ph-grid{grid-template-columns:1fr}.ph-shell{height:100dvh;width:100vw;border-radius:0}}
    `;document.head.appendChild(s)
  }

  function scan(){
    const els=[...document.querySelectorAll('button,select,input,[role="button"],[data-pcb-view],[data-pcb-tool]')];
    for(const el of els){
      if(el.closest?.('#pcbpro-help-modal,#pcbpro-explain-drawer'))continue;
      const x=matchFeature(el);if(!x)continue;
      el.dataset.engineeringHelp=x.id;el.dataset.explainKey=x.id;
      const tip=x.label+' — '+x.what+' '+x.use;
      el.title=tip;
      el.setAttribute('aria-label',tip);
    }
  }

  function showTip(el,e){
    const x=matchFeature(el);if(!x)return;
    document.querySelector('#pcbpro-quick-help')?.remove();
    const q=document.createElement('div');q.id='pcbpro-quick-help';q.innerHTML=tooltipHtml(x);document.body.appendChild(q);
    const r=el.getBoundingClientRect(),w=q.offsetWidth,h=q.offsetHeight;
    q.style.left=Math.max(8,Math.min(innerWidth-w-8,r.left))+'px';
    q.style.top=(r.bottom+h+8<innerHeight?r.bottom+6:Math.max(8,r.top-h-6))+'px';
  }
  function hideTip(){document.querySelector('#pcbpro-quick-help')?.remove()}

  function renderModal(tab='features',query=''){
    const body=document.querySelector('#pcbpro-help-modal .ph-body');if(!body)return;
    const q=norm(query);
    if(tab==='errors'){
      const rows=Object.entries(ERRORS).filter(([code,x])=>!q||norm(code+' '+x.meaning+' '+x.cause+' '+x.fix).includes(q));
      body.innerHTML='<div class="ph-grid">'+rows.map(([code,x])=>'<article class="ph-card ph-error '+esc(x.severity)+'"><em>'+esc(x.severity.toUpperCase())+'</em><b style="display:block;margin-top:4px">'+esc(code)+'</b><p><strong>'+t('Arti:','Meaning:')+'</strong> '+esc(x.meaning)+'</p><p><strong>'+t('Penyebab umum:','Common cause:')+'</strong> '+esc(x.cause)+'</p><small><strong>'+t('Perbaikan:','Fix:')+'</strong> '+esc(x.fix)+'</small></article>').join('')+'</div>';
    }else{
      const rows=featureObjects.filter(x=>!q||norm(x.label+' '+x.what+' '+x.use).includes(q));
      body.innerHTML='<div class="ph-grid">'+rows.map(x=>'<article class="ph-card"><em>'+esc(x.category.toUpperCase())+'</em><b style="display:block;margin-top:4px">'+esc(x.label)+'</b><p>'+esc(x.what)+'</p><small>'+esc(x.use)+'</small></article>').join('')+'</div>';
    }
  }

  function open(tab='features'){
    document.querySelector('#pcbpro-help-modal')?.remove();installStyles();
    const m=document.createElement('div');m.id='pcbpro-help-modal';
    m.innerHTML='<section class="ph-shell"><header class="ph-head"><div><small>PCB PRO · FUNCTION + ERROR GUIDE v'+VERSION+'</small><h3>'+t('Fungsi fitur & arti error','Feature functions & error meanings')+'</h3></div><button data-close>×</button></header><nav class="ph-tabs"><button data-tab="features">'+t('Fitur','Features')+'</button><button data-tab="errors">'+t('Error Codes','Error Codes')+'</button><input data-search placeholder="'+t('Cari fitur / error…','Search feature / error…')+'"></nav><main class="ph-body"></main></section>';
    document.body.appendChild(m);let active=tab;
    const search=m.querySelector('[data-search]');
    const rerender=()=>renderModal(active,search.value);
    m.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{active=b.dataset.tab;rerender()});
    search.oninput=rerender;m.querySelector('[data-close]').onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove()};rerender();
  }

  function mount(){
    installStyles();registerExplain();scan();
    const actions=document.querySelector('.top-actions');
    if(actions&&!document.querySelector('#pcbpro-help-trigger')){
      const b=document.createElement('button');b.id='pcbpro-help-trigger';b.type='button';b.textContent=t('? Fungsi & Error','? Features & Errors');b.onclick=()=>open('features');
      const explain=document.querySelector('#pcbpro-explain-trigger');if(explain)actions.insertBefore(b,explain);else actions.appendChild(b);
    }
    document.addEventListener('pointerover',e=>{const el=e.target?.closest?.('[data-engineering-help]');if(el)showTip(el,e)},{passive:true});
    document.addEventListener('pointerout',e=>{if(e.target?.closest?.('[data-engineering-help]'))hideTip()},{passive:true});
    const mo=new MutationObserver(()=>{scan();registerExplain()});mo.observe(document.body,{childList:true,subtree:true});
  }

  window.PCBProHelp={version:VERSION,open,scan,features:featureObjects,errors:ERRORS,lookupError(code){return ERRORS[String(code||'').toUpperCase()]||null}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();