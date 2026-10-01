(() => {
  'use strict';

  const VERSION = '0.3.0';
  let db = null;
  let dbError = null;
  let lastQuery = '';
  let lastAnswer = '';

  const lang = () => window.PCBProUX?.lang || localStorage.getItem('pcbpro0045-lang') || 'id';
  const clean = (s) => String(s || '').trim().replace(/\s+/g, ' ');
  const norm = (s) => clean(s).toLowerCase();

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

  function projectRefs(design) {
    return new Map((design?.components || []).map((p) => [String(p.id || '').toUpperCase(), p]));
  }

  function pins(net) {
    return String(net?.pins || '').split(/[·,\s]+/).map((x) => x.trim()).filter((x) => /^[A-Za-z]+\d+\.\d+$/.test(x));
  }

  function wireGuide(query, design) {
    const l = lang();
    const refs = projectRefs(design);
    const mentioned = [...refs.keys()].filter((ref) => new RegExp(`\\b${ref}\\b`, 'i').test(query));
    const relevant = (design?.nets || []).filter((net) => {
      const ps = pins(net);
      return !mentioned.length || ps.some((p) => mentioned.includes(p.split('.')[0].toUpperCase()));
    });

    if (!relevant.length) {
      return l === 'id'
        ? 'Gue belum nemu koneksi itu di netlist aktif. Gue nggak akan nebak pin. Pilih/beri nama komponen yang mau disambung atau tambahkan net dulu.'
        : 'I cannot find that connection in the active netlist. I will not guess pins. Name/select the components you want to connect or add the net first.';
    }

    const lines = [];
    for (const net of relevant) {
      const ps = pins(net);
      if (ps.length < 2) continue;
      const described = ps.map((p) => {
        const ref = p.split('.')[0].toUpperCase();
        const part = refs.get(ref);
        const meaning = pinMeaning(part, p);
        return `${p}${meaning ? ` (${meaning})` : ''}`;
      });
      lines.push(`${net.name}: ${described.join(' → ')}`);
    }

    const groundSymbol = [...refs.values()].find((p) => partCode(p) === 'GND');
    const groundInNet = groundSymbol && (design?.nets || []).some((n) => pins(n).some((p) => p.toUpperCase().startsWith(`${String(groundSymbol.id).toUpperCase()}.`)));
    const note = groundSymbol && !groundInNet
      ? (l === 'id'
          ? `\n\nCatatan penting: ${groundSymbol.id} ada secara visual, tapi belum tercatat sebagai pin di netlist aktif. Jadi gue tidak akan bilang simbol ground itu benar-benar tersambung sampai source-of-truth netlist mencatatnya.`
          : `\n\nImportant: ${groundSymbol.id} exists visually but is not recorded as a pin in the active netlist. I will not claim the ground symbol is electrically connected until the source-of-truth netlist records it.`)
      : '';

    return l === 'id'
      ? `Berdasarkan NETLIST AKTIF, sambung wayarnya begini:\n${lines.map((x,i)=>`${i+1}. ${x}`).join('\n')}${note}\n\nIni bukan tebakan visual; urutan di atas dibaca dari data net project yang sekarang.`
      : `From the ACTIVE NETLIST, wire it like this:\n${lines.map((x,i)=>`${i+1}. ${x}`).join('\n')}${note}\n\nThis is not a visual guess; the sequence is read from the current project net data.`;
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
      const warnings = (exact.warnings || []).join(' ');
      return l === 'id'
        ? `${exact.mpn} — ${exact.manufacturer}. Status data: ${exact.status}. Package/reference: ${exact.package || 'lihat orderable exact'}. Rating tersimpan: ${ratings || '—'}. ${warnings ? `Peringatan: ${warnings}` : ''}\nSumber vendor: ${source}\nVerified snapshot: ${db.verified_at}.`
        : `${exact.mpn} — ${exact.manufacturer}. Data status: ${exact.status}. Package/reference: ${exact.package || 'see exact orderable'}. Stored ratings: ${ratings || '—'}. ${warnings ? `Warning: ${warnings}` : ''}\nVendor source: ${source}\nVerified snapshot: ${db.verified_at}.`;
    }

    const components = design?.components || [];
    const ref = components.find((p) => new RegExp(`\\b${String(p.id)}\\b`, 'i').test(query));
    if (ref) {
      const code = partCode(ref);
      const required = db?.generic_requirements?.[code] || [];
      return l === 'id'
        ? `${ref.id} (${ref.name || code}, ${ref.value || 'tanpa value'}) masih GENERIK. Gue tidak punya MPN/vendor exact untuk part ini, jadi gue tidak akan bikin rating lapangan palsu. Untuk sign-off butuh: ${required.join(', ') || 'manufacturer part number + datasheet exact'}.`
        : `${ref.id} (${ref.name || code}, ${ref.value || 'no value'}) is still GENERIC. There is no exact vendor MPN for this part, so I will not fabricate field ratings. Sign-off requires: ${required.join(', ') || 'exact manufacturer part number + datasheet'}.`;
    }
    return null;
  }

  function designSummary(design, analysis) {
    const l = lang();
    const count = design?.components?.length || 0;
    const nets = design?.nets?.length || 0;
    const issue = analysis?.issues?.length || 0;
    const warn = analysis?.warnings?.length || 0;
    return l === 'id'
      ? `Project aktif: ${count} komponen, ${nets} net, ${issue} issue, ${warn} warning. Gue cuma pakai netlist project + katalog vendor yang sudah diverifikasi; kalau data tidak ada, gue bilang tidak ada.`
      : `Active project: ${count} components, ${nets} nets, ${issue} issues, ${warn} warnings. I only use the project netlist + verified vendor catalog; missing data is reported as missing.`;
  }

  async function provider(ctx) {
    const query = clean(ctx?.query);
    const q = norm(query);
    if (!db && !dbError) await loadDb();

    let answer = null;
    if (/(wire|wiring|wayar|kabel|sambung|nyambung|connect|hubung|jalur kabel)/i.test(query)) answer = wireGuide(query, ctx?.design);
    if (!answer && /(datasheet|database|data komponen|rating|capability|kemampuan|mpn|vendor|1n4148|2n7002|lm358)/i.test(query)) answer = componentAnswer(query, ctx?.design);
    if (!answer) answer = componentAnswer(query, ctx?.design);
    if (!answer && /(apa yang|status|project|proyek|kondisi)/i.test(query)) answer = designSummary(ctx?.design, ctx?.analysis);
    if (!answer) {
      answer = lang() === 'id'
        ? `Pertanyaan ini belum punya handler engineering yang tervalidasi, dan LLM backend belum tersambung. Gue nggak akan ngarang jawaban. Yang bisa gue jawab sekarang harus berasal dari netlist aktif, hasil Reality Lab, atau component catalog vendor. Coba sebut ref seperti R2/D3 atau tanya "cara sambung wayar".`
        : `This question does not yet have a validated engineering handler, and the LLM backend is not connected. I will not invent an answer. Current answers must come from the active netlist, Reality Lab, or the vendor component catalog.`;
    }

    if (q === lastQuery && answer === lastAnswer) {
      return lang() === 'id'
        ? 'State project belum berubah sejak pertanyaan yang sama tadi, jadi gue nggak akan mengulang paragraf panjang. Kalau lo mau jawaban berbeda, ubah desain atau sebut komponen/net yang mau dicek.'
        : 'The project state has not changed since the same question, so I will not repeat the long answer. Change the design or name the component/net you want checked.';
    }
    lastQuery = q;
    lastAnswer = answer;
    return answer;
  }

  function refreshBadge() {
    const root = document.querySelector('#pcbpro-jarvis');
    if (!root) return;
    const small = root.querySelector('.jarvis-id small');
    if (small) small.textContent = `GROUNDED PROJECT REASONER · v${VERSION}`;
    const foot = root.querySelector('.jarvis-foot');
    if (foot) foot.innerHTML = `<span>netlist + vendor catalog</span><span>LLM backend: OFF</span>`;
    const first = root.querySelector('.jarvis-msg.assistant .jarvis-bubble p');
    if (first && /provider|LLM|workspace aktif/i.test(first.textContent || '')) {
      first.textContent = lang() === 'id'
        ? 'Gue baca project aktif dari netlist dan data komponen yang tersedia. Untuk sekarang reasoning bebas bukan LLM: kalau data atau logic belum ada, gue akan bilang belum ada, bukan ngarang.'
        : 'I read the active project from its netlist and available component data. Free-form reasoning is not an LLM yet: if data or logic is missing, I will say so instead of inventing it.';
    }
  }

  function boot() {
    window.PCBProAssistantProvider = provider;
    loadDb();
    const observer = new MutationObserver(() => refreshBadge());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    refreshBadge();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.PCBProGrounding = {
    version: VERSION,
    reloadCatalog: loadDb,
    wireGuide,
    get catalog() { return db; },
    get catalogError() { return dbError; }
  };
})();
