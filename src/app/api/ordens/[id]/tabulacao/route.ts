import { NextResponse } from "next/server";
import { saveTabulacao } from "@/server/tabulacao-service";
import { prismaTabulacaoRepository } from "@/server/prisma-tabulacao-repository";
import { getCurrentUser } from "@/server/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (!body.respostas || typeof body.respostas !== "object" || Array.isArray(body.respostas)) {
    return NextResponse.json({ error: "Respostas invalidas" }, { status: 400 });
  }

  const { id } = await context.params;
  try {
    const tabulacao = await saveTabulacao(prismaTabulacaoRepository, user, {
      ordemServicoId: id,
      respostas: body.respostas,
      observacoes: body.observacoes
    });
    return NextResponse.json({ data: tabulacao });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar tabulacao";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
