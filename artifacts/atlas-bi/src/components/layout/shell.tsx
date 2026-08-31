import { useEffect, useState } from "react";
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
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { SalesRealtimeNotifications } from "../sales-realtime-notifications";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/consultants", label: "Consultores", icon: Users },
  { href: "/sales", label: "Vendas", icon: BarChart3 },
  { href: "/goals", label: "Metas", icon: Target },
];

const ADMIN_NAV_ITEMS = [
  { href: "/users", label: "Usuários", icon: UserCog },
];

const SIDEBAR_STORAGE_KEY = "atlas_sidebar_collapsed";

export function Shell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // O recolhimento vale só do breakpoint lg para cima: no celular a barra é um
  // drawer que abre por cima do conteúdo, e recolher para uma tira de ícones
  // ali só tiraria os rótulos sem devolver espaço nenhum.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
    } catch {
      // Navegador com armazenamento bloqueado: a barra abre expandida, que é
      // o padrão, em vez de a tela inteira quebrar.
      return false;
    }
  });
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("atlas_theme");
    return savedTheme
      ? savedTheme === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
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

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("atlas_theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
    } catch {
      // Sem persistência a barra volta expandida no próximo acesso, o que é
      // aceitável; travar a navegação por causa disso não é.
    }
  }, [collapsed]);

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <SalesRealtimeNotifications />
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
          "fixed inset-y-0 left-0 z-30 flex w-72 flex-col overflow-hidden border-r border-sidebar-border/80 bg-sidebar text-sidebar-foreground shadow-[24px_0_70px_-45px_rgba(2,12,32,0.9)] transition-[transform,width] duration-300 lg:translate-x-0",
          // A largura recolhida é só do lg para cima; no drawer do celular a
          // barra continua com a largura cheia.
          collapsed && "lg:w-20",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div
          className={cn(
            "relative flex min-h-44 flex-col items-center justify-center overflow-hidden border-b border-white/5 px-6 transition-all duration-300",
            collapsed && "lg:min-h-24 lg:px-2",
          )}
        >
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-sidebar-primary/15 blur-3xl" />
          <img
            src="/niadcon-logo.png"
            alt="Niadcon"
            className={cn(
              "relative h-16 w-auto drop-shadow-xl transition-all duration-300",
              collapsed && "lg:h-9",
            )}
          />
          <span
            className={cn(
              "relative mt-3 text-xs font-black tracking-[0.28em] text-sidebar-foreground/75",
              collapsed && "lg:hidden",
            )}
          >
            ATLAS BI
          </span>
          <div
            className={cn(
              "relative mt-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-sidebar-foreground/55",
              collapsed && "lg:hidden",
            )}
          >
            <Sparkles className="h-3 w-3 text-sidebar-primary" />
            Inteligência de Negócios
          </div>
        </div>

        <nav className="scrollbar-premium flex flex-1 flex-col gap-1.5 overflow-y-auto px-4 py-6">
          <p
            className={cn(
              "mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/35",
              collapsed && "lg:hidden",
            )}
          >
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
                // Recolhida, a barra mostra só o ícone: o title devolve o nome
                // da página ao passar o mouse.
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group relative flex items-center gap-3 overflow-hidden rounded-xl px-4 py-3.5 text-sm font-semibold transition-all duration-200",
                  collapsed && "lg:justify-center lg:px-0",
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
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition",
                    isActive
                      ? "bg-sidebar-primary/15 text-sidebar-primary"
                      : "bg-white/[0.035] text-sidebar-foreground/45 group-hover:bg-white/[0.07] group-hover:text-sidebar-foreground",
                  )}
                >
                  <item.icon className="h-[18px] w-[18px]" />
                </span>
                <span className={cn("truncate", collapsed && "lg:hidden")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/5 p-4">
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            // Só faz sentido onde a barra é fixa: no celular quem fecha o menu
            // é o botão do cabeçalho.
            className={cn(
              "mb-3 hidden w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2.5 text-sm font-semibold text-sidebar-foreground/70 transition-all hover:bg-white/[0.08] hover:text-sidebar-foreground lg:flex",
              collapsed && "lg:justify-center lg:px-0",
            )}
            aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/10 text-sidebar-primary">
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </span>
            <span className={cn("flex-1 text-left", collapsed && "lg:hidden")}>
              Recolher menu
            </span>
          </button>

          <button
            type="button"
            onClick={() => setDarkMode((enabled) => !enabled)}
            className={cn(
              "mb-3 flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2.5 text-sm font-semibold text-sidebar-foreground/70 transition-all hover:bg-white/[0.08] hover:text-sidebar-foreground",
              collapsed && "lg:justify-center lg:px-0",
            )}
            aria-label={darkMode ? "Ativar modo claro" : "Ativar modo escuro"}
            title={collapsed ? (darkMode ? "Modo claro" : "Modo escuro") : undefined}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/10 text-sidebar-primary">
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </span>
            <span className={cn("flex-1 text-left", collapsed && "lg:hidden")}>
              {darkMode ? "Modo claro" : "Modo escuro"}
            </span>
            <span
              className={cn(
                "text-[9px] font-black uppercase tracking-widest text-sidebar-foreground/35",
                collapsed && "lg:hidden",
              )}
            >
              {darkMode ? "Escuro" : "Claro"}
            </span>
          </button>
          <div
            className={cn(
              "flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3",
              collapsed && "lg:flex-col lg:gap-2 lg:p-2",
            )}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sidebar-primary/25 bg-sidebar-primary/10 text-sm font-black text-sidebar-primary"
              title={collapsed ? (user?.name ?? "Usuário") : undefined}
            >
              {user?.name?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
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

      <main
        className={cn(
          "min-h-screen pt-16 transition-[padding] duration-300 lg:pl-72 lg:pt-0",
          collapsed && "lg:pl-20",
        )}
      >
        <div className="scrollbar-premium min-h-screen overflow-y-auto p-4 sm:p-6 lg:p-8 xl:p-10">
          <div className="mx-auto w-full max-w-[1520px]">{children}</div>
        </div>
      </main>
    </div>
  );
}
