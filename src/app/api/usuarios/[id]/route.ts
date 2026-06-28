import { NextResponse } from "next/server";
import {
  atualizarUsuario,
  excluirUsuario,
  type AtualizarUsuarioInput
} from "@/server/usuario-service";
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
  if (typeof body.email === "string") data.email = body.email;
  if (typeof body.matricula === "string") data.matricula = body.matricula;
  if (body.perfil !== undefined) data.perfil = body.perfil;
  if (body.poloId !== undefined) data.poloId = body.poloId;
  if (body.regiao !== undefined) data.regiao = body.regiao;
  if (Array.isArray(body.polosPermitidos)) data.polosPermitidos = body.polosPermitidos.map(String);
  if (body.status !== undefined) data.status = body.status;
  if (typeof body.password === "string") data.password = body.password;

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

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const { id } = await context.params;
  try {
    await excluirUsuario(prismaUsuarioRepository, user, id);
    return NextResponse.json({ data: { id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao excluir usuario";
    const status = message.startsWith("Sem permissao") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
