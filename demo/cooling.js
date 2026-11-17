import {CHANNEL_FIELDS} from '../src/cooling-config.js';

export const CHANNEL_BOUNDS=Object.fromEntries(CHANNEL_FIELDS.map(f=>[f.key,[f.min,f.max]]));
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
// Shape/amplitude choices below are illustrative, not heat-transfer correlations.
// Engineering coolant tables and the original channel algorithm are never used.
export function coolantAt(data,temperatureK,pressureBar){
  if(!data?.demo||!(temperatureK>0)||!(pressureBar>0))throw Error('Demo-Kühlung: ungültiger Eintrittszustand oder Druck.');
  return {rhoKgM3:data.fluid.rho,muPaS:data.fluid.mu,cpJkgK:data.cpJkgK,kWmK:null,hJkg:data.cpJkgK*temperatureK};
}
export function staticPressureAt(data,temperatureK,totalPressureBar,areaM2,massFlowKgS){
  const f=coolantAt(data,temperatureK,totalPressureBar);
  const pressure=totalPressureBar-massFlowKgS**2/(2*f.rhoKgM3*areaM2**2)/1e5;
  if(!(pressure>0))throw Error('Demo-Kühlung: nicht positiver statischer Druck.');
  return pressure;
}
export function solveCooling({params:p,geometry:g,design,thermo,data,massFlowKgS:mdot,inletTemperatureK:tin,inletPressureBar:pin}){
  for(const [key,[min,max]] of Object.entries(CHANNEL_BOUNDS))if(!Number.isFinite(p[key])||p[key]<min||p[key]>max||(['channelCount','stations'].includes(key)&&!Number.isInteger(p[key])))throw Error('Demo-Kühlkanal: ungültiger Parameter '+key+'.');
  const start=p.coolingStart??0,end=p.coolingEnd??1,direction=p.flowDirection??'counter';
  if(!['co','counter'].includes(direction)||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>1||end-start<.01-1e-10)throw Error('Demo-Kühlstrecke: mindestens 1 % Länge und gültige Strömungsrichtung erforderlich.');
  if(!(mdot>0)||!g?.contour?.length)throw Error('Demo-Kühlung: Massenstrom oder Kontur fehlen.');
  const fullLength=g.contour.at(-1).x,throatX=g.contour.reduce((a,b)=>a.r<b.r?a:b).x;
  const a=start*fullLength,b=end*fullLength,length=b-a;
  const radius=x=>{let i=0;while(i<g.contour.length-2&&g.contour[i+1].x<x)i++;const u=g.contour[i],v=g.contour[i+1];return u.r+(v.r-u.r)*(x-u.x)/(v.x-u.x);};
  const xs=[...new Set([...Array.from({length:p.stations+1},(_,i)=>a+length*i/p.stations),...(throatX>a&&throatX<b?[throatX]:[])])].sort((x,y)=>x-y);
  const shape=x=>{const z=(x-throatX)/(fullLength*.085);return .12+.53*Math.exp(-Math.max(0,x-throatX)/(fullLength*.28))+1.3*Math.exp(-z*z);};
  const qAt=x=>4e6*Math.pow(design.pcBar/30,.45)*shape(x);
  const heights=p.channelHeightMm/2,count=p.channelCount/120,width=p.channelWidthFraction/.65;
  const response=clamp(Math.pow(mdot,.18)*Math.pow(count,.12)*Math.pow(width,.1)/Math.pow(heights,.2),.65,1.5);
  const lossTotal=(2.5*length/.3*Math.pow(mdot,1.1)/Math.pow(heights,1.25)/Math.pow(count*width,.6)+p.minorK*.12)*(1+p.roughnessMm*5);
  const ordered=direction==='co'?xs:[...xs].reverse(),fluid=coolantAt(data,tin,pin),stations=[];
  const weights=ordered.slice(1).map((x,i)=>Math.abs(x-ordered[i])*(.35+shape((x+ordered[i])/2)));
  const weightSum=weights.reduce((s,x)=>s+x,0);let temperature=tin,heatW=0,loss=0;
  for(let i=0;i<ordered.length;i++){
    const x=ordered[i],r=radius(x);let segmentHeatW=0,frictionDropBar=0;
    if(i){const prev=ordered[i-1],mid=(x+prev)/2,ds=Math.hypot(x-prev,r-radius(prev));segmentHeatW=qAt(mid)*2*Math.PI*radius(mid)*ds;heatW+=segmentHeatW;temperature+=segmentHeatW/(mdot*fluid.cpJkgK);frictionDropBar=lossTotal*weights[i-1]/weightSum;loss+=frictionDropBar;}
    const peak=Math.exp(-(((x-throatX)/(fullLength*.10))**2));
    const hotWall=temperature+(170+260*peak)/response;
    const wallGap=clamp((25+45*peak)*p.wallThicknessMm*320/p.wallConductivityWmK,5,hotWall-temperature-25);
    const coldWall=hotWall-wallGap,gasRecovery=thermo.tcK*(.94-.2*Math.max(0,x-throatX)/Math.max(fullLength-throatX,.001));
    const pitch=2*Math.PI*r/p.channelCount,channelWidth=pitch*p.channelWidthFraction,area=channelWidth*p.channelHeightMm/1000*p.channelCount;
    const pressure=pin-loss,velocity=mdot/(fluid.rhoKgM3*area),q=qAt(x);
    if(!(pressure>0)||!Number.isFinite(hotWall)||hotWall>=gasRecovery)throw Error('Demo-Kühlung außerhalb ihres Darstellungsbereichs. Massenstrom, Strecke oder Kanäle prüfen.');
    stations.push({xM:x,radiusM:r,coolantTemperatureK:temperature,coolantPressureBar:pressure,hotWallTemperatureK:hotWall,coldWallTemperatureK:coldWall,heatFluxWm2:q,gasRecoveryTemperatureK:gasRecovery,gasHTCWm2K:q/(gasRecovery-hotWall),coolantHTCWm2K:q/(coldWall-temperature),channelWidthMm:channelWidth*1000,velocityMS:velocity,reynolds:null,mach:null,sampleKind:i?'demo-segment':'demo-inlet',segmentHeatW,frictionDropBar,accelerationDropBar:0,demo:true});
  }
  return {mode:'channels',demo:true,modelId:'representative-cooling-v2',flowDirection:direction,coolingStart:start,coolingEnd:end,inletXM:ordered[0],outletXM:ordered.at(-1),cooledLengthM:length,fullCoverage:start===0&&end===1,heatKW:heatW/1000,dropBar:loss,inletTemperatureK:tin,outletTemperatureK:temperature,inletPressureBar:pin,outletPressureBar:pin-loss,inletStaticPressureBar:pin,outletStaticPressureBar:pin-loss,massFlowKgS:mdot,maxHotWallTemperatureK:Math.max(...stations.map(s=>s.hotWallTemperatureK)),maxHeatFluxWm2:Math.max(...stations.map(s=>s.heatFluxWm2)),wallMarginK:null,feasible:true,throatX,energyResidualW:heatW-mdot*fluid.cpJkgK*(temperature-tin),stations:stations.sort((a,b)=>a.xM-b.xM),warnings:['Demo-Kühlung: repräsentative Werte mit Einheiten, keine validierte thermische Auslegung.','Demo-Kühlung: konstante Feed-Stoffwerte und pauschales cp; keine Phasen-, Material- oder Lebensdauerbewertung. Der Druckverlauf zeigt das vereinfachte Verlustbudget ohne Beschleunigungsdruck.']};
}
