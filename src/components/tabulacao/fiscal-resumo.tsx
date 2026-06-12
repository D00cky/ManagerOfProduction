import { Card, CardContent } from "@/components/ui/card";
import type { FiscalResumo } from "@/server/fiscal-service";

/** Per-fiscal mini dashboard shown inside the tabulação flow. */
export function FiscalResumoCards({
  resumo,
  concluidasHoje
}: {
  resumo: FiscalResumo;
  concluidasHoje: number;
}) {
  const cards = [
    { label: "Importadas (atribuidas)", value: resumo.total },
    { label: "Na fila", value: resumo.naFila },
    { label: "Concluidas hoje", value: concluidasHoje }
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-[hsl(var(--muted-foreground))]">{card.label}</p>
            <p className="text-2xl font-semibold">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
