import { NextResponse } from "next/server";
import { listOrdens } from "@/server/os-service";
import { prismaOrdemRepository } from "@/server/prisma-os-repository";
import { getCurrentUser } from "@/server/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const ordens = await listOrdens(prismaOrdemRepository, user);
  return NextResponse.json({ data: ordens });
}
