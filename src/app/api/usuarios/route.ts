import { NextResponse } from "next/server";
import { criarUsuario, listUsuarios, type CriarUsuarioInput } from "@/server/usuario-service";
import { prismaUsuarioRepository } from "@/server/prisma-usuario-repository";
import { getCurrentUser } from "@/server/session";

function statusForError(message: string) {
  return message.startsWith("Sem permissao") ? 403 : 400;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  try {
    const usuarios = await listUsuarios(prismaUsuarioRepository, user);
    return NextResponse.json({ data: usuarios });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar usuarios";
    return NextResponse.json({ error: message }, { status: statusForError(message) });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Partial<CriarUsuarioInput>;
  const input: CriarUsuarioInput = {
    name: String(body.name ?? ""),
    email: String(body.email ?? ""),
    matricula: String(body.matricula ?? ""),
    password: String(body.password ?? ""),
    perfil: body.perfil as CriarUsuarioInput["perfil"]
  };
  if (body.poloId !== undefined) input.poloId = body.poloId;
  if (body.regiao !== undefined) input.regiao = body.regiao;

  try {
    const usuario = await criarUsuario(prismaUsuarioRepository, user, input);
    return NextResponse.json({ data: usuario }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar usuario";
    return NextResponse.json({ error: message }, { status: statusForError(message) });
  }
}
