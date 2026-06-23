import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createLogAtividade } from "@/server/log";
import type {
  AtualizarUsuarioInput,
  CriarUsuarioInput,
  UsuarioLogInput,
  UsuarioRepository,
  UsuarioResumo
} from "@/server/usuario-service";

const resumoSelect = {
  id: true,
  name: true,
  email: true,
  matricula: true,
  perfil: true,
  status: true,
  poloId: true,
  regiao: true,
  acessosPolo: { select: { poloId: true } }
} satisfies Prisma.UserSelect;

type ResumoRow = Prisma.UserGetPayload<{ select: typeof resumoSelect }>;

/** Achata as linhas de UserPoloAccess em `polosPermitidos` no formato do serviço. */
function toResumo(row: ResumoRow): UsuarioResumo {
  const { acessosPolo, ...rest } = row;
  return { ...rest, polosPermitidos: acessosPolo.map((acesso) => acesso.poloId) };
}

export const prismaUsuarioRepository: UsuarioRepository = {
  async list(poloIds?: string[]) {
    // `poloIds` undefined → supervisor (sem filtro). Definido → restringe a
    // usuários cujo polo "home" OU acesso explícito esteja na lista.
    const where: Prisma.UserWhereInput =
      poloIds === undefined
        ? {}
        : {
            OR: [
              { poloId: { in: poloIds } },
              { acessosPolo: { some: { poloId: { in: poloIds } } } }
            ]
          };
    const rows = await prisma.user.findMany({ where, orderBy: { name: "asc" }, select: resumoSelect });
    return rows.map(toResumo);
  },
  async findByLogin(email: string, matricula: string) {
    const row = await prisma.user.findFirst({
      where: { OR: [{ email }, { matricula }] },
      select: resumoSelect
    });
    return row ? toResumo(row) : null;
  },
  async findById(id: string) {
    const row = await prisma.user.findUnique({ where: { id }, select: resumoSelect });
    return row ? toResumo(row) : null;
  },
  async create(input: CriarUsuarioInput) {
    const row = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        matricula: input.matricula,
        passwordHash: bcrypt.hashSync(input.password, 10),
        perfil: input.perfil,
        poloId: input.poloId ?? null,
        regiao: input.regiao ?? null,
        acessosPolo: { create: (input.polosPermitidos ?? []).map((poloId) => ({ poloId })) }
      },
      select: resumoSelect
    });
    return toResumo(row);
  },
  async update(id: string, data: AtualizarUsuarioInput) {
    const { password, polosPermitidos, ...rest } = data;
    const row = await prisma.user.update({
      where: { id },
      data: {
        ...rest,
        ...(password ? { passwordHash: bcrypt.hashSync(password, 10) } : {}),
        // Só sincroniza os polos quando o campo foi enviado (substitui o conjunto).
        ...(polosPermitidos !== undefined
          ? { acessosPolo: { deleteMany: {}, create: polosPermitidos.map((poloId) => ({ poloId })) } }
          : {})
      },
      select: resumoSelect
    });
    return toResumo(row);
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
