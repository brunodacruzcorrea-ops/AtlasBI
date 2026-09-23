-- Migracao inicial (baseline).
--
-- O banco de producao ja existia quando as migracoes foram introduzidas: ele
-- foi criado por `drizzle-kit push`, direto do schema. Por isso todos os
-- comandos aqui usam IF NOT EXISTS — assim esta migracao vale tanto para o
-- banco que ja esta no ar, onde so os indices no fim sao novos, quanto para
-- um banco vazio, que ganha tudo.
--
-- Isto e proprio da baseline. As proximas migracoes sao geradas por
-- `pnpm --filter db generate` e aplicadas como vierem, sem edicao manual.

CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consultants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"photo" text,
	"role" text,
	"team" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"consultant_id" integer NOT NULL,
	"product" text NOT NULL,
	"segment" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"sale_date" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"consultant_id" integer,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"target_amount" numeric(12, 2) NOT NULL,
	"target_quantity" integer,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "segments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_sale_date_idx" ON "sales" USING btree ("sale_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_consultant_id_idx" ON "sales" USING btree ("consultant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_consultant_id_sale_date_idx" ON "sales" USING btree ("consultant_id","sale_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "goals_year_month_idx" ON "goals" USING btree ("year","month");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "goals_consultant_id_idx" ON "goals" USING btree ("consultant_id");