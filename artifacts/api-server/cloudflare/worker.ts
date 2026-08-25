import { Container, getContainer } from "@cloudflare/containers";

export class ApiServerContainer extends Container {
  defaultPort = 8080;
  // Sem sleepAfter curto: o container permanece sempre ativo (decisão de
  // produto para não invalidar o tokenStore em memória por ociosidade).
}

interface Env {
  API_CONTAINER: DurableObjectNamespace<ApiServerContainer>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return getContainer(env.API_CONTAINER).fetch(request);
  },
};
