import { NextResponse } from "next/server";
import { alterarSenhaPropria } from "@/server/senha-service";
import { prismaSenhaRepository } from "@/server/prisma-senha-repository";

/**
 * Troca de senha self-service a partir da tela de login (sem sessão). Exige a
 * senha atual, então não precisa de autenticação prévia.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    login?: unknown;
    senhaAtual?: unknown;
    novaSenha?: unknown;
  };

  try {
    await alterarSenhaPropria(prismaSenhaRepository, {
      login: typeof body.login === "string" ? body.login : "",
      senhaAtual: typeof body.senhaAtual === "string" ? body.senhaAtual : "",
      novaSenha: typeof body.novaSenha === "string" ? body.novaSenha : ""
    });
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao alterar senha";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
