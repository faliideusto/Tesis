-- Solo lectura administrativa. No crea usuarios, progreso ni reclamaciones.
select '1. Catálogo conserva doce IDs' control,
 case when (select count(*) from private.cosmetics_catalog where id in
 ('academia_insignia','academia_avatar','academia_titulo','academia_marco','academia_reverso','archivo_erudito','archivo_placa','archivo_biblioteca','archivo_cronista','archivo_maestro_marco','archivo_maestro_insignia','archivo_lanzamiento_libro'))=12 then 'PASS' else 'FAIL' end resultado
union all select '2. Títulos solo texto',case when (select count(*) from private.cosmetics_catalog where kind='titulo' and asset is null)=2 then 'PASS' else 'FAIL' end
union all select '3. Diez artes definitivos',case when (select count(*) from private.cosmetics_catalog where asset like '/assets/seasons/cronicas-del-archivo/%.png')=10 then 'PASS' else 'FAIL' end
union all select '4. Piezas de interacción',case when (select assets from private.cosmetics_catalog where id='archivo_lanzamiento_libro')=jsonb_build_object(
 'libro','/assets/seasons/cronicas-del-archivo/interacciones/lanzamiento-libro/libro.png',
 'hoja-01','/assets/seasons/cronicas-del-archivo/interacciones/lanzamiento-libro/hoja-01.png',
 'hoja-02','/assets/seasons/cronicas-del-archivo/interacciones/lanzamiento-libro/hoja-02.png',
 'impacto','/assets/seasons/cronicas-del-archivo/interacciones/lanzamiento-libro/impacto.png') then 'PASS' else 'FAIL' end
union all select '5. RPC privadas a anónimos',case when not has_function_privilege('anon','public.cosmeticos()','execute') and not has_function_privilege('anon','public.pase_temporada(text)','execute') and has_function_privilege('authenticated','public.cosmeticos()','execute') then 'PASS' else 'FAIL' end
union all select '6. Catálogo inmutable',case when exists(select 1 from pg_trigger where tgrelid='private.cosmetics_catalog'::regclass and tgname='pase_catalogo_inmutable' and tgenabled='O') then 'PASS' else 'FAIL' end
union all select '7. Presentación en RPC',case when position('c.assets' in pg_get_functiondef('public.pase_temporada(text)'::regprocedure))>0 and position('cc.assets' in pg_get_functiondef('public.cosmeticos()'::regprocedure))>0 then 'PASS' else 'FAIL' end
union all select '8. Mapeo exacto por ID',case when not exists(
 select 1 from (values
 ('academia_insignia','insignias/insignia-cronicas-del-archivo.png'),('academia_avatar','avatares/avatar-aprendiz-del-archivo.png'),
 ('academia_titulo',null),('academia_marco','marcos/marco-pergamino-antiguo.png'),('academia_reverso','reversos/reverso-archivo-nocturno.png'),
 ('archivo_erudito','avatares/avatar-erudito-de-medianoche.png'),('archivo_placa','placas/placa-tinta-dorada.png'),
 ('archivo_biblioteca','marcos/marco-biblioteca-prohibida.png'),('archivo_cronista',null),('archivo_maestro_marco','marcos/marco-maestro-del-archivo.png'),
 ('archivo_maestro_insignia','insignias/insignia-maestro-del-archivo.png'),('archivo_lanzamiento_libro','interacciones/lanzamiento-libro/libro.png')
 ) esperado(id,ruta) left join private.cosmetics_catalog c on c.id=esperado.id
 where c.id is null or c.asset is distinct from ('/assets/seasons/cronicas-del-archivo/' || esperado.ruta)
 ) then 'PASS' else 'FAIL' end;
