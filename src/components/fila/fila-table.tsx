"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { StatusOS, TipoServico } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { FILTROS_VAZIOS, SEM_FISCAL, type FilaFiltros } from "@/lib/fila-filtros";
import { statusLabel, tipoServicoLabel } from "@/lib/os-labels";

export type FilaRow = {
  id: string;
  numero: string;
  endereco: string;
  tipoServico: string;
  status: StatusOS;
  poloId: string | null;
  poloNome: string | null;
  fiscalId: string | null;
  fiscalNome: string | null;
  dataProgramada: string | null;
};

export type FiscalOption = { id: string; name: string };
export type PoloOption = { id: string; nome: string };

const TIPOS: TipoServico[] = [
  "LigacaoAgua",
  "ReligacaoAgua",
  "CorteAgua",
  "TrocaHidrometro",
  "Vistoria",
  "ReparoRede",
  "Outros"
];
const STATUS: StatusOS[] = ["NaFila", "EmExecucao", "Pendente", "Concluida", "Cancelada"];

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
  polos,
  canAssign,
  canDelete,
  filtros,
  total,
  page,
  pageSize
}: {
  ordens: FilaRow[];
  fiscais: FiscalOption[];
  polos: PoloOption[];
  canAssign: boolean;
  canDelete: boolean;
  filtros: FilaFiltros;
  total: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loteFiscal, setLoteFiscal] = useState("");
  const [loteBusy, setLoteBusy] = useState(false);

  const showSelection = canAssign || canDelete;
  const allOnPageSelected = ordens.length > 0 && ordens.every((o) => selected.has(o.id));

  function toggleOne(id: string) {
    setSelected((atual) => {
      const next = new Set(atual);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAllOnPage() {
    setSelected((atual) => {
      const next = new Set(atual);
      if (allOnPageSelected) ordens.forEach((o) => next.delete(o.id));
      else ordens.forEach((o) => next.add(o.id));
      return next;
    });
  }

  async function acaoLote(url: string, body: unknown, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setLoteBusy(true);
    setError(null);
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    setLoteBusy(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? "Erro na operacao em lote.");
      return;
    }
    setSelected(new Set());
    setLoteFiscal("");
    router.refresh();
  }

  const selectedIds = [...selected];

  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
  const algumFiltroAtivo = Boolean(
    filtros.poloId || filtros.fiscalId || filtros.tipoServico || filtros.status || filtros.busca
  );

  // All filtering/pagination is server-side via the URL so the table never loads
  // the whole (potentially huge) queue into the browser.
  function navegar(next: Partial<FilaFiltros>, paginaDestino = 1) {
    const merged = { ...filtros, ...next };
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value) search.set(key, value);
    }
    if (paginaDestino > 1) search.set("page", String(paginaDestino));
    const qs = search.toString();
    router.push(qs ? `/fila?${qs}` : "/fila");
  }

  // Carrega os filtros ativos no export, respeitando o escopo do usuário no servidor.
  function exportHref(formato: "xlsx" | "csv" = "xlsx") {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(filtros)) {
      if (value) search.set(key, value);
    }
    if (formato !== "xlsx") search.set("formato", formato);
    const qs = search.toString();
    return qs ? `/api/ordens/exportar?${qs}` : "/api/ordens/exportar";
  }

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

      <Card className="flex flex-wrap items-end gap-3 p-4">
        <label className="flex flex-col gap-1 text-xs uppercase text-[hsl(var(--muted-foreground))]">
          Polo
          <Select
            className="h-9 w-44"
            value={filtros.poloId}
            onChange={(event) => navegar({ poloId: event.target.value })}
          >
            <option value="">Todos</option>
            {polos.map((polo) => (
              <option key={polo.id} value={polo.id}>
                {polo.nome}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase text-[hsl(var(--muted-foreground))]">
          Fiscal
          <Select
            className="h-9 w-44"
            value={filtros.fiscalId}
            onChange={(event) => navegar({ fiscalId: event.target.value })}
          >
            <option value="">Todos</option>
            <option value={SEM_FISCAL}>Sem fiscal</option>
            {fiscais.map((fiscal) => (
              <option key={fiscal.id} value={fiscal.id}>
                {fiscal.name}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase text-[hsl(var(--muted-foreground))]">
          Tipo de servico
          <Select
            className="h-9 w-48"
            value={filtros.tipoServico}
            onChange={(event) => navegar({ tipoServico: event.target.value })}
          >
            <option value="">Todos</option>
            {TIPOS.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipoServicoLabel(tipo)}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase text-[hsl(var(--muted-foreground))]">
          Status
          <Select
            className="h-9 w-44"
            value={filtros.status}
            onChange={(event) => navegar({ status: event.target.value })}
          >
            <option value="">Todos</option>
            {STATUS.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </Select>
        </label>

        {algumFiltroAtivo ? (
          <Button variant="outline" size="sm" onClick={() => navegar(FILTROS_VAZIOS)}>
            Limpar filtros
          </Button>
        ) : null}

        <Button asChild variant="outline" size="sm">
          <a href={exportHref()}>Exportar XLSX</a>
        </Button>
      </Card>

      {showSelection && (selected.size > 0 || canDelete) ? (
        <Card className="flex flex-wrap items-center gap-3 p-3 text-sm">
          <span className="font-medium">{selected.size} selecionada(s)</span>
          {canAssign ? (
            <div className="flex items-center gap-1">
              <Select
                aria-label="Fiscal para atribuicao em lote"
                className="h-9 w-44"
                value={loteFiscal}
                onChange={(event) => setLoteFiscal(event.target.value)}
              >
                <option value="">Atribuir a...</option>
                {fiscais.map((fiscal) => (
                  <option key={fiscal.id} value={fiscal.id}>
                    {fiscal.name}
                  </option>
                ))}
              </Select>
              <Button
                variant="outline"
                size="sm"
                disabled={loteBusy || selected.size === 0 || !loteFiscal}
                onClick={() =>
                  acaoLote("/api/ordens/atribuir-lote", { ordemIds: selectedIds, fiscalId: loteFiscal })
                }
              >
                Atribuir selecionadas
              </Button>
            </div>
          ) : null}
          {canDelete ? (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={loteBusy || selected.size === 0}
                onClick={() =>
                  acaoLote(
                    "/api/ordens/excluir-lote",
                    { ordemIds: selectedIds },
                    `Excluir definitivamente ${selected.size} OS selecionada(s)? Esta acao nao pode ser desfeita.`
                  )
                }
              >
                Excluir selecionadas
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={loteBusy || total === 0}
                onClick={() =>
                  acaoLote(
                    "/api/ordens/excluir-lote",
                    { todas: true, filtros },
                    `Excluir definitivamente TODAS as ${total} OS do filtro atual? Esta acao nao pode ser desfeita.`
                  )
                }
              >
                Excluir todas ({total})
              </Button>
            </>
          ) : null}
          {selected.size > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Limpar selecao
            </Button>
          ) : null}
        </Card>
      ) : null}

      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[hsl(var(--border))] text-xs uppercase text-[hsl(var(--muted-foreground))]">
            <tr>
              {showSelection ? (
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todas nesta pagina"
                    checked={allOnPageSelected}
                    onChange={toggleAllOnPage}
                  />
                </th>
              ) : null}
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
                <td
                  colSpan={showSelection ? 8 : 7}
                  className="px-4 py-8 text-center text-[hsl(var(--muted-foreground))]"
                >
                  {algumFiltroAtivo ? "Nenhuma OS para os filtros selecionados." : "Nenhuma OS na fila."}
                </td>
              </tr>
            ) : (
              ordens.map((ordem) => (
                <tr key={ordem.id} className="border-b border-[hsl(var(--border))] align-top last:border-0">
                  {showSelection ? (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Selecionar OS ${ordem.numero}`}
                        checked={selected.has(ordem.id)}
                        onChange={() => toggleOne(ordem.id)}
                      />
                    </td>
                  ) : null}
                  <td className="px-4 py-3 font-medium">{ordem.numero}</td>
                  <td className="px-4 py-3">{ordem.endereco}</td>
                  <td className="px-4 py-3">{tipoServicoLabel(ordem.tipoServico)}</td>
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

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[hsl(var(--muted-foreground))]">
        <span>{total === 0 ? "0 OS" : `${total} OS · pagina ${page} de ${totalPaginas}`}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => navegar({}, page - 1)}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPaginas}
            onClick={() => navegar({}, page + 1)}
          >
            Proxima
          </Button>
        </div>
      </div>
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
