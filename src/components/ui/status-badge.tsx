import type { StatusOS } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { statusLabel } from "@/lib/os-labels";
import { cn } from "@/lib/utils";

const statusStyles: Record<StatusOS, string> = {
  NaFila: "bg-slate-100 text-slate-700",
  EmExecucao: "bg-blue-100 text-blue-700",
  Pendente: "bg-amber-100 text-amber-700",
  Concluida: "bg-green-100 text-green-700",
  Cancelada: "bg-red-100 text-red-700"
};

export function StatusBadge({ status }: { status: StatusOS }) {
  return <Badge className={cn(statusStyles[status])}>{statusLabel(status)}</Badge>;
}
