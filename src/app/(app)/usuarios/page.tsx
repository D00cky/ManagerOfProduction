import { redirect } from "next/navigation";
import { UsuariosManager } from "@/components/usuarios/usuarios-manager";
import { defaultRedirect, hasPermission } from "@/lib/permissions";
import { listPolos } from "@/server/polo-service";
import { prismaPoloRepository } from "@/server/prisma-polo-repository";
import { listUsuarios } from "@/server/usuario-service";
import { prismaUsuarioRepository } from "@/server/prisma-usuario-repository";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.perfil, "usuarios:write")) redirect(defaultRedirect(user.perfil));

  const [usuarios, polos] = await Promise.all([
    listUsuarios(prismaUsuarioRepository, user),
    listPolos(prismaPoloRepository, user)
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Usuarios</h1>
      <UsuariosManager usuarios={usuarios} polos={polos.map((polo) => ({ id: polo.id, nome: polo.nome }))} />
    </div>
  );
}
