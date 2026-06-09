import { NextResponse } from "next/server";
import type { StatusOS, TipoServico } from "@prisma/client";
import { listOrdens, type OsListFilters } from "@/server/os-service";
import { prismaOrdemRepository } from "@/server/prisma-os-repository";
import { parseFilaFilters } from "@/lib/fila-filtros";
import { getCurrentUser } from "@/server/session";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const filters: OsListFilters = parseFilaFilters({
    poloId: url.searchParams.get("poloId"),
    fiscalId: url.searchParams.get("fiscalId"),
    tipoServico: url.searchParams.get("tipoServico") as TipoServico | null,
    status: url.searchParams.get("status") as StatusOS | null,
    busca: url.searchParams.get("busca")
  });

  const result = await listOrdens(prismaOrdemRepository, user, {
    filters,
    page: Number.isFinite(page) ? page : 1
  });
  return NextResponse.json({
    data: result.rows,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize
  });
}
