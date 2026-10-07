// Local fixtures only. No Supabase or real identities are contacted.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {pathToFileURL} from 'node:url';

export function customizationFixture() {
 const season={id:'temporada:2026-10',nombre:'Crónicas del Archivo'};
 const rows=[['academia_insignia','insignia','Crónicas del Archivo',1],['academia_avatar','avatar','Aprendiz del Archivo',2],['academia_titulo','titulo','Custodio de Manuscritos',3],['academia_marco','marco','Pergamino Antiguo',4],['academia_reverso','reverso','Archivo Nocturno',5],['archivo_erudito','avatar','Erudito de Medianoche',6],['archivo_placa','placa','Tinta Dorada',7],['archivo_biblioteca','marco','Biblioteca Prohibida',8],['archivo_cronista','titulo','Cronista de la Academia',9],['archivo_maestro_marco','marco','Maestro del Archivo',10],['archivo_maestro_insignia','insignia','Maestro del Archivo',10],['archivo_lanzamiento_libro','interaccion','Lanzamiento de libro',10]];
 const prefix='/assets/seasons/cronicas-del-archivo/';
 const paths={academia_insignia:'insignias/insignia-cronicas-del-archivo.png',academia_avatar:'avatares/avatar-aprendiz-del-archivo.png',academia_marco:'marcos/marco-pergamino-antiguo.png',academia_reverso:'reversos/reverso-archivo-nocturno.png',archivo_erudito:'avatares/avatar-erudito-de-medianoche.png',archivo_placa:'placas/placa-tinta-dorada.png',archivo_biblioteca:'marcos/marco-biblioteca-prohibida.png',archivo_maestro_marco:'marcos/marco-maestro-del-archivo.png',archivo_maestro_insignia:'insignias/insignia-maestro-del-archivo.png',archivo_lanzamiento_libro:'interacciones/lanzamiento-libro/libro.png'};
 const catalogo=rows.map(([id,tipo,nombre,nivel])=>({cosmetico:{id,tipo,nombre,rareza:(id.startsWith('archivo_maestro')||id==='archivo_lanzamiento_libro')?'legendario':id==='archivo_biblioteca'?'epico':'comun',asset:paths[id]?prefix+paths[id]:null,...(tipo==='interaccion'?{assets:Object.fromEntries(['libro','hoja-01','hoja-02','impacto'].map(key=>[key,prefix+'interacciones/lanzamiento-libro/'+key+'.png']))}:{})},temporada:{...season},nivel}));
 return {inventario:catalogo.slice(0,3).map(item=>item.cosmetico),equipamiento:{avatar:'academia_avatar',marco:null,titulo:null,insignia:null,reverso:null,placa:null,interaccion:null},catalogo,temporadas:[{...season,inicio:'2026-10-01T00:00:00+02:00',fin:'2026-11-01T00:00:00+01:00',nivel:4,maxNivel:10,recompensasObtenidas:3,totalRecompensas:10}]};
}
export async function startCustomizationPreview(port=Number(process.env.TESIS_PREVIEW_PORT||8093)) {
 const root=resolve('src/main/resources/static');let cosmetics=customizationFixture();
 if(process.env.TESIS_DEMO_COLLECTION==='completa'){
  cosmetics.inventario=cosmetics.catalogo.map(row=>row.cosmetico);
  cosmetics.equipamiento={avatar:'archivo_erudito',marco:'archivo_maestro_marco',titulo:'archivo_cronista',insignia:'archivo_maestro_insignia',placa:'archivo_placa',reverso:'academia_reverso',interaccion:'archivo_lanzamiento_libro'};
 }
 const sdk=`window.supabase={createClient:()=>({auth:{onAuthStateChange(fn){window.__customAuth=fn},getSession:async()=>({data:{session:window.__customSignedOut?null:{access_token:'custom-demo',user:{id:window.__customIdentity||'custom-demo'}}}}),signOut:async()=>{window.__customSignedOut=true;window.__customAuth('SIGNED_OUT',null);return {}}}})};`;
 const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
 const server=createServer(async(req,res)=>{
  const send=(code,body,type='application/json')=>{res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(type==='application/json'?JSON.stringify(body):body);};
  try {
   const url=new URL(req.url,`http://localhost:${port}`);
   if(url.pathname==='/mesa-demo'){
    const items=Object.fromEntries(cosmetics.catalogo.map(row=>[row.cosmetico.id,row.cosmetico]));
    const equipped=tipo=>items[cosmetics.equipamiento[tipo]]||null;
    const jugadores=['Falio3','Cronista','Aprendiz'].map((nombre,index)=>({nombre,monedas:3,prestigio:2,cartas:3,publicados:0,rol:null,estudios:[],activo:index===0,cosmeticos:index===2?null:index===0?{avatar:equipped('avatar'),marco:equipped('marco'),reverso:equipped('reverso')}:{avatar:items.academia_avatar,marco:items.academia_marco,reverso:items.academia_reverso}}));
    const state={yo:'Falio3',actual:'Falio3',fase:'TURNO_JUGADOR',ronda:1,jugadores,mano:[],acciones:[],seleccion:[],accionesRestantes:2,bloqueada:false};
    return send(200,`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mesa · Preview de cosméticos</title><link rel="stylesheet" href="/css/game.css"><link rel="stylesheet" href="/css/effects.css"><link rel="stylesheet" href="/css/table.css"><link rel="stylesheet" href="/css/premium.css"><main id="app"></main><aside style="position:fixed;bottom:8px;right:10px;z-index:9999;background:#061725;color:#ffe0a0;border:1px solid #be9455;padding:8px;font:13px Georgia">Demo local · datos simulados · <a style="color:#ffe0a0" href="/#personalizacion">Personalización</a></aside><script type="module">import {board} from '/js/board.js';board(${JSON.stringify(state).replace(/</g,'\\u003c')});</script></html>`,'text/html');
   }
   if(url.pathname.startsWith('/js/vendor/supabase-'))return send(200,sdk,'text/javascript');
   if(url.pathname==='/api/cuentas/config')return send(200,{habilitado:true,url:`http://localhost:${port}`,publishableKey:'simulada'});
   if(url.pathname==='/api/config')return send(200,{jugadoresMinimos:3,jugadoresMaximos:5});
   if(url.pathname==='/api/demo/reset'){cosmetics=customizationFixture();return send(200,{});}
   if(url.pathname==='/api/demo/unlock'){cosmetics.inventario=cosmetics.catalogo.map(row=>row.cosmetico);return send(200,{});}
   if(url.pathname.startsWith('/api/')){
    if(req.headers.authorization!=='Bearer custom-demo')return send(401,{error:'Sesión local simulada requerida.'});
    if(url.pathname==='/api/perfil')return send(200,{nombre:'Falio3',nivel:1,xp:350,victorias:0,partidasTerminadas:4});
    if(url.pathname==='/api/presencia')return send(200,{activa:true});
    if(url.pathname==='/api/invitaciones')return send(200,{invitaciones:[]});
    if(url.pathname==='/api/cosmeticos'&&req.method==='GET')return send(200,cosmetics);
    if(url.pathname==='/api/cosmeticos/equipar'&&req.method==='POST'){
     let body='';for await(const chunk of req)body+=chunk;const {tipo,id}=JSON.parse(body);
     if(!Object.hasOwn(cosmetics.equipamiento,tipo))return send(400,{error:'Tipo de cosmético inválido.'});
     if(id!==null&&!cosmetics.inventario.some(item=>item.id===id&&item.tipo===tipo))return send(400,{error:'No posees este cosmético.'});
     cosmetics.equipamiento[tipo]=id;return send(200,cosmetics);
    }
    return send(404,{error:'Ruta no disponible en la simulación.'});
   }
   let path=resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!path.startsWith(root+sep))return send(403,{});
   let body=await readFile(path);if(url.pathname==='/')body=body.toString().replace('</body>','<aside style="position:fixed;bottom:8px;right:10px;z-index:9999;background:#061725;color:#ffe0a0;border:1px solid #be9455;padding:7px 12px;font:13px Georgia">Demo local · datos simulados</aside></body>');
   return send(200,body,mime[extname(path)]||'application/octet-stream');
  } catch {return send(404,{error:'No encontrado en la simulación.'});}
 });
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const port=Number(process.env.TESIS_PREVIEW_PORT||8093);await startCustomizationPreview(port);console.log(`Personalización simulada: http://127.0.0.1:${port}/#perfil`);}
