(() => {
  'use strict';
  if (window.PCBProPatchV117) return;
  const VERSION='1.17.0';
  const release={
    id:{title:'Encrypted Project Database — Supabase + AES-GCM + RLS',changes:[
      'PCB Pro sekarang punya database khusus Supabase project PCBPro0045 di region ap-southeast-1, terpisah dari project lain.',
      'Tambah tabel pcb_projects dan pcb_project_versions dengan Row Level Security (RLS). Row hanya dapat diakses bila request membawa owner token browser yang hash-nya cocok.',
      'Nama proyek dan payload project dienkripsi AES-GCM di browser sebelum dikirim ke database. Database menyimpan ciphertext, IV, hash ciphertext, schema version, revision, dan timestamp.',
      'Tambah transactional save RPC pcbpro_save_project: create/update current project + revision snapshot berjalan dalam satu transaksi database.',
      'Revision history disimpan sampai 50 snapshot per project untuk menjaga ukuran database tetap terkendali.',
      'Project tab sekarang mendapat panel DATABASE · AES-GCM + RLS yang menampilkan project remote, revision, waktu sync, Sync sekarang, + Proyek DB, dan Backup key.',
      'Pada browser pertama, jika database masih kosong, current local project otomatis dibuat sebagai project database terenkripsi; setelah itu perubahan project autosync setelah state stabil.',
      'Restore project database mengembalikan components, UI state, wire graph, PCB geometry, dan advanced board state lalu reload engine supaya semua source-of-truth lokal membaca snapshot yang sama.',
      'Encryption key dan owner token tetap berada di browser. Backup key wajib disimpan bila ingin bisa membuka ciphertext setelah browser storage hilang. Ini belum account-based multi-device sync.'
    ]},
    en:{title:'Encrypted Project Database — Supabase + AES-GCM + RLS',changes:[
      'PCB Pro now has a dedicated PCBPro0045 Supabase project in ap-southeast-1, isolated from unrelated projects.',
      'Added pcb_projects and pcb_project_versions with Row Level Security. Rows are accessible only when the browser owner-token hash matches.',
      'Project names and payloads are AES-GCM encrypted in the browser before upload. The database stores ciphertext, IVs, ciphertext hash, schema version, revision, and timestamps.',
      'Added transactional pcbpro_save_project RPC so current-project updates and revision snapshots are committed together.',
      'Revision history retains up to 50 snapshots per project.',
      'The Project tab now receives a DATABASE · AES-GCM + RLS panel listing remote projects, revisions, sync time, Sync now, + DB project, and Backup key.',
      'On the first browser boot, an empty database is automatically seeded from the current local project; subsequent stable project changes autosync.',
      'Database restore brings back components, UI state, wire graph, PCB geometry, and advanced board state, then reloads engines from the same snapshot.',
      'The encryption key and owner token remain in the browser. Back up the key if browser storage may be lost. This is not yet account-based multi-device sync.'
    ]}
  };
  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  function inject(){
    const body=document.querySelector('#pcbpro-patch-modal .ux-modal-body');
    if(!body||body.querySelector('[data-patch-v117]'))return;
    const r=release[lang()]||release.id;
    const a=document.createElement('article');a.dataset.patchV117='1';
    a.innerHTML=`<div class="ux-patch-head"><b>v${VERSION}</b><span>2026-10-02</span></div><h3>${r.title}</h3><ul>${r.changes.map(x=>`<li>${x}</li>`).join('')}</ul>`;
    body.prepend(a);
  }
  document.addEventListener('click',e=>{if(e.target?.closest?.('.ux-patches,#pcbpro-ui-trigger'))setTimeout(inject,80)},true);
  window.PCBProPatchV117={version:VERSION,inject,release};
})();