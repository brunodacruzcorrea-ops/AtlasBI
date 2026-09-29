import { Router, type IRouter } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  salesTable,
  consultantsTable,
  commissionRulesTable,
  saleCommissionMetaTable,
  commissionInstallmentMarksTable,
} from "@workspace/db";
import { ensureAuth, ensureAdmin, resolveViewer } from "./auth";
import {
  computeSaleCommission,
  findRule,
  summarizeSeller,
  validateRuleShape,
  type CommissionRule,
  type InstallmentMark,
  type SaleCommission,
} from "../lib/commission";

// Previsao de comissao do vendedor e cadastro das regras (rateio, parcelas,
// inadimplencia e estorno). Regra de calculo em lib/commission.ts.

const router: IRouter = Router();

let tablesReady: Promise<unknown> | null = null;

function ensureTables(): Promise<unknown> {
  tablesReady ??= (async () => {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS commission_rules (
      id serial PRIMARY KEY,
      administradora text NOT NULL DEFAULT '',
      product text NOT NULL DEFAULT '',
      segment text NOT NULL DEFAULT '',
      total_percent numeric(7,4) NOT NULL,
      share_broker numeric(6,2) NOT NULL,
      share_management numeric(6,2) NOT NULL,
      share_supervision numeric(6,2) NOT NULL,
      share_seller numeric(6,2) NOT NULL,
      installments jsonb NOT NULL,
      first_payment_delay_months integer NOT NULL DEFAULT 1,
      chargeback_enabled boolean NOT NULL DEFAULT false,
      chargeback_installments integer NOT NULL DEFAULT 0,
      chargeback_percent numeric(6,2) NOT NULL DEFAULT 100,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS sale_commission_meta (
      sale_id integer PRIMARY KEY,
      administradora text NOT NULL DEFAULT ''
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS commission_installment_marks (
      id serial PRIMARY KEY,
      sale_id integer NOT NULL,
      installment integer NOT NULL,
      status text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (sale_id, installment)
    )`);
  })().catch((err) => {
    tablesReady = null;
    throw err;
  });
  return tablesReady;
}

const withTables = async (_req: any, _res: any, next: any) => {
  try {
    await ensureTables();
    next();
  } catch (err) {
    next(err);
  }
};

function mapRule(r: typeof commissionRulesTable.$inferSelect): CommissionRule {
  return {
    id: r.id,
    administradora: r.administradora,
    product: r.product,
    segment: r.segment,
    totalPercent: parseFloat(r.totalPercent),
    shareBroker: parseFloat(r.shareBroker),
    shareManagement: parseFloat(r.shareManagement),
    shareSupervision: parseFloat(r.shareSupervision),
    shareSeller: parseFloat(r.shareSeller),
    installments: r.installments,
    firstPaymentDelayMonths: r.firstPaymentDelayMonths,
    chargebackEnabled: r.chargebackEnabled,
    chargebackInstallments: r.chargebackInstallments,
    chargebackPercent: parseFloat(r.chargebackPercent),
  };
}

const pct = (v: unknown, max = 100): number | null => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max ? n : null;
};

type ParsedRule = Omit<CommissionRule, "id">;

/** Valida o corpo de criacao/edicao; devolve a regra ou a mensagem de erro. */
function parseRuleBody(body: any): { rule: ParsedRule } | { error: string } {
  const b = body ?? {};
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const totalPercent = pct(b.totalPercent);
  const shareBroker = pct(b.shareBroker);
  const shareManagement = pct(b.shareManagement);
  const shareSupervision = pct(b.shareSupervision);
  const shareSeller = pct(b.shareSeller);
  if (totalPercent === null || totalPercent <= 0) {
    return { error: "Informe o percentual total da comissão (maior que 0 e até 100)" };
  }
  if (
    shareBroker === null ||
    shareManagement === null ||
    shareSupervision === null ||
    shareSeller === null
  ) {
    return { error: "Informe o rateio de Corretora, Gestão, Supervisão e Vendedor (0 a 100)" };
  }
  if (!Array.isArray(b.installments)) return { error: "Informe as parcelas" };
  const installments: number[] = [];
  for (const p of b.installments) {
    const n = pct(p);
    if (n === null) return { error: "Cada parcela deve ser um percentual entre 0 e 100" };
    installments.push(n);
  }
  const shapeError = validateRuleShape({
    shareBroker,
    shareManagement,
    shareSupervision,
    shareSeller,
    installments,
  });
  if (shapeError) return { error: shapeError };

  const delay = Number(b.firstPaymentDelayMonths ?? 1);
  if (!Number.isInteger(delay) || delay < 0 || delay > 24) {
    return { error: "Meses até a 1ª parcela deve ser um inteiro entre 0 e 24" };
  }
  const chargebackEnabled = b.chargebackEnabled === true;
  const chargebackInstallments = Number(b.chargebackInstallments ?? 0);
  if (!Number.isInteger(chargebackInstallments) || chargebackInstallments < 0) {
    return { error: "Janela de estorno inválida" };
  }
  const chargebackPercent = pct(b.chargebackPercent ?? 100);
  if (chargebackPercent === null) return { error: "Percentual de estorno inválido" };

  return {
    rule: {
      administradora: text(b.administradora),
      product: text(b.product),
      segment: text(b.segment),
      totalPercent,
      shareBroker,
      shareManagement,
      shareSupervision,
      shareSeller,
      installments,
      firstPaymentDelayMonths: delay,
      chargebackEnabled,
      chargebackInstallments,
      chargebackPercent,
    },
  };
}

const ruleValues = (r: ParsedRule) => ({
  administradora: r.administradora,
  product: r.product,
  segment: r.segment,
  totalPercent: String(r.totalPercent),
  shareBroker: String(r.shareBroker),
  shareManagement: String(r.shareManagement),
  shareSupervision: String(r.shareSupervision),
  shareSeller: String(r.shareSeller),
  installments: r.installments,
  firstPaymentDelayMonths: r.firstPaymentDelayMonths,
  chargebackEnabled: r.chargebackEnabled,
  chargebackInstallments: r.chargebackInstallments,
  chargebackPercent: String(r.chargebackPercent),
});

router.get("/commissions/rules", ensureAuth, ensureAdmin, withTables, async (_req, res) => {
  const rows = await db.select().from(commissionRulesTable).orderBy(commissionRulesTable.id);
  res.json(rows.map(mapRule));
});

router.post("/commissions/rules", ensureAuth, ensureAdmin, withTables, async (req, res) => {
  const parsed = parseRuleBody(req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const [row] = await db.insert(commissionRulesTable).values(ruleValues(parsed.rule)).returning();
  res.status(201).json(mapRule(row));
});

router.put("/commissions/rules/:id", ensureAuth, ensureAdmin, withTables, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Id inválido" });
    return;
  }
  const parsed = parseRuleBody(req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const [row] = await db
    .update(commissionRulesTable)
    .set(ruleValues(parsed.rule))
    .where(eq(commissionRulesTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Regra não encontrada" });
    return;
  }
  res.json(mapRule(row));
});

router.delete("/commissions/rules/:id", ensureAuth, ensureAdmin, withTables, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Id inválido" });
    return;
  }
  await db.delete(commissionRulesTable).where(eq(commissionRulesTable.id, id));
  res.status(204).end();
});

// Administradora de uma venda (o webhook do CRM ainda nao envia esse dado).
router.put("/commissions/sales/:saleId", ensureAuth, ensureAdmin, withTables, async (req, res) => {
  const saleId = Number(req.params.saleId);
  const administradora =
    typeof req.body?.administradora === "string" ? req.body.administradora.trim() : null;
  if (!Number.isInteger(saleId) || administradora === null) {
    res.status(400).json({ error: "Venda ou administradora inválida" });
    return;
  }
  await db
    .insert(saleCommissionMetaTable)
    .values({ saleId, administradora })
    .onConflictDoUpdate({
      target: saleCommissionMetaTable.saleId,
      set: { administradora },
    });
  res.json({ saleId, administradora });
});

// Marca parcela como paga/inadimplente, ou limpa a marca (status "pending").
// `applyToRemaining` replica a marca nas parcelas seguintes: quando o cliente
// para de pagar, todas as demais parcelas se perdem.
router.put(
  "/commissions/sales/:saleId/installments/:number",
  ensureAuth,
  ensureAdmin,
  withTables,
  async (req, res) => {
    const saleId = Number(req.params.saleId);
    const number = Number(req.params.number);
    const status = req.body?.status;
    const validStatus = status === "paid" || status === "defaulted" || status === "pending";
    if (!Number.isInteger(saleId) || !Number.isInteger(number) || number < 1 || !validStatus) {
      res.status(400).json({ error: "Parcela ou status inválido" });
      return;
    }

    const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, saleId)).limit(1);
    if (!sale) {
      res.status(404).json({ error: "Venda não encontrada" });
      return;
    }

    let last = number;
    if (req.body?.applyToRemaining === true) {
      const [meta] = await db
        .select()
        .from(saleCommissionMetaTable)
        .where(eq(saleCommissionMetaTable.saleId, saleId));
      const rules = (await db.select().from(commissionRulesTable)).map(mapRule);
      const rule = findRule(rules, {
        administradora: meta?.administradora ?? "",
        product: sale.product,
        segment: sale.segment,
      });
      last = Math.max(number, rule?.installments.length ?? number);
    }

    for (let n = number; n <= last; n++) {
      if (status === "pending") {
        await db
          .delete(commissionInstallmentMarksTable)
          .where(
            and(
              eq(commissionInstallmentMarksTable.saleId, saleId),
              eq(commissionInstallmentMarksTable.installment, n),
            ),
          );
      } else {
        await db
          .insert(commissionInstallmentMarksTable)
          .values({ saleId, installment: n, status })
          .onConflictDoUpdate({
            target: [
              commissionInstallmentMarksTable.saleId,
              commissionInstallmentMarksTable.installment,
            ],
            set: { status, updatedAt: new Date() },
          });
      }
    }
    res.json({ saleId, from: number, to: last, status });
  },
);

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

async function buildCommissions(consultantId: number | null): Promise<SaleCommission[]> {
  const rules = (await db.select().from(commissionRulesTable)).map(mapRule);
  const salesRows = await db
    .select()
    .from(salesTable)
    .where(consultantId === null ? undefined : eq(salesTable.consultantId, consultantId))
    .orderBy(sql`${salesTable.saleDate} DESC`);
  if (salesRows.length === 0) return [];

  const ids = salesRows.map((s) => s.id);
  const metas = await db
    .select()
    .from(saleCommissionMetaTable)
    .where(inArray(saleCommissionMetaTable.saleId, ids));
  const marks = await db
    .select()
    .from(commissionInstallmentMarksTable)
    .where(inArray(commissionInstallmentMarksTable.saleId, ids));

  const adminBySale = new Map(metas.map((m) => [m.saleId, m.administradora]));
  const marksBySale = new Map<number, Map<number, InstallmentMark>>();
  for (const m of marks) {
    const bucket = marksBySale.get(m.saleId) ?? new Map<number, InstallmentMark>();
    bucket.set(m.installment, m.status as InstallmentMark);
    marksBySale.set(m.saleId, bucket);
  }

  const month = currentMonth();
  return salesRows.map((s) => {
    const input = {
      id: s.id,
      consultantId: s.consultantId,
      product: s.product,
      segment: s.segment,
      amount: parseFloat(s.amount),
      saleDate: s.saleDate,
      administradora: adminBySale.get(s.id) ?? "",
    };
    return computeSaleCommission(
      input,
      findRule(rules, input),
      marksBySale.get(s.id) ?? new Map(),
      month,
    );
  });
}

// Previsao de comissao. O vendedor so enxerga a propria parte e as proprias
// vendas; o rateio dos demais (Corretora, Gestao, Supervisao) e do admin.
router.get("/commissions/forecast", ensureAuth, withTables, async (req, res) => {
  const viewer = await resolveViewer(req.userId);

  let consultantId: number | null;
  if (viewer.isAdmin) {
    const q = req.query.consultantId;
    consultantId = q === undefined || q === "" ? null : Number(q);
    if (consultantId !== null && !Number.isInteger(consultantId)) {
      res.status(400).json({ error: "consultantId inválido" });
      return;
    }
  } else if (viewer.consultantId !== null) {
    consultantId = viewer.consultantId;
  } else {
    res.status(404).json({
      error:
        "Seu usuário não está ligado a um vendedor. Peça ao administrador para cadastrar o consultor com o mesmo e-mail do seu login.",
    });
    return;
  }

  const sales = await buildCommissions(consultantId);
  const names = new Map(
    (await db.select({ id: consultantsTable.id, name: consultantsTable.name }).from(consultantsTable)).map(
      (c) => [c.id, c.name],
    ),
  );

  res.json({
    isAdmin: viewer.isAdmin,
    currentMonth: currentMonth(),
    summary: summarizeSeller(sales),
    sales: sales.map((s) => ({
      ...s,
      consultantName: names.get(s.consultantId) ?? null,
      installments: s.installments.map((i) =>
        viewer.isAdmin
          ? i
          : { number: i.number, dueMonth: i.dueMonth, percentOfTotal: i.percentOfTotal, state: i.state, seller: i.seller },
      ),
      // Total da comissao (base do rateio) e do admin.
      totalCommission: viewer.isAdmin ? s.totalCommission : undefined,
    })),
  });
});

export default router;
