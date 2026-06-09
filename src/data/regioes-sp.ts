/**
 * São Paulo state geography for the OS tree/filter: Estado → Região
 * Administrativa (15) → Município.
 *
 * The 15 administrative regions follow the state government / SEADE division
 * (the Região Metropolitana de São Paulo standing in as the "São Paulo" region).
 *
 * `municipiosPorRegiao` is a curated mapping: it covers every município that
 * appears in the real Sabesp execution exports plus the seats and major
 * municipalities of each region. Matching is accent/case-insensitive, so names
 * may be stored with or without accents. Unknown municípios resolve to `null`
 * (the OS simply carries no region) rather than throwing.
 */
export const ESTADO = "São Paulo" as const;

export const REGIOES_SP = [
  "São Paulo",
  "Registro",
  "Santos",
  "São José dos Campos",
  "Sorocaba",
  "Campinas",
  "Ribeirão Preto",
  "Bauru",
  "São José do Rio Preto",
  "Araçatuba",
  "Presidente Prudente",
  "Marília",
  "Central",
  "Barretos",
  "Franca"
] as const;

export type Regiao = (typeof REGIOES_SP)[number];

const municipiosPorRegiao: Record<Regiao, string[]> = {
  "São Paulo": [
    "São Paulo", "Guarulhos", "Osasco", "Santo André", "São Bernardo do Campo",
    "São Caetano do Sul", "Diadema", "Mauá", "Ribeirão Pires", "Rio Grande da Serra",
    "Cotia", "Embu das Artes", "Embu-Guaçu", "Itapecerica da Serra", "Taboão da Serra",
    "Itapevi", "Jandira", "Barueri", "Carapicuíba", "Santana de Parnaíba",
    "Pirapora do Bom Jesus", "Cajamar", "Caieiras", "Francisco Morato", "Franco da Rocha",
    "Mairiporã", "Arujá", "Itaquaquecetuba", "Poá", "Ferraz de Vasconcelos",
    "Suzano", "Mogi das Cruzes", "Biritiba-Mirim", "Biritiba Mirim", "Salesópolis",
    "Guararema", "Santa Isabel", "Igaratá", "Juquitiba", "São Lourenço da Serra",
    "Vargem Grande Paulista", "Embu"
  ],
  Registro: [
    "Registro", "Miracatu", "Cananéia", "Cajati", "Jacupiranga", "Iguape",
    "Ilha Comprida", "Pedro de Toledo", "Itariri", "Juquiá", "Pariquera-Açu",
    "Sete Barras", "Eldorado", "Barra do Turvo", "Apiaí", "Itaóca", "Iporanga",
    "Barra do Chapéu", "Itapirapuã Paulista", "Ribeira"
  ],
  Santos: [
    "Santos", "São Vicente", "Guarujá", "Cubatão", "Praia Grande", "Mongaguá",
    "Itanhaém", "Peruíbe", "Bertioga"
  ],
  "São José dos Campos": [
    "São José dos Campos", "Taubaté", "Pindamonhangaba", "Jacareí", "Caçapava",
    "Tremembé", "Caraguatatuba", "São Sebastião", "Ubatuba", "Ilhabela",
    "Lorena", "Guaratinguetá", "Aparecida", "Cachoeira Paulista", "Cruzeiro",
    "Lavrinhas", "Cunha", "Campos do Jordão", "São Bento do Sapucaí",
    "Santo Antônio do Pinhal", "Jambeiro", "Redenção da Serra", "Roseira",
    "Potim", "Canas", "Lagoinha", "Natividade da Serra", "Paraibuna",
    "Monteiro Lobato", "Igaratá"
  ],
  Sorocaba: [
    "Sorocaba", "Votorantim", "Itapetininga", "Itapeva", "Itararé", "Tatuí",
    "Boituva", "Cerquilho", "Tietê", "Porto Feliz", "Salto", "Itu", "São Roque",
    "Mairinque", "Alumínio", "Ibiúna", "Piedade", "Pilar do Sul", "Salto de Pirapora",
    "Araçoiaba da Serra", "Capela do Alto", "Tapiraí", "Angatuba", "Campina do Monte Alegre",
    "Guareí", "Quadra", "Cesário Lange", "São Miguel Arcanjo", "Paranapanema",
    "Avaré", "Itaí", "Cerqueira César", "Iaras", "Águas de Santa Bárbara",
    "Botucatu", "São Manuel", "Anhembi", "Bofete", "Pardinho", "Torre de Pedra",
    "Conchas", "Pereiras", "Porangaba", "Itatinga", "Capão Bonito", "Buri",
    "Guapiara", "Ribeirão Branco", "Ribeirão Grande", "Nova Campina", "Itaberá",
    "Riversul", "Coronel Macedo", "Barão de Antonina", "Itaporanga", "Piraju",
    "Taquarituba", "Fartura", "Taguaí", "Sarutaia", "Cândido Mota"
  ],
  Campinas: [
    "Campinas", "Hortolândia", "Sumaré", "Paulínia", "Americana", "Nova Odessa",
    "Santa Bárbara d'Oeste", "Monte Mor", "Indaiatuba", "Valinhos", "Vinhedo",
    "Jaguariúna", "Pedreira", "Holambra", "Artur Nogueira", "Cosmópolis",
    "Jundiaí", "Várzea Paulista", "Campo Limpo Paulista", "Itupeva", "Louveira",
    "Cabreúva", "Jarinu", "Itatiba", "Morungaba", "Bragança Paulista", "Atibaia",
    "Bom Jesus dos Perdões", "Nazaré Paulista", "Piracaia", "Joanópolis",
    "Vargem", "Pinhalzinho", "Pedra Bela", "Tuiuti", "Amparo", "Monte Alegre do Sul",
    "Serra Negra", "Socorro", "Águas de Lindóia", "Lindóia", "Limeira",
    "Cordeirópolis", "Iracemápolis", "Piracicaba", "Rio Claro", "Santa Gertrudes",
    "Capivari", "Rafard", "Mombuca", "Elias Fausto", "Saltinho", "Santa Maria da Serra",
    "Mogi Guaçu", "Mogi Mirim", "Itapira", "Estiva Gerbi", "Conchal", "Araras",
    "Leme", "Pirassununga", "Santa Cruz da Conceição", "Engenheiro Coelho",
    "Aguaí", "Casa Branca", "Santa Cruz das Palmeiras", "Mococa", "Caconde",
    "Tapiratiba", "Itobi", "Divinolândia", "São Sebastião da Grama", "Vargem Grande do Sul",
    "São João da Boa Vista", "Espírito Santo do Pinhal", "Santo Antônio do Jardim",
    "Águas da Prata", "São José do Rio Pardo"
  ],
  "Ribeirão Preto": [
    "Ribeirão Preto", "Sertãozinho", "Jardinópolis", "Brodowski", "Batatais",
    "Altinópolis", "Cravinhos", "Serrana", "Serra Azul", "Santa Rosa de Viterbo",
    "Cajuru", "Cássia dos Coqueiros", "Santo Antônio da Alegria", "Santa Cruz da Esperança",
    "São Simão", "Luís Antônio", "Jaboticabal", "Guariba", "Pradópolis",
    "Pontal", "Pitangueiras", "Barrinha", "Dumont", "Sales Oliveira",
    "Orlândia", "Nuporanga", "Bebedouro", "Monte Azul Paulista", "Pirangi",
    "Taquaral", "Taiúva", "Taiaçu", "Fernando Prestes"
  ],
  Bauru: [
    "Bauru", "Agudos", "Pederneiras", "Lençóis Paulista", "Macatuba", "Areiópolis",
    "Borebi", "Iacanga", "Boracéia", "Avaí", "Presidente Alves", "Pirajuí",
    "Piratininga", "Cabrália Paulista", "Duartina", "Lucianópolis", "Balbinos",
    "Lins", "Guaiçara", "Getulina", "Guaimbê", "Júlio Mesquita", "Promissão",
    "Cafelândia", "Sabino", "Reginópolis", "Uru", "Barbosa",
    "Jaú", "Bariri", "Itapuí", "Mineiros do Tietê", "Dois Córregos", "Brotas",
    "Torrinha", "Igaraçu do Tietê", "Bocaina", "Santa Cruz do Rio Pardo"
  ],
  "São José do Rio Preto": [
    "São José do Rio Preto", "Mirassol", "Bady Bassitt", "Cedral", "Guapiaçu",
    "Ipiguá", "Onda Verde", "Adolfo", "Nova Granada", "Orindiúva", "Icém",
    "Palestina", "Riolândia", "Paulo de Faria", "Cardoso", "Mira Estrela",
    "Mesópolis", "Paranapuã", "Fernandópolis", "Pedranópolis", "Estrela d'Oeste",
    "Meridiano", "Macedônia", "Guarani d'Oeste", "Jales", "Santa Fé do Sul",
    "Urânia", "Santa Albertina", "Aparecida d'Oeste", "Votuporanga", "Valentim Gentil",
    "Álvares Florence", "Cosmorama", "Parisi", "General Salgado", "Gastão Vidigal",
    "Nova Luzitânia", "Monções", "Catanduva", "Catiguá", "Tabapuã", "Novais",
    "Palmares Paulista", "Pindorama", "Irapuã", "Itajobi", "Marapoama", "Urupês",
    "Sales", "Elisiário"
  ],
  Araçatuba: [
    "Araçatuba", "Birigui", "Penápolis", "Guararapes", "Valparaíso", "Bilac",
    "Brejo Alegre", "Coroados", "Glicério", "Santo Antônio do Aracanguá",
    "Gabriel Monteiro", "Piacatu", "Clementina", "Braúna", "Lourdes", "Turiúba",
    "Buritama", "Zacarias", "Avanhandava", "Barbosa", "Bento de Abreu",
    "Guaraçaí", "Lavínia", "Mirandópolis", "Murutinga do Sul", "Castilho",
    "Andradina", "Pereira Barreto", "Sud Mennucci", "Ilha Solteira", "Nova Independência",
    "Itapura", "Guaragá", "Auriflama", "Nova Castilho"
  ],
  "Presidente Prudente": [
    "Presidente Prudente", "Álvares Machado", "Regente Feijó", "Caiabu", "Anhumas",
    "Pirapozinho", "Narandiba", "Taciba", "Estrela do Norte", "Sandovalina",
    "Presidente Bernardes", "Santo Anastácio", "Ribeirão dos Índios", "Piquerobi",
    "Santo Expedito", "Presidente Epitácio", "Presidente Venceslau", "Caiuá",
    "Marabá Paulista", "Teodoro Sampaio", "Rosana", "Euclides da Cunha Paulista",
    "Mirante do Paranapanema", "Adamantina", "Lucélia", "Osvaldo Cruz", "Inúbia Paulista",
    "Salmourão", "Pacaembu", "Mariápolis", "Flórida Paulista", "Sagres",
    "Flora Rica", "Emilianópolis", "Irapuru", "Alfredo Marcondes", "Álvares Florence",
    "Dracena", "Junqueirópolis", "Tupi Paulista", "Panorama", "Ouro Verde",
    "Santa Mercedes", "Paulicéia", "São João do Pau d'Alho", "Monte Castelo",
    "Nova Guataporanga"
  ],
  Marília: [
    "Marília", "Vera Cruz", "Garça", "Álvaro de Carvalho", "Alvinlândia",
    "Fernão", "Lupércio", "Ocauçu", "Oriente", "Oscar Bressane", "Pompéia",
    "Júlio Mesquita", "Queiroz", "Echaporã", "Assis", "Cândido Mota", "Maracaí",
    "Cruzália", "Paraguaçu Paulista", "Platina", "Tarumã", "Lutécia", "Borá",
    "Florínea", "Palmital", "Ibirarema", "Pedrinhas Paulista", "Quatá",
    "Rancharia", "João Ramalho", "Tupã", "Bastos", "Iacri", "Queiroz",
    "Rinópolis", "Parapuã", "Herculândia", "Quintana", "Arco-Íris",
    "Ourinhos", "Santa Cruz do Rio Pardo", "Chavantes", "Ipaussu", "Bernardino de Campos",
    "São Pedro do Turvo", "Espírito Santo do Turvo", "Óleo", "Salto Grande",
    "Canitar", "Timburi"
  ],
  Central: [
    "Araraquara", "São Carlos", "Matão", "Américo Brasiliense", "Santa Lúcia",
    "Rincão", "Motuca", "Gavião Peixoto", "Boa Esperança do Sul", "Ibitinga",
    "Tabatinga", "Nova Europa", "Dobrada", "Borborema", "Itápolis", "Ibaté",
    "Descalvado", "Porto Ferreira", "Santa Rita do Passa Quatro", "Ribeirão Bonito",
    "Trabiju", "Taquaritinga", "Cândido Rodrigues", "Santa Ernestina", "Monte Alto",
    "Novo Horizonte", "Sales", "Analândia"
  ],
  Barretos: [
    "Barretos", "Colina", "Guaíra", "Jaborandi", "Colômbia", "Olímpia",
    "Cajobi", "Severínia", "Guaraci", "Embaúba", "Altair", "Bebedouro",
    "Terra Roxa", "Viradouro", "Vista Alegre do Alto", "Taquaral", "Taiúva",
    "Miguelópolis", "Morro Agudo", "São Joaquim da Barra", "Ipuã", "Jardinópolis"
  ],
  Franca: [
    "Franca", "Batatais", "Ribeirão Corrente", "Cristais Paulista", "Jeriquara",
    "Pedregulho", "Rifaina", "Itirapuã", "Patrocínio Paulista", "Restinga",
    "Igarapava", "Aramina", "Buritizal", "Ituverava", "Guará", "São José da Bela Vista",
    "Nuporanga", "Orlândia", "Sales Oliveira", "Miguelópolis", "Ipuã",
    "Mococa", "Itobi", "Cássia dos Coqueiros"
  ]
};

const aliasNormalizadas: Record<string, string> = {
  // Abbreviations and spellings seen in the Sabesp export files (normalized form
  // on both sides: lowercase, no accents, separators collapsed to spaces).
  "sta cruz do r pardo": "santa cruz do rio pardo",
  "aguas de sta barbara": "aguas de santa barbara",
  embu: "embu das artes",
  "pirapora de bom jesus": "pirapora do bom jesus",
  "santana do parnaiba": "santana de parnaiba"
};

function norm(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const lookup = new Map<string, Regiao>();
for (const [regiao, municipios] of Object.entries(municipiosPorRegiao) as Array<[Regiao, string[]]>) {
  for (const municipio of municipios) {
    lookup.set(norm(municipio), regiao);
  }
}

/** Resolve a município name to its administrative region, or null if unknown. */
export function resolveRegiao(municipio: string | null | undefined): Regiao | null {
  if (!municipio) return null;
  const key = norm(municipio);
  if (!key) return null;
  const aliased = aliasNormalizadas[key] ?? key;
  return lookup.get(aliased) ?? null;
}

export type ArvoreRegioes = {
  estado: string;
  regioes: Array<{ regiao: Regiao; municipios: string[] }>;
};

/** State → Region → Município tree, used to drive the dashboard geo filter. */
export function arvoreRegioes(): ArvoreRegioes {
  return {
    estado: ESTADO,
    regioes: REGIOES_SP.map((regiao) => ({
      regiao,
      municipios: [...municipiosPorRegiao[regiao]].sort((a, b) => a.localeCompare(b, "pt-BR"))
    }))
  };
}
