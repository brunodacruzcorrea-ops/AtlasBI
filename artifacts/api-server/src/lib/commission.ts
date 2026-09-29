// Previsão de comissão do vendedor.
//
// A comissão de uma venda é paga parcelada, e o cronograma depende da
// administradora e do produto vendido. Cada regra guarda, por parcela, o
// percentual sobre o valor da venda e quantos meses depois do mês da venda ela
// cai. Aqui a regra vira parcelas datadas e valores em reais.
//
// Puro de propósito, sem banco: é regra de negócio com dinheiro e precisa de
// teste. Quem lê vendas e regras é routes/commissions.ts.

export type Installment = { percent: number; monthsAfterSale: number };

export type Rule = {
  id: number;
  administrator: string;
  product: string;
  installments: Installment[];
};

export type CommissionSale = {
  id: number;
  consultantId: number;
  product: string;
  administrator: string | null;
  amount: number;
  saleDate: string; // YYYY-MM-DD
};

export type ForecastInstallment = {
  saleId: number;
  number: number;
  totalInstallments: number;
  /** Mês em que a parcela é paga, YYYY-MM. */
  dueMonth: string;
  percent: number;
  amount: number;
};

export type SaleForecast = {
  saleId: number;
  /** Sem regra cadastrada para a administradora/produto: nada é previsto. */
  hasRule: boolean;
  installments: ForecastInstallment[];
};

/** Comparação de nomes ignora caixa, acento e espaços nas pontas. */
export function normalizeKey(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function findRule(
  rules: Rule[],
  sale: Pick<CommissionSale, "administrator" | "product">,
): Rule | null {
  const administrator = normalizeKey(sale.administrator);
  const product = normalizeKey(sale.product);
  if (!administrator || !product) return null;
  return (
    rules.find(
      (r) => normalizeKey(r.administrator) === administrator && normalizeKey(r.product) === product,
    ) ?? null
  );
}

/** Soma de meses a um YYYY-MM, sem passar por Date (evita fuso horário). */
export function addMonths(yearMonth: string, months: number): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const index = year * 12 + (month - 1) + months;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function forecastSale(sale: CommissionSale, rules: Rule[]): SaleForecast {
  const rule = findRule(rules, sale);
  if (!rule || rule.installments.length === 0) {
    return { saleId: sale.id, hasRule: false, installments: [] };
  }

  const saleMonth = sale.saleDate.slice(0, 7);
  const total = rule.installments.length;
  const installments = rule.installments.map((inst, i) => ({
    saleId: sale.id,
    number: i + 1,
    totalInstallments: total,
    dueMonth: addMonths(saleMonth, inst.monthsAfterSale),
    percent: inst.percent,
    amount: round2((sale.amount * inst.percent) / 100),
  }));
  return { saleId: sale.id, hasRule: true, installments };
}

export type MonthForecast = { month: string; amount: number; installmentCount: number };

/** Total previsto por mês de pagamento, em ordem cronológica. */
export function summarizeByMonth(forecasts: SaleForecast[]): MonthForecast[] {
  const byMonth = new Map<string, MonthForecast>();
  for (const forecast of forecasts) {
    for (const inst of forecast.installments) {
      const entry = byMonth.get(inst.dueMonth) ?? { month: inst.dueMonth, amount: 0, installmentCount: 0 };
      entry.amount = round2(entry.amount + inst.amount);
      entry.installmentCount += 1;
      byMonth.set(inst.dueMonth, entry);
    }
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** Valida o cronograma de uma regra; devolve a mensagem de erro ou null. */
export function validateInstallments(installments: Installment[]): string | null {
  if (installments.length === 0) return "Informe ao menos uma parcela";
  for (const inst of installments) {
    if (!(inst.percent > 0) || inst.percent > 100) return "O percentual de cada parcela deve estar entre 0 e 100";
    if (!Number.isInteger(inst.monthsAfterSale) || inst.monthsAfterSale < 0) {
      return "O mês de pagamento de cada parcela deve ser um inteiro a partir de 0";
    }
  }
  return null;
}
