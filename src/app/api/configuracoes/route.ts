import { NextResponse } from "next/server";
import {
  atualizarConfiguracao,
  getConfiguracao,
  type ConfiguracaoInput
} from "@/server/configuracao-service";
import { prismaConfiguracaoRepository } from "@/server/prisma-configuracao-repository";
import { getCurrentUser } from "@/server/session";

function errorStatus(message: string) {
  return message.startsWith("Sem permissao") ? 403 : 400;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  try {
    const configuracao = await getConfiguracao(prismaConfiguracaoRepository, user);
    return NextResponse.json({ data: configuracao });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao ler configuracoes";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Partial<ConfiguracaoInput>;
  const input: ConfiguracaoInput = {};
  if (body.caminhoRede !== undefined) input.caminhoRede = body.caminhoRede;
  if (body.intervaloMin !== undefined) input.intervaloMin = body.intervaloMin;
  if (body.formato !== undefined) input.formato = body.formato;
  if (body.autoBackup !== undefined) input.autoBackup = body.autoBackup;

  try {
    const configuracao = await atualizarConfiguracao(prismaConfiguracaoRepository, user, input);
    return NextResponse.json({ data: configuracao });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar configuracoes";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}
