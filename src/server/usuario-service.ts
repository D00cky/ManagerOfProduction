import type { Perfil, Prisma, StatusUsuario } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import type { SessionUserScope } from "@/lib/scope";

export type UsuarioResumo = {
  id: string;
  name: string;
  email: string;
  matricula: string;
  perfil: Perfil;
  status: StatusUsuario;
  poloId: string | null;
};

export type CriarUsuarioInput = {
  name: string;
  email: string;
  matricula: string;
  password: string;
  perfil: Perfil;
  poloId?: string | null;
};

export type AtualizarUsuarioInput = Partial<{
  name: string;
  perfil: Perfil;
  poloId: string | null;
  status: StatusUsuario;
}>;

export type UsuarioLogInput = {
  evento: "usuario";
  descricao: string;
  userId?: string;
  metadata?: Prisma.InputJsonValue;
};

export type UsuarioRepository = {
  list(): Promise<UsuarioResumo[]>;
  findByLogin(email: string, matricula: string): Promise<UsuarioResumo | null>;
  findById(id: string): Promise<UsuarioResumo | null>;
  create(input: CriarUsuarioInput): Promise<UsuarioResumo>;
  update(id: string, data: AtualizarUsuarioInput): Promise<UsuarioResumo>;
  log(input: UsuarioLogInput): Promise<void>;
};

const perfis: Perfil[] = ["fiscal", "monitor", "supervisor"];

function ensureCanManage(user: SessionUserScope) {
  if (!hasPermission(user.perfil, "usuarios:write")) {
    throw new Error("Sem permissao para gerenciar usuarios");
  }
}

export async function listUsuarios(repository: UsuarioRepository, user: SessionUserScope) {
  ensureCanManage(user);
  return repository.list();
}

export async function criarUsuario(
  repository: UsuarioRepository,
  user: SessionUserScope,
  input: CriarUsuarioInput
) {
  ensureCanManage(user);

  const name = input.name?.trim() ?? "";
  const email = input.email?.trim().toLowerCase() ?? "";
  const matricula = input.matricula?.trim() ?? "";
  const password = input.password ?? "";
  if (!name || !email || !matricula || password.length < 6 || !perfis.includes(input.perfil)) {
    throw new Error("Dados de usuario invalidos");
  }

  const existing = await repository.findByLogin(email, matricula);
  if (existing) throw new Error("E-mail ou matricula ja cadastrado");

  const created = await repository.create({
    name,
    email,
    matricula,
    password,
    perfil: input.perfil,
    poloId: input.poloId ?? null
  });
  await repository.log({
    evento: "usuario",
    descricao: `Usuario ${email} criado`,
    userId: user.id,
    metadata: { id: created.id, perfil: created.perfil }
  });
  return created;
}

export async function atualizarUsuario(
  repository: UsuarioRepository,
  user: SessionUserScope,
  id: string,
  data: AtualizarUsuarioInput
) {
  ensureCanManage(user);

  const target = await repository.findById(id);
  if (!target) throw new Error("Usuario nao encontrado");

  const updated = await repository.update(id, data);
  await repository.log({
    evento: "usuario",
    descricao: `Usuario ${target.email} atualizado`,
    userId: user.id,
    metadata: { id, changes: data as Prisma.InputJsonValue }
  });
  return updated;
}
