import type { StatusOS } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<StatusOS, { label: string; className: string }> = {
  NaFila: { label: "Na fila", className: "bg-slate-100 text-slate-700" },
  EmExecucao: { label: "Em execucao", className: "bg-blue-100 text-blue-700" },
  Pendente: { label: "Pendente", className: "bg-amber-100 text-amber-700" },
  Concluida: { label: "Concluida", className: "bg-green-100 text-green-700" },
  Cancelada: { label: "Cancelada", className: "bg-red-100 text-red-700" }
};

export function StatusBadge({ status }: { status: StatusOS }) {
  const { label, className } = statusStyles[status];
  return <Badge className={cn(className)}>{label}</Badge>;
}
