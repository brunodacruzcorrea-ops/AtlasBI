import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PartyPopper } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/utils";

type SaleCreatedEvent = {
  id: number;
  consultantName: string | null;
  product: string;
  amount: number;
  quantity: number;
};

const COLORS = ["#f97316", "#fbbf24", "#10b981", "#38bdf8", "#ffffff"];

export function SalesRealtimeNotifications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [celebrationId, setCelebrationId] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("atlas_token");
    if (!token) return;

    const controller = new AbortController();
    let reconnectTimer: number | undefined;
    // A reconexao era fixa em 4s. Com a API fora do ar, todo painel aberto
    // repetia a chamada a cada 4 segundos indefinidamente, justo quando o
    // servico esta caido. O intervalo agora dobra a cada falha, ate 1 minuto,
    // e volta ao inicio assim que a conexao e aceita.
    let reconnectDelay = 4000;
    const MAX_RECONNECT_DELAY = 60_000;

    const connect = async () => {
      try {
        const baseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
        const response = await fetch(`${baseUrl}/api/events/sales`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Canal indisponível: ${response.status}`);
        }

        reconnectDelay = 4000;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const messages = buffer.split("\n\n");
          buffer = messages.pop() || "";

          for (const message of messages) {
            const eventName = message.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim();
            const data = message.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim();
            if (eventName !== "sale.created" || !data) continue;

            const sale = JSON.parse(data) as SaleCreatedEvent;
            setCelebrationId(Date.now());
            toast({
              title: "🎉 Nova venda registrada!",
              description: `${sale.consultantName || "Consultor"} vendeu ${formatBRL(sale.amount)} · ${sale.product}`,
              duration: 6500,
            });
            queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
            queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          reconnectTimer = window.setTimeout(connect, reconnectDelay);
          reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
        }
      }
    };

    connect();
    return () => {
      controller.abort();
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
    };
  }, [queryClient, toast]);

  if (!celebrationId) return null;

  return (
    <div key={celebrationId} className="sale-firework-layer" aria-hidden="true">
      <div className="sale-firework-core">
        <PartyPopper className="h-7 w-7 text-amber-300" />
      </div>
      {Array.from({ length: 24 }).map((_, index) => (
        <span
          key={index}
          className="sale-firework-particle"
          style={{
            "--angle": `${index * 15}deg`,
            "--distance": `${70 + (index % 4) * 18}px`,
            "--delay": `${(index % 3) * 35}ms`,
            backgroundColor: COLORS[index % COLORS.length],
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
