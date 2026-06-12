"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Perfil, StatusOS, TipoServico } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { chaveObsNaoConforme, gruposParaOrdem, type ValorResposta } from "@/data/grupos-ffr";
import { calcularConceito, type RespostasFfr } from "@/lib/ffr";
import { cn, formatPercent } from "@/lib/utils";

const opcoes: { value: ValorResposta; label: string }[] = [
  { value: "1", label: "Conforme" },
  { value: "0", label: "Nao conforme" },
  { value: "X", label: "N/A" }
];

const conceitoStyles: Record<string, string> = {
  A: "bg-green-100 text-green-700",
  B: "bg-blue-100 text-blue-700",
  C: "bg-amber-100 text-amber-700",
  D: "bg-red-100 text-red-700",
  NaoAvaliado: "bg-slate-100 text-slate-600"
};

type AlteracaoInfo = { por: string | null; motivo: string; em: string | null };

export function TabulacaoForm({
  ordemId,
  tipoServico,
  descricaoTss,
  status,
  respostasIniciais,
  observacoesIniciais,
  currentUserId,
  perfil,
  jaTabulada,
  tabuladoPorId,
  tabuladoPorLabel,
  alteracao
}: {
  ordemId: string;
  tipoServico: TipoServico;
  descricaoTss: string | null;
  status: StatusOS;
  respostasIniciais: RespostasFfr;
  observacoesIniciais: string;
  currentUserId: string;
  perfil: Perfil;
  jaTabulada: boolean;
  tabuladoPorId: string | null;
  tabuladoPorLabel: string | null;
  alteracao: AlteracaoInfo | null;
}) {
  const router = useRouter();
  const grupos = useMemo(
    () => gruposParaOrdem({ tipoServico, descricaoTss }),
    [tipoServico, descricaoTss]
  );
  const [respostas, setRespostas] = useState<RespostasFfr>(respostasIniciais);
  const [observacoes, setObservacoes] = useState(observacoesIniciais);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [concluindo, setConcluindo] = useState(false);

  const bloqueada = status === "Concluida" || status === "Cancelada";
  // Editar uma tabulação criada por outra pessoa é uma "alteração": exige motivo
  // e só monitor/supervisor podem fazê-la (regra reforçada também no servidor).
  const ehAlteracao = jaTabulada && tabuladoPorId !== null && tabuladoPorId !== currentUserId;
  const resultado = useMemo(
    () => calcularConceito({ tipoServico, descricaoTss }, respostas),
    [tipoServico, descricaoTss, respostas]
  );

  function setResposta(itemId: string, value: ValorResposta) {
    setSaved(false);
    setRespostas((current) => ({ ...current, [itemId]: value }));
  }

  /** @returns false if the user cancelled the required reason prompt. */
  function pedirMotivo(): string | undefined | false {
    if (!ehAlteracao) return undefined;
    const motivo = window.prompt("Motivo da alteracao desta tabulacao:");
    if (motivo === null) return false; // cancelou
    if (motivo.trim().length === 0) {
      setError("Informe o motivo da alteracao.");
      return false;
    }
    return motivo.trim();
  }

  async function salvar(motivoAlteracao?: string): Promise<boolean> {
    const response = await fetch(`/api/ordens/${ordemId}/tabulacao`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        respostas,
        observacoes: observacoes.trim() || undefined,
        motivoAlteracao
      })
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Erro ao salvar tabulacao.");
      return false;
    }
    return true;
  }

  async function handleSave() {
    setError(null);
    setSaved(false);
    const motivo = pedirMotivo();
    if (motivo === false) return;
    setSaving(true);
    const ok = await salvar(motivo || undefined);
    setSaving(false);
    if (!ok) return;
    setSaved(true);
    router.refresh();
  }

  async function handleConcluir() {
    setError(null);
    setSaved(false);
    if (!window.confirm("Concluir esta OS? A tabulacao sera finalizada e nao podera mais ser editada.")) {
      return;
    }
    const motivo = pedirMotivo();
    if (motivo === false) return;
    setConcluindo(true);
    // Conclusão exige tabulação salva (canTransitionStatus): salva antes de concluir.
    const ok = await salvar(motivo || undefined);
    if (!ok) {
      setConcluindo(false);
      return;
    }
    const response = await fetch(`/api/ordens/${ordemId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "Concluida" })
    });
    setConcluindo(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Erro ao concluir OS.");
      return;
    }
    // Volta para a fila / próxima OS do fiscal.
    router.push("/fila");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-3">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">Conceito</span>
            <Badge className={cn("text-sm", conceitoStyles[resultado.conceito])}>{resultado.conceito}</Badge>
          </div>
          <div className="text-sm text-[hsl(var(--muted-foreground))]">
            {resultado.somaObtida}/{resultado.somaPossivel} pontos &middot; {formatPercent(resultado.percentual)}
          </div>
        </CardContent>
      </Card>

      {bloqueada ? (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          OS {status === "Concluida" ? "concluida" : "cancelada"} — tabulacao bloqueada para edicao.
        </p>
      ) : null}

      {tabuladoPorLabel || alteracao ? (
        <Card>
          <CardContent className="flex flex-col gap-1 p-4 text-sm">
            {tabuladoPorLabel ? (
              <p>
                <span className="text-[hsl(var(--muted-foreground))]">Tabulado por: </span>
                <span className="font-medium">{tabuladoPorLabel}</span>
              </p>
            ) : null}
            {alteracao ? (
              <p className="text-amber-700">
                Alterada por {alteracao.por ?? "—"}
                {alteracao.em ? ` em ${alteracao.em}` : ""} — motivo: {alteracao.motivo || "—"}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {grupos.map((grupo) => (
        <Card key={grupo.id}>
          <CardHeader>
            <CardTitle>{grupo.nome}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-6 gap-y-4 md:grid-cols-2">
            {grupo.itens.map((item) => (
              <div key={item.id} className="flex flex-col gap-2">
                <p className="text-sm">
                  {item.texto}
                  {item.tipo !== "texto" && item.peso > 0 ? (
                    <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">peso {item.peso}</span>
                  ) : null}
                </p>
                {item.tipo === "texto" ? (
                  <Textarea
                    className="max-w-xl"
                    rows={2}
                    value={(respostas[item.id] as string) ?? ""}
                    onChange={(event) => setResposta(item.id, event.target.value)}
                    disabled={bloqueada}
                  />
                ) : (
                  <>
                    <div className="flex gap-2">
                      {opcoes.map((opcao) => (
                        <Button
                          key={opcao.value}
                          type="button"
                          size="sm"
                          variant={respostas[item.id] === opcao.value ? "default" : "outline"}
                          disabled={bloqueada}
                          onClick={() => setResposta(item.id, opcao.value)}
                        >
                          {opcao.label}
                        </Button>
                      ))}
                    </div>
                    {respostas[item.id] === "0" ? (
                      <Textarea
                        className="max-w-xl"
                        rows={2}
                        placeholder="Observacao da nao conformidade"
                        aria-label={`Observacao Nao conforme: ${item.texto}`}
                        value={(respostas[chaveObsNaoConforme(item.id)] as string) ?? ""}
                        onChange={(event) => setResposta(chaveObsNaoConforme(item.id), event.target.value)}
                        disabled={bloqueada}
                      />
                    ) : null}
                  </>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Observacoes gerais</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="observacoes">Observacoes</Label>
            <Textarea
              id="observacoes"
              className="max-w-2xl"
              rows={3}
              value={observacoes}
              onChange={(event) => setObservacoes(event.target.value)}
              disabled={bloqueada}
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {saved ? <p className="text-sm text-green-600">Tabulacao salva.</p> : null}

          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={handleSave} disabled={saving || concluindo || bloqueada}>
              {saving ? "Salvando..." : "Salvar tabulacao"}
            </Button>
            <Button
              type="button"
              variant="default"
              className="bg-green-600 hover:bg-green-700"
              onClick={handleConcluir}
              disabled={saving || concluindo || bloqueada}
            >
              {concluindo ? "Concluindo..." : "Salvar e concluir OS"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
