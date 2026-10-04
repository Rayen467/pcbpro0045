(() => {
  'use strict';
  if (window.PCBProProfessionalLearning) return;

  const VERSION='1.23.0';
  const DATA_URL='/learning-professional-v123.json';
  let syllabus=null;
  let merged=false;

  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  const t=(id,en)=>lang()==='id'?id:en;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  async function load(){
    if(syllabus)return syllabus;
    const r=await fetch(DATA_URL,{cache:'no-store'});
    if(!r.ok)throw new Error('Professional syllabus HTTP '+r.status);
    syllabus=await r.json();
    return syllabus;
  }

  function merge(){
    const base=window.PCBProLearningCenter?.curriculum;
    if(!base?.branches?.length||!syllabus?.branches?.length)return false;
    const byId=new Map(base.branches.map(b=>[b.id,b]));
    for(const branch of syllabus.branches){
      const old=byId.get(branch.id);
      if(old){
        old.title=branch.title;old.summary=branch.summary;
        const topics=new Map((old.topics||[]).map(x=>[x.id,x]));
        for(const topic of branch.topics||[]){
          const target=topics.get(topic.id);
          if(target)Object.assign(target,structuredClone(topic));
          else (old.topics||(old.topics=[])).push(structuredClone(topic));
        }
      }else base.branches.push(structuredClone(branch));
    }
    base.professionalSyllabus={
      version:syllabus.version,updated:syllabus.updated,title:syllabus.title,
      description:syllabus.description,evidencePolicy:syllabus.evidencePolicy,
      sources:structuredClone(syllabus.sources||[]),roleMap:structuredClone(syllabus.roleMap||[])
    };
    merged=true;
    window.PCBProLearningCenter?.refresh?.();
    window.dispatchEvent(new CustomEvent('pcbpro:professional-learning-ready',{detail:{version:VERSION,branches:syllabus.branches.length}}));
    return true;
  }

  async function ensure(){
    try{await load()}catch(error){console.warn('[PCB Pro Professional Learning]',error);return false}
    for(let i=0;i<40;i++){
      if(merge()){
        window.PCBProAssistantBrain?.rebuildLibrary?.();
        return true;
      }
      await new Promise(r=>setTimeout(r,100));
    }
    return false;
  }

  function installStyles(){
    if(document.querySelector('#pcbpro-prolearn-style'))return;
    const s=document.createElement('style');s.id='pcbpro-prolearn-style';s.textContent=`
      #pcbpro-prolearn-trigger{border-color:#8a692d!important;background:#2b2211!important;color:#efd27a!important}
      #pcbpro-prolearn-modal{position:fixed;z-index:2550;inset:0;background:#010509df;display:grid;place-items:center;padding:14px}.pl-shell{width:min(1180px,97vw);height:min(840px,94vh);display:grid;grid-template-rows:auto 1fr;border:1px solid #38515d;background:#07141c;color:#dce9ee;border-radius:15px;overflow:hidden;box-shadow:0 30px 110px #000e}.pl-head{display:flex;gap:9px;align-items:start;padding:12px;border-bottom:1px solid #203742}.pl-head>div{flex:1}.pl-head small{font:900 8px ui-monospace;color:#e0b55e}.pl-head h3{margin:4px 0}.pl-head p{margin:0;color:#91a8b2;font-size:9px}.pl-head button{border:1px solid #33505d;background:#10222c;color:#d4e2e7;border-radius:8px;padding:7px 10px}.pl-body{overflow:auto;padding:13px}.pl-section{margin-bottom:14px}.pl-section h4{font-size:12px;margin:0 0 8px}.pl-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.pl-card{border:1px solid #243e49;background:#0b1922;border-radius:9px;padding:10px}.pl-card b{font-size:10px}.pl-card p,.pl-card li{font-size:9px;color:#9fb2bb;line-height:1.5}.pl-card small{font:800 7px ui-monospace;color:#62d7bd}.pl-role{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.pl-role span{border:1px solid #31505c;border-radius:999px;padding:4px 7px;color:#9fb3bc;font-size:8px}.pl-note{border-left:3px solid #d4aa50;background:#2b221244;padding:9px;border-radius:7px;font-size:9px;color:#d2c18a;line-height:1.5}
      @media(max-width:720px){.pl-grid{grid-template-columns:1fr}.pl-shell{width:100vw;height:100dvh;border-radius:0}}
    `;document.head.appendChild(s)
  }

  function open(){
    if(!syllabus)return ensure().then(ok=>ok&&open());
    installStyles();document.querySelector('#pcbpro-prolearn-modal')?.remove();
    const m=document.createElement('div');m.id='pcbpro-prolearn-modal';
    const branchCards=(syllabus.branches||[]).map(b=>'<article class="pl-card"><small>'+esc(b.id.toUpperCase())+'</small><b style="display:block;margin-top:4px">'+esc(b.title)+'</b><p>'+esc(b.summary)+'</p><p>'+String((b.topics||[]).length)+' '+t('topik','topics')+'</p></article>').join('');
    const roles=(syllabus.roleMap||[]).map(r=>'<article class="pl-card"><b>'+esc(r.role)+'</b><div class="pl-role">'+(r.skills||[]).map(x=>'<span>'+esc(x)+'</span>').join('')+'</div></article>').join('');
    const sources=(syllabus.sources||[]).map(s=>'<article class="pl-card"><small>'+esc(s.type)+'</small><b style="display:block;margin-top:4px">'+esc(s.title)+'</b><p>'+esc(s.use)+'</p></article>').join('');
    m.innerHTML='<section class="pl-shell"><header class="pl-head"><div><small>PCB PRO · PROFESSIONAL SYLLABUS '+esc(syllabus.updated||'')+'</small><h3>'+esc(syllabus.title)+'</h3><p>'+esc(syllabus.description)+'</p></div><button data-close>×</button></header><main class="pl-body"><div class="pl-note">'+esc(syllabus.evidencePolicy)+'</div><section class="pl-section"><h4>'+t('Jalur peran lapangan kerja','Current job-role map')+'</h4><div class="pl-grid">'+roles+'</div></section><section class="pl-section"><h4>'+t('Modul profesional','Professional modules')+'</h4><div class="pl-grid">'+branchCards+'</div></section><section class="pl-section"><h4>'+t('Sumber kurikulum/industri','Curriculum/industry sources')+'</h4><div class="pl-grid">'+sources+'</div></section></main></section>';
    document.body.appendChild(m);m.querySelector('[data-close]').onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove()};
  }

  function mountButton(){
    const head=document.querySelector('#pcbpro-learning-modal .learn-head');if(!head)return;
    let b=head.querySelector('#pcbpro-prolearn-trigger');
    if(!b){b=document.createElement('button');b.id='pcbpro-prolearn-trigger';b.type='button';b.onclick=e=>{e.stopPropagation();open()};const close=head.querySelector('.close');head.insertBefore(b,close||null)}
    b.textContent=t('◎ Silabus Pro 2026','◎ Pro Syllabus 2026');
    b.title=t('Kurikulum profesional + skill lapangan kerja 2026–2027','Professional curriculum + current job skills 2026–2027');
  }

  function registerExplain(){
    window.PCBProExplain?.register?.({
      id:'feature.professional-syllabus-v123',match:['silabus pro','pro syllabus','kurikulum','career map'],category:'learning',status:'evidence-grounded',
      title:{id:'Silabus Profesional PCB 2026–2027',en:'Professional PCB Syllabus 2026–2027'},
      what:{id:'Overlay pembelajaran dari fondasi listrik sampai layout, SI/PI, DFM, bring-up, automation dan capstone.',en:'Learning overlay from electrical foundations through layout, SI/PI, DFM, bring-up, automation, and capstone.'},
      why:{id:'Menghubungkan teori yang dipelajari software engineer dengan workflow dan skill yang muncul pada kurikulum/sertifikasi industri serta role hardware saat ini.',en:'Connects theory for software engineers with workflows and skills reflected by current industry curricula/certifications and hardware roles.'},
      input:{id:'Kurikulum base PCB Pro + sumber ABET/IPC/tool documentation/job-role snapshot yang dicatat di syllabus.',en:'PCB Pro base curriculum plus recorded ABET/IPC/tool-documentation/job-role sources.'},
      process:{id:'Cabang profesional digabung ke Learning Atlas dan ikut diindeks oleh local RAG assistant.',en:'Professional branches are merged into Learning Atlas and indexed by the local RAG assistant.'},
      output:{id:'Peta belajar bertahap, role map, latihan, design implications, limitation dan capstone.',en:'A staged learning map, role map, practice, design implications, limitations, and capstone.'},
      how_to_read:{id:'Ini bukan sertifikasi resmi; gunakan sebagai roadmap belajar dan project portfolio.',en:'This is not an official certification; use it as a learning and portfolio roadmap.'},
      limits:{id:'Job requirement dan tool version berubah; tanggal/sumber disimpan supaya konteksnya jelas.',en:'Job requirements and tool versions change; dates/sources are retained for context.'},
      next:{id:'Pilih role target lalu ikuti cabang P1–P9 dan Project Lens.',en:'Choose a target role, then follow P1–P9 and Project Lens.'}
    });
  }

  function start(){
    installStyles();ensure();registerExplain();
    document.addEventListener('click',()=>setTimeout(()=>{mountButton();if(!merged)ensure();},0),{passive:true});
    setTimeout(mountButton,500);
  }

  window.PCBProProfessionalLearning={version:VERSION,load,merge,ensure,open,get syllabus(){return syllabus},get merged(){return merged}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();