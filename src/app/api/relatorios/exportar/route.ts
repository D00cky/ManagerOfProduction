import { NextResponse } from "next/server";
import { exportRelatorioCsv } from "@/server/relatorio-service";
import { prismaRelatorioRepository } from "@/server/prisma-relatorio-repository";
import { getCurrentUser } from "@/server/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  try {
    const csv = await exportRelatorioCsv(prismaRelatorioRepository, user);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="relatorio-ffr.csv"'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao exportar relatorio";
    const status = message.startsWith("Sem permissao") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
