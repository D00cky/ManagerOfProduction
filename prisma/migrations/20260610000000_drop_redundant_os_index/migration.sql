-- Drops the redundant OrdemServico(fiscalId, status) index. It is a strict prefix
-- of OrdemServico(fiscalId, status, concluidaEm), which already serves the
-- open-work lookup (fiscalId IN, status IN). Removing it lightens write
-- amplification on the daily 20k+ OS ingest (createMany + per-OS updates).
--
-- PRODUCTION NOTE (large OrdemServico table): plain DROP INDEX takes a brief
-- ACCESS EXCLUSIVE lock. On a very large table prefer running
-- `DROP INDEX CONCURRENTLY "OrdemServico_fiscalId_status_idx";` out-of-band
-- (cannot run inside a migration transaction) and then
-- `prisma migrate resolve --applied 20260610000000_drop_redundant_os_index`.
-- The dev/demo databases are small, so the in-transaction form here is fine there.

-- DropIndex
DROP INDEX "OrdemServico_fiscalId_status_idx";
