import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import crypto from "crypto";
import { ensureAuth, ensureAdmin, revokeSessionsForUser } from "./auth";
import {
  ROLES,
  isValidRole,
  isValidPassword,
  normalizeEmail,
  MIN_PASSWORD_LENGTH,
} from "../lib/users";

const router: IRouter = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "atlas_bi_salt_2024").digest("hex");
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

  if (!isValidPassword(password)) {
    res
      .status(400)
      .json({ error: `Senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres` });
    return;
  }

  if (role !== undefined && !isValidRole(role)) {
    res
      .status(400)
      .json({ error: `Cargo inválido. Use um destes: ${ROLES.join(", ")}` });
    return;
  }

  const normalizedEmail = normalizeEmail(String(email));

  // Duplicata checada sem depender de caixa: dois registros que so diferem em
  // maiusculas casariam com o mesmo login e a busca escolheria um deles.
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(sql`lower(${usersTable.email}) = ${normalizedEmail}`)
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "Já existe um usuário com esse e-mail" });
    return;
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      name,
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      role: isValidRole(role) ? role : "viewer",
    })
    .returning();

  res.status(201).json(mapUser(user));
});

router.post(
  "/users/:id/password",
  ensureAuth,
  ensureAdmin,
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const { password } = req.body ?? {};

    if (!isValidPassword(password)) {
      res
        .status(400)
        .json({ error: `Senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres` });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({ passwordHash: hashPassword(password) })
      .where(eq(usersTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Usuário não encontrado" });
      return;
    }

    revokeSessionsForUser(id);

    req.log.info({ targetUserId: id, byUserId: req.userId }, "Password reset");

    res.json({ success: true });
  },
);

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
