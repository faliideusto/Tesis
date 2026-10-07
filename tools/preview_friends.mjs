// Demo local de la UI real: no conecta con Supabase ni crea contactos reales.
// node tools/preview_friends.mjs -> http://localhost:8092/#amigos
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
const root=resolve('src/main/resources/static'),port=Number(process.env.TESIS_PREVIEW_PORT||8092),sessions=new Map();
const demoRooms=new Map(),demoInvites=new Map();
const roomView=room=>({codigo:room.codigo,revision:room.revision,fase:'LOBBY',yo:'Falio3',anfitrion:room.anfitrion,soyAnfitrion:room.anfitrion==='Falio3',jugadores:room.jugadores,partida:null,progreso:{estado:'SIN_PARTIDA',cuenta:true,xp:null,partidaId:null}});
const roomAccess=room=>({codigo:room.codigo,playerToken:'demo-local',sala:roomView(room)});
const person=(nombre,nivel,index,enLinea=false)=>({nombre,nivel,codigo:index.toString(16).padStart(16,'0').toUpperCase(),enLinea});
const candidates=[person('ValeriaNox',10,21),person('DrakeSol',5,22),person('LyraAeterna',20,23),person('KaelArden',35,24),person('Irene',50,25),person('Marcos',75,26)];
const scenarios=['completo','recibidas','enviadas','desconectados','vacio','muchos'];
function fixture(scenario='completo') {
 const data={codigo:'61F6F7E9EFE94792',amigos:[person('Bruno',20,1,true),person('Clara',35,2,true),person('Diego',10,3)],recibidas:[person('Marta',5,4),person('Sofía',50,5)],enviadas:[person('Álvaro',20,6),person('Lucía',10,7)],sugerencias:structuredClone(candidates),presenciaDisponible:true};
 if(scenario==='recibidas'){data.amigos=[];data.enviadas=[];}
 if(scenario==='enviadas'){data.amigos=[];data.recibidas=[];}
 if(scenario==='desconectados')data.amigos.forEach(p=>p.enLinea=false);
 if(scenario==='vacio'){data.amigos=[];data.recibidas=[];data.enviadas=[];}
 if(scenario==='muchos')data.amigos=Array.from({length:12},(_,i)=>person(['Bruno','Clara','Diego','Ana','Carlos','Elena','Javier','Laura','María','Pablo','Raquel','Tomás'][i],1+i*5,i+40,i%3!==0));
 return data;
}
const sdk=`window.supabase={createClient:()=>({auth:{onAuthStateChange(fn){window.__demoAuth=fn},getSession:async()=>({data:{session:{access_token:'demo-local',user:{id:'demo-local'}}}}),signOut:async()=>{window.__demoAuth('SIGNED_OUT',null);return {}}}})};`;
const demoHtml='<link rel="stylesheet" href="/demo.css"><aside id="friends-demo"><details><summary>Demo local · datos simulados</summary><label>Escenario <select id="demo-scenario"><option value="completo">Amigos y solicitudes</option><option value="recibidas">Solicitudes recibidas</option><option value="enviadas">Solicitudes enviadas</option><option value="desconectados">Amigos desconectados</option><option value="vacio">Sin contactos</option><option value="muchos">Muchos amigos</option></select></label><button id="demo-reset" type="button">Restablecer escenario</button><p>Acepta, rechaza, cancela o añade sugerencias. Ninguna acción afecta a Supabase.</p></details></aside><script src="/demo.js"></script>';
const demoJs=`const selected=new URL(location.href).searchParams.get('escenario')||'completo';document.getElementById('demo-scenario').value=selected;const openDemo=value=>location.href='/?escenario='+encodeURIComponent(value)+'#amigos';document.getElementById('demo-scenario').addEventListener('change',event=>openDemo(event.target.value));document.getElementById('demo-reset').addEventListener('click',()=>openDemo(document.getElementById('demo-scenario').value));`;
const demoCss='#friends-demo{position:fixed;right:16px;bottom:12px;z-index:9999;max-width:min(340px,calc(100vw - 32px));background:#061523f5;color:#ffe2a6;border:1px solid #bc985c;border-radius:5px;padding:9px 13px;font:14px Georgia,serif;box-shadow:0 3px 15px #0009}#friends-demo summary{cursor:pointer}#friends-demo label{display:block;margin-top:12px}#friends-demo select,#friends-demo button{display:block;width:100%;margin-top:8px;padding:8px;background:#102737;color:#ffe2a6;border:1px solid #bc985c;border-radius:3px}#friends-demo p{font-size:13px;margin:12px 0 2px;line-height:1.4}';
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.mp3':'audio/mpeg'};
const server=createServer(async(req,res)=>{
 const send=(status,body,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(type==='application/json'?JSON.stringify(body):body);};
 try {
  const url=new URL(req.url,`http://localhost:${port}`);
  let id=String(req.headers.cookie||'').match(/(?:^|;\s*)tesis_demo=([a-f0-9-]+)/)?.[1];
  if(!id||!sessions.has(id)){id=randomUUID();sessions.set(id,fixture());res.setHeader('Set-Cookie',`tesis_demo=${id}; HttpOnly; SameSite=Strict; Path=/`);}
  if(url.pathname==='/'&&scenarios.includes(url.searchParams.get('escenario')))sessions.set(id,fixture(url.searchParams.get('escenario')));
  const data=sessions.get(id);
  if(url.pathname==='/demo.js')return send(200,demoJs+`document.getElementById('demo-invite').addEventListener('click',async()=>{await fetch('/api/demo/invitacion',{method:'POST',headers:{Authorization:'Bearer demo-local'}});document.getElementById('demo-invite').textContent='Aviso simulado: aparecerá en unos segundos';});`,'text/javascript');
  if(url.pathname==='/demo.css')return send(200,demoCss,'text/css');
  if(url.pathname.startsWith('/js/vendor/supabase-'))return send(200,sdk,'text/javascript');
  if(url.pathname==='/api/cuentas/config')return send(200,{habilitado:true,url:`http://localhost:${port}`,publishableKey:'demo-local'});
  if(url.pathname.startsWith('/api/')){
   if(req.headers.authorization!=='Bearer demo-local'&&!(url.pathname==='/api/salas'&&req.method==='POST'&&req.headers['x-tesis-account-authorization']==='Bearer demo-local'))return send(401,{error:'Sólo sesión de demostración local.'});
   if(url.pathname==='/api/perfil')return send(200,{nombre:'Falio3',nivel:1,xp:0,partidasTerminadas:0,victorias:0});
   if(url.pathname==='/api/invitaciones'&&req.method==='GET')return send(200,{invitaciones:demoInvites.get(id)||[]});
   if(url.pathname==='/api/salas'&&req.method==='POST'){
    const room={codigo:'A7K3Q',revision:1,anfitrion:'Falio3',jugadores:['Falio3']};demoRooms.set(id,room);return send(200,roomAccess(room));
   }
   if(url.pathname==='/api/salas/A7K3Q/estado'){
    const room=demoRooms.get(id);return room?send(200,roomView(room)):send(404,{error:'No hay sala en esta demo.'});
   }
   if(url.pathname==='/api/salas/A7K3Q/invitar'&&req.method==='POST'){
    let body='';for await(const chunk of req)body+=chunk;
    const friend=data.amigos.find(p=>p.codigo===JSON.parse(body).codigo&&p.enLinea),room=demoRooms.get(id);
    if(!friend||!room)return send(400,{error:'Ese amigo no está disponible.'});
    // Sólo simulación: el amigo acepta y aparece en el lobby, sin cuentas reales.
    setTimeout(()=>{if(!room.jugadores.includes(friend.nombre)){room.jugadores.push(friend.nombre);room.revision++;}},2500);
    return send(200,{id:randomUUID(),enviada:true});
   }
   if(url.pathname==='/api/demo/invitacion'&&req.method==='POST'){
    const invite={id:randomUUID(),codigoSala:'B8M4R',nombreAnfitrion:'Bruno'};demoInvites.set(id,[invite]);return send(200,{});
   }
   if(url.pathname.startsWith('/api/invitaciones/')&&req.method==='POST'){
    const inviteId=url.pathname.split('/')[3],items=demoInvites.get(id)||[];
    if(!items.some(item=>item.id===inviteId))return send(404,{error:'Invitación de demo no disponible.'});
    demoInvites.set(id,items.filter(item=>item.id!==inviteId));
    if(url.pathname.endsWith('/rechazar'))return send(200,{});
    const room={codigo:'B8M4R',revision:1,anfitrion:'Bruno',jugadores:['Bruno','Falio3']};demoRooms.set(id,room);return send(200,roomAccess(room));
   }
   if(url.pathname==='/api/salas/B8M4R/estado')return send(200,roomView(demoRooms.get(id)));
   if(url.pathname==='/api/comunidad'&&req.method==='GET')return send(200,data);
   if(url.pathname==='/api/ranking'&&req.method==='GET'){
    const people=[...data.amigos,...data.sugerencias];
    const entradas=people.map((p,i)=>({posicion:i+1,codigo:p.codigo,nombre:p.nombre,nivel:p.nivel,
     xp:(p.nivel-1)*500+120,victorias:Math.floor((40+p.nivel)*.4),partidas:40+p.nivel,yo:false}));
    return send(200,{entradas,propia:{posicion:people.length+1,codigo:data.codigo,nombre:'Falio3',nivel:1,xp:0,victorias:0,partidas:0,yo:true}});
   }
   if(url.pathname==='/api/perfil-publico'&&req.method==='GET'){
    const codigo=url.searchParams.get('codigo')?.toUpperCase();
    const found=[...data.amigos,...data.recibidas,...data.enviadas,...data.sugerencias].find(p=>p.codigo===codigo);
    if(!found)return send(404,{error:'No se encontró ese perfil.'});
    const isFriend=data.amigos.some(p=>p.codigo===codigo),played=40+found.nivel;
    return send(200,{codigo,nombre:found.nombre,nivel:found.nivel,xp:(found.nivel-1)*500+120,
     partidasTerminadas:played,victorias:Math.floor(played*.4),enLinea:isFriend&&found.enLinea,presenciaDisponible:isFriend});
   }
   if(url.pathname==='/api/presencia'&&req.method==='POST')return send(200,{activa:true});
   if(url.pathname==='/api/amigos'&&req.method==='POST'){
    let text='';for await(const chunk of req){text+=chunk;if(text.length>4096)return send(413,{error:'Cuerpo demasiado grande.'});}
    const {codigo,accion}=JSON.parse(text);
    const find=key=>data[key].find(p=>p.codigo===codigo),remove=key=>{data[key]=data[key].filter(p=>p.codigo!==codigo);};
    if(accion==='solicitar'){
     if(!/^[A-Fa-f0-9]{16}$/.test(codigo)||codigo===data.codigo)return send(400,{error:'Indica otro código válido de 16 caracteres hexadecimales.'});
     if([...data.amigos,...data.recibidas,...data.enviadas].some(p=>p.codigo===codigo))return send(400,{error:'Ese contacto ya está en tu círculo.'});
     data.enviadas.push(find('sugerencias')||{nombre:'Nuevo investigador',nivel:1,codigo,enLinea:false});remove('sugerencias');
    }else if(accion==='aceptar'&&find('recibidas')){data.amigos.push({...find('recibidas'),enLinea:true});remove('recibidas');}
    else if(accion==='rechazar'&&find('recibidas'))remove('recibidas');
    else if(accion==='cancelar'&&find('enviadas'))remove('enviadas');
    else if(accion==='eliminar'&&find('amigos'))remove('amigos');
    else return send(400,{error:'La solicitud ya no está disponible.'});
    return send(200,data);
   }
   return send(404,{error:'La demo sólo incluye Amigos.'});
  }
  if(req.method!=='GET')return send(405,{error:'Método no permitido.'});
  const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!path.startsWith(root+sep))return send(403,{error:'Ruta no permitida.'});
  let content=await readFile(path);
  if(path===resolve(root,'index.html'))content=content.toString().replace('</body>',demoHtml.replace('</details>','<button type="button" id="demo-invite">Simular invitación recibida</button><p>En salas privadas, los amigos invitados se unen automáticamente en esta demo.</p></details>')+'</body>');
  return send(200,content,mime[extname(path)]||'application/octet-stream');
 }catch{return send(404,{error:'Recurso de demo no disponible.'});}
});
server.listen(port,'127.0.0.1',()=>console.log(`Demo Amigos: http://localhost:${port}/?escenario=completo#amigos (sólo local, sin Supabase)`));
