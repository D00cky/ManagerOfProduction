import { NextResponse } from "next/server";
import { atualizarUsuario, type AtualizarUsuarioInput } from "@/server/usuario-service";
import { prismaUsuarioRepository } from "@/server/prisma-usuario-repository";
import { getCurrentUser } from "@/server/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Partial<AtualizarUsuarioInput>;
  const data: AtualizarUsuarioInput = {};
  if (typeof body.name === "string") data.name = body.name;
  if (body.perfil !== undefined) data.perfil = body.perfil;
  if (body.poloId !== undefined) data.poloId = body.poloId;
  if (body.status !== undefined) data.status = body.status;

  const { id } = await context.params;
  try {
    const usuario = await atualizarUsuario(prismaUsuarioRepository, user, id, data);
    return NextResponse.json({ data: usuario });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar usuario";
    const status = message.startsWith("Sem permissao") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
