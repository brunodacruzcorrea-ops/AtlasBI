import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../auth-provider";
import { useLogout } from "@workspace/api-client-react";
import {
  LayoutDashboard,
  Trophy,
  Users,
  BarChart3,
  Target,
  LogOut,
  UserCog,
  Menu,
  X,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/consultants", label: "Consultores", icon: Users },
  { href: "/sales", label: "Vendas", icon: BarChart3 },
  { href: "/goals", label: "Metas", icon: Target },
];

const ADMIN_NAV_ITEMS = [
  { href: "/users", label: "Usuários", icon: UserCog },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();

  const navItems =
    user?.role === "admin" ? [...NAV_ITEMS, ...ADMIN_NAV_ITEMS] : NAV_ITEMS;

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem("atlas_token");
        queryClient.clear();
        setLocation("/login");
      },
    });
  };

  const navigate = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-sidebar/95 px-4 text-sidebar-foreground shadow-lg backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-3">
          <img src="/niadcon-logo.png" alt="Niadcon" className="h-9 w-auto" />
          <div>
            <p className="text-xs font-black tracking-[0.18em]">ATLAS BI</p>
            <p className="text-[10px] text-sidebar-foreground/50">Central de comando</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={mobileMenuOpen}
          className="rounded-xl border border-white/10 bg-white/5 p-2.5 transition hover:bg-white/10"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-20 bg-slate-950/55 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-72 flex-col overflow-hidden border-r border-sidebar-border/80 bg-sidebar text-sidebar-foreground shadow-[24px_0_70px_-45px_rgba(2,12,32,0.9)] transition-transform duration-300 lg:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="relative flex min-h-44 flex-col items-center justify-center overflow-hidden border-b border-white/5 px-6">
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-sidebar-primary/15 blur-3xl" />
          <img src="/niadcon-logo.png" alt="Niadcon" className="relative h-16 w-auto drop-shadow-xl" />
          <span className="relative mt-3 text-xs font-black tracking-[0.28em] text-sidebar-foreground/75">
            ATLAS BI
          </span>
          <div className="relative mt-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-sidebar-foreground/55">
            <Sparkles className="h-3 w-3 text-sidebar-primary" />
            Business Intelligence
          </div>
        </div>

        <nav className="scrollbar-premium flex flex-1 flex-col gap-1.5 overflow-y-auto px-4 py-6">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/35">
            Navegação
          </p>
          {navItems.map((item) => {
            const isActive =
              location === item.href ||
              (location.startsWith(item.href) && item.href !== "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={navigate}
                className={cn(
                  "group relative flex items-center gap-3 overflow-hidden rounded-xl px-4 py-3.5 text-sm font-semibold transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-r from-sidebar-accent to-sidebar-accent/70 text-white shadow-[0_12px_30px_-18px_rgba(0,0,0,0.8)]"
                    : "text-sidebar-foreground/60 hover:bg-white/5 hover:text-sidebar-foreground",
                )}
              >
                {isActive && (
                  <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-sidebar-primary shadow-[0_0_16px_hsl(var(--sidebar-primary))]" />
                )}
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg transition",
                    isActive
                      ? "bg-sidebar-primary/15 text-sidebar-primary"
                      : "bg-white/[0.035] text-sidebar-foreground/45 group-hover:bg-white/[0.07] group-hover:text-sidebar-foreground",
                  )}
                >
                  <item.icon className="h-[18px] w-[18px]" />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/5 p-4">
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sidebar-primary/25 bg-sidebar-primary/10 text-sm font-black text-sidebar-primary">
              {user?.name?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{user?.name || "Usuário"}</p>
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                {user?.role || "Consultor"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg p-2 text-sidebar-foreground/40 transition hover:bg-destructive/10 hover:text-destructive"
              title="Sair"
              aria-label="Sair do sistema"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="min-h-screen pt-16 lg:pl-72 lg:pt-0">
        <div className="scrollbar-premium min-h-screen overflow-y-auto p-4 sm:p-6 lg:p-8 xl:p-10">
          <div className="mx-auto w-full max-w-[1520px]">{children}</div>
        </div>
      </main>
    </div>
  );
}

