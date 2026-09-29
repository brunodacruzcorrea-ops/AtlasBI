import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SESSION_TTL_MS,
  generateSessionToken,
  hashSessionToken,
  isSessionExpired,
  sessionExpiry,
  shouldRenewSession,
} from "./session-token";

const now = new Date("2026-10-01T12:00:00Z");
const at = (ms: number) => new Date(now.getTime() + ms);

test("tokens sao longos e nao se repetem", () => {
  const a = generateSessionToken();
  const b = generateSessionToken();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
});

test("o hash e estavel e nao revela o token", () => {
  const token = generateSessionToken();
  assert.equal(hashSessionToken(token), hashSessionToken(token));
  assert.notEqual(hashSessionToken(token), token);
  assert.notEqual(hashSessionToken(token), hashSessionToken(generateSessionToken()));
});

test("a sessao expira exatamente apos o TTL", () => {
  const expiry = sessionExpiry(now);
  assert.equal(expiry.getTime() - now.getTime(), SESSION_TTL_MS);
  assert.equal(isSessionExpired(expiry, now), false);
  assert.equal(isSessionExpired(expiry, expiry), true);
  assert.equal(isSessionExpired(expiry, at(SESSION_TTL_MS + 1)), true);
});

test("renova so quando passou da metade da validade", () => {
  assert.equal(shouldRenewSession(at(SESSION_TTL_MS), now), false);
  assert.equal(shouldRenewSession(at(SESSION_TTL_MS * 0.6), now), false);
  assert.equal(shouldRenewSession(at(SESSION_TTL_MS * 0.4), now), true);
});
