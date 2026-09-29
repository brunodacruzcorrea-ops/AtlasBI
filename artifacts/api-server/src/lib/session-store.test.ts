import { test, after } from "node:test";
import assert from "node:assert/strict";

// Integracao com o Postgres: so roda quando ha DATABASE_URL (o CI nao tem
// banco). Localmente: DATABASE_URL=... pnpm test
const hasDb = Boolean(process.env.DATABASE_URL);

const load = async () => {
  const store = await import("./session-store");
  const { db, sessionsTable, pool } = await import("@workspace/db");
  return { store, db, sessionsTable, pool };
};

test("sessao no banco: cria, valida, renova, expira e revoga", { skip: !hasDb }, async () => {
  const { store, db, sessionsTable, pool } = await load();
  const { eq } = await import("drizzle-orm");
  const { hashSessionToken, SESSION_TTL_MS } = await import("./session-token");
  const userId = 987654;
  after(async () => {
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
    await pool.end();
  });

  const token = await store.createSession(userId);
  assert.equal(await store.getSessionUserId(token), userId);
  assert.equal(await store.getSessionUserId("token-inexistente"), null);

  // O banco guarda so o hash, nunca o token.
  const rows = await db.select().from(sessionsTable).where(eq(sessionsTable.userId, userId));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].tokenHash, hashSessionToken(token));
  assert.notEqual(rows[0].tokenHash, token);

  // Renova quando passou da metade da validade.
  const soon = new Date(Date.now() + SESSION_TTL_MS * 0.2);
  await db.update(sessionsTable).set({ expiresAt: soon }).where(eq(sessionsTable.userId, userId));
  assert.equal(await store.getSessionUserId(token), userId);
  const [renewed] = await db.select().from(sessionsTable).where(eq(sessionsTable.userId, userId));
  assert.ok(renewed.expiresAt.getTime() > soon.getTime() + SESSION_TTL_MS * 0.5);

  // Vencida nao autentica.
  await db
    .update(sessionsTable)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(sessionsTable.userId, userId));
  assert.equal(await store.getSessionUserId(token), null);

  // Logout e revogacao por usuario.
  const a = await store.createSession(userId);
  const b = await store.createSession(userId);
  await store.deleteSession(a);
  assert.equal(await store.getSessionUserId(a), null);
  assert.equal(await store.getSessionUserId(b), userId);
  await store.deleteSessionsForUser(userId);
  assert.equal(await store.getSessionUserId(b), null);
});
