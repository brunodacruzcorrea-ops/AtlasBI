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

  let heartbeat: NodeJS.Timeout | undefined;

  const cleanup = (): void => {
    if (heartbeat) clearInterval(heartbeat);
    clients.delete(res);
  };

  // A dead connection (e.g. killed by an intermediate proxy's idle/streaming
  // timeout) can make res.write() fail. Without an "error" listener, Node
  // treats that as an unhandled error on the stream and crashes the whole
  // process - which is what was taking the service offline. Handle it
  // gracefully instead, same as broadcastSaleCreated already does.
  res.on("error", cleanup);

  try {
    res.write(`event: connected\ndata: {"connected":true}\n\n`);
  } catch {
    cleanup();
    return;
  }

  heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      cleanup();
    }
  }, 25_000);

  req.on("close", () => {
    cleanup();
    res.end();
  });
});

export default router;
