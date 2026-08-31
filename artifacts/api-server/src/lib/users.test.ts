import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeEmail,
  isValidRole,
  isValidPassword,
  selectUserForLogin,
  MIN_PASSWORD_LENGTH,
  ROLES,
} from "./users";

test("normalizeEmail makes login tolerant to how the address was typed", () => {
  // Os tres casos que faziam o login falhar com a senha certa: cadastro em
  // caixa mista, teclado de celular capitalizando, e espaco colado junto.
  assert.equal(normalizeEmail("Joao.Silva@Niadcon.com.br"), "joao.silva@niadcon.com.br");
  assert.equal(normalizeEmail("Joao@niadcon.com.br"), "joao@niadcon.com.br");
  assert.equal(normalizeEmail("  joao@niadcon.com.br  "), "joao@niadcon.com.br");
});

test("normalizeEmail is idempotent", () => {
  const once = normalizeEmail(" Fulano@Niadcon.com.br ");
  assert.equal(normalizeEmail(once), once);
});

test("isValidRole accepts only the known roles", () => {
  for (const role of ROLES) {
    assert.equal(isValidRole(role), true);
  }
  // Antes o cargo era texto livre e qualquer valor era aceito.
  assert.equal(isValidRole("Admin"), false);
  assert.equal(isValidRole("gerente"), false);
  assert.equal(isValidRole("viewer"), false);
  assert.equal(isValidRole(""), false);
  assert.equal(isValidRole(undefined), false);
  assert.equal(isValidRole(null), false);
  assert.equal(isValidRole(1), false);
});

test("isValidPassword enforces the minimum length", () => {
  assert.equal(isValidPassword("a".repeat(MIN_PASSWORD_LENGTH)), true);
  assert.equal(isValidPassword("a".repeat(MIN_PASSWORD_LENGTH - 1)), false);
  assert.equal(isValidPassword(123456), false);
  assert.equal(isValidPassword(undefined), false);
});

// --- Escolha do registro no login -------------------------------------------

const hashCerto = "hash-da-senha-certa";
const hashAntigo = "hash-da-senha-antiga";

test("selectUserForLogin authenticates by the row whose password matches", () => {
  // A linha antiga vem primeiro por ter id menor. Era exatamente esse o caso
  // em que o login pegava o primeiro registro e reprovava quem digitou a
  // senha certa.
  const candidatos = [
    { id: 4, email: "Suelen.Azuma@niadcon.com.br", passwordHash: hashAntigo },
    { id: 31, email: "suelen.azuma@niadcon.com.br", passwordHash: hashCerto },
  ];

  const { user, candidateCount } = selectUserForLogin(candidatos, hashCerto);

  assert.equal(user?.id, 31);
  assert.equal(candidateCount, 2);
});

test("selectUserForLogin rejects when no row matches, reporting how many existed", () => {
  const candidatos = [
    { id: 4, email: "suelen.azuma@niadcon.com.br", passwordHash: hashAntigo },
  ];

  const { user, candidateCount } = selectUserForLogin(candidatos, hashCerto);

  assert.equal(user, null);
  // A contagem e o que separa "senha errada" de "conta inexistente" no log.
  assert.equal(candidateCount, 1);
});

test("selectUserForLogin reports a missing account as zero candidates", () => {
  const { user, candidateCount } = selectUserForLogin([], hashCerto);

  assert.equal(user, null);
  assert.equal(candidateCount, 0);
});
