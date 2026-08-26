/**
 * Regra pura da lista de acesso master. Fica separada do script que grava no
 * banco porque @workspace/db lança erro já na importação quando DATABASE_URL
 * não está definida — assim esta lógica pode ser testada isoladamente.
 */

export const ADMIN = "admin";
export const LIMITED = "consultor";

/**
 * Quem tem acesso irrestrito. Comparados em minúsculas: a base tem registros
 * gravados com caixa mista.
 */
export const MASTER_EMAILS = [
  "adilson.silva@niadcon.com.br",
  "admin@niadcon.com.br",
  "gustavo.fonseca@niadcon.com.br",
  "luiz.nascimento@niadcon.com.br",
  "suelen.azuma@niadcon.com.br",
];

export type UserRow = { id: number; name: string; email: string; role: string };

export type Change = UserRow & { from: string; to: string };

export function planChanges(
  users: UserRow[],
  masterEmails: string[] = MASTER_EMAILS,
): { changes: Change[]; missing: string[] } {
  const master = new Set(masterEmails.map((email) => email.trim().toLowerCase()));

  const changes: Change[] = [];
  for (const user of users) {
    const target = master.has(user.email.trim().toLowerCase()) ? ADMIN : LIMITED;
    if (user.role !== target) {
      changes.push({ ...user, from: user.role, to: target });
    }
  }

  // Um e-mail da lista que não existe na base é quase sempre erro de digitação
  // ou usuário ainda não cadastrado — melhor avisar do que seguir em silêncio.
  const existing = new Set(users.map((u) => u.email.trim().toLowerCase()));
  const missing = [...master].filter((email) => !existing.has(email));

  return { changes, missing };
}
