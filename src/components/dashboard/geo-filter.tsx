"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type OpcaoRegiao = { regiao: string; municipios: string[] };

type GeoFilterProps = {
  estado: string;
  opcoes: OpcaoRegiao[];
  regiao?: string;
  municipio?: string;
};

export function GeoFilter({ estado, opcoes, regiao, municipio }: GeoFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const regiaoAtual = opcoes.find((opcao) => opcao.regiao === regiao);
  const municipiosDisponiveis = regiaoAtual?.municipios ?? [];

  function updateParams(next: { regiao?: string; municipio?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
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
          onChange={(event) => updateParams({ regiao: event.target.value, municipio: undefined })}
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
        <Label htmlFor="municipio">Município</Label>
        <Select
          id="municipio"
          value={municipio ?? ""}
          disabled={!regiaoAtual}
          onChange={(event) => updateParams({ regiao, municipio: event.target.value })}
          className="min-w-56"
        >
          <option value="">{regiaoAtual ? "Todos os municípios" : "Selecione uma região"}</option>
          {municipiosDisponiveis.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
        </Select>
      </div>

      {regiao || municipio ? (
        <button
          type="button"
          onClick={() => updateParams({ regiao: undefined, municipio: undefined })}
          className="h-10 text-sm text-[hsl(var(--muted-foreground))] underline-offset-4 hover:underline"
        >
          Limpar filtro
        </button>
      ) : null}
    </div>
  );
}
