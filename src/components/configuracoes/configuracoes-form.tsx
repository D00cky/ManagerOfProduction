"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ConfiguracaoResumo } from "@/server/configuracao-service";

const formatos = ["excel", "pdf", "ambos"];

export function ConfiguracoesForm({ configuracao }: { configuracao: ConfiguracaoResumo }) {
  const router = useRouter();
  const [caminhoRede, setCaminhoRede] = useState(configuracao.caminhoRede ?? "");
  const [intervaloMin, setIntervaloMin] = useState(String(configuracao.intervaloMin));
  const [formato, setFormato] = useState(configuracao.formato);
  const [autoBackup, setAutoBackup] = useState(configuracao.autoBackup);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);

    const response = await fetch("/api/configuracoes", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        caminhoRede: caminhoRede.trim() || null,
        intervaloMin: Number(intervaloMin),
        formato,
        autoBackup
      })
    });

    setSaving(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Erro ao salvar.");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Sincronizacao e backup</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="caminhoRede">Caminho de rede</Label>
            <Input
              id="caminhoRede"
              value={caminhoRede}
              onChange={(event) => setCaminhoRede(event.target.value)}
              placeholder="//servidor/compartilhamento"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="intervaloMin">Intervalo (minutos)</Label>
            <Input
              id="intervaloMin"
              type="number"
              min={1}
              value={intervaloMin}
              onChange={(event) => setIntervaloMin(event.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="formato">Formato de exportacao</Label>
            <Select id="formato" value={formato} onChange={(event) => setFormato(event.target.value)}>
              {formatos.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoBackup}
              onChange={(event) => setAutoBackup(event.target.checked)}
              className="h-4 w-4"
            />
            Backup automatico
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {saved ? <p className="text-sm text-green-600">Configuracoes salvas.</p> : null}

          <div>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
