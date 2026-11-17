import {solveProject} from '../src/physics.js';
import {annotateResult} from './model.js';
let thermo;
async function data(){
  if(!thermo)thermo=Promise.all(['thermo.json','propellant-data.json'].map(async file=>{const r=await fetch(new URL('../'+file,import.meta.url));if(!r.ok)throw Error('Thermochemische Daten nicht erreichbar.');return r.json();})).then(([base,catalog])=>({...base,catalog}));
  return thermo;
}
self.onmessage=async({data:project})=>{
  try{const result=annotateResult(solveProject(project,await data()),project);self.postMessage({result:{...result,computedAt:new Date().toISOString()}});}
  catch(error){self.postMessage({error:error.message||'Berechnung nicht verfügbar.'});}
};
