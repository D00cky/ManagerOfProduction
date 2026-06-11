import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { SenhaRepository } from "@/server/senha-service";

export const prismaSenhaRepository: SenhaRepository = {
  findCredencialPorLogin(login: string) {
    return prisma.user.findFirst({
      where: {
        status: "ativo",
        OR: [{ email: login.toLowerCase() }, { matricula: login }]
      },
      select: { id: true, passwordHash: true }
    });
  },
  async atualizarSenha(id: string, novaSenha: string) {
    await prisma.user.update({
      where: { id },
      data: { passwordHash: bcrypt.hashSync(novaSenha, 10) }
    });
  }
};
