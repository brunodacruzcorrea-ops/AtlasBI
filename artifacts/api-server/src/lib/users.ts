// Helpers puros de usuario/autenticacao.
//
// Ficam fora de routes/ de proposito: routes/auth.ts importa @workspace/db,
// que lanca erro na importacao quando DATABASE_URL nao esta definida. Aqui
// nao ha dependencia de banco, entao estas regras podem ser testadas
// isoladamente.

/**
 * O cadastro de usuarios nunca normalizou o e-mail, entao existem registros
 * gravados com maiusculas. Normalizar dos dois lados da comparacao e o que
 * faz o login funcionar para quem digita em caixa diferente da cadastrada,
 * ou cola o endereco com um espaco no fim.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Papeis aceitos. `admin` tem acesso irrestrito (gerencia usuarios e edita
 * consultores); `consultor` so visualiza.
 *
 * Os nomes vem do que ja existe em producao: a base grava "admin" e
 * "consultor" em minusculas, e a tela apenas capitaliza na exibicao. Antes o
 * campo era texto livre com default "admin", o que fazia todo usuario criado
 * virar administrador.
 */
export const ROLES = ["admin", "consultor"] as const;

export type Role = (typeof ROLES)[number];

export function isValidRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export const MIN_PASSWORD_LENGTH = 6;

export function isValidPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= MIN_PASSWORD_LENGTH;
}

/**
 * Registro minimo que o login precisa avaliar. Existe para manter esta
 * escolha testavel sem banco: o shape real vem de usersTable.
 */
export type LoginCandidate = { id: number; email: string; passwordHash: string };

export type LoginMatch<T extends LoginCandidate> = {
  /** Registro cuja senha confere, ou null quando nenhum confere. */
  user: T | null;
  /** Quantos registros dividem o mesmo e-mail ignorando a caixa. */
  candidateCount: number;
};

/**
 * Escolhe, entre os registros que casam com o e-mail, aquele cuja senha
 * confere.
 *
 * A coluna `email` tem UNIQUE, mas o UNIQUE do Postgres diferencia
 * maiusculas: `Suelen.Azuma@` e `suelen.azuma@` convivem na mesma tabela,
 * porque o cadastro so passou a normalizar depois que a base ja tinha
 * registros antigos.
 *
 * O login busca por `lower(email)`, entao os dois casam. Pegar o primeiro e
 * comparar so a senha dele — que era o que a rota fazia — reprova a pessoa
 * quando o banco devolve a linha antiga, mesmo com a senha certa. E como a
 * redefinicao de senha grava por id, ela pode gravar na outra linha, o que
 * faz a redefinicao parecer nao ter efeito nenhum.
 *
 * Avaliar todos os candidatos resolve o login. A duplicata em si continua
 * sendo sujeira de dados, e quem chama registra o aviso.
 */
export function selectUserForLogin<T extends LoginCandidate>(
  candidates: readonly T[],
  hashedPassword: string,
): LoginMatch<T> {
  const user = candidates.find((c) => c.passwordHash === hashedPassword) ?? null;
  return { user, candidateCount: candidates.length };
}
