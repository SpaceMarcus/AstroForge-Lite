// Public demo adapter: no private coolant or hot-gas transport tables.
const CP={rp1:2200,methane:3500,hydrogen:10000,ethanol:2400,propane:2700};
export function coolingDataStatus(pair,catalog={}){
  const fluid=catalog?.fluids?.[pair.fuel];
  if(!fluid||!CP[pair.fuel])return {available:false,issues:[{code:'demo-coolant-missing',message:'Für diesen Brennstoff fehlt die Demo-Kühlmittelannahme.'}]};
  return {available:true,issues:[],coolantId:pair.fuel,coolantLabel:fluid.label,data:{demo:true,coolantId:pair.fuel,fluid,cpJkgK:CP[pair.fuel],source:'Repräsentative Demo-Kühlung, nicht kalibriert',coolant:{source:'Konstante Feed-Dichte/-Viskosität; pauschales Demo-cp; keine Phasenrechnung',axes:{pressureBar:[0,500]}}}};
}
