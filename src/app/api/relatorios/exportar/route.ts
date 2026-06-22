import { NextResponse, type NextRequest } from "next/server";
import { exportRelatorioCsv, mesParaIntervalo } from "@/server/relatorio-service";
import { prismaRelatorioRepository } from "@/server/prisma-relatorio-repository";
import { getCurrentUser } from "@/server/session";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const { from, to } = mesParaIntervalo(searchParams.get("mes") ?? undefined);
  const filtros = {
    regiao: searchParams.get("regiao") ?? undefined,
    polo: searchParams.get("polo") ?? undefined,
    municipio: searchParams.get("municipio") ?? undefined,
    from,
    to,
    baseData: searchParams.get("base") === "importacao" ? ("importacao" as const) : ("conclusao" as const)
  };

  try {
    const csv = await exportRelatorioCsv(prismaRelatorioRepository, user, filtros);
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
