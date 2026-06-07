"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string };

export function Sidebar({
  items,
  userName,
  perfil
}: {
  items: NavItem[];
  userName?: string | null;
  perfil: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
      <div className="px-2 pb-6">
        <p className="text-sm font-semibold">ManagerOfProduction</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">FFR</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 border-t border-[hsl(var(--border))] pt-4">
        <p className="px-3 text-sm font-medium">{userName ?? "Usuario"}</p>
        <p className="px-3 pb-2 text-xs capitalize text-[hsl(var(--muted-foreground))]">{perfil}</p>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  );
}
