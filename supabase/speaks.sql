-- ============================================================
-- USP DEBATE — Registro de speaks pelo juiz (sem senha)
-- ============================================================
-- Rode no SQL Editor depois de schema.sql e functions.sql.
-- A leitura (ler_speaks) já foi criada no schema.sql.
-- ============================================================

create policy criar_speaks on speaker_points
  for insert with check (true);

create policy editar_speaks on speaker_points
  for update using (true) with check (true);
