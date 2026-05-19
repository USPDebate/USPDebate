-- ============================================================
-- USP DEBATE — Schema do banco (Supabase / Postgres)
-- ============================================================
-- Como usar: Supabase → SQL Editor → cole tudo → Run.
-- Pode rodar mais de uma vez (é idempotente onde possível),
-- mas o SEED de pessoas duplica se rodar 2x — rode o seed só 1x.
-- ============================================================

create extension if not exists unaccent;

-- ─── 1. TEMPORADAS ──────────────────────────────────────────
create table if not exists temporadas (
  id         bigint generated always as identity primary key,
  nome       text not null unique,
  ativa      boolean not null default false,
  criada_em  timestamptz not null default now()
);
-- garante no máximo UMA temporada ativa
create unique index if not exists temporadas_uma_ativa
  on temporadas (ativa) where ativa;

-- ─── 2. PESSOAS (identidade global — atravessa temporadas) ──
create table if not exists pessoas (
  id         bigint generated always as identity primary key,
  nome       text not null,
  nome_norm  text not null,
  criada_em  timestamptz not null default now()
);
create index if not exists pessoas_nome_norm_idx on pessoas (nome_norm);

-- ─── 3. PRESENCAS ───────────────────────────────────────────
create table if not exists presencas (
  id               bigint generated always as identity primary key,
  temporada_id     bigint not null references temporadas(id),
  pessoa_id        bigint not null references pessoas(id),
  data             date not null,
  dupla_pessoa_id  bigint references pessoas(id),
  tipo             text not null default 'ps'
                     check (tipo in ('ps','visitante','observador')),
  criada_em        timestamptz not null default now()
);
-- uma presença por pessoa por dia
create unique index if not exists presencas_unica_dia
  on presencas (temporada_id, pessoa_id, data);

-- ─── 4. DRAWS ───────────────────────────────────────────────
create table if not exists draws (
  id            bigint generated always as identity primary key,
  temporada_id  bigint not null references temporadas(id),
  data          date not null,
  publicado     boolean not null default false,
  conteudo      jsonb not null,         -- { salas: [...], juizes: [...] }
  criado_em     timestamptz not null default now()
);
-- um draw por dia
create unique index if not exists draws_um_por_dia
  on draws (temporada_id, data);

-- ─── 5. SPEAKER POINTS ──────────────────────────────────────
create table if not exists speaker_points (
  id            bigint generated always as identity primary key,
  temporada_id  bigint not null references temporadas(id),
  pessoa_id     bigint not null references pessoas(id),
  data          date not null,
  rodada        int not null default 1,
  sala          int,
  posicao       text,
  speaks        numeric(5,1) not null check (speaks >= 0 and speaks <= 100),
  juiz          text,
  criado_em     timestamptz not null default now()
);
-- um speak por pessoa por rodada por dia
create unique index if not exists speaks_unico
  on speaker_points (temporada_id, pessoa_id, data, rodada);

-- ─── 6. CONFIG (senha de admin) ─────────────────────────────
create table if not exists config (
  chave  text primary key,
  valor  text not null
);

-- ============================================================
-- RLS — Row Level Security
-- ============================================================
alter table temporadas     enable row level security;
alter table pessoas        enable row level security;
alter table presencas      enable row level security;
alter table draws          enable row level security;
alter table speaker_points enable row level security;
alter table config         enable row level security;

-- Leitura: pública (todos podem ver)
create policy ler_temporadas on temporadas     for select using (true);
create policy ler_pessoas    on pessoas        for select using (true);
create policy ler_presencas  on presencas      for select using (true);
create policy ler_draws      on draws          for select using (true);
create policy ler_speaks     on speaker_points for select using (true);

-- Escrita pública: cadastrar pessoa e registrar/editar presença
create policy criar_pessoa    on pessoas   for insert with check (true);
create policy criar_presenca  on presencas for insert with check (true);
create policy editar_presenca on presencas for update using (true) with check (true);

-- config NÃO tem policy → ninguém lê/escreve com a chave anônima.
-- As funções SECURITY DEFINER abaixo acessam por dentro.

-- ============================================================
-- FUNÇÃO: verificar senha de admin
-- ============================================================
create or replace function verificar_senha(p_senha text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from config where chave = 'senha_admin' and valor = p_senha
  );
$$;
grant execute on function verificar_senha(text) to anon;

-- ============================================================
-- SEED — rode esta parte UMA vez só
-- ============================================================
insert into config (chave, valor)
values ('senha_admin', 'USPDebate2026')
on conflict (chave) do update set valor = excluded.valor;

insert into temporadas (nome, ativa)
values ('2026', true)
on conflict (nome) do nothing;

insert into pessoas (nome, nome_norm)
select nome, lower(unaccent(nome))
from (values
  ('Ana Luiza'),
  ('Augusto Silva de Queiroz'),
  ('Caio Krüger Monteiro'),
  ('Carlos Eduardo Dutra Bodart'),
  ('Carolina Sacchetto da Silva'),
  ('Cinthia Borelli'),
  ('Daniel Loureiro Rodrigues'),
  ('Darlei Pamplona'),
  ('Eduardo Kohlsdorf'),
  ('Felipe Barreto Távora'),
  ('Gabriela Espinhara Siqueira'),
  ('Gabriela Saito Pereira'),
  ('Giuseppe Argenta Zaneti'),
  ('Guilherme Mecenas Duarte'),
  ('Gustavo Pettirossi'),
  ('Heitor Carlos Soares'),
  ('Heloísa Viana Fonsêca'),
  ('Henry Gabriel Lima da Silva'),
  ('Isabela Rebello Presgrave'),
  ('João Pedro Silveira Ferreira'),
  ('Julia Mendes Cosme'),
  ('Julia Oliveira Rezende Coêlho'),
  ('Julia Rangel Rosa Nasser'),
  ('Kaique Antunes'),
  ('Leonardo Carneiro Burlacchini de Carvalho'),
  ('Lucas De Oliveira De Almeida'),
  ('Manuela Maria Martins Adriano'),
  ('Manuela Reis Garin'),
  ('Marcela Fusco Pina'),
  ('Maria Vitória Rocha Veloso'),
  ('Matheus Martins Trandafilov'),
  ('Nicolas Fagundes Justi Muniz'),
  ('Pedro dos Santos Pereira'),
  ('Pedro Henrique G. Candido'),
  ('Rafael Noia Meira do Nascimento'),
  ('Tomas Wolffenbüttel'),
  ('Victor Souza Santos')
) as v(nome);
