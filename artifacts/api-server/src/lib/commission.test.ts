import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addMonths,
  computeSaleCommission,
  findRule,
  summarizeSeller,
  validateRuleShape,
  type CommissionRule,
  type SaleInput,
} from "./commission";

const rule = (over: Partial<CommissionRule> = {}): CommissionRule => ({
  id: 1,
  administradora: "",
  product: "",
  segment: "",
  totalPercent: 2,
  shareBroker: 30,
  shareManagement: 10,
  shareSupervision: 10,
  shareSeller: 50,
  installments: [50, 25, 25],
  firstPaymentDelayMonths: 1,
  chargebackEnabled: false,
  chargebackInstallments: 3,
  chargebackPercent: 100,
  ...over,
});

const sale: SaleInput = {
  id: 10,
  consultantId: 1,
  product: "Imovel",
  segment: "Novo",
  amount: 100000,
  saleDate: "2026-11-20",
  administradora: "Porto",
};

test("addMonths vira o ano", () => {
  assert.equal(addMonths("2026-11", 3), "2027-02");
  assert.equal(addMonths("2026-01", 0), "2026-01");
});

test("parcelas, meses e rateio do vendedor", () => {
  const r = computeSaleCommission(sale, rule(), new Map(), "2026-11");
  assert.equal(r.totalCommission, 2000);
  assert.equal(r.sellerCommission, 1000);
  assert.deepEqual(r.installments.map((i) => i.dueMonth), ["2026-12", "2027-01", "2027-02"]);
  assert.deepEqual(r.installments.map((i) => i.seller), [500, 250, 250]);
  assert.ok(r.installments.every((i) => i.state === "forecast"));
});

test("parcela vencida sem marca conta como recebida", () => {
  const r = computeSaleCommission(sale, rule(), new Map(), "2027-01");
  assert.deepEqual(r.installments.map((i) => i.state), ["received", "forecast", "forecast"]);
});

test("inadimplencia tira a parcela do vendedor", () => {
  const r = computeSaleCommission(sale, rule(), new Map([[2, "defaulted" as const]]), "2026-11");
  const s = summarizeSeller([r]);
  assert.equal(s.defaulted, 250);
  assert.equal(s.forecast, 750);
  assert.equal(r.sellerCommission, 750);
  assert.equal(s.chargeback, 0);
});

test("estorno devolve o que ja foi recebido, so quando a administradora estorna", () => {
  const marks = new Map([[1, "paid" as const], [2, "defaulted" as const]]);
  const semEstorno = computeSaleCommission(sale, rule(), marks, "2026-11");
  assert.equal(semEstorno.chargeback, null);

  const comEstorno = computeSaleCommission(
    sale,
    rule({ chargebackEnabled: true, chargebackPercent: 50 }),
    marks,
    "2026-11",
  );
  assert.deepEqual(comEstorno.chargeback, { month: "2027-01", amount: 250 });
  assert.equal(summarizeSeller([comEstorno]).chargeback, 250);
});

test("estorno nao vale se a inadimplencia passa da janela", () => {
  const r = computeSaleCommission(
    sale,
    rule({ chargebackEnabled: true, chargebackInstallments: 1 }),
    new Map([[1, "paid" as const], [3, "defaulted" as const]]),
    "2026-11",
  );
  assert.equal(r.chargeback, null);
});

test("findRule prefere a regra mais especifica", () => {
  const geral = rule({ id: 1 });
  const porto = rule({ id: 2, administradora: "porto" });
  const portoImovel = rule({ id: 3, administradora: "Porto", product: "Imovel" });
  const outra = rule({ id: 4, administradora: "Itau" });
  assert.equal(findRule([geral, porto, portoImovel, outra], sale)?.id, 3);
  assert.equal(findRule([geral, outra], sale)?.id, 1);
  assert.equal(findRule([outra], sale), null);
});

test("venda sem regra fica zerada", () => {
  const r = computeSaleCommission(sale, null, new Map(), "2026-11");
  assert.equal(r.ruleId, null);
  assert.equal(r.sellerCommission, 0);
});

test("validateRuleShape exige 100% no rateio e nas parcelas", () => {
  const ok = { shareBroker: 30, shareManagement: 10, shareSupervision: 10, shareSeller: 50, installments: [60, 40] };
  assert.equal(validateRuleShape(ok), null);
  assert.match(validateRuleShape({ ...ok, shareSeller: 40 })!, /rateio/);
  assert.match(validateRuleShape({ ...ok, installments: [60, 30] })!, /parcelas/);
  assert.match(validateRuleShape({ ...ok, installments: [] })!, /parcela/);
});
