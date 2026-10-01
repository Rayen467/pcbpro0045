(() => {
  'use strict';

  const VERSION = '0.6.0';
  let db = null;
  let dbError = null;
  let aiState = 'ready';
  let aiModel = 'Vercel AI Gateway';
  const conversation = [];

  const lang = () => window.PCBProUX?.lang || localStorage.getItem('pcbpro0045-lang') || 'id';
  const clean = (s) => String(s || '').trim().replace(/\s+/g, ' ');

  async function loadDb() {
    try {
      const response = await fetch('/component-db.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`catalog HTTP ${response.status}`);
      db = await response.json();
      dbError = null;
    } catch (error) {
      db = null;
      dbError = error?.message || String(error);
    }
    refreshBadge();
    return db;
  }

  function partCode(part) {
    const text = `${part?.id || ''} ${part?.name || ''} ${part?.value || ''}`.toLowerCase();
    if (/led/.test(text)) return 'LED';
    if (/ground/.test(text)) return 'GND';
    if (/resistor/.test(text) || /^r\d+/i.test(part?.id || '')) return 'R';
    if (/capacitor/.test(text) || /^c\d+/i.test(part?.id || '')) return 'C';
    if (/inductor/.test(text) || /^l\d+/i.test(part?.id || '')) return 'L';
    if (/dc source|voltage source/.test(text) || /^v\d+/i.test(part?.id || '')) return 'V';
    if (/mosfet/.test(text) || /^q\d+/i.test(part?.id || '')) return 'Q';
    if (/op-amp/.test(text) || /^u\d+/i.test(part?.id || '')) return 'U';
    if (/diode/.test(text) || /^d\d+/i.test(part?.id || '')) return 'D';
    return String(part?.id || '').replace(/\d.*$/, '').toUpperCase();
  }

  function pinMeaning(part, pin) {
    const code = partCode(part);
    const n = String(pin).split('.').pop();
    const id = lang() === 'id';
    if (code === 'V') return n === '1' ? (id ? 'positif (+)' : 'positive (+)') : n === '2' ? (id ? 'negatif (−)' : 'negative (−)') : '';
    if (code === 'LED' || code === 'D') return n === '1' ? (id ? 'anoda' : 'anode') : n === '2' ? (id ? 'katoda' : 'cathode') : '';
    if (['R','C','L','SW'].includes(code)) return id ? 'terminal pasif' : 'passive terminal';
    return '';
  }

  function pins(net) {
    return String(net?.pins || '').split(/[·,\s]+/).map((x) => x.trim()).filter((x) => /^[A-Za-z]+\d+\.\d+$/.test(x));
  }

  function wireGuide(query, design) {
    const l = lang();
    const refs = new Map((design?.components || []).map((p) => [String(p.id || '').toUpperCase(), p]));
    const mentioned = [...refs.keys()].filter((ref) => new RegExp(`\\b${ref}\\b`, 'i').test(query));
    const relevant = (design?.nets || []).filter((net) => !mentioned.length || pins(net).some((p) => mentioned.includes(p.split('.')[0].toUpperCase())));

    if (!relevant.length) {
      return l === 'id'
        ? 'Netlist aktif belum punya koneksi yang cukup untuk menjawab wiring itu. Gue tidak akan nebak pin. Sebut ref komponen yang mau disambung atau lengkapi net-nya.'
        : 'The active netlist does not contain enough connectivity to answer that wiring request. I will not guess pins.';
    }

    const lines = [];
    for (const net of relevant) {
      const ps = pins(net);
      if (ps.length < 2) continue;
      lines.push(`${net.name}: ${ps.map((p) => {
        const ref = p.split('.')[0].toUpperCase();
        const meaning = pinMeaning(refs.get(ref), p);
        return `${p}${meaning ? ` (${meaning})` : ''}`;
      }).join(' → ')}`);
    }
    return l === 'id'
      ? `Berdasarkan netlist aktif:\n${lines.map((x,i)=>`${i+1}. ${x}`).join('\n')}\n\nIni dibaca dari data project, bukan tebakan visual.`
      : `From the active netlist:\n${lines.map((x,i)=>`${i+1}. ${x}`).join('\n')}`;
  }

  function findDbPart(query, design) {
    if (!db?.parts?.length) return null;
    const hay = `${query} ${(design?.components || []).map((p)=>`${p.id} ${p.name} ${p.value}`).join(' ')}`.toUpperCase();
    return db.parts.find((p) => hay.includes(String(p.mpn).toUpperCase())) || null;
  }

  function componentAnswer(query, design) {
    const l = lang();
    const exact = findDbPart(query, design);
    if (exact) {
      const ratings = Object.entries(exact.ratings || {}).map(([k,v]) => `${k}: ${v}`).join(', ');
      const source = exact.sources?.[0]?.url || '—';
      return l === 'id'
        ? `${exact.mpn} — ${exact.manufacturer}. Status ${exact.status}. Rating katalog: ${ratings || '—'}. Sumber vendor: ${source}`
        : `${exact.mpn} — ${exact.manufacturer}. Status ${exact.status}. Catalog ratings: ${ratings || '—'}. Vendor source: ${source}`;
    }

    const ref = (design?.components || []).find((p) => new RegExp(`\\b${String(p.id)}\\b`, 'i').test(query));
    if (!ref) return null;
    const required = db?.generic_requirements?.[partCode(ref)] || [];
    return l === 'id'
      ? `${ref.id} (${ref.name || partCode(ref)}, ${ref.value || 'tanpa value'}) masih generik. Tidak ada MPN/vendor exact, jadi rating lapangan tidak boleh dibuat-buat. Untuk sign-off butuh: ${required.join(', ') || 'MPN + datasheet exact'}.`
      : `${ref.id} is still generic. There is no exact vendor MPN, so field ratings must not be invented.`;
  }

  function workflowAnswer(query) {
    const snap = window.PCBProWorkflow?.snapshot?.();
    if (!snap) return null;
    const l = lang();
    const next = snap.stages?.find((s)=>s.id===snap.next);
    if (!next) return null;
    const label = next.label?.[l] || next.label?.id || next.id;
    const detail = next.detail?.[l] || next.detail?.id || '';
    return l === 'id'
      ? `Progress workflow ${snap.done}/${snap.total}. Langkah berikutnya: ${label}. ${detail}`
      : `Workflow progress ${snap.done}/${snap.total}. Next step: ${label}. ${detail}`;
  }

  function learningSnapshot() {
    const atlas = window.PCBProLearningCenter?.curriculum;
    if (!atlas?.branches?.length) return null;
    return {
      version: atlas.version,
      branches: atlas.branches.map((b) => ({
        id:b.id,
        title:b.title,
        summary:b.summary,
        topics:(b.topics||[]).map((x)=>({id:x.id,title:x.title,level:x.level,summary:x.summary,concepts:x.concepts,formulas:x.formulas,next:x.next}))
      }))
    };
  }

  function learningAnswer(query) {
    const atlas = learningSnapshot();
    if (!atlas) return null;
    const q = clean(query).toLowerCase();
    const tokens = q.split(/[^a-z0-9µΩ]+/i).filter((x)=>x.length>2);
    const scored = [];
    for (const branch of atlas.branches) {
      for (const topic of branch.topics || []) {
        const hay = `${topic.title} ${topic.summary} ${(topic.concepts||[]).join(' ')} ${(topic.formulas||[]).join(' ')}`.toLowerCase();
        const score = tokens.reduce((n,token)=>n+(hay.includes(token)?1:0),0) + (hay.includes(q)?4:0);
        if (score > 0) scored.push({score,branch,topic});
      }
    }
    scored.sort((a,b)=>b.score-a.score);
    const best = scored.slice(0,4);
    if (!best.length) return null;
    const l=lang();
    const lines=best.map(({branch,topic})=>{
      const formulas=(topic.formulas||[]).slice(0,3).join(' · ');
      return `• ${topic.title} — ${topic.summary}${formulas?` [${formulas}]`:''} → ${branch.title}`;
    });
    return l==='id'
      ? `Dari Learning Atlas PCB Pro, topik yang paling nyambung:\n${lines.join('\n')}\n\nBuka tombol Belajar untuk lihat cabang konsep, rumus, latihan, dan hubungan ke project aktif.`
      : `From the PCB Pro Learning Atlas, the most relevant topics are:\n${lines.join('\n')}\n\nOpen Learn to explore concept branches, formulas, practice, and active-project connections.`;
  }

  function localFallback(query, ctx, errorMessage = '') {
    let answer = null;
    if (/(wire|wiring|wayar|kabel|sambung|nyambung|connect|hubung)/i.test(query)) answer = wireGuide(query, ctx?.design);
    if (!answer && /(workflow|kicad|langkah|selanjutnya|next step|gerber|drill|erc|drc|fabrication|fabrikasi)/i.test(query)) answer = workflowAnswer(query);
    if (!answer && /(ohm|kirchhoff|kcl|kvl|resistor|capacitor|kapasitor|inductor|induktor|transistor|diode|dioda|transformer|tegangan|voltage|arus|current|resistance|resistansi|power|daya|series|parallel|divider|nodal|mesh|thevenin|norton|superposition|phasor|impedance|filter|op.?amp|belajar|learn|jelaskan|explain)/i.test(query)) answer = learningAnswer(query);
    if (!answer) answer = componentAnswer(query, ctx?.design);
    if (!answer) {
      const l = lang();
      answer = l === 'id'
        ? 'LLM lagi tidak tersedia untuk request ini. Gue masih bisa baca netlist, workflow, Learning Atlas, data komponen terverifikasi, dan state simulator, tapi gue tidak akan bikin jawaban palsu.'
        : 'The LLM is unavailable for this request. I can still read the netlist, workflow, Learning Atlas, verified component data, and simulator state, but I will not fabricate an answer.';
    }
    return errorMessage ? `${answer}\n\n[LLM fallback: ${errorMessage}]` : answer;
  }

  function simulationSnapshot() {
    const live = window.PCBProLiveSimulation?.lastResult;
    if (!live) return null;
    return {
      running: Boolean(window.PCBProLiveSimulation?.running),
      frame: live.frame,
      nodeVoltages: live.result?.nodeVoltages || null,
      devices: live.result?.devices || null,
      warnings: live.warnings || [],
      fault: live.fault || 'none'
    };
  }

  async function callLLM(query, ctx) {
    aiState = 'thinking';
    refreshBadge();
    const response = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        query,
        history: conversation.slice(-10),
        design: ctx?.design || null,
        analysis: ctx?.analysis || null,
        simulation: simulationSnapshot(),
        reality: ctx?.reality || null,
        workflow: window.PCBProWorkflow?.snapshot?.() || null,
        learning: learningSnapshot(),
        catalog: db ? { schema_version:db.schema_version, verified_at:db.verified_at, policy:db.policy, parts:db.parts } : null
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.text) throw new Error(data?.error || `HTTP ${response.status}`);
    aiState = 'online';
    aiModel = data.model || 'AI Gateway';
    refreshBadge();
    return String(data.text).trim();
  }

  async function provider(ctx) {
    const query = clean(ctx?.query);
    if (!query) return '';
    if (!db && !dbError) await loadDb();

    let answer;
    try {
      answer = await callLLM(query, ctx);
    } catch (error) {
      aiState = 'fallback';
      refreshBadge();
      answer = localFallback(query, ctx, error?.message || 'AI unavailable');
    }

    conversation.push({ role:'user', content:query });
    conversation.push({ role:'assistant', content:answer });
    if (conversation.length > 20) conversation.splice(0, conversation.length - 20);
    return answer;
  }

  function refreshBadge() {
    const root = document.querySelector('#pcbpro-jarvis');
    if (!root) return;
    const small = root.querySelector('.jarvis-id small');
    if (small) {
      const state = aiState === 'online' ? `LLM ONLINE · ${aiModel}` : aiState === 'thinking' ? 'LLM THINKING…' : aiState === 'fallback' ? 'LLM FALLBACK · GROUNDED LOCAL' : 'LLM READY · PROJECT GROUNDED';
      small.textContent = `PCB ENGINEERING COPILOT · v${VERSION} · ${state}`;
    }
    const foot = root.querySelector('.jarvis-foot');
    if (foot) foot.innerHTML = `<span>project netlist + workflow + learning atlas + vendor catalog + simulator state</span><span>${aiState === 'fallback' ? 'LLM fallback active' : 'LLM via Vercel AI Gateway'}</span>`;
  }

  function boot() {
    window.PCBProAssistantProvider = provider;
    loadDb();
    const observer = new MutationObserver(() => refreshBadge());
    observer.observe(document.body, { childList:true, subtree:true });
    refreshBadge();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  window.PCBProGrounding = {
    version:VERSION,
    reloadCatalog:loadDb,
    wireGuide,
    workflowAnswer,
    learningAnswer,
    learningSnapshot,
    provider,
    get catalog(){return db;},
    get catalogError(){return dbError;},
    get aiState(){return aiState;},
    get conversation(){return conversation.slice();}
  };
})();