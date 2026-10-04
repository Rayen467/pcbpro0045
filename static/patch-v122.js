(() => {
  'use strict';
  if (window.PCBProPatchV122) return;
  const VERSION='1.22.0';
  const release={
    id:{title:'PCB Workspace Layout Repair — Command Dock Tanpa Overlay',changes:[
      'Board HUD dan FIELD PCB HUD tidak lagi diposisikan absolute di atas canvas sehingga tidak menimpa board, layer strip, atau satu sama lain.',
      'Tambah PCB Command Dock yang mengambil ruang layout sendiri di antara toolbar utama dan canvas.',
      'Kontrol Route/Via/Zone/Keepout memakai toolbar utama sebagai source-of-truth; FIELD PCB tidak lagi menduplikasi tombol tersebut.',
      'Board dock diringkas menjadi layer aktif, Edge.Cuts, Reset outline, unrouted count, dan track count.',
      'Advanced dock diringkas menjadi mode aktif, net, layer stack, Diff Pair, Stack, dan Advanced DRC.',
      'Pada layar sempit command dock menjadi horizontal-scroll satu baris, bukan menumpuk menutupi canvas.',
      'Pergantian tab membersihkan/memasang ulang dock secara deterministik agar tidak meninggalkan floating control lama.'
    ]},
    en:{title:'PCB Workspace Layout Repair — Non-overlapping Command Dock',changes:[
      'Board HUD and FIELD PCB HUD are no longer absolutely positioned over the canvas, preventing overlap with the board, layer strip, and each other.',
      'Added a PCB Command Dock that occupies its own layout space between the main toolbar and canvas.',
      'Route/Via/Zone/Keepout use the main toolbar as the source of truth; FIELD PCB no longer duplicates those controls.',
      'Board dock is reduced to active layer, Edge.Cuts, Reset outline, unrouted count, and track count.',
      'Advanced dock is reduced to active mode, net, layer stack, Diff Pair, Stack, and Advanced DRC.',
      'On narrow screens the command dock becomes a single horizontally scrollable row instead of covering the canvas.',
      'Tab changes deterministically remount/clean the dock so stale floating controls are not left behind.'
    ]}
  };
  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  function inject(){
    const body=document.querySelector('#pcbpro-patch-modal .ux-modal-body');
    if(!body||body.querySelector('[data-patch-v122]'))return;
    const r=release[lang()]||release.id;
    const a=document.createElement('article');a.dataset.patchV122='1';
    a.innerHTML='<div class="ux-patch-head"><b>v'+VERSION+'</b><span>2026-10-04</span></div><h3>'+r.title+'</h3><ul>'+r.changes.map(x=>'<li>'+x+'</li>').join('')+'</ul>';
    body.prepend(a);
  }
  document.addEventListener('click',e=>{if(e.target?.closest?.('.ux-patches,#pcbpro-ui-trigger'))setTimeout(inject,80)},true);
  window.PCBProPatchV122={version:VERSION,inject,release};
})();