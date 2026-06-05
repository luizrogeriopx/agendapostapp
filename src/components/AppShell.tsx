import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Instagram, LayoutDashboard, Users, CalendarPlus, BookOpen, LogOut, ShieldAlert, Sparkles, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { checkIsAdmin } from "@/lib/admin.functions";

const NAV = [
  { to: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { to: "/schedule", label: "Agendar", icon: CalendarPlus },
  { to: "/accounts", label: "Contas", icon: Users },
  { to: "/automations", label: "Automações", icon: Sparkles },
  { to: "/financial", label: "Financeiro", icon: CreditCard },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fetchAdminCheck = useServerFn(checkIsAdmin);

  const { data: adminCheck } = useQuery({
    queryKey: ["admin-check"],
    queryFn: () => fetchAdminCheck(),
  });

  const isAdmin = !!adminCheck?.isAdmin;

  const navItems = [
    ...NAV,
    ...(isAdmin
      ? [
          { to: "/setup", label: "Configurar Meta", icon: BookOpen },
          { to: "/admin", label: "Administração", icon: ShieldAlert },
        ]
      : []),
  ];

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background flex-col sm:flex-row">
      <aside className="hidden w-60 flex-col border-r bg-card p-4 sm:flex shrink-0">
        <div className="mb-8 flex items-center gap-2 px-2 font-bold text-foreground">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
            style={{ background: "var(--gradient-brand)" }}
          >
            <Instagram className="h-5 w-5" />
          </span>
          Agendador IG
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Button variant="ghost" className="justify-start gap-3 mt-auto" onClick={logout}>
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </aside>

      {/* Mobile top nav */}
      <div className="flex w-full flex-col min-w-0">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 sm:hidden">
          <span className="flex items-center gap-2 font-bold text-foreground">
            <Instagram className="h-5 w-5 text-primary" /> Agendador IG
          </span>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b bg-card px-2 py-2 sm:hidden shrink-0">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium",
                pathname === item.to ? "bg-accent text-accent-foreground" : "text-muted-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

