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

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (origin === PROD_ORIGIN || PREVIEW_ORIGIN_RE.test(origin)) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
  }),
);
app.use(express.json({ limit: "3mb" }));
app.use(express.urlencoded({ extended: true, limit: "3mb" }));

app.use("/api", router);

export default app;

