(() => {
  'use strict';
  if (window.PCBProPatchV110) return;
  const VERSION='1.10.0';
  const release={
    id:{title:'Advanced Field PCB: Via, Zone, Keepout, Diff Pair, 4-Layer Rules',changes:[
      'Tambah engine board lanjutan yang menyimpan via, copper zone, keepout, differential-pair rules, dan layer stack sebagai state project nyata.',
      'Via sekarang dapat ditempatkan ke net aktif dengan diameter/drill tersimpan; advanced DRC memeriksa net invalid, Edge.Cuts, dan keepout.',
      'Copper Zone sekarang berupa polygon persistent yang diikat ke net dan layer; bukan kartu UI placeholder.',
      'Keepout polygon dapat digambar manual untuk area sensitif seperti antenna/module keepout.',
      'Differential pair rules menyimpan pasangan P/N, width, gap, dan batas mismatch panjang lalu mengaudit routing yang tersedia.',
      'Tambah preset stack 2-layer dan 4-layer (F.Cu / In1.GND / In2.Power / B.Cu) untuk mendekati workflow board nyata.',
      'Advanced DRC menggabungkan basic board DRC dengan via/zone/keepout/diff-pair checks tanpa mengklaim manufacturing sign-off penuh.'
    ]},
    en:{title:'Advanced Field PCB: Via, Zone, Keepout, Diff Pair, 4-Layer Rules',changes:[
      'Added a persistent advanced board engine for vias, copper zones, keepouts, differential-pair rules, and layer stack project state.',
      'Vias can be placed on an active net with stored diameter/drill; advanced DRC checks invalid nets, Edge.Cuts, and keepouts.',
      'Copper zones are persistent net/layer-bound polygons instead of placeholder UI cards.',
      'Manual keepout polygons support sensitive areas such as antenna/module keepouts.',
      'Differential-pair rules store P/N members, width, gap, and maximum length mismatch and audit available routing.',
      'Added 2-layer and 4-layer stack presets (F.Cu / In1.GND / In2.Power / B.Cu).',
      'Advanced DRC combines basic board DRC with via/zone/keepout/diff-pair checks without claiming full manufacturing sign-off.'
    ]}
  };
  function lang(){return window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id'}
  function inject(){
    const body=document.querySelector('#pcbpro-patch-modal .ux-modal-body');
    if(!body||body.querySelector('[data-patch-v110]'))return;
    const l=lang(),r=release[l]||release.id;
    const a=document.createElement('article');a.dataset.patchV110='1';
    a.innerHTML=`<div class="ux-patch-head"><b>v${VERSION}</b><span>2026-10-02</span></div><h3>${r.title}</h3><ul>${r.changes.map(x=>`<li>${x}</li>`).join('')}</ul>`;
    body.prepend(a);
  }
  document.addEventListener('click',e=>{if(e.target?.closest?.('.ux-patches,#pcbpro-ui-trigger'))setTimeout(inject,80)},true);
  const obs=new MutationObserver(()=>inject());obs.observe(document.documentElement,{childList:true,subtree:true});
  window.PCBProPatchV110={version:VERSION,inject};
})();