import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useListConsultants, getListConsultantsQueryKey, useLogout } from "@workspace/api-client-react";
import { ChevronDown, LayoutDashboard, LogOut, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { cn, formatBRL } from "@/lib/utils";
import {
  formatMonth,
  STATE_LABEL,
  useForecast,
  type InstallmentState,
  type SaleCommission,
} from "@/lib/commissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATE_STYLE: Record<InstallmentState, string> = {
  received: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  forecast: "bg-primary/10 text-primary",
  defaulted: "bg-destructive/15 text-destructive",
};

function formatSaleDate(value: string): string {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(y, m - 1, d));
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-black tabular-nums", tone)}>{formatBRL(value)}</p>
    </div>
  );
}

function SaleCard({ sale, isAdmin }: { sale: SaleCommission; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const missingRule = sale.ruleId === null;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">
            {sale.product}
            <span className="font-medium text-muted-foreground"> · {sale.segment}</span>
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {formatSaleDate(sale.saleDate)} · {sale.administradora || "Administradora não informada"}
            {isAdmin && sale.consultantName ? ` · ${sale.consultantName}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Crédito {formatBRL(sale.amount)}</p>
        </div>
        <div className="text-right">
          {missingRule ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
              <TriangleAlert className="h-3.5 w-3.5" /> Sem regra
            </span>
          ) : (
            <>
              <p className="text-base font-black tabular-nums text-primary">{formatBRL(sale.sellerCommission)}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">sua comissão</p>
            </>
          )}
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border bg-muted/30 px-4 py-3">
          {missingRule ? (
            <p className="text-xs text-muted-foreground">
              Ainda não há regra de comissão para esta administradora/produto. O administrador precisa cadastrá-la.
            </p>
          ) : (
            <ul className="space-y-2">
              {sale.installments.map((inst) => (
                <li key={inst.number} className="flex items-center gap-3 text-sm">
                  <span className="w-16 text-xs font-semibold text-muted-foreground">
                    {inst.number}ª parcela
                  </span>
                  <span className="flex-1 text-xs text-muted-foreground">{formatMonth(inst.dueMonth)}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", STATE_STYLE[inst.state])}>
                    {STATE_LABEL[inst.state]}
                  </span>
                  <span
                    className={cn(
                      "w-24 text-right font-bold tabular-nums",
                      inst.state === "defaulted" && "text-muted-foreground line-through",
                    )}
                  >
                    {formatBRL(inst.seller)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {sale.chargeback && (
            <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
              Estorno de {formatBRL(sale.chargeback.amount)} em {formatMonth(sale.chargeback.month)}
            </p>
          )}
          {isAdmin && sale.totalCommission !== undefined && !missingRule && (
            <p className="mt-3 text-xs text-muted-foreground">
              Comissão total da venda: <b>{formatBRL(sale.totalCommission)}</b> (rateada entre corretora, gestão,
              supervisão e vendedor)
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function MinhasComissoes() {
  const { user, isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const logout = useLogout();
  const [consultantId, setConsultantId] = useState<number | null>(null);

  const { data: consultants } = useListConsultants({
    query: { queryKey: getListConsultantsQueryKey(), enabled: isAdmin },
  });
  const { data, isLoading, error } = useForecast(isAdmin ? consultantId : null);

  const handleLogout = () =>
    logout.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem("atlas_token");
        queryClient.clear();
        setLocation("/login");
      },
    });

  const nextMonths = data?.summary.months.filter((m) => m.month >= data.currentMonth) ?? [];
  const chartData = (data?.summary.months ?? []).map((m) => ({
    month: formatMonth(m.month),
    Recebido: m.received,
    Previsto: m.forecast,
  }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-sidebar px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-sidebar-foreground shadow-lg">
        <img src="/niadcon-logo.png" alt="Niadcon" className="h-9 w-auto" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sidebar-foreground/60">
            Minhas comissões
          </p>
          <p className="truncate text-sm font-bold">{user?.name}</p>
        </div>
        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => setLocation("/dashboard")}
              aria-label="Ir para o dashboard"
              className="rounded-xl border border-white/10 bg-white/5 p-2.5"
            >
              <LayoutDashboard className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setLocation("/commission-rules")}
              aria-label="Regras de comissão"
              className="rounded-xl border border-white/10 bg-white/5 p-2.5"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Sair"
          className="rounded-xl border border-white/10 bg-white/5 p-2.5"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <main className="mx-auto w-full max-w-xl space-y-5 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5">
        {isAdmin && (
          <Select
            value={consultantId ? String(consultantId) : "all"}
            onValueChange={(v) => setConsultantId(v === "all" ? null : Number(v))}
          >
            <SelectTrigger aria-label="Vendedor">
              <SelectValue placeholder="Todos os vendedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os vendedores</SelectItem>
              {consultants?.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {isLoading && <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>}

        {error && (
          <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
            {(error as Error).message}
          </div>
        )}

        {data && (
          <>
            <section className="grid grid-cols-2 gap-3">
              <StatCard label="A receber" value={data.summary.forecast} tone="text-primary" />
              <StatCard label="Já recebido" value={data.summary.received} tone="text-emerald-600 dark:text-emerald-400" />
              <StatCard label="Inadimplência" value={data.summary.defaulted} tone="text-destructive" />
              <StatCard label="Estornos" value={data.summary.chargeback} tone="text-destructive" />
            </section>

            {nextMonths.length > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Próximos pagamentos
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {nextMonths.map((m) => (
                    <div
                      key={m.month}
                      className="min-w-[8.5rem] shrink-0 rounded-2xl border border-border bg-card p-3 shadow-sm"
                    >
                      <p className="text-xs font-bold uppercase text-muted-foreground">{formatMonth(m.month)}</p>
                      <p className="mt-1 text-lg font-black tabular-nums text-primary">
                        {formatBRL(m.forecast - m.chargeback)}
                      </p>
                      {m.chargeback > 0 && (
                        <p className="text-[10px] font-semibold text-destructive">
                          inclui estorno {formatBRL(m.chargeback)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {chartData.length > 0 && (
              <section className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Comissão por mês
                </h2>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis tickLine={false} axisLine={false} fontSize={11} width={48} />
                      <RechartsTooltip
                        formatter={(v: number) => formatBRL(v)}
                        contentStyle={{ borderRadius: 12, fontSize: 12 }}
                      />
                      <Bar dataKey="Recebido" stackId="a" fill="hsl(var(--chart-2))" />
                      <Bar dataKey="Previsto" stackId="a" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Vendas e parcelas ({data.sales.length})
              </h2>
              {data.sales.length === 0 && (
                <p className="rounded-2xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">
                  Nenhuma venda registrada ainda.
                </p>
              )}
              {data.sales.map((sale) => (
                <SaleCard key={sale.saleId} sale={sale} isAdmin={data.isAdmin} />
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
