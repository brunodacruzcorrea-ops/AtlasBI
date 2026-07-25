import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import crypto from "crypto";
import { ensureAuth } from "./auth";

const router: IRouter = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "atlas_bi_salt_2024").digest("hex");
}

async function ensureAdmin(req: any, res: any, next: any): Promise<void> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.userId))
    .limit(1);

  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Acesso restrito a administradores" });
    return;
  }

  next();
}

function mapUser(u: any) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt:
      u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt),
  };
}

router.get("/users", ensureAuth, ensureAdmin, async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.name);
  res.json(users.map(mapUser));
});

router.post("/users", ensureAuth, ensureAdmin, async (req, res): Promise<void> => {
  const { name, email, password, role } = req.body ?? {};

  if (!name || !email || !password) {
    res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios" });
    return;
  }

  if (typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "Já existe um usuário com esse e-mail" });
    return;
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      name,
      email,
      passwordHash: hashPassword(password),
      role: role || "admin",
    })
    .returning();

  res.status(201).json(mapUser(user));
});

router.delete("/users/:id", ensureAuth, ensureAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  if (id === req.userId) {
    res.status(400).json({ error: "Você não pode remover seu próprio usuário" });
    return;
  }

  const [deleted] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();

  if (!deleted) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }

  res.json({ success: true });
});

export default router;
