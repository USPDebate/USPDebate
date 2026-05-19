-- ============================================================
-- USP DEBATE — Sala manual (treinos organizados)
-- ============================================================
-- Rode no SQL Editor depois de functions.sql.
-- O juiz registra uma sala montada à mão; ela é mesclada no
-- draw do dia (criando-o se não existir) e o draw fica publicado.
-- Sem senha — é ação do juiz, como o registro de speaks.
-- ============================================================

create or replace function adicionar_sala_manual(p_data date, p_sala jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_temp     bigint;
  v_conteudo jsonb;
  v_salas    jsonb;
  v_num      int;
begin
  select id into v_temp from temporadas where ativa limit 1;
  if v_temp is null then raise exception 'Nenhuma temporada ativa'; end if;

  v_num := (p_sala->>'numero')::int;
  select conteudo into v_conteudo from draws
   where temporada_id = v_temp and data = p_data;

  if v_conteudo is null then
    v_conteudo := jsonb_build_object('salas', jsonb_build_array(p_sala), 'juizes', '[]'::jsonb);
  else
    -- remove a sala de mesmo número (se já existir) e acrescenta a nova
    select coalesce(jsonb_agg(s), '[]'::jsonb) into v_salas
      from jsonb_array_elements(coalesce(v_conteudo->'salas', '[]'::jsonb)) s
      where (s->>'numero')::int <> v_num;
    v_conteudo := jsonb_set(v_conteudo, '{salas}', v_salas || jsonb_build_array(p_sala));
  end if;

  insert into draws (temporada_id, data, conteudo, publicado)
  values (v_temp, p_data, v_conteudo, true)
  on conflict (temporada_id, data)
  do update set conteudo = excluded.conteudo, publicado = true;
end;
$$;
grant execute on function adicionar_sala_manual(date, jsonb) to anon;
