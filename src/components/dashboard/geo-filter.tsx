"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type OpcaoPolo = { id: string; nome: string; municipios: string[] };
type OpcaoRegiao = { regiao: string; polos: OpcaoPolo[] };

type GeoFilterProps = {
  estado: string;
  opcoes: OpcaoRegiao[];
  regiao?: string;
  polo?: string;
  municipio?: string;
};

export function GeoFilter({ estado, opcoes, regiao, polo, municipio }: GeoFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const regiaoAtual = opcoes.find((opcao) => opcao.regiao === regiao);
  const polosDisponiveis = regiaoAtual?.polos ?? [];
  const poloAtual = polosDisponiveis.find((opcao) => opcao.id === polo);
  const municipiosDisponiveis = poloAtual?.municipios ?? [];

  function updateParams(next: { regiao?: string; polo?: string; municipio?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    // Any geo change resets the backlog detail pagination.
    params.delete("page");
    const query = params.toString();
    router.push(query ? `?${query}` : "?");
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="regiao">Região ({estado})</Label>
        <Select
          id="regiao"
          value={regiao ?? ""}
          onChange={(event) =>
            updateParams({ regiao: event.target.value, polo: undefined, municipio: undefined })
          }
          className="min-w-56"
        >
          <option value="">Todas as regiões</option>
          {opcoes.map((opcao) => (
            <option key={opcao.regiao} value={opcao.regiao}>
              {opcao.regiao}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="polo">Polo</Label>
        <Select
          id="polo"
          value={polo ?? ""}
          disabled={!regiaoAtual}
          onChange={(event) => updateParams({ regiao, polo: event.target.value, municipio: undefined })}
          className="min-w-56"
        >
          <option value="">{regiaoAtual ? "Todos os polos" : "Selecione uma região"}</option>
          {polosDisponiveis.map((opcao) => (
            <option key={opcao.id} value={opcao.id}>
              {opcao.nome}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="municipio">Município</Label>
        <Select
          id="municipio"
          value={municipio ?? ""}
          disabled={!poloAtual}
          onChange={(event) => updateParams({ regiao, polo, municipio: event.target.value })}
          className="min-w-56"
        >
          <option value="">{poloAtual ? "Todos os municípios" : "Selecione um polo"}</option>
          {municipiosDisponiveis.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
        </Select>
      </div>

      {regiao || polo || municipio ? (
        <button
          type="button"
          onClick={() => updateParams({ regiao: undefined, polo: undefined, municipio: undefined })}
          className="h-10 text-sm text-[hsl(var(--muted-foreground))] underline-offset-4 hover:underline"
        >
          Limpar filtro
        </button>
      ) : null}
    </div>
  );
}
