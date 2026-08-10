import { Router, type IRouter, type Response } from "express";
import { ensureAuth } from "./auth";

export type SaleCreatedEvent = {
  id: number;
  consultantId: number;
  consultantName: string | null;
  product: string;
  segment: string;
  amount: number;
  quantity: number;
  saleDate: string;
  createdAt: string;
};

const router: IRouter = Router();
const clients = new Set<Response>();

export function broadcastSaleCreated(sale: SaleCreatedEvent): void {
  const payload = `event: sale.created\ndata: ${JSON.stringify(sale)}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}

router.get("/events/sales", ensureAuth, (req, res): void => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  clients.add(res);
  res.write(`event: connected\ndata: {"connected":true}\n\n`);

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat ${Date.now()}\n\n`);
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(res);
    res.end();
  });
});

export default router;
