import {evaluateDemo} from '../demo/model.js';
export async function loadCapabilities(){return {execution:'synthetic-demo',version:'2.11.0-demo',cooling:{}};}
export async function requestCalculation(project,signal){
  signal?.throwIfAborted();
  const result=evaluateDemo(project);
  signal?.throwIfAborted();
  return {...result,computedAt:new Date().toISOString()};
}
