import { redirect } from "next/navigation";
import { ImportarForm } from "@/components/importar/importar-form";
import { defaultRedirect, hasPermission } from "@/lib/permissions";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function ImportarPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.perfil, "importacao:write")) redirect(defaultRedirect(user.perfil));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Importar Excel</h1>
      <ImportarForm />
    </div>
  );
}
