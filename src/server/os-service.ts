import type { EventoLog, OrdemServico, Perfil, Prisma, StatusOS, TipoServico } from "@prisma/client";
import { canTransitionStatus, hasPermission } from "@/lib/permissions";
import { allowedPoloIds, buildOsScope, type SessionUserScope } from "@/lib/scope";

export type OrdemStatusUpdate = Partial<
  Pick<OrdemServico, "status" | "iniciadaEm" | "concluidaEm" | "canceladaEm">
>;

export type LogInput = {
  evento: EventoLog;
  descricao: string;
  metadata?: Prisma.InputJsonValue;
  userId?: string;
  ordemServicoId?: string;
};

export type FiscalRef = {
  id: string;
  perfil: Perfil;
  poloId: string | null;
};

export type ClaimedOrdem = Pick<OrdemServico, "id" | "numero" | "poloId" | "fiscalId">;

/** `null` fiscalId means "sem fiscal" (unassigned); omit to not filter by fiscal. */
export type OsListFilters = {
  poloId?: string;
  fiscalId?: string | null;
  tipoServico?: TipoServico;
  status?: StatusOS;
  busca?: string;
};

export type OsListParams = {
  filters?: OsListFilters;
  page?: number;
  pageSize?: number;
};

export type OsListPage = {
  rows: OrdemServico[];
  total: number;
  page: number;
  pageSize: number;
};

export const OS_LIST_PAGE_SIZE = 20;

export type OrdemRepository = {
  findPage(
    where: Prisma.OrdemServicoWhereInput,
    pagination: { skip: number; take: number }
  ): Promise<{ rows: OrdemServico[]; total: number }>;
  claimNextAvailable(poloId: string, fiscalId: string): Promise<ClaimedOrdem | null>;
  findById(id: string): Promise<OrdemServico | null>;
  hasTabulacao(ordemServicoId: string): Promise<boolean>;
  updateStatus(id: string, data: OrdemStatusUpdate): Promise<OrdemServico>;
  findFiscalById(id: string): Promise<FiscalRef | null>;
  updateFiscal(id: string, fiscalId: string): Promise<OrdemServico>;
  /** Assign every in-scope OS among `ids` to the fiscal; returns the count touched. */
  assignManyToFiscal(
    ids: string[],
    fiscalId: string,
    scope: Prisma.OrdemServicoWhereInput
  ): Promise<number>;
  /** Hard-delete the OS matching `where` (and their tabulações/avaliações); returns the count. */
  deleteOrdens(where: Prisma.OrdemServicoWhereInput): Promise<number>;
  log(input: LogInput): Promise<void>;
};

/** Pure: merge the role access scope with the queue filters (AND semantics). */
export function buildListWhere(
  scope: Prisma.OrdemServicoWhereInput,
  filters: OsListFilters
): Prisma.OrdemServicoWhereInput {
  const where: Prisma.OrdemServicoWhereInput = { ...scope };
  if (filters.poloId) where.poloId = filters.poloId;
  if (filters.tipoServico) where.tipoServico = filters.tipoServico;
  if (filters.status) where.status = filters.status;
  if (filters.fiscalId === null) where.fiscalId = null;
  else if (filters.fiscalId) where.fiscalId = filters.fiscalId;
  if (filters.busca) {
    where.OR = [
      { numero: { contains: filters.busca, mode: "insensitive" } },
      { enderecoCompleto: { contains: filters.busca, mode: "insensitive" } }
    ];
  }
  return where;
}

export async function listOrdens(
  repository: OrdemRepository,
  user: SessionUserScope,
  params: OsListParams = {}
): Promise<OsListPage> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? OS_LIST_PAGE_SIZE;

  // Auto-claim only on the first page so paginating doesn't keep claiming work.
  if (user.perfil === "fiscal" && user.poloId && page === 1) {
    const claimed = await repository.claimNextAvailable(user.poloId, user.id);
    if (claimed) {
      await repository.log({
        evento: "atribuicao",
        descricao: `OS ${claimed.numero} atribuida automaticamente ao fiscal ${user.id}`,
        userId: user.id,
        ordemServicoId: claimed.id,
        metadata: {
          fiscalId: user.id,
          poloId: user.poloId,
          ordemServicoId: claimed.id
        }
      });
    }
  }

  const where = buildListWhere(buildOsScope(user), params.filters ?? {});
  const { rows, total } = await repository.findPage(where, {
    skip: (page - 1) * pageSize,
    take: pageSize
  });
  return { rows, total, page, pageSize };
}

export async function updateOrdemStatus(
  repository: OrdemRepository,
  user: SessionUserScope,
  ordemServicoId: string,
  status: StatusOS,
  now = new Date()
) {
  const ordem = await repository.findById(ordemServicoId);
  if (!ordem) throw new Error("OS nao encontrada");
  if (!isOrdemInUserScope(ordem, user)) throw new Error("OS fora do escopo do usuario");

  const hasTabulacao = await repository.hasTabulacao(ordemServicoId);
  if (status === "Concluida" && !hasTabulacao) {
    throw new Error("Finalizacao exige tabulacao salva");
  }
  if (!canTransitionStatus(ordem.status, status, hasTabulacao)) {
    throw new Error(`Transicao invalida de ${ordem.status} para ${status}`);
  }

  const data: OrdemStatusUpdate = { status };
  if (status === "EmExecucao" && !ordem.iniciadaEm) data.iniciadaEm = now;
  if (status === "Concluida") data.concluidaEm = now;
  if (status === "Cancelada") data.canceladaEm = now;

  const updated = await repository.updateStatus(ordemServicoId, data);
  await repository.log({
    evento: "status",
    descricao: `OS ${ordem.numero} alterada para ${status}`,
    userId: user.id,
    ordemServicoId,
    metadata: { from: ordem.status, to: status }
  });
  return updated;
}

export async function atribuirOrdem(
  repository: OrdemRepository,
  user: SessionUserScope,
  ordemServicoId: string,
  fiscalId: string
) {
  if (!hasPermission(user.perfil, "os:write")) {
    throw new Error("Sem permissao para atribuir OS");
  }

  const ordem = await repository.findById(ordemServicoId);
  if (!ordem) throw new Error("OS nao encontrada");
  if (!isOrdemInUserScope(ordem, user)) throw new Error("OS fora do escopo do usuario");

  const fiscal = await repository.findFiscalById(fiscalId);
  if (!fiscal || fiscal.perfil !== "fiscal") throw new Error("Fiscal invalido");

  const polos = allowedPoloIds(user);
  if (polos && (!fiscal.poloId || !polos.includes(fiscal.poloId))) {
    throw new Error("Fiscal fora do escopo do usuario");
  }

  const evento: EventoLog = ordem.fiscalId ? "reatribuicao" : "atribuicao";
  const updated = await repository.updateFiscal(ordemServicoId, fiscalId);
  await repository.log({
    evento,
    descricao: `OS ${ordem.numero} atribuida ao fiscal ${fiscalId}`,
    userId: user.id,
    ordemServicoId,
    metadata: { from: ordem.fiscalId, to: fiscalId }
  });
  return updated;
}

export async function atribuirOrdensLote(
  repository: OrdemRepository,
  user: SessionUserScope,
  ordemIds: string[],
  fiscalId: string
): Promise<{ atribuidas: number }> {
  if (!hasPermission(user.perfil, "os:write")) {
    throw new Error("Sem permissao para atribuir OS");
  }
  if (ordemIds.length === 0) return { atribuidas: 0 };

  const fiscal = await repository.findFiscalById(fiscalId);
  if (!fiscal || fiscal.perfil !== "fiscal") throw new Error("Fiscal invalido");

  const polos = allowedPoloIds(user);
  if (polos && (!fiscal.poloId || !polos.includes(fiscal.poloId))) {
    throw new Error("Fiscal fora do escopo do usuario");
  }

  // Only OS within the caller's scope are affected; a fiscal may hold a backlog
  // of many assigned OS, so no one-open-per-fiscal check applies.
  const atribuidas = await repository.assignManyToFiscal(ordemIds, fiscalId, buildOsScope(user));
  await repository.log({
    evento: "atribuicao",
    descricao: `${atribuidas} OS atribuidas em lote ao fiscal ${fiscalId}`,
    userId: user.id,
    metadata: { fiscalId, total: atribuidas }
  });
  return { atribuidas };
}

export type ExcluirOrdensParams = { ids?: string[]; todas?: boolean; filters?: OsListFilters };

export async function excluirOrdens(
  repository: OrdemRepository,
  user: SessionUserScope,
  params: ExcluirOrdensParams
): Promise<{ excluidas: number }> {
  if (!hasPermission(user.perfil, "os:delete")) {
    throw new Error("Sem permissao para excluir OS");
  }

  // Always intersect with the caller's row scope (and any active filters) so a
  // user can never delete OS outside what they can see.
  const scope = buildListWhere(buildOsScope(user), params.filters ?? {});
  let where: Prisma.OrdemServicoWhereInput;
  if (params.todas) {
    where = scope;
  } else {
    if (!params.ids || params.ids.length === 0) return { excluidas: 0 };
    where = { AND: [scope, { id: { in: params.ids } }] };
  }

  const excluidas = await repository.deleteOrdens(where);
  await repository.log({
    evento: "exclusao",
    descricao: `${excluidas} OS excluidas definitivamente`,
    userId: user.id,
    metadata: { total: excluidas, todas: Boolean(params.todas) }
  });
  return { excluidas };
}

export function isOrdemInUserScope(ordem: OrdemServico, user: SessionUserScope) {
  if (user.perfil === "supervisor") return true;
  if (user.perfil === "fiscal") return ordem.fiscalId === user.id;
  const polos = allowedPoloIds(user) ?? [];
  return polos.includes(ordem.poloId);
}
