-- Migration 016: remove observacoes de researchers.
-- O campo duplicava a função de bio (user) e era editável apenas por professores.

ALTER TABLE researchers DROP COLUMN IF EXISTS observacoes;
