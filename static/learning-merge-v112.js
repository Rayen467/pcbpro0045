(() => {
  'use strict';
  if (window.PCBProLearningMergeV112) return;
  const VERSION='1.12.0';
  let expansion=null;
  let merged=false;

  async function load(){
    if(expansion) return expansion;
    const r=await fetch('/learning-expansion-v112.json',{cache:'no-store'});
    if(!r.ok) throw new Error(`learning expansion HTTP ${r.status}`);
    expansion=await r.json();
    return expansion;
  }

  function merge(){
    const base=window.PCBProLearningCenter?.curriculum;
    if(!base?.branches?.length||!expansion?.branches?.length)return false;
    for(const b of expansion.branches){
      const existing=base.branches.find(x=>x.id===b.id);
      if(!existing){base.branches.push(structuredClone(b));continue}
      existing.summary=b.summary||existing.summary;
      const topicMap=new Map((existing.topics||[]).map(x=>[x.id,x]));
      for(const topic of b.topics||[]){const old=topicMap.get(topic.id);if(old)Object.assign(old,topic);else(existing.topics||(existing.topics=[])).push(structuredClone(topic))}
    }
    base.deepExpansion={version:expansion.version,sourceOutline:expansion.sourceOutline,policy:expansion.policy};
    merged=true;
    window.PCBProLearningCenter?.refresh?.();
    window.dispatchEvent(new CustomEvent('pcbpro:learning-expanded',{detail:{version:VERSION}}));
    return true;
  }

  async function boot(){
    try{await load()}catch(e){console.warn('[PCB Pro Learning Merge]',e);return}
    for(let i=0;i<40&&!merge();i++)await new Promise(r=>setTimeout(r,100));
  }

  window.PCBProLearningMergeV112={version:VERSION,load,merge,get data(){return expansion},get merged(){return merged}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();