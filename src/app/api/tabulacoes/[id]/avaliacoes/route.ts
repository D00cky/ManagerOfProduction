import { NextResponse } from "next/server";
import { criarAvaliacao } from "@/server/avaliacao-service";
import { prismaAvaliacaoRepository } from "@/server/prisma-avaliacao-repository";
import { getCurrentUser } from "@/server/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function errorStatus(message: string) {
  return message.startsWith("Sem permissao") ? 403 : 400;
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { id } = await context.params;

  try {
    const avaliacao = await criarAvaliacao(prismaAvaliacaoRepository, user, id, {
      nota: Number(body.nota),
      comentario: body.comentario
    });
    return NextResponse.json({ data: avaliacao }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar avaliacao";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}
