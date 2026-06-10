import type { EventoLog, OrdemServico, Prisma, Tabulacao } from "@prisma/client";
import { calcularConceito, type RespostasFfr } from "@/lib/ffr";
import type { SessionUserScope } from "@/lib/scope";
import { isOrdemInUserScope } from "@/server/os-service";

export type SaveTabulacaoInput = {
  ordemServicoId: string;
  respostas: RespostasFfr;
  observacoes?: string;
  /** Obrigatório quando monitor/supervisor altera uma tabulação já existente. */
  motivoAlteracao?: string;
};

export type UpsertTabulacaoInput = {
  ordemServicoId: string;
  fiscalId: string;
  tabuladoPorId: string;
  respostas: Prisma.InputJsonValue;
  somaObtida: number;
  somaPossivel: number;
  percentual: number;
  conceito: Tabulacao["conceito"];
  observacoes?: string | null;
  /** Presente apenas quando a gravação é uma alteração de uma tabulação existente. */
  alteracao?: { alteradoPorId: string; motivoAlteracao: string; alteradaEm: Date } | null;
};

export type UsuarioBasico = { name: string; matricula: string };

export type TabulacaoLogInput = {
  evento: EventoLog;
  descricao: string;
  metadata?: Prisma.InputJsonValue;
  userId?: string;
  ordemServicoId?: string;
};

export type TabulacaoRepository = {
  findOrdemById(id: string): Promise<OrdemServico | null>;
  findTabulacaoByOrdem(ordemServicoId: string): Promise<Tabulacao | null>;
  findFiscalNome(fiscalId: string): Promise<string | null>;
  findUsuarioBasico(id: string): Promise<UsuarioBasico | null>;
  upsertTabulacao(input: UpsertTabulacaoInput): Promise<Tabulacao>;
  log(input: TabulacaoLogInput): Promise<void>;
};

export async function getTabulacaoEdicao(
  repository: TabulacaoRepository,
  user: SessionUserScope,
  ordemServicoId: string
) {
  const ordem = await repository.findOrdemById(ordemServicoId);
  if (!ordem) throw new Error("OS nao encontrada");
  if (!isOrdemInUserScope(ordem, user)) throw new Error("OS fora do escopo do usuario");

  const tabulacao = await repository.findTabulacaoByOrdem(ordemServicoId);
  const fiscalNome = ordem.fiscalId ? await repository.findFiscalNome(ordem.fiscalId) : null;
  const tabuladoPor = tabulacao?.tabuladoPorId
    ? await repository.findUsuarioBasico(tabulacao.tabuladoPorId)
    : null;
  const alteradoPor = tabulacao?.alteradoPorId
    ? await repository.findUsuarioBasico(tabulacao.alteradoPorId)
    : null;
  return { ordem, tabulacao, fiscalNome, tabuladoPor, alteradoPor };
}

export async function saveTabulacao(
  repository: TabulacaoRepository,
  user: SessionUserScope,
  input: SaveTabulacaoInput,
  now = new Date()
) {
  const ordem = await repository.findOrdemById(input.ordemServicoId);
  if (!ordem) throw new Error("OS nao encontrada");
  if (!isOrdemInUserScope(ordem, user)) throw new Error("OS fora do escopo do usuario");
  if (ordem.status === "Concluida") throw new Error("Tabulacao bloqueada para OS concluida");

  const existente = await repository.findTabulacaoByOrdem(input.ordemServicoId);

  // Uma "alteração" é editar uma tabulação criada por outra pessoa. Só monitor e
  // supervisor podem alterar, e toda alteração exige um motivo registrado.
  const ehAlteracao = Boolean(existente && existente.tabuladoPorId && existente.tabuladoPorId !== user.id);
  if (ehAlteracao) {
    if (user.perfil === "fiscal") {
      throw new Error("Apenas monitor ou supervisor podem alterar uma tabulacao existente");
    }
    if (!input.motivoAlteracao || input.motivoAlteracao.trim().length === 0) {
      throw new Error("Informe o motivo da alteracao");
    }
  }

  const resultado = calcularConceito(
    { tipoServico: ordem.tipoServico, descricaoTss: ordem.descricaoTss },
    input.respostas
  );
  const tabulacao = await repository.upsertTabulacao({
    ordemServicoId: ordem.id,
    // Qualidade por fiscal agrupa pela OS, então a tabulação aponta para o fiscal
    // responsável; sem fiscal atribuído, cai para quem tabulou.
    fiscalId: ordem.fiscalId ?? user.id,
    // Preserva quem tabulou originalmente; numa criação, é quem está gravando.
    tabuladoPorId: existente?.tabuladoPorId ?? user.id,
    respostas: input.respostas as Prisma.InputJsonObject,
    somaObtida: resultado.somaObtida,
    somaPossivel: resultado.somaPossivel,
    percentual: resultado.percentual,
    conceito: resultado.conceito,
    observacoes: input.observacoes ?? null,
    alteracao: ehAlteracao
      ? { alteradoPorId: user.id, motivoAlteracao: input.motivoAlteracao!.trim(), alteradaEm: now }
      : null
  });

  await repository.log({
    evento: "tabulacao",
    descricao: ehAlteracao
      ? `Tabulacao alterada para OS ${ordem.numero}`
      : `Tabulacao salva para OS ${ordem.numero}`,
    userId: user.id,
    ordemServicoId: ordem.id,
    metadata: {
      conceito: resultado.conceito,
      somaObtida: resultado.somaObtida,
      somaPossivel: resultado.somaPossivel,
      percentual: resultado.percentual,
      alteracao: ehAlteracao ? input.motivoAlteracao!.trim() : undefined
    }
  });

  return tabulacao;
}
