-- ============================================================
-- USP DEBATE — Formações dos trainees (demanda + envio de imagem)
-- ============================================================
-- Rode no SQL Editor DEPOIS de trainees.sql.
-- Reexecutável (create or replace / if not exists), menos o SEED do fim.
-- ============================================================

-- ─── Bucket das imagens ─────────────────────────────────────
-- Público para leitura por URL direta — o nome do arquivo é um UUID, então
-- não é adivinhável — mas SEM policy de select: ninguém consegue LISTAR o
-- bucket. Só chega na imagem quem recebeu o caminho vindo do banco.
-- O limite de 1 MB e a lista de tipos barram vídeo, zip e arquivo gigante
-- antes de qualquer código nosso rodar.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('formacoes', 'formacoes', true, 1048576,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists ins_formacoes on storage.objects;
create policy ins_formacoes on storage.objects for insert to anon
  with check (bucket_id = 'formacoes');

-- Apagar só o que já tem mais de 7 dias: a limpeza do admin funciona e
-- ninguém consegue destruir os envios da semana corrente.
drop policy if exists del_formacoes on storage.objects;
create policy del_formacoes on storage.objects for delete to anon
  using (bucket_id = 'formacoes' and created_at < now() - interval '7 days');

-- ─── Tabelas ────────────────────────────────────────────────

-- Demanda de formação: 1..N por semana (hoje 1 ou 2, o modelo não limita).
create table if not exists formacao_demandas (
  id           bigint generated always as identity primary key,
  temporada_id bigint not null references temporadas(id),
  semana_id    bigint not null references trainee_semanas(id) on delete cascade,
  titulo       text   not null,
  descricao    text,
  prazo        date   not null,
  ordem        int    not null default 1,
  criado_em    timestamptz not null default now()
);
create index if not exists formacao_demandas_semana on formacao_demandas (semana_id);

-- Envio do trainee. A linha existir = enviado; verificado_em = aprovado.
-- 'atrasado' é etiqueta, não bloqueio: entrega fora do prazo entra normal.
-- 'paths' é lista: um resumo comprido pode precisar de mais de uma foto.
-- Continua UMA linha por (demanda, pessoa) — a verificação é da entrega
-- inteira, não de cada imagem.
create table if not exists formacao_envios (
  id             bigint generated always as identity primary key,
  demanda_id     bigint not null references formacao_demandas(id) on delete cascade,
  pessoa_id      bigint not null references pessoas(id),
  paths          text[] not null default '{}',
  enviado_em     timestamptz not null default now(),
  atrasado       boolean not null default false,
  verificado_em  timestamptz,
  imagem_apagada boolean not null default false
);
create unique index if not exists formacao_envios_unico
  on formacao_envios (demanda_id, pessoa_id);

-- Migração de quem já rodou a versão de uma imagem só.
alter table formacao_envios add column if not exists paths text[] not null default '{}';
do $mig$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'formacao_envios'
       and column_name = 'path'
  ) then
    update formacao_envios
       set paths = array[path]
     where path is not null and coalesce(array_length(paths, 1), 0) = 0;
    alter table formacao_envios drop column path;
  end if;
end
$mig$;

-- ─── RLS ────────────────────────────────────────────────────
-- Leitura pública (a área do trainee e o grid do admin precisam ler).
-- Escrita SÓ pelas funções abaixo, que exigem senha.
alter table formacao_demandas enable row level security;
alter table formacao_envios   enable row level security;

drop policy if exists ler_fdemandas on formacao_demandas;
create policy ler_fdemandas on formacao_demandas for select using (true);
drop policy if exists ler_fenvios on formacao_envios;
create policy ler_fenvios on formacao_envios for select using (true);

-- ─── Senha de trainee ───────────────────────────────────────
create or replace function verificar_senha_trainee(p_senha text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from config where chave = 'senha_trainee' and valor = p_senha
  );
$$;
grant execute on function verificar_senha_trainee(text) to anon;

create or replace function _checar_trainee(p_senha text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from config where chave = 'senha_trainee' and valor = p_senha
  ) then
    raise exception 'Senha de trainee incorreta';
  end if;
end;
$$;

-- ─── Demandas (admin) ───────────────────────────────────────
create or replace function criar_demanda(
  p_senha text, p_semana_id bigint, p_titulo text,
  p_descricao text, p_prazo date, p_ordem int default 1
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_temp bigint; v_id bigint;
begin
  perform _checar_admin(p_senha);
  if length(btrim(coalesce(p_titulo, ''))) < 2 then
    raise exception 'Dê um título para a formação';
  end if;
  select id into v_temp from temporadas where ativa limit 1;
  if v_temp is null then raise exception 'Nenhuma temporada ativa'; end if;

  insert into formacao_demandas (temporada_id, semana_id, titulo, descricao, prazo, ordem)
  values (v_temp, p_semana_id, btrim(p_titulo), nullif(btrim(coalesce(p_descricao, '')), ''),
          p_prazo, coalesce(p_ordem, 1))
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function criar_demanda(text, bigint, text, text, date, int) to anon;

create or replace function editar_demanda(
  p_senha text, p_id bigint, p_titulo text, p_descricao text, p_prazo date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform _checar_admin(p_senha);
  update formacao_demandas
     set titulo    = coalesce(nullif(btrim(p_titulo), ''), titulo),
         descricao = nullif(btrim(coalesce(p_descricao, '')), ''),
         prazo     = coalesce(p_prazo, prazo)
   where id = p_id;
end;
$$;
grant execute on function editar_demanda(text, bigint, text, text, date) to anon;

-- Apaga a demanda e os envios dela (cascade). As imagens viram órfãs e
-- somem na limpeza — arquivo sem linha não aparece em lugar nenhum.
create or replace function apagar_demanda(p_senha text, p_id bigint)
returns table (path text)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform _checar_admin(p_senha);
  return query
    with apagados as (
      delete from formacao_envios e where e.demanda_id = p_id returning e.paths
    )
    select unnest(apagados.paths) from apagados;
  delete from formacao_demandas where id = p_id;
end;
$$;
grant execute on function apagar_demanda(text, bigint) to anon;

-- ─── Envio (trainee) ────────────────────────────────────────
-- O carimbo de tempo é o do servidor, então mudar o relógio do celular não
-- muda nada. Reenvio é permitido enquanto não estiver verificado.
create or replace function enviar_formacao(
  p_senha text, p_pessoa_id bigint, p_demanda_id bigint, p_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_prazo date; v_n int;
begin
  perform _checar_trainee(p_senha);
  if coalesce(btrim(p_path), '') = '' then
    raise exception 'Caminho da imagem vazio';
  end if;

  select prazo into v_prazo from formacao_demandas where id = p_demanda_id;
  if v_prazo is null then raise exception 'Formação não encontrada'; end if;

  if exists (
    select 1 from formacao_envios
     where demanda_id = p_demanda_id and pessoa_id = p_pessoa_id
       and verificado_em is not null
  ) then
    raise exception 'Este envio já foi verificado. Fale com a diretoria para reabrir.';
  end if;

  select coalesce(array_length(e.paths, 1), 0) into v_n
    from formacao_envios e
   where e.demanda_id = p_demanda_id and e.pessoa_id = p_pessoa_id;
  if coalesce(v_n, 0) >= 4 then
    raise exception 'Limite de 4 imagens por formação. Remova uma antes de enviar outra.';
  end if;

  -- 'atrasado' fica com o valor do PRIMEIRO envio: mandar uma página
  -- complementar depois não deve marcar a entrega inteira como atrasada.
  insert into formacao_envios
    (demanda_id, pessoa_id, paths, enviado_em, atrasado, imagem_apagada)
  values
    (p_demanda_id, p_pessoa_id, array[btrim(p_path)], now(), current_date > v_prazo, false)
  on conflict (demanda_id, pessoa_id) do update
    set paths = formacao_envios.paths || excluded.paths,
        enviado_em = excluded.enviado_em,
        imagem_apagada = false;
end;
$$;
grant execute on function enviar_formacao(text, bigint, bigint, text) to anon;

-- Tira uma imagem da entrega — o trainee mandou a página errada e quer trocar.
-- Se sobrar zero imagem, a entrega inteira sai (volta a ficar pendente).
create or replace function remover_imagem_formacao(
  p_senha text, p_pessoa_id bigint, p_demanda_id bigint, p_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform _checar_trainee(p_senha);
  if exists (
    select 1 from formacao_envios
     where demanda_id = p_demanda_id and pessoa_id = p_pessoa_id
       and verificado_em is not null
  ) then
    raise exception 'Esta formação já foi verificada.';
  end if;

  update formacao_envios
     set paths = array_remove(paths, p_path)
   where demanda_id = p_demanda_id and pessoa_id = p_pessoa_id;

  delete from formacao_envios
   where demanda_id = p_demanda_id and pessoa_id = p_pessoa_id
     and coalesce(array_length(paths, 1), 0) = 0;
end;
$$;
grant execute on function remover_imagem_formacao(text, bigint, bigint, text) to anon;

-- ─── Verificação em lote (admin) ────────────────────────────
-- Marca/desmarca os envios e recalcula o "F" da grade de acompanhamento:
-- o F só fecha quando TODAS as demandas da semana estão verificadas.
create or replace function verificar_formacoes(
  p_senha text, p_ids bigint[], p_verificado boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  perform _checar_admin(p_senha);
  if p_ids is null or array_length(p_ids, 1) is null then return; end if;

  update formacao_envios
     set verificado_em = case when p_verificado then now() else null end
   where id = any(p_ids);

  for r in
    select distinct e.pessoa_id, d.semana_id, d.temporada_id
      from formacao_envios e
      join formacao_demandas d on d.id = e.demanda_id
     where e.id = any(p_ids)
  loop
    if exists (select 1 from formacao_demandas d0 where d0.semana_id = r.semana_id)
       and not exists (
         select 1 from formacao_demandas d2
          where d2.semana_id = r.semana_id
            and not exists (
              select 1 from formacao_envios e2
               where e2.demanda_id = d2.id
                 and e2.pessoa_id = r.pessoa_id
                 and e2.verificado_em is not null
            )
       )
    then
      insert into trainee_formacoes (temporada_id, pessoa_id, semana_id)
      values (r.temporada_id, r.pessoa_id, r.semana_id)
      on conflict (pessoa_id, semana_id) do nothing;
    else
      delete from trainee_formacoes
       where pessoa_id = r.pessoa_id and semana_id = r.semana_id;
    end if;
  end loop;
end;
$$;
grant execute on function verificar_formacoes(text, bigint[], boolean) to anon;

-- Recusa um envio: apaga a linha para o trainee poder mandar de novo.
create or replace function apagar_envio(p_senha text, p_id bigint)
returns table (path text)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform _checar_admin(p_senha);
  return query
    with apagados as (
      delete from formacao_envios e where e.id = p_id returning e.paths
    )
    select unnest(apagados.paths) from apagados;
end;
$$;
grant execute on function apagar_envio(text, bigint) to anon;

-- ─── Limpeza das imagens (admin) ────────────────────────────
-- Devolve os caminhos para o app apagar no Storage e marca o registro como
-- sem imagem. O histórico de quem entregou e foi verificado continua.
create or replace function limpar_imagens_formacao(p_senha text, p_antes date)
returns table (path text)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform _checar_admin(p_senha);
  return query
    with limpos as (
      update formacao_envios e
         set imagem_apagada = true
        from formacao_demandas d
       where d.id = e.demanda_id
         and d.prazo < p_antes
         and not e.imagem_apagada
      returning e.paths
    )
    select unnest(limpos.paths) from limpos;
end;
$$;
grant execute on function limpar_imagens_formacao(text, date) to anon;

-- ============================================================
-- SEED — troque a senha e rode UMA vez
-- ============================================================
insert into config (chave, valor)
values ('senha_trainee', 'TROQUE_ESTA_SENHA')
on conflict (chave) do update set valor = excluded.valor;
