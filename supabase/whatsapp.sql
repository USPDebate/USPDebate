-- ============================================================
-- USP DEBATE — WhatsApp dos trainees
-- ============================================================
-- Rode no SQL Editor DEPOIS de formacoes.sql (usa _checar_trainee).
-- Reexecutável (create or replace / if not exists).
-- ============================================================

-- Telefone é dado pessoal: fica numa tabela à parte, com RLS ligado e SEM
-- policy nenhuma — o anon não lê nem escreve direto (as tabelas de trainees
-- são de leitura pública). Tudo passa pelas funções abaixo: o trainee grava
-- com a senha de trainee e só o admin lê.
-- Uma linha por pessoa; guardado só com dígitos, já com o 55 do Brasil.
create table if not exists trainee_whatsapp (
  pessoa_id     bigint primary key references pessoas(id) on delete cascade,
  whatsapp      text not null,
  atualizado_em timestamptz not null default now()
);
alter table trainee_whatsapp enable row level security;

-- O trainee já cadastrou? (decide se a área do trainee pede o número)
create or replace function trainee_tem_whatsapp(p_senha text, p_pessoa_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform _checar_trainee(p_senha);
  return exists (select 1 from trainee_whatsapp w where w.pessoa_id = p_pessoa_id);
end;
$$;
grant execute on function trainee_tem_whatsapp(text, bigint) to anon;

-- Número cadastrado, mascarado: o trainee confere se está certo, mas a senha
-- de trainee (compartilhada) não expõe o número inteiro dos outros.
create or replace function trainee_whatsapp_mascarado(p_senha text, p_pessoa_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v text;
begin
  perform _checar_trainee(p_senha);
  select w.whatsapp into v from trainee_whatsapp w where w.pessoa_id = p_pessoa_id;
  if v is null then return null; end if;
  return '(' || substr(v, 3, 2) || ') •••••-' || right(v, 4);
end;
$$;
grant execute on function trainee_whatsapp_mascarado(text, bigint) to anon;

-- Grava/troca o número. Aceita com ou sem máscara e com ou sem +55;
-- exige celular brasileiro: DDD + 9 dígitos começando em 9.
create or replace function salvar_whatsapp_trainee(
  p_senha text, p_pessoa_id bigint, p_whatsapp text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v text;
begin
  perform _checar_trainee(p_senha);
  v := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  if length(v) = 11 then v := '55' || v; end if;
  if v !~ '^55[1-9][0-9]9[0-9]{8}$' then
    raise exception 'Número inválido. Use DDD + celular, ex.: (11) 91234-5678';
  end if;
  if not exists (
    select 1 from trainees t join temporadas tp on tp.id = t.temporada_id
     where tp.ativa and t.pessoa_id = p_pessoa_id
  ) then
    raise exception 'Trainee não encontrado nesta temporada';
  end if;

  insert into trainee_whatsapp (pessoa_id, whatsapp, atualizado_em)
  values (p_pessoa_id, v, now())
  on conflict (pessoa_id) do update
    set whatsapp = excluded.whatsapp, atualizado_em = now();
end;
$$;
grant execute on function salvar_whatsapp_trainee(text, bigint, text) to anon;

-- Leitura dos números (admin).
create or replace function listar_whatsapp_trainees(p_senha text)
returns table (pessoa_id bigint, whatsapp text)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform _checar_admin(p_senha);
  return query select w.pessoa_id, w.whatsapp from trainee_whatsapp w;
end;
$$;
grant execute on function listar_whatsapp_trainees(text) to anon;
