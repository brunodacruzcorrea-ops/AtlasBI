import assert from "node:assert/strict";
import test from "node:test";

import { CreateSaleBody } from "@workspace/api-zod";
import { toDatabaseDate } from "./sale-date";

test("preserves the required segment when validating a new sale", () => {
  const result = CreateSaleBody.parse({
    consultantId: 1,
    product: "Consultoria",
    segment: "Empresarial",
    amount: 1500,
    quantity: 1,
    saleDate: "2026-07-23",
    notes: "Contrato anual",
  });

  assert.equal(result.segment, "Empresarial");
  assert.equal(toDatabaseDate(result.saleDate), "2026-07-23");
});
