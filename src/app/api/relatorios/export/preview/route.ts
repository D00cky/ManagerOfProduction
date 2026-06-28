import { NextResponse, type NextRequest } from "next/server";
import { buildRelatorioExportDataset } from "@/server/relatorio-export-service";
import { prismaRelatorioExportRepository } from "@/server/prisma-relatorio-export-repository";
import { filtrosFromSearchParams } from "@/lib/relatorio-export-filtros";
import { getCurrentUser } from "@/server/session";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const filtros = filtrosFromSearchParams(request.nextUrl.searchParams);
  try {
    const dataset = await buildRelatorioExportDataset(prismaRelatorioExportRepository, user, filtros);
    return NextResponse.json({ data: dataset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar relatorio";
    const status = message.startsWith("Sem permissao") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
