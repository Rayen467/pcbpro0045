(() => {
  'use strict';
  if (window.PCBProPatchV115) return;
  const VERSION='1.15.0';
  const release={
    id:{title:'AI Engineering Agent — Typed Commands + Validated Action Plans',changes:[
      'Tambah Typed Project Command Bus sebagai jalur aksi resmi assistant. Command punya schema, risk level, adapter, validation, preview, result audit, dan best-effort rollback untuk plan atomic.',
      'Aksi sederhana seperti ubah value, buka workspace, aktifkan Wire, Run ERC/DRC, dan Run Simulator sekarang diarahkan melalui command bus, bukan chatbot yang hanya berkata seolah aksi berhasil.',
      'Tambah AI Action Planner endpoint. Untuk permintaan aksi kompleks, LLM hanya boleh memilih command dari manifest yang tersedia dan tidak boleh mengarang pin, geometry, output, atau command yang belum ada.',
      'Assistant sekarang menghasilkan Action Plan yang belum dijalankan, lengkap dengan daftar command/risk/adapter. User menekan Jalankan plan setelah melihat preview.',
      'Schematic wiring dapat dijalankan lewat typed command schematic.connect dengan exact pin IDs dan memakai Wire Engine API nyata.',
      'Jika planner tidak punya data exact seperti pin tujuan, assistant meminta klarifikasi dan tidak mengubah project.',
      'Tambah typed PCB route pad-to-pad untuk net schematic yang sama, termasuk layer F.Cu/B.Cu dan width/corner optional. Via/zone/keepout tetap tidak boleh dikarang karena typed mutation penuh belum tersedia.',
      'Setiap command memancarkan pcbpro:command-executed agar hasil aksi dapat diaudit dan dibaca ulang oleh assistant/workflow.',
      'Adapter component.setValue saat ini masih diberi label ui-bridge karena source-of-truth value mutation belum sepenuhnya dipindahkan ke central domain model; status ini tidak disamarkan sebagai API murni.'
    ]},
    en:{title:'AI Engineering Agent — Typed Commands + Validated Action Plans',changes:[
      'Added a Typed Project Command Bus as the assistant action path, with schemas, risk levels, adapters, validation, preview, audit results, and best-effort rollback for atomic plans.',
      'Simple actions such as component value changes, workspace navigation, Wire activation, ERC/DRC, and simulator run now go through the command bus rather than chat-only success claims.',
      'Added an AI Action Planner endpoint. For complex requests the LLM may only select commands exposed by the manifest and may not invent pins, geometry, outputs, or unavailable commands.',
      'The assistant now returns an unexecuted Action Plan with command/risk/adapter details. The user explicitly runs the plan after preview.',
      'Schematic wiring can execute through schematic.connect with exact pin IDs using the real Wire Engine API.',
      'If exact data such as a destination pin is missing, the assistant asks for clarification and makes no project change.',
      'Added typed pad-to-pad PCB routing for pins on the same schematic net, with F.Cu/B.Cu and optional width/corners. Via/zone/keepout mutations remain unavailable and must not be invented.',
      'Every command emits pcbpro:command-executed for audit and project-state re-read.',
      'component.setValue remains explicitly labeled ui-bridge until value mutation is moved into a true central domain model.'
    ]}
  };
  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  function inject(){const body=document.querySelector('#pcbpro-patch-modal .ux-modal-body');if(!body||body.querySelector('[data-patch-v115]'))return;const r=release[lang()]||release.id;const a=document.createElement('article');a.dataset.patchV115='1';a.innerHTML=`<div class="ux-patch-head"><b>v${VERSION}</b><span>2026-10-02</span></div><h3>${r.title}</h3><ul>${r.changes.map(x=>`<li>${x}</li>`).join('')}</ul>`;body.prepend(a)}
  document.addEventListener('click',e=>{if(e.target?.closest?.('.ux-patches,#pcbpro-ui-trigger'))setTimeout(inject,80)},true);
  window.PCBProPatchV115={version:VERSION,inject};
})();