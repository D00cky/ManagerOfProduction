import type { EventoLog, OrdemServico, Prisma, StatusOS } from "@prisma/client";
import { canTransitionStatus } from "@/lib/permissions";
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

export type OrdemRepository = {
  findMany(where: Prisma.OrdemServicoWhereInput): Promise<OrdemServico[]>;
  findById(id: string): Promise<OrdemServico | null>;
  hasTabulacao(ordemServicoId: string): Promise<boolean>;
  updateStatus(id: string, data: OrdemStatusUpdate): Promise<OrdemServico>;
  log(input: LogInput): Promise<void>;
};

export async function listOrdens(repository: OrdemRepository, user: SessionUserScope) {
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

export function isOrdemInUserScope(ordem: OrdemServico, user: SessionUserScope) {
  if (user.perfil === "supervisor") return true;
  if (user.perfil === "fiscal") return ordem.fiscalId === user.id;
  const polos = allowedPoloIds(user) ?? [];
  return polos.includes(ordem.poloId);
}
