import { pgTable, text, serial, timestamp, integer, numeric, date, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const salesTable = pgTable("sales", {
  id: serial("id").primaryKey(),
  consultantId: integer("consultant_id").notNull(),
  product: text("product").notNull(),
  segment: text("segment").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  saleDate: date("sale_date", { mode: "string" }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  // Toda consulta do painel filtra vendas por faixa de data, e o ranking
  // agrupa por consultor. Sem indice o Postgres varre a tabela inteira em
  // cada chamada — barato hoje, caro conforme o historico cresce.
  saleDateIdx: index("sales_sale_date_idx").on(table.saleDate),
  consultantIdx: index("sales_consultant_id_idx").on(table.consultantId),
  // A tela de vendas filtra por consultor dentro de um periodo; o indice
  // composto atende esse par sem precisar cruzar os dois anteriores.
  consultantDateIdx: index("sales_consultant_id_sale_date_idx").on(
    table.consultantId,
    table.saleDate,
  ),
}));

export const insertSaleSchema = createInsertSchema(salesTable).omit({ id: true, createdAt: true });
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof salesTable.$inferSelect;
