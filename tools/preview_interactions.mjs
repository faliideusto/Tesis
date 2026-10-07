// Real Java rooms, loopback-only simulated Auth/RPC. Never contacts production Supabase.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname,delimiter} from 'node:path';
import {generateKeyPairSync,sign} from 'node:crypto';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {customizationFixture} from './preview_customization.mjs';

export async function startInteractionsPreview(port=8112) {
 const backend=port+1,authPort=port+2,authURL=`http://127.0.0.1:${authPort}`,origin=`http://127.0.0.1:${port}`;
 const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const jwk={...publicKey.export({format:'jwk'}),kid:'qa',alg:'ES256',use:'sig'};
 const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const people=['Fali','Marta','Sol'].map((nombre,index)=>{
  const id=`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`;
  const unsigned=`${encode({alg:'ES256',kid:'qa'})}.${encode({iss:authURL+'/auth/v1',aud:'authenticated',sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+86400})}`;
  const jwt=unsigned+'.'+sign('sha256',Buffer.from(unsigned),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
  const cosmetics=customizationFixture();cosmetics.inventario=cosmetics.catalogo.map(row=>row.cosmetico).filter(item=>index<2||item.tipo!=='interaccion');
  cosmetics.equipamiento={...cosmetics.equipamiento,avatar:index===0?'archivo_erudito':'academia_avatar',marco:index===0?'archivo_maestro_marco':'academia_marco',reverso:'academia_reverso',interaccion:index<2?'archivo_lanzamiento_libro':null};
  return {nombre,id,jwt,cosmetics};
 });
 const auth=createServer((req,res)=>{
  const person=people.find(p=>req.headers.authorization===`Bearer ${p.jwt}`);
  let body={};if(req.url.startsWith('/auth/v1/.well-known'))body={keys:[jwk]};
  else if(req.url.startsWith('/rest/v1/profiles'))body=[{display_name:person?.nombre||'QA',xp:0,games_finished:0,wins:0}];
  else if(req.url.endsWith('/cosmeticos'))body=person?.cosmetics||{};
  else if(req.url.includes('presencia'))body={activa:true};
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(body));
 });
 await new Promise(r=>auth.listen(authPort,'127.0.0.1',r));
 const cp=(await readFile('target/qa-interactions.classpath','utf8')).trim();
 const java=spawn('java',['-cp',['target/test-classes','target/classes',cp].join(delimiter),'es.tesis.web.InteraccionesPreview',authURL,String(backend)],{env:{...process.env,PUBLIC_ORIGIN:origin},stdio:['ignore','pipe','pipe'],windowsHide:true});
 java.stdout.on('data',()=>{});java.stderr.on('data',data=>process.stderr.write(data));
 async function api(path,person,body,roomToken){const response=await fetch(`http://127.0.0.1:${backend}/api/${path}`,{method:body===undefined?'GET':'POST',headers:{'X-Tesis':'1','Content-Type':'application/json',...(roomToken?{Authorization:`Bearer ${roomToken}`}:{Authorization:`Bearer ${person.jwt}`}), 'X-Tesis-Account-Authorization':`Bearer ${person.jwt}`},body:body===undefined?undefined:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw Error(JSON.stringify(result));return result;}
 for(let attempt=0;attempt<50;attempt++){try{await fetch(`http://127.0.0.1:${backend}/api/config`);break;}catch{await new Promise(r=>setTimeout(r,100));}}
 let access=await api('salas',people[0],{nombre:people[0].nombre});let codigo=access.codigo;people[0].access=access;
 for(const person of people.slice(1))person.access=await api(`salas/${codigo}/unirse`,person,{nombre:person.nombre});
 let room=await api(`salas/${codigo}/estado`,people[0],undefined,people[0].access.playerToken);
 room=await api(`salas/${codigo}/iniciar`,people[0],{revision:room.revision},people[0].access.playerToken);
 for(let i=0;i<15&&room.partida?.fase==='SELECCION_ROLES';i++){
  const person=people.find(p=>p.nombre===room.partida.actual);const view=await api(`salas/${codigo}/estado`,person,undefined,person.access.playerToken);
  const role=view.partida.seleccion.find(r=>r.orden!==1)||view.partida.seleccion[0];
  room=await api(`salas/${codigo}/accion`,person,{revision:view.revision,tipo:'SELECCIONAR',indice:role.indice},person.access.playerToken);
 }
 const root=resolve('src/main/resources/static'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
 const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,origin);const person=people.find(p=>p.nombre===url.searchParams.get('jugador'))||people[0];
  if(url.pathname.startsWith('/api/')){let body='';for await(const chunk of req)body+=chunk;const response=await fetch(`http://127.0.0.1:${backend}${req.url}`,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:body});res.writeHead(response.status,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(await response.text());}
  if(url.pathname.startsWith('/js/vendor/supabase-')){res.setHeader('Content-Type','text/javascript');return res.end(`window.supabase={createClient:()=>({auth:{onAuthStateChange(){},getSession:async()=>({data:{session:window.__qaAccount}})}})};`);}
  const path=resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!path.startsWith(root+sep)){res.writeHead(403);return res.end();}
  let body=await readFile(path);if(url.pathname==='/')body=body.toString().replace('<script type="module"',`<script>window.__qaAccount=${JSON.stringify({access_token:person.jwt,user:{id:person.id}})};sessionStorage.setItem('tesis.sala',${JSON.stringify(JSON.stringify({codigo,playerToken:person.access.playerToken}))});</script><script type="module"`);
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
 }catch(error){res.writeHead(500);res.end(String(error));}});
 await new Promise(r=>server.listen(port,'127.0.0.1',r));
 return {origin,people,codigo,api,close:async()=>{java.kill();server.closeAllConnections();auth.closeAllConnections();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>auth.close(r))]);}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const demo=await startInteractionsPreview();console.log(demo.people.map(p=>`${p.nombre}: ${demo.origin}/?jugador=${p.nombre}`).join('\n'));}
