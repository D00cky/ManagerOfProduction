import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Sidebar, type NavItem } from "@/components/layout/sidebar";
import { hasPermission, navigation } from "@/lib/permissions";
import { getCurrentUser } from "@/server/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const items: NavItem[] = navigation
    .filter((entry) => hasPermission(user.perfil, entry.permission))
    .map((entry) => ({ href: entry.href, label: entry.label }));

  return (
    <div className="flex min-h-screen">
      <Sidebar items={items} userName={user.name} perfil={user.perfil} />
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
