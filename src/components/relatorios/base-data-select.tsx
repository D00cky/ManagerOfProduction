"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type BaseDataSelectProps = {
  /** "conclusao" | "importacao" */
  value: string;
};

export function BaseDataSelect({ value }: BaseDataSelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onSelect(base: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (base) params.set("base", base);
    else params.delete("base");
    const query = params.toString();
    router.push(query ? `?${query}` : "?");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="base">Base do periodo</Label>
      <Select
        id="base"
        value={value}
        onChange={(event) => onSelect(event.target.value)}
        className="min-w-56"
      >
        <option value="conclusao">Concluidas (data de conclusao)</option>
        <option value="importacao">Importadas (data de importacao)</option>
      </Select>
    </div>
  );
}
