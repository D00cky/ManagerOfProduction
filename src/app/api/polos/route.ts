import { NextResponse } from "next/server";
import { criarPolo, listPolos, type CriarPoloInput } from "@/server/polo-service";
import { prismaPoloRepository } from "@/server/prisma-polo-repository";
import { getCurrentUser } from "@/server/session";

function errorStatus(message: string) {
  return message.startsWith("Sem permissao") ? 403 : 400;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const polos = await listPolos(prismaPoloRepository, user);
  return NextResponse.json({ data: polos });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Partial<CriarPoloInput>;
  const input: CriarPoloInput = {
    nome: String(body.nome ?? ""),
    codigo: String(body.codigo ?? "")
  };

  try {
    const polo = await criarPolo(prismaPoloRepository, user, input);
    return NextResponse.json({ data: polo }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar polo";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}
