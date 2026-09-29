import { Router, type IRouter } from "express";
import { eq, gte } from "drizzle-orm";
import { db, commissionRulesTable, salesTable, consultantsTable } from "@workspace/db";
import {
  CreateCommissionRuleBody,
  CreateCommissionRuleResponse,
  UpdateCommissionRuleParams,
  UpdateCommissionRuleBody,
  UpdateCommissionRuleResponse,
  DeleteCommissionRuleParams,
  ListCommissionRulesResponse,
  GetCommissionForecastQueryParams,
  GetCommissionForecastResponse,
} from "@workspace/api-zod";
import { ensureAuth, ensureAdmin, resolveViewer } from "./auth";
import { forecastSale, summarizeByMonth, validateInstallments, type Rule } from "../lib/commission";

const router: IRouter = Router();

// Quanto tempo para trás olhar as vendas. Uma venda antiga ainda pode ter
// parcelas a receber; 12 meses cobre os cronogramas usuais e mantém o
// histórico de parcelas já pagas recente o bastante para ser útil.
const LOOKBACK_MONTHS = 12;

function mapRule(r: typeof commissionRulesTable.$inferSelect) {
  return {
    id: r.id,
    administrator: r.administrator,
    product: r.product,
    installments: r.installments,
  };
}

function lookbackStart(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - LOOKBACK_MONTHS, 1));
  return d.toISOString().slice(0, 10);
}

// As regras (percentuais de comissão) são conhecidas só por admins: o vendedor
// vê a previsão em reais, não a tabela de pagamento da empresa.
router.get("/commission-rules", ensureAuth, ensureAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(commissionRulesTable)
    .orderBy(commissionRulesTable.administrator, commissionRulesTable.product);
  res.json(ListCommissionRulesResponse.parse(rows.map(mapRule)));
});

router.post("/commission-rules", ensureAuth, ensureAdmin, async (req, res): Promise<void> => {
  const parsed = CreateCommissionRuleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const error = validateInstallments(parsed.data.installments);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  const [rule] = await db
    .insert(commissionRulesTable)
    .values({
      administrator: parsed.data.administrator.trim(),
      product: parsed.data.product.trim(),
      installments: parsed.data.installments,
    })
    .returning();
  res.status(201).json(CreateCommissionRuleResponse.parse(mapRule(rule)));
});

router.patch("/commission-rules/:id", ensureAuth, ensureAdmin, async (req, res): Promise<void> => {
  const params = UpdateCommissionRuleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCommissionRuleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const error = validateInstallments(parsed.data.installments);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  const [rule] = await db
    .update(commissionRulesTable)
    .set({
      administrator: parsed.data.administrator.trim(),
      product: parsed.data.product.trim(),
      installments: parsed.data.installments,
    })
    .where(eq(commissionRulesTable.id, params.data.id))
    .returning();
  if (!rule) {
    res.status(404).json({ error: "Regra não encontrada" });
    return;
  }
  res.json(UpdateCommissionRuleResponse.parse(mapRule(rule)));
});

router.delete("/commission-rules/:id", ensureAuth, ensureAdmin, async (req, res): Promise<void> => {
  const params = DeleteCommissionRuleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(commissionRulesTable)
    .where(eq(commissionRulesTable.id, params.data.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Regra não encontrada" });
    return;
  }
  res.json({ success: true });
});

router.get("/commissions/forecast", ensureAuth, async (req, res): Promise<void> => {
  const qp = GetCommissionForecastQueryParams.safeParse(req.query);
  if (!qp.success) {
    res.status(400).json({ error: qp.error.message });
    return;
  }

  // O escopo é decidido aqui, no servidor: vendedor só recebe as próprias
  // comissões, mesmo que mande consultantId de outra pessoa. Admin vê todos,
  // ou um consultor específico quando pedir.
  const viewer = await resolveViewer(req.userId);
  const scope = viewer.isAdmin ? (qp.data.consultantId ?? null) : viewer.consultantId;
  const linked = viewer.isAdmin || viewer.consultantId != null;

  if (!linked) {
    res.json(
      GetCommissionForecastResponse.parse({
        consultantId: null,
        linked: false,
        byMonth: [],
        sales: [],
        salesWithoutRule: 0,
      }),
    );
    return;
  }

  const [ruleRows, saleRows] = await Promise.all([
    db.select().from(commissionRulesTable),
    db
      .select({ sale: salesTable, consultantName: consultantsTable.name })
      .from(salesTable)
      .leftJoin(consultantsTable, eq(salesTable.consultantId, consultantsTable.id))
      .where(gte(salesTable.saleDate, lookbackStart())),
  ]);

  const rules: Rule[] = ruleRows.map((r) => ({
    id: r.id,
    administrator: r.administrator,
    product: r.product,
    installments: r.installments,
  }));

  const scoped = saleRows
    .filter((r) => scope == null || r.sale.consultantId === scope)
    .sort((a, b) => b.sale.saleDate.localeCompare(a.sale.saleDate));

  const forecasts = scoped.map((r) =>
    forecastSale(
      {
        id: r.sale.id,
        consultantId: r.sale.consultantId,
        product: r.sale.product,
        administrator: r.sale.administrator,
        amount: parseFloat(r.sale.amount),
        saleDate: r.sale.saleDate,
      },
      rules,
    ),
  );

  const sales = scoped.map((r, i) => {
    const f = forecasts[i]!;
    return {
      saleId: r.sale.id,
      consultantId: r.sale.consultantId,
      consultantName: r.consultantName ?? null,
      product: r.sale.product,
      administrator: r.sale.administrator ?? null,
      amount: parseFloat(r.sale.amount),
      saleDate: r.sale.saleDate,
      hasRule: f.hasRule,
      totalCommission: Math.round(f.installments.reduce((sum, inst) => sum + inst.amount, 0) * 100) / 100,
      installments: f.installments.map((inst) => ({
        number: inst.number,
        totalInstallments: inst.totalInstallments,
        dueMonth: inst.dueMonth,
        percent: inst.percent,
        amount: inst.amount,
      })),
    };
  });

  res.json(
    GetCommissionForecastResponse.parse({
      consultantId: scope,
      linked: true,
      byMonth: summarizeByMonth(forecasts),
      sales,
      salesWithoutRule: forecasts.filter((f) => !f.hasRule).length,
    }),
  );
});

export default router;
