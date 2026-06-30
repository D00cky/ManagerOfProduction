import type { StatusOS } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { statusLabel } from "@/lib/os-labels";
import { cn } from "@/lib/utils";

const statusStyles: Record<StatusOS, string> = {
  NaFila: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  EmExecucao: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
  Pendente: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200",
  Concluida: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200",
  Cancelada: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200"
};

export function StatusBadge({ status }: { status: StatusOS }) {
  return <Badge className={cn(statusStyles[status])}>{statusLabel(status)}</Badge>;
}
