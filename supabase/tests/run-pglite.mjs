// PostgreSQL WASM local: sintaxis, transacciones, roles y RLS, sin red ni secretos.
// node supabase/tests/run-pglite.mjs [ruta del paquete @electric-sql/pglite]
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const packagePath = resolve(process.argv[2] ?? 'target/sql-qa/node_modules/@electric-sql/pglite/dist/index.js');
const {PGlite} = await import(pathToFileURL(packagePath).href);
const db = new PGlite();
try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to authenticated;
  `);
  await db.exec(await readFile(new URL('../migrations/202610050001_cuentas_progresion.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../migrations/202610060001_comunidad_misiones.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../migrations/202610070001_amigos_presencia_sugerencias.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../migrations/202610070002_perfiles_publicos.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../migrations/202610070003_invitaciones_amigos.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../migrations/202610070004_ranking_periodos.sql', import.meta.url), 'utf8'));
  // Fixture anterior a la instalación: backfill solo del mes vigente, sin XP extra.
  await db.exec(`
    insert into auth.users(id,raw_user_meta_data) values ('78000000-0000-0000-0000-000000000001','{"display_name":"Backfill"}');
    insert into private.matches(id,result_hash,version,completed_at) values
      ('79000000-0000-0000-0000-000000000001',repeat('a',64),1,now()),
      ('79000000-0000-0000-0000-000000000002',repeat('b',64),1,now()-interval '45 days');
    insert into private.reward_ledger(match_id,user_id,xp,version) values
      ('79000000-0000-0000-0000-000000000001','78000000-0000-0000-0000-000000000001',100,1),
      ('79000000-0000-0000-0000-000000000002','78000000-0000-0000-0000-000000000001',150,1);
  `);
  await db.exec(await readFile(new URL('../migrations/202610070005_pase_temporada.sql', import.meta.url), 'utf8'));
  await db.exec(`
    do $$ begin
      if (select count(*) from private.pass_receipts where user_id='78000000-0000-0000-0000-000000000001') <> 1
         or (select points from private.pass_progress where user_id='78000000-0000-0000-0000-000000000001') <> 100
         or (select xp from public.profiles where id='78000000-0000-0000-0000-000000000001') <> 0
      then raise exception 'Backfill inicial fuera del mes o modifica XP'; end if;
    end $$;
    delete from auth.users where id='78000000-0000-0000-0000-000000000001';
    delete from private.matches where id in ('79000000-0000-0000-0000-000000000001','79000000-0000-0000-0000-000000000002');
  `);
  await db.exec(await readFile(new URL('../migrations/202610070006_coleccion_cosmeticos.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('cuentas_progresion.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('comunidad_misiones.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('amigos_presencia_sugerencias.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('perfiles_publicos.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('invitaciones_amigos.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('ranking_periodos.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('pase_temporada.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('coleccion_cosmeticos.sql', import.meta.url), 'utf8'));
  // Set antiguo ya reclamado: la ampliación debe entregar la interacción sin XP ni nueva claim.
  await db.exec(`insert into auth.users(id,raw_user_meta_data) values ('76000000-0000-0000-0000-000000000001','{"display_name":"Set anterior"}');
    insert into private.pass_progress(user_id,season_id,points) values('76000000-0000-0000-0000-000000000001',private.registrar_temporada(now()),4500);
    set role authenticated;
    select set_config('request.jwt.claim.sub','76000000-0000-0000-0000-000000000001',false);
    select public.reclamar_recompensa_temporada(public.pase_temporada(null)->'temporada'->>'id','premio_maestro');
    reset role;`);
  await db.exec(await readFile(new URL('../migrations/202610070007_recompensas_archivo_definitivas.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('recompensas_archivo.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../migrations/202610070008_assets_cronicas.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('assets_cronicas.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../migrations/202610070009_misiones_temporada.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('misiones_temporada.sql', import.meta.url), 'utf8'));
  const misionesVerificadas = await db.query(await readFile(new URL('verificar_misiones_temporada.sql', import.meta.url), 'utf8'));
  if (misionesVerificadas.rows.some(r => r.resultado !== 'PASS')) throw new Error('Falló verificación readonly misiones');
  const verificacion = await db.query(await readFile(new URL('verificar_assets_cronicas.sql', import.meta.url), 'utf8'));
  if (verificacion.rows.some(r => r.resultado !== 'PASS')) throw new Error('Falló verificación readonly assets');
  const {rows} = await db.query('select count(*)::integer as perfiles from public.profiles');
  if (rows[0].perfiles !== 0) throw new Error('El script no revirtió los perfiles de prueba');
  console.log('PASS PostgreSQL WASM: once migraciones; perfiles/resultados, comunidad y presencia, perfiles e invitaciones, ranking y pase mensual, colección y archivo, assets definitivos y metadata, misiones diarias/semanales/mensuales, permisos/RLS y rollback.');
  console.log('No verifica Supabase Auth/PostgREST ni concurrencia con varias conexiones.');
} finally {
  await db.close();
}
