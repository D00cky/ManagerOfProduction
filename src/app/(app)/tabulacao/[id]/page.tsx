import { redirect } from "next/navigation";
import { TabulacaoForm } from "@/components/tabulacao/tabulacao-form";
import { FiscalResumoCards } from "@/components/tabulacao/fiscal-resumo";
import { FormularioFiscalizacaoHeader } from "@/components/tabulacao/formulario-fiscalizacao-header";
import type { RespostasFfr } from "@/lib/ffr";
import { defaultRedirect, hasPermission } from "@/lib/permissions";
import { getTabulacaoEdicao } from "@/server/tabulacao-service";
import { prismaTabulacaoRepository } from "@/server/prisma-tabulacao-repository";
import { getFiscalHome } from "@/server/fiscal-service";
import { prismaFiscalRepository } from "@/server/prisma-fiscal-repository";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function TabulacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.perfil, "tabulacao:write")) redirect(defaultRedirect(user.perfil));

  const { id } = await params;
  const edicao = await getTabulacaoEdicao(prismaTabulacaoRepository, user, id).catch(() => null);
  if (!edicao) redirect("/fila");

  const { ordem, tabulacao, fiscalNome, tabuladoPor, alteradoPor } = edicao;
  const respostas = (tabulacao?.respostas ?? {}) as unknown as RespostasFfr;
  // Embed the fiscal's own dashboard (imported / concluded / remaining).
  const home = user.perfil === "fiscal" ? await getFiscalHome(prismaFiscalRepository, user) : null;

  const formatarPessoa = (pessoa: { name: string; matricula: string } | null) =>
    pessoa ? `${pessoa.name} (${pessoa.matricula})` : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Tabulacao — OS {ordem.numero}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{ordem.tipoServico}</p>
      </div>
      {home ? <FiscalResumoCards resumo={home.resumo} concluidasHoje={home.concluidasHoje} /> : null}
      <FormularioFiscalizacaoHeader ordem={ordem} fiscalNome={fiscalNome} />
      <TabulacaoForm
        ordemId={ordem.id}
        tipoServico={ordem.tipoServico}
        descricaoTss={ordem.descricaoTss}
        status={ordem.status}
        respostasIniciais={respostas}
        observacoesIniciais={tabulacao?.observacoes ?? ""}
        currentUserId={user.id}
        perfil={user.perfil}
        jaTabulada={Boolean(tabulacao)}
        tabuladoPorId={tabulacao?.tabuladoPorId ?? null}
        tabuladoPorLabel={formatarPessoa(tabuladoPor)}
        alteracao={
          tabulacao?.alterada
            ? {
                por: formatarPessoa(alteradoPor),
                motivo: tabulacao.motivoAlteracao ?? "",
                em: tabulacao.alteradaEm ? tabulacao.alteradaEm.toLocaleString("pt-BR") : null
              }
            : null
        }
      />
    </div>
  );
}
