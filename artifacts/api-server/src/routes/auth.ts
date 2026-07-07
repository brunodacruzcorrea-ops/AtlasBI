import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { LoginBody, LoginResponse, GetMeResponse } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import crypto from "crypto";

const router: IRouter = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "atlas_bi_salt_2024").digest("hex");
}

function generateToken(userId: number): string {
  return crypto
    .createHmac("sha256", process.env["SESSION_SECRET"] ?? "atlas_bi_secret")
    .update(`${userId}:${Date.now()}`)
    .digest("hex");
}

// Simple in-memory token store (production would use Redis/DB sessions)
const tokenStore = new Map<string, number>(); // token -> userId

export function getUserIdFromToken(token: string): number | null {
  return tokenStore.get(token) ?? null;
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const hashed = hashPassword(password);

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (!user || user.passwordHash !== hashed) {
    res.status(401).json({ error: "Email ou senha inválidos" });
    return;
  }

  const token = generateToken(user.id);
  tokenStore.set(token, user.id);

  req.log.info({ userId: user.id }, "User logged in");

  res.json(
    LoginResponse.parse({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    })
  );
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    tokenStore.delete(token);
  }
  res.json({ success: true });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }

  const token = authHeader.slice(7);
  const userId = tokenStore.get(token);

  if (!userId) {
    res.status(401).json({ error: "Token inválido ou expirado" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "Usuário não encontrado" });
    return;
  }

  res.json(
    GetMeResponse.parse({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    })
  );
});

export function ensureAuth(req: any, res: any, next: any): void {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  const token = authHeader.slice(7);
  const userId = tokenStore.get(token);
  if (!userId) {
    res.status(401).json({ error: "Token inválido" });
    return;
  }
  req.userId = userId;
  next();
}

export default router;
