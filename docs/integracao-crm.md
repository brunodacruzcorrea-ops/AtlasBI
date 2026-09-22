# Integração com o CRM

Toda venda fechada no CRM entra sozinha no Atlas: aparece em Vendas, conta no
ranking e nas metas, e dispara o aviso de venda nova em tempo real, igual a
uma venda cadastrada à mão.

Funciona por **webhook**: o CRM avisa o Atlas a cada venda. Serve para
qualquer CRM que envie webhook (Pipedrive, RD Station CRM, Kommo, Agendor,
Ploomes, HubSpot etc.) ou por meio de uma automação (Zapier, Make, n8n).

## 1. Configurar o servidor (uma vez)

No serviço da API (Railway), em *Variables*, crie:

| Variável | Obrigatória | Para quê |
| --- | --- | --- |
| `CRM_WEBHOOK_TOKEN` | sim | Senha do webhook. Gere uma longa e aleatória, ex.: `openssl rand -hex 32`. Sem ela o endpoint responde 503. |
| `CRM_DEFAULT_SEGMENT` | não | Segmento usado quando o CRM não mandar um. Padrão: `CRM`. |

A tabela `crm_sale_links` (que evita venda duplicada) é criada sozinha na
primeira chamada; não precisa rodar migração.

## 2. Configurar o webhook no CRM

- **URL:** `https://<endereço-da-api>/api/integrations/crm/sales?token=<CRM_WEBHOOK_TOKEN>`
- **Método:** `POST`
- **Corpo:** JSON ou formulário (`application/x-www-form-urlencoded`)
- **Quando disparar:** quando o negócio for marcado como **ganho/vendido**.

Se o CRM permitir cabeçalhos, prefira mandar o token no cabeçalho
`X-Atlas-Token` (ou `Authorization: Bearer <token>`) em vez da URL.

## 3. Campos aceitos

Os nomes abaixo são aceitos em inglês ou português; o primeiro de cada linha
é o recomendado. Se o CRM embrulhar o negócio em `current`, `data`, `deal`,
`business` ou `payload` (caso do Pipedrive), o Atlas desembrulha sozinho.

| Campo | Obrigatório | Nomes aceitos | Observação |
| --- | --- | --- | --- |
| Consultor | sim | `consultantEmail`, `vendedorEmail`, `owner_email`, `user_email` · ou `consultantName`, `vendedor`, `owner_name` · ou `consultantId` · ou objeto `attendant`/`owner`/`user` com `name` e `email` | O **e-mail** é o mais seguro: precisa ser o mesmo cadastrado no consultor do Atlas. Por nome, ignora maiúsculas e acentos, mas o nome precisa ser único. |
| Produto | não | `product`, `produto` · ou o primeiro item de `products`/`produtos` (lista ou texto JSON) · ou `title`, `titulo`, `name` | Padrão: "Venda via CRM". |
| Valor | sim | `amount`, `valor`, `value`, `price`, `total` | Aceita `1500.50`, `1.500,50`, `R$ 1.500,50`. |
| ID do negócio | recomendado | `externalId`, `dealId`, `deal_id`, `id` | Com ele, reenvios e edições **atualizam** a venda em vez de duplicar. |
| Segmento | não | `segment`, `segmento`, `category`, `categoria` | Padrão: `CRM_DEFAULT_SEGMENT`. |
| Data da venda | não | `saleDate`, `dataVenda`, `won_time`, `wonAt`, `closedAt`, `closeDate`, `data` | `AAAA-MM-DD`, `DD/MM/AAAA` ou data/hora ISO. Padrão: hoje (Brasília). |
| Quantidade | não | `quantity`, `quantidade` | Padrão: 1. |
| Observações | não | `notes`, `observacoes`, `description` | |
| Status | não | `status`, `situacao` | Se vier, só entra venda com status de ganho (`won`, `ganho`, `vendido`, `fechado`, `closedwon`...). Outros status são ignorados. |

Exemplo mínimo:

```json
{
  "externalId": "negocio-1234",
  "consultantEmail": "ana@niadcon.com.br",
  "product": "Consórcio Imóvel",
  "segment": "Imobiliário",
  "amount": 250000,
  "saleDate": "2026-09-22"
}
```

## 4. Respostas

| Código | Significado |
| --- | --- |
| `201` | Venda criada. |
| `200` com `"created": false` | Negócio já recebido antes: venda atualizada (só os campos enviados). |
| `200` com `"ignored": true` | Negócio não está ganho, ou a venda foi apagada no Atlas. Nada muda. |
| `401` | Token errado ou ausente. |
| `422` | Faltou campo obrigatório ou o consultor não foi encontrado. A mensagem diz o quê; quando o formato não é reconhecido, `receivedFields` lista os campos que chegaram. |
| `503` | `CRM_WEBHOOK_TOKEN` não configurado no servidor. |

## 5. Testar

```bash
curl -X POST "https://<endereço-da-api>/api/integrations/crm/sales" \
  -H "X-Atlas-Token: <CRM_WEBHOOK_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"externalId":"teste-1","consultantEmail":"ana@niadcon.com.br","product":"Teste","amount":1}'
```

Depois apague a venda de teste na tela de Vendas.

## DataCrazy (CRM da NIADCON)

1. No DataCrazy, crie uma **automação** com o gatilho de negócio **ganho**
   (mudança de status do negócio para ganho).
2. Adicione a ação de **webhook / requisição HTTP**:
   - Método `POST`
   - URL: `https://<endereço-da-api>/api/integrations/crm/sales?token=<CRM_WEBHOOK_TOKEN>`
3. Se a ação enviar o negócio completo, não precisa configurar mais nada: o
   Atlas lê do negócio o `id`, o `total`, o `status`, o responsável
   (`attendant`: nome e e-mail), o primeiro item de `products` como produto
   e a data de ganho. Negócios em andamento ou perdidos são ignorados.
4. Se a ação permitir montar o corpo com variáveis, prefira o JSON explícito
   do exemplo acima, com as variáveis do negócio: ID do negócio em
   `externalId`, e-mail do responsável em `consultantEmail`, produto em
   `product`, valor em `amount` e data de ganho em `saleDate`.
5. O e-mail do responsável no DataCrazy precisa ser o mesmo do consultor no
   Atlas (ou o nome, se for único).
6. Ganhe um negócio de teste e confira na tela de Vendas. Se o DataCrazy
   mostrar erro `422`, a resposta traz `receivedFields` com os nomes dos
   campos que chegaram; é isso que precisa para ajustar o mapeamento.

## Dicas para outros CRMs

- **Pipedrive:** *Configurações → Ferramentas e integrações → Webhooks →
  Criar*. Evento: `updated.deal` (ou `change` em `deal`). O Atlas usa
  `status: won`, `title`, `value`, `won_time` e o dono do negócio; negócios
  abertos ou perdidos são ignorados. O dono precisa ter no Pipedrive o mesmo
  e-mail do consultor no Atlas (ou o mesmo nome).
- **CRMs sem webhook configurável por campo (HubSpot, Salesforce, RD etc.):**
  use uma automação (fluxo do próprio CRM, Zapier, Make ou n8n) disparada em
  "negócio ganho", com ação *Webhook/HTTP POST* para a URL acima, montando o
  JSON do exemplo com os campos do negócio.

## Limitações

- Um negócio ganho e depois reaberto/perdido no CRM **não** sai do Atlas
  automaticamente; apague a venda na tela de Vendas.
- Venda apagada no Atlas não volta se o CRM reenviar o mesmo negócio.
