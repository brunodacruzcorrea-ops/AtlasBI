import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, consultantsTable } from "@workspace/db";
import {
  CreateConsultantBody,
  CreateConsultantResponse,
  GetConsultantParams,
  GetConsultantResponse,
  UpdateConsultantParams,
  UpdateConsultantBody,
  UpdateConsultantResponse,
  DeleteConsultantParams,
  ListConsultantsResponse,
} from "@workspace/api-zod";
import { ensureAuth } from "./auth";

const router: IRouter = Router();

function mapConsultant(c: any) {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    photo: c.photo ?? null,
    role: c.role ?? null,
    team: c.team ?? null,
    active: c.active,
    createdAt:
      c.createdAt instanceof Date
        ? c.createdAt.toISOString()
        : String(c.createdAt),
  };
}

router.get("/consultants", ensureAuth, async (_req, res): Promise<void> => {
  const consultants = await db
    .select()
    .from(consultantsTable)
    .orderBy(consultantsTable.name);
  res.json(ListConsultantsResponse.parse(consultants.map(mapConsultant)));
});

router.post("/consultants", ensureAuth, async (req, res): Promise<void> => {
  const parsed = CreateConsultantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [consultant] = await db
    .insert(consultantsTable)
    .values({
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role ?? null,
      team: parsed.data.team ?? null,
      active: parsed.data.active ?? true,
    })
    .returning();

  res
    .status(201)
    .json(CreateConsultantResponse.parse(mapConsultant(consultant)));
});

router.get("/consultants/:id", ensureAuth, async (req, res): Promise<void> => {
  const params = GetConsultantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [consultant] = await db
    .select()
    .from(consultantsTable)
    .where(eq(consultantsTable.id, params.data.id));

  if (!consultant) {
    res.status(404).json({ error: "Consultor não encontrado" });
    return;
  }

  res.json(GetConsultantResponse.parse(mapConsultant(consultant)));
});

router.patch(
  "/consultants/:id",
  ensureAuth,
  async (req, res): Promise<void> => {
    const params = UpdateConsultantParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateConsultantBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const updateData: Record<string, any> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.email !== undefined) updateData.email = parsed.data.email;
    if (parsed.data.role !== undefined) updateData.role = parsed.data.role;

    if (parsed.data.team !== undefined) updateData.team = parsed.data.team;
    if (parsed.data.active !== undefined)
      updateData.active = parsed.data.active;

    const [consultant] = await db
      .update(consultantsTable)
      .set(updateData)
      .where(eq(consultantsTable.id, params.data.id))
      .returning();

    if (!consultant) {
      res.status(404).json({ error: "Consultor não encontrado" });
      return;
    }

    res.json(UpdateConsultantResponse.parse(mapConsultant(consultant)));
  },
);

router.delete(
  "/consultants/:id",
  ensureAuth,
  async (req, res): Promise<void> => {
    const params = DeleteConsultantParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [deleted] = await db
      .delete(consultantsTable)
      .where(eq(consultantsTable.id, params.data.id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Consultor não encontrado" });
      return;
    }

    res.json({ success: true });
  },
);

export default router;
