import { NextResponse } from "next/server";
import { getDashboardResumo } from "@/server/dashboard-service";
import { prismaDashboardRepository } from "@/server/prisma-dashboard-repository";
import { getCurrentUser } from "@/server/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const resumo = await getDashboardResumo(prismaDashboardRepository, user);
  return NextResponse.json({ data: resumo });
}
