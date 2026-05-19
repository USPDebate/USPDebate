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
