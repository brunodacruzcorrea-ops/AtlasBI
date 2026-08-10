import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, salesTable, consultantsTable } from "@workspace/db";
import {
  CreateSaleBody,
  CreateSaleResponse,
  GetSaleParams,
  GetSaleResponse,
  UpdateSaleParams,
  UpdateSaleBody,
  UpdateSaleResponse,
  DeleteSaleParams,
  ListSalesResponse,
  ListSalesQueryParams,
} from "@workspace/api-zod";
import { ensureAuth } from "./auth";
import { toDatabaseDate } from "./sale-date";
import { broadcastSaleCreated } from "./sales-events";

const router: IRouter = Router();

function mapSale(s: any, consultantName?: string | null) {
  return {
    id: s.id,
    consultantId: s.consultantId,
    consultantName: consultantName ?? null,
    product: s.product,
    segment: s.segment,
    amount: parseFloat(s.amount),
    quantity: s.quantity,
    saleDate: s.saleDate,
    notes: s.notes ?? null,
    createdAt:
      s.createdAt instanceof Date
        ? s.createdAt.toISOString()
        : String(s.createdAt),
  };
}

router.get("/sales", ensureAuth, async (req, res): Promise<void> => {
  const qp = ListSalesQueryParams.safeParse(req.query);
  if (!qp.success) {
    res.status(400).json({ error: qp.error.message });
    return;
  }

  const { consultantId, month, year } = qp.data;

  const conditions = [];
  if (consultantId != null) {
    conditions.push(eq(salesTable.consultantId, consultantId));
  }
  if (month != null) {
    conditions.push(
      sql`EXTRACT(MONTH FROM ${salesTable.saleDate}::date) = ${month}`,
    );
  }
  if (year != null) {
    conditions.push(
      sql`EXTRACT(YEAR FROM ${salesTable.saleDate}::date) = ${year}`,
    );
  }

  const salesRows = await db
    .select({
      sale: salesTable,
      consultantName: consultantsTable.name,
    })
    .from(salesTable)
    .leftJoin(
      consultantsTable,
      eq(salesTable.consultantId, consultantsTable.id),
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${salesTable.saleDate} DESC`);

  const mapped = salesRows.map((r) => mapSale(r.sale, r.consultantName));
  res.json(ListSalesResponse.parse(mapped));
});

router.post("/sales", ensureAuth, async (req, res): Promise<void> => {
  const parsed = CreateSaleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [sale] = await db
    .insert(salesTable)
    .values({
      consultantId: parsed.data.consultantId,
      product: parsed.data.product,
      segment: parsed.data.segment,
      amount: String(parsed.data.amount),
      quantity: parsed.data.quantity,
      saleDate: toDatabaseDate(parsed.data.saleDate),
      notes: parsed.data.notes ?? null,
    })
    .returning();

  const [consultant] = await db
    .select({ name: consultantsTable.name })
    .from(consultantsTable)
    .where(eq(consultantsTable.id, sale.consultantId));

  const createdSale = CreateSaleResponse.parse(mapSale(sale, consultant?.name));
  broadcastSaleCreated({
    ...createdSale,
    consultantName: createdSale.consultantName ?? null,
    notes: undefined,
  } as any);
  res.status(201).json(createdSale);
});

router.get("/sales/:id", ensureAuth, async (req, res): Promise<void> => {
  const params = GetSaleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select({ sale: salesTable, consultantName: consultantsTable.name })
    .from(salesTable)
    .leftJoin(
      consultantsTable,
      eq(salesTable.consultantId, consultantsTable.id),
    )
    .where(eq(salesTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Venda não encontrada" });
    return;
  }

  res.json(GetSaleResponse.parse(mapSale(row.sale, row.consultantName)));
});

router.patch("/sales/:id", ensureAuth, async (req, res): Promise<void> => {
  const params = UpdateSaleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSaleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, any> = {};
  if (parsed.data.consultantId !== undefined)
    updateData.consultantId = parsed.data.consultantId;
  if (parsed.data.product !== undefined)
    updateData.product = parsed.data.product;
  if (parsed.data.segment !== undefined)
    updateData.segment = parsed.data.segment;
  if (parsed.data.amount !== undefined)
    updateData.amount = String(parsed.data.amount);
  if (parsed.data.quantity !== undefined)
    updateData.quantity = parsed.data.quantity;
  if (parsed.data.saleDate !== undefined)
    updateData.saleDate = toDatabaseDate(parsed.data.saleDate);
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

  const [sale] = await db
    .update(salesTable)
    .set(updateData)
    .where(eq(salesTable.id, params.data.id))
    .returning();

  if (!sale) {
    res.status(404).json({ error: "Venda não encontrada" });
    return;
  }

  const [consultant] = await db
    .select({ name: consultantsTable.name })
    .from(consultantsTable)
    .where(eq(consultantsTable.id, sale.consultantId));

  res.json(UpdateSaleResponse.parse(mapSale(sale, consultant?.name)));
});

router.delete("/sales/:id", ensureAuth, async (req, res): Promise<void> => {
  const params = DeleteSaleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(salesTable)
    .where(eq(salesTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Venda não encontrada" });
    return;
  }

  res.json({ success: true });
});

export default router;
