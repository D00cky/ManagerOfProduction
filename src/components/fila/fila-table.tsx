"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { StatusOS } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";

export type FilaRow = {
  id: string;
  numero: string;
  endereco: string;
  tipoServico: string;
  status: StatusOS;
  fiscalId: string | null;
  fiscalNome: string | null;
  dataProgramada: string | null;
};

export type FiscalOption = { id: string; name: string };

const transitions: Record<StatusOS, { label: string; to: StatusOS }[]> = {
  NaFila: [
    { label: "Iniciar", to: "EmExecucao" },
    { label: "Cancelar", to: "Cancelada" }
  ],
  EmExecucao: [
    { label: "Pendenciar", to: "Pendente" },
    { label: "Concluir", to: "Concluida" },
    { label: "Cancelar", to: "Cancelada" }
  ],
  Pendente: [
    { label: "Retomar", to: "EmExecucao" },
    { label: "Concluir", to: "Concluida" },
    { label: "Cancelar", to: "Cancelada" }
  ],
  Concluida: [],
  Cancelada: []
};

export function FilaTable({
  ordens,
  fiscais,
  canAssign
}: {
  ordens: FilaRow[];
  fiscais: FiscalOption[];
  canAssign: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function mutate(url: string, method: string, body: unknown, id: string) {
    setBusyId(id);
    setError(null);
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    setBusyId(null);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? "Erro na operacao.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[hsl(var(--border))] text-xs uppercase text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3">Numero</th>
              <th className="px-4 py-3">Endereco</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Fiscal</th>
              <th className="px-4 py-3">Programada</th>
              <th className="px-4 py-3">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {ordens.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[hsl(var(--muted-foreground))]">
                  Nenhuma OS na fila.
                </td>
              </tr>
            ) : (
              ordens.map((ordem) => (
                <tr key={ordem.id} className="border-b border-[hsl(var(--border))] align-top last:border-0">
                  <td className="px-4 py-3 font-medium">{ordem.numero}</td>
                  <td className="px-4 py-3">{ordem.endereco}</td>
                  <td className="px-4 py-3">{ordem.tipoServico}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={ordem.status} />
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {ordem.fiscalNome ?? (ordem.fiscalId ? "Atribuida" : "Sem fiscal")}
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">{ordem.dataProgramada ?? "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/tabulacao/${ordem.id}`}>Tabular</Link>
                      </Button>
                      {transitions[ordem.status].map((action) => (
                        <Button
                          key={action.to}
                          variant="outline"
                          size="sm"
                          disabled={busyId === ordem.id}
                          onClick={() => mutate(`/api/ordens/${ordem.id}`, "PATCH", { status: action.to }, ordem.id)}
                        >
                          {action.label}
                        </Button>
                      ))}
                      {canAssign && ordem.status !== "Concluida" && ordem.status !== "Cancelada" ? (
                        <AssignControl
                          ordemId={ordem.id}
                          fiscais={fiscais}
                          currentFiscalId={ordem.fiscalId}
                          busy={busyId === ordem.id}
                          onAssign={(fiscalId) =>
                            mutate(`/api/ordens/${ordem.id}/atribuir`, "POST", { fiscalId }, ordem.id)
                          }
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function AssignControl({
  ordemId,
  fiscais,
  currentFiscalId,
  busy,
  onAssign
}: {
  ordemId: string;
  fiscais: FiscalOption[];
  currentFiscalId: string | null;
  busy: boolean;
  onAssign: (fiscalId: string) => void;
}) {
  const [selected, setSelected] = useState(currentFiscalId ?? "");

  return (
    <div className="flex items-center gap-1">
      <Select
        aria-label={`Fiscal para OS ${ordemId}`}
        className="h-9 w-40"
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
      >
        <option value="">Selecionar fiscal</option>
        {fiscais.map((fiscal) => (
          <option key={fiscal.id} value={fiscal.id}>
            {fiscal.name}
          </option>
        ))}
      </Select>
      <Button variant="outline" size="sm" disabled={busy || !selected} onClick={() => onAssign(selected)}>
        Atribuir
      </Button>
    </div>
  );
}
