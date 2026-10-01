(() => {
  'use strict';
  if (window.PCBProBoardWorkflowBridge) return;
  const VERSION='1.0.0';
  function install(){
    if(!window.PCBProBoardModel)return false;
    const project=window.PCBProProject||{};
    for(const key of ['traces','zones','boardOutline']){
      try{delete project[key]}catch{}
    }
    Object.defineProperties(project,{
      traces:{configurable:true,get(){const x=window.PCBProBoardModel?.tracks||[];return x.length?x:null}},
      zones:{configurable:true,get(){const x=window.PCBProBoardModel?.zones||[];return x.length?x:null}},
      boardOutline:{configurable:true,get(){const x=window.PCBProBoardModel?.outline||[];return x.length>=3?x:null}}
    });
    window.PCBProProject=project;
    window.PCBProWorkflow?.refresh?.();
    return true;
  }
  window.addEventListener('pcbpro:board-changed',()=>{install();window.PCBProWorkflow?.refresh?.()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});else setTimeout(install,0);
  window.PCBProBoardWorkflowBridge={version:VERSION,install};
})();