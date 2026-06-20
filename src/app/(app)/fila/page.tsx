import { redirect } from "next/navigation";
import { FilaTable, type FilaRow, type FiscalOption } from "@/components/fila/fila-table";
import { parseFilaFilters, type FilaFiltros } from "@/lib/fila-filtros";
import { defaultRedirect, hasPermission } from "@/lib/permissions";
import { getOpcoesGeograficas } from "@/server/dashboard-service";
import { prismaDashboardRepository } from "@/server/prisma-dashboard-repository";
import { listEquipe } from "@/server/equipe-service";
import { prismaEquipeRepository } from "@/server/prisma-equipe-repository";
import { listOrdens } from "@/server/os-service";
import { prismaOrdemRepository } from "@/server/prisma-os-repository";
import { listPolos } from "@/server/polo-service";
import { prismaPoloRepository } from "@/server/prisma-polo-repository";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ? raw.trim() : "";
}

type FilaSearchParams = {
  regiao?: string | string[];
  poloId?: string | string[];
  municipio?: string | string[];
  fiscalId?: string | string[];
  tipoServico?: string | string[];
  status?: string | string[];
  busca?: string | string[];
  fimDe?: string | string[];
  fimAte?: string | string[];
  page?: string | string[];
};

export default async function FilaPage({
  searchParams
}: {
  searchParams: Promise<FilaSearchParams>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.perfil, "fila:read")) redirect(defaultRedirect(user.perfil));

  const canAssign = hasPermission(user.perfil, "os:write");
  const canDelete = hasPermission(user.perfil, "os:delete");
  const params = await searchParams;

  const filtros: FilaFiltros = {
    regiao: firstParam(params.regiao),
    poloId: firstParam(params.poloId),
    municipio: firstParam(params.municipio),
    fiscalId: firstParam(params.fiscalId),
    tipoServico: firstParam(params.tipoServico),
    status: firstParam(params.status),
    busca: firstParam(params.busca),
    fimDe: firstParam(params.fimDe),
    fimAte: firstParam(params.fimAte)
  };
  const page = Math.max(1, Number(firstParam(params.page)) || 1);

  const [pagina, equipe, polos, opcoesGeo] = await Promise.all([
    listOrdens(prismaOrdemRepository, user, { filters: parseFilaFilters(filtros), page }),
    canAssign ? listEquipe(prismaEquipeRepository, user) : Promise.resolve([]),
    listPolos(prismaPoloRepository, user),
    getOpcoesGeograficas(prismaDashboardRepository, user)
  ]);

  // Responsáveis atribuíveis: fiscais e monitores (um monitor pode atribuir OS a
  // si mesmo ou a outros monitores). Supervisores não recebem OS.
  const fiscais: FiscalOption[] = equipe
    .filter((membro) => membro.perfil === "fiscal" || membro.perfil === "monitor")
    .map((membro) => ({ id: membro.id, name: membro.name }));
  const fiscalNome = new Map(fiscais.map((fiscal) => [fiscal.id, fiscal.name]));
  const poloNome = new Map(polos.map((polo) => [polo.id, polo.nome]));

  const rows: FilaRow[] = pagina.rows.map((ordem) => ({
    id: ordem.id,
    numero: ordem.numero,
    endereco: ordem.bairro ? `${ordem.enderecoCompleto}, ${ordem.bairro}` : ordem.enderecoCompleto,
    tipoServico: ordem.tipoServico,
    status: ordem.status,
    poloId: ordem.poloId,
    poloNome: poloNome.get(ordem.poloId) ?? null,
    fiscalId: ordem.fiscalId,
    fiscalNome: ordem.fiscalId ? fiscalNome.get(ordem.fiscalId) ?? null : null,
    dataFimExecucao: ordem.dataFimExecucao ? ordem.dataFimExecucao.toLocaleDateString("pt-BR") : null
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Fila de OS</h1>
      <FilaTable
        ordens={rows}
        fiscais={fiscais}
        opcoesGeo={opcoesGeo}
        canAssign={canAssign}
        canDelete={canDelete}
        filtros={filtros}
        total={pagina.total}
        page={pagina.page}
        pageSize={pagina.pageSize}
      />
    </div>
  );
}
