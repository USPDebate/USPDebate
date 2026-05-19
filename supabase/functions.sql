-- ============================================================
-- USP DEBATE — Funções de admin (Supabase / Postgres)
-- ============================================================
-- Rode DEPOIS do schema.sql. Pode rodar várias vezes (create or replace).
-- Toda função de admin exige a senha; senha errada → erro.
-- ============================================================

-- ─── Helper: valida a senha de admin ────────────────────────
create or replace function _checar_admin(p_senha text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from config where chave = 'senha_admin' and valor = p_senha
  ) then
    raise exception 'Senha de administrador incorreta';
  end if;
end;
$$;

-- ─── Salvar / gerar draw (upsert do dia) ────────────────────
-- O front-end gera o conteúdo do draw e chama esta função.
-- p_publicado: o front passa o estado correto (false ao gerar/regerar,
-- true ao publicar, ou o estado atual ao salvar edição).
create or replace function salvar_draw(
  p_senha text, p_data date, p_conteudo jsonb, p_publicado boolean default false
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

  insert into draws (temporada_id, data, conteudo, publicado)
  values (v_temp, p_data, p_conteudo, p_publicado)
  on conflict (temporada_id, data)
  do update set conteudo = excluded.conteudo, publicado = excluded.publicado;
end;
$$;
grant execute on function salvar_draw(text, date, jsonb, boolean) to anon;

-- ─── Apagar uma presença ────────────────────────────────────
create or replace function apagar_presenca(p_senha text, p_presenca_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform _checar_admin(p_senha);
  delete from presencas where id = p_presenca_id;
end;
$$;
grant execute on function apagar_presenca(text, bigint) to anon;

-- ─── Registrar speaker points (lote, idempotente) ───────────
-- p_lista = JSON array: [{pessoa_id, sala, posicao, speaks, juiz}, ...]
create or replace function registrar_speaks(
  p_senha text, p_data date, p_rodada int, p_lista jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_temp bigint; item jsonb;
begin
  perform _checar_admin(p_senha);
  select id into v_temp from temporadas where ativa limit 1;
  if v_temp is null then raise exception 'Nenhuma temporada ativa'; end if;

  for item in select * from jsonb_array_elements(p_lista) loop
    insert into speaker_points
      (temporada_id, pessoa_id, data, rodada, sala, posicao, speaks, juiz)
    values (
      v_temp,
      (item->>'pessoa_id')::bigint,
      p_data, p_rodada,
      nullif(item->>'sala','')::int,
      item->>'posicao',
      (item->>'speaks')::numeric,
      item->>'juiz'
    )
    on conflict (temporada_id, pessoa_id, data, rodada)
    do update set sala = excluded.sala, posicao = excluded.posicao,
                  speaks = excluded.speaks, juiz = excluded.juiz;
  end loop;
end;
$$;
grant execute on function registrar_speaks(text, date, int, jsonb) to anon;

-- ─── Criar nova temporada (e ativá-la) ──────────────────────
create or replace function criar_temporada(p_senha text, p_nome text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform _checar_admin(p_senha);
  update temporadas set ativa = false where ativa;
  insert into temporadas (nome, ativa) values (p_nome, true);
end;
$$;
grant execute on function criar_temporada(text, text) to anon;

-- ─── Mesclar duas pessoas (deduplicação) ────────────────────
-- Junta tudo de p_remover em p_manter e apaga p_remover.
-- Resolve conflitos dos índices únicos descartando as duplicatas.
create or replace function mesclar_pessoas(
  p_senha text, p_manter bigint, p_remover bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform _checar_admin(p_senha);
  if p_manter = p_remover then
    raise exception 'Selecione duas pessoas diferentes';
  end if;

  -- speaker_points: descarta os do removido que colidiriam
  delete from speaker_points sp_old
   where sp_old.pessoa_id = p_remover
     and exists (
       select 1 from speaker_points sp_new
        where sp_new.pessoa_id = p_manter
          and sp_new.temporada_id = sp_old.temporada_id
          and sp_new.data = sp_old.data
          and sp_new.rodada = sp_old.rodada
     );
  update speaker_points set pessoa_id = p_manter where pessoa_id = p_remover;

  -- presencas: descarta as do removido que colidiriam
  delete from presencas pr_old
   where pr_old.pessoa_id = p_remover
     and exists (
       select 1 from presencas pr_new
        where pr_new.pessoa_id = p_manter
          and pr_new.temporada_id = pr_old.temporada_id
          and pr_new.data = pr_old.data
     );
  update presencas set pessoa_id = p_manter where pessoa_id = p_remover;

  -- duplas que apontavam para o removido
  update presencas set dupla_pessoa_id = p_manter where dupla_pessoa_id = p_remover;

  delete from pessoas where id = p_remover;
end;
$$;
grant execute on function mesclar_pessoas(text, bigint, bigint) to anon;
