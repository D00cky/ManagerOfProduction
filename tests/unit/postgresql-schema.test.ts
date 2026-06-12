import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PostgreSQL schema", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  it("uses PostgreSQL as the only Prisma provider", () => {
    expect(schema).toContain('provider = "postgresql"');
    expect(schema).not.toContain('provider = "sqlite"');
  });

  it("indexes the fiscal open-work and polo queue access paths", () => {
    // Open-work (fiscalId IN, status IN) is served by the composite below; the
    // standalone [fiscalId, status] was dropped as a redundant prefix.
    expect(schema).toContain("@@index([fiscalId, status, concluidaEm])");
    expect(schema).not.toContain("@@index([fiscalId, status])");
    expect(schema).toContain("@@index([poloId, status, fiscalId, dataProgramada, createdAt])");
  });
});
