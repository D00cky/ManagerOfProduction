import { NextResponse } from "next/server";
import { atualizarPoloMembro } from "@/server/equipe-service";
import { prismaEquipeRepository } from "@/server/prisma-equipe-repository";
import { getCurrentUser } from "@/server/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { poloId?: string | null };
  const poloId = body.poloId ? String(body.poloId) : null;

  const { id } = await context.params;
  try {
    const membro = await atualizarPoloMembro(prismaEquipeRepository, user, id, poloId);
    return NextResponse.json({ data: membro });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao alterar polo";
    const status = message.startsWith("Sem permissao") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
