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
