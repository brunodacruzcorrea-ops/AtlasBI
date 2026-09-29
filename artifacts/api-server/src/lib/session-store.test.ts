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

// O pool e compartilhado entre os testes do arquivo: fecha uma vez, no fim.
after(async () => {
  if (!hasDb) return;
  const { pool } = await load();
  await pool.end();
});

test("sessao no banco: cria, valida, renova, expira e revoga", { skip: !hasDb }, async () => {
  const { store, db, sessionsTable } = await load();
  const { eq } = await import("drizzle-orm");
  const { hashSessionToken, SESSION_TTL_MS } = await import("./session-token");
  const userId = 987654;
  after(async () => {
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
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

test("revogar dentro de uma transacao desfaz junto se a transacao falhar", { skip: !hasDb }, async () => {
  const { store, db, sessionsTable } = await load();
  const { eq } = await import("drizzle-orm");
  const userId = 987655;
  after(async () => {
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
  });

  const token = await store.createSession(userId);

  // A revogacao roda, mas a transacao falha logo depois (como uma troca de
  // senha cujo UPDATE desse erro): a sessao tem que continuar de pe.
  await assert.rejects(
    db.transaction(async (tx) => {
      await store.deleteSessionsForUser(userId, tx);
      throw new Error("falha depois de revogar");
    }),
    /falha depois de revogar/,
  );
  assert.equal(await store.getSessionUserId(token), userId);

  // Confirmando a transacao, a sessao some.
  await db.transaction(async (tx) => {
    await store.deleteSessionsForUser(userId, tx);
  });
  assert.equal(await store.getSessionUserId(token), null);
});
