// Cuenta persistente por pestaña. Nunca comparte almacenamiento con el token de sala.
export function createAccounts({fetcher=globalThis.fetch, storage=globalThis.sessionStorage,
  sdk=()=>globalThis.supabase}={}) {
  let client, session=null, profile=null, enabled=false, initialization;
  let profileGeneration=0;
  let authGeneration=0;
  const listeners=new Set();
  const emit=()=>listeners.forEach(fn=>fn());
  function applySession(value) {
    if(session?.user?.id!==value?.user?.id || !value || (!session&&value)) {
      profile=null;++profileGeneration;++authGeneration;
    }
    session=value;
  }
  async function request(path, body) {
    const generation=authGeneration,known=Boolean(session);
    const token=await accessToken();
    if(known&&generation!==authGeneration)throw new Error('La cuenta ha cambiado. Vuelve a abrir tu perfil antes de realizar esta acción.');
    if (!token) throw new Error('Inicia sesión para consultar tu perfil.');
    const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),12000);
    try {
      const response=await fetcher(`/api/${path}`, {method:body===undefined?'GET':'POST',
        cache:'no-store',signal:controller.signal,
        headers:{Authorization:`Bearer ${token}`,...(body===undefined?{}:{'Content-Type':'application/json','X-Tesis':'1'})},
        body:body===undefined?undefined:JSON.stringify(body)});
      const data=await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo consultar tu perfil.');
      return data;
    } finally {clearTimeout(timeout);}
  }
  async function refreshProfile() {
    const current=++profileGeneration;
    if (!session) {profile=null; emit(); return null;}
    const value=await request('perfil');
    if (current===profileGeneration && session) {profile=value; emit();}
    return value;
  }
  async function initialize() {
    if (initialization) return initialization;
    initialization=(async()=>{
      const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),12000);
      let config;
      try {
        const response=await fetcher('/api/cuentas/config',{cache:'no-store',signal:controller.signal});
        if (!response.ok) throw new Error('Las cuentas no están disponibles. Puedes jugar como invitado.');
        config=await response.json();
      } finally {clearTimeout(timeout);}
      if (!config.habilitado) {
        if(storage?.getItem('tesis.cuenta')) throw new Error('Las cuentas están deshabilitadas.');
        return;
      }
      client=sdk().createClient(config.url,config.publishableKey,{auth:{storage,storageKey:'tesis.cuenta',
        persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
      enabled=true;
      client.auth.onAuthStateChange((_event,value)=>{
        applySession(value);
        // No hacer llamadas Auth dentro del callback del SDK: evitar su bloqueo interno.
        emit();
      });
      const {data,error}=await client.auth.getSession();
      if (error) throw error;
      applySession(data.session);
      emit();
    })();
    try {await initialization;} catch(error) {initialization=null; throw error;}
  }
  async function accessToken() {
    // Crear/unirse también debe esperar la restauración de Auth. Nunca convertir
    // una sesión conocida en invitado por un fallo de configuración/red.
    try {await initialize();}
    catch {
      if (storage?.getItem('tesis.cuenta'))
        throw new Error('No se pudo recuperar tu cuenta. Inténtalo más tarde; no hemos entrado como invitado.');
      return null;
    }
    if (!client) {
      if (storage?.getItem('tesis.cuenta'))
        throw new Error('Las cuentas están deshabilitadas. Tu sesión guardada no puede vincularse a una sala.');
      return null;
    }
    const generation=authGeneration;
    const {data,error}=await client.auth.getSession();
    if (error) throw new Error('No se pudo renovar tu sesión. Vuelve a iniciar sesión.');
    if(generation!==authGeneration)throw new Error('La cuenta ha cambiado. Vuelve a abrir tu perfil antes de realizar esta acción.');
    const previous=authGeneration;
    applySession(data.session);
    if(previous!==authGeneration)emit();
    return session?.access_token || null;
  }
  async function login(email,password) {
    await initialize();
    if (!client) throw new Error('Las cuentas todavía no están habilitadas.');
    const {data,error}=await client.auth.signInWithPassword({email,password});
    if(error) throw new Error('No se pudo iniciar sesión. Comprueba correo y contraseña.');
    applySession(data.session); emit();
  }
  async function register(email,password,nombre) {
    await initialize();
    if (!client) throw new Error('Las cuentas todavía no están habilitadas.');
    const {data,error}=await client.auth.signUp({email,password,options:{data:{display_name:nombre}}});
    if(error) throw new Error('No se pudo crear la cuenta. Comprueba los datos e inténtalo de nuevo.');
    applySession(data.session); emit();
    return Boolean(session);
  }
  async function logout() {
    if (!client) return;
    const {error}=await client.auth.signOut({scope:'local'});
    if(error) throw new Error('No se pudo cerrar sesión. Inténtalo de nuevo.');
    applySession(null); emit();
  }
  async function rename(nombre) {
    const current=++profileGeneration;
    const value=await request('perfil',{nombre});
    if(current===profileGeneration && session) {profile=value; emit();}
    return value;
  }
  return {initialize,accessToken,login,register,logout,refreshProfile,rename,
    community:()=>request('comunidad'),
    friendship:(codigo,accion)=>request('amigos',{codigo,accion}),
    ranking:(criterio='xp')=>request(`ranking?criterio=${encodeURIComponent(criterio)}`),
    missions:()=>request('misiones'),
    claimMission:id=>request('misiones/reclamar',{id}),
    identity:()=>session?.user?.id || null,
    forgetStoredSession:()=>{storage.removeItem('tesis.cuenta');},
    enabled:()=>enabled,signedIn:()=>Boolean(session),profile:()=>profile,
    onChange:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};
}
export const accounts=createAccounts();
