import { Prisma, type EventoLog } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type LogAtividadeInput = {
  evento: EventoLog;
  descricao: string;
  metadata?: Prisma.InputJsonValue;
  userId?: string | null;
  ordemServicoId?: string | null;
};

/**
 * Writes an activity log, tolerating a stale `userId`.
 *
 * Sessions are JWT-based, so a user id can survive in the token after the
 * underlying row is removed.
 * Inserting that id would violate the LogAtividade → User foreign key and abort
 * the surrounding action, so we drop the user reference instead of failing.
 */
export async function createLogAtividade(input: LogAtividadeInput) {
  const userId =
    input.userId &&
    (await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } }))
      ? input.userId
      : null;

  await prisma.logAtividade.create({
    data: {
      evento: input.evento,
      descricao: input.descricao,
      metadata: input.metadata ?? Prisma.JsonNull,
      userId,
      ...(input.ordemServicoId !== undefined ? { ordemServicoId: input.ordemServicoId } : {})
    }
  });
}
