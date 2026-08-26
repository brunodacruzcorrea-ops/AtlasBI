import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, usersTable, consultantsTable } from "@workspace/db";
import { LoginBody, LoginResponse, GetMeResponse } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import crypto from "crypto";
import { normalizeEmail } from "../lib/users";
import type { Viewer } from "../lib/visibility";

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

// Usado na redefinicao de senha: sem isso as sessoes abertas com a senha
// antiga continuariam validas, que e justamente o que uma redefinicao
// precisa encerrar.
export function revokeSessionsForUser(userId: number): void {
  for (const [token, id] of tokenStore) {
    if (id === userId) tokenStore.delete(token);
  }
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const hashed = hashPassword(password);

  // A comparacao e feita em minusculas dos dois lados. O cadastro nunca
  // normalizou o e-mail, entao existem registros gravados com maiusculas; um
  // teclado de celular que capitaliza a primeira letra, ou um espaco colado
  // junto, fazia o login falhar mesmo com a senha certa.
  const [user] = await db
    .select()
    .from(usersTable)
    .where(sql`lower(${usersTable.email}) = ${normalizeEmail(email)}`)
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

/**
 * Descobre o contexto de visibilidade do usuário logado.
 *
 * Não existe vínculo explícito entre usuários e consultores no banco, então a
 * associação é feita pelo e-mail — comparado em minúsculas dos dois lados,
 * porque a coluna de consultores é livre e nem sempre foi preenchida com a
 * mesma caixa. Consultor sem e-mail cadastrado, ou com e-mail diferente do
 * usuário, não casa: a pessoa vê a meta de equipe mas não a própria meta
 * individual. `pnpm --filter @workspace/scripts run check-links` lista esses
 * casos.
 */
export async function resolveViewer(userId: number | undefined): Promise<Viewer> {
  if (userId === undefined) return { isAdmin: false, consultantId: null };

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) return { isAdmin: false, consultantId: null };
  if (user.role === "admin") return { isAdmin: true, consultantId: null };

  const [consultant] = await db
    .select({ id: consultantsTable.id })
    .from(consultantsTable)
    .where(sql`lower(${consultantsTable.email}) = ${normalizeEmail(user.email)}`)
    .limit(1);

  return { isAdmin: false, consultantId: consultant?.id ?? null };
}

export async function ensureAdmin(
  req: any,
  res: any,
  next: any,
): Promise<void> {
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

export default router;
