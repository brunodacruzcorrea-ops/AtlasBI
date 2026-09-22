import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

// Liga o negocio do CRM a venda criada no Atlas. E o que torna o webhook
// idempotente: CRMs reenviam o mesmo evento quando nao recebem resposta a
// tempo, e sem isso cada reenvio viraria uma venda duplicada no ranking.
//
// Tabela separada, e nao uma coluna em `sales`, de proposito: se ela ainda
// nao existir no banco, so o webhook e afetado — a listagem de vendas
// continua funcionando. A rota cria a tabela se preciso (ver
// routes/integrations.ts).
export const crmSaleLinksTable = pgTable("crm_sale_links", {
  id: serial("id").primaryKey(),
  externalId: text("external_id").notNull().unique(),
  saleId: integer("sale_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CrmSaleLink = typeof crmSaleLinksTable.$inferSelect;
