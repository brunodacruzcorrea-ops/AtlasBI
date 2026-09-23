import { defineConfig } from "drizzle-kit";
import path from "path";

// DATABASE_URL nao e exigida aqui de proposito. O `generate` compara o schema
// com as migracoes ja versionadas e roda offline — inclusive no CI, que nao
// tem banco. Quem precisa da conexao e o `migrate` e o `push`, e esses falham
// com a mensagem do proprio drizzle-kit quando a variavel esta ausente.
export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  out: path.join(__dirname, "./migrations"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
