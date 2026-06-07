import { NextResponse } from "next/server";
import { confirmarImportacao, type DuplicateMode } from "@/server/importacao-service";
import { prismaImportacaoRepository } from "@/server/prisma-importacao-repository";
import { getCurrentUser } from "@/server/session";

const duplicateModes: DuplicateMode[] = ["ignorar", "atualizar"];

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (!Array.isArray(body.rows) || !duplicateModes.includes(body.duplicateMode)) {
    return NextResponse.json({ error: "Payload de importacao invalido" }, { status: 400 });
  }

  try {
    const resumo = await confirmarImportacao(prismaImportacaoRepository, user, body.rows, body.duplicateMode);
    return NextResponse.json({ data: resumo });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao confirmar importacao";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
