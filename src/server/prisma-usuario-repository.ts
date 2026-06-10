import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createLogAtividade } from "@/server/log";
import type {
  AtualizarUsuarioInput,
  CriarUsuarioInput,
  UsuarioLogInput,
  UsuarioRepository
} from "@/server/usuario-service";

const resumoSelect = {
  id: true,
  name: true,
  email: true,
  matricula: true,
  perfil: true,
  status: true,
  poloId: true,
  regiao: true
} satisfies Prisma.UserSelect;

export const prismaUsuarioRepository: UsuarioRepository = {
  list() {
    return prisma.user.findMany({ orderBy: { name: "asc" }, select: resumoSelect });
  },
  findByLogin(email: string, matricula: string) {
    return prisma.user.findFirst({
      where: { OR: [{ email }, { matricula }] },
      select: resumoSelect
    });
  },
  findById(id: string) {
    return prisma.user.findUnique({ where: { id }, select: resumoSelect });
  },
  create(input: CriarUsuarioInput) {
    return prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        matricula: input.matricula,
        passwordHash: bcrypt.hashSync(input.password, 10),
        perfil: input.perfil,
        poloId: input.poloId ?? null,
        regiao: input.regiao ?? null
      },
      select: resumoSelect
    });
  },
  update(id: string, data: AtualizarUsuarioInput) {
    return prisma.user.update({ where: { id }, data, select: resumoSelect });
  },
  async remove(id: string) {
    try {
      await prisma.user.delete({ where: { id } });
    } catch (error) {
      // Usuário referenciado por OS/tabulações/logs não pode ser apagado fisicamente.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new Error(
          "Usuario possui registros vinculados (OS, tabulacoes ou logs); desative-o em vez de excluir."
        );
      }
      throw error;
    }
  },
  async log(input: UsuarioLogInput) {
    await createLogAtividade(input);
  }
};
