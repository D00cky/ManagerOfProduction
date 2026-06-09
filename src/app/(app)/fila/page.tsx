import { redirect } from "next/navigation";
import { FilaTable, type FilaRow, type FiscalOption } from "@/components/fila/fila-table";
import { defaultRedirect, hasPermission } from "@/lib/permissions";
import { listEquipe } from "@/server/equipe-service";
import { prismaEquipeRepository } from "@/server/prisma-equipe-repository";
import { listOrdens } from "@/server/os-service";
import { prismaOrdemRepository } from "@/server/prisma-os-repository";
import { listPolos } from "@/server/polo-service";
import { prismaPoloRepository } from "@/server/prisma-polo-repository";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function FilaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.perfil, "fila:read")) redirect(defaultRedirect(user.perfil));

  const canAssign = hasPermission(user.perfil, "os:write");

  const [ordens, equipe, polos] = await Promise.all([
    listOrdens(prismaOrdemRepository, user),
    canAssign ? listEquipe(prismaEquipeRepository, user) : Promise.resolve([]),
    listPolos(prismaPoloRepository, user)
  ]);

  const fiscais: FiscalOption[] = equipe
    .filter((membro) => membro.perfil === "fiscal")
    .map((membro) => ({ id: membro.id, name: membro.name }));
  const fiscalNome = new Map(fiscais.map((fiscal) => [fiscal.id, fiscal.name]));
  const poloNome = new Map(polos.map((polo) => [polo.id, polo.nome]));

  const rows: FilaRow[] = ordens.map((ordem) => ({
    id: ordem.id,
    numero: ordem.numero,
    endereco: ordem.bairro ? `${ordem.enderecoCompleto}, ${ordem.bairro}` : ordem.enderecoCompleto,
    tipoServico: ordem.tipoServico,
    status: ordem.status,
    poloId: ordem.poloId,
    poloNome: poloNome.get(ordem.poloId) ?? null,
    fiscalId: ordem.fiscalId,
    fiscalNome: ordem.fiscalId ? fiscalNome.get(ordem.fiscalId) ?? null : null,
    dataProgramada: ordem.dataProgramada ? ordem.dataProgramada.toLocaleDateString("pt-BR") : null
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Fila de OS</h1>
      <FilaTable ordens={rows} fiscais={fiscais} canAssign={canAssign} />
    </div>
  );
}
