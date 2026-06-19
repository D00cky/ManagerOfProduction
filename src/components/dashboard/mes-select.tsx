"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";

type MesOption = { value: string; label: string };

type MesSelectProps = {
  opcoes: MesOption[];
  selecionado: string;
};

export function MesSelect({ opcoes, selecionado }: MesSelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onSelect(mes: string) {
    const params = new URLSearchParams(searchParams.toString());
    // O mês é resolvido em from/to no servidor; limpamos qualquer janela manual.
    params.delete("from");
    params.delete("to");
    if (mes) params.set("mes", mes);
    else params.delete("mes");
    params.delete("page");
    const query = params.toString();
    router.push(query ? `?${query}` : "?");
  }

  return (
    <Select
      aria-label="Mês"
      value={selecionado}
      onChange={(event) => onSelect(event.target.value)}
      className="h-8 w-auto py-0 text-sm"
    >
      <option value="">Mês</option>
      {opcoes.map((opcao) => (
        <option key={opcao.value} value={opcao.value}>
          {opcao.label}
        </option>
      ))}
    </Select>
  );
}
