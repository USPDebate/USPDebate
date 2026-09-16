-- ============================================================
-- USP DEBATE — Membros e Gestão (auto-cadastro de papel + área de
-- alta gestão para acompanhar presença nos treinos)
-- ============================================================
-- Rode no SQL Editor DEPOIS de trainees.sql (usa a tabela trainees
-- para bloquear trainee de virar membro/gestão).
-- Reexecutável (create or replace / if not exists), menos o SEED do fim.
-- ============================================================

-- Quem se autodeclarou membro ou gestão. Uma pessoa por temporada —
-- reenviar o link de cadastro atualiza o papel (upsert).
create table if not exists membros_gestao (
  id            bigint generated always as identity primary key,
  temporada_id  bigint not null references temporadas(id),
  pessoa_id     bigint not null references pessoas(id),
  papel         text not null check (papel in ('membro','gestao')),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists membros_gestao_unico
  on membros_gestao (temporada_id, pessoa_id);

-- RLS: leitura e escrita públicas, igual à tabela trainees — a área de
-- alta gestão é protegida pela senha só na tela (front-end); o dado em
-- si não é sensível.
alter table membros_gestao enable row level security;
drop policy if exists esc_membros_gestao on membros_gestao;
create policy esc_membros_gestao on membros_gestao for all using (true) with check (true);

-- Trainee não pode virar membro/gestão pelo auto-cadastro: barra no INSERT
-- e no UPDATE, direto no banco (defesa além da checagem no front-end).
create or replace function _bloquear_trainee_membro_gestao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from trainees t
    join temporadas tp on tp.id = t.temporada_id
    where tp.ativa and t.pessoa_id = new.pessoa_id
  ) then
    raise exception 'Você é trainee, ainda não pode registrar para AEXs';
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;
drop trigger if exists trg_bloquear_trainee_membro_gestao on membros_gestao;
create trigger trg_bloquear_trainee_membro_gestao
  before insert or update on membros_gestao
  for each row execute function _bloquear_trainee_membro_gestao();

-- ─── Senha da área de alta gestão ───────────────────────────
create or replace function verificar_senha_alta_gestao(p_senha text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from config where chave = 'senha_alta_gestao' and valor = p_senha
  );
$$;
grant execute on function verificar_senha_alta_gestao(text) to anon;

-- ============================================================
-- SEED — troque a senha se quiser e rode UMA vez
-- ============================================================
insert into config (chave, valor)
values ('senha_alta_gestao', 'giba2026')
on conflict (chave) do update set valor = excluded.valor;
