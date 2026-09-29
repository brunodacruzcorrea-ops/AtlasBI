/**
 * Calculo da previsao de comissao.
 *
 * Puro de proposito, sem banco: e regra de dinheiro e precisa de teste. As
 * rotas em routes/commissions.ts so buscam os dados e chamam aqui.
 *
 * Modelo: cada venda casa com uma regra (administradora + produto + tipo de
 * venda). A regra diz quanto do credito vira comissao (`totalPercent`), como
 * esse total e parcelado (`installments`, em % do total, somando 100) e como
 * ele e rateado entre Corretora, Gestao, Supervisao e Vendedor (somando 100).
 * O vendedor so recebe a parcela se o cliente pagou a mensalidade dele:
 * parcela marcada como inadimplente vira valor perdido, e, quando a
 * administradora estorna, o que ja foi pago volta como estorno.
 */

export type CommissionRule = {
  id: number;
  /** Vazio = qualquer administradora. Idem para product e segment. */
  administradora: string;
  product: string;
  segment: string;
  totalPercent: number;
  shareBroker: number;
  shareManagement: number;
  shareSupervision: number;
  shareSeller: number;
  installments: number[];
  /** Meses entre a venda e a 1a parcela (0 = paga no mes da venda). */
  firstPaymentDelayMonths: number;
  chargebackEnabled: boolean;
  /** So ha estorno se a inadimplencia ocorrer ate esta parcela. */
  chargebackInstallments: number;
  /** Quanto do ja recebido pelo vendedor e estornado (0-100). */
  chargebackPercent: number;
};

export type SaleInput = {
  id: number;
  consultantId: number;
  product: string;
  segment: string;
  amount: number;
  saleDate: string; // YYYY-MM-DD
  administradora: string;
};

export type InstallmentMark = "paid" | "defaulted";

export type InstallmentState = "received" | "forecast" | "defaulted";

export type InstallmentResult = {
  number: number;
  dueMonth: string; // YYYY-MM
  percentOfTotal: number;
  state: InstallmentState;
  total: number;
  broker: number;
  management: number;
  supervision: number;
  seller: number;
};

export type SaleCommission = {
  saleId: number;
  consultantId: number;
  administradora: string;
  product: string;
  segment: string;
  amount: number;
  saleDate: string;
  ruleId: number | null;
  totalCommission: number;
  sellerCommission: number;
  installments: InstallmentResult[];
  /** Estorno do que o vendedor ja recebeu (valor positivo = a devolver). */
  chargeback: { month: string; amount: number } | null;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function addMonths(ym: string, months: number): string {
  const [y, m] = ym.split("-").map(Number);
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Escolhe a regra mais especifica. Campo vazio na regra vale como coringa,
 * mas so casa se os campos preenchidos baterem; cada campo preenchido soma
 * um ponto, e administradora pesa mais que produto, que pesa mais que tipo.
 */
export function findRule(
  rules: CommissionRule[],
  sale: Pick<SaleInput, "administradora" | "product" | "segment">,
): CommissionRule | null {
  let best: CommissionRule | null = null;
  let bestScore = -1;
  for (const rule of rules) {
    let score = 0;
    const checks: [string, string, number][] = [
      [rule.administradora, sale.administradora, 4],
      [rule.product, sale.product, 2],
      [rule.segment, sale.segment, 1],
    ];
    let ok = true;
    for (const [ruleValue, saleValue, weight] of checks) {
      if (!ruleValue.trim()) continue;
      if (norm(ruleValue) !== norm(saleValue)) {
        ok = false;
        break;
      }
      score += weight;
    }
    if (ok && score > bestScore) {
      best = rule;
      bestScore = score;
    }
  }
  return best;
}

export function computeSaleCommission(
  sale: SaleInput,
  rule: CommissionRule | null,
  marks: Map<number, InstallmentMark>,
  currentMonth: string,
): SaleCommission {
  const base: SaleCommission = {
    saleId: sale.id,
    consultantId: sale.consultantId,
    administradora: sale.administradora,
    product: sale.product,
    segment: sale.segment,
    amount: sale.amount,
    saleDate: sale.saleDate,
    ruleId: rule?.id ?? null,
    totalCommission: 0,
    sellerCommission: 0,
    installments: [],
    chargeback: null,
  };
  if (!rule) return base;

  const totalCommission = round2((sale.amount * rule.totalPercent) / 100);
  const startMonth = addMonths(monthKey(sale.saleDate), rule.firstPaymentDelayMonths);

  const installments: InstallmentResult[] = rule.installments.map((pct, i) => {
    const number = i + 1;
    const dueMonth = addMonths(startMonth, i);
    const mark = marks.get(number);
    const state: InstallmentState =
      mark === "defaulted"
        ? "defaulted"
        : mark === "paid" || dueMonth < currentMonth
          ? "received"
          : "forecast";
    const total = round2((totalCommission * pct) / 100);
    const seller = round2((total * rule.shareSeller) / 100);
    return {
      number,
      dueMonth,
      percentOfTotal: pct,
      state,
      total,
      broker: round2((total * rule.shareBroker) / 100),
      management: round2((total * rule.shareManagement) / 100),
      supervision: round2((total * rule.shareSupervision) / 100),
      seller,
    };
  });

  let chargeback: SaleCommission["chargeback"] = null;
  if (rule.chargebackEnabled && rule.chargebackPercent > 0) {
    const firstDefault = installments.find(
      (i) => i.state === "defaulted" && i.number <= rule.chargebackInstallments,
    );
    if (firstDefault) {
      const alreadyReceived = installments
        .filter((i) => i.state === "received" && i.number < firstDefault.number)
        .reduce((sum, i) => sum + i.seller, 0);
      const amount = round2((alreadyReceived * rule.chargebackPercent) / 100);
      if (amount > 0) chargeback = { month: firstDefault.dueMonth, amount };
    }
  }

  return {
    ...base,
    totalCommission,
    // Parcela inadimplente nao gera repasse, entao fica fora do total.
    sellerCommission: round2(
      installments.filter((i) => i.state !== "defaulted").reduce((s, i) => s + i.seller, 0),
    ),
    installments,
    chargeback,
  };
}

export type MonthSummary = {
  month: string;
  forecast: number;
  received: number;
  defaulted: number;
  chargeback: number;
};

export type CommissionSummary = {
  forecast: number;
  received: number;
  defaulted: number;
  chargeback: number;
  months: MonthSummary[];
};

/** Consolida so a parte do vendedor, por mes. */
export function summarizeSeller(sales: SaleCommission[]): CommissionSummary {
  const byMonth = new Map<string, MonthSummary>();
  const slot = (month: string) => {
    let m = byMonth.get(month);
    if (!m) {
      m = { month, forecast: 0, received: 0, defaulted: 0, chargeback: 0 };
      byMonth.set(month, m);
    }
    return m;
  };

  for (const sale of sales) {
    for (const inst of sale.installments) {
      slot(inst.dueMonth)[inst.state] += inst.seller;
    }
    if (sale.chargeback) slot(sale.chargeback.month).chargeback += sale.chargeback.amount;
  }

  const months = [...byMonth.values()]
    .map((m) => ({
      month: m.month,
      forecast: round2(m.forecast),
      received: round2(m.received),
      defaulted: round2(m.defaulted),
      chargeback: round2(m.chargeback),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const sum = (key: Exclude<keyof MonthSummary, "month">) =>
    round2(months.reduce((s, m) => s + m[key], 0));

  return {
    forecast: sum("forecast"),
    received: sum("received"),
    defaulted: sum("defaulted"),
    chargeback: sum("chargeback"),
    months,
  };
}

const SHARE_TOLERANCE = 0.01;

/** Mensagem de erro se rateio ou parcelas nao fecham 100%, senao null. */
export function validateRuleShape(input: {
  shareBroker: number;
  shareManagement: number;
  shareSupervision: number;
  shareSeller: number;
  installments: number[];
}): string | null {
  const shares =
    input.shareBroker + input.shareManagement + input.shareSupervision + input.shareSeller;
  if (Math.abs(shares - 100) > SHARE_TOLERANCE) {
    return `O rateio precisa somar 100% (soma atual: ${round2(shares)}%)`;
  }
  if (input.installments.length === 0) return "Informe ao menos uma parcela";
  const parcels = input.installments.reduce((s, p) => s + p, 0);
  if (Math.abs(parcels - 100) > SHARE_TOLERANCE) {
    return `As parcelas precisam somar 100% da comissao (soma atual: ${round2(parcels)}%)`;
  }
  return null;
}
