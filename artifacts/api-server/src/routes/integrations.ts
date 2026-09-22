import express, { Router, type IRouter, type Request, type Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db, salesTable, consultantsTable, crmSaleLinksTable } from "@workspace/db";
import {
  matchConsultant,
  parseCrmSale,
  todayInBrazil,
  tokenMatches,
  unwrapPayload,
} from "../lib/crm-sale";
import { broadcastSaleCreated } from "./sales-events";

// Webhook que recebe do CRM as vendas fechadas. Nao usa o login do Atlas
// (o CRM nao tem sessao): autentica por um token fixo, configurado em
// CRM_WEBHOOK_TOKEN no servidor e na URL/cabecalho do webhook no CRM.
// Formato aceito e passo a passo por CRM: docs/integracao-crm.md.

const router: IRouter = Router();

let linksTableReady: Promise<unknown> | null = null;

// Cria a tabela de vinculo na primeira chamada, para a integracao funcionar
// sem depender de alguem lembrar de rodar `db push` no deploy.
function ensureLinksTable(): Promise<unknown> {
  linksTableReady ??= db
    .execute(
      sql`CREATE TABLE IF NOT EXISTS crm_sale_links (
        id serial PRIMARY KEY,
        external_id text NOT NULL UNIQUE,
        sale_id integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
    )
    .catch((err) => {
      linksTableReady = null;
      throw err;
    });
  return linksTableReady;
}

function receivedToken(req: any): string | undefined {
  const header = req.headers["x-atlas-token"];
  if (typeof header === "string" && header) return header;
  const auth = req.headers["authorization"];
  if (typeof auth === "string" && auth.startsWith("Bearer ")) return auth.slice(7);
  // Muitos CRMs so deixam configurar a URL do webhook, sem cabecalhos.
  const query = req.query?.token;
  return typeof query === "string" ? query : undefined;
}

class DuplicateLink extends Error {}

function queryWithoutToken(query: Request["query"]): Record<string, unknown> {
  const { token: _token, ...rest } = query as Record<string, unknown>;
  return rest;
}

// O app so interpreta JSON e formulario. Alguns CRMs mandam JSON com outro
// Content-Type (ou nenhum): le o corpo como texto e o parser tenta JSON.
// Corpos ja interpretados pelos parsers globais passam direto.
const rawBody = express.text({ type: () => true, limit: "3mb" });

async function handleCrmSale(req: Request, res: Response): Promise<void> {
  const expected = process.env["CRM_WEBHOOK_TOKEN"];
  if (!expected) {
    res.status(503).json({ error: "Integração com CRM não configurada (CRM_WEBHOOK_TOKEN)" });
    return;
  }
  if (!tokenMatches(receivedToken(req), expected)) {
    res.status(401).json({ error: "Token do webhook inválido" });
    return;
  }

  const payload = req.method === "GET" ? queryWithoutToken(req.query) : req.body;
  const parsed = parseCrmSale(payload);
  if (!parsed.ok) {
    if (parsed.ignored) {
      // 200 e nao 4xx: o CRM trataria erro como falha e reenviaria o evento.
      res.status(200).json({ ignored: true, reason: parsed.reason });
    } else {
      // Devolve os nomes (so os nomes, nao os valores) dos campos recebidos:
      // e o que basta para ajustar o mapeamento quando um CRM manda outro
      // formato, sem precisar de acesso ao servidor.
      const receivedFields = Object.keys(unwrapPayload(payload));
      // Formato do corpo (nao o conteudo) para diagnosticar quando nada e
      // reconhecido: corpo vazio, tipo inesperado, lista...
      const received = {
        method: req.method,
        contentType: req.headers["content-type"] ?? null,
        contentLength: req.headers["content-length"] ?? null,
        bodyType: Array.isArray(payload) ? "array" : typeof payload,
        topLevelFields:
          payload && typeof payload === "object" ? Object.keys(payload).slice(0, 30) : [],
      };
      req.log.warn(
        { error: parsed.error, receivedFields, received },
        "CRM webhook payload rejected",
      );
      res.status(422).json({ error: parsed.error, receivedFields, received });
    }
    return;
  }
  const input = parsed.sale;

  const consultants = await db
    .select({
      id: consultantsTable.id,
      name: consultantsTable.name,
      email: consultantsTable.email,
      active: consultantsTable.active,
    })
    .from(consultantsTable);
  const match = matchConsultant(consultants, input);
  if (!match.ok) {
    req.log.warn({ error: match.error }, "CRM webhook consultant not found");
    res.status(422).json({ error: match.error });
    return;
  }
  const consultant = match.consultant;

  // Na atualizacao so entram os campos que o CRM mandou: um reenvio parcial
  // nao pode zerar o segmento ou trocar a data da venda por hoje.
  const updates = {
    consultantId: consultant.id,
    product: input.product,
    amount: String(input.amount),
    quantity: input.quantity,
    ...(input.segment ? { segment: input.segment } : {}),
    ...(input.saleDate ? { saleDate: input.saleDate } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
  };
  const values = {
    ...updates,
    segment: input.segment ?? process.env["CRM_DEFAULT_SEGMENT"] ?? "CRM",
    saleDate: input.saleDate ?? todayInBrazil(),
    notes: input.notes,
  };

  const respond = (status: number, sale: typeof salesTable.$inferSelect, created: boolean) => {
    res.status(status).json({
      created,
      sale: {
        id: sale.id,
        consultantId: sale.consultantId,
        consultantName: consultant.name,
        product: sale.product,
        segment: sale.segment,
        amount: parseFloat(sale.amount),
        quantity: sale.quantity,
        saleDate: sale.saleDate,
      },
    });
  };

  // Mesmo negocio reenviado (retry do CRM ou edicao depois de ganho):
  // atualiza a venda existente em vez de duplicar.
  const updateExisting = async (externalId: string): Promise<boolean> => {
    const [link] = await db
      .select()
      .from(crmSaleLinksTable)
      .where(eq(crmSaleLinksTable.externalId, externalId));
    if (!link) return false;

    const [sale] = await db
      .update(salesTable)
      .set(updates)
      .where(eq(salesTable.id, link.saleId))
      .returning();
    if (!sale) {
      // Venda apagada no Atlas por um admin: respeita a exclusao.
      res.status(200).json({ ignored: true, reason: "Venda removida no Atlas" });
      return true;
    }
    respond(200, sale, false);
    return true;
  };

  const externalId = input.externalId;
  if (externalId) {
    await ensureLinksTable();
    if (await updateExisting(externalId)) return;
  }

  let sale: typeof salesTable.$inferSelect;
  try {
    sale = await db.transaction(async (tx) => {
      const [created] = await tx.insert(salesTable).values(values).returning();
      if (externalId) {
        const linked = await tx
          .insert(crmSaleLinksTable)
          .values({ externalId, saleId: created.id })
          .onConflictDoNothing()
          .returning();
        // Dois envios simultaneos do mesmo negocio: o outro ganhou.
        if (linked.length === 0) throw new DuplicateLink();
      }
      return created;
    });
  } catch (err) {
    if (err instanceof DuplicateLink && externalId && (await updateExisting(externalId))) return;
    throw err;
  }

  broadcastSaleCreated({
    id: sale.id,
    consultantId: sale.consultantId,
    consultantName: consultant.name,
    product: sale.product,
    segment: sale.segment,
    amount: parseFloat(sale.amount),
    quantity: sale.quantity,
    saleDate: sale.saleDate,
    createdAt: sale.createdAt.toISOString(),
  });
  req.log.info({ saleId: sale.id, externalId }, "Sale created from CRM webhook");
  respond(201, sale, true);
}

router.post("/integrations/crm/sales", rawBody, handleCrmSale);
// Algumas automacoes do DataCrazy chamaram a URL com GET; nesse caso os
// dados vem na query string.
router.get("/integrations/crm/sales", handleCrmSale);

export default router;
