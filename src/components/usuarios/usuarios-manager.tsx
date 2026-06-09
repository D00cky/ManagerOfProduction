"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Perfil } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { perfilLabel } from "@/lib/perfil";
import { cn } from "@/lib/utils";
import type { UsuarioResumo } from "@/server/usuario-service";

type PoloOption = { id: string; nome: string };

const perfis: Perfil[] = ["fiscal", "monitor", "supervisor"];

const emptyForm = {
  name: "",
  email: "",
  matricula: "",
  password: "",
  perfil: "fiscal" as Perfil,
  poloId: ""
};

export function UsuariosManager({
  usuarios,
  polos
}: {
  usuarios: UsuarioResumo[];
  polos: PoloOption[];
}) {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const poloNome = new Map(polos.map((polo) => [polo.id, polo.nome]));

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const response = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, poloId: form.poloId || undefined })
    });

    setSaving(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Erro ao criar usuario.");
      return;
    }

    setForm(emptyForm);
    router.refresh();
  }

  async function toggleStatus(usuario: UsuarioResumo) {
    setBusyId(usuario.id);
    const status = usuario.status === "ativo" ? "inativo" : "ativo";
    const response = await fetch(`/api/usuarios/${usuario.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status })
    });
    setBusyId(null);
    if (response.ok) router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Novo usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="matricula">Matricula</Label>
              <Input
                id="matricula"
                value={form.matricula}
                onChange={(event) => setForm({ ...form, matricula: event.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="perfil">Perfil</Label>
              <Select
                id="perfil"
                value={form.perfil}
                onChange={(event) => setForm({ ...form, perfil: event.target.value as Perfil })}
              >
                {perfis.map((perfil) => (
                  <option key={perfil} value={perfil}>
                    {perfilLabel(perfil)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="poloId">Polo</Label>
              <Select
                id="poloId"
                value={form.poloId}
                onChange={(event) => setForm({ ...form, poloId: event.target.value })}
              >
                <option value="">Sem polo</option>
                {polos.map((polo) => (
                  <option key={polo.id} value={polo.id}>
                    {polo.nome}
                  </option>
                ))}
              </Select>
            </div>

            {error ? <p className="text-sm text-red-600 md:col-span-2">{error}</p> : null}

            <div className="md:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Criar usuario"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[hsl(var(--border))] text-xs uppercase text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Matricula</th>
              <th className="px-4 py-3">Perfil</th>
              <th className="px-4 py-3">Polo</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[hsl(var(--muted-foreground))]">
                  Nenhum usuario cadastrado.
                </td>
              </tr>
            ) : (
              usuarios.map((usuario) => (
                <tr key={usuario.id} className="border-b border-[hsl(var(--border))] last:border-0">
                  <td className="px-4 py-3 font-medium">{usuario.name}</td>
                  <td className="px-4 py-3">{usuario.email}</td>
                  <td className="px-4 py-3">{usuario.matricula}</td>
                  <td className="px-4 py-3">{perfilLabel(usuario.perfil)}</td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {usuario.poloId ? poloNome.get(usuario.poloId) ?? "-" : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={cn(
                        usuario.status === "ativo"
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {usuario.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === usuario.id}
                      onClick={() => toggleStatus(usuario)}
                    >
                      {usuario.status === "ativo" ? "Desativar" : "Ativar"}
                    </Button>
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
