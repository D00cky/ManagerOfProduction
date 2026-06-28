// Regenerates Example/demo-os.xlsx from the single source of truth (src/data/demo-os.ts).
// Run with: npx tsx scripts/gen-demo-xlsx.ts
// Keeps the import demo workbook in sync with demoOrdensServico (same 8 OS the seed uses).
import { writeFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { demoOrdensServico } from "../src/data/demo-os";

const rows = demoOrdensServico.map((ordem) => ({
  numero_os: ordem.numero,
  endereco_completo: ordem.enderecoCompleto,
  bairro: ordem.bairro,
  cidade: ordem.cidade,
  // A categorização na importação é por código (codigo_tss); tipo_servico fica
  // como referência humana mas não é mais usado para classificar.
  codigo_tss: ordem.codigoTss,
  tipo_servico: ordem.tipoServico,
  polo: ordem.poloCodigo,
  fiscal: ordem.fiscalMatricula ?? "",
  observacao: ordem.observacao ?? ""
}));

const sheet = XLSX.utils.json_to_sheet(rows);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, sheet, "OS Demo");
const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
writeFileSync("Example/demo-os.xlsx", buffer);
console.log(`Wrote Example/demo-os.xlsx with ${rows.length} rows.`);
