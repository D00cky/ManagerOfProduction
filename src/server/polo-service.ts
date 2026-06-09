import { REGIOES_SP } from "@/data/regioes-sp";
import { hasPermission } from "@/lib/permissions";
import type { SessionUserScope } from "@/lib/scope";

export type PoloResumo = {
  id: string;
  nome: string;
  codigo: string;
  regiao: string | null;
  ativo: boolean;
};

export type CriarPoloInput = {
  nome: string;
  codigo: string;
  regiao?: string | null;
};

export type AtualizarPoloInput = Partial<{
  nome: string;
  codigo: string;
  regiao: string | null;
  ativo: boolean;
}>;

export type PoloRepository = {
  list(): Promise<PoloResumo[]>;
  findByCodigo(codigo: string): Promise<PoloResumo | null>;
  findById(id: string): Promise<PoloResumo | null>;
  create(input: CriarPoloInput): Promise<PoloResumo>;
  update(id: string, data: AtualizarPoloInput): Promise<PoloResumo>;
};

function ensureCanManage(user: SessionUserScope) {
  if (!hasPermission(user.perfil, "configuracoes:write")) {
    throw new Error("Sem permissao para gerenciar polos");
  }
}

function normalizeCodigo(codigo: string) {
  return codigo.trim().toUpperCase();
}

/** A polo's região is the source of truth for the hierarchy; empty means unset. */
function normalizeRegiao(regiao: string | null | undefined): string | null {
  if (regiao === null || regiao === undefined) return null;
  const trimmed = regiao.trim();
  if (!trimmed) return null;
  if (!(REGIOES_SP as readonly string[]).includes(trimmed)) {
    throw new Error("Regiao invalida");
  }
  return trimmed;
}

export async function listPolos(repository: PoloRepository, _user: SessionUserScope) {
  return repository.list();
}

export async function criarPolo(
  repository: PoloRepository,
  user: SessionUserScope,
  input: CriarPoloInput
) {
  ensureCanManage(user);

  const nome = input.nome?.trim() ?? "";
  const codigo = input.codigo ? normalizeCodigo(input.codigo) : "";
  if (!nome || !codigo) throw new Error("Dados de polo invalidos");

  const existing = await repository.findByCodigo(codigo);
  if (existing) throw new Error("Codigo de polo ja cadastrado");

  return repository.create({ nome, codigo, regiao: normalizeRegiao(input.regiao) });
}

export async function atualizarPolo(
  repository: PoloRepository,
  user: SessionUserScope,
  id: string,
  input: AtualizarPoloInput
) {
  ensureCanManage(user);

  const target = await repository.findById(id);
  if (!target) throw new Error("Polo nao encontrado");

  const data: AtualizarPoloInput = {};
  if (input.nome !== undefined) data.nome = input.nome.trim();
  if (input.codigo !== undefined) data.codigo = normalizeCodigo(input.codigo);
  if (input.regiao !== undefined) data.regiao = normalizeRegiao(input.regiao);
  if (input.ativo !== undefined) data.ativo = input.ativo;

  return repository.update(id, data);
}
