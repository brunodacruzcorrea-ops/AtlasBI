import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

// Endpoints de comissao (routes/commissions.ts no api-server). Ficam fora do
// spec OpenAPI/codegen, entao o cliente e escrito a mao aqui.

export type CommissionRule = {
  id: number;
  administradora: string;
  product: string;
  segment: string;
  totalPercent: number;
  shareBroker: number;
  shareManagement: number;
  shareSupervision: number;
  shareSeller: number;
  installments: number[];
  firstPaymentDelayMonths: number;
  chargebackEnabled: boolean;
  chargebackInstallments: number;
  chargebackPercent: number;
};

export type RuleInput = Omit<CommissionRule, "id">;

export type InstallmentState = "received" | "forecast" | "defaulted";

export type Installment = {
  number: number;
  dueMonth: string;
  percentOfTotal: number;
  state: InstallmentState;
  seller: number;
  // Somente para admin:
  total?: number;
  broker?: number;
  management?: number;
  supervision?: number;
};

export type SaleCommission = {
  saleId: number;
  consultantId: number;
  consultantName: string | null;
  administradora: string;
  product: string;
  segment: string;
  amount: number;
  saleDate: string;
  ruleId: number | null;
  totalCommission?: number;
  sellerCommission: number;
  installments: Installment[];
  chargeback: { month: string; amount: number } | null;
};

export type MonthSummary = {
  month: string;
  forecast: number;
  received: number;
  defaulted: number;
  chargeback: number;
};

export type Forecast = {
  isAdmin: boolean;
  currentMonth: string;
  summary: {
    forecast: number;
    received: number;
    defaulted: number;
    chargeback: number;
    months: MonthSummary[];
  };
  sales: SaleCommission[];
};

const json = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

export const forecastKey = (consultantId?: number | null) =>
  ["commissions", "forecast", consultantId ?? "self"] as const;
export const rulesKey = ["commissions", "rules"] as const;

export function useForecast(consultantId?: number | null) {
  const qs = consultantId ? `?consultantId=${consultantId}` : "";
  return useQuery({
    queryKey: forecastKey(consultantId),
    queryFn: () => customFetch<Forecast>(`/api/commissions/forecast${qs}`),
    retry: false,
  });
}

export function useRules() {
  return useQuery({
    queryKey: rulesKey,
    queryFn: () => customFetch<CommissionRule[]>("/api/commissions/rules"),
  });
}

export function useSaveRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rule }: { id?: number; rule: RuleInput }) =>
      id
        ? customFetch<CommissionRule>(`/api/commissions/rules/${id}`, json("PUT", rule))
        : customFetch<CommissionRule>("/api/commissions/rules", json("POST", rule)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commissions"] }),
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch(`/api/commissions/rules/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commissions"] }),
  });
}

export function useSetAdministradora() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ saleId, administradora }: { saleId: number; administradora: string }) =>
      customFetch(`/api/commissions/sales/${saleId}`, json("PUT", { administradora })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commissions"] }),
  });
}

export function useMarkInstallment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      saleId: number;
      number: number;
      status: "paid" | "defaulted" | "pending";
      applyToRemaining?: boolean;
    }) =>
      customFetch(`/api/commissions/sales/${v.saleId}/installments/${v.number}`, json("PUT", {
        status: v.status,
        applyToRemaining: v.applyToRemaining ?? false,
      })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commissions"] }),
  });
}

export const formatMonth = (ym: string): string => {
  const [y, m] = ym.split("-").map(Number);
  const name = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(new Date(y, m - 1, 1));
  return `${name.replace(".", "")}/${String(y).slice(2)}`;
};

export const STATE_LABEL: Record<InstallmentState, string> = {
  received: "Recebida",
  forecast: "Prevista",
  defaulted: "Inadimplente",
};
