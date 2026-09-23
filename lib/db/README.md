# @workspace/db

Schema Drizzle e migracoes do Atlas BI.

## Como o schema chega ao banco

O deploy aplica sozinho. O comando de start do servico da API roda
`pnpm --filter db migrate` antes de subir o servidor, entao toda migracao
versionada e aplicada assim que o deploy entra. Nao ha passo manual.

O `migrate` e idempotente: ele consulta a tabela `__drizzle_migrations` e
aplica so o que ainda nao foi aplicado. Reiniciar o container nao repete nada.

## Como mudar o schema

1. Edite os arquivos em `src/schema/`.
2. Rode `pnpm --filter db generate`. Isso cria o arquivo SQL em `migrations/`
   comparando o schema com as migracoes que ja existem. Nao precisa de banco.
3. **Leia o SQL gerado** e commite junto com a mudanca de schema. Ele e
   revisado no PR como qualquer codigo — e o momento de perceber que uma
   coluna renomeada virou DROP + CREATE.
4. O deploy aplica.

## Por que nao `push`

`drizzle-kit push` compara schema e banco e aplica a diferenca na hora, sem
gerar arquivo. E pratico no comeco, mas nao deixa rastro, nao passa por
revisao, e em producao apaga dado sem avisar quando interpreta um rename como
uma coluna removida e outra criada. Ele continua disponivel (`pnpm --filter db
push`) para banco de desenvolvimento descartavel, e so para isso.

## A migracao 0000

E a baseline. O banco de producao ja existia quando as migracoes foram
introduzidas — tinha sido criado por `push` — entao os comandos dela usam
`IF NOT EXISTS`: aplicada no banco que ja estava no ar, cria apenas os indices
novos; aplicada num banco vazio, cria tudo.

Ela e a unica editada a mao, por causa disso. As proximas saem do `generate`
como estao.
