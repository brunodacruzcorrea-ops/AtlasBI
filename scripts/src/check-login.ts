/**
 * Diagnóstico de um login que está falhando com 401.
 *
 * A resposta da API é a mesma para conta inexistente e para senha errada, de
 * propósito — dizer qual dos dois falhou entregaria quais e-mails existem na
 * base. Este script, que só a equipe roda, separa os casos:
 *
 *   pnpm --filter @workspace/scripts run check-login suelen.azuma@niadcon.com.br
 *   pnpm --filter @workspace/scripts run check-login suelen.azuma@niadcon.com.br 'senha-para-testar'
 *
 * Sem a senha, apenas lista os registros que casam com o e-mail ignorando a
 * caixa. Com a senha, também diz qual registro ela abre.
 *
 * Somente leitura. Precisa de DATABASE_URL.
 */
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

// Mesmo hash das rotas: qualquer divergência aqui daria um diagnóstico falso.
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "atlas_bi_salt_2024").digest("hex");
}

async function main(): Promise<void> {
  const [emailArg, passwordArg] = process.argv.slice(2);

  if (!emailArg) {
    console.error("Uso: check-login <e-mail> [senha]");
    process.exitCode = 1;
    return;
  }

  const email = emailArg.trim().toLowerCase();

  const rows = await db
    .select()
    .from(usersTable)
    .where(sql`lower(${usersTable.email}) = ${email}`)
    .orderBy(usersTable.id);

  if (rows.length === 0) {
    console.log(`Nenhum usuário com o e-mail ${email}.`);
    console.log("O 401 é conta inexistente: crie o usuário na tela de gestão.");
    return;
  }

  if (rows.length > 1) {
    console.log(
      `ATENÇÃO: ${rows.length} registros dividem esse e-mail, diferindo só na caixa.`,
    );
    console.log("Mantenha um só — o outro guarda a senha antiga.\n");
  }

  for (const row of rows) {
    console.log(`id=${row.id}  email=${JSON.stringify(row.email)}  cargo=${row.role}`);
    console.log(`  nome: ${row.name}`);
    console.log(`  criado em: ${String(row.createdAt)}`);
    if (passwordArg) {
      const confere = row.passwordHash === hashPassword(passwordArg);
      console.log(`  senha informada: ${confere ? "CONFERE" : "não confere"}`);
    }
    console.log();
  }

  if (passwordArg && !rows.some((r) => r.passwordHash === hashPassword(passwordArg))) {
    console.log("Nenhum registro aceita essa senha: redefina pela tela de gestão.");
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
