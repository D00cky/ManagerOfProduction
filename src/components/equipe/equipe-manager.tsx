"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { perfilLabel } from "@/lib/perfil";
import { cn } from "@/lib/utils";
import type { MembroEquipe } from "@/server/equipe-service";

type PoloOption = { id: string; nome: string };

export function EquipeManager({
  membros,
  polos,
  canEditPolo
}: {
  membros: MembroEquipe[];
  polos: PoloOption[];
  canEditPolo: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const poloNome = new Map(polos.map((polo) => [polo.id, polo.nome]));

  async function changePolo(membro: MembroEquipe, poloId: string) {
    setError(null);
    setBusyId(membro.id);
    const response = await fetch(`/api/equipe/${membro.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ poloId: poloId || null })
    });
    setBusyId(null);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Erro ao alterar polo.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[hsl(var(--border))] text-xs uppercase text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Matricula</th>
              <th className="px-4 py-3">Perfil</th>
              <th className="px-4 py-3">Polo</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ultimo acesso</th>
            </tr>
          </thead>
          <tbody>
            {membros.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[hsl(var(--muted-foreground))]">
                  Nenhum membro na equipe.
                </td>
              </tr>
            ) : (
              membros.map((membro) => (
                <tr key={membro.id} className="border-b border-[hsl(var(--border))] last:border-0">
                  <td className="px-4 py-3 font-medium">{membro.name}</td>
                  <td className="px-4 py-3">{membro.matricula}</td>
                  <td className="px-4 py-3">{perfilLabel(membro.perfil)}</td>
                  <td className="px-4 py-3">
                    {canEditPolo ? (
                      <Select
                        aria-label={`Polo de ${membro.name}`}
                        value={membro.poloId ?? ""}
                        disabled={busyId === membro.id}
                        onChange={(event) => changePolo(membro, event.target.value)}
                        className="max-w-xs"
                      >
                        <option value="">Sem polo</option>
                        {polos.map((polo) => (
                          <option key={polo.id} value={polo.id}>
                            {polo.nome}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <span className="text-[hsl(var(--muted-foreground))]">
                        {membro.poloId ? poloNome.get(membro.poloId) ?? "-" : "-"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={cn(
                        membro.status === "ativo"
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {membro.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {membro.lastSeenAt ? membro.lastSeenAt.toLocaleString("pt-BR") : "Nunca"}
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
