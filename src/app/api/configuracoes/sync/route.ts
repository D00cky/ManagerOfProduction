import { NextResponse } from "next/server";
import { executarBackupPadrao } from "@/server/backup-service";
import { getCurrentUser } from "@/server/session";

function errorStatus(message: string) {
  return message.startsWith("Sem permissao") ? 403 : 400;
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  try {
    const backup = await executarBackupPadrao(user, { mode: "manual" });
    return NextResponse.json({ data: backup }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao executar backup";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}
