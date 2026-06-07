import type { TipoServico } from "@prisma/client";

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

export const gruposFfr: FfrGrupo[] = [
  {
    id: "gerais",
    nome: "Itens Gerais",
    tipos: "todos",
    itens: [
      { id: "gerais_identificacao", texto: "Fiscal identificou OS, endereco e servico antes da execucao", peso: 1 },
      { id: "gerais_epi", texto: "Equipe utilizou EPIs e sinalizacao adequada", peso: 1 },
      { id: "gerais_fotos", texto: "Registro fotografico comprova antes, durante e depois", peso: 1 },
      { id: "gerais_observacao", texto: "Observacoes complementares", peso: 0, tipo: "texto" }
    ]
  },
  {
    id: "ligacao_agua",
    nome: "Ligacao de Agua",
    tipos: ["LigacaoAgua"],
    itens: [
      { id: "ligacao_ramal", texto: "Ramal executado conforme padrao tecnico", peso: 2 },
      { id: "ligacao_cavalete", texto: "Cavalete instalado e testado sem vazamento", peso: 2 },
      { id: "ligacao_pavimento", texto: "Reposicao do pavimento registrada", peso: 1 }
    ]
  },
  {
    id: "religacao_agua",
    nome: "Religacao de Agua",
    tipos: ["ReligacaoAgua"],
    itens: [
      { id: "religacao_lacre", texto: "Lacre removido com registro adequado", peso: 1 },
      { id: "religacao_fluxo", texto: "Abastecimento restabelecido e testado", peso: 2 },
      { id: "religacao_cliente", texto: "Cliente ou responsavel orientado", peso: 1 }
    ]
  },
  {
    id: "corte_agua",
    nome: "Corte de Agua",
    tipos: ["CorteAgua"],
    itens: [
      { id: "corte_confirmacao", texto: "Imovel e motivo do corte conferidos", peso: 2 },
      { id: "corte_execucao", texto: "Corte executado no ponto correto", peso: 2 },
      { id: "corte_lacre", texto: "Lacre aplicado e fotografado", peso: 1 }
    ]
  },
  {
    id: "troca_hidrometro",
    nome: "Troca de Hidrometro",
    tipos: ["TrocaHidrometro"],
    itens: [
      { id: "troca_leitura_antiga", texto: "Leitura e numero do hidrometro retirado registrados", peso: 2 },
      { id: "troca_leitura_nova", texto: "Hidrometro novo instalado com dados completos", peso: 2 },
      { id: "troca_teste", texto: "Teste de estanqueidade realizado", peso: 1 }
    ]
  },
  {
    id: "vistoria",
    nome: "Vistoria",
    tipos: ["Vistoria"],
    itens: [
      { id: "vistoria_acesso", texto: "Acesso ao local registrado", peso: 1 },
      { id: "vistoria_constatacao", texto: "Constatacao tecnica descrita com evidencia", peso: 2 },
      { id: "vistoria_encaminhamento", texto: "Encaminhamento informado corretamente", peso: 1 }
    ]
  },
  {
    id: "reparo_rede",
    nome: "Reparo de Rede",
    tipos: ["ReparoRede"],
    itens: [
      { id: "reparo_isolamento", texto: "Area isolada e rede manobrada com seguranca", peso: 2 },
      { id: "reparo_execucao", texto: "Reparo executado conforme material previsto", peso: 2 },
      { id: "reparo_reaterro", texto: "Reaterro e limpeza final registrados", peso: 1 }
    ]
  },
  {
    id: "outros",
    nome: "Outros Servicos",
    tipos: ["Outros"],
    itens: [
      { id: "outros_escopo", texto: "Escopo da OS foi cumprido", peso: 2 },
      { id: "outros_evidencia", texto: "Evidencias sustentam a conclusao", peso: 2 },
      { id: "outros_obs", texto: "Descricao livre do servico", peso: 0, tipo: "texto" }
    ]
  },
  {
    id: "qualidade_final",
    nome: "Qualidade Final",
    tipos: "todos",
    itens: [
      { id: "qualidade_prazo", texto: "Execucao dentro do prazo operacional", peso: 1 },
      { id: "qualidade_sistema", texto: "Baixa no sistema consistente com evidencias", peso: 1 }
    ]
  }
];

export function gruposParaTipo(tipoServico: TipoServico) {
  return gruposFfr.filter((grupo) => grupo.tipos === "todos" || grupo.tipos.includes(tipoServico));
}
