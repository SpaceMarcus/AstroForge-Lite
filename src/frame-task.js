// Combine frequent visual updates; document mutations remain synchronous.
export function frameTask(callback,request=requestAnimationFrame,cancel=cancelAnimationFrame){
 let pending=null;
 return {
  schedule(){if(pending===null)pending=request(()=>{pending=null;callback();});},
  cancel(){if(pending!==null){cancel(pending);pending=null;}}
 };
}
