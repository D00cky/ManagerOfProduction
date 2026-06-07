import { redirect } from "next/navigation";
import { TabulacaoForm } from "@/components/tabulacao/tabulacao-form";
import type { RespostasFfr } from "@/lib/ffr";
import { defaultRedirect, hasPermission } from "@/lib/permissions";
import { getTabulacaoEdicao } from "@/server/tabulacao-service";
import { prismaTabulacaoRepository } from "@/server/prisma-tabulacao-repository";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function TabulacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.perfil, "tabulacao:write")) redirect(defaultRedirect(user.perfil));

  const { id } = await params;
  const edicao = await getTabulacaoEdicao(prismaTabulacaoRepository, user, id).catch(() => null);
  if (!edicao) redirect("/fila");

  const { ordem, tabulacao } = edicao;
  const respostas = (tabulacao?.respostas ?? {}) as unknown as RespostasFfr;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Tabulacao — OS {ordem.numero}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{ordem.tipoServico}</p>
      </div>
      <TabulacaoForm
        ordemId={ordem.id}
        tipoServico={ordem.tipoServico}
        status={ordem.status}
        respostasIniciais={respostas}
        observacoesIniciais={tabulacao?.observacoes ?? ""}
      />
    </div>
  );
}
