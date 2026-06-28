"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Busca global de OS: leva para a Fila já filtrada (`/fila?busca=...`), reaproveitando
 * o filtro existente (número/endereço), o escopo por perfil e a paginação.
 */
export function OsSearch() {
  const router = useRouter();
  const [valor, setValor] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const termo = valor.trim();
    router.push(termo ? `/fila?busca=${encodeURIComponent(termo)}` : "/fila");
  }

  return (
    <form onSubmit={onSubmit} role="search" className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
      <Input
        type="search"
        value={valor}
        onChange={(event) => setValor(event.target.value)}
        placeholder="Buscar OS (nº ou endereço)"
        aria-label="Buscar OS"
        className="pl-8"
      />
    </form>
  );
}
