(() => {
  'use strict';
  if (window.PCBProPatchV112) return;
  const VERSION='1.12.0';
  const release={
    id:{title:'Deep Electronics — Transcript-Grounded Learning + Labs',changes:[
      'Bedah transcript electronics lengkap dimasukkan sebagai expansion Learning Atlas, bukan hanya daftar judul: current/charge, voltage/energy, signal/noise, waveform, analog/digital threshold, battery, resistor, divider, superposition, ports, Thévenin, capacitor, RC transient, diode, LED, Zener, rectifier, dan reverse-polarity protection.',
      'Tambah Deep Dive di dalam Learning Center dengan konsep, intuisi, rumus/model, implikasi desain, batas model, latihan, dan cabang lanjut.',
      'Tambah Project Lens yang membaca komponen/net/wire/track project aktif dan merekomendasikan cabang ilmu relevan tanpa menganggap project sudah benar.',
      'Tambah Signal/Logic Lab untuk period-frequency dan VIH/VIL classification; threshold harus diisi sesuai device/datasheet.',
      'Tambah RC Transient Lab analitik untuk τ=RC, response first-order, serta titik 1τ/2τ/3τ/5τ; lab ini eksplisit bukan Live Project Simulator.',
      'Tambah Diode Region Lab untuk latihan piecewise OFF/ON/BREAKDOWN dan hypothesis/verify reasoning.',
      'Transcript diperlakukan source-first tetapi nilai/label yang tampak sebagai error ASR tidak dipromosikan menjadi konstanta engineering terverifikasi.',
      'Model ideal, model edukasi, datasheet exact, simulation state, dan physical measurement dipisahkan supaya web tidak memberi kepastian palsu.'
    ]},
    en:{title:'Deep Electronics — Transcript-Grounded Learning + Labs',changes:[
      'Integrated the full supplied electronics transcript as a Learning Atlas expansion covering current/charge, voltage/energy, signals, digital thresholds, sources, resistive networks, superposition, ports, Thévenin, capacitors/RC, diodes, LEDs, Zener, rectification and reverse-polarity protection.',
      'Added a Deep Dive surface with intuition, equations/models, design implications, model limits, practice, and connected branches.',
      'Added a Project Lens that maps active project components/nets/wires/tracks to relevant learning topics without claiming the design is correct.',
      'Added Signal/Logic, analytic RC transient, and piecewise Diode Region educational labs.',
      'Potential ASR errors in the transcript are not promoted into verified engineering constants.',
      'Ideal models, educational models, exact datasheet data, simulation state, and physical measurements remain explicitly separated.'
    ]}
  };
  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  function inject(){const body=document.querySelector('#pcbpro-patch-modal .ux-modal-body');if(!body||body.querySelector('[data-patch-v112]'))return;const r=release[lang()]||release.id;const a=document.createElement('article');a.dataset.patchV112='1';a.innerHTML=`<div class="ux-patch-head"><b>v${VERSION}</b><span>2026-10-02</span></div><h3>${r.title}</h3><ul>${r.changes.map(x=>`<li>${x}</li>`).join('')}</ul>`;body.prepend(a)}
  document.addEventListener('click',e=>{if(e.target?.closest?.('.ux-patches,#pcbpro-ui-trigger'))setTimeout(inject,80)},true);
  window.PCBProPatchV112={version:VERSION,inject};
})();