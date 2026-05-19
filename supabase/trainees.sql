-- ============================================================
-- USP DEBATE — Acompanhamento de Trainees
-- ============================================================
-- Rode no SQL Editor depois de schema.sql.
-- A área é protegida pela senha de admin no app; os dados não
-- são sensíveis, então a escrita é liberada (como em speaks).
-- ============================================================

-- Quem é trainee na temporada (+ mentor em texto livre).
create table if not exists trainees (
  id           bigint generated always as identity primary key,
  temporada_id bigint not null references temporadas(id),
  pessoa_id    bigint not null references pessoas(id),
  mentor       text,
  criado_em    timestamptz not null default now()
);
create unique index if not exists trainees_unico on trainees (temporada_id, pessoa_id);

-- Semanas arbitrárias do acompanhamento (definidas pelo admin).
create table if not exists trainee_semanas (
  id           bigint generated always as identity primary key,
  temporada_id bigint not null references temporadas(id),
  nome         text not null,
  data_inicio  date not null,
  data_fim     date not null,
  criado_em    timestamptz not null default now()
);

-- Formação feita: existência da linha = feito.
create table if not exists trainee_formacoes (
  id           bigint generated always as identity primary key,
  temporada_id bigint not null references temporadas(id),
  pessoa_id    bigint not null references pessoas(id),
  semana_id    bigint not null references trainee_semanas(id) on delete cascade,
  criado_em    timestamptz not null default now()
);
create unique index if not exists trainee_formacoes_unico
  on trainee_formacoes (pessoa_id, semana_id);

-- RLS
alter table trainees          enable row level security;
alter table trainee_semanas   enable row level security;
alter table trainee_formacoes enable row level security;

create policy esc_trainees on trainees          for all using (true) with check (true);
create policy esc_tsem     on trainee_semanas   for all using (true) with check (true);
create policy esc_tform    on trainee_formacoes for all using (true) with check (true);
