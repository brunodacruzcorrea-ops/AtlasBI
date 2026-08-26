/**
 * Relatório do vínculo usuário <-> consultor, que é feito por e-mail.
 *
 * Um consultor sem e-mail cadastrado, ou com e-mail diferente do usuário que o
 * representa, não casa — e essa pessoa deixa de ver a própria meta individual
 * (continua vendo a meta de equipe). Este script aponta esses casos.
 *
 *   pnpm --filter @workspace/scripts run check-links
 *
 * Somente leitura. Precisa de DATABASE_URL.
 */
import { db, usersTable, consultantsTable } from "@workspace/db";

const norm = (value: string | null): string => (value ?? "").trim().toLowerCase();

async function main(): Promise<void> {
  const users = await db.select().from(usersTable).orderBy(usersTable.name);
  const consultants = await db.select().from(consultantsTable).orderBy(consultantsTable.name);

  const consultantByEmail = new Map<string, (typeof consultants)[number]>();
  for (const consultant of consultants) {
    const email = norm(consultant.email);
    if (email) consultantByEmail.set(email, consultant);
  }

  const semVinculo: typeof users = [];
  const vinculados: { user: string; consultant: string }[] = [];

  for (const user of users) {
    // Admin não precisa de vínculo: enxerga todas as metas de qualquer forma.
    if (user.role === "admin") continue;

    const consultant = consultantByEmail.get(norm(user.email));
    if (consultant) {
      vinculados.push({ user: user.email, consultant: consultant.name });
    } else {
      semVinculo.push(user);
    }
  }

  const consultoresSemEmail = consultants.filter((c) => !norm(c.email));

  console.log(`${users.length} usuários, ${consultants.length} consultores.`);
  console.log(`${vinculados.length} usuário(s) não-admin com consultor vinculado.`);

  if (consultoresSemEmail.length > 0) {
    console.log(`\n${consultoresSemEmail.length} consultor(es) SEM e-mail cadastrado:`);
    for (const c of consultoresSemEmail) console.log(`  - ${c.name} (id ${c.id})`);
  }

  if (semVinculo.length > 0) {
    console.log(`\n${semVinculo.length} usuário(s) sem consultor correspondente:`);
    console.log("  (não verão a própria meta individual até os e-mails baterem)");
    for (const u of semVinculo) console.log(`  - ${u.name} <${u.email}>`);
  }

  if (semVinculo.length === 0 && consultoresSemEmail.length === 0) {
    console.log("\nTodos os vínculos estão resolvidos.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
