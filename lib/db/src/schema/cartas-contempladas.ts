import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";

import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cartasContempladasTable = pgTable("cartas_contempladas", {
  id: serial("id").primaryKey(),

  tipoBem: text("tipo_bem").notNull(),

  valorCredito: numeric("valor_credito", { precision: 12, scale: 2 }).notNull(),

  valorEntrada: numeric("valor_entrada", { precision: 12, scale: 2 }).notNull(),

  valorParcela: numeric("valor_parcela", { precision: 12, scale: 2 }).notNull(),

  quantidadeParcelas: integer("quantidade_parcelas").notNull(),

  status: text("status").notNull().default("disponivel"),

  observacoes: text("observacoes"),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
});

export const insertCartaContempladaSchema = createInsertSchema(
  cartasContempladasTable,
).omit({
  id: true,
  createdAt: true,
});

export type InsertCartaContemplada = z.infer<
  typeof insertCartaContempladaSchema
>;

export type CartaContemplada = typeof cartasContempladasTable.$inferSelect;
