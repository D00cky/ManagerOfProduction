import type { StatusOS, TipoServico } from "@prisma/client";

export type DemoOrdemServico = {
  numero: string;
  enderecoCompleto: string;
  bairro: string;
  cidade: string;
  tipoServico: TipoServico;
  status: StatusOS;
  poloCodigo: string;
  fiscalMatricula?: string;
  observacao?: string;
};

export const demoOrdensServico: DemoOrdemServico[] = [
  {
    numero: "OS-1001",
    enderecoCompleto: "Rua das Flores, 100",
    bairro: "Centro",
    cidade: "Cidade Teste",
    tipoServico: "LigacaoAgua",
    status: "NaFila",
    poloCodigo: "POLO-01",
    observacao: "OS demo sem fiscal para testar atribuicao."
  },
  {
    numero: "OS-1002",
    enderecoCompleto: "Av. Brasil, 200",
    bairro: "Jardim",
    cidade: "Cidade Teste",
    tipoServico: "Vistoria",
    status: "NaFila",
    poloCodigo: "POLO-01",
    fiscalMatricula: "F0001",
    observacao: "OS demo atribuida para testar tabulacao."
  },
  {
    numero: "OS-1003",
    enderecoCompleto: "Rua Aguas Claras, 45",
    bairro: "Vila Nova",
    cidade: "Cidade Teste",
    tipoServico: "ReparoRede",
    status: "NaFila",
    poloCodigo: "POLO-01"
  },
  {
    numero: "OS-1004",
    enderecoCompleto: "Rua das Palmeiras, 88",
    bairro: "Centro",
    cidade: "Cidade Teste",
    tipoServico: "TrocaHidrometro",
    status: "NaFila",
    poloCodigo: "POLO-01",
    fiscalMatricula: "F0001"
  },
  {
    numero: "OS-1005",
    enderecoCompleto: "Travessa Norte, 12",
    bairro: "Jardim",
    cidade: "Cidade Teste",
    tipoServico: "ReligacaoAgua",
    status: "NaFila",
    poloCodigo: "POLO-01"
  },
  {
    numero: "OS-1006",
    enderecoCompleto: "Alameda Santos, 300",
    bairro: "Industrial",
    cidade: "Cidade Teste",
    tipoServico: "CorteAgua",
    status: "NaFila",
    poloCodigo: "POLO-01",
    fiscalMatricula: "F0001"
  },
  {
    numero: "OS-1007",
    enderecoCompleto: "Rua Projetada, 7",
    bairro: "Lagoa",
    cidade: "Cidade Teste",
    tipoServico: "Outros",
    status: "NaFila",
    poloCodigo: "POLO-01"
  },
  {
    numero: "OS-1008",
    enderecoCompleto: "Av. Central, 501",
    bairro: "Centro",
    cidade: "Cidade Teste",
    tipoServico: "Vistoria",
    status: "NaFila",
    poloCodigo: "POLO-01",
    fiscalMatricula: "F0001"
  }
];
