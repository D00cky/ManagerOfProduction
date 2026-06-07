import { redirect } from "next/navigation";
import { defaultRedirect } from "@/lib/permissions";
import { getCurrentUser } from "@/server/session";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(defaultRedirect(user.perfil));
}
