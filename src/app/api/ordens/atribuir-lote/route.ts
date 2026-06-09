import { NextResponse } from "next/server";
import { atribuirOrdensLote } from "@/server/os-service";
import { prismaOrdemRepository } from "@/server/prisma-os-repository";
import { getCurrentUser } from "@/server/session";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (typeof body.fiscalId !== "string" || body.fiscalId.length === 0) {
    return NextResponse.json({ error: "Fiscal invalido" }, { status: 400 });
  }
  if (!Array.isArray(body.ordemIds) || body.ordemIds.some((id: unknown) => typeof id !== "string")) {
    return NextResponse.json({ error: "Lista de OS invalida" }, { status: 400 });
  }

  try {
    const result = await atribuirOrdensLote(prismaOrdemRepository, user, body.ordemIds, body.fiscalId);
    return NextResponse.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atribuir OS";
    const status = message.startsWith("Sem permissao") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
