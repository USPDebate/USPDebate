-- ============================================================
-- USP DEBATE — Apagar pessoa (admin)
-- ============================================================
-- Rode no SQL Editor depois de functions.sql.
-- Remove a pessoa e TODO o histórico dela (presenças e speaks).
-- ============================================================

create or replace function apagar_pessoa(p_senha text, p_pessoa_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform _checar_admin(p_senha);
  update presencas set dupla_pessoa_id = null where dupla_pessoa_id = p_pessoa_id;
  delete from speaker_points where pessoa_id = p_pessoa_id;
  delete from presencas where pessoa_id = p_pessoa_id;
  delete from pessoas where id = p_pessoa_id;
end;
$$;
grant execute on function apagar_pessoa(text, bigint) to anon;

-- Apaga todos os speaker points de um treino (data) — limpa testes.
create or replace function apagar_speaks_data(p_senha text, p_data date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform _checar_admin(p_senha);
  delete from speaker_points sp
   using temporadas t
   where t.ativa and sp.temporada_id = t.id and sp.data = p_data;
end;
$$;
grant execute on function apagar_speaks_data(text, date) to anon;

-- Marca/desmarca presença de uma pessoa num treino (correção manual do admin).
create or replace function marcar_presenca(
  p_senha text, p_pessoa_id bigint, p_data date, p_presente boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_temp bigint;
begin
  perform _checar_admin(p_senha);
  select id into v_temp from temporadas where ativa limit 1;
  if v_temp is null then raise exception 'Nenhuma temporada ativa'; end if;
  if p_presente then
    insert into presencas (temporada_id, pessoa_id, data, tipo)
    values (v_temp, p_pessoa_id, p_data, 'ps')
    on conflict (temporada_id, pessoa_id, data) do nothing;
  else
    delete from presencas
     where temporada_id = v_temp and pessoa_id = p_pessoa_id and data = p_data;
  end if;
end;
$$;
grant execute on function marcar_presenca(text, bigint, date, boolean) to anon;

-- Apaga o draw de um dia (rascunho ou publicado) — limpa testes.
create or replace function apagar_draw_dia(p_senha text, p_data date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform _checar_admin(p_senha);
  delete from draws d using temporadas t
   where t.ativa and d.temporada_id = t.id and d.data = p_data;
end;
$$;
grant execute on function apagar_draw_dia(text, date) to anon;

-- Edita uma linha de speaks (troca pessoa e/ou nota). Mitiga registro com nome errado.
create or replace function editar_speak(
  p_senha text, p_id bigint, p_pessoa_id bigint, p_speaks numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform _checar_admin(p_senha);
  if p_speaks is not null and (p_speaks < 0 or p_speaks > 100) then
    raise exception 'Speaks fora do intervalo (0–100)';
  end if;
  update speaker_points
     set pessoa_id = coalesce(p_pessoa_id, pessoa_id),
         speaks    = coalesce(p_speaks, speaks)
   where id = p_id;
end;
$$;
grant execute on function editar_speak(text, bigint, bigint, numeric) to anon;

-- Apaga uma única linha de speaks (uma pessoa numa sala de um treino).
create or replace function apagar_speak(p_senha text, p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform _checar_admin(p_senha);
  delete from speaker_points where id = p_id;
end;
$$;
grant execute on function apagar_speak(text, bigint) to anon;

-- Adiciona uma linha de speaks num registro já existente (re-adicionar quem foi apagado).
create or replace function inserir_speak(
  p_senha text, p_pessoa_id bigint, p_data date,
  p_sala int, p_posicao text, p_speaks numeric, p_juiz text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_temp bigint;
begin
  perform _checar_admin(p_senha);
  if p_speaks < 0 or p_speaks > 100 then
    raise exception 'Speaks fora do intervalo (0–100)';
  end if;
  select id into v_temp from temporadas where ativa limit 1;
  if v_temp is null then raise exception 'Nenhuma temporada ativa'; end if;
  insert into speaker_points (temporada_id, pessoa_id, data, rodada, sala, posicao, speaks, juiz)
  values (v_temp, p_pessoa_id, p_data, 1, p_sala, p_posicao, p_speaks, p_juiz)
  on conflict (temporada_id, pessoa_id, data, rodada)
  do update set sala = excluded.sala, posicao = excluded.posicao,
                speaks = excluded.speaks, juiz = excluded.juiz;
end;
$$;
grant execute on function inserir_speak(text, bigint, date, int, text, numeric, text) to anon;
