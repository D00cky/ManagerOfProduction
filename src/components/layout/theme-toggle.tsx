"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Aplica/persiste o tema (claro/escuro) alternando a classe `dark` no <html>. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  // O tema já é aplicado antes do paint pelo script no layout (sem flash); aqui só
  // sincronizamos o estado do botão com a classe efetiva no <html>.
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const proximo = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", proximo);
    try {
      window.localStorage.setItem("theme", proximo ? "dark" : "light");
    } catch {
      // localStorage indisponível (modo privado): tema vale só nesta sessão.
    }
    setDark(proximo);
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start"
      onClick={toggle}
      aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {dark ? "Modo claro" : "Modo escuro"}
    </Button>
  );
}
