import { useState } from "react";
import {
  useGetCommissionForecast,
  getGetCommissionForecastQueryKey,
  useListCommissionRules,
  getListCommissionRulesQueryKey,
  useCreateCommissionRule,
  useUpdateCommissionRule,
  useDeleteCommissionRule,
  useListConsultants,
  getListConsultantsQueryKey,
} from "@workspace/api-client-react";
import { Plus, Trash2, Edit2, Wallet, CalendarClock, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBRL } from "@/lib/utils";

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return `${MONTH_NAMES[(m ?? 1) - 1]}/${y}`;
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatDate(value: string): string {
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

type RuleDraft = {
  id: number | null;
  administrator: string;
  product: string;
  installments: { percent: string; monthsAfterSale: string }[];
};

const emptyDraft = (): RuleDraft => ({
  id: null,
  administrator: "",
  product: "",
  installments: [{ percent: "", monthsAfterSale: "0" }],
});

export default function Commissions() {
  const { isAdmin } = useAuth();
  const [consultantFilter, setConsultantFilter] = useState("all");
  const consultantId = isAdmin && consultantFilter !== "all" ? Number(consultantFilter) : undefined;

  const { data: consultants } = useListConsultants({
    query: { queryKey: getListConsultantsQueryKey(), enabled: isAdmin },
  });
  const { data: forecast, isLoading } = useGetCommissionForecast(
    { consultantId },
    { query: { queryKey: getGetCommissionForecastQueryKey({ consultantId }) } },
  );

  const now = currentYearMonth();
  const byMonth = forecast?.byMonth ?? [];
  const thisMonth = byMonth.find((m) => m.month === now)?.amount ?? 0;
  const upcoming = byMonth.filter((m) => m.month >= now);
  const toReceive = upcoming.reduce((sum, m) => sum + m.amount, 0);

  return (
    <div className="flex flex-col gap-6 lg:gap-8 pb-10">
      <div className="premium-glass rounded-3xl p-6 lg:p-8 flex flex-col md:flex-row items-start md:items-end justify-between gap-5">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-[-0.035em] text-foreground uppercase">
            Comissões
          </h1>
          <p className="text-muted-foreground font-medium mt-1">
            Previsão de recebimento, parcela a parcela
          </p>
        </div>
        {isAdmin && (
          <Select value={consultantFilter} onValueChange={setConsultantFilter}>
            <SelectTrigger className="w-full md:w-64 h-11">
              <SelectValue placeholder="Consultor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os consultores</SelectItem>
              {consultants?.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {forecast && !forecast.linked && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm font-medium">
          Seu usuário não está vinculado a um consultor. Peça ao administrador para cadastrar você em
          Consultores usando o mesmo e-mail do seu login.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard icon={CalendarClock} label="A receber neste mês" value={formatBRL(thisMonth)} />
        <SummaryCard icon={Wallet} label="Total a receber (próximos meses)" value={formatBRL(toReceive)} />
        <SummaryCard
          icon={AlertTriangle}
          label="Vendas sem regra de comissão"
          value={String(forecast?.salesWithoutRule ?? 0)}
          hint="Sem administradora ou sem regra cadastrada: não entram na previsão"
        />
      </div>

      <section className="premium-glass rounded-3xl p-6">
        <h2 className="text-lg font-black uppercase mb-4">Previsão por mês</h2>
        {isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : byMonth.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma parcela prevista.</p>
        ) : (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
            {byMonth.map((m) => (
              <div
                key={m.month}
                className={`rounded-xl border p-3 ${m.month === now ? "border-primary bg-primary/10" : m.month < now ? "opacity-60" : ""}`}
              >
                <p className="text-xs font-bold uppercase text-muted-foreground">
                  {formatMonth(m.month)} {m.month < now ? "· pago" : ""}
                </p>
                <p className="text-lg font-black">{formatBRL(m.amount)}</p>
                <p className="text-[11px] text-muted-foreground">{m.installmentCount} parcela(s)</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="premium-glass rounded-3xl p-6">
        <h2 className="text-lg font-black uppercase mb-4">Comissão por venda</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-4">Data</th>
                {isAdmin && <th className="py-2 pr-4">Consultor</th>}
                <th className="py-2 pr-4">Produto / Administradora</th>
                <th className="py-2 pr-4 text-right">Venda</th>
                <th className="py-2 pr-4 text-right">Comissão</th>
                <th className="py-2">Parcelas</th>
              </tr>
            </thead>
            <tbody>
              {forecast?.sales.map((s) => (
                <tr key={s.saleId} className="border-t align-top">
                  <td className="py-3 pr-4 whitespace-nowrap">{formatDate(s.saleDate)}</td>
                  {isAdmin && <td className="py-3 pr-4">{s.consultantName ?? "—"}</td>}
                  <td className="py-3 pr-4">
                    <p className="font-semibold">{s.product}</p>
                    <p className="text-xs text-muted-foreground">{s.administrator ?? "Sem administradora"}</p>
                  </td>
                  <td className="py-3 pr-4 text-right whitespace-nowrap">{formatBRL(s.amount)}</td>
                  <td className="py-3 pr-4 text-right whitespace-nowrap font-bold">
                    {s.hasRule ? formatBRL(s.totalCommission) : "—"}
                  </td>
                  <td className="py-3">
                    {s.hasRule ? (
                      <div className="flex flex-wrap gap-1.5">
                        {s.installments.map((i) => (
                          <span
                            key={i.number}
                            className={`rounded-md border px-2 py-1 text-xs ${i.dueMonth < now ? "opacity-60" : ""}`}
                            title={`${i.percent}% da venda`}
                          >
                            {i.number}/{i.totalInstallments} · {formatMonth(i.dueMonth)} · {formatBRL(i.amount)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sem regra cadastrada</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {forecast && forecast.sales.length === 0 && (
            <p className="text-muted-foreground py-4">Nenhuma venda nos últimos 12 meses.</p>
          )}
        </div>
      </section>

      {isAdmin && <RulesAdmin />}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="premium-glass rounded-2xl p-5" title={hint}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function RulesAdmin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: rules } = useListCommissionRules({ query: { queryKey: getListCommissionRulesQueryKey() } });
  const createMutation = useCreateCommissionRule();
  const updateMutation = useUpdateCommissionRule();
  const deleteMutation = useDeleteCommissionRule();
  const [draft, setDraft] = useState<RuleDraft | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getListCommissionRulesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetCommissionForecastQueryKey() });
    queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/commissions") });
  };

  const totalPercent = draft
    ? draft.installments.reduce((sum, i) => sum + (parseFloat(i.percent.replace(",", ".")) || 0), 0)
    : 0;

  const save = () => {
    if (!draft) return;
    const data = {
      administrator: draft.administrator.trim(),
      product: draft.product.trim(),
      installments: draft.installments.map((i) => ({
        percent: parseFloat(i.percent.replace(",", ".")),
        monthsAfterSale: parseInt(i.monthsAfterSale, 10),
      })),
    };
    const onSuccess = () => {
      refresh();
      toast({ title: "Regra salva" });
      setDraft(null);
    };
    const onError = () =>
      toast({
        title: "Não foi possível salvar a regra",
        description: "Confira administradora, produto e o cronograma de parcelas.",
        variant: "destructive",
      });
    if (draft.id) updateMutation.mutate({ id: draft.id, data }, { onSuccess, onError });
    else createMutation.mutate({ data }, { onSuccess, onError });
  };

  return (
    <section className="premium-glass rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-black uppercase">Regras de comissão</h2>
          <p className="text-xs text-muted-foreground">
            Cada combinação de administradora + produto tem seu cronograma de parcelas (visível só para admins).
          </p>
        </div>
        <Button onClick={() => setDraft(emptyDraft())} className="gap-2 font-bold">
          <Plus className="h-4 w-4" /> Nova regra
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {rules?.map((r) => (
          <div key={r.id} className="rounded-xl border p-4 flex justify-between gap-3">
            <div>
              <p className="font-bold">{r.administrator} · {r.product}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {r.installments
                  .map((i) => `${i.percent}% ${i.monthsAfterSale === 0 ? "no mês da venda" : `+${i.monthsAfterSale}m`}`)
                  .join(" · ")}
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Editar regra"
                onClick={() =>
                  setDraft({
                    id: r.id,
                    administrator: r.administrator,
                    product: r.product,
                    installments: r.installments.map((i) => ({
                      percent: String(i.percent),
                      monthsAfterSale: String(i.monthsAfterSale),
                    })),
                  })
                }
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Excluir regra"
                onClick={() => {
                  if (!window.confirm(`Excluir a regra ${r.administrator} · ${r.product}?`)) return;
                  deleteMutation.mutate({ id: r.id }, { onSuccess: refresh });
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {rules?.length === 0 && <p className="text-muted-foreground">Nenhuma regra cadastrada ainda.</p>}
      </div>

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase">{draft?.id ? "Editar regra" : "Nova regra"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="flex flex-col gap-4">
              <Input
                placeholder="Administradora (igual ao informado na venda)"
                value={draft.administrator}
                onChange={(e) => setDraft({ ...draft, administrator: e.target.value })}
              />
              <Input
                placeholder="Produto (igual ao informado na venda)"
                value={draft.product}
                onChange={(e) => setDraft({ ...draft, product: e.target.value })}
              />
              <div className="flex flex-col gap-2">
                <p className="text-xs font-bold uppercase text-muted-foreground">Parcelas</p>
                {draft.installments.map((inst, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-6 text-sm font-bold">{idx + 1}ª</span>
                    <Input
                      inputMode="decimal"
                      placeholder="% da venda"
                      value={inst.percent}
                      onChange={(e) => {
                        const installments = [...draft.installments];
                        installments[idx] = { ...inst, percent: e.target.value };
                        setDraft({ ...draft, installments });
                      }}
                    />
                    <Input
                      inputMode="numeric"
                      placeholder="meses após a venda"
                      value={inst.monthsAfterSale}
                      onChange={(e) => {
                        const installments = [...draft.installments];
                        installments[idx] = { ...inst, monthsAfterSale: e.target.value };
                        setDraft({ ...draft, installments });
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remover parcela"
                      disabled={draft.installments.length === 1}
                      onClick={() =>
                        setDraft({ ...draft, installments: draft.installments.filter((_, i) => i !== idx) })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        installments: [
                          ...draft.installments,
                          {
                            percent: "",
                            monthsAfterSale: String(
                              (parseInt(draft.installments[draft.installments.length - 1]?.monthsAfterSale ?? "0", 10) || 0) + 1,
                            ),
                          },
                        ],
                      })
                    }
                  >
                    <Plus className="h-4 w-4 mr-1" /> Parcela
                  </Button>
                  <span className="text-xs text-muted-foreground">Total: {totalPercent.toFixed(2)}% da venda</span>
                </div>
              </div>
              <Button
                onClick={save}
                disabled={
                  !draft.administrator.trim() ||
                  !draft.product.trim() ||
                  createMutation.isPending ||
                  updateMutation.isPending
                }
                className="font-bold"
              >
                Salvar regra
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
