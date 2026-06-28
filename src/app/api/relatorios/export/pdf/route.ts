import { NextResponse, type NextRequest } from "next/server";
import { buildRelatorioExportDataset } from "@/server/relatorio-export-service";
import { prismaRelatorioExportRepository } from "@/server/prisma-relatorio-export-repository";
import { gerarRelatorioPdf } from "@/server/relatorio-pdf";
import { filtrosFromSearchParams } from "@/lib/relatorio-export-filtros";
import { getCurrentUser } from "@/server/session";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const filtros = filtrosFromSearchParams(request.nextUrl.searchParams);
  try {
    const dataset = await buildRelatorioExportDataset(prismaRelatorioExportRepository, user, filtros);
    const pdf = gerarRelatorioPdf(dataset);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="relatorio-inspecoes.pdf"'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar relatorio";
    const status = message.startsWith("Sem permissao") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
