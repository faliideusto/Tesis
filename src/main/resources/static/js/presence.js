// Presencia de cuenta visible. No contiene identidad de sala ni reintenta acciones de juego.
export function startPresence(accounts,{document=globalThis.document,window=globalThis.window,
  now=()=>Date.now(),setTimer=globalThis.setTimeout,clearTimer=globalThis.clearTimeout}={}) {
  let active=true,suspended=false,timer=null,pending=false,identity=null,nextDue=0,failures=0;
  const visible=()=>!suspended&&document?.visibilityState!=='hidden';
  function cancel(){if(timer!==null){clearTimer(timer);timer=null;}}
  function schedule(){
    cancel();
    if(!active||pending||!visible()||!accounts.signedIn())return;
    timer=setTimer(pulse,Math.max(0,nextDue-now()));
  }
  function changed(){
    const current=accounts.identity();
    if(current!==identity){identity=current;nextDue=0;failures=0;}
    schedule();
  }
  async function pulse(){
    timer=null;
    if(!active||pending||!visible()||!accounts.signedIn())return;
    const actor=accounts.identity();pending=true;
    // Capturar también fallos síncronos para no romper la planificación.
    try {
      await accounts.presence();
      if(actor===accounts.identity()){failures=0;nextDue=now()+30000;}
    } catch {
      if(actor===accounts.identity()){
        failures=Math.min(3,failures+1);
        nextDue=now()+Math.min(120000,30000*2**failures);
      }
    } finally {pending=false;schedule();}
  }
  const hide=()=>{suspended=true;cancel();};
  const show=()=>{suspended=false;changed();};
  const unsubscribe=accounts.onChange(changed);
  document?.addEventListener('visibilitychange',changed);
  window?.addEventListener('pagehide',hide);
  window?.addEventListener('pageshow',show);
  changed();
  return {destroy(){active=false;cancel();unsubscribe();
    document?.removeEventListener('visibilitychange',changed);
    window?.removeEventListener('pagehide',hide);window?.removeEventListener('pageshow',show);}};
}
