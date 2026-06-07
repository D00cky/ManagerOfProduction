import { describe, expect, it, vi } from "vitest";
import type { OrdemServico, Tabulacao } from "@prisma/client";
import { saveTabulacao, type TabulacaoRepository } from "@/server/tabulacao-service";

function os(overrides: Partial<OrdemServico> = {}): OrdemServico {
  const now = new Date("2026-06-07T10:00:00.000Z");
  return {
    id: "os1",
    numero: "1001",
    enderecoCompleto: "Rua A, 10",
    bairro: null,
    cidade: null,
    tipoServico: "LigacaoAgua",
    status: "EmExecucao",
    poloId: "p1",
    fiscalId: "f1",
    observacao: null,
    dataProgramada: null,
    iniciadaEm: now,
    concluidaEm: null,
    canceladaEm: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function tabulacao(overrides: Partial<Tabulacao> = {}): Tabulacao {
  const now = new Date("2026-06-07T10:00:00.000Z");
  return {
    id: "tab1",
    ordemServicoId: "os1",
    fiscalId: "f1",
    respostas: {},
    somaObtida: 0,
    somaPossivel: 0,
    percentual: 0,
    conceito: "NaoAvaliado",
    observacoes: null,
    bloqueada: false,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function repo(record: OrdemServico): TabulacaoRepository {
  return {
    findOrdemById: vi.fn(async () => record),
    upsertTabulacao: vi.fn(async (_input) => tabulacao(_input)),
    log: vi.fn(async () => undefined)
  };
}

describe("saveTabulacao", () => {
  it("calculates and persists the FFR result for the OS service type", async () => {
    const repository = repo(os());

    const result = await saveTabulacao(repository, { id: "f1", perfil: "fiscal", poloId: "p1" }, {
      ordemServicoId: "os1",
      respostas: {
        gerais_identificacao: "1",
        gerais_epi: "1",
        ligacao_ramal: "0",
        ligacao_cavalete: "1",
        qualidade_prazo: "1"
      },
      observacoes: "ok"
    });

    expect(repository.upsertTabulacao).toHaveBeenCalledWith(expect.objectContaining({
      ordemServicoId: "os1",
      fiscalId: "f1",
      somaObtida: 5,
      somaPossivel: 7,
      conceito: "C",
      observacoes: "ok"
    }));
    expect(result.percentual).toBeCloseTo(5 / 7);
  });

  it("blocks tabulation for OS outside the requester scope", async () => {
    const repository = repo(os({ fiscalId: "other" }));

    await expect(saveTabulacao(repository, { id: "f1", perfil: "fiscal", poloId: "p1" }, {
      ordemServicoId: "os1",
      respostas: {}
    })).rejects.toThrow("OS fora do escopo do usuario");
  });

  it("blocks editing tabulation after OS is completed", async () => {
    const repository = repo(os({ status: "Concluida" }));

    await expect(saveTabulacao(repository, { id: "f1", perfil: "fiscal", poloId: "p1" }, {
      ordemServicoId: "os1",
      respostas: {}
    })).rejects.toThrow("Tabulacao bloqueada para OS concluida");
  });

  it("logs tabulation changes", async () => {
    const repository = repo(os());

    await saveTabulacao(repository, { id: "f1", perfil: "fiscal", poloId: "p1" }, {
      ordemServicoId: "os1",
      respostas: { gerais_identificacao: "1" }
    });

    expect(repository.log).toHaveBeenCalledWith({
      evento: "tabulacao",
      descricao: "Tabulacao salva para OS 1001",
      userId: "f1",
      ordemServicoId: "os1",
      metadata: expect.objectContaining({ conceito: expect.any(String) })
    });
  });
});
