(() => {
  'use strict';
  if (window.PCBProPatchV114) return;
  const VERSION='1.14.0';
  const release={
    id:{title:'Hybrid AI Assistant Brain — Tools + RAG Library + Memory + LLM Routing',changes:[
      'Assistant lama yang regex-first diganti dengan Hybrid Assistant Brain. Pertanyaan tidak lagi dipotong dulu oleh kumpulan keyword sebelum punya kesempatan memahami konteks project.',
      'Assistant membaca workspace aktif, komponen terpilih, jumlah komponen/net/wire/track, workflow, board summary, dan live simulation state sebelum menjawab.',
      'Tambah local knowledge library/RAG dari Learning Atlas, Deep Learning transcript expansion, Explanation Registry, verified component catalog, dan patch history. Hanya potongan yang relevan yang dikirim ke model.',
      'Tambah working memory ringan di browser untuk goal/focus/unresolved issue dan percakapan terbaru; memory ini bukan source-of-truth desain dan bisa di-reset tanpa mengubah project.',
      'Tambah token router: LOCAL untuk action/state sederhana tanpa LLM, FAST untuk lookup/sintesis ringan, STANDARD untuk reasoning normal, dan REASON untuk troubleshooting/trade-off yang lebih kompleks.',
      'Backend AI tidak lagi mengirim seluruh Learning Atlas + seluruh catalog di setiap request. Context dipadatkan, history dibatasi, retrieval maksimal beberapa chunk, dan output budget disesuaikan tier.',
      'Model response diberi metadata route/tier/library hits/model/usage agar user bisa melihat kapan assistant memakai local tools, library, atau LLM.',
      'Assistant UI sekarang selalu menampilkan context project aktif dan quick actions seperti Context, Next, AI Audit, Explain Selected, dan Wiring.',
      'Assistant tetap dilarang mengarang koneksi, rating, measurement, geometry, manufacturing readiness, atau action result yang tidak ada di project state/tool result.'
    ]},
    en:{title:'Hybrid AI Assistant Brain — Tools + RAG Library + Memory + LLM Routing',changes:[
      'Replaced the regex-first assistant path with a Hybrid Assistant Brain that interprets project context before model reasoning.',
      'The assistant reads the active workspace, selected component, component/net/wire/track counts, workflow, board summary, and live simulation state.',
      'Added a local RAG library built from the Learning Atlas, transcript-grounded Deep Learning expansion, Explanation Registry, verified component catalog, and patch history; only relevant chunks are sent to the model.',
      'Added lightweight browser working memory for goal/focus/unresolved issues and recent conversation. It is not design source-of-truth and can be reset without changing the project.',
      'Added token routing: LOCAL for deterministic actions/state, FAST for lightweight synthesis, STANDARD for normal reasoning, and REASON for deeper troubleshooting/trade-offs.',
      'The backend no longer sends the entire learning atlas and catalog on every request; context, history, retrieval, and output budgets are bounded per request.',
      'Assistant responses expose route/tier/library hits/model/usage metadata so users can see whether local tools, retrieval, or an LLM were used.',
      'The assistant UI now keeps active-project context visible with quick actions for Context, Next, AI Audit, Explain Selected, and Wiring.',
      'The assistant remains forbidden from inventing connections, ratings, measurements, geometry, manufacturing readiness, or action results not supported by project/tool state.'
    ]}
  };
  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  function inject(){const body=document.querySelector('#pcbpro-patch-modal .ux-modal-body');if(!body||body.querySelector('[data-patch-v114]'))return;const r=release[lang()]||release.id;const a=document.createElement('article');a.dataset.patchV114='1';a.innerHTML=`<div class="ux-patch-head"><b>v${VERSION}</b><span>2026-10-02</span></div><h3>${r.title}</h3><ul>${r.changes.map(x=>`<li>${x}</li>`).join('')}</ul>`;body.prepend(a)}
  document.addEventListener('click',e=>{if(e.target?.closest?.('.ux-patches,#pcbpro-ui-trigger'))setTimeout(inject,80)},true);
  window.PCBProPatchV114={version:VERSION,inject};
})();
