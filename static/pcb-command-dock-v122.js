(() => {
  'use strict';
  if (window.PCBProPcbDock) return;

  const VERSION='1.22.0';
  let dock=null;

  function installStyles(){
    if(document.querySelector('#pcbpro-pcb-dock-style')) return;
    const s=document.createElement('style');
    s.id='pcbpro-pcb-dock-style';
    s.textContent=`
      .content.pcb-dock-layout{flex-direction:column!important;gap:0!important;overflow:hidden!important}
      .content.pcb-dock-layout>.pcbstage{flex:1 1 auto!important;width:100%!important;min-height:0!important}
      #pcbpro-pcb-command-dock{flex:0 0 auto;min-width:0;display:flex;align-items:center;gap:6px;padding:5px 7px;border-bottom:1px solid #1d3340;background:#08141ced;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin;white-space:nowrap;z-index:5}
      #pcbpro-pcb-command-dock .pcb-dock-slot{display:flex;align-items:center;gap:5px;min-width:max-content}
      #pcbpro-pcb-command-dock .pcb-dock-divider{width:1px;height:24px;background:#29414d;flex:0 0 1px}
      #pcbpro-pcb-command-dock button,#pcbpro-pcb-command-dock select{height:28px!important;min-height:28px!important;padding:0 8px!important;font-size:8px!important;border-radius:6px!important}
      #pcbpro-pcb-command-dock b,#pcbpro-pcb-command-dock span{font-size:7px}
      @media(max-width:900px){#pcbpro-pcb-command-dock{gap:4px;padding:4px 6px}#pcbpro-pcb-command-dock .pcb-dock-divider{height:22px}}
    `;
    document.head.appendChild(s);
  }

  function cleanup(){
    const content=document.querySelector('.content');
    if(content && !content.querySelector('.pcbstage')) content.classList.remove('pcb-dock-layout');
    if(dock && !document.querySelector('.pcbstage')){dock.remove();dock=null}
  }

  function ensure(){
    installStyles();
    const stage=document.querySelector('.stage.pcbstage');
    const content=stage?.parentElement;
    if(!stage||!content){cleanup();return null}
    content.classList.add('pcb-dock-layout');
    if(!dock?.isConnected || dock.parentElement!==content){
      dock=document.querySelector('#pcbpro-pcb-command-dock');
      if(!dock){
        dock=document.createElement('div');
        dock.id='pcbpro-pcb-command-dock';
        dock.innerHTML='<div class="pcb-dock-slot" data-slot="routing"></div><i class="pcb-dock-divider"></i><div class="pcb-dock-slot" data-slot="advanced"></div>';
      }
      content.insertBefore(dock,stage);
    }
    return dock;
  }

  function slot(name){
    const root=ensure();
    return root?.querySelector('[data-slot="'+String(name)+'"]')||null;
  }

  function attach(node,name='routing'){
    if(!node) return null;
    const host=slot(name);
    if(host && node.parentElement!==host) host.appendChild(node);
    return host;
  }

  function refresh(){ensure();cleanup()}

  function start(){
    refresh();
    document.addEventListener('click',()=>setTimeout(refresh,0),{passive:true});
    window.addEventListener('resize',refresh,{passive:true});
  }

  window.PCBProPcbDock={version:VERSION,ensure,slot,attach,refresh};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();