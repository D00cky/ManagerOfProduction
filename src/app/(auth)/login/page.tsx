"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "senha";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function trocarModo(novo: Mode) {
    setMode(novo);
    setError(null);
    setSuccess(null);
    setPassword("");
    setSenhaAtual("");
    setNovaSenha("");
    setConfirmar("");
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", { login, password, redirect: false });

    setLoading(false);
    if (result?.error) {
      setError("Credenciais invalidas.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function handleAlterarSenha(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (novaSenha !== confirmar) {
      setError("A confirmacao nao corresponde a nova senha.");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/auth/alterar-senha", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ login, senhaAtual, novaSenha })
    });
    setLoading(false);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Nao foi possivel alterar a senha.");
      return;
    }

    setSuccess("Senha alterada com sucesso. Entre com a nova senha.");
    setMode("login");
    setPassword("");
    setSenhaAtual("");
    setNovaSenha("");
    setConfirmar("");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <h1 className="text-lg font-semibold">ManagerOfProduction</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {mode === "login"
              ? "Entre com sua matricula ou e-mail."
              : "Informe a senha atual para definir uma nova."}
          </p>
        </CardHeader>
        <CardContent>
          {mode === "login" ? (
            <form className="flex flex-col gap-4" onSubmit={handleLogin}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="login">Matricula ou e-mail</Label>
                <Input
                  id="login"
                  value={login}
                  onChange={(event) => setLogin(event.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              {success ? <p className="text-sm text-green-600 dark:text-green-400">{success}</p> : null}
              {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
              <Button type="submit" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
              <button
                type="button"
                className="text-sm text-[hsl(var(--muted-foreground))] underline-offset-2 hover:underline"
                onClick={() => trocarModo("senha")}
              >
                Alterar senha
              </button>
            </form>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={handleAlterarSenha}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="login-senha">Matricula ou e-mail</Label>
                <Input
                  id="login-senha"
                  value={login}
                  onChange={(event) => setLogin(event.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="senha-atual">Senha atual</Label>
                <Input
                  id="senha-atual"
                  type="password"
                  value={senhaAtual}
                  onChange={(event) => setSenhaAtual(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nova-senha">Nova senha</Label>
                <Input
                  id="nova-senha"
                  type="password"
                  value={novaSenha}
                  onChange={(event) => setNovaSenha(event.target.value)}
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirmar-senha">Confirmar nova senha</Label>
                <Input
                  id="confirmar-senha"
                  type="password"
                  value={confirmar}
                  onChange={(event) => setConfirmar(event.target.value)}
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </div>
              {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
              <Button type="submit" disabled={loading}>
                {loading ? "Alterando..." : "Alterar senha"}
              </Button>
              <button
                type="button"
                className="text-sm text-[hsl(var(--muted-foreground))] underline-offset-2 hover:underline"
                onClick={() => trocarModo("login")}
              >
                Voltar para o login
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
