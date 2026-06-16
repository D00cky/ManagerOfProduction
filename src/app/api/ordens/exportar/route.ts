import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { buildExportDataset } from "@/server/exportacao-service";
import { prismaExportacaoRepository } from "@/server/prisma-exportacao-repository";
import { parseFilaFilters } from "@/lib/fila-filtros";
import { getCurrentUser } from "@/server/session";

function csvCell(value: string | number) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  try {
    const url = new URL(request.url);
    const filters = parseFilaFilters({
      poloId: url.searchParams.get("poloId"),
      fiscalId: url.searchParams.get("fiscalId"),
      tipoServico: url.searchParams.get("tipoServico"),
      status: url.searchParams.get("status"),
      busca: url.searchParams.get("busca"),
      fimDe: url.searchParams.get("fimDe"),
      fimAte: url.searchParams.get("fimAte")
    });
    const formato = url.searchParams.get("formato") === "csv" ? "csv" : "xlsx";

    const dataset = await buildExportDataset(prismaExportacaoRepository, user, filters);

    if (formato === "csv") {
      // CSV achatado: uma linha por OS, com a coluna "Categoria" identificando a aba.
      const colunas = ["Categoria", ...new Set(dataset.sheets.flatMap((s) => s.colunas))];
      const linhas: string[] = [colunas.map(csvCell).join(",")];
      for (const sheet of dataset.sheets) {
        const indice = new Map(sheet.colunas.map((c, i) => [c, i]));
        for (const linha of sheet.linhas) {
          const celulas = colunas.map((coluna) =>
            coluna === "Categoria" ? sheet.nome : indice.has(coluna) ? linha[indice.get(coluna)!] : ""
          );
          linhas.push(celulas.map(csvCell).join(","));
        }
      }
      return new NextResponse(linhas.join("\n"), {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="ordens-ffr.csv"'
        }
      });
    }

    const wb = XLSX.utils.book_new();
    for (const sheet of dataset.sheets) {
      const ws = XLSX.utils.aoa_to_sheet([sheet.colunas, ...sheet.linhas]);
      XLSX.utils.book_append_sheet(wb, ws, sheet.nome);
    }
    if (dataset.sheets.length === 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Sem ordens"]]), "Vazio");
    }
    const buffer = new Uint8Array(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": 'attachment; filename="ordens-ffr.xlsx"'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao exportar ordens";
    const status = message.startsWith("Sem permissao") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
