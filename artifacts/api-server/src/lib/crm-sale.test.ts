import assert from "node:assert/strict";
import test from "node:test";

import {
  matchConsultant,
  parseAmount,
  parseCrmSale,
  parseSaleDate,
  tokenMatches,
} from "./crm-sale";

test("aceita o formato simples documentado", () => {
  const result = parseCrmSale(
    {
      externalId: "neg-42",
      consultantEmail: "Ana@Niadcon.com.br",
      product: "Consórcio Imóvel",
      segment: "Imobiliário",
      amount: 250000,
      saleDate: "2026-09-20",
    }
  );
  assert.ok(result.ok);
  assert.deepEqual(result.sale, {
    externalId: "neg-42",
    consultantId: null,
    consultantEmail: "ana@niadcon.com.br",
    consultantName: null,
    product: "Consórcio Imóvel",
    segment: "Imobiliário",
    amount: 250000,
    quantity: 1,
    saleDate: "2026-09-20",
    notes: null,
  });
});

test("aceita campos em português e valor/data no formato brasileiro", () => {
  const result = parseCrmSale(
    { vendedor: "João Silva", produto: "Seguro", valor: "R$ 1.500,50", data: "05/09/2026" }
  );
  assert.ok(result.ok);
  assert.equal(result.sale.consultantName, "João Silva");
  assert.equal(result.sale.amount, 1500.5);
  assert.equal(result.sale.saleDate, "2026-09-05");
});

test("desembrulha o webhook do Pipedrive (current) e usa o dono do negócio", () => {
  const result = parseCrmSale(
    {
      meta: { action: "updated", object: "deal" },
      current: {
        id: 981,
        title: "Plano Empresarial",
        value: 3200,
        status: "won",
        won_time: "2026-09-21 18:40:00",
        user_id: { id: 7, name: "Ana Souza", email: "ana@niadcon.com.br" },
      },
    }
  );
  assert.ok(result.ok);
  assert.equal(result.sale.externalId, "981");
  assert.equal(result.sale.product, "Plano Empresarial");
  assert.equal(result.sale.consultantEmail, "ana@niadcon.com.br");
  assert.equal(result.sale.saleDate, "2026-09-21");
});

test("envelope 'data' não é confundido com a data da venda", () => {
  const result = parseCrmSale(
    { data: { id: 5, title: "X", value: 10, owner_email: "a@b.com" } }
  );
  assert.ok(result.ok);
  // Sem data no payload: a rota decide (hoje na criação, mantém na atualização).
  assert.equal(result.sale.saleDate, null);
});

test("ignora negócio que não está ganho", () => {
  const result = parseCrmSale(
    { current: { id: 1, title: "X", value: 10, status: "open", owner_email: "a@b.com" } }
  );
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.ignored, true);
});

test("status ganho é reconhecido sem acento e sem caixa", () => {
  const result = parseCrmSale(
    { status: "Concluída", produto: "X", valor: 1, vendedor: "Ana" }
  );
  assert.ok(result.ok);
});

test("rejeita venda sem consultor, sem valor ou sem produto", () => {
  for (const body of [
    { product: "X", amount: 1 },
    { product: "X", consultantEmail: "a@b.com" },
    { amount: 1, consultantEmail: "a@b.com" },
  ]) {
    const result = parseCrmSale(body);
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.ignored, false);
  }
});

test("parseAmount entende os formatos comuns", () => {
  assert.equal(parseAmount(1500), 1500);
  assert.equal(parseAmount("1500.75"), 1500.75);
  assert.equal(parseAmount("1.500,75"), 1500.75);
  assert.equal(parseAmount("1,500.75"), 1500.75);
  assert.equal(parseAmount("1.500"), 1500);
  assert.equal(parseAmount("R$ 2.000.000"), 2000000);
  assert.equal(parseAmount("12.5"), 12.5);
  assert.equal(parseAmount({ value: "99,90" }), 99.9);
  assert.equal(parseAmount("abc"), null);
});

test("parseSaleDate usa o dia de Brasília para horários com fuso", () => {
  assert.equal(parseSaleDate("2026-09-23T02:30:00Z"), "2026-09-22");
  assert.equal(parseSaleDate("2026-09-22"), "2026-09-22");
  assert.equal(parseSaleDate("1/9/2026"), "2026-09-01");
  assert.equal(parseSaleDate(1_790_000_000), "2026-09-21");
  assert.equal(parseSaleDate("ontem"), null);
});

const consultants = [
  { id: 1, name: "Ana Souza", email: "ana@niadcon.com.br", active: true },
  { id: 2, name: "João Silva", email: null, active: true },
  { id: 3, name: "Maria Lima", email: "maria@niadcon.com.br", active: true },
  { id: 4, name: "Maria Lima", email: null, active: true },
];

test("matchConsultant casa por e-mail, depois por nome sem acento", () => {
  const byEmail = matchConsultant(consultants, {
    consultantId: null,
    consultantEmail: "ANA@niadcon.com.br",
    consultantName: null,
  });
  assert.ok(byEmail.ok && byEmail.consultant.id === 1);

  const byName = matchConsultant(consultants, {
    consultantId: null,
    consultantEmail: null,
    consultantName: "joao  silva",
  });
  assert.ok(byName.ok && byName.consultant.id === 2);
});

test("matchConsultant recusa nome ambíguo e consultor inexistente", () => {
  const ambiguous = matchConsultant(consultants, {
    consultantId: null,
    consultantEmail: null,
    consultantName: "Maria Lima",
  });
  assert.equal(ambiguous.ok, false);

  const missing = matchConsultant(consultants, {
    consultantId: null,
    consultantEmail: "ninguem@x.com",
    consultantName: null,
  });
  assert.equal(missing.ok, false);
});

test("tokenMatches compara o segredo", () => {
  assert.equal(tokenMatches("abc", "abc"), true);
  assert.equal(tokenMatches("abd", "abc"), false);
  assert.equal(tokenMatches(undefined, "abc"), false);
});
