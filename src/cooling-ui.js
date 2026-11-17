export {CHANNEL_FIELDS, CHANNEL_DEFAULTS} from './cooling-config.js';

export const CHANNEL_NOTE = 'Kanalgeometrie entlang der aktuellen Kammer-/Düsenkontur. Brennstoffmassenstrom und Eintrittszustand kommen aus dem Versorgungspfad. Wärmeaufnahme, Druckverlust sowie heiße/kalte Wandtemperatur werden stationsweise berechnet. Die eingegebene Temperaturgrenze ist ein Vergleichswert, kein qualifizierter Werkstoffnachweis.';

const scaled=(value,factor=1)=>Number.isFinite(value)?value*factor:NaN;

const VIEWS = {
  hotWall:{label:'Gasseitige Wandtemperatur',unit:'K',series:[['hotWallTemperatureK','Innere Kammer-/Düsenwand · Gasseite','#f0ab73']],scale:1,wallLimit:true},
  coldWall:{label:'Kühlmittelseitige Wandtemperatur',unit:'K',series:[['coldWallTemperatureK','Kanalwand · Kühlmittelseite','#bca2e9']],scale:1},
  coolant:{label:'Kühlmitteltemperatur',unit:'K',series:[['coolantTemperatureK','Kühlmittel','#70d0df']],scale:1},
  heatflux:{label:'Wärmestromdichte',unit:'MW/m²',series:[['heatFluxWm2','Wärmestromdichte','#f0ab73']],scale:1e-6},
  pressure:{label:'Kühlmitteldruck',unit:'bar',series:[['coolantPressureBar','Statischer Kühlmitteldruck','#70d0df']],scale:1},
  transfer:{label:'Wärmeübergangskoeffizienten',unit:'kW/(m²·K)',series:[['gasHTCWm2K','Gasseite','#f0ab73'],['coolantHTCWm2K','Kühlmittelseite','#70d0df']],scale:0.001},
};

function selectedIndex(stations, requested) {
  if (Number.isInteger(requested) && requested >= 0 && requested < stations.length) return requested;
  let selected = 0;
  for (let i=1;i<stations.length;i++) if (stations[i].hotWallTemperatureK > stations[selected].hotWallTemperatureK) selected=i;
  return selected;
}

function chart(entry, view, selected, esc, fmt) {
  const spec=entry.demo&&view==='pressure'?{...VIEWS.pressure,series:[['coolantPressureBar','Druckbudget · Demo','#70d0df']]}:VIEWS[view],stations=entry.stations;
  const left=58,right=535,top=35,bottom=246;
  const positions=stations.map(s=>s.xM).filter(Number.isFinite);
  const minX=Math.min(...positions),maxX=Math.max(...positions);
  const values=stations.flatMap(s=>spec.series.map(([key])=>scaled(s[key],spec.scale))).filter(Number.isFinite);
  if(!values.length||!positions.length)return '<p class="chart-unavailable">Für dieses Diagramm liegen keine Werte vor.</p>';
  const limit=entry.demo?NaN:entry.maxHotWallTemperatureK+entry.wallMarginK;
  if(spec.wallLimit&&Number.isFinite(limit))values.push(limit);
  const rawMin=Math.min(...values),rawMax=Math.max(...values);
  const range=Math.max(rawMax-rawMin,Math.abs(rawMax)*0.05,1);
  const minY=entry.demo?Math.max(0,rawMin-range*0.08):rawMin-range*0.08,maxY=rawMax+range*0.12;
  const x=v=>left+(v-minX)/Math.max(maxX-minX,0.000001)*(right-left);
  const y=v=>bottom-(v-minY)/Math.max(maxY-minY,0.000001)*(bottom-top);
  const coord=v=>Number.isFinite(v)?v.toFixed(2):'0';
  const value=(v,d=1)=>esc(fmt(v,d));
  let svg=`<svg class="cooling-chart" viewBox="0 0 560 290" role="img" aria-label="${esc(spec.label)} entlang der Kammer- und Düsenachse; markierte Station ${selected+1}"><text class="axis-label" x="${left}" y="17">${esc(spec.unit)}${entry.demo?' · DEMO':''}</text>`;
  for(let i=0;i<=4;i++){
    const v=minY+(maxY-minY)*i/4,py=y(v);
    svg+=`<line class="plot-grid" x1="${left}" x2="${right}" y1="${coord(py)}" y2="${coord(py)}"/><text class="axis-tick" x="${left-8}" y="${coord(py+4)}" text-anchor="end">${value(v,spec.unit==='K'?0:1)}</text>`;
  }
  for(let i=0;i<=4;i++){
    const v=minX+(maxX-minX)*i/4,px=x(v);
    svg+=`<text class="axis-tick" x="${coord(px)}" y="264" text-anchor="middle">${value(v*1000,0)}</text>`;
  }
  svg+=`<text class="axis-label" x="${right}" y="283" text-anchor="end">Axiale Position x [mm]</text>`;
  if(Number.isFinite(entry.throatX)&&entry.throatX>=minX&&entry.throatX<=maxX){
    const tx=x(entry.throatX);
    svg+=`<line x1="${coord(tx)}" x2="${coord(tx)}" y1="${top}" y2="${bottom}" stroke="#788d99" stroke-dasharray="5 5" opacity=".65"/><text class="throat-label" x="${coord(tx)}" y="28" text-anchor="middle">Düsenhals</text>`;
  }
  if(spec.wallLimit&&Number.isFinite(limit))svg+=`<line x1="${left}" x2="${right}" y1="${coord(y(limit))}" y2="${coord(y(limit))}" stroke="#f1a193" stroke-width="1.3" stroke-dasharray="6 5"/>`;
  if(Number.isFinite(stations[selected].xM))svg+=`<line class="station-marker" x1="${coord(x(stations[selected].xM))}" x2="${coord(x(stations[selected].xM))}" y1="${top}" y2="${bottom}"/>`;
  for(const [key,label,color] of spec.series){
    let started=false;
    const d=stations.map(s=>{const v=scaled(s[key],spec.scale);if(!Number.isFinite(v)||!Number.isFinite(s.xM)){started=false;return '';}const p=`${started?'L':'M'}${coord(x(s.xM))},${coord(y(v))}`;started=true;return p;}).join(' ');
    svg+=`<path d="${d}" fill="none" stroke="${color}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>`;
    const active=scaled(stations[selected][key],spec.scale);
    if(Number.isFinite(active)&&Number.isFinite(stations[selected].xM))svg+=`<circle cx="${coord(x(stations[selected].xM))}" cy="${coord(y(active))}" r="4" fill="${color}" stroke="#11191d" stroke-width="1.5"><title>${esc(label)}: ${value(active)} ${esc(spec.unit)}</title></circle>`;
  }
  return svg+'</svg>';
}

/** Render stored profile arrays only; no additional physical calculations. */
export function coolingResults(result,esc,fmt,labels={},options={}) {
  if(!result?.ok)return '';
  const entries=(result.cycle?.cooling||[]).filter(c=>c.mode==='channels'&&Array.isArray(c.stations)&&c.stations.length);
  const value=(n,d=1)=>Number.isFinite(n)?esc(fmt(n,d)):'—';
  return entries.map(c=>{
    const id=esc(c.nodeId),name=esc(labels[c.nodeId]||c.nodeId),opts=options[c.nodeId]||{};
    const index=selectedIndex(c.stations,opts.station),s=c.stations[index];
    const limit=c.demo?NaN:c.maxHotWallTemperatureK+c.wallMarginK;
    const views=c.demo?{...VIEWS,pressure:{...VIEWS.pressure,series:[['coolantPressureBar','Druckbudget · Demo','#70d0df']]}}:VIEWS;
    const limitPass=Number.isFinite(c.wallMarginK)&&c.wallMarginK>=0;
    const badge=c.demo?'DEMO · NICHT VALIDIERT':limitPass?'UNTER EINGEGEBENER GRENZE':'WANDGRENZE ÜBERSCHRITTEN';
    const metric=(label,n,unit,d=1,extra='')=>`<div class="cooling-metric"><span>${label}</span><strong>${value(n,d)}<small>${unit}</small></strong>${extra?`<small>${extra}</small>`:''}</div>`;
    const stationValue=(label,n,unit,d=1)=>`<div><span>${label}</span><strong>${value(n,d)} ${unit}</strong></div>`;
    return `<section class="cooling-results" aria-label="Kanalkühlung ${name}"><div class="cooling-heading"><div><div class="eyebrow">REGENERATIV / ${c.demo?'DEMO-KÜHLUNG':'KANALMODELL'}</div><h2>${name}</h2></div><span class="badge ${c.demo?'':limitPass?'success':'danger'}">${badge}</span></div>
      ${c.demo?'<div class="notice"><strong>Repräsentative Kühlwerte mit Einheiten.</strong> Eigenes Demo-Modell ohne Kalibrierung. Keine thermische Freigabe oder Materialgrenzwertprüfung. Kühlwärme und Druckverlust beeinflussen die Feed-Bilanz; Schub und Isp bleiben aus dem bisherigen CEA-Modell.</div>':''}<p class="help-text">Kammer- und Düsenkontur aus diesem Entwurf. Brennstoff ${c.flowDirection==='co'?'im Gleichstrom →':'im Gegenstrom ←'}. Kühlstrecke: ${value((c.coolingStart??0)*100,0)}–${value((c.coolingEnd??1)*100,0)} % der Kontur. ${c.fullCoverage===false?'Ungekühlte Bereiche sind nicht bewertet.':''} Die Diagramme sind in Gasströmungsrichtung angeordnet.</p>
      <div class="cooling-metrics">${metric(c.demo?'Maximale heiße Wand · Demo':'Maximale heiße Wand',c.maxHotWallTemperatureK,'K',0,c.demo?'Nicht validiert':`Vorgegebene Grenze: ${value(limit,0)} K`)}${metric(c.demo?'Wärmestromdichte · Demo':'Maximale Wärmestromdichte',c.maxHeatFluxWm2*1e-6,'MW/m²',2)}${metric(c.demo?'Wärmeaufnahme · Demo':'Berechnete Wärmeaufnahme',c.heatKW,'kW',1)}${metric(c.demo?'Druckverlust · Demo':'Berechneter Druckverlust',c.dropBar,'bar',2)}${metric(c.demo?'Kühlmittel am Austritt · Demo':'Kühlmittel am Austritt',c.outletTemperatureK,'K',1)}${c.demo?metric('Kühlmassenstrom · System',c.massFlowKgS,'kg/s',3):metric('Abstand zur Wandgrenze',c.wallMarginK,'K',0,limitPass?'Vergleich innerhalb des Modells':'Eingegebene Grenze wird überschritten')}</div>
      <div class="cooling-station-controls"><label><span>Gemeinsame Station · ${index+1} / ${c.stations.length}</span><input type="range" min="0" max="${c.stations.length-1}" step="1" value="${index}" data-cooling-station="${id}" aria-label="Station verschieben für ${name}" aria-valuetext="Station ${index+1}, x ${value(scaled(s.xM,1000),1)} mm"></label><label><span>Station direkt wählen</span><select data-cooling-station="${id}" aria-label="Station für ${name}">${c.stations.map((p,i)=>`<option value="${i}" ${index===i?'selected':''}>${String(i+1).padStart(3,'0')} · x = ${value(scaled(p.xM,1000),1)} mm</option>`).join('')}</select></label></div>
      <p class="help-text">Alle Diagramme zeigen dieselbe markierte Position. Werte unten ablesen oder den Stationsregler bewegen. ${c.demo?'Der Demo-Druck folgt einem vereinfachten Verlustbudget ohne Beschleunigungsdruck.':'Der Druckverlauf zeigt statischen Druck; der gesamte berechnete Druckverlust steht oben separat.'}</p>
      <div class="cooling-chart-stack">${Object.entries(views).map(([view,spec],order)=>`<section class="cooling-chart-shell" aria-label="${esc(spec.label)}"><header class="cooling-chart-toolbar"><h3><span>${String(order+1).padStart(2,'0')}</span> ${esc(spec.label)}${c.demo?' · Demo':''}</h3><span>${esc(spec.unit)}</span></header>${chart(c,view,index,esc,fmt)}<div class="cooling-chart-legend">${spec.series.map(([key,label,color])=>`<span style="color:${color}"><i></i>${esc(label)}</span>`).join('')}${spec.wallLimit&&!c.demo?'<span class="limit"><i></i>Eingegebene Wandgrenze</span>':''}</div><dl class="cooling-chart-readout">${spec.series.map(([key,label])=>`<div><dt>${esc(label)}</dt><dd>${value(scaled(s[key],spec.scale),spec.unit==='K'?1:2)} <small>${esc(spec.unit)}</small></dd></div>`).join('')}</dl></section>`).join('')}</div>
      <div class="cooling-station-detail"><div class="section-label">STATION ${index+1} / ${c.stations.length} · x = ${value(scaled(s.xM,1000),1)} mm</div><div class="cooling-station-grid">${stationValue('Heiße Wand',s.hotWallTemperatureK,'K')}${stationValue('Kalte Wand',s.coldWallTemperatureK,'K')}${stationValue('Kühlmittel',s.coolantTemperatureK,'K')}${stationValue(c.demo?'Druckbudget · Demo':'Statischer Kühlmitteldruck',s.coolantPressureBar,'bar',2)}${stationValue('Wärmestromdichte',s.heatFluxWm2*1e-6,'MW/m²',2)}${stationValue('Lokale Kanalbreite',s.channelWidthMm,'mm',2)}${stationValue('Gas-HTC',s.gasHTCWm2K/1000,'kW/(m²·K)',2)}${stationValue('Kühlmittel-HTC',s.coolantHTCWm2K/1000,'kW/(m²·K)',2)}${stationValue('Kühlmittelgeschwindigkeit',s.velocityMS,'m/s',2)}${stationValue('Reynolds-Zahl',s.reynolds,'',0)}</div></div>
      <details><summary>Alle Kühlstationen${c.demo?' · Demo':''}</summary><div class="table-scroll"><table class="cooling-table"><thead><tr><th>Station</th><th>x [mm]</th><th>Wand heiß [K]</th><th>Wand kalt [K]</th><th>Kühlmittel [K]</th><th>${c.demo?'p Demo':'p stat.'} [bar]</th><th>q [MW/m²]</th><th>Breite [mm]</th></tr></thead><tbody>${c.stations.map((p,i)=>`<tr class="${i===index?'selected':''}"><td><button type="button" data-cooling-index="${i}" data-cooling-node="${id}" aria-label="Station ${i+1} untersuchen">${i+1} ↗</button></td><td>${value(scaled(p.xM,1000),1)}</td><td>${value(p.hotWallTemperatureK,1)}</td><td>${value(p.coldWallTemperatureK,1)}</td><td>${value(p.coolantTemperatureK,1)}</td><td>${value(p.coolantPressureBar,2)}</td><td>${value(p.heatFluxWm2*1e-6,2)}</td><td>${value(p.channelWidthMm,2)}</td></tr>`).join('')}</tbody></table></div></details>
      <div class="dialog-actions"><button class="button" data-action="cooling-csv" data-cooling-node="${id}">Kühlstationen als CSV</button></div>
      <p class="cooling-caption">${c.demo?'Demo-Profil entlang der tatsächlichen Kontur. Die Wärmeaufnahme entspricht der integrierten Demo-Wärmestromdichte und dem pauschalen cp. Diese interne Konsistenz ist keine Validierung. Keine private Kühlkanalrechnung oder Transporttabelle enthalten.':`${Number.isFinite(c.energyResidualW)?`Energieresiduum: ${value(c.energyResidualW,3)} W. `:''}Die Profilpunkte umfassen die vorgegebenen axialen Unterteilungen, Konturstützstellen und zusätzliche Wandbewertungen an den Zellrändern. Randpunkte addieren keine Wärme zur Bilanz. Die lokale Kanalbreite folgt dem eingegebenen Anteil der Umfangsteilung. Die sichtbare Wandgrenze ist eine Entwurfsvorgabe, keine geprüfte Werkstoffzulässigkeit.`}</p>
      <p class="cycle-caveat">${c.demo?'Repräsentative Demo-Werte, keine thermische Auslegung. Vereinfachte Profilformen und konstante Stoffannahmen;':'Berechnete thermische Modellwerte, keine zertifizierte Kühlung. Korrelationen und Stoffannahmen begrenzen die Aussage;'} keine Wandfestigkeit, Lebensdauer, Phasenwechsel- oder Verkokungsbewertung. Die Hauptthermochemie wird durch diese Wärmeentnahme nicht neu gekoppelt.</p></section>`;
  }).join('');
}
