import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { demoOrdensServico } from "@/data/demo-os";

describe("Example/demo-os.xlsx", () => {
  it("contains the demo OS rows in importable XLSX format", () => {
    const path = "Example/demo-os.xlsx";

    expect(existsSync(path)).toBe(true);
    const workbook = XLSX.readFile(path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });

    expect(rows).toHaveLength(demoOrdensServico.length);
    expect(rows[0]).toMatchObject({
      numero_os: "OS-1001",
      endereco_completo: "Rua das Flores, 100",
      tipo_servico: "LigacaoAgua",
      polo: "POLO-01"
    });
    expect(rows.map((row) => row.numero_os)).toEqual(demoOrdensServico.map((ordem) => ordem.numero));
  });
});
