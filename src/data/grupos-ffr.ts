import type { TipoServico } from "@prisma/client";

export type ValorResposta = "1" | "0" | "X" | null | string;

/**
 * Prefixo das chaves usadas para guardar, junto às respostas, a observação que o
 * fiscal escreve quando marca um critério como "Não conforme" ("0"). Como o cálculo
 * FFR e o export iteram pelos itens definidos em `gruposFfr`, essas chaves extras
 * são naturalmente ignoradas pela pontuação.
 */
export const OBS_NAO_CONFORME_PREFIX = "__obs_nc__:";

/** Chave em `respostas` que guarda a observação de "Não conforme" de um critério. */
export function chaveObsNaoConforme(itemId: string): string {
  return `${OBS_NAO_CONFORME_PREFIX}${itemId}`;
}

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
// O tipo de servico (derivado do codigo Sabesp, ver categorias-servico.ts) casa
// 1:1 com o grupo FFR de pontuacao via tipoServicoFallback.
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
    tipos: ["RedeAgua"],
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
    tipos: ["RamalAgua"],
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
    tipos: ["CavaleteHidrometro"],
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
    tipos: ["RedeRamalEsgoto"],
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
    tipos: ["Desobstrucao"],
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
    tipos: ["LavagemEee"],
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
    tipos: ["ReposicaoPiso"],
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
    tipos: ["ReposicaoAsfaltica"],
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

// --- Seleção precisa de critérios pela categoria do serviço ------------------
// O tipo de serviço (determinístico, vindo do código Sabesp) define o grupo de
// critérios específico via `tipoServicoFallback`, 1:1. Itens Gerais + Serviço não
// executado aparecem sempre; além deles, apenas o grupo que casa com o tipo.

export type OrdemFfrContext = { tipoServico: TipoServico; descricaoTss?: string | null };

const gruposPorId = new Map(gruposFfr.map((grupo) => [grupo.id, grupo]));

const tipoServicoFallback: Record<TipoServico, string> = {
  RedeAgua: "rede_agua",
  RamalAgua: "ramal_agua",
  CavaleteHidrometro: "cavalete_hidrometro",
  RedeRamalEsgoto: "esgoto",
  Desobstrucao: "desobstrucao",
  LavagemEee: "lavagem_eee",
  ReposicaoPiso: "reposicao_piso",
  ReposicaoAsfaltica: "reposicao_asfaltica"
};

/** Resolve the single specific FFR group id for an OS: tipo de serviço → grupo. */
export function selecionarGrupoEspecificoId(ctx: OrdemFfrContext): string | null {
  return tipoServicoFallback[ctx.tipoServico] ?? null;
}

/** Groups shown/scored for an OS: Itens Gerais + Serviço não executado + the specific one. */
export function gruposParaOrdem(ctx: OrdemFfrContext): FfrGrupo[] {
  const sempre = gruposFfr.filter((grupo) => grupo.tipos === "todos");
  const especificoId = selecionarGrupoEspecificoId(ctx);
  const especifico = especificoId ? gruposPorId.get(especificoId) : undefined;
  return especifico ? [...sempre, especifico] : sempre;
}
