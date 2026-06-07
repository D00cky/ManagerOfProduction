import { NextResponse } from "next/server";
import { getRelatorio } from "@/server/relatorio-service";
import { prismaRelatorioRepository } from "@/server/prisma-relatorio-repository";
import { getCurrentUser } from "@/server/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  try {
    const relatorio = await getRelatorio(prismaRelatorioRepository, user);
    return NextResponse.json({ data: relatorio });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar relatorio";
    const status = message.startsWith("Sem permissao") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
