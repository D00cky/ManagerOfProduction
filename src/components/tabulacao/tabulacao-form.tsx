"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { StatusOS, TipoServico } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { gruposParaOrdem, type ValorResposta } from "@/data/grupos-ffr";
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

export function TabulacaoForm({
  ordemId,
  tipoServico,
  descricaoTss,
  descricaoTse,
  status,
  respostasIniciais,
  observacoesIniciais
}: {
  ordemId: string;
  tipoServico: TipoServico;
  descricaoTss: string | null;
  descricaoTse: string | null;
  status: StatusOS;
  respostasIniciais: RespostasFfr;
  observacoesIniciais: string;
}) {
  const router = useRouter();
  const grupos = useMemo(
    () => gruposParaOrdem({ tipoServico, descricaoTss, descricaoTse }),
    [tipoServico, descricaoTss, descricaoTse]
  );
  const [respostas, setRespostas] = useState<RespostasFfr>(respostasIniciais);
  const [observacoes, setObservacoes] = useState(observacoesIniciais);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [concluindo, setConcluindo] = useState(false);

  const bloqueada = status === "Concluida" || status === "Cancelada";
  const resultado = useMemo(
    () => calcularConceito({ tipoServico, descricaoTss, descricaoTse }, respostas),
    [tipoServico, descricaoTss, descricaoTse, respostas]
  );

  function setResposta(itemId: string, value: ValorResposta) {
    setSaved(false);
    setRespostas((current) => ({ ...current, [itemId]: value }));
  }

  async function salvar(): Promise<boolean> {
    const response = await fetch(`/api/ordens/${ordemId}/tabulacao`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ respostas, observacoes: observacoes.trim() || undefined })
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
    setSaving(true);
    const ok = await salvar();
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
    setConcluindo(true);
    // Conclusão exige tabulação salva (canTransitionStatus): salva antes de concluir.
    const ok = await salvar();
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

      {grupos.map((grupo) => (
        <Card key={grupo.id}>
          <CardHeader>
            <CardTitle>{grupo.nome}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
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
                    value={(respostas[item.id] as string) ?? ""}
                    onChange={(event) => setResposta(item.id, event.target.value)}
                    disabled={bloqueada}
                  />
                ) : (
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
