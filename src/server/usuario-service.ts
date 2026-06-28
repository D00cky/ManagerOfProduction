import type { Perfil, Prisma, StatusUsuario } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { allowedPoloIds, type SessionUserScope } from "@/lib/scope";

export type UsuarioResumo = {
  id: string;
  name: string;
  email: string;
  matricula: string;
  perfil: Perfil;
  status: StatusUsuario;
  poloId: string | null;
  regiao: string | null;
  /** Polos atribuídos ao monitor (UserPoloAccess); vazio para outros perfis. */
  polosPermitidos: string[];
};

export type CriarUsuarioInput = {
  name: string;
  email: string;
  matricula: string;
  password: string;
  perfil: Perfil;
  poloId?: string | null;
  regiao?: string | null;
  polosPermitidos?: string[];
};

export type AtualizarUsuarioInput = Partial<{
  name: string;
  email: string;
  matricula: string;
  perfil: Perfil;
  poloId: string | null;
  regiao: string | null;
  status: StatusUsuario;
  polosPermitidos: string[];
  /** Nova senha (reset pelo supervisor); o repositório aplica o hash. */
  password: string;
}>;

/** Normaliza uma lista de polos: remove vazios e duplicados, preservando a ordem. */
function normalizarPolos(polos: string[] | undefined): string[] {
  return [...new Set((polos ?? []).filter(Boolean))];
}

export type UsuarioLogInput = {
  evento: "usuario";
  descricao: string;
  userId?: string;
  metadata?: Prisma.InputJsonValue;
};

export type UsuarioRepository = {
  /** `poloIds` undefined = sem restrição (supervisor); lista filtra por esses polos. */
  list(poloIds?: string[]): Promise<UsuarioResumo[]>;
  findByLogin(email: string, matricula: string): Promise<UsuarioResumo | null>;
  findById(id: string): Promise<UsuarioResumo | null>;
  create(input: CriarUsuarioInput): Promise<UsuarioResumo>;
  update(id: string, data: AtualizarUsuarioInput): Promise<UsuarioResumo>;
  remove(id: string): Promise<void>;
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
  // Defense-in-depth: scope by the requester's polos. Supervisor → undefined → all.
  return repository.list(allowedPoloIds(user));
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
    poloId: input.poloId ?? null,
    // Supervisores enxergam tudo, então nunca têm região. Monitores e fiscais
    // carregam região: é por ela que o monitor enxerga os fiscais da sua região.
    regiao: input.perfil === "supervisor" ? null : input.regiao?.trim() || null,
    // Apenas monitores carregam polos atribuídos; supervisor enxerga tudo.
    polosPermitidos: input.perfil === "supervisor" ? [] : normalizarPolos(input.polosPermitidos)
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

  const sanitized: AtualizarUsuarioInput = { ...data };
  if (sanitized.name !== undefined) sanitized.name = sanitized.name.trim();
  if (sanitized.email !== undefined) sanitized.email = sanitized.email.trim().toLowerCase();
  if (sanitized.matricula !== undefined) sanitized.matricula = sanitized.matricula.trim();
  if (sanitized.regiao !== undefined) sanitized.regiao = sanitized.regiao?.trim() || null;
  if (sanitized.polosPermitidos !== undefined) {
    sanitized.polosPermitidos = normalizarPolos(sanitized.polosPermitidos);
  }
  // Servidor é a autoridade: um supervisor nunca mantém região nem polos, mesmo
  // que o perfil seja alterado para supervisor nesta mesma edição.
  const perfilEfetivo = sanitized.perfil ?? target.perfil;
  if (perfilEfetivo === "supervisor") {
    sanitized.regiao = null;
    if (sanitized.polosPermitidos !== undefined) sanitized.polosPermitidos = [];
  }

  if (sanitized.name !== undefined && !sanitized.name) throw new Error("Nome obrigatorio");
  if (sanitized.email !== undefined && !sanitized.email) throw new Error("E-mail obrigatorio");
  if (sanitized.matricula !== undefined && !sanitized.matricula) throw new Error("Matricula obrigatoria");
  if (sanitized.perfil !== undefined && !perfis.includes(sanitized.perfil)) {
    throw new Error("Perfil invalido");
  }
  if (sanitized.password !== undefined && sanitized.password.length < 6) {
    throw new Error("Senha deve ter ao menos 6 caracteres");
  }

  // Unicidade ao alterar identificadores: e-mail/matrícula não podem colidir com
  // outro usuário (o próprio registro é ignorado).
  if (sanitized.email || sanitized.matricula) {
    const existing = await repository.findByLogin(sanitized.email ?? "", sanitized.matricula ?? "");
    if (existing && existing.id !== id) throw new Error("E-mail ou matricula ja cadastrado");
  }

  const updated = await repository.update(id, sanitized);
  // Nunca registrar a senha em texto no log de atividade.
  const { password, ...changesSemSenha } = data;
  await repository.log({
    evento: "usuario",
    descricao: `Usuario ${target.email} atualizado`,
    userId: user.id,
    metadata: {
      id,
      changes: changesSemSenha as Prisma.InputJsonValue,
      senhaAlterada: password !== undefined
    }
  });
  return updated;
}

export async function excluirUsuario(
  repository: UsuarioRepository,
  user: SessionUserScope,
  id: string
) {
  ensureCanManage(user);
  if (id === user.id) throw new Error("Nao e possivel excluir o proprio usuario");

  const target = await repository.findById(id);
  if (!target) throw new Error("Usuario nao encontrado");

  await repository.remove(id);
  await repository.log({
    evento: "usuario",
    descricao: `Usuario ${target.email} excluido`,
    userId: user.id,
    metadata: { id, perfil: target.perfil }
  });
}
