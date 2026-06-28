"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { gruposFfr } from "@/data/grupos-ffr";
import { tipoServicoLabels } from "@/lib/os-labels";

type PeriodoTipo = "semanal" | "mensal" | "personalizado";

type Quebra = { chave: string; nome: string; quantidadeNC: number; totalAvaliado: number; mediaPercentual: number; iqes: number };
type Detalhe = {
  numeroOS: string;
  dataFimExecucao: string | null;
  municipio: string | null;
  polo: string | null;
  regiao: string | null;
  tipoServico: string;
  fiscalNome: string | null;
  criterio: string;
  descricaoNaoConformidade: string;
  observacao: string | null;
  conceito: string;
  percentual: number;
  contrato: string | null;
  codigoContrato: string | null;
  unidadeExecutante: string | null;
  status: string;
};
type ContratadaData = {
  periodo: { label: string };
  resumo: {
    kpis: { totalOS: number; inspecionadas: number; pendentes: number; naoAvaliada: number; atende: number; naoAtende: number; iqes: number };
    distribuicaoConceito: Record<string, number>;
  };
  rankingNaoConformidades: Array<{ itemId: string; criterio: string; quantidade: number }>;
  agrupamentoPorMunicipio: Quebra[];
  agrupamentoPorRegiao: Quebra[];
  agrupamentoPorTipoServico: Quebra[];
  detalhamento: { rows: Detalhe[]; total: number; page: number; pageSize: number };
  facets: { contratos: Array<{ codigo: string | null; descricao: string | null }>; unidades: string[] };
};

const tiposServico = Object.entries(tipoServicoLabels) as Array<[string, string]>;
const conceitos = ["A", "B", "C", "D", "NaoAvaliado"];
const criteriosFfr = (() => {
  const vistos = new Map<string, string>();
  for (const grupo of gruposFfr) {
    for (const item of grupo.itens) {
      if (item.peso > 0 && item.tipo !== "texto" && !vistos.has(item.id)) vistos.set(item.id, item.texto);
    }
  }
  return [...vistos.entries()];
})();

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function fmtData(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("pt-BR");
}

export function RelatorioContratadaView() {
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>("mensal");
  const [mes, setMes] = useState("");
  const [semana, setSemana] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [codigoContrato, setCodigoContrato] = useState("");
  const [contrato, setContrato] = useState("");
  const [unidadeExecutante, setUnidadeExecutante] = useState("");
  const [tipoServico, setTipoServico] = useState("");
  const [conceito, setConceito] = useState("");
  const [criterio, setCriterio] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<ContratadaData | null>(null);
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
    if (codigoContrato) qs.set("codigoContrato", codigoContrato);
    if (contrato) qs.set("contrato", contrato);
    if (unidadeExecutante) qs.set("unidadeExecutante", unidadeExecutante);
    if (tipoServico) qs.set("tipoServico", tipoServico);
    if (conceito) qs.set("conceito", conceito);
    if (criterio) qs.set("criterio", criterio);
    return qs.toString();
  }, [periodoTipo, mes, semana, from, to, codigoContrato, contrato, unidadeExecutante, tipoServico, conceito, criterio]);

  const buscar = useCallback(
    async (pagina: number) => {
      setCarregando(true);
      setErro(null);
      try {
        const resp = await fetch(`/api/relatorios/contratadas?${querystring}&page=${pagina}&pageSize=20`);
        if (!resp.ok) {
          const corpo = await resp.json().catch(() => ({}));
          throw new Error(corpo.error ?? `Erro ${resp.status}`);
        }
        const corpo = await resp.json();
        setData(corpo.data as ContratadaData);
        setPage(pagina);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao gerar relatorio");
        setData(null);
      } finally {
        setCarregando(false);
      }
    },
    [querystring]
  );

  // Carrega facets/contratos uma vez ao montar (sem filtros), para popular os datalists.
  useEffect(() => {
    void buscar(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPaginas = data ? Math.max(1, Math.ceil(data.detalhamento.total / data.detalhamento.pageSize)) : 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nao Conformidades por Contratada</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-periodo">Periodo</Label>
            <Select id="c-periodo" value={periodoTipo} onChange={(e) => setPeriodoTipo(e.target.value as PeriodoTipo)} className="w-40">
              <option value="mensal">Mensal</option>
              <option value="semanal">Semanal</option>
              <option value="personalizado">Personalizado</option>
            </Select>
          </div>
          {periodoTipo === "mensal" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-mes">Mes</Label>
              <Input id="c-mes" type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="w-40" />
            </div>
          )}
          {periodoTipo === "semanal" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-semana">Semana (ISO)</Label>
              <Input id="c-semana" type="week" value={semana} onChange={(e) => setSemana(e.target.value)} className="w-40" />
            </div>
          )}
          {periodoTipo === "personalizado" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="c-from">De</Label>
                <Input id="c-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="c-to">Ate</Label>
                <Input id="c-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
              </div>
            </>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-codigo">Contrato (codigo)</Label>
            <Input id="c-codigo" list="facet-contratos" value={codigoContrato} onChange={(e) => setCodigoContrato(e.target.value)} className="w-44" placeholder="Todos" />
            <datalist id="facet-contratos">
              {data?.facets.contratos.map((c) => (c.codigo ? <option key={c.codigo} value={c.codigo}>{c.descricao ?? c.codigo}</option> : null))}
            </datalist>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-unidade">Unidade executante</Label>
            <Input id="c-unidade" list="facet-unidades" value={unidadeExecutante} onChange={(e) => setUnidadeExecutante(e.target.value)} className="w-48" placeholder="Todas" />
            <datalist id="facet-unidades">
              {data?.facets.unidades.map((u) => <option key={u} value={u} />)}
            </datalist>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-tipo">Tipo de servico</Label>
            <Select id="c-tipo" value={tipoServico} onChange={(e) => setTipoServico(e.target.value)} className="w-52">
              <option value="">Todos</option>
              {tiposServico.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-conceito">Conceito</Label>
            <Select id="c-conceito" value={conceito} onChange={(e) => setConceito(e.target.value)} className="w-36">
              <option value="">Todos</option>
              {conceitos.map((c) => <option key={c} value={c}>{c === "NaoAvaliado" ? "Nao avaliado" : c}</option>)}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-criterio">Criterio NC</Label>
            <Select id="c-criterio" value={criterio} onChange={(e) => setCriterio(e.target.value)} className="w-64">
              <option value="">Todos</option>
              {criteriosFfr.map(([id, texto]) => <option key={id} value={id}>{texto}</option>)}
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => buscar(1)} disabled={carregando}>{carregando ? "Gerando..." : "Gerar"}</Button>
          <Button asChild variant="outline">
            <a href={`/api/relatorios/export/excel?${querystring}`}>Exportar Excel</a>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/relatorios/export/pdf?${querystring}`}>Exportar PDF</a>
          </Button>
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        {data && (
          <div className="flex flex-col gap-6 border-t border-[hsl(var(--border))] pt-5">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Periodo: {data.periodo.label}</p>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-7">
              {([
                ["Total OS", data.resumo.kpis.totalOS],
                ["Inspecionadas", data.resumo.kpis.inspecionadas],
                ["Com NC", data.rankingNaoConformidades.length],
                ["Nao Avaliada", data.resumo.kpis.naoAvaliada],
                ["Atende", data.resumo.kpis.atende],
                ["Nao Atende", data.resumo.kpis.naoAtende],
                ["IQES", pct(data.resumo.kpis.iqes)]
              ] as Array<[string, string | number]>).map(([rotulo, valor]) => (
                <div key={rotulo} className="rounded-md border border-[hsl(var(--border))] p-3">
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{rotulo}</p>
                  <p className="text-xl font-semibold">{valor}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Distribuicao por conceito</p>
              <div className="flex flex-wrap gap-3 text-sm">
                {conceitos.map((c) => (
                  <span key={c} className="rounded-md border border-[hsl(var(--border))] px-3 py-1">
                    {c === "NaoAvaliado" ? "Nao avaliado" : c}: <strong>{data.resumo.distribuicaoConceito[c] ?? 0}</strong>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Principais nao conformidades</p>
              {data.rankingNaoConformidades.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Nenhuma nao conformidade no periodo.</p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {data.rankingNaoConformidades.map((nc) => (
                    <li key={nc.itemId} className="flex justify-between gap-3">
                      <span className="truncate">{nc.criterio}</span>
                      <span className="tabular-nums font-medium">{nc.quantidade}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-2 overflow-x-auto">
              <p className="text-sm font-semibold">Detalhamento ({data.detalhamento.total} nao conformidades)</p>
              <table className="w-full min-w-[1100px] text-left text-xs">
                <thead className="border-y border-[hsl(var(--border))] uppercase text-[hsl(var(--muted-foreground))]">
                  <tr>
                    {["No OS", "Fim exec", "Municipio", "Polo", "Regiao", "Tipo", "Fiscal", "Criterio", "Descricao NC", "Conceito", "% FFR", "Status", "Contrato", "Unidade"].map((h) => (
                      <th key={h} className="px-2 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.detalhamento.rows.length === 0 ? (
                    <tr><td colSpan={14} className="px-2 py-6 text-center text-[hsl(var(--muted-foreground))]">Sem nao conformidades.</td></tr>
                  ) : (
                    data.detalhamento.rows.map((d, i) => (
                      <tr key={`${d.numeroOS}-${i}`} className="border-b border-[hsl(var(--border))] last:border-0">
                        <td className="px-2 py-2">{d.numeroOS}</td>
                        <td className="px-2 py-2">{fmtData(d.dataFimExecucao)}</td>
                        <td className="px-2 py-2">{d.municipio ?? "-"}</td>
                        <td className="px-2 py-2">{d.polo ?? "-"}</td>
                        <td className="px-2 py-2">{d.regiao ?? "-"}</td>
                        <td className="px-2 py-2">{tipoServicoLabels[d.tipoServico as keyof typeof tipoServicoLabels] ?? d.tipoServico}</td>
                        <td className="px-2 py-2">{d.fiscalNome ?? "-"}</td>
                        <td className="px-2 py-2 max-w-[260px] truncate" title={d.criterio}>{d.criterio}</td>
                        <td className="px-2 py-2 max-w-[300px] truncate" title={d.descricaoNaoConformidade}>{d.descricaoNaoConformidade}</td>
                        <td className="px-2 py-2">{d.conceito}</td>
                        <td className="px-2 py-2">{pct(d.percentual)}</td>
                        <td className="px-2 py-2">{d.status}</td>
                        <td className="px-2 py-2">{d.contrato ?? "-"}</td>
                        <td className="px-2 py-2">{d.unidadeExecutante ?? "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="flex items-center gap-3 text-sm">
                <Button variant="outline" size="sm" disabled={page <= 1 || carregando} onClick={() => buscar(page - 1)}>Anterior</Button>
                <span>Pagina {data.detalhamento.page} de {totalPaginas}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPaginas || carregando} onClick={() => buscar(page + 1)}>Proxima</Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
