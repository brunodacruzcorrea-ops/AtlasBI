import { pgTable, text, serial, timestamp, integer, numeric, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const goalsTable = pgTable("goals", {
  id: serial("id").primaryKey(),
  consultantId: integer("consultant_id"),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }).notNull(),
  targetQuantity: integer("target_quantity"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  // O painel e a tela de metas sempre buscam pelo par ano/mes, e depois
  // separam a meta de equipe (consultor nulo) das individuais.
  periodIdx: index("goals_year_month_idx").on(table.year, table.month),
  consultantIdx: index("goals_consultant_id_idx").on(table.consultantId),
}));

export const insertGoalSchema = createInsertSchema(goalsTable).omit({ id: true, createdAt: true });
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Goal = typeof goalsTable.$inferSelect;
