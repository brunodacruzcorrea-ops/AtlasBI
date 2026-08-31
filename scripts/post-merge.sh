#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Aplica as migracoes versionadas. Antes era `push`, que compara schema e banco
# e aplica a diferenca sem revisao — conveniente no comeco, arriscado em
# producao, porque uma coluna renomeada vira DROP + CREATE sem ninguem ver.
pnpm --filter db migrate
