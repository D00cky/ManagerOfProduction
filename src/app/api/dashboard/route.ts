import { NextResponse } from "next/server";
import { getDashboardResumo, type DashboardFiltros } from "@/server/dashboard-service";
import { prismaDashboardRepository } from "@/server/prisma-dashboard-repository";
import { getCurrentUser } from "@/server/session";

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const filtros: DashboardFiltros = {
    regiao: url.searchParams.get("regiao") ?? undefined,
    polo: url.searchParams.get("polo") ?? undefined,
    municipio: url.searchParams.get("municipio") ?? undefined,
    from: parseDate(url.searchParams.get("from")),
    to: parseDate(url.searchParams.get("to"))
  };

  const resumo = await getDashboardResumo(prismaDashboardRepository, user, new Date(), filtros);
  return NextResponse.json({ data: resumo });
}
