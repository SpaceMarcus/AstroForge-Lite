import {PROPELLANT_PAIRS} from '../src/propellants.js';
export async function loadCapabilities(){
  return {execution:'browser',version:'2.12.0',coolingDemo:true,cooling:Object.fromEntries(PROPELLANT_PAIRS.map(p=>[p.id,{available:true,issues:[]}]))};
}
export function requestCalculation(project,signal){
  signal?.throwIfAborted();
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('../demo/worker.js',import.meta.url),{type:'module'});
    const finish=(error,result)=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);worker.terminate();error?reject(error):resolve(result);};
    const abort=()=>finish(new DOMException('Berechnung abgebrochen.','AbortError'));
    const timer=setTimeout(()=>finish(Error('Die Berechnung hat das Zeitlimit erreicht.')),30000);
    signal?.addEventListener('abort',abort,{once:true});
    worker.onmessage=({data})=>finish(data.error?Error(data.error):null,data.result);
    worker.onerror=()=>finish(Error('Die lokale Berechnung konnte nicht gestartet werden.'));
    worker.postMessage(project);
  });
}
