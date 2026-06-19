import { NextResponse } from "next/server";
import type { StatusOS, TipoServico } from "@prisma/client";
import { excluirOrdens } from "@/server/os-service";
import { prismaOrdemRepository } from "@/server/prisma-os-repository";
import { parseFilaFilters } from "@/lib/fila-filtros";
import { getCurrentUser } from "@/server/session";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const todas = body.todas === true;
  const ids = Array.isArray(body.ordemIds) ? body.ordemIds.filter((id: unknown) => typeof id === "string") : [];
  if (!todas && ids.length === 0) {
    return NextResponse.json({ error: "Nenhuma OS selecionada" }, { status: 400 });
  }

  // When deleting "todas", honour the active filters so it targets the visible view.
  const filters = parseFilaFilters({
    poloId: body.filtros?.poloId,
    fiscalId: body.filtros?.fiscalId,
    tipoServico: body.filtros?.tipoServico as TipoServico | undefined,
    status: body.filtros?.status as StatusOS | undefined,
    busca: body.filtros?.busca,
    fimDe: body.filtros?.fimDe,
    fimAte: body.filtros?.fimAte
  });

  try {
    const result = await excluirOrdens(prismaOrdemRepository, user, { ids, todas, filters });
    return NextResponse.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao excluir OS";
    const status = message.startsWith("Sem permissao") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
