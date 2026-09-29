/**
 * Sessoes de login no Postgres, no lugar do Map em memoria de antes: assim um
 * deploy ou reinicio da API nao desloga ninguem. A regra de validade e o hash
 * do token estao em session-token.ts.
 */
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db, sessionsTable } from "@workspace/db";
import {
  generateSessionToken,
  hashSessionToken,
  sessionExpiry,
  shouldRenewSession,
} from "./session-token";

let tableReady: Promise<unknown> | null = null;

// Cria a tabela na primeira chamada, para funcionar sem depender de alguem
// lembrar de rodar `db push` no deploy (mesmo padrao de crm_sale_links).
function ensureSessionsTable(): Promise<unknown> {
  tableReady ??= (async () => {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS sessions (
      token_hash text PRIMARY KEY,
      user_id integer NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL
    )`);
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id)`,
    );
  })().catch((err) => {
    tableReady = null;
    throw err;
  });
  return tableReady;
}

/** Abre uma sessao e devolve o token, que so existe em claro aqui e no cliente. */
export async function createSession(userId: number): Promise<string> {
  await ensureSessionsTable();
  const token = generateSessionToken();
  await db.insert(sessionsTable).values({
    tokenHash: hashSessionToken(token),
    userId,
    expiresAt: sessionExpiry(),
  });
  // Limpeza oportunista das vencidas; nao precisa segurar o login.
  void db
    .delete(sessionsTable)
    .where(lt(sessionsTable.expiresAt, new Date()))
    .catch(() => {});
  return token;
}

/** Usuario dono do token, ou null se nao existe ou venceu. Renova se estiver perto do fim. */
export async function getSessionUserId(token: string): Promise<number | null> {
  await ensureSessionsTable();
  const tokenHash = hashSessionToken(token);
  const now = new Date();
  const [row] = await db
    .select({ userId: sessionsTable.userId, expiresAt: sessionsTable.expiresAt })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.tokenHash, tokenHash), gt(sessionsTable.expiresAt, now)))
    .limit(1);
  if (!row) return null;

  if (shouldRenewSession(row.expiresAt, now)) {
    await db
      .update(sessionsTable)
      .set({ expiresAt: sessionExpiry(now) })
      .where(eq(sessionsTable.tokenHash, tokenHash));
  }
  return row.userId;
}

export async function deleteSession(token: string): Promise<void> {
  await ensureSessionsTable();
  await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, hashSessionToken(token)));
}

/** O que da para usar como executor: o proprio db ou uma transacao dele. */
export type SessionExecutor = Pick<typeof db, "delete">;

/**
 * Encerra todas as sessoes do usuario (troca de senha, exclusao). Passe a
 * transacao em `executor` para que a revogacao e a mudanca da conta confirmem
 * juntas: se uma falhar, nenhuma vale, e nunca sobra token valido de uma conta
 * cuja senha ja mudou.
 */
export async function deleteSessionsForUser(
  userId: number,
  executor: SessionExecutor = db,
): Promise<void> {
  await ensureSessionsTable();
  await executor.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
}
