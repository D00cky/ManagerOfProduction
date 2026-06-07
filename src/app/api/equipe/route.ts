import { NextResponse } from "next/server";
import { listEquipe } from "@/server/equipe-service";
import { prismaEquipeRepository } from "@/server/prisma-equipe-repository";
import { getCurrentUser } from "@/server/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  try {
    const equipe = await listEquipe(prismaEquipeRepository, user);
    return NextResponse.json({ data: equipe });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar equipe";
    const status = message.startsWith("Sem permissao") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
