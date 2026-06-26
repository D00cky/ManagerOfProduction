import type { StatusOS, TipoServico } from "@prisma/client";

export type DemoOrdemServico = {
  numero: string;
  enderecoCompleto: string;
  bairro: string;
  cidade: string;
  // Código Sabesp representativo da categoria (ver src/data/categorias-servico.ts).
  // Mantém o demo-os.xlsx importável pela nova categorização por código.
  codigoTss: string;
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
    codigoTss: "3000",
    tipoServico: "RedeAgua",
    status: "NaFila",
    poloCodigo: "POLO-01",
    observacao: "OS demo sem fiscal para testar atribuicao."
  },
  {
    numero: "OS-1002",
    enderecoCompleto: "Av. Brasil, 200",
    bairro: "Jardim",
    cidade: "Cidade Teste",
    codigoTss: "2860",
    tipoServico: "RamalAgua",
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
    codigoTss: "5880",
    tipoServico: "RedeRamalEsgoto",
    status: "NaFila",
    poloCodigo: "POLO-01"
  },
  {
    numero: "OS-1004",
    enderecoCompleto: "Rua das Palmeiras, 88",
    bairro: "Centro",
    cidade: "Cidade Teste",
    codigoTss: "2010",
    tipoServico: "CavaleteHidrometro",
    status: "NaFila",
    poloCodigo: "POLO-01"
  },
  {
    numero: "OS-1005",
    enderecoCompleto: "Travessa Norte, 12",
    bairro: "Jardim",
    cidade: "Cidade Teste",
    codigoTss: "5810",
    tipoServico: "Desobstrucao",
    status: "NaFila",
    poloCodigo: "POLO-01"
  },
  {
    numero: "OS-1006",
    enderecoCompleto: "Alameda Santos, 300",
    bairro: "Industrial",
    cidade: "Cidade Teste",
    codigoTss: "7070",
    tipoServico: "LavagemEee",
    status: "NaFila",
    poloCodigo: "POLO-01"
  },
  {
    numero: "OS-1007",
    enderecoCompleto: "Rua Projetada, 7",
    bairro: "Lagoa",
    cidade: "Cidade Teste",
    codigoTss: "7670",
    tipoServico: "ReposicaoPiso",
    status: "NaFila",
    poloCodigo: "POLO-01"
  },
  {
    numero: "OS-1008",
    enderecoCompleto: "Av. Central, 501",
    bairro: "Centro",
    cidade: "Cidade Teste",
    codigoTss: "7850",
    tipoServico: "ReposicaoAsfaltica",
    status: "NaFila",
    poloCodigo: "POLO-01"
  }
];
