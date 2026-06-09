import type { EventoLog, OrdemServico, Perfil, Prisma, StatusOS } from "@prisma/client";
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

export type OrdemRepository = {
  findMany(where: Prisma.OrdemServicoWhereInput): Promise<OrdemServico[]>;
  claimNextAvailable(poloId: string, fiscalId: string): Promise<ClaimedOrdem | null>;
  findById(id: string): Promise<OrdemServico | null>;
  hasTabulacao(ordemServicoId: string): Promise<boolean>;
  updateStatus(id: string, data: OrdemStatusUpdate): Promise<OrdemServico>;
  findFiscalById(id: string): Promise<FiscalRef | null>;
  hasOpenWork(fiscalId: string, excludeOrdemId?: string): Promise<boolean>;
  updateFiscal(id: string, fiscalId: string): Promise<OrdemServico>;
  log(input: LogInput): Promise<void>;
};

export async function listOrdens(repository: OrdemRepository, user: SessionUserScope) {
  if (user.perfil === "fiscal" && user.poloId) {
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
  return repository.findMany(buildOsScope(user));
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
  if (await repository.hasOpenWork(fiscalId, ordemServicoId)) {
    throw new Error("Fiscal ja possui OS aberta");
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

export function isOrdemInUserScope(ordem: OrdemServico, user: SessionUserScope) {
  if (user.perfil === "supervisor") return true;
  if (user.perfil === "fiscal") return ordem.fiscalId === user.id;
  const polos = allowedPoloIds(user) ?? [];
  return polos.includes(ordem.poloId);
}
