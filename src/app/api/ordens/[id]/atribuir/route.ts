import { NextResponse } from "next/server";
import { atribuirOrdem } from "@/server/os-service";
import { prismaOrdemRepository } from "@/server/prisma-os-repository";
import { getCurrentUser } from "@/server/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (typeof body.fiscalId !== "string" || body.fiscalId.length === 0) {
    return NextResponse.json({ error: "Fiscal invalido" }, { status: 400 });
  }

  const { id } = await context.params;
  try {
    const ordem = await atribuirOrdem(prismaOrdemRepository, user, id, body.fiscalId);
    return NextResponse.json({ data: ordem });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atribuir OS";
    const status = message.startsWith("Sem permissao") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
