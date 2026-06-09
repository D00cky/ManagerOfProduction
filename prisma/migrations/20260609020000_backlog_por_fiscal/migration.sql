-- Backlog per fiscal: a fiscal may now hold many assigned OS at once (monitors
-- assign batches; the fiscal works through them). Drop the partial unique index
-- that enforced at most one open OS per fiscal. The non-unique open-fiscal index
-- (OrdemServico_open_fiscal_idx) is kept for query performance.
DROP INDEX IF EXISTS "OrdemServico_one_open_per_fiscal_idx";

-- Distinct audit event for hard deletions (bulk "excluir").
ALTER TYPE "EventoLog" ADD VALUE IF NOT EXISTS 'exclusao';
