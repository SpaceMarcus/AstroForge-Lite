export const COOLING_NOTICE='Kühlung als Demo: Wand-/Kühlmitteltemperaturen, Wärmeübergang und Kühldruckverlust sind repräsentativ, nicht validiert. Diese Kühlwerte gehen in die Feed-Bilanz ein. Schub, Isp, Massenströme und Geometrie verwenden weiterhin die bisherigen Modelle.';

// Metadata only; the existing performance, feed and component calculations are retained.
export function annotateResult(result,project){
  const affected=project.nodes.some(n=>n.type==='regen');
  if(!affected)return result;
  const marked={...result,meta:{...result.meta,coolingDemo:true,systemIncludesDemoCooling:true,feedModel:'Existing feed correlations and component models with constant feed properties; representative cooling heat/loss',coolingModel:'Representative cooling v2 — not validated',coolingSource:'Public illustrative model; private channel solver excluded',coolantSource:'Fixed feed properties and demo heat capacity',pressureBasis:'Existing feed pressure budget with representative cooling loss; cooling chart omits acceleration'},warnings:[COOLING_NOTICE,...result.warnings.filter(w=>!(/Bartz|n-Dodecan|Ethanol.*einphasig|temperatur- und druckabhängigen Ersatzstoffwerten|Kühlmittel gemäß T\/p-Tabelle|Kühlung: ausgewiesene Stoffdaten/.test(w)))]};
  if(result.cycle)marked.cycle={...result.cycle,cooling:result.cycle.cooling.map(c=>({...c,demo:true,feasible:null,wallMarginK:null}))};
  return marked;
}
