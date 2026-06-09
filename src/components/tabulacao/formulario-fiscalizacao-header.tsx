import type { OrdemServico } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function juntar(codigo: string | null, descricao: string | null) {
  const partes = [codigo, descricao].filter((parte) => parte && parte.trim().length > 0);
  return partes.length > 0 ? partes.join(" — ") : "";
}

function dataBR(value: Date | null) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "";
}

function Campo({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-[hsl(var(--border))] px-3 py-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      <span className="text-sm">{value || "—"}</span>
    </div>
  );
}

/**
 * Cabeçalho do Formulário de Fiscalização (metadados da OS importada). Campos sem
 * coluna no modelo (coordenadas, nº/data da amostra, contratada fiscalizadora,
 * medidas da recomposição) ficam em branco até existirem na base.
 */
export function FormularioFiscalizacaoHeader({
  ordem,
  fiscalNome
}: {
  ordem: OrdemServico;
  fiscalNome: string | null;
}) {
  const endereco = [ordem.enderecoCompleto, ordem.numeroImovel, ordem.complemento]
    .filter((parte) => parte && String(parte).trim().length > 0)
    .join(", ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Formulário de Fiscalização</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-x-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        <Campo label="nº OS" value={ordem.numero} />
        <Campo label="PDE" value={ordem.pde ?? ""} />
        <Campo label="Fiscal" value={fiscalNome ?? ""} />
        <Campo label="Contrato / Contratada fiscalizada" value={juntar(ordem.codigoContrato, ordem.descricaoContrato)} />
        <Campo label="Unidade Executante" value={ordem.unidadeExecutante ?? ""} />
        <Campo label="TSS PAI" value={juntar(ordem.codigoTss, ordem.descricaoTss)} />
        <Campo label="TSE (fiscalizado)" value={juntar(ordem.codigoTse, ordem.descricaoTse)} />
        <Campo label="Endereço completo" value={endereco} />
        <Campo label="Bairro" value={ordem.bairro ?? ""} />
        <Campo label="Município" value={ordem.cidade ?? ""} />
        <Campo label="Coordenadas" value="" />
        <Campo label="Data programada" value={dataBR(ordem.dataProgramada)} />
        <Campo label="Data início execução" value={dataBR(ordem.dataInicioExecucao)} />
        <Campo label="Data fim execução" value={dataBR(ordem.dataFimExecucao)} />
        <Campo label="nº amostra" value="" />
        <Campo label="Data amostra" value="" />
        <Campo label="Contratada fiscalizadora" value="" />
        <Campo label="Medidas da recomposição informada" value="" />
      </CardContent>
    </Card>
  );
}
