import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { cn, formatBRL } from "@/lib/utils";
import {
  formatMonth,
  STATE_LABEL,
  useDeleteRule,
  useForecast,
  useMarkInstallment,
  useRules,
  useSaveRule,
  useSetAdministradora,
  type CommissionRule,
  type RuleInput,
  type SaleCommission,
} from "@/lib/commissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const num = (s: string) => Number(s.replace(",", "."));
const parseInstallments = (s: string) =>
  s
    .split(/[;,\s]+/)
    .filter(Boolean)
    .map(num);

type FormState = {
  administradora: string;
  product: string;
  segment: string;
  totalPercent: string;
  shareBroker: string;
  shareManagement: string;
  shareSupervision: string;
  shareSeller: string;
  installments: string;
  firstPaymentDelayMonths: string;
  chargebackEnabled: boolean;
  chargebackInstallments: string;
  chargebackPercent: string;
};

const EMPTY: FormState = {
  administradora: "",
  product: "",
  segment: "",
  totalPercent: "",
  shareBroker: "",
  shareManagement: "",
  shareSupervision: "",
  shareSeller: "",
  installments: "",
  firstPaymentDelayMonths: "1",
  chargebackEnabled: false,
  chargebackInstallments: "0",
  chargebackPercent: "100",
};

const fromRule = (r: CommissionRule): FormState => ({
  administradora: r.administradora,
  product: r.product,
  segment: r.segment,
  totalPercent: String(r.totalPercent),
  shareBroker: String(r.shareBroker),
  shareManagement: String(r.shareManagement),
  shareSupervision: String(r.shareSupervision),
  shareSeller: String(r.shareSeller),
  installments: r.installments.join(", "),
  firstPaymentDelayMonths: String(r.firstPaymentDelayMonths),
  chargebackEnabled: r.chargebackEnabled,
  chargebackInstallments: String(r.chargebackInstallments),
  chargebackPercent: String(r.chargebackPercent),
});

const toInput = (f: FormState): RuleInput => ({
  administradora: f.administradora.trim(),
  product: f.product.trim(),
  segment: f.segment.trim(),
  totalPercent: num(f.totalPercent),
  shareBroker: num(f.shareBroker || "0"),
  shareManagement: num(f.shareManagement || "0"),
  shareSupervision: num(f.shareSupervision || "0"),
  shareSeller: num(f.shareSeller || "0"),
  installments: parseInstallments(f.installments),
  firstPaymentDelayMonths: Number(f.firstPaymentDelayMonths || "0"),
  chargebackEnabled: f.chargebackEnabled,
  chargebackInstallments: Number(f.chargebackInstallments || "0"),
  chargebackPercent: num(f.chargebackPercent || "0"),
});

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SumBadge({ value, label }: { value: number; label: string }) {
  const ok = Math.abs(value - 100) <= 0.01;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-bold",
        ok ? "bg-emerald-500/15 text-emerald-600" : "bg-destructive/15 text-destructive",
      )}
    >
      {label}: {Math.round(value * 100) / 100}%
    </span>
  );
}

function RuleDialog({
  open,
  rule,
  onClose,
}: {
  open: boolean;
  rule: CommissionRule | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const save = useSaveRule();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [seed, setSeed] = useState<number | null | undefined>(undefined);

  // Reinicia o formulario a cada abertura (nova regra ou regra diferente).
  const key = open ? (rule?.id ?? null) : undefined;
  if (key !== seed) {
    setSeed(key);
    if (open) setForm(rule ? fromRule(rule) : EMPTY);
  }

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const shareSum =
    num(form.shareBroker || "0") +
    num(form.shareManagement || "0") +
    num(form.shareSupervision || "0") +
    num(form.shareSeller || "0");
  const installments = parseInstallments(form.installments);
  const installmentSum = installments.reduce((s, p) => s + (Number.isFinite(p) ? p : 0), 0);

  const submit = () =>
    save.mutate(
      { id: rule?.id, rule: toInput(form) },
      {
        onSuccess: () => {
          toast({ title: "Regra salva" });
          onClose();
        },
        onError: (err: any) =>
          toast({ title: "Não foi possível salvar", description: err.message, variant: "destructive" }),
      },
    );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? "Editar regra" : "Nova regra de comissão"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Administradora" hint="Vazio = qualquer">
              <Input value={form.administradora} onChange={set("administradora")} placeholder="Ex.: Porto Seguro" />
            </Field>
            <Field label="Produto" hint="Vazio = qualquer">
              <Input value={form.product} onChange={set("product")} placeholder="Ex.: Imóvel" />
            </Field>
            <Field label="Tipo de venda" hint="Vazio = qualquer">
              <Input value={form.segment} onChange={set("segment")} placeholder="Ex.: Novo" />
            </Field>
          </div>

          <Field label="Comissão total (% do crédito)">
            <Input inputMode="decimal" value={form.totalPercent} onChange={set("totalPercent")} placeholder="Ex.: 2,5" />
          </Field>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold">Rateio da comissão</p>
              <SumBadge value={shareSum} label="Soma" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Corretora %">
                <Input inputMode="decimal" value={form.shareBroker} onChange={set("shareBroker")} />
              </Field>
              <Field label="Gestão %">
                <Input inputMode="decimal" value={form.shareManagement} onChange={set("shareManagement")} />
              </Field>
              <Field label="Supervisão %">
                <Input inputMode="decimal" value={form.shareSupervision} onChange={set("shareSupervision")} />
              </Field>
              <Field label="Vendedor %">
                <Input inputMode="decimal" value={form.shareSeller} onChange={set("shareSeller")} />
              </Field>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold">Parcelas da comissão</p>
              <SumBadge value={installmentSum} label={`${installments.length} parcelas`} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="% da comissão em cada parcela" hint="Separe por vírgula. Ex.: 30, 20, 20, 30">
                <Input value={form.installments} onChange={set("installments")} placeholder="30, 20, 20, 30" />
              </Field>
              <Field label="Meses até a 1ª parcela" hint="0 = paga no mês da venda">
                <Input inputMode="numeric" value={form.firstPaymentDelayMonths} onChange={set("firstPaymentDelayMonths")} />
              </Field>
            </div>
          </div>

          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">Estorno de comissão</p>
                <p className="text-xs text-muted-foreground">
                  Se o cliente ficar inadimplente, o que o vendedor já recebeu é devolvido.
                </p>
              </div>
              <Switch
                checked={form.chargebackEnabled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, chargebackEnabled: v }))}
                aria-label="Estorno de comissão"
              />
            </div>
            {form.chargebackEnabled && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Estorna se a inadimplência ocorrer até a parcela" hint="Ex.: 3 = só nas 3 primeiras">
                  <Input inputMode="numeric" value={form.chargebackInstallments} onChange={set("chargebackInstallments")} />
                </Field>
                <Field label="% estornado do já recebido">
                  <Input inputMode="decimal" value={form.chargebackPercent} onChange={set("chargebackPercent")} />
                </Field>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar regra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RulesTab() {
  const { data: rules, isLoading } = useRules();
  const del = useDeleteRule();
  const { toast } = useToast();
  const [editing, setEditing] = useState<CommissionRule | null>(null);
  const [open, setOpen] = useState(false);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          A regra mais específica vence: administradora + produto + tipo de venda antes de uma regra geral.
        </p>
        <Button onClick={openNew} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" /> Nova regra
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {rules?.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhuma regra cadastrada. Sem regra, o vendedor não vê previsão de comissão.
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {rules?.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold">{r.administradora || "Qualquer administradora"}</p>
                <p className="text-xs text-muted-foreground">
                  {r.product || "Qualquer produto"} · {r.segment || "Qualquer tipo de venda"}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Editar regra"
                  onClick={() => {
                    setEditing(r);
                    setOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Excluir regra"
                  onClick={() => {
                    if (!confirm("Excluir esta regra? Vendas que dependem dela ficam sem previsão.")) return;
                    del.mutate(r.id, {
                      onError: (err: any) =>
                        toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" }),
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <dt className="text-muted-foreground">Comissão total</dt>
              <dd className="text-right font-bold">{r.totalPercent}% do crédito</dd>
              <dt className="text-muted-foreground">Rateio (Corr/Gest/Sup/Vend)</dt>
              <dd className="text-right font-bold">
                {r.shareBroker} / {r.shareManagement} / {r.shareSupervision} / {r.shareSeller}
              </dd>
              <dt className="text-muted-foreground">Parcelas</dt>
              <dd className="text-right font-bold">{r.installments.join(" · ")}%</dd>
              <dt className="text-muted-foreground">1ª parcela</dt>
              <dd className="text-right font-bold">
                {r.firstPaymentDelayMonths === 0 ? "no mês da venda" : `${r.firstPaymentDelayMonths} mês(es) depois`}
              </dd>
              <dt className="text-muted-foreground">Estorno</dt>
              <dd className="text-right font-bold">
                {r.chargebackEnabled
                  ? `${r.chargebackPercent}% até a ${r.chargebackInstallments}ª parcela`
                  : "não estorna"}
              </dd>
            </dl>
          </div>
        ))}
      </div>

      <RuleDialog open={open} rule={editing} onClose={() => setOpen(false)} />
    </div>
  );
}

function SaleControl({ sale }: { sale: SaleCommission }) {
  const mark = useMarkInstallment();
  const setAdmin = useSetAdministradora();
  const { toast } = useToast();
  const [admin, setAdminText] = useState(sale.administradora);

  const onError = (err: any) =>
    toast({ title: "Não foi possível atualizar", description: err.message, variant: "destructive" });

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold">
            {sale.consultantName ?? `Vendedor ${sale.consultantId}`}
            <span className="font-medium text-muted-foreground">
              {" "}
              · {sale.product} · {sale.segment}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Crédito {formatBRL(sale.amount)} · {sale.saleDate.slice(0, 10).split("-").reverse().join("/")}
          </p>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setAdmin.mutate(
              { saleId: sale.saleId, administradora: admin },
              { onSuccess: () => toast({ title: "Administradora atualizada" }), onError },
            );
          }}
        >
          <Input
            value={admin}
            onChange={(e) => setAdminText(e.target.value)}
            placeholder="Administradora"
            className="h-9 w-44"
            aria-label="Administradora da venda"
          />
          <Button type="submit" size="sm" variant="outline" disabled={admin.trim() === sale.administradora}>
            Salvar
          </Button>
        </form>
      </div>

      {sale.ruleId === null ? (
        <p className="mt-3 text-xs font-semibold text-amber-600">
          Nenhuma regra de comissão encontrada para esta venda.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2 font-semibold">Parcela</th>
                <th className="px-2 font-semibold">Mês</th>
                <th className="px-2 text-right font-semibold">Comissão</th>
                <th className="px-2 text-right font-semibold">Vendedor</th>
                <th className="px-2 font-semibold">Situação</th>
                <th className="pl-2 text-right font-semibold">Ação</th>
              </tr>
            </thead>
            <tbody>
              {sale.installments.map((i) => (
                <tr key={i.number} className="border-t border-border">
                  <td className="py-1.5 pr-2 font-semibold">{i.number}ª</td>
                  <td className="px-2">{formatMonth(i.dueMonth)}</td>
                  <td className="px-2 text-right tabular-nums">{formatBRL(i.total ?? 0)}</td>
                  <td className="px-2 text-right font-bold tabular-nums">{formatBRL(i.seller)}</td>
                  <td
                    className={cn(
                      "px-2 font-semibold",
                      i.state === "defaulted" && "text-destructive",
                      i.state === "received" && "text-emerald-600",
                    )}
                  >
                    {STATE_LABEL[i.state]}
                  </td>
                  <td className="space-x-1 pl-2 text-right">
                    {i.state === "defaulted" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() =>
                          mark.mutate({ saleId: sale.saleId, number: i.number, status: "pending" }, { onError })
                        }
                      >
                        Desfazer
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs text-destructive"
                          title="Cliente não pagou: o vendedor não recebe o repasse desta parcela"
                          onClick={() =>
                            mark.mutate({ saleId: sale.saleId, number: i.number, status: "defaulted" }, { onError })
                          }
                        >
                          Inadimplente
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-destructive"
                          title="Marca esta e todas as parcelas seguintes"
                          onClick={() =>
                            mark.mutate(
                              { saleId: sale.saleId, number: i.number, status: "defaulted", applyToRemaining: true },
                              { onError },
                            )
                          }
                        >
                          + seguintes
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sale.chargeback && (
            <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
              Estorno ao vendedor: {formatBRL(sale.chargeback.amount)} em {formatMonth(sale.chargeback.month)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function InstallmentsTab() {
  const { data, isLoading } = useForecast(null);
  const [search, setSearch] = useState("");

  const sales = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!data) return [];
    if (!term) return data.sales;
    return data.sales.filter((s) =>
      [s.consultantName, s.product, s.segment, s.administradora].some((v) => v?.toLowerCase().includes(term)),
    );
  }, [data, search]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Parcelas de meses anteriores contam como recebidas, a menos que você marque a inadimplência. Parcela
        inadimplente não gera repasse ao vendedor.
      </p>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por vendedor, produto ou administradora"
        className="max-w-md"
      />
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      <div className="space-y-3">
        {sales.map((s) => (
          <SaleControl key={`${s.saleId}-${s.administradora}`} sale={s} />
        ))}
      </div>
    </div>
  );
}

export default function CommissionRulesPage() {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return <p className="p-6 text-sm text-muted-foreground">Acesso restrito a administradores.</p>;
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Regras de comissão</h1>
        <p className="text-sm text-muted-foreground">
          Rateio, parcelas por administradora, inadimplência e estorno. Tudo editável.
        </p>
      </div>
      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Regras</TabsTrigger>
          <TabsTrigger value="installments">Parcelas e inadimplência</TabsTrigger>
        </TabsList>
        <TabsContent value="rules" className="mt-4">
          <RulesTab />
        </TabsContent>
        <TabsContent value="installments" className="mt-4">
          <InstallmentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
