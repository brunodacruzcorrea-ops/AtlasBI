import assert from "node:assert/strict";
import test from "node:test";

import { planChanges, MASTER_EMAILS, ADMIN, LIMITED } from "./master-access";

// Espelha o estado visto na tela de usuários em produção.
const users = [
  { id: 1, name: "Adilson Franca",  email: "adilson.silva@niadcon.com.br",   role: "admin" },
  { id: 2, name: "Admin Niadcon",   email: "admin@niadcon.com.br",           role: "admin" },
  { id: 3, name: "Daiane Verneck",  email: "daiane.verneck@niadcon.com.br",  role: "consultor" },
  { id: 4, name: "Gustavo Fonseca", email: "gustavo.fonseca@niadcon.com.br", role: "admin" },
  { id: 5, name: "Gustavo Franca",  email: "gustavo.franca@niadcon.com.br",  role: "admin" },
  { id: 6, name: "Ivan Santanna",   email: "ivan.santanna@niadcon.com.br",   role: "consultor" },
];

test("limita quem está fora da lista master e não mexe em quem já está certo", () => {
  const { changes } = planChanges(users, MASTER_EMAILS);

  // Gustavo Franca é admin hoje mas não está na lista.
  assert.deepEqual(
    changes.map((c) => [c.email, c.from, c.to]),
    [["gustavo.franca@niadcon.com.br", "admin", LIMITED]],
  );
});

test("promove quem está na lista mas ficou limitado", () => {
  const rebaixado = users.map((u) =>
    u.email === "gustavo.fonseca@niadcon.com.br" ? { ...u, role: "consultor" } : u,
  );

  const { changes } = planChanges(rebaixado, MASTER_EMAILS);
  const promocao = changes.find((c) => c.email === "gustavo.fonseca@niadcon.com.br");

  assert.ok(promocao);
  assert.equal(promocao.to, ADMIN);
});

test("ignora diferença de caixa e espaços no e-mail", () => {
  const { changes } = planChanges(
    [{ id: 9, name: "Adilson", email: "  Adilson.Silva@Niadcon.com.br ", role: "consultor" }],
    MASTER_EMAILS,
  );

  assert.equal(changes.length, 1);
  assert.equal(changes[0].to, ADMIN);
});

test("aponta e-mail da lista que não existe na base", () => {
  const { missing } = planChanges(users, MASTER_EMAILS);

  // Luiz e Suelen não aparecem na amostra acima.
  assert.deepEqual(missing.sort(), [
    "luiz.nascimento@niadcon.com.br",
    "suelen.azuma@niadcon.com.br",
  ]);
});

test("não gera alteração quando tudo já bate", () => {
  const alinhado = users.map((u) => ({
    ...u,
    role: MASTER_EMAILS.includes(u.email.toLowerCase()) ? ADMIN : LIMITED,
  }));

  assert.deepEqual(planChanges(alinhado, MASTER_EMAILS).changes, []);
});
