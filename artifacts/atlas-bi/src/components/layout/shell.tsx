import { Link, useLocation } from "wouter";
import { useAuth } from "../auth-provider";
import { useLogout } from "@workspace/api-client-react";
import { LayoutDashboard, Trophy, Users, BarChart3, Target, LogOut, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/consultants", label: "Consultants", icon: Users },
  { href: "/sales", label: "Sales", icon: BarChart3 },
  { href: "/goals", label: "Goals", icon: Target },
];

const ADMIN_NAV_ITEMS = [
  { href: "/users", label: "Usuários", icon: UserCog },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();

  const navItems = user?.role === "admin" ? [...NAV_ITEMS, ...ADMIN_NAV_ITEMS] : NAV_ITEMS;

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem("atlas_token");
        queryClient.clear();
        setLocation("/login");
      }
    });
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      <aside className="fixed inset-y-0 left-0 w-64 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border z-20">
        <div className="p-6 flex flex-col gap-1 items-center justify-center border-b border-sidebar-border/50">
          <img src="/niadcon-logo.png" alt="Niadcon" className="h-14 w-auto mb-1" />
          <span className="text-xs font-semibold tracking-widest text-sidebar-foreground/50">NIADCON</span>
        </div>

        <nav className="flex-1 py-6 flex flex-col gap-2 px-3 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href || (location.startsWith(item.href) && item.href !== "/");
            return (
              <Link key={item.href} href={item.href} className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors relative group",
                isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-sidebar-primary rounded-r-md" />
                )}
                <item.icon className={cn("w-5 h-5", isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border/50">
          <div className="flex items-center gap-3 px-2 py-3">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-bold text-sidebar-primary border border-sidebar-primary/20">
              {user?.name?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user?.name || "User"}</p>
              <p className="text-xs text-sidebar-foreground/50 truncate">{user?.role || "Consultant"}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-sidebar-foreground/50 hover:text-destructive transition-colors rounded-md hover:bg-sidebar-accent"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 pl-64 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
