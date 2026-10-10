(() => {
'use strict';
if(window.PCBProRoutingTrainer) return;
const VERSION='1.28.0';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const examples=[
  {id:'led',title:'01 · LED DC 5 V',intro:'Hubungkan +5 V → resistor 330 Ω → anoda LED → katoda LED → GND. Tidak ada kabel fisik yang disambung oleh latihan ini.',math:'I ≈ (5 V − 2 V) / 330 Ω = 9,1 mA; nilai LED nyata harus dari datasheet.',
   w:940,h:305,nodes:[
     {id:'SRC',label:'USB 5V (arus dibatasi)',x:25,y:85,w:210,h:145,pins:[['VCC','+5V',235,132],['GND','GND',235,193]]},
     {id:'R1',label:'R1 · 330 Ω',x:355,y:35,w:175,h:130,pins:[['1','1',355,110],['2','2',530,110]]},
     {id:'D1',label:'LED · anoda/katoda',x:688,y:85,w:215,h:145,pins:[['A','A',688,132],['K','K',688,193]]}
   ],edges:[['SRC.VCC','R1.1'],['R1.2','D1.A'],['D1.K','SRC.GND']],
   hints:['Pertama, klik pin +5V lalu pin 1 resistor.', 'Selanjutnya resistor pin 2 ke anoda LED (A).','Terakhir katoda (K) ke GND; tanpa hubungan GND tidak ada jalur arus balik.']},
  {id:'i2c',title:'02 · Sensor I²C 3,3 V',intro:'Buat empat hubungan: daya, ground, SDA dan SCL. Pada perangkat nyata, cek level logika, alamat I²C dan pull-up sesuai modul.',math:'Tidak semua board ESP32 memakai pin I²C tetap. SDA/SCL bisa dipetakan berbeda sesuai firmware dan pinout.',
   w:940,h:310,nodes:[
     {id:'MCU',label:'MCU · 3,3 V LOGIC',x:30,y:40,w:280,h:235,pins:[['3V3','3V3',310,93],['GND','GND',310,143],['SDA','SDA',310,193],['SCL','SCL',310,243]]},
     {id:'SENS',label:'I²C SENSOR · 3,3 V',x:635,y:40,w:270,h:235,pins:[['VCC','VCC',635,93],['GND','GND',635,143],['SDA','SDA',635,193],['SCL','SCL',635,243]]}
   ],edges:[['MCU.3V3','SENS.VCC'],['MCU.GND','SENS.GND'],['MCU.SDA','SENS.SDA'],['MCU.SCL','SENS.SCL']],
   hints:['Power: MCU 3V3 → sensor VCC, sesuai datasheet.','Reference: GND → GND.','SDA → SDA dan SCL → SCL, perhatikan pull-up modul.']},
  {id:'motor',title:'03 · Motor DC melalui driver',intro:'Latihan memisahkan logic PWM 3,3 V dan suplai motor 6 V. Sumber dan driver hanyalah ikon; arus stall, proteksi, dan persyaratan driver harus dicek sebelum rangkaian fisik.',math:'GPIO tidak boleh memberi suplai motor. Gunakan driver yang sesuai arus stall dan proteksi induktif.',
   w:1040,h:420,nodes:[
     {id:'MCU',label:'MCU · logic PWM',x:28,y:33,w:228,h:160,pins:[['PWM','PWM',256,90],['GND','GND',256,155]]},
     {id:'BAT',label:'Supply motor DC 6 V',x:28,y:242,w:228,h:150,pins:[['VM','+6V',256,285],['GND','GND',256,355]]},
     {id:'DRV',label:'H-bridge motor driver',x:465,y:72,w:235,h:275,pins:[['IN','IN',465,122],['GND','GND',465,182],['VM','VM',465,253],['M+','OUT +',700,155],['M-','OUT −',700,264]]},
     {id:'M',label:'DC MOTOR',x:852,y:165,w:162,h:135,pins:[['+','+',852,206],['-','-',852,268]]}
   ],edges:[['MCU.PWM','DRV.IN'],['MCU.GND','DRV.GND'],['BAT.VM','DRV.VM'],['BAT.GND','DRV.GND'],['DRV.M+','M.+'],['DRV.M-','M.-']],
   hints:['PWM MCU menuju IN driver, bukan menuju motor.','GND MCU dan BAT masing-masing ke GND driver pada diagram logika sederhana (cek datasheet).','+6V ke VM driver, output M+ dan M− driver ke motor.']}
];
const locate=(ex,id)=>ex.nodes.flatMap(n=>n.pins.map(p=>({id:n.id+'.'+p[0],x:p[2],y:p[3],label:p[1]}))).find(x=>x.id===id);
const edgeKey=(a,b)=>[a,b].sort().join('|');
function evaluate(ex,edges){
 const expected=new Set(ex.edges.map(([a,b])=>edgeKey(a,b)));
 const actual=new Set(edges.map(([a,b])=>edgeKey(a,b)));
 const correct=[...actual].filter(x=>expected.has(x)).length;
 const incorrect=[...actual].filter(x=>!expected.has(x));
 const missing=[...expected].filter(x=>!actual.has(x));
 return {ok:incorrect.length===0&&missing.length===0,correct,needed:expected.size,incorrect,missing};
}
let active='led',edges=[],selected=null,message='Klik satu pin, lalu klik pin tujuan untuk membuat koneksi.';
function draw(){
 const root=document.querySelector('#academy-routing');
 if(!root)return;
 const ex=examples.find(x=>x.id===active)||examples[0];
 const result=evaluate(ex,edges);
 const routes=edges.map(([a,b])=>{
   const u=locate(ex,a),v=locate(ex,b);if(!u||!v)return '';
   const isCorrect=ex.edges.some(([x,y])=>edgeKey(x,y)===edgeKey(a,b));
   return '<path d="M '+u.x+' '+u.y+' L '+v.x+' '+v.y+'" fill="none" stroke="'+(isCorrect?'#44ceb0':'#e58475')+'" stroke-width="4" stroke-linecap="round" opacity=".9"/>';
 }).join('');
 const shapes=ex.nodes.map(n=>{
   const pins=n.pins.map(p=>{
     const id=n.id+'.'+p[0];
     return '<g class="route-pin '+(selected===id?'selected':'')+'" data-terminal="'+esc(id)+'" role="button" tabindex="0" aria-label="'+esc(n.label+' '+p[1])+'">'+
       '<circle cx="'+p[2]+'" cy="'+p[3]+'" r="12" fill="'+(selected===id?'#ffc878':'#1e766d')+'" stroke="#d8fffa" stroke-width="2"/>'+
       '<text x="'+(p[2]+(p[2]<=n.x+4?-23:18))+'" y="'+(p[3]+4)+'" font-family="Arial" font-size="12" text-anchor="'+(p[2]<=n.x+4?'end':'start')+'" fill="#e8f8f7">'+esc(p[1])+'</text></g>';
   }).join('');
   return '<rect x="'+n.x+'" y="'+n.y+'" width="'+n.w+'" height="'+n.h+'" rx="12" fill="#16343d" stroke="#577b86" stroke-width="2"/>'+
      '<text x="'+(n.x+18)+'" y="'+(n.y+34)+'" font-size="15" font-family="Arial" fill="#f1f8fa">'+esc(n.label)+'</text>'+pins;
 }).join('');
 root.innerHTML='<div class="rt-head"><div><h3>Routing Lab · Schematic → Net → PCB</h3>'+
   '<p>Latihan kabel virtual tegangan rendah. Koneksi salah diberi merah, benar diberi hijau.</p></div>'+
   '<button data-route-action="reset">Reset kabel</button></div>'+
   '<div class="rt-scenarios">'+examples.map(item=>
     '<button class="'+(active===item.id?'active':'')+'" data-route-scenario="'+item.id+'">'+esc(item.title)+'</button>').join('')+'</div>'+
   '<p class="rt-intro">'+esc(ex.intro)+'</p>'+
   '<div class="rt-canvas"><svg viewBox="0 0 '+ex.w+' '+ex.h+'" role="group" aria-label="Routing pin virtual">'+routes+shapes+'</svg></div>'+
   '<p class="rt-message" role="status">'+esc(message)+'</p>'+
   '<div class="rt-results"><b>'+result.correct+' / '+result.needed+' koneksi benar</b>'+
   '<span>'+result.incorrect.length+' koneksi salah, '+result.missing.length+' belum disambung</span>'+
   '<button data-route-action="check">Periksa routing</button><button data-route-action="undo">Undo kabel</button></div>'+
   '<details class="rt-hints"><summary>Petunjuk dan hitungan</summary><p>'+esc(ex.math)+'</p>'+
   '<ol>'+ex.hints.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol></details>'+
   '<p class="rt-note">Routing Lab adalah latihan konektivitas logis. Ini BUKAN simulator kelistrikan, PCB Gerber, atau instruksi pemasangan AC. Sesudah paham, praktikkan skematik dan PCB pada tab aslinya.</p>';
}
function choose(pin){
 const ex=examples.find(x=>x.id===active);
 if(!locate(ex,pin))return;
 if(!selected){selected=pin;message='Dipilih '+pin+'. Klik pin tujuan atau klik lagi untuk batalkan.';draw();return;}
 if(selected===pin){selected=null;message='Pilihan dibatalkan.';draw();return;}
 const key=edgeKey(selected,pin);
 if(edges.some(([a,b])=>edgeKey(a,b)===key)){
   edges=edges.filter(([a,b])=>edgeKey(a,b)!==key);
   message='Koneksi '+selected+' ↔ '+pin+' dilepas.';
 }else{
   edges.push([selected,pin]);
   const correct=ex.edges.some(([a,b])=>edgeKey(a,b)===key);
   message=correct?'Koneksi benar: '+selected+' ↔ '+pin+'.':'Koneksi '+selected+' ↔ '+pin+' tidak sesuai rute latihan. Gunakan Periksa Routing.';
 }
 selected=null;draw();
}
function check(){
 const ex=examples.find(x=>x.id===active),r=evaluate(ex,edges);
 if(r.ok){
   message='LULUS '+ex.title+' · seluruh jalur konektivitas tepat. Sekarang buka Schematic dan PCB untuk praktik lanjutan.';
   window.PCBProAcademy?.markLab?.(active);
 } else {
   message='Belum lulus: '+r.correct+'/'+r.needed+' benar; '+r.incorrect.length+' salah, '+r.missing.length+' hilang. Buka Petunjuk bila perlu.';
 }
 draw();return r;
}
function mount(){
 const root=document.querySelector('#academy-routing');if(!root)return;
 if(root.dataset.routingBound!=='1'){
  root.dataset.routingBound='1';
  root.addEventListener('click',event=>{
   const pin=event.target?.closest?.('[data-terminal]');
   if(pin){choose(pin.dataset.terminal);return;}
   const scenario=event.target?.closest?.('[data-route-scenario]');
   if(scenario){active=scenario.dataset.routeScenario;edges=[];selected=null;message='Pilih dua pin untuk membentuk koneksi baru.';draw();return;}
   const action=event.target?.closest?.('[data-route-action]')?.dataset.routeAction;
   if(action==='reset'){edges=[];selected=null;message='Routing direset.';draw();}
   if(action==='undo'){edges.pop();selected=null;message='Kabel terakhir dibatalkan.';draw();}
   if(action==='check')check();
  });
  root.addEventListener('keydown',event=>{
   if((event.key==='Enter'||event.key===' ') && event.target.closest?.('[data-terminal]')){
     event.preventDefault();choose(event.target.closest('[data-terminal]').dataset.terminal);
   }
  });
 }
 draw();
}
function start(){mount();}
window.PCBProRoutingTrainer={version:VERSION,examples,locate,evaluate,mount,choose,check,
 get state(){return {active,edges:structuredClone(edges),selected}}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();