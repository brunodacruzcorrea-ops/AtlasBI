import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  boolean,
  jsonb,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// Regras de comissao, editaveis pelo admin. Texto vazio em administradora,
// product ou segment vale como "qualquer": a regra mais especifica vence.
// Estas tabelas sao criadas sob demanda por routes/commissions.ts
// (CREATE TABLE IF NOT EXISTS), no mesmo espirito de crm_sale_links, para nao
// depender de alguem rodar `db push` no deploy.
export const commissionRulesTable = pgTable("commission_rules", {
  id: serial("id").primaryKey(),
  administradora: text("administradora").notNull().default(""),
  product: text("product").notNull().default(""),
  segment: text("segment").notNull().default(""),
  totalPercent: numeric("total_percent", { precision: 7, scale: 4 }).notNull(),
  shareBroker: numeric("share_broker", { precision: 6, scale: 2 }).notNull(),
  shareManagement: numeric("share_management", { precision: 6, scale: 2 }).notNull(),
  shareSupervision: numeric("share_supervision", { precision: 6, scale: 2 }).notNull(),
  shareSeller: numeric("share_seller", { precision: 6, scale: 2 }).notNull(),
  // Lista de % da comissao por parcela, ex.: [30, 20, 20, 30].
  installments: jsonb("installments").$type<number[]>().notNull(),
  firstPaymentDelayMonths: integer("first_payment_delay_months").notNull().default(1),
  chargebackEnabled: boolean("chargeback_enabled").notNull().default(false),
  chargebackInstallments: integer("chargeback_installments").notNull().default(0),
  chargebackPercent: numeric("chargeback_percent", { precision: 6, scale: 2 })
    .notNull()
    .default("100"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Administradora de cada venda. Tabela separada de `sales` de proposito: se
// ela nao existir ainda, so a comissao e afetada — a listagem de vendas segue.
export const saleCommissionMetaTable = pgTable("sale_commission_meta", {
  saleId: integer("sale_id").primaryKey(),
  administradora: text("administradora").notNull().default(""),
});

// Marca de parcela: `paid` (confirmada) ou `defaulted` (cliente nao pagou, o
// vendedor nao recebe o repasse). Sem linha, vale o calendario.
export const commissionInstallmentMarksTable = pgTable(
  "commission_installment_marks",
  {
    id: serial("id").primaryKey(),
    saleId: integer("sale_id").notNull(),
    installment: integer("installment").notNull(),
    status: text("status").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.saleId, t.installment)],
);
