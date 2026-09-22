// Normalizacao do payload que o CRM envia ao webhook de vendas.
//
// Cada CRM (e cada automacao — Zapier, Make, n8n) manda a venda com um
// formato diferente: Pipedrive embrulha o negocio em `current` ou `data`,
// outros mandam os campos soltos, alguns em portugues. Em vez de um
// endpoint por CRM, aceitamos varios apelidos por campo e convertemos tudo
// para uma venda do Atlas.
//
// Fica fora de routes/ de proposito, como lib/users.ts: sem dependencia de
// banco, as regras podem ser testadas isoladamente.

import crypto from "crypto";

export type CrmSale = {
  externalId: string | null;
  consultantId: number | null;
  consultantEmail: string | null;
  consultantName: string | null;
  product: string;
  segment: string | null;
  amount: number;
  quantity: number;
  /** null quando o CRM nao mandou data: na criacao vira hoje, na atualizacao mantem a atual. */
  saleDate: string | null;
  notes: string | null;
};

export type ParseResult =
  | { ok: true; sale: CrmSale }
  | { ok: false; ignored: true; reason: string }
  | { ok: false; ignored: false; error: string };

type Obj = Record<string, unknown>;

const WRAPPERS = ["current", "data", "deal", "negocio", "payload", "body"];

// Status que indicam venda fechada. So filtramos quando o CRM manda um
// status: um negocio "aberto" ou "perdido" nao e venda e nao deve entrar.
const WON_STATUSES = new Set([
  "won",
  "win",
  "ganho",
  "ganha",
  "vendido",
  "vendida",
  "venda",
  "fechado",
  "fechada",
  "closed_won",
  "closedwon",
  "closed won",
  "concluido",
  "concluida",
]);

const FIELDS = {
  externalId: ["externalId", "external_id", "crmId", "crm_id", "dealId", "deal_id", "id"],
  consultantId: ["consultantId", "consultant_id", "consultorId", "consultor_id"],
  consultantEmail: [
    "consultantEmail",
    "consultant_email",
    "consultorEmail",
    "consultor_email",
    "sellerEmail",
    "seller_email",
    "vendedorEmail",
    "vendedor_email",
    "ownerEmail",
    "owner_email",
    "userEmail",
    "user_email",
    "responsavelEmail",
    "responsavel_email",
  ],
  consultantName: [
    "consultantName",
    "consultant_name",
    "consultant",
    "consultor",
    "consultorNome",
    "sellerName",
    "seller_name",
    "seller",
    "vendedor",
    "vendedorNome",
    "ownerName",
    "owner_name",
    "userName",
    "user_name",
    "responsavel",
  ],
  owner: ["owner", "user", "owner_id", "user_id", "responsavel", "vendedor", "seller"],
  product: ["product", "produto", "productName", "product_name", "title", "titulo", "name", "nome"],
  segment: ["segment", "segmento", "category", "categoria"],
  amount: ["amount", "valor", "value", "price", "preco", "total", "dealValue", "deal_value"],
  quantity: ["quantity", "quantidade", "qty", "products_count"],
  saleDate: [
    "saleDate",
    "sale_date",
    "dataVenda",
    "data_venda",
    "won_time",
    "wonTime",
    "closeDate",
    "close_date",
    "closedate",
    "closed_at",
    "data",
    "date",
  ],
  notes: ["notes", "observacoes", "observacao", "obs", "description", "descricao"],
  // Etapa do funil ("stage") fica de fora: costuma ter nome livre, e um
  // "Contrato assinado" seria descartado por engano.
  status: ["status", "situacao"],
} as const;

function isObj(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Desembrulha `{ current: {...} }`, `{ data: {...} }` etc. */
export function unwrapPayload(body: unknown): Obj {
  let obj: Obj = isObj(body) ? body : {};
  for (let depth = 0; depth < 3; depth++) {
    const inner = WRAPPERS.map((k) => obj[k]).find(isObj);
    if (!inner) break;
    // Mantem os campos do nivel de fora como fallback (ex.: status), mas
    // tira os envelopes: "data" tambem e apelido de data da venda.
    const outer = Object.fromEntries(
      Object.entries(obj).filter(([k, v]) => !(WRAPPERS.includes(k) && isObj(v))),
    );
    obj = { ...outer, ...inner };
  }
  return obj;
}

function pick(obj: Obj, keys: readonly string[]): unknown {
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function asText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * Converte valores monetarios em numero. Aceita numero puro, "1500.50",
 * "1.500,50", "R$ 1.500,50" e "1,500.50".
 */
export function parseAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (isObj(value)) return parseAmount(pick(value, ["value", "amount", "valor"]));
  if (typeof value !== "string") return null;

  let s = value.replace(/[^\d.,-]/g, "");
  if (!s) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    // Formato brasileiro: ponto e milhar, virgula e decimal.
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma && lastComma !== -1) {
    // Formato americano com milhar: 1,500.50
    s = s.replace(/,/g, "");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.500" ou "1.500.000": milhar brasileiro sem centavos. Valor com
    // tres casas decimais nao existe em moeda.
    s = s.replace(/\./g, "");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Data de hoje no fuso do Brasil, em YYYY-MM-DD. */
export function todayInBrazil(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Converte a data do CRM em YYYY-MM-DD. Aceita ISO ("2026-09-22",
 * "2026-09-22 14:03:00", "2026-09-22T14:03:00Z"), formato brasileiro
 * ("22/09/2026") e timestamp Unix em segundos ou milissegundos.
 */
export function parseSaleDate(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    return todayInBrazil(new Date(ms));
  }
  if (typeof value !== "string") return null;
  const s = value.trim();

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/);
  if (iso) {
    // Com horario e fuso explicito (ex.: "Z"), converte para o dia no Brasil:
    // 23:30 de Brasilia chega como 02:30Z do dia seguinte.
    if (/[T ]\d{2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
      const d = new Date(s);
      if (!Number.isNaN(d.getTime())) return todayInBrazil(d);
    }
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${pad(Number(br[2]))}-${pad(Number(br[1]))}`;

  if (/^\d{10,13}$/.test(s)) return parseSaleDate(Number(s));

  return null;
}

function normalizeStatus(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function parseCrmSale(body: unknown): ParseResult {
  const obj = unwrapPayload(body);

  const status = asText(pick(obj, FIELDS.status));
  if (status && !WON_STATUSES.has(normalizeStatus(status))) {
    return { ok: false, ignored: true, reason: `Status "${status}" não é de venda fechada` };
  }

  // Dono do negocio pode vir como objeto (Pipedrive: user_id: { name, email }).
  const owner = FIELDS.owner.map((k) => obj[k]).find(isObj);
  const consultantEmail =
    asText(pick(obj, FIELDS.consultantEmail)) ?? (owner ? asText(owner["email"]) : null);
  const consultantName =
    asText(pick(obj, FIELDS.consultantName)) ?? (owner ? asText(owner["name"]) : null);
  const rawConsultantId = pick(obj, FIELDS.consultantId);
  const consultantId =
    rawConsultantId !== undefined && /^\d+$/.test(String(rawConsultantId).trim())
      ? Number(rawConsultantId)
      : null;

  if (consultantId == null && !consultantEmail && !consultantName) {
    return {
      ok: false,
      ignored: false,
      error: "Informe o consultor: consultantEmail, consultantName ou consultantId",
    };
  }

  const amount = parseAmount(pick(obj, FIELDS.amount));
  if (amount == null || amount < 0) {
    return { ok: false, ignored: false, error: "Informe o valor da venda (amount ou valor)" };
  }

  const product = asText(pick(obj, FIELDS.product));
  if (!product) {
    return { ok: false, ignored: false, error: "Informe o produto (product ou produto)" };
  }

  const rawQuantity = Number(pick(obj, FIELDS.quantity));
  const quantity = Number.isInteger(rawQuantity) && rawQuantity > 0 ? rawQuantity : 1;

  const rawDate = pick(obj, FIELDS.saleDate);
  const saleDate = rawDate === undefined ? null : parseSaleDate(rawDate);
  if (rawDate !== undefined && !saleDate) {
    return {
      ok: false,
      ignored: false,
      error: `Data da venda inválida: ${JSON.stringify(rawDate)}. Use AAAA-MM-DD ou DD/MM/AAAA`,
    };
  }

  const segmentValue = pick(obj, FIELDS.segment);
  const segment = isObj(segmentValue) ? asText(segmentValue["name"]) : asText(segmentValue);

  return {
    ok: true,
    sale: {
      externalId: asText(pick(obj, FIELDS.externalId)),
      consultantId,
      consultantEmail: consultantEmail ? consultantEmail.toLowerCase() : null,
      consultantName,
      product,
      segment,
      amount,
      quantity,
      saleDate,
      notes: asText(pick(obj, FIELDS.notes)),
    },
  };
}

/**
 * Compara o token recebido com o configurado em tempo constante, para nao
 * vazar o segredo por diferenca de tempo de resposta.
 */
export function tokenMatches(received: string | undefined, expected: string): boolean {
  if (!received) return false;
  const a = crypto.createHash("sha256").update(received).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

type ConsultantRef = { id: number; name: string; email: string | null; active: boolean };

function normalizeName(value: string): string {
  return normalizeStatus(value).replace(/\s+/g, " ");
}

/**
 * Encontra o consultor do Atlas dono da venda. Ordem: id, e-mail, nome.
 * E-mail e o mais confiavel, porque e o mesmo que o vendedor usa no CRM;
 * nome ignora maiusculas e acentos, mas so vale se for unico — com dois
 * "Joao Silva" a venda nao pode ir para o ranking de qualquer um deles.
 */
export function matchConsultant<T extends ConsultantRef>(
  consultants: T[],
  sale: Pick<CrmSale, "consultantId" | "consultantEmail" | "consultantName">,
): { ok: true; consultant: T } | { ok: false; error: string } {
  if (sale.consultantId != null) {
    const byId = consultants.find((c) => c.id === sale.consultantId);
    if (byId) return { ok: true, consultant: byId };
  }

  if (sale.consultantEmail) {
    const email = sale.consultantEmail.trim().toLowerCase();
    const byEmail = consultants.filter((c) => c.email?.trim().toLowerCase() === email);
    const active = byEmail.filter((c) => c.active);
    const pool = active.length > 0 ? active : byEmail;
    if (pool.length === 1) return { ok: true, consultant: pool[0] };
  }

  if (sale.consultantName) {
    const name = normalizeName(sale.consultantName);
    const byName = consultants.filter((c) => normalizeName(c.name) === name);
    const active = byName.filter((c) => c.active);
    const pool = active.length > 0 ? active : byName;
    if (pool.length === 1) return { ok: true, consultant: pool[0] };
    if (pool.length > 1) {
      return {
        ok: false,
        error: `Mais de um consultor chamado "${sale.consultantName}"; envie consultantEmail`,
      };
    }
  }

  const tried = [
    sale.consultantId != null ? `id ${sale.consultantId}` : null,
    sale.consultantEmail ? `e-mail ${sale.consultantEmail}` : null,
    sale.consultantName ? `nome "${sale.consultantName}"` : null,
  ].filter(Boolean);
  return {
    ok: false,
    error: `Consultor não encontrado no Atlas (${tried.join(", ")}). Cadastre-o com o mesmo e-mail usado no CRM`,
  };
}
