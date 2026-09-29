import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Uma parcela da comissão: quanto do valor da venda ela representa e quantos
 * meses depois do mês da venda ela é paga (0 = no próprio mês da venda).
 */
export type CommissionInstallment = {
  percent: number;
  monthsAfterSale: number;
};

/**
 * Regra de comissão de um par administradora + produto. A comissão é paga
 * parcelada, e cada administradora/produto tem seu próprio cronograma.
 * Ver artifacts/api-server/src/lib/commission.ts para como a regra é aplicada.
 */
export const commissionRulesTable = pgTable("commission_rules", {
  id: serial("id").primaryKey(),
  administrator: text("administrator").notNull(),
  product: text("product").notNull(),
  installments: jsonb("installments").$type<CommissionInstallment[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCommissionRuleSchema = createInsertSchema(commissionRulesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCommissionRule = z.infer<typeof insertCommissionRuleSchema>;
export type CommissionRule = typeof commissionRulesTable.$inferSelect;
