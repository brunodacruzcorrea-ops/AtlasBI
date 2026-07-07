import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, goalsTable, consultantsTable } from "@workspace/db";
import {
  CreateGoalBody,
  CreateGoalResponse,
  UpdateGoalParams,
  UpdateGoalBody,
  UpdateGoalResponse,
  DeleteGoalParams,
  ListGoalsResponse,
  ListGoalsQueryParams,
} from "@workspace/api-zod";
import { ensureAuth } from "./auth";

const router: IRouter = Router();

function mapGoal(g: any, consultantName?: string | null) {
  return {
    id: g.id,
    consultantId: g.consultantId ?? null,
    consultantName: consultantName ?? null,
    month: g.month,
    year: g.year,
    targetAmount: parseFloat(g.targetAmount),
    targetQuantity: g.targetQuantity ?? null,
    description: g.description ?? null,
    createdAt: g.createdAt instanceof Date ? g.createdAt.toISOString() : String(g.createdAt),
  };
}

router.get("/goals", ensureAuth, async (req, res): Promise<void> => {
  const qp = ListGoalsQueryParams.safeParse(req.query);
  if (!qp.success) {
    res.status(400).json({ error: qp.error.message });
    return;
  }

  const { month, year } = qp.data;
  const conditions = [];
  if (month != null) conditions.push(eq(goalsTable.month, month));
  if (year != null) conditions.push(eq(goalsTable.year, year));

  const goalsRows = await db
    .select({ goal: goalsTable, consultantName: consultantsTable.name })
    .from(goalsTable)
    .leftJoin(consultantsTable, eq(goalsTable.consultantId, consultantsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(goalsTable.year, goalsTable.month);

  res.json(ListGoalsResponse.parse(goalsRows.map((r) => mapGoal(r.goal, r.consultantName))));
});

router.post("/goals", ensureAuth, async (req, res): Promise<void> => {
  const parsed = CreateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [goal] = await db
    .insert(goalsTable)
    .values({
      consultantId: parsed.data.consultantId ?? null,
      month: parsed.data.month,
      year: parsed.data.year,
      targetAmount: String(parsed.data.targetAmount),
      targetQuantity: parsed.data.targetQuantity ?? null,
      description: parsed.data.description ?? null,
    })
    .returning();

  let consultantName: string | null = null;
  if (goal.consultantId) {
    const [c] = await db
      .select({ name: consultantsTable.name })
      .from(consultantsTable)
      .where(eq(consultantsTable.id, goal.consultantId));
    consultantName = c?.name ?? null;
  }

  res.status(201).json(CreateGoalResponse.parse(mapGoal(goal, consultantName)));
});

router.patch("/goals/:id", ensureAuth, async (req, res): Promise<void> => {
  const params = UpdateGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, any> = {};
  if (parsed.data.targetAmount !== undefined) updateData.targetAmount = String(parsed.data.targetAmount);
  if (parsed.data.targetQuantity !== undefined) updateData.targetQuantity = parsed.data.targetQuantity;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;

  const [goal] = await db
    .update(goalsTable)
    .set(updateData)
    .where(eq(goalsTable.id, params.data.id))
    .returning();

  if (!goal) {
    res.status(404).json({ error: "Meta não encontrada" });
    return;
  }

  let consultantName: string | null = null;
  if (goal.consultantId) {
    const [c] = await db
      .select({ name: consultantsTable.name })
      .from(consultantsTable)
      .where(eq(consultantsTable.id, goal.consultantId));
    consultantName = c?.name ?? null;
  }

  res.json(UpdateGoalResponse.parse(mapGoal(goal, consultantName)));
});

router.delete("/goals/:id", ensureAuth, async (req, res): Promise<void> => {
  const params = DeleteGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(goalsTable)
    .where(eq(goalsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Meta não encontrada" });
    return;
  }

  res.json({ success: true });
});

export default router;
