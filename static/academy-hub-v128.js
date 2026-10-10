(() => {
  'use strict';
  if(window.PCBProAcademy) return;
  const VERSION='1.28.0', KEY='pcbpro0045-academy-progress-v128';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const newState=()=>({version:VERSION,completed:{},practiced:{},quizPassed:{},labs:{},selected:'M00-L1',track:'all'});
  let progress=newState(), curriculum=null, ready=false, lastError='';
  const truthMap=(v,max)=>v && typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length<=max&&
    Object.entries(v).every(([k,x])=>/^[A-Za-z0-9_-]{1,60}$/.test(k) && x===true);
  function validate(value){
    if(!value||typeof value!=='object'||Array.isArray(value))return {ok:false,error:'Progress is not an object'};
    for(const field of ['completed','practiced','quizPassed','labs'])
      if(!truthMap(value[field]??{},1000))return {ok:false,error:field+' is invalid'};
    if(typeof value.selected!=='string'||value.selected.length>40)return {ok:false,error:'Invalid selected lesson'};
    if(typeof value.track!=='string'||value.track.length>60)return {ok:false,error:'Invalid track'};
    return {ok:true};
  }
  function snapshot(){return structuredClone(progress)}
  function load(){
    try{
      const raw=localStorage.getItem(KEY);
      if(!raw)return;
      const parsed=JSON.parse(raw);
      if(!validate(parsed).ok){lastError='Progres lama rusak. Progres baru dimulai tanpa menghapus arsip lama.';return}
      progress={...newState(),...parsed};
    }catch{lastError='Progres tersimpan tidak bisa dibaca. Latihan dimulai tanpa mengubah file lama.';}
  }
  function save(next){
    const test=validate(next);
    if(!test.ok)throw Error(test.error);
    localStorage.setItem(KEY,JSON.stringify(next));
    progress=structuredClone(next);
    window.dispatchEvent(new CustomEvent('pcbpro:academy-changed',{detail:{completed:Object.keys(progress.completed).length}}));
    render();
    return snapshot();
  }
  function restore(data,{merge=false}={}){
    if(!data)return snapshot();
    const test=validate(data);
    if(!test.ok)throw Error(test.error);
    const next={...newState(),...data};
    if(merge){
      for(const field of ['completed','practiced','quizPassed','labs'])
        next[field]={...progress[field],...data[field]};
      // Current learning location belongs to this user, not the project we imported.
      next.selected=progress.selected;next.track=progress.track;
    }
    return save(next);
  }
  function lesson(id){return curriculum?.stages?.flatMap(s=>s.lessons).find(l=>l.id===id);}
  function stageFor(id){return curriculum?.stages?.find(s=>s.lessons.some(l=>l.id===id));}
  function status(id){return {quiz:!!progress.quizPassed[id],practice:!!progress.practiced[id],done:!!progress.completed[id]};}
  function markLab(id){
    if(!['led','i2c','motor'].includes(id))throw Error('Unknown routing lab');
    return save({...progress,labs:{...progress.labs,[id]:true}});
  }
  function togglePractice(id,flag){
    if(!lesson(id))throw Error('Unknown lesson');
    const p={...progress,practiced:{...progress.practiced},completed:{...progress.completed}};
    if(flag)p.practiced[id]=true;
    else{delete p.practiced[id];delete p.completed[id];}
    if(flag&&p.quizPassed[id])p.completed[id]=true;
    return save(p);
  }
  function quiz(id,answer){
    const l=lesson(id);if(!l)throw Error('Unknown lesson');
    const correct=answer===l.quiz.answer;
    const next={...progress,quizPassed:{...progress.quizPassed},completed:{...progress.completed}};
    if(correct){
      next.quizPassed[id]=true;
      if(next.practiced[id])next.completed[id]=true;
      save(next);
    }else{
      const feedback=document.getElementById('ac-feedback');
      if(feedback)feedback.textContent='Belum tepat. Pelajari lagi bagian contoh dan praktik, lalu coba jawaban lain.';
    }
    return {correct,completed:!!next.completed[id]};
  }
  function select(id){
    if(!lesson(id))return;
    save({...progress,selected:id});
  }
  function selectTrack(id){
    if(id!=='all'&&!curriculum?.tracks?.some(x=>x.name===id))return;
    const allowed=id==='all'?curriculum.stages:curriculum.stages.filter(s=>curriculum.tracks.find(x=>x.name===id)?.stages.includes(s.id));
    const current=allowed.some(s=>s.lessons.some(l=>l.id===progress.selected))?progress.selected:(allowed[0]?.lessons?.[0]?.id||progress.selected);
    save({...progress,track:id,selected:current});
  }
  const count=s=>s.lessons.filter(l=>progress.completed[l.id]).length;
  function openWorkspace(view){
    const el=[...document.querySelectorAll('.tabs button')].find(x=>x.textContent?.trim()===view);
    if(el){el.click();return true;}
    return false;
  }
  function css(){
    if(document.getElementById('pcbpro-academy-style-v128'))return;
    const s=document.createElement('style');s.id='pcbpro-academy-style-v128';
    s.textContent=[
      '.ac-root{height:100%;overflow:auto;color:#dce6ee;background:#081720;font:13px/1.65 system-ui;padding:19px;box-sizing:border-box}',
      '.ac-root *{box-sizing:border-box}.ac-root button,.ac-root select{font:inherit}',
      '.ac-head{display:flex;gap:18px;justify-content:space-between;align-items:start;flex-wrap:wrap;max-width:1350px;margin:auto auto 18px}',
      '.ac-kicker{color:#79dfca;font:800 10px ui-monospace,monospace;letter-spacing:.14em}.ac-head h1{font-size:27px;margin:5px 0;letter-spacing:-.03em;color:#e9f4f4}',
      '.ac-head p{color:#9cb7c2;margin:0;max-width:695px}.ac-progress{text-align:right;min-width:220px;max-width:300px;color:#adc6cc}',
      '.ac-progress strong{font-size:24px;display:block;color:#d1f4e9}.ac-meter{height:7px;background:#1d3740;border-radius:9px;overflow:hidden;margin:7px 0}',
      '.ac-meter i{display:block;height:100%;background:#60c9ac;border-radius:9px}',
      '.ac-shell{display:grid;grid-template-columns:270px minmax(0,1fr);gap:14px;max-width:1350px;margin:0 auto;align-items:start}',
      '.ac-nav{background:#0d222c;border:1px solid #284754;border-radius:12px;padding:11px;max-height:78vh;overflow:auto}',
      '.ac-filter{width:100%;background:#081b24;color:#dfeef1;border:1px solid #315360;border-radius:6px;padding:10px;margin-bottom:9px}',
      '.ac-stage{display:block;width:100%;text-align:left;background:none;color:#c5d8dc;border:1px solid transparent;border-radius:8px;padding:9px;margin:2px 0;cursor:pointer}',
      '.ac-stage.active{border-color:#287b72;background:#103d3b}.ac-stage small{color:#88acb5;display:block;font-size:10px}.ac-stage strong{font-size:12px}',
      '.ac-stage-line{display:flex;justify-content:space-between;gap:10px}.ac-stage em{color:#72dbc5;font-size:10px;font-style:normal}',
      '.ac-main{min-width:0}.ac-card{background:#0d222c;border:1px solid #294854;border-radius:12px;padding:17px;margin-bottom:12px}',
      '.ac-section-tag{font:700 11px ui-monospace;color:#77d5c6}.ac-card h2{font-size:22px;margin:7px 0 12px;color:#edf6f5}',
      '.ac-card h3{font-size:14px;margin:0 0 7px;color:#d8efeb}.ac-card p{color:#b6ced4;line-height:1.75;white-space:pre-line}',
      '.ac-lessons{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:17px}',
      '.ac-pill,.ac-root button.ac-pill{border:1px solid #325663;border-radius:7px;padding:8px 11px;background:#102b36;color:#c9e3e6;cursor:pointer}',
      '.ac-pill.active{background:#145c53;border-color:#46bba6;color:#e7fff9}.ac-pill.done:before{content:"✓ ";color:#7df5bb}',
      '.ac-lesson-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(250px,1fr);gap:11px}',
      '.ac-concept{background:#112f38;border:1px solid #2b5661;padding:14px;border-radius:8px;margin-bottom:10px}',
      '.ac-concept strong{display:block;margin-bottom:5px;color:#83e3d1;font-size:12px}',
      '.ac-box{padding:13px;background:#112a34;border:1px solid #2d4e5b;border-radius:9px;margin-bottom:11px}',
      '.ac-box.practice{border-color:#386f5a}.ac-box code{white-space:pre-wrap}',
      '.ac-check{display:flex;gap:9px;align-items:start;cursor:pointer;color:#d4e4e4}',
      '.ac-check input{accent-color:#67dabb;margin-top:4px;flex-shrink:0}',
      '.ac-quiz button{display:block;width:100%;text-align:left;white-space:normal;background:#0d2730;border:1px solid #39535e;border-radius:7px;padding:10px;color:#d6e8ea;margin:8px 0;cursor:pointer}',
      '.ac-quiz button:hover{border-color:#4dbca2}.ac-note{font-size:11px;color:#a0bbc2!important;margin:7px 0}',
      '.ac-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.ac-actions button,.ac-root button.ac-action{background:#164d48;border:1px solid #378a79;border-radius:7px;color:#daf9ef;padding:8px 11px;cursor:pointer}',
      '.ac-actions button:disabled{opacity:.35;cursor:not-allowed}.ac-links{display:grid;gap:6px;padding:8px 0}',
      '.ac-links a{color:#80dbcd;text-decoration:underline;text-underline-offset:3px}',
      '.ac-alert{padding:12px 14px;border-radius:8px;border:1px solid #7c6740;background:#2d2718;color:#efd7a1;margin:0 auto 15px;max-width:1350px}',
      '.ac-labcard{max-width:1350px;margin:8px auto 0}',
      '.rt-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.rt-head h3{margin:0}.rt-head p{margin:4px 0 0;color:#a3c2c8}',
      '.rt-canvas{width:100%;overflow:auto;background:#081b24;border:1px solid #325460;border-radius:9px;margin:10px 0}',
      '.rt-canvas svg{display:block;min-width:620px;width:100%;height:auto}.rt-canvas .route-pin{cursor:pointer;outline:none}',
      '.rt-canvas .route-pin:focus circle{stroke:#ffd071;stroke-width:5}.rt-scenarios{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}',
      '.rt-scenarios button{color:#cfe9ec;background:#122d38;border:1px solid #42636b;border-radius:7px;padding:8px 11px;cursor:pointer}',
      '.rt-scenarios button.active{background:#14665a;border-color:#53baa1;color:#eefaf7}',
      '.rt-results{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.rt-results span{color:#a9bdc8}',
      '.rt-results button,.rt-head button{background:#194c46;border:1px solid #458c77;color:#eafaf6;padding:8px 11px;border-radius:7px;cursor:pointer}',
      '.rt-message{font-weight:600;color:#8ce0c8!important}.rt-intro,.rt-note{font-size:12px}.rt-hints{background:#102833;padding:11px;border-radius:7px;margin-top:11px}',
      '.rt-hints summary{cursor:pointer;color:#e2d097}.rt-hints ol{padding-left:20px}',
      '.ac-empty{padding:35px;text-align:center;color:#acc4cc}',
      '@media(max-width:1050px){.ac-shell{grid-template-columns:220px minmax(0,1fr)}.ac-lesson-grid{grid-template-columns:1fr}}',
      '@media(max-width:730px){.ac-shell{grid-template-columns:1fr}.ac-nav{max-height:265px}.ac-root{padding:10px}.ac-head h1{font-size:22px}.ac-head .ac-progress{text-align:left}}'
    ].join('');
    document.head.appendChild(s);
  }
  function render(){
    const root=document.querySelector('[data-academy-root]');
    if(!root)return;
    css();
    if(!curriculum){
      root.innerHTML='<div class="ac-empty"><h2>Learning Hub</h2><p>'+esc(lastError||'Memuat materi pembelajaran…')+'</p></div>';
      return;
    }
    const all=curriculum.stages||[],chosen=curriculum.tracks.find(x=>x.name===progress.track);
    const stages=chosen?all.filter(x=>chosen.stages.includes(x.id)):all;
    const current=lesson(progress.selected)||stages[0]?.lessons[0];
    const stage=stageFor(current?.id);
    const courseTotal=stages.reduce((a,s)=>a+s.lessons.length,0);
    const done=stages.reduce((a,s)=>a+count(s),0);
    const total=curriculum.totalLessons||all.reduce((a,s)=>a+s.lessons.length,0);
    const completion=Math.round((Object.keys(progress.completed).length/total)*100);
    const st=status(current.id);
    root.innerHTML=
      '<header class="ac-head"><div><span class="ac-kicker">SIRKUITLAB / ENGINEERING ACADEMY · 2026</span>'+
      '<h1>Dari nol sampai bisa membuat sistem nyata.</h1>'+
      '<p>PCB · Electrical · Electronics · Embedded · Smart Home · Robotics. Pelajari konsep, praktikkan dengan routing virtual, lalu buktikan keterampilan sebelum maju.</p></div>'+
      '<div class="ac-progress"><strong>'+completion+'% selesai</strong><span>'+Object.keys(progress.completed).length+' dari '+total+' pelajaran · '+Object.keys(progress.labs).length+'/3 routing lab</span>'+
      '<div class="ac-meter"><i style="width:'+completion+'%"></i></div>'+
      '<small>Progres latihan tersimpan di browser & backup proyek</small></div></header>'+
      '<div class="ac-alert"><b>Aturan keselamatan:</b> pemula memakai DC tegangan rendah dengan sumber dibatasi arus. Jangan praktik 230 V, sambungan PLN, baterai lithium mentah, atau pengawatan panel tanpa kompetensi dan pengawasan. Materi tidak menggantikan sertifikasi.</div>'+
      '<div class="ac-shell"><aside class="ac-nav"><label for="ac-track"><b>Jalur spesialisasi</b></label>'+
      '<select id="ac-track" class="ac-filter"><option value="all">Semua modul ('+all.length+')</option>'+
      curriculum.tracks.map(x=>'<option value="'+esc(x.name)+'" '+(progress.track===x.name?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select>'+
      '<small>'+done+'/'+courseTotal+' materi jalur aktif selesai · urutan bebas, tapi mulai dari dasar.</small>'+
      stages.map(s=>'<button class="ac-stage '+(s.id===stage.id?'active':'')+'" data-ac-stage="'+esc(s.id)+'">'+
      '<div class="ac-stage-line"><strong>'+esc(s.id)+' / '+esc(s.title)+'</strong><em>'+count(s)+'/'+s.lessons.length+'</em></div>'+
      '<small>'+esc(s.subtitle)+'</small></button>').join('')+'</aside>'+
      '<main class="ac-main"><article class="ac-card"><div class="ac-section-tag">MODUL '+esc(stage.id)+' · '+esc(stage.level.toUpperCase())+' · ±'+stage.weeks+' pekan</div>'+
      '<h2>'+esc(stage.title)+'</h2><p>'+esc(stage.goal)+'</p>'+
      '<div class="ac-lessons">'+stage.lessons.map(l=>'<button class="ac-pill '+(l.id===current.id?'active':'')+' '+(progress.completed[l.id]?'done':'')+'" data-ac-lesson="'+esc(l.id)+'">'+esc(l.title)+'</button>').join('')+'</div>'+
      '<div class="ac-lesson-grid"><div><section class="ac-concept"><strong>01 / PAHAMI KONSEPNYA</strong><p>'+esc(current.body)+'</p></section>'+
      '<section class="ac-concept"><strong>02 / CONTOH NYATA</strong><p>'+esc(current.example)+'</p></section>'+
      '<section class="ac-box practice"><h3>03 / COBA PRAKTIK</h3><p>'+esc(current.exercise)+'</p>'+
      '<label class="ac-check"><input type="checkbox" data-ac-practice '+(st.practice?'checked':'')+'><span>Gua sudah mencoba langkah praktik dan bisa menjelaskan hasilnya (penilaian diri, bukan sertifikat).</span></label></section>'+
      '<section class="ac-box"><h3>04 / KRITERIA LULUS</h3><p>'+esc(current.pass)+'</p></section></div>'+
      '<aside><section class="ac-box ac-quiz"><h3>Kuis pemahaman</h3><p>'+esc(current.quiz.question)+'</p>'+
      current.quiz.options.map((opt,i)=>'<button data-ac-answer="'+i+'">'+String.fromCharCode(65+i)+'. '+esc(opt)+'</button>').join('')+
      '<p id="ac-feedback" role="status" class="ac-note">'+(st.quiz?'Kuis sudah benar.':'Pilih satu jawaban; kalau salah, baca lagi materi.')+'</p>'+
      '<p class="ac-note">'+(st.done?'✓ Materi selesai.':st.practice&&st.quiz?'Sudah lulus.':'Selesai jika praktik sudah dikonfirmasi dan kuis benar.')+'</p></section>'+
      '<section class="ac-box"><h3>Referensi resmi</h3><div class="ac-links">'+
        stage.sources.map(s=>'<a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.title)+' ↗</a>').join('')+
        '</div><p class="ac-note">Pelajaran mengikuti praktik umum; dokumen standar lengkap yang berlisensi diperoleh secara resmi, bukan disalin tanpa izin.</p></section>'+
      '<section class="ac-box"><h3>Buka workspace</h3><p>Konsep ini bisa dicoba di editor yang sama setelah latihan dasar.</p>'+
      '<button class="ac-action" data-ac-workspace="'+esc(current.view)+'">Buka '+esc(current.view)+' →</button></section></aside></div>'+
      '<div class="ac-actions"><button data-ac-next>Materi berikutnya →</button><button data-ac-go-routing>Latihan Routing ↓</button></div></article></main></div>'+
      '<section class="ac-card ac-labcard"><div id="academy-routing"></div></section>';
    if(root.dataset.acBound!=='1'){
      root.dataset.acBound='1';
      root.addEventListener('click',event=>{
        const stg=event.target.closest('[data-ac-stage]');
        if(stg){const s=all.find(x=>x.id===stg.dataset.acStage);if(s)select(s.lessons[0].id);return;}
        const l=event.target.closest('[data-ac-lesson]');if(l){select(l.dataset.acLesson);return;}
        const ans=event.target.closest('[data-ac-answer]');
        if(ans){quiz(progress.selected,Number(ans.dataset.acAnswer));return;}
        const wr=event.target.closest('[data-ac-workspace]');if(wr){openWorkspace(wr.dataset.acWorkspace);return;}
        if(event.target.closest('[data-ac-next]')){
          const seq=(chosen?stages:all).flatMap(s=>s.lessons).map(l=>l.id);
          const index=seq.indexOf(progress.selected);
          select(seq[(index+1)%seq.length]);return;
        }
        if(event.target.closest('[data-ac-go-routing]'))root.querySelector('#academy-routing')?.scrollIntoView?.({block:'start',behavior:'smooth'});
      });
      root.addEventListener('change',event=>{
        if(event.target.matches('#ac-track'))selectTrack(event.target.value);
        if(event.target.matches('[data-ac-practice]'))togglePractice(progress.selected,event.target.checked);
      });
    }
    window.PCBProRoutingTrainer?.mount?.();
  }
  async function boot(){
    load();
    try{
      const resp=await fetch('/academy-curriculum-v128.json',{cache:'no-cache'});
      if(!resp.ok)throw Error('HTTP '+resp.status);
      const data=await resp.json();
      if(data.schema!=='sirkuitlab-academy-v1'||!Array.isArray(data.stages)||data.stages.length!==14||
        data.totalLessons!==42)throw Error('Kurikulum versi 1.28 tidak valid.');
      curriculum=data;ready=true;
    }catch(e){lastError='Materi belum bisa dimuat: '+String(e?.message||e);}
    render();
  }
  function open(){
    openWorkspace('Learning');
    setTimeout(render,0);
  }
  window.PCBProAcademy={version:VERSION,validate,snapshot,restore,quiz,togglePractice,markLab,select,selectTrack,open,render,
    get curriculum(){return curriculum},get ready(){return ready},get progress(){return snapshot()}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
  document.addEventListener('click',event=>{
    const b=event.target?.closest?.('.tabs button');
    if(b?.textContent?.trim()==='Learning')setTimeout(render,0);
  },{passive:true});
})();