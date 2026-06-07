import type { StatusOS } from "@prisma/client";
import { NextResponse } from "next/server";
import { updateOrdemStatus } from "@/server/os-service";
import { prismaOrdemRepository } from "@/server/prisma-os-repository";
import { getCurrentUser } from "@/server/session";

const statuses: StatusOS[] = ["NaFila", "EmExecucao", "Pendente", "Concluida", "Cancelada"];

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (!statuses.includes(body.status)) {
    return NextResponse.json({ error: "Status invalido" }, { status: 400 });
  }

  const { id } = await context.params;
  try {
    const ordem = await updateOrdemStatus(prismaOrdemRepository, user, id, body.status);
    return NextResponse.json({ data: ordem });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar OS";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
