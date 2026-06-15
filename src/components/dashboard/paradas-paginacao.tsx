"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

type ParadasPaginacaoProps = {
  total: number;
  page: number;
  pageSize: number;
};

export function ParadasPaginacao({ total, page, pageSize }: ParadasPaginacaoProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));

  function irParaPagina(destino: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (destino > 1) params.set("page", String(destino));
    else params.delete("page");
    const query = params.toString();
    router.push(query ? `?${query}` : "?");
  }

  return (
    <div className="mt-1 flex items-center justify-between gap-2 border-t border-[hsl(var(--border))] pt-2 text-xs text-[hsl(var(--muted-foreground))]">
      <span>
        {total} OS · página {page} de {totalPaginas}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => irParaPagina(page - 1)}>
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPaginas}
          onClick={() => irParaPagina(page + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
}
