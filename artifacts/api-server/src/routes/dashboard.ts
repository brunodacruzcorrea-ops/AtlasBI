import { Router, type IRouter } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, salesTable, goalsTable, consultantsTable } from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetDashboardRankingResponse,
  GetProductionChartResponse,
  GetDashboardSummaryQueryParams,
  GetDashboardRankingQueryParams,
  GetProductionChartQueryParams,
} from "@workspace/api-zod";
import { ensureAuth, resolveViewer } from "./auth";
import { maskRankingGoals } from "../lib/visibility";
import { monthRange, yearRange } from "../lib/date-range";
import { gte, lt } from "drizzle-orm";

const router: IRouter = Router();

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

router.get("/dashboard/summary", ensureAuth, async (req, res): Promise<void> => {
  const qp = GetDashboardSummaryQueryParams.safeParse(req.query);
  if (!qp.success) {
    res.status(400).json({ error: qp.error.message });
    return;
  }

  const now = new Date();
  const month = qp.data.month ?? now.getMonth() + 1;
  const year = qp.data.year ?? now.getFullYear();

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  // Faixa de datas em vez de EXTRACT: mesmas linhas, mas usa o indice de
  // sale_date. Ver lib/date-range.
  const current = monthRange(year, month);
  const previous = monthRange(prevYear, prevMonth);

  // Current month sales
  const currentSalesRows = await db
    .select({
      totalAmount: sql<string>`COALESCE(SUM(${salesTable.amount}), 0)`,
      totalQuantity: sql<string>`COALESCE(SUM(${salesTable.quantity}), 0)`,
    })
    .from(salesTable)
    .where(
      and(
        gte(salesTable.saleDate, current.start),
        lt(salesTable.saleDate, current.endExclusive)
      )
    );

  const totalSales = parseFloat(currentSalesRows[0]?.totalAmount ?? "0");
  const totalQuantity = parseInt(currentSalesRows[0]?.totalQuantity ?? "0");

  // Previous month sales
  const prevSalesRows = await db
    .select({ totalAmount: sql<string>`COALESCE(SUM(${salesTable.amount}), 0)` })
    .from(salesTable)
    .where(
      and(
        gte(salesTable.saleDate, previous.start),
        lt(salesTable.saleDate, previous.endExclusive)
      )
    );
  const prevSales = parseFloat(prevSalesRows[0]?.totalAmount ?? "0");
  const growthPercent = prevSales > 0 ? ((totalSales - prevSales) / prevSales) * 100 : null;

  // Team goal for this month
  const [teamGoal] = await db
    .select()
    .from(goalsTable)
    .where(
      and(
        sql`${goalsTable.consultantId} IS NULL`,
        eq(goalsTable.month, month),
        eq(goalsTable.year, year)
      )
    )
    .limit(1);

  const goalAmount = parseFloat(teamGoal?.targetAmount ?? "0");
  const goalAchievementPercent = goalAmount > 0 ? (totalSales / goalAmount) * 100 : 0;

  // Consultants count
  const [consultantCounts] = await db
    .select({
      total: sql<string>`COUNT(*)`,
      active: sql<string>`COUNT(*) FILTER (WHERE active = true)`,
    })
    .from(consultantsTable);

  const totalConsultants = parseInt(consultantCounts?.total ?? "0");
  const activeConsultants = parseInt(consultantCounts?.active ?? "0");

  // Top consultant
  const topRows = await db
    .select({
      consultantId: salesTable.consultantId,
      consultantName: consultantsTable.name,
      photo: consultantsTable.photo,
      totalAmount: sql<string>`SUM(${salesTable.amount})`,
    })
    .from(salesTable)
    .leftJoin(consultantsTable, eq(salesTable.consultantId, consultantsTable.id))
    .where(
      and(
        gte(salesTable.saleDate, current.start),
        lt(salesTable.saleDate, current.endExclusive)
      )
    )
    .groupBy(salesTable.consultantId, consultantsTable.name, consultantsTable.photo)
    .orderBy(desc(sql`SUM(${salesTable.amount})`))
    .limit(1);

  const topConsultant = topRows[0];

  res.json(
    GetDashboardSummaryResponse.parse({
      totalSales,
      totalQuantity,
      totalConsultants,
      activeConsultants,
      goalAmount,
      goalAchievementPercent: Math.round(goalAchievementPercent * 10) / 10,
      topConsultantName: topConsultant?.consultantName ?? null,
      topConsultantAmount: topConsultant ? parseFloat(topConsultant.totalAmount) : null,
      previousMonthSales: prevSales,
      growthPercent: growthPercent !== null ? Math.round(growthPercent * 10) / 10 : null,
    })
  );
});

router.get("/dashboard/ranking", ensureAuth, async (req, res): Promise<void> => {
  const qp = GetDashboardRankingQueryParams.safeParse(req.query);
  if (!qp.success) {
    res.status(400).json({ error: qp.error.message });
    return;
  }

  const now = new Date();
  const month = qp.data.month ?? now.getMonth() + 1;
  const year = qp.data.year ?? now.getFullYear();

  // Mesma faixa de datas do resumo: usa o indice de sale_date.
  const period = monthRange(year, month);
  const limit = qp.data.limit ?? 10;

  const rankingRows = await db
    .select({
      consultantId: salesTable.consultantId,
      consultantName: consultantsTable.name,
      photo: consultantsTable.photo,
      totalAmount: sql<string>`SUM(${salesTable.amount})`,
      totalQuantity: sql<string>`SUM(${salesTable.quantity})`,
    })
    .from(salesTable)
    .leftJoin(consultantsTable, eq(salesTable.consultantId, consultantsTable.id))
    .where(
      and(
        gte(salesTable.saleDate, period.start),
        lt(salesTable.saleDate, period.endExclusive)
      )
    )
    .groupBy(salesTable.consultantId, consultantsTable.name, consultantsTable.photo)
    .orderBy(desc(sql`SUM(${salesTable.amount})`))
    .limit(limit);

  // Get individual goals for these consultants
  const goalsRows = await db
    .select()
    .from(goalsTable)
    .where(
      and(
        eq(goalsTable.month, month),
        eq(goalsTable.year, year)
      )
    );

  const goalsByConsultant = new Map<number, number>();
  for (const g of goalsRows) {
    if (g.consultantId) {
      goalsByConsultant.set(g.consultantId, parseFloat(g.targetAmount));
    }
  }

  const ranking = rankingRows.map((r, index) => {
    const totalAmount = parseFloat(r.totalAmount);
    const goalAmount = goalsByConsultant.get(r.consultantId) ?? null;
    const goalAchievementPercent = goalAmount && goalAmount > 0
      ? Math.round((totalAmount / goalAmount) * 1000) / 10
      : null;

    return {
      position: index + 1,
      consultantId: r.consultantId,
      consultantName: r.consultantName ?? `Consultor #${r.consultantId}`,
      photo: r.photo ?? null,
      totalAmount,
      totalQuantity: parseInt(r.totalQuantity),
      goalAmount,
      goalAchievementPercent,
    };
  });

  const viewer = await resolveViewer(req.userId);

  res.json(GetDashboardRankingResponse.parse(maskRankingGoals(viewer, ranking)));
});

router.get("/dashboard/production-chart", ensureAuth, async (req, res): Promise<void> => {
  const qp = GetProductionChartQueryParams.safeParse(req.query);
  if (!qp.success) {
    res.status(400).json({ error: qp.error.message });
    return;
  }

  const year = qp.data.year ?? new Date().getFullYear();

  // O ano inteiro como faixa, pelo mesmo motivo.
  const period = yearRange(year);

  const salesRows = await db
    .select({
      month: sql<string>`EXTRACT(MONTH FROM ${salesTable.saleDate}::date)`,
      totalAmount: sql<string>`COALESCE(SUM(${salesTable.amount}), 0)`,
      totalQuantity: sql<string>`COALESCE(SUM(${salesTable.quantity}), 0)`,
    })
    .from(salesTable)
    .where(
      and(
        gte(salesTable.saleDate, period.start),
        lt(salesTable.saleDate, period.endExclusive),
      ),
    )
    .groupBy(sql`EXTRACT(MONTH FROM ${salesTable.saleDate}::date)`)
    .orderBy(sql`EXTRACT(MONTH FROM ${salesTable.saleDate}::date)`);

  const goalsRows = await db
    .select({
      month: goalsTable.month,
      targetAmount: goalsTable.targetAmount,
    })
    .from(goalsTable)
    .where(
      and(
        eq(goalsTable.year, year),
        sql`${goalsTable.consultantId} IS NULL`
      )
    );

  const salesByMonth = new Map<number, { amount: number; quantity: number }>();
  for (const r of salesRows) {
    salesByMonth.set(parseInt(r.month), {
      amount: parseFloat(r.totalAmount),
      quantity: parseInt(r.totalQuantity),
    });
  }

  const goalByMonth = new Map<number, number>();
  for (const g of goalsRows) {
    goalByMonth.set(g.month, parseFloat(g.targetAmount));
  }

  const chartData = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const s = salesByMonth.get(m) ?? { amount: 0, quantity: 0 };
    return {
      month: m,
      monthName: MONTH_NAMES[i],
      totalAmount: s.amount,
      totalQuantity: s.quantity,
      goalAmount: goalByMonth.get(m) ?? null,
    };
  });

  res.json(GetProductionChartResponse.parse(chartData));
});

export default router;
