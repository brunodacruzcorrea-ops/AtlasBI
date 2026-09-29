import assert from "node:assert/strict";
import test from "node:test";

import {
  addMonths,
  findRule,
  forecastSale,
  summarizeByMonth,
  validateInstallments,
  type CommissionSale,
  type Rule,
} from "./commission";

const rules: Rule[] = [
  {
    id: 1,
    administrator: "Embracon",
    product: "Imóvel",
    installments: [
      { percent: 50, monthsAfterSale: 0 },
      { percent: 25, monthsAfterSale: 1 },
      { percent: 25, monthsAfterSale: 2 },
    ],
  },
  { id: 2, administrator: "Rodobens", product: "Auto", installments: [{ percent: 100, monthsAfterSale: 1 }] },
];

const sale = (over: Partial<CommissionSale> = {}): CommissionSale => ({
  id: 1,
  consultantId: 7,
  product: "Imóvel",
  administrator: "Embracon",
  amount: 200000,
  saleDate: "2026-11-15",
  ...over,
});

test("addMonths vira o ano", () => {
  assert.equal(addMonths("2026-11", 0), "2026-11");
  assert.equal(addMonths("2026-11", 2), "2027-01");
  assert.equal(addMonths("2026-12", 13), "2028-01");
});

test("findRule ignora caixa, acento e espaços", () => {
  assert.equal(findRule(rules, { administrator: "  embracon ", product: "IMOVEL" })?.id, 1);
  assert.equal(findRule(rules, { administrator: "Embracon", product: "Auto" }), null);
  assert.equal(findRule(rules, { administrator: null, product: "Imóvel" }), null);
});

test("a comissão é parcelada conforme a regra e cruza a virada de ano", () => {
  const f = forecastSale(sale(), rules);
  assert.equal(f.hasRule, true);
  assert.deepEqual(
    f.installments.map((i) => [i.number, i.dueMonth, i.amount]),
    [
      [1, "2026-11", 100000],
      [2, "2026-12", 50000],
      [3, "2027-01", 50000],
    ],
  );
  assert.equal(f.installments[0]!.totalInstallments, 3);
});

test("venda sem regra ou sem administradora não gera previsão", () => {
  assert.deepEqual(forecastSale(sale({ administrator: null }), rules), {
    saleId: 1,
    hasRule: false,
    installments: [],
  });
  assert.equal(forecastSale(sale({ product: "Serviços" }), rules).hasRule, false);
});

test("arredonda centavos por parcela", () => {
  const f = forecastSale(sale({ product: "Auto", administrator: "Rodobens", amount: 333.333 }), rules);
  assert.equal(f.installments[0]!.amount, 333.33);
});

test("summarizeByMonth soma parcelas de vendas diferentes no mesmo mês", () => {
  const a = forecastSale(sale({ id: 1 }), rules);
  const b = forecastSale(sale({ id: 2, product: "Auto", administrator: "Rodobens", amount: 100000, saleDate: "2026-11-30" }), rules);
  assert.deepEqual(summarizeByMonth([a, b]), [
    { month: "2026-11", amount: 100000, installmentCount: 1 },
    { month: "2026-12", amount: 150000, installmentCount: 2 },
    { month: "2027-01", amount: 50000, installmentCount: 1 },
  ]);
});

test("validateInstallments rejeita cronograma inválido", () => {
  assert.equal(validateInstallments([{ percent: 50, monthsAfterSale: 0 }]), null);
  assert.ok(validateInstallments([]));
  assert.ok(validateInstallments([{ percent: 0, monthsAfterSale: 0 }]));
  assert.ok(validateInstallments([{ percent: 101, monthsAfterSale: 0 }]));
  assert.ok(validateInstallments([{ percent: 10, monthsAfterSale: -1 }]));
  assert.ok(validateInstallments([{ percent: 10, monthsAfterSale: 1.5 }]));
});
