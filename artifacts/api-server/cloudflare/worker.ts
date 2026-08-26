import { Container, getContainer } from "@cloudflare/containers";

interface Env {
  API_CONTAINER: DurableObjectNamespace<ApiServerContainer>;
  DATABASE_URL: string;
  SESSION_SECRET: string;
  // Opcional. Origens extras para o allowlist de CORS (ver src/app.ts).
  EXTRA_CORS_ORIGINS?: string;
}

export class ApiServerContainer extends Container<Env> {
  defaultPort = 8080;
  // Sem sleepAfter curto: o container permanece sempre ativo (decisão de
  // produto para não invalidar o tokenStore em memória por ociosidade).

  // Encaminha os secrets do Worker (wrangler secret put DATABASE_URL /
  // SESSION_SECRET) para o processo do container — @workspace/db lança erro
  // na importação se DATABASE_URL não estiver definida, então sem isso o
  // container nunca sobe.
  envVars = {
    DATABASE_URL: this.env.DATABASE_URL,
    SESSION_SECRET: this.env.SESSION_SECRET,
    EXTRA_CORS_ORIGINS: this.env.EXTRA_CORS_ORIGINS ?? "",
    NODE_ENV: "production",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return getContainer(env.API_CONTAINER).fetch(request);
  },
};
