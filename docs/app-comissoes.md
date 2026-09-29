# App de comissões (PWA)

O vendedor acessa `/comissoes` no celular e instala o app na tela inicial
("Adicionar à tela inicial"). Ele vê só a própria previsão; o rateio da
Corretora, Gestão e Supervisão é visível apenas para admin.

## Como funciona

- **Regra de comissão** (admin → *Regras de comissão*): por administradora +
  produto + tipo de venda (campo vazio = qualquer). Define o % total sobre o
  crédito, o rateio (Corretora/Gestão/Supervisão/Vendedor, soma 100%), as
  parcelas (% da comissão em cada uma, soma 100%), quantos meses até a 1ª
  parcela e o estorno. A regra mais específica vence.
- **Administradora da venda**: informada em *Parcelas e inadimplência* (o
  webhook do CRM ainda não envia esse dado).
- **Inadimplência**: o admin marca a parcela como inadimplente (ou ela e as
  seguintes). Parcela inadimplente não gera repasse ao vendedor. Parcelas de
  meses anteriores contam como recebidas, salvo marca em contrário.
- **Estorno**: se a regra estorna e a inadimplência ocorre até a parcela
  configurada, o % configurado do que o vendedor já recebeu volta como estorno,
  no mês da 1ª parcela inadimplente.
- **Login do vendedor**: o usuário precisa ter o mesmo e-mail do cadastro em
  *Consultores*.

## Técnico

- Cálculo puro e testado: `artifacts/api-server/src/lib/commission.ts`.
- Rotas: `artifacts/api-server/src/routes/commissions.ts`. As três tabelas
  (`commission_rules`, `sale_commission_meta`, `commission_installment_marks`)
  são criadas sob demanda; `db push` também as cria.
- PWA: `public/manifest.webmanifest`, `public/sw.js` (nunca guarda `/api`).
