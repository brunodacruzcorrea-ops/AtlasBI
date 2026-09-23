import assert from "node:assert/strict";
import test from "node:test";

import { monthRange, yearRange } from "./date-range";

test("monthRange cobre o mes inteiro com limite superior exclusivo", () => {
  assert.deepEqual(monthRange(2026, 8), {
    start: "2026-08-01",
    endExclusive: "2026-09-01",
  });
});

test("monthRange vira o ano em dezembro", () => {
  assert.deepEqual(monthRange(2026, 12), {
    start: "2026-12-01",
    endExclusive: "2027-01-01",
  });
});

test("monthRange preenche o mes com dois digitos", () => {
  // Sem o zero a esquerda o Postgres rejeita a data.
  assert.equal(monthRange(2026, 1).start, "2026-01-01");
});

test("monthRange inclui 29 de fevereiro em ano bissexto", () => {
  // O limite exclusivo dispensa saber quantos dias tem o mes: 29/02 fica
  // dentro da faixa porque o fim e 01/03.
  const { start, endExclusive } = monthRange(2028, 2);
  assert.ok("2028-02-29" >= start && "2028-02-29" < endExclusive);
});

test("yearRange cobre o ano inteiro", () => {
  assert.deepEqual(yearRange(2026), {
    start: "2026-01-01",
    endExclusive: "2027-01-01",
  });
});
