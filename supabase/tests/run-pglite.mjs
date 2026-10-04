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
  await db.exec(await readFile(new URL('cuentas_progresion.sql', import.meta.url), 'utf8'));
  const {rows} = await db.query('select count(*)::integer as perfiles from public.profiles');
  if (rows[0].perfiles !== 0) throw new Error('El script no revirtió los perfiles de prueba');
  console.log('PASS PostgreSQL WASM: migración, trigger, permisos/RLS, empates, invitados, reintentos y rollback.');
  console.log('No verifica Supabase Auth/PostgREST ni concurrencia con varias conexiones.');
} finally {
  await db.close();
}
