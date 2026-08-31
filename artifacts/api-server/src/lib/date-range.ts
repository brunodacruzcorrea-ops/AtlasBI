// Faixas de data para as consultas de vendas.
//
// As consultas filtravam o mes com EXTRACT(MONTH FROM sale_date) = $1. Isso
// funciona, mas envolve a coluna numa funcao, e uma coluna dentro de funcao
// nao pode usar indice: o Postgres varre a tabela inteira de vendas em toda
// chamada do painel, e o custo cresce junto com o historico.
//
// Comparar por faixa — sale_date >= inicio AND sale_date < inicio do mes
// seguinte — devolve exatamente as mesmas linhas e usa o indice de sale_date.
// O limite superior e exclusivo de proposito: assim nao e preciso saber
// quantos dias tem o mes, e nao ha risco de perder o ultimo dia.

const pad = (value: number): string => String(value).padStart(2, "0");

export type DateRange = { start: string; endExclusive: string };

/** Primeiro dia do mes ate o primeiro dia do mes seguinte (exclusivo). */
export function monthRange(year: number, month: number): DateRange {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return {
    start: `${year}-${pad(month)}-01`,
    endExclusive: `${nextYear}-${pad(nextMonth)}-01`,
  };
}

/** Primeiro dia do ano ate o primeiro dia do ano seguinte (exclusivo). */
export function yearRange(year: number): DateRange {
  return { start: `${year}-01-01`, endExclusive: `${year + 1}-01-01` };
}
