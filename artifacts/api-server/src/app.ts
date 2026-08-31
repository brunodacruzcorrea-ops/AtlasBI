import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const PROD_ORIGIN = "https://atlas.niadcon.com.br";
const PREVIEW_ORIGIN_RE = /^https:\/\/[a-z0-9-]+\.atlas-bi\.pages\.dev$/;
const LOCAL_ORIGIN_RE = /^http:\/\/localhost:\d+$/;

// Origens extras liberadas por configuracao, separadas por virgula. Usado
// durante a migracao para a Cloudflare: o front roda em
// https://atlas-bi.<subdominio>.workers.dev antes do cutover de DNS, e esse
// host nao casa com nenhum dos padroes acima. Comparacao e por igualdade
// exata de origem — nada de wildcard em *.workers.dev, que liberaria
// qualquer Worker de qualquer conta.
const EXTRA_ORIGINS = new Set(
  (process.env.EXTRA_CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (
        origin === PROD_ORIGIN ||
        PREVIEW_ORIGIN_RE.test(origin) ||
        EXTRA_ORIGINS.has(origin)
      ) {
        return callback(null, true);
      }
      if (
        process.env.NODE_ENV !== "production" &&
        LOCAL_ORIGIN_RE.test(origin)
      ) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    // Sem isto o navegador refaz o preflight a cada chamada: nos logs de
    // producao, metade das requisicoes eram OPTIONS. 24h e o teto que os
    // navegadores aceitam; a lista de origens acima muda por deploy, e o
    // deploy troca o processo de qualquer forma.
    maxAge: 86_400,
  }),
);
app.use(express.json({ limit: "3mb" }));
app.use(express.urlencoded({ extended: true, limit: "3mb" }));

app.use("/api", router);

export default app;

