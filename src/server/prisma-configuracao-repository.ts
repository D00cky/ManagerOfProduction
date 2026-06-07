import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ConfiguracaoRepository, ConfiguracaoUpsert } from "@/server/configuracao-service";

const configSelect = {
  caminhoRede: true,
  intervaloMin: true,
  formato: true,
  autoBackup: true,
  updatedById: true
} satisfies Prisma.ConfigSyncSelect;

export const prismaConfiguracaoRepository: ConfiguracaoRepository = {
  get() {
    return prisma.configSync.findFirst({ select: configSelect });
  },
  async upsert(data: ConfiguracaoUpsert) {
    const existing = await prisma.configSync.findFirst({ select: { id: true } });
    if (existing) {
      return prisma.configSync.update({ where: { id: existing.id }, data, select: configSelect });
    }
    return prisma.configSync.create({ data, select: configSelect });
  }
};
