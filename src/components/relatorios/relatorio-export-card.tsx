"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { tipoServicoLabels } from "@/lib/os-labels";
import type { RelatorioExportDataset } from "@/server/relatorio-export-service";

type PeriodoTipo = "semanal" | "mensal" | "personalizado";

const tiposServico = Object.entries(tipoServicoLabels) as Array<[string, string]>;

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

const CORES_SITUACAO: Record<string, string> = {
  Atende: "#228b54",
  "Não Atende": "#c83c37",
  "Não Avaliada": "#969696"
};

export function RelatorioExportCard() {
  const searchParams = useSearchParams();
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>("mensal");
  const [mes, setMes] = useState("");
  const [semana, setSemana] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tipoServico, setTipoServico] = useState("");

  const [dataset, setDataset] = useState<RelatorioExportDataset | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const querystring = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("periodoTipo", periodoTipo);
    if (periodoTipo === "mensal" && mes) qs.set("mes", mes);
    if (periodoTipo === "semanal" && semana) qs.set("semana", semana);
    if (periodoTipo === "personalizado") {
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
    }
    if (tipoServico) qs.set("tipoServico", tipoServico);
    // Reaproveita os filtros geográficos definidos no GeoFilter (URL).
    for (const chave of ["regiao", "polo", "municipio"]) {
      const valor = searchParams.get(chave);
      if (valor) qs.set(chave, valor);
    }
    return qs.toString();
  }, [periodoTipo, mes, semana, from, to, tipoServico, searchParams]);

  const gerarPrevia = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resp = await fetch(`/api/relatorios/export/preview?${querystring}`);
      if (!resp.ok) {
        const corpo = await resp.json().catch(() => ({}));
        throw new Error(corpo.error ?? `Erro ${resp.status}`);
      }
      const corpo = await resp.json();
      setDataset(corpo.data as RelatorioExportDataset);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao gerar previa");
      setDataset(null);
    } finally {
      setCarregando(false);
    }
  }, [querystring]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exportacao de Relatorio</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="periodoTipo">Periodo</Label>
            <Select
              id="periodoTipo"
              value={periodoTipo}
              onChange={(e) => setPeriodoTipo(e.target.value as PeriodoTipo)}
              className="w-44"
            >
              <option value="mensal">Mensal</option>
              <option value="semanal">Semanal</option>
              <option value="personalizado">Personalizado</option>
            </Select>
          </div>

          {periodoTipo === "mensal" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mes">Mes</Label>
              <Input id="mes" type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="w-44" />
            </div>
          )}

          {periodoTipo === "semanal" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="semana">Semana (ISO)</Label>
              <Input id="semana" type="week" value={semana} onChange={(e) => setSemana(e.target.value)} className="w-44" />
            </div>
          )}

          {periodoTipo === "personalizado" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="from">De</Label>
                <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="to">Ate</Label>
                <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
              </div>
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tipoServico">Tipo de servico</Label>
            <Select
              id="tipoServico"
              value={tipoServico}
              onChange={(e) => setTipoServico(e.target.value)}
              className="w-56"
            >
              <option value="">Todos</option>
              {tiposServico.map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={gerarPrevia} disabled={carregando}>
            {carregando ? "Gerando..." : "Gerar previa"}
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/relatorios/export/pdf?${querystring}`}>Exportar PDF</a>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/relatorios/export/excel?${querystring}`}>Exportar Excel</a>
          </Button>
        </div>

        {erro && <p className="text-sm text-[hsl(var(--destructive,0_72%_51%))] text-red-600">{erro}</p>}

        {dataset && <Previa dataset={dataset} />}
      </CardContent>
    </Card>
  );
}

function Previa({ dataset }: { dataset: RelatorioExportDataset }) {
  const k = dataset.kpis;
  const cards: Array<[string, string]> = [
    ["Total OS", String(k.totalOS)],
    ["Inspecionadas", String(k.inspecionadas)],
    ["Pendentes", String(k.pendentes)],
    ["Nao Avaliada", String(k.naoAvaliada)],
    ["Atende", String(k.atende)],
    ["Nao Atende", String(k.naoAtende)],
    ["IQES", pct(k.iqes)]
  ];
  const totalSit = dataset.situacaoInspecoes.reduce((s, i) => s + i.quantidade, 0);
  const maxNC = dataset.principaisNaoConformidades.reduce((m, n) => Math.max(m, n.quantidade), 0);

  return (
    <div className="flex flex-col gap-6 border-t border-[hsl(var(--border))] pt-5">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">Periodo: {dataset.periodo.label}</p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-7">
        {cards.map(([rotulo, valor]) => (
          <div key={rotulo} className="rounded-md border border-[hsl(var(--border))] p-3">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{rotulo}</p>
            <p className="text-xl font-semibold">{valor}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Situacao das Inspecoes</p>
        <div className="flex h-5 w-full overflow-hidden rounded-md">
          {totalSit > 0 ? (
            dataset.situacaoInspecoes.map((item) =>
              item.quantidade > 0 ? (
                <div
                  key={item.nome}
                  style={{
                    width: `${(item.quantidade / totalSit) * 100}%`,
                    backgroundColor: CORES_SITUACAO[item.nome]
                  }}
                  title={`${item.nome}: ${item.quantidade}`}
                />
              ) : null
            )
          ) : (
            <div className="w-full bg-[hsl(var(--muted))]" />
          )}
        </div>
        <div className="flex flex-wrap gap-4 text-xs">
          {dataset.situacaoInspecoes.map((item) => (
            <span key={item.nome} className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: CORES_SITUACAO[item.nome] }} />
              {item.nome}: {item.quantidade} ({pct(item.percentual)})
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Principais Nao Conformidades</p>
        {dataset.principaisNaoConformidades.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Nenhuma nao conformidade no periodo.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {dataset.principaisNaoConformidades.map((nc) => (
              <div key={nc.itemId} className="flex items-center gap-2 text-xs">
                <span className="w-1/2 truncate" title={nc.criterio}>
                  {nc.criterio}
                </span>
                <div className="flex-1">
                  <div
                    className="h-4 rounded-sm bg-[hsl(var(--primary))]"
                    style={{ width: maxNC > 0 ? `${(nc.quantidade / maxNC) * 100}%` : "0%" }}
                  />
                </div>
                <span className="w-10 text-right tabular-nums">{nc.quantidade}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
