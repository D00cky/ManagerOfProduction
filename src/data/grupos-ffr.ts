import type { TipoServico } from "@prisma/client";
import { normalizeHeader } from "@/lib/importacao";

export type ValorResposta = "1" | "0" | "X" | null | string;

export type FfrItem = {
  id: string;
  texto: string;
  peso: number;
  tipo?: "booleano" | "texto";
};

export type FfrGrupo = {
  id: string;
  nome: string;
  tipos: TipoServico[] | "todos";
  itens: FfrItem[];
};

// Formulario FFR v22_04_2026 (Roteiro + Formulario FFR). Itens marcados como
// "Informativo" no formulario sao campos de texto (peso 0, fora do calculo).
// Mapeamento de grupos por tipo de servico e best-effort: os grupos de agua
// casam com o enum; esgoto/desobstrucao/lavagem/reposicao ficam em "Outros".
export const gruposFfr: FfrGrupo[] = [
  {
    id: "gerais",
    nome: "Itens Gerais",
    tipos: "todos",
    itens: [
      { id: "gerais_q1", texto: "O REGISTRO FOTOGRÁFICO DO SERVIÇO FOI EXECUTADO?", peso: 3 },
      { id: "gerais_q2", texto: "A QUALIDADE DAS FOTOS ESTÁ FAVORECENDO A FISCALIZAÇÃO (NÍTIDAS/BEM ENQUADRADAS)?", peso: 2 },
      { id: "gerais_q3", texto: "AS COORDENADAS GEOGRÁFICAS CONDIZEM COM O ENDEREÇO DO SERVIÇO SOLICITADO?", peso: 3 },
      { id: "gerais_q4", texto: "SERVIÇO DECORRENTE DE DANOS DE TERCEIROS?", peso: 0, tipo: "texto" },
    ]
  },
  {
    id: "nao_executado",
    nome: "Servico nao executado",
    tipos: "todos",
    itens: [
      { id: "nao_executado_q1", texto: "EM CASO DE NÃO EXECUÇÃO, HOUVE DESCRIÇÃO CORRETA DO MOTIVO?", peso: 2 },
      { id: "nao_executado_q2", texto: "HOUVE ACATAMENTO DE ETAPA PARA CONTINUIDADE?", peso: 2 },
      { id: "nao_executado_q3", texto: "TEM FOTO DA FACHADA DO IMÓVEL?", peso: 3 },
      { id: "nao_executado_q4", texto: "HÁ EVIDÊNCIAS DA ENTREGA DO FOLHETO \"SABESP ESTEVE AQUI\"?", peso: 2 },
    ]
  },
  {
    id: "rede_agua",
    nome: "Rede de agua",
    tipos: ["ReparoRede"],
    itens: [
      { id: "rede_agua_q1", texto: "TEM FOTO DA FACHADA DO IMÓVEL?", peso: 3 },
      { id: "rede_agua_q2", texto: "TEM FOTO DA EXECUÇÃO DO SERVIÇO?", peso: 3 },
      { id: "rede_agua_q3", texto: "TEM FOTO DA ETAPA FINAL?", peso: 3 },
      { id: "rede_agua_q4", texto: "O MATERIAL APLICADO FOI INFORMADO?", peso: 3 },
      { id: "rede_agua_q5", texto: "É POSSÍVEL IDENTIFICAR QUAL FOI O MATERIAL APLICADO?", peso: 2 },
      { id: "rede_agua_q6", texto: "A QUANTIDADE DE MATERIAL APLICADO CONDIZ COM O SERVIÇO EXECUTADO?", peso: 2 },
      { id: "rede_agua_q7", texto: "FOI REALIZADA CORRETAMENTE A SINALIZAÇÃO DE SEGURANÇA?", peso: 4 },
      { id: "rede_agua_q8", texto: "FOI EVIDENCIADO USO DE EPI?", peso: 3 },
      { id: "rede_agua_q9", texto: "CASO SEJA APLICÁVEL, FOI REALIZADO O ESCORAMENTO DE VALA?", peso: 4 },
      { id: "rede_agua_q10", texto: "O SOLO UTILIZADO ESTAVA LIMPO E NÃO SATURADO?", peso: 3 },
      { id: "rede_agua_q11", texto: "FOI EXECUTADO ENVOLTÓRIO DE AREIA?", peso: 3 },
      { id: "rede_agua_q12", texto: "TEM FOTO DA EXECUÇÃO DO TESTE DE ESTANQUEIDADE?", peso: 2 },
      { id: "rede_agua_q13", texto: "FOI REALIZADA COMPACTAÇÃO DE SOLO ADEQUADA?", peso: 3 },
      { id: "rede_agua_q14", texto: "A VALA FOI REQUADRADA?", peso: 3 },
      { id: "rede_agua_q15", texto: "O MATERIAL ESCAVADO FOI DEPOSITADO CORRETAMENTE EM LONA/ENCERADO?", peso: 3 },
      { id: "rede_agua_q16", texto: "O LOCAL FOI LIMPO APÓS A EXECUÇÃO?", peso: 3 },
      { id: "rede_agua_q17", texto: "FOI REALIZADA REPOSIÇÃO PROVISÓRIA DE PISO OU PAVIMENTO?", peso: 0, tipo: "texto" },
      { id: "rede_agua_q18", texto: "HÁ SINALIZAÇÃO (CARIMBO DE PROVISÓRIO) QUE INDIQUE QUE A REPOSIÇÃO É PROVISÓRIA?", peso: 3 },
    ]
  },
  {
    id: "ramal_agua",
    nome: "Ramal de agua",
    tipos: ["LigacaoAgua"],
    itens: [
      { id: "ramal_agua_q1", texto: "TEM FOTO DA FACHADA DO IMÓVEL?", peso: 3 },
      { id: "ramal_agua_q2", texto: "TEM FOTO DA EXECUÇÃO DO SERVIÇO?", peso: 3 },
      { id: "ramal_agua_q3", texto: "TEM FOTO DA ETAPA FINAL?", peso: 3 },
      { id: "ramal_agua_q4", texto: "TEM FOTO LEGÍVEL PARA LEITURA DO HIDRÔMETRO?", peso: 3 },
      { id: "ramal_agua_q5", texto: "INFORME A LEITURA DO HIDRÔMETRO", peso: 0, tipo: "texto" },
      { id: "ramal_agua_q6", texto: "TEM FOTO LEGÍVEL PARA LEITURA DA MATRÍCULA DO HIDRÔMETRO?", peso: 3 },
      { id: "ramal_agua_q7", texto: "INFORME A MATRÍCULA DO HIDRÔMETRO", peso: 0, tipo: "texto" },
      { id: "ramal_agua_q8", texto: "O MATERIAL APLICADO FOI INFORMADO?", peso: 3 },
      { id: "ramal_agua_q9", texto: "É POSSIVEL IDENTIFICAR QUAL FOI O MATERIAL APLICADO?", peso: 2 },
      { id: "ramal_agua_q10", texto: "A QUANTIDADE DE MATERIAL APLICADO CONDIZ COM O SERVIÇO EXECUTADO?", peso: 3 },
      { id: "ramal_agua_q11", texto: "FOI REALIZADA CORRETAMENTE A SINALIZAÇÃO DE SEGURANÇA?", peso: 4 },
      { id: "ramal_agua_q12", texto: "FOI EVIDENCIADO USO DE EPI?", peso: 3 },
      { id: "ramal_agua_q13", texto: "CASO SEJA APLICÁVEL, FOI REALIZADO O ESCORAMENTO DE VALA?", peso: 4 },
      { id: "ramal_agua_q14", texto: "A SUPRESSÃO DO RAMAL FOI EXECUTADA CORRETAMENTE?", peso: 2 },
      { id: "ramal_agua_q15", texto: "O SOLO UTILIZADO ESTAVA LIMPO E NÃO SATURADO?", peso: 3 },
      { id: "ramal_agua_q16", texto: "FOI EXECUTADO ENVOLTÓRIO DE AREIA?", peso: 3 },
      { id: "ramal_agua_q17", texto: "TEM FOTO DA EXECUÇÃO DO TESTE DE ESTANQUEIDADE?", peso: 2 },
      { id: "ramal_agua_q18", texto: "FOI REALIZADA COMPACTAÇÃO DE SOLO ADEQUADA?", peso: 3 },
      { id: "ramal_agua_q19", texto: "A VALA FOI REQUADRADA?", peso: 3 },
      { id: "ramal_agua_q20", texto: "O MATERIAL ESCAVADO FOI DEPOSITADO CORRETAMENTE EM LONA/ENCERADO?", peso: 3 },
      { id: "ramal_agua_q21", texto: "O LOCAL FOI LIMPO APÓS A EXECUÇÃO?", peso: 3 },
      { id: "ramal_agua_q22", texto: "FOI REALIZADA REPOSIÇÃO PROVISÓRIA DE PISO OU PAVIMENTO?", peso: 0, tipo: "texto" },
      { id: "ramal_agua_q23", texto: "HÁ SINALIZAÇÃO (CARIMBO DE PROVISÓRIO) QUE INDIQUE QUE A REPOSIÇÃO É PROVISÓRIA?", peso: 3 },
    ]
  },
  {
    id: "cavalete_hidrometro",
    nome: "Cavalete / hidrometro",
    tipos: ["ReligacaoAgua", "CorteAgua", "TrocaHidrometro"],
    itens: [
      { id: "cavalete_hidrometro_q1", texto: "TEM FOTO DA FACHADA?", peso: 3 },
      { id: "cavalete_hidrometro_q2", texto: "TEM FOTO DA EXECUÇÃO DO SERVIÇO?", peso: 3 },
      { id: "cavalete_hidrometro_q3", texto: "TEM FOTO DA ETAPA FINAL?", peso: 3 },
      { id: "cavalete_hidrometro_q4", texto: "TEM FOTO LEGÍVEL PARA LEITURA DO HIDRÔMETRO RETIRADO?", peso: 3 },
      { id: "cavalete_hidrometro_q5", texto: "INFORME A LEITURA DO HIDRÔMETRO RETIRADO", peso: 0, tipo: "texto" },
      { id: "cavalete_hidrometro_q6", texto: "TEM FOTO LEGÍVEL PARA LEITURA DO HIDRÔMETRO INSTALADO?", peso: 3 },
      { id: "cavalete_hidrometro_q7", texto: "INFORME A LEITURA DO HIDRÔMETRO INSTALADO", peso: 0, tipo: "texto" },
      { id: "cavalete_hidrometro_q8", texto: "TEM FOTO LEGÍVEL PARA LEITURA DA MATRÍCULA DO HIDRÔMETRO RETIRADO?", peso: 3 },
      { id: "cavalete_hidrometro_q9", texto: "INFORME A MATRÍCULA DO HIDRÔMETRO RETIRADO", peso: 0, tipo: "texto" },
      { id: "cavalete_hidrometro_q10", texto: "TEM FOTO LEGÍVEL PARA LEITURA DA MATRÍCULA DO HIDRÔMETRO INSTALADO?", peso: 3 },
      { id: "cavalete_hidrometro_q11", texto: "INFORME A MATRÍCULA DO HIDRÔMETRO INSTALADO", peso: 0, tipo: "texto" },
      { id: "cavalete_hidrometro_q12", texto: "O MATERIAL APLICADO FOI INFORMADO?", peso: 3 },
      { id: "cavalete_hidrometro_q13", texto: "É POSSIVEL IDENTIFICAR QUAL FOI O MATERIAL APLICADO?", peso: 2 },
      { id: "cavalete_hidrometro_q14", texto: "A QUANTIDADE DE MATERIAL APLICADO CONDIZ COM O SERVIÇO EXECUTADO?", peso: 3 },
    ]
  },
  {
    id: "esgoto",
    nome: "Rede / Ramal de esgoto / PV / PI / TL",
    tipos: ["Outros"],
    itens: [
      { id: "esgoto_q1", texto: "TEM FOTO DA FACHADA?", peso: 3 },
      { id: "esgoto_q2", texto: "TEM FOTO DA EXECUÇÃO DO SERVIÇO?", peso: 3 },
      { id: "esgoto_q3", texto: "TEM FOTO DA ETAPA FINAL?", peso: 3 },
      { id: "esgoto_q4", texto: "FOI REALIZADA CORRETAMENTE A SINALIZAÇÃO DE SEGURANÇA?", peso: 4 },
      { id: "esgoto_q5", texto: "FOI EVIDENCIADO USO DE EPI?", peso: 3 },
      { id: "esgoto_q6", texto: "FOI REALIZADO O ESCORAMENTO DE VALA?", peso: 4 },
      { id: "esgoto_q7", texto: "O SOLO UTILIZADO ESTAVA LIMPO E NÃO SATURADO?", peso: 3 },
      { id: "esgoto_q8", texto: "FOI REALIZADA COMPACTAÇÃO DE SOLO ADEQUADA?", peso: 3 },
      { id: "esgoto_q9", texto: "A VALA FOI REQUADRADA?", peso: 3 },
      { id: "esgoto_q10", texto: "O MATERIAL ESCAVADO FOI DEPOSITADO CORRETAMENTE EM LONA/ENCERADO?", peso: 3 },
      { id: "esgoto_q11", texto: "O LOCAL FOI LIMPO APÓS A EXECUÇÃO?", peso: 3 },
      { id: "esgoto_q12", texto: "FOI REALIZADA REPOSIÇÃO PROVISÓRIA DE PISO OU PAVIMENTO?", peso: 0, tipo: "texto" },
      { id: "esgoto_q13", texto: "HÁ SINALIZAÇÃO (CARIMBO DE PROVISÓRIO) QUE INDIQUE QUE A REPOSIÇÃO É PROVISÓRIA?", peso: 3 },
    ]
  },
  {
    id: "desobstrucao",
    nome: "Desobstrucao / Lavagem de Rede / Ramal",
    tipos: ["Outros"],
    itens: [
      { id: "desobstrucao_q1", texto: "TEM FOTO DA FACHADA?", peso: 3 },
      { id: "desobstrucao_q2", texto: "TEM FOTO DA EXECUÇÃO DO SERVIÇO?", peso: 3 },
      { id: "desobstrucao_q3", texto: "TEM FOTO DA ETAPA FINAL? (TAMPA FECHADA)", peso: 3 },
      { id: "desobstrucao_q4", texto: "FOI REALIZADA CORRETAMENTE A SINALIZAÇÃO DE SEGURANÇA?", peso: 4 },
      { id: "desobstrucao_q5", texto: "FOI EVIDENCIADO USO DE EPI?", peso: 3 },
      { id: "desobstrucao_q6", texto: "O LOCAL FOI LIMPO APÓS A EXECUÇÃO?", peso: 3 },
      { id: "desobstrucao_q7", texto: "EM CASO DE DESOBSTRUÇÃO, TEM FOTO DA DESOBSTRUÇÃO E LIMPEZA DA REDE / RAMAL?", peso: 3 },
    ]
  },
  {
    id: "lavagem_eee",
    nome: "Lavagem de EEE",
    tipos: ["Outros"],
    itens: [
      { id: "lavagem_eee_q1", texto: "TEM FOTO DA FACHADA?", peso: 3 },
      { id: "lavagem_eee_q2", texto: "TEM FOTO DA EXECUÇÃO DO SERVIÇO?", peso: 3 },
      { id: "lavagem_eee_q3", texto: "TEM FOTO DA ETAPA FINAL? (TAMPA FECHADA)", peso: 3 },
      { id: "lavagem_eee_q4", texto: "FOI REALIZADA CORRETAMENTE A SINALIZAÇÃO DE SEGURANÇA?", peso: 4 },
      { id: "lavagem_eee_q5", texto: "FOI EVIDENCIADO USO DE EPI?", peso: 3 },
      { id: "lavagem_eee_q6", texto: "O LOCAL FOI LIMPO APÓS A EXECUÇÃO?", peso: 3 },
      { id: "lavagem_eee_q7", texto: "TEM FOTO DA LIMPEZA DA EEE?", peso: 3 },
    ]
  },
  {
    id: "reposicao_piso",
    nome: "Reposicao de piso / passeio",
    tipos: ["Outros"],
    itens: [
      { id: "reposicao_piso_q1", texto: "TEM FOTO DA FACHADA?", peso: 3 },
      { id: "reposicao_piso_q2", texto: "TEM FOTO DA EXECUÇÃO DO SERVIÇO?", peso: 3 },
      { id: "reposicao_piso_q3", texto: "TEM FOTO DA ETAPA FINAL?", peso: 3 },
      { id: "reposicao_piso_q4", texto: "FOI REALIZADA CORRETAMENTE A SINALIZAÇÃO DE SEGURANÇA?", peso: 4 },
      { id: "reposicao_piso_q5", texto: "FOI EVIDENCIADO USO DE EPI?", peso: 3 },
      { id: "reposicao_piso_q6", texto: "O MATERIAL APLICADO FOI INFORMADO?", peso: 3 },
      { id: "reposicao_piso_q7", texto: "É POSSIVEL IDENTIFICAR QUAL FOI O MATERIAL APLICADO?", peso: 2 },
      { id: "reposicao_piso_q8", texto: "A QUANTIDADE DE MATERIAL APLICADO CONDIZ COM O SERVIÇO EXECUTADO?", peso: 3 },
      { id: "reposicao_piso_q9", texto: "A REPOSIÇÃO FOI RECOMPOSTA DE FORMA A PRESERVAR O ASPECTO ANTERIOR DO PAVIMENTO?", peso: 3 },
      { id: "reposicao_piso_q10", texto: "O LOCAL FOI LIMPO APÓS A EXECUÇÃO?", peso: 3 },
    ]
  },
  {
    id: "reposicao_asfaltica",
    nome: "Reposicao asfaltica",
    tipos: ["Outros"],
    itens: [
      { id: "reposicao_asfaltica_q1", texto: "TEM FOTO DA FACHADA?", peso: 3 },
      { id: "reposicao_asfaltica_q2", texto: "TEM FOTO DA EXECUÇÃO DO SERVIÇO?", peso: 3 },
      { id: "reposicao_asfaltica_q3", texto: "TEM FOTO DA ETAPA FINAL?", peso: 3 },
      { id: "reposicao_asfaltica_q4", texto: "FOI REALIZADA CORRETAMENTE A SINALIZAÇÃO DE SEGURANÇA?", peso: 4 },
      { id: "reposicao_asfaltica_q5", texto: "FOI EVIDENCIADO USO DE EPI?", peso: 3 },
      { id: "reposicao_asfaltica_q6", texto: "A VALA FOI REQUADRADA?", peso: 4 },
      { id: "reposicao_asfaltica_q7", texto: "TEM FOTO DO TERMÔMETRO?", peso: 3 },
      { id: "reposicao_asfaltica_q8", texto: "A TEMPERATURA MEDIDA ESTÁ ADEQUADA (ENTRE 165 ºC E 175 ºC PARA ASFALTO USINADO A QUENTE OU ENTRE 125 ºC E 150 º C PARA ASFALTO COM MISTURA MORNA)?", peso: 2 },
      { id: "reposicao_asfaltica_q9", texto: "TEM FOTO DO NIVELAMENTO DA RECOMPOSIÇÃO? (COM RÉGUA E TRENA)", peso: 3 },
      { id: "reposicao_asfaltica_q10", texto: "INFORME O DESNÍVEL MEDIDO (EM MM)", peso: 0, tipo: "texto" },
      { id: "reposicao_asfaltica_q11", texto: "A REPOSIÇÃO FOI RECOMPOSTA DE FORMA A PRESERVAR O ASPECTO ANTERIOR DO PAVIMENTO?", peso: 3 },
      { id: "reposicao_asfaltica_q12", texto: "O LOCAL FOI LIMPO APÓS A EXECUÇÃO?", peso: 3 },
    ]
  },
];

export function gruposParaTipo(tipoServico: TipoServico) {
  return gruposFfr.filter((grupo) => grupo.tipos === "todos" || grupo.tipos.includes(tipoServico));
}

// --- Seleção precisa de critérios pela Descrição TSS importada ---------------
// A Descrição TSS (texto livre vindo da Sabesp) determina o grupo específico de
// critérios. Itens Gerais + Serviço não executado aparecem sempre; além deles,
// apenas o grupo que casa com o serviço. O mapeamento por palavra-chave é
// best-effort sobre o texto normalizado (ver normalizeHeader). Ordem importa:
// regras mais específicas primeiro (ex.: "religacao" antes de "ligacao", já que
// "religacao" contém "ligacao").

export type OrdemFfrContext = {
  tipoServico: TipoServico;
  /** Serviço solicitado / "TSS PAI". */
  descricaoTss?: string | null;
  /** Serviço executado / "TSE (fiscalizado)". */
  descricaoTse?: string | null;
};

const gruposPorId = new Map(gruposFfr.map((grupo) => [grupo.id, grupo]));

const tssGrupoKeywords: Array<[needle: string, grupoId: string]> = [
  ["religacao", "cavalete_hidrometro"],
  ["corte", "cavalete_hidrometro"],
  ["hidrometro", "cavalete_hidrometro"],
  ["cavalete", "cavalete_hidrometro"],
  ["ligacao", "ramal_agua"],
  ["ramal_de_agua", "ramal_agua"],
  ["rede_de_agua", "rede_agua"],
  ["reparo", "rede_agua"],
  ["vazamento", "rede_agua"],
  ["asfalt", "reposicao_asfaltica"],
  ["piso", "reposicao_piso"],
  ["passeio", "reposicao_piso"],
  ["calcada", "reposicao_piso"],
  ["bloquete", "reposicao_piso"],
  ["paralelep", "reposicao_piso"],
  ["desobstru", "desobstrucao"],
  ["lavagem_de_rede", "desobstrucao"],
  ["lavagem_de_ramal", "desobstrucao"],
  ["_eee_", "lavagem_eee"],
  ["elevatoria", "lavagem_eee"],
  ["esgoto", "esgoto"],
  ["coletor", "esgoto"],
  ["_pv_", "esgoto"],
  ["_pi_", "esgoto"],
  ["_tl_", "esgoto"]
];

const tipoServicoFallback: Partial<Record<TipoServico, string>> = {
  LigacaoAgua: "ramal_agua",
  ReparoRede: "rede_agua",
  ReligacaoAgua: "cavalete_hidrometro",
  CorteAgua: "cavalete_hidrometro",
  TrocaHidrometro: "cavalete_hidrometro"
  // Vistoria / Outros: sem grupo específico (apenas Itens Gerais + não executado)
};

/** First specific group id matched by a single TSS/TSE description (keyword scan), or null. */
function grupoPorDescricao(descricao: string | null | undefined): string | null {
  if (!descricao) return null;
  const padded = `_${normalizeHeader(descricao)}_`;
  for (const [needle, grupoId] of tssGrupoKeywords) {
    if (padded.includes(needle)) return grupoId;
  }
  return null;
}

/**
 * Specific FFR group ids for an OS, derived from BOTH the requested service
 * (TSS PAI = descricaoTss) and the executed service (TSE = descricaoTse), in
 * order (TSS PAI first). A duplicate is only the SAME service on the same OS:
 * when the two descriptions are equal, the group is shown once. Two DIFFERENT
 * services are kept even when they resolve to the same criteria group (e.g.
 * CORTE + RELIGAÇÃO → cavalete). Falls back to the tipoServico group only when
 * neither description matches a keyword.
 */
export function selecionarGruposEspecificosIds(ctx: OrdemFfrContext): string[] {
  const grupoTss = grupoPorDescricao(ctx.descricaoTss);
  const grupoTse = grupoPorDescricao(ctx.descricaoTse);
  const mesmoServico =
    ctx.descricaoTss != null &&
    ctx.descricaoTse != null &&
    normalizeHeader(ctx.descricaoTss) === normalizeHeader(ctx.descricaoTse);

  const ids: string[] = [];
  if (grupoTss) ids.push(grupoTss);
  if (grupoTse && !mesmoServico) ids.push(grupoTse);

  if (ids.length === 0) {
    const fallback = tipoServicoFallback[ctx.tipoServico];
    if (fallback) ids.push(fallback);
  }
  return ids;
}

/** Single specific group id (first match) — kept for callers that need just one. */
export function selecionarGrupoEspecificoId(ctx: OrdemFfrContext): string | null {
  return selecionarGruposEspecificosIds(ctx)[0] ?? null;
}

/** Groups shown/scored for an OS: Itens Gerais + Serviço não executado + every specific service group. */
export function gruposParaOrdem(ctx: OrdemFfrContext): FfrGrupo[] {
  const sempre = gruposFfr.filter((grupo) => grupo.tipos === "todos");
  const especificos = selecionarGruposEspecificosIds(ctx)
    .map((id) => gruposPorId.get(id))
    .filter((grupo): grupo is FfrGrupo => Boolean(grupo));
  return [...sempre, ...especificos];
}

/** Groups for one specific group id: Itens Gerais + Serviço não executado + that group. Used per export sheet. */
export function gruposParaGrupoEspecifico(grupoId: string | null): FfrGrupo[] {
  const sempre = gruposFfr.filter((grupo) => grupo.tipos === "todos");
  const especifico = grupoId ? gruposPorId.get(grupoId) : undefined;
  return especifico ? [...sempre, especifico] : sempre;
}
