import { NextResponse } from "next/server";
import { atualizarPolo, type AtualizarPoloInput } from "@/server/polo-service";
import { prismaPoloRepository } from "@/server/prisma-polo-repository";
import { getCurrentUser } from "@/server/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Partial<AtualizarPoloInput>;
  const data: AtualizarPoloInput = {};
  if (typeof body.nome === "string") data.nome = body.nome;
  if (typeof body.codigo === "string") data.codigo = body.codigo;
  if (body.regiao !== undefined) data.regiao = body.regiao;
  if (typeof body.ativo === "boolean") data.ativo = body.ativo;

  const { id } = await context.params;
  try {
    const polo = await atualizarPolo(prismaPoloRepository, user, id, data);
    return NextResponse.json({ data: polo });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar polo";
    const status = message.startsWith("Sem permissao") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
