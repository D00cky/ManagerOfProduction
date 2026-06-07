import { hasPermission } from "@/lib/permissions";
import type { SessionUserScope } from "@/lib/scope";

export type ConfiguracaoResumo = {
  caminhoRede: string | null;
  intervaloMin: number;
  formato: string;
  autoBackup: boolean;
  updatedById: string | null;
};

export type ConfiguracaoInput = Partial<{
  caminhoRede: string | null;
  intervaloMin: number;
  formato: string;
  autoBackup: boolean;
}>;

export type ConfiguracaoUpsert = ConfiguracaoInput & { updatedById: string };

export type ConfiguracaoRepository = {
  get(): Promise<ConfiguracaoResumo | null>;
  upsert(data: ConfiguracaoUpsert): Promise<ConfiguracaoResumo>;
};

const formatos = ["excel", "pdf", "ambos"];

const defaults: ConfiguracaoResumo = {
  caminhoRede: null,
  intervaloMin: 60,
  formato: "ambos",
  autoBackup: true,
  updatedById: null
};

function ensureCanManage(user: SessionUserScope) {
  if (!hasPermission(user.perfil, "configuracoes:write")) {
    throw new Error("Sem permissao para gerenciar configuracoes");
  }
}

export async function getConfiguracao(repository: ConfiguracaoRepository, user: SessionUserScope) {
  ensureCanManage(user);
  const config = await repository.get();
  return config ?? defaults;
}

export async function atualizarConfiguracao(
  repository: ConfiguracaoRepository,
  user: SessionUserScope,
  input: ConfiguracaoInput
) {
  ensureCanManage(user);

  if (input.intervaloMin !== undefined && (!Number.isInteger(input.intervaloMin) || input.intervaloMin < 1)) {
    throw new Error("Configuracao invalida");
  }
  if (input.formato !== undefined && !formatos.includes(input.formato)) {
    throw new Error("Configuracao invalida");
  }

  return repository.upsert({ ...input, updatedById: user.id });
}
