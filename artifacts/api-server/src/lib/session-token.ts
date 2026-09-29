/**
 * Parte pura das sessoes: geracao e hash do token, validade e renovacao.
 * Sem banco de proposito, para ser testavel; o acesso ao Postgres fica em
 * session-store.ts.
 */
import crypto from "crypto";

/** Duracao da sessao. Longa de proposito: o vendedor usa o app no celular. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Quando restar menos que isso, o uso da sessao a renova por mais um TTL. */
export const SESSION_RENEW_BELOW_MS = SESSION_TTL_MS / 2;

/** Token opaco e aleatorio (256 bits); nao carrega nenhuma informacao. */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** O banco guarda apenas o hash; quem tem so a tabela nao consegue logar. */
export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + SESSION_TTL_MS);
}

export function isSessionExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function shouldRenewSession(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() - now.getTime() < SESSION_RENEW_BELOW_MS;
}
