import type { TipoServico } from "@prisma/client";

// Fonte de verdade em runtime: código de serviço Sabesp (4 dígitos) → categoria FFR.
// Derivada da tabela fixa definitiva fornecida pela operação (8 categorias, sem
// `Outros`). A migração SQL histórica (`categorias_por_codigo_v2`) deriva suas
// listas IN(...) desta mesma tabela.

const codigosPorCategoria: Record<TipoServico, string[]> = {
  RedeAgua: [
    "3000", "3010", "3030", "3040", "3060", "3080", "3090", "3110", "3120",
    "3130", "3150", "3210", "3220", "3240", "3250", "3270", "3500", "3520",
    "3540", "3550", "3560", "3590", "3600", "7080"
  ],
  RamalAgua: [
    "2540", "2550", "2560", "2600", "2610", "2620", "2630", "2650", "2670",
    "2690", "2800", "2820", "2830", "2840", "2845", "2860", "2870", "3530",
    "3580", "4150"
  ],
  CavaleteHidrometro: [
    "1300", "1310", "1350", "1360", "1380", "1390", "1400", "1410", "1420",
    "1480", "1490", "1530", "1550", "1555", "1590", "2010", "2011", "2015",
    "2020", "2030", "2031", "2035", "2040", "2041", "2045", "2050", "2051",
    "2055", "2060", "2070", "2080", "2090", "2110", "2111", "2120", "2130",
    "2140", "2145", "2150", "2152", "2160", "2161", "2162", "2170", "2185",
    "2195", "2530", "2660", "2680", "3570", "4020", "4040", "4041", "4080",
    "4090", "4110", "4530", "4630"
  ],
  RedeRamalEsgoto: [
    "4100", "5000", "5010", "5020", "5025", "5040", "5045", "5050", "5060",
    "5070", "5080", "5090", "5300", "5310", "5320", "5330", "5340", "5350",
    "5360", "5370", "5380", "5390", "5400", "5410", "5420", "5600", "5650",
    "5670", "5690", "5800", "5830", "5880", "5900", "5910", "5930", "7120"
  ],
  Desobstrucao: [
    "5610", "5620", "5810", "5850"
  ],
  LavagemEee: [
    "7070"
  ],
  ReposicaoPiso: [
    "7380", "7400", "7420", "7490", "7500", "7510", "7520", "7530", "7540",
    "7550", "7570", "7580", "7585", "7600", "7610", "7620", "7630", "7640",
    "7645", "7650", "7660", "7670", "7675", "7680", "7690", "7700", "7705",
    "7710", "7720", "7730", "7735", "7760", "7765", "7770", "7780", "7790",
    "7795", "7810", "7820", "7825"
  ],
  ReposicaoAsfaltica: [
    "7300", "7305", "7306", "7307", "7310", "7311", "7320", "7330", "7340",
    "7360", "7370", "7390", "7430", "7431", "7450", "7460", "7470", "7480",
    "7850", "7851", "7855"
  ]
};

// Mapa código → categoria, achatado a partir das listas acima.
export const categoriaPorCodigoMap: Record<string, TipoServico> = Object.fromEntries(
  (Object.entries(codigosPorCategoria) as [TipoServico, string[]][]).flatMap(
    ([categoria, codigos]) => codigos.map((codigo) => [codigo, categoria] as const)
  )
);

function normalizarCodigo(codigo?: string | null): string | null {
  if (codigo == null) return null;
  const limpo = String(codigo).trim();
  return limpo.length > 0 ? limpo : null;
}

// Categoriza pela tabela fixa: tenta o código TSS e, se ausente/fora da tabela,
// o código TSE (mesma numeração). Retorna `null` quando nenhum está na tabela
// (= serviço fora de escopo, não deve ser importado).
export function categoriaPorCodigo(
  codigoTss?: string | null,
  codigoTse?: string | null
): TipoServico | null {
  const tss = normalizarCodigo(codigoTss);
  if (tss && categoriaPorCodigoMap[tss]) return categoriaPorCodigoMap[tss];

  const tse = normalizarCodigo(codigoTse);
  if (tse && categoriaPorCodigoMap[tse]) return categoriaPorCodigoMap[tse];

  return null;
}
