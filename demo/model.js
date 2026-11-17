import {parseProject} from '../src/state.js';
import {coolingParams} from '../src/cooling-layout.js';

// Deliberately invented visual response functions. No thermophysical tables,
// transport correlations, calibration, or private solver is used here.
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const number=(v,fallback)=>Number.isFinite(v)?v:fallback;
const round=v=>Math.round(clamp(v));
const meta={model:'AstroForge Lite Demo 2.11.0',synthetic:true,validated:false,units:'relative-demo-index',purpose:'Workflow demonstration only; no engineering prediction'};
const failure=errors=>({ok:false,demo:true,meta,errors,warnings:[]});

export function evaluateDemo(input){
  let p;try{p=parseProject(JSON.stringify(input));}catch{return failure([{message:'Die Projektstruktur ist nicht lesbar.'}]);}
  const nodes=new Map(p.nodes.map(n=>[n.id,n])),out=new Map(p.nodes.map(n=>[n.id,[]]));
  const errors=[];
  for(const e of p.edges){
    const a=nodes.get(e.from),b=nodes.get(e.to);
    if(!a||!b){errors.push({edgeId:e.id,message:'Verbindung ohne gültige Bauteile.'});continue;}
    if(a.medium!==b.medium&&!(b.type==='injector'&&['fuel','ox'].includes(a.medium)))errors.push({edgeId:e.id,message:'Getrennte Medien dürfen erst im Injektor zusammenkommen.'});
    out.get(e.from).push(e.to);
  }
  const visiting=new Set(),visited=new Set();
  function cycle(id){if(visiting.has(id))return true;if(visited.has(id))return false;visiting.add(id);for(const next of out.get(id)||[])if(cycle(next))return true;visiting.delete(id);visited.add(id);return false;}
  if(p.nodes.some(n=>cycle(n.id)))errors.push({message:'Die Demo unterstützt gerichtete Pfade ohne Kreislauf.'});
  const reachable=(from,to,medium)=>{
    const queue=[from],seen=new Set();
    while(queue.length){const id=queue.pop();if(seen.has(id))continue;seen.add(id);const n=nodes.get(id);if(!n||n.type==='valve'&&n.params.open===false)continue;
      if(id===to)return true;
      if(medium&&n.medium!==medium)continue;
      queue.push(...(out.get(id)||[]));
    }return false;
  };
  const injector=p.nodes.find(n=>n.type==='injector'),chamber=p.nodes.find(n=>n.type==='chamber'),nozzle=p.nodes.find(n=>n.type==='nozzle');
  if(!injector||!chamber||!nozzle||!reachable(injector.id,chamber.id)||!reachable(chamber.id,nozzle.id))errors.push({message:'Injektor, Brennkammer und Hauptdüse müssen verbunden sein.'});
  for(const medium of ['fuel','ox'])if(injector&&!p.nodes.some(n=>n.type==='source'&&n.medium===medium&&reachable(n.id,injector.id,medium)))errors.push({message:(medium==='fuel'?'Brennstoff':'Oxidator')+' braucht einen offenen Versorgungspfad zum Injektor.'});
  const active=n=>p.nodes.some(s=>['source','coolantSource'].includes(s.type)&&s.medium===n.medium&&reachable(s.id,n.id,n.medium))&&p.nodes.some(t=>(t.type==='injector'||t.type==='consumer'&&t.medium===n.medium)&&reachable(n.id,t.id,n.medium));
  const cooling=p.nodes.filter(n=>n.type==='regen');
  for(const n of cooling){
    if(!active(n))errors.push({nodeId:n.id,message:'Kühlmantel braucht einen offenen Zulauf und einen verbundenen Abgang.'});
    const c=coolingParams(p,n);
    if(!(number(c.coolingStart,0)>=0&&number(c.coolingEnd,1)<=1&&number(c.coolingEnd,1)>number(c.coolingStart,0)))errors.push({nodeId:n.id,message:'Die Kühlstrecke braucht einen Beginn vor ihrem Ende.'});
  }
  if(errors.length)return failure(errors);
  const load=clamp(25+number(p.design.pcBar,30)*.45+number(p.design.thrustN,10000)/5000,15,80);
  const profiles=cooling.map(n=>{
    const c=coolingParams(p,n),start=number(c.coolingStart,0),end=number(c.coolingEnd,1),span=end-start;
    const openness=clamp(number(c.channelHeightMm,2)/2,.1,5);
    const coolingEffect=clamp(20+number(c.channelCount,120)/9+openness*5+number(c.channelWidthFraction,.65)*12+number(c.wallConductivityWmK,320)/60-number(c.wallThicknessMm,1)*3,5,70);
    const resistance=clamp(span*(20/openness+number(c.minorK,1)*2+number(c.roughnessMm,.005)*100),2,85);
    const stations=Array.from({length:41},(_,i)=>{
      const position=start+span*i/40,progress=c.flowDirection==='co'?i/40:1-i/40;
      const heat=load*(.55+.65*Math.exp(-(((position-.42)/.17)**2)));
      const coolant=15+progress*span*(8+coolingEffect*.35);
      const gasWall=heat*(1-coolingEffect/180)+coolant*.18;
      return {position,heatIndex:round(heat),coolantIndex:round(coolant),gasWallIndex:round(gasWall),channelWallIndex:round(gasWall-4-number(c.wallThicknessMm,1)*2),pressureLossIndex:round(progress*resistance),transferIndex:round(coolingEffect*(.75+.25*Math.sin(Math.PI*position)))};
    });
    return {nodeId:n.id,label:n.label,direction:c.flowDirection==='co'?'co':'counter',start,end,coolingEffectIndex:round(coolingEffect*span),resistanceIndex:round(resistance),stations};
  });
  const edgeDemo={};let pipeBurden=0;
  for(const e of p.edges){const n=nodes.get(e.from);if(!['fuel','ox'].includes(n.medium)||!active(n))continue;
    const pipe=e.pipe||{};
    const index=round(number(pipe.lengthM,0)*3+number(pipe.k,0)*2+20/clamp(number(pipe.diameterMm,20)/10,.1,20));
    edgeDemo[e.id]={resistanceIndex:index};pipeBurden+=index/4;
  }
  const coolingEffect=profiles.reduce((sum,c)=>sum+c.coolingEffectIndex,0);
  const coolingResistance=profiles.reduce((sum,c)=>sum+c.resistanceIndex,0);
  const componentBurden=p.nodes.filter(n=>active(n)).reduce((sum,n)=>sum+(n.type==='restriction'?10/clamp(number(n.params.diameterMm,10)/10,.1,20):number(n.params.k,0)),0);
  const feedBurden=round(8+pipeBurden+componentBurden+coolingResistance*.55);
  const thermalLoad=round(load-coolingEffect*.35);
  return {ok:true,demo:true,meta,errors:[],warnings:['Alle Indizes und Kurven sind frei definierte Demo-Reaktionen ohne physikalische Kalibrierung.','Keine Stoffdaten-, Leistungs-, Festigkeits- oder Freigabeberechnung. Brennstoffwahl beschriftet den Entwurf; es wird kein realer Stoffvergleich berechnet.'],summary:{thermalLoadIndex:thermalLoad,coolingEffectIndex:round(coolingEffect),feedBurdenIndex:feedBurden,systemBurdenIndex:round(thermalLoad*.55+feedBurden*.45)},profiles,edgeDemo};
}
