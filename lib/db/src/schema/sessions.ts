import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";

// Sessoes de login. Antes viviam num Map em memoria do processo, o que
// deslogava todo mundo a cada deploy da API. Guardar o token so como hash: um
// vazamento da tabela nao entrega tokens utilizaveis.
//
// Criada sob demanda por lib/session-store.ts (CREATE TABLE IF NOT EXISTS), no
// mesmo espirito de crm_sale_links, para nao depender de `db push` no deploy.
export const sessionsTable = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: integer("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);
