import type { Conceito } from "@prisma/client";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultRedirect, hasPermission } from "@/lib/permissions";
import { formatPercent } from "@/lib/utils";
import { getRelatorio } from "@/server/relatorio-service";
import { prismaRelatorioRepository } from "@/server/prisma-relatorio-repository";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

const conceitoLabels: Record<Conceito, string> = {
  A: "A",
  B: "B",
  C: "C",
  D: "D",
  NaoAvaliado: "Nao avaliado"
};

export default async function RelatoriosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.perfil, "relatorios:read")) redirect(defaultRedirect(user.perfil));

  const relatorio = await getRelatorio(prismaRelatorioRepository, user);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Relatorios</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-7">
        <Card>
          <CardHeader>
            <CardTitle>Tabulacoes</CardTitle>
            <p className="text-2xl font-semibold">{relatorio.totalAvaliadas}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Media FFR</CardTitle>
            <p className="text-2xl font-semibold">{formatPercent(relatorio.mediaPercentual)}</p>
          </CardHeader>
        </Card>
        {(Object.keys(relatorio.conceitos) as Conceito[]).map((conceito) => (
          <Card key={conceito}>
            <CardHeader>
              <CardTitle>{conceitoLabels[conceito]}</CardTitle>
              <p className="text-2xl font-semibold">{relatorio.conceitos[conceito]}</p>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Qualidade por fiscal</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-y border-[hsl(var(--border))] text-xs uppercase text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="px-4 py-3">Fiscal</th>
                <th className="px-4 py-3">Tabulacoes</th>
                <th className="px-4 py-3">Media FFR</th>
              </tr>
            </thead>
            <tbody>
              {relatorio.porFiscal.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-[hsl(var(--muted-foreground))]">
                    Sem tabulacoes no periodo.
                  </td>
                </tr>
              ) : (
                relatorio.porFiscal.map((item) => (
                  <tr key={item.fiscalId} className="border-b border-[hsl(var(--border))] last:border-0">
                    <td className="px-4 py-3">
                      {item.name}
                      {item.matricula ? (
                        <span className="ml-1 text-xs text-[hsl(var(--muted-foreground))]">
                          ({item.matricula})
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{item.total}</td>
                    <td className="px-4 py-3">{formatPercent(item.mediaPercentual)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
