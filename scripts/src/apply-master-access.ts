/**
 * Aplica a lista de acesso master: os e-mails de MASTER_EMAILS viram `admin`,
 * todo o resto vira `consultor`.
 *
 * Roda em dry-run por padrão — só imprime o que mudaria. Passe --apply para
 * gravar.
 *
 *   pnpm --filter @workspace/scripts run master-access
 *   pnpm --filter @workspace/scripts run master-access -- --apply
 *
 * Precisa de DATABASE_URL apontando para o banco alvo.
 */
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { MASTER_EMAILS, planChanges } from "./master-access";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  const users = await db.select().from(usersTable).orderBy(usersTable.name);
  const { changes, missing } = planChanges(users, MASTER_EMAILS);

  console.log(`${users.length} usuários na base.`);
  console.log(`${MASTER_EMAILS.length} e-mails na lista master.`);

  if (missing.length > 0) {
    console.log("\nNa lista master mas SEM cadastro na base:");
    for (const email of missing) console.log(`  - ${email}`);
  }

  if (changes.length === 0) {
    console.log("\nNenhuma alteração necessária: os cargos já batem com a lista.");
    return;
  }

  console.log(`\n${changes.length} alteração(ões)${apply ? "" : " (dry-run)"}:`);
  for (const change of changes) {
    const action = change.to === "admin" ? "PROMOVE" : "LIMITA ";
    console.log(
      `  ${action}  ${change.name} <${change.email}>  ${change.from} -> ${change.to}`,
    );
  }

  if (!apply) {
    console.log("\nNada foi gravado. Rode de novo com --apply para aplicar.");
    return;
  }

  for (const change of changes) {
    await db
      .update(usersTable)
      .set({ role: change.to })
      .where(eq(usersTable.id, change.id));
  }

  console.log(`\n${changes.length} usuário(s) atualizado(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
