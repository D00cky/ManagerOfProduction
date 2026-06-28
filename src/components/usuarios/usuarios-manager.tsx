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
import { REGIOES_SP } from "@/data/regioes-sp";
import type { UsuarioResumo } from "@/server/usuario-service";

type PoloOption = { id: string; nome: string };

const perfis: Perfil[] = ["fiscal", "monitor", "supervisor"];

const emptyForm = {
  name: "",
  email: "",
  matricula: "",
  password: "",
  perfil: "fiscal" as Perfil,
  poloId: "",
  regiao: "",
  polosPermitidos: [] as string[]
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
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  const poloNome = new Map(polos.map((polo) => [polo.id, polo.nome]));

  function startEdit(usuario: UsuarioResumo) {
    setError(null);
    setEditId(usuario.id);
    setEditForm({
      name: usuario.name,
      email: usuario.email,
      matricula: usuario.matricula,
      password: "",
      perfil: usuario.perfil,
      poloId: usuario.poloId ?? "",
      regiao: usuario.regiao ?? "",
      polosPermitidos: usuario.polosPermitidos ?? []
    });
  }

  function cancelEdit() {
    setEditId(null);
    setEditForm(emptyForm);
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editId) return;
    setError(null);
    setBusyId(editId);
    const response = await fetch(`/api/usuarios/${editId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        email: editForm.email,
        matricula: editForm.matricula,
        perfil: editForm.perfil,
        poloId: editForm.poloId || null,
        regiao: editForm.perfil !== "supervisor" ? editForm.regiao || null : null,
        polosPermitidos: editForm.perfil === "monitor" ? editForm.polosPermitidos : [],
        // Senha só vai quando preenchida (reset opcional).
        ...(editForm.password ? { password: editForm.password } : {})
      })
    });
    setBusyId(null);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Erro ao atualizar usuario.");
      return;
    }
    cancelEdit();
    router.refresh();
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const response = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        poloId: form.poloId || undefined,
        regiao: form.perfil !== "supervisor" ? form.regiao || undefined : undefined,
        polosPermitidos: form.perfil === "monitor" ? form.polosPermitidos : []
      })
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

  async function patchUsuario(usuario: UsuarioResumo, body: Record<string, unknown>) {
    setError(null);
    setBusyId(usuario.id);
    const response = await fetch(`/api/usuarios/${usuario.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    setBusyId(null);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? "Erro ao atualizar usuario.");
      return;
    }
    router.refresh();
  }

  function toggleStatus(usuario: UsuarioResumo) {
    return patchUsuario(usuario, { status: usuario.status === "ativo" ? "inativo" : "ativo" });
  }

  function changePerfil(usuario: UsuarioResumo, perfil: Perfil) {
    return patchUsuario(usuario, { perfil });
  }

  async function excluir(usuario: UsuarioResumo) {
    if (!window.confirm(`Excluir o usuario ${usuario.name}? Esta acao nao pode ser desfeita.`)) return;
    setError(null);
    setBusyId(usuario.id);
    const response = await fetch(`/api/usuarios/${usuario.id}`, { method: "DELETE" });
    setBusyId(null);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? "Erro ao excluir usuario.");
      return;
    }
    router.refresh();
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
            {form.perfil !== "supervisor" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="regiao">Regiao</Label>
                <Select
                  id="regiao"
                  value={form.regiao}
                  onChange={(event) => setForm({ ...form, regiao: event.target.value })}
                >
                  <option value="">Sem regiao</option>
                  {REGIOES_SP.map((regiao) => (
                    <option key={regiao} value={regiao}>
                      {regiao}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            {form.perfil === "monitor" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="polosPermitidos">Polos do monitor</Label>
                <Select
                  id="polosPermitidos"
                  multiple
                  className="h-auto min-h-24"
                  value={form.polosPermitidos}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      polosPermitidos: Array.from(event.target.selectedOptions, (option) => option.value)
                    })
                  }
                >
                  {polos.map((polo) => (
                    <option key={polo.id} value={polo.id}>
                      {polo.nome}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            {error ? <p className="text-sm text-red-600 md:col-span-2">{error}</p> : null}

            <div className="md:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Criar usuario"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {editId ? (
        <Card>
          <CardHeader>
            <CardTitle>Editar usuario</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleUpdate}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-name">Nome</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-email">E-mail</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(event) => setEditForm({ ...editForm, email: event.target.value })}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-matricula">Matricula</Label>
                <Input
                  id="edit-matricula"
                  value={editForm.matricula}
                  onChange={(event) => setEditForm({ ...editForm, matricula: event.target.value })}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-password">Nova senha (deixe em branco para manter)</Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={editForm.password}
                  onChange={(event) => setEditForm({ ...editForm, password: event.target.value })}
                  autoComplete="new-password"
                  minLength={6}
                  placeholder="••••••"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-perfil">Perfil</Label>
                <Select
                  id="edit-perfil"
                  value={editForm.perfil}
                  onChange={(event) => setEditForm({ ...editForm, perfil: event.target.value as Perfil })}
                >
                  {perfis.map((perfil) => (
                    <option key={perfil} value={perfil}>
                      {perfilLabel(perfil)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-poloId">Polo</Label>
                <Select
                  id="edit-poloId"
                  value={editForm.poloId}
                  onChange={(event) => setEditForm({ ...editForm, poloId: event.target.value })}
                >
                  <option value="">Sem polo</option>
                  {polos.map((polo) => (
                    <option key={polo.id} value={polo.id}>
                      {polo.nome}
                    </option>
                  ))}
                </Select>
              </div>
              {editForm.perfil !== "supervisor" ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-regiao">Regiao</Label>
                  <Select
                    id="edit-regiao"
                    value={editForm.regiao}
                    onChange={(event) => setEditForm({ ...editForm, regiao: event.target.value })}
                  >
                    <option value="">Sem regiao</option>
                    {REGIOES_SP.map((regiao) => (
                      <option key={regiao} value={regiao}>
                        {regiao}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
              {editForm.perfil === "monitor" ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-polosPermitidos">Polos do monitor</Label>
                  <Select
                    id="edit-polosPermitidos"
                    multiple
                    className="h-auto min-h-24"
                    value={editForm.polosPermitidos}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        polosPermitidos: Array.from(event.target.selectedOptions, (option) => option.value)
                      })
                    }
                  >
                    {polos.map((polo) => (
                      <option key={polo.id} value={polo.id}>
                        {polo.nome}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}

              {error ? <p className="text-sm text-red-600 md:col-span-2">{error}</p> : null}

              <div className="flex gap-2 md:col-span-2">
                <Button type="submit" disabled={busyId === editId}>
                  {busyId === editId ? "Salvando..." : "Salvar alteracoes"}
                </Button>
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {error && !editId ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[hsl(var(--border))] text-xs uppercase text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Matricula</th>
              <th className="px-4 py-3">Perfil</th>
              <th className="px-4 py-3">Polo</th>
              <th className="px-4 py-3">Regiao</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[hsl(var(--muted-foreground))]">
                  Nenhum usuario cadastrado.
                </td>
              </tr>
            ) : (
              usuarios.map((usuario) => (
                <tr key={usuario.id} className="border-b border-[hsl(var(--border))] last:border-0">
                  <td className="px-4 py-3 font-medium">{usuario.name}</td>
                  <td className="px-4 py-3">{usuario.email}</td>
                  <td className="px-4 py-3">{usuario.matricula}</td>
                  <td className="px-4 py-3">
                    <Select
                      aria-label={`Perfil de ${usuario.name}`}
                      className="h-9 w-36"
                      value={usuario.perfil}
                      disabled={busyId === usuario.id}
                      onChange={(event) => changePerfil(usuario, event.target.value as Perfil)}
                    >
                      {perfis.map((perfil) => (
                        <option key={perfil} value={perfil}>
                          {perfilLabel(perfil)}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {usuario.poloId ? poloNome.get(usuario.poloId) ?? "-" : "-"}
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {usuario.regiao ?? "-"}
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
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === usuario.id}
                        onClick={() => startEdit(usuario)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === usuario.id}
                        onClick={() => toggleStatus(usuario)}
                      >
                        {usuario.status === "ativo" ? "Desativar" : "Ativar"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                        disabled={busyId === usuario.id}
                        onClick={() => excluir(usuario)}
                      >
                        Excluir
                      </Button>
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
