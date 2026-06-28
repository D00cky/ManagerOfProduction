"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  detectMapping,
  normalizeImportRow,
  type ImportMapping,
  type NormalizedImportRow,
  type RawImportRow
} from "@/lib/importacao";
import type { DuplicateMode, ImportacaoResumo } from "@/server/importacao-service";

type ParsedRow = { row: NormalizedImportRow; errors: string[] };

type Parsed = {
  mapping: ImportMapping;
  rows: ParsedRow[];
  invalidas: number;
  descartadas: number;
};

export function ImportarForm() {
  const router = useRouter();
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>("ignorar");
  const [resumo, setResumo] = useState<ImportacaoResumo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResumo(null);
    setParsing(true);
    try {
      // Load the heavy SheetJS bundle only when a file is actually parsed.
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
      const raw = sheet ? XLSX.utils.sheet_to_json<RawImportRow>(sheet, { defval: "" }) : [];
      const headers = raw[0] ? Object.keys(raw[0]) : [];
      const mapping = detectMapping(headers);
      const rows = raw.map((row) => normalizeImportRow(row, mapping));
      setParsed({
        mapping,
        rows,
        invalidas: rows.filter((entry) => entry.errors.length > 0).length,
        descartadas: rows.filter((entry) => entry.errors.length === 0 && entry.row.foraDeEscopo).length
      });
    } catch {
      setError("Nao foi possivel ler a planilha.");
      setParsed(null);
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirm() {
    if (!parsed) return;
    setError(null);
    setConfirming(true);

    const response = await fetch("/api/importacao/confirmar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rows: parsed.rows.map((entry) => entry.row), duplicateMode })
    });

    setConfirming(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Erro ao confirmar importacao.");
      return;
    }

    const body = await response.json();
    setResumo(body.data as ImportacaoResumo);
    setParsed(null);
    router.refresh();
  }

  const mappedColumns = parsed
    ? (Object.entries(parsed.mapping) as [string, string][]).map(([col, header]) => `${col} ← ${header}`)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Importar planilha de OS</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="file">Arquivo XLSX</Label>
            <input
              id="file"
              type="file"
              accept=".xlsx,.xls"
              onChange={(event) => handleFile(event.target.files?.[0])}
              className="text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="duplicateMode">Duplicatas (numero ja existente)</Label>
            <Select
              id="duplicateMode"
              value={duplicateMode}
              onChange={(event) => setDuplicateMode(event.target.value as DuplicateMode)}
              className="max-w-xs"
            >
              <option value="ignorar">Ignorar</option>
              <option value="atualizar">Atualizar</option>
            </Select>
          </div>
          {parsing ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Lendo planilha...</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </CardContent>
      </Card>

      {parsed ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Pre-visualizacao &middot; {parsed.rows.length} linhas, {parsed.invalidas} com erros,{" "}
              {parsed.descartadas} fora de escopo
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Colunas detectadas: {mappedColumns.length > 0 ? mappedColumns.join(" · ") : "nenhuma"}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[hsl(var(--border))] text-xs uppercase text-[hsl(var(--muted-foreground))]">
                  <tr>
                    <th className="px-3 py-2">Numero</th>
                    <th className="px-3 py-2">Endereco</th>
                    <th className="px-3 py-2">Municipio</th>
                    <th className="px-3 py-2">Regiao</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Polo</th>
                    <th className="px-3 py-2">Fiscal</th>
                    <th className="px-3 py-2">Erros</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 20).map((entry, index) => (
                    <tr key={index} className="border-b border-[hsl(var(--border))] last:border-0">
                      <td className="px-3 py-2">{entry.row.numero || "-"}</td>
                      <td className="px-3 py-2">{entry.row.enderecoCompleto || "-"}</td>
                      <td className="px-3 py-2">{entry.row.cidade ?? "-"}</td>
                      <td className="px-3 py-2">{entry.row.regiaoAdministrativa ?? "-"}</td>
                      <td className="px-3 py-2">
                        {entry.row.foraDeEscopo ? (
                          <span className="text-amber-600">Fora de escopo (descartar)</span>
                        ) : (
                          entry.row.tipoServico
                        )}
                      </td>
                      <td className="px-3 py-2">{entry.row.polo ?? "-"}</td>
                      <td className="px-3 py-2">{entry.row.fiscal ?? "-"}</td>
                      <td className="px-3 py-2 text-red-600">{entry.errors.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsed.rows.length > 20 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Mostrando 20 de {parsed.rows.length} linhas.
              </p>
            ) : null}
            <div>
              <Button type="button" onClick={handleConfirm} disabled={confirming || parsed.rows.length === 0}>
                {confirming ? "Importando..." : "Confirmar importacao"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {resumo ? (
        <Card>
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>
              {resumo.criadas} criadas &middot; {resumo.atualizadas} atualizadas &middot; {resumo.ignoradas} ignoradas
              &middot; {resumo.invalidas} invalidas &middot; {resumo.descartadas} fora de escopo (de {resumo.total})
            </p>
            {resumo.erros.length > 0 ? (
              <ul className="list-inside list-disc text-red-600">
                {resumo.erros.slice(0, 20).map((erro) => (
                  <li key={erro.linha}>
                    Linha {erro.linha}: {erro.erros.join(", ")}
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
