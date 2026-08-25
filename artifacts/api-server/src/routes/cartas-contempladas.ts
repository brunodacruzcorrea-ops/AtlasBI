import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, cartasContempladasTable, usersTable } from "@workspace/db";
import {
  CreateCartaContempladaBody,
  CreateCartaContempladaResponse,
  GetCartaContempladaParams,
  GetCartaContempladaResponse,
  UpdateCartaContempladaParams,
  UpdateCartaContempladaBody,
  UpdateCartaContempladaResponse,
  DeleteCartaContempladaParams,
  ListCartasContempladasResponse,
  ListCartasContempladasQueryParams,
} from "@workspace/api-zod";
import { ensureAuth } from "./auth";

const router: IRouter = Router();

async function ensureAdmin(req: any, res: any, next: any): Promise<void> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.userId))
    .limit(1);

  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Acesso restrito a administradores" });
    return;
  }

  next();
}

function mapCartaContemplada(c: any) {
  return {
    id: c.id,
    tipoBem: c.tipoBem,
    valorCredito: parseFloat(c.valorCredito),
    valorEntrada: parseFloat(c.valorEntrada),
    valorParcela: parseFloat(c.valorParcela),
    quantidadeParcelas: c.quantidadeParcelas,
    status: c.status,
    observacoes: c.observacoes ?? null,
    createdAt:
      c.createdAt instanceof Date
        ? c.createdAt.toISOString()
        : String(c.createdAt),
  };
}

router.get(
  "/cartas-contempladas",
  ensureAuth,
  ensureAdmin,
  async (req, res): Promise<void> => {
    const qp = ListCartasContempladasQueryParams.safeParse(req.query);
    if (!qp.success) {
      res.status(400).json({ error: qp.error.message });
      return;
    }

    const cartas = await db
      .select()
      .from(cartasContempladasTable)
      .where(
        qp.data.status
          ? eq(cartasContempladasTable.status, qp.data.status)
          : undefined,
      )
      .orderBy(cartasContempladasTable.createdAt);

    res.json(
      ListCartasContempladasResponse.parse(cartas.map(mapCartaContemplada)),
    );
  },
);

router.post(
  "/cartas-contempladas",
  ensureAuth,
  ensureAdmin,
  async (req, res): Promise<void> => {
    const parsed = CreateCartaContempladaBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [carta] = await db
      .insert(cartasContempladasTable)
      .values({
        tipoBem: parsed.data.tipoBem,
        valorCredito: String(parsed.data.valorCredito),
        valorEntrada: String(parsed.data.valorEntrada),
        valorParcela: String(parsed.data.valorParcela),
        quantidadeParcelas: parsed.data.quantidadeParcelas,
        status: parsed.data.status ?? "disponivel",
        observacoes: parsed.data.observacoes ?? null,
      })
      .returning();

    res
      .status(201)
      .json(CreateCartaContempladaResponse.parse(mapCartaContemplada(carta)));
  },
);

router.get(
  "/cartas-contempladas/:id",
  ensureAuth,
  ensureAdmin,
  async (req, res): Promise<void> => {
    const params = GetCartaContempladaParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [carta] = await db
      .select()
      .from(cartasContempladasTable)
      .where(eq(cartasContempladasTable.id, params.data.id));

    if (!carta) {
      res.status(404).json({ error: "Carta contemplada não encontrada" });
      return;
    }

    res.json(GetCartaContempladaResponse.parse(mapCartaContemplada(carta)));
  },
);

router.patch(
  "/cartas-contempladas/:id",
  ensureAuth,
  ensureAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateCartaContempladaParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateCartaContempladaBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const updateData: Record<string, any> = {};
    if (parsed.data.tipoBem !== undefined)
      updateData.tipoBem = parsed.data.tipoBem;
    if (parsed.data.valorCredito !== undefined)
      updateData.valorCredito = String(parsed.data.valorCredito);
    if (parsed.data.valorEntrada !== undefined)
      updateData.valorEntrada = String(parsed.data.valorEntrada);
    if (parsed.data.valorParcela !== undefined)
      updateData.valorParcela = String(parsed.data.valorParcela);
    if (parsed.data.quantidadeParcelas !== undefined)
      updateData.quantidadeParcelas = parsed.data.quantidadeParcelas;
    if (parsed.data.status !== undefined)
      updateData.status = parsed.data.status;
    if (parsed.data.observacoes !== undefined)
      updateData.observacoes = parsed.data.observacoes;

    const [carta] = await db
      .update(cartasContempladasTable)
      .set(updateData)
      .where(eq(cartasContempladasTable.id, params.data.id))
      .returning();

    if (!carta) {
      res.status(404).json({ error: "Carta contemplada não encontrada" });
      return;
    }

    res.json(
      UpdateCartaContempladaResponse.parse(mapCartaContemplada(carta)),
    );
  },
);

router.delete(
  "/cartas-contempladas/:id",
  ensureAuth,
  ensureAdmin,
  async (req, res): Promise<void> => {
    const params = DeleteCartaContempladaParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [deleted] = await db
      .delete(cartasContempladasTable)
      .where(eq(cartasContempladasTable.id, params.data.id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Carta contemplada não encontrada" });
      return;
    }

    res.json({ success: true });
  },
);

export default router;
