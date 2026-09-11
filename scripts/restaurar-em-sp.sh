#!/usr/bin/env bash
# Restaura o dump já feito no projeto de São Paulo. Um passo, sem etapas.
#
# O roteiro completo virou atrito: cinco execuções, cinco bugs meus, e o dump
# já estava pronto desde a segunda. Isto faz só o que falta.
set -euo pipefail

D="$(cd "$(dirname "$0")/.." && pwd)/.migracao-supabase"
PROD="wntrsavneabdcrztwudf"
SP="eorvzmvjmxmfejujbgiu"

for f in roles.sql schema.sql data.sql; do
  [ -s "$D/$f" ] || { echo "Falta $D/$f — rode o dump antes."; exit 1; }
done

# Pedir a string inteira foi um erro: ela tem quatro partes que precisam estar
# certas ao mesmo tempo, e a de produção está a uma aba de distância no mesmo
# painel. O ref de São Paulo já está aqui em cima — só falta a senha, e o resto
# o script monta.
echo "Senha do banco do projeto de SÃO PAULO ($SP)."
echo
echo "  Onde: painel do projeto → Settings → Database"
echo "  Se não souber, use 'Reset database password' e cole a nova."
echo
read -r -s -p "  senha: " PW
echo

[ -n "$PW" ] || { echo "Senha vazia."; exit 1; }

# A senha vai na URL, então caracteres como @ : / e # precisam ser escapados —
# senão eles viram separadores e a string quebra de um jeito que parece "senha
# errada".
PW_ENC=$(python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$PW")

URL=""
for HOST in aws-0-sa-east-1.pooler.supabase.com aws-1-sa-east-1.pooler.supabase.com; do
  TRY="postgresql://postgres.$SP:$PW_ENC@$HOST:5432/postgres"
  printf "  testando %s ... " "${HOST%%.*}"
  if psql "$TRY" -c 'select 1' >/dev/null 2>&1; then
    echo "conectou"
    URL="$TRY"
    break
  fi
  echo "não"
done

if [ -z "$URL" ]; then
  echo
  echo "Não conectei em nenhum dos dois hosts do pooler de São Paulo."
  echo "O mais provável é a senha. Redefina em Settings → Database"
  echo "→ Reset database password e rode de novo."
  exit 1
fi

# ALTER ROLE supabase_admin é recusado: papel reservado. O arquivo só ajusta
# statement_timeout, que o projeto novo já traz no padrão.
grep -v supabase_admin "$D/roles.sql" > "$D/roles.filtrado.sql"

# O ensaio já povoou este banco, então uma segunda restauração colide por
# chave duplicada. Na virada isso importa: o dump precisa ser refeito na hora,
# com ninguém usando o sistema, e restaurado sobre um banco limpo.
#
# Derruba os schemas que o dump recria. `auth` e `storage` são gerenciados pelo
# Supabase — esses a gente esvazia em vez de derrubar, senão o projeto quebra.
if [ "${LIMPAR:-0}" = "1" ]; then
  echo
  echo "LIMPANDO o banco de São Paulo antes de restaurar."
  echo "Isto apaga o que o ensaio deixou lá. A produção não é tocada."
  read -r -p "  digite LIMPAR para confirmar: " OK
  [ "$OK" = "LIMPAR" ] || { echo "Cancelado."; exit 1; }

  psql "$URL" -q \
    -c 'DROP SCHEMA IF EXISTS public CASCADE;' \
    -c 'CREATE SCHEMA public;' \
    -c 'GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;' \
    -c 'TRUNCATE auth.users CASCADE;' \
    -c 'TRUNCATE storage.objects CASCADE;' \
    -c 'DELETE FROM storage.buckets;'
  echo "Limpo."
fi

# Pré-voo: o dump traz `auth.users`, e `auth` não é derrubado pelo LIMPAR de
# `public` — é um schema gerenciado pelo Supabase. Um banco que já recebeu uma
# restauração antes colide em `users_pkey`, e como tudo roda em transação única
# o rollback leva junto as 46 tabelas que já tinham entrado. O sintoma é cruel:
# uma parede de erro do Postgres e um banco que continua exatamente vazio.
#
# Então perguntamos antes, em vez de descobrir no meio.
USERS=$(psql "$URL" -tAc 'select count(*) from auth.users' 2>/dev/null || echo "?")
TABELAS=$(psql "$URL" -tAc "select count(*) from pg_tables where schemaname='public'" 2>/dev/null || echo "?")

if [ "${LIMPAR:-0}" != "1" ] && { [ "${USERS:-0}" != "0" ] || [ "${TABELAS:-0}" != "0" ]; }; then
  echo
  echo "Este banco não está vazio: $USERS logins em auth.users, $TABELAS tabelas em public."
  echo
  echo "Restaurar por cima colide em chave duplicada, e como é transação única"
  echo "o rollback desfaz tudo — você termina com o banco do jeito que está."
  echo
  echo "Para limpar antes e restaurar:"
  echo
  echo "    LIMPAR=1 $0"
  echo
  exit 1
fi

# O dump cria `vector` e `pg_trgm` em `public` — é onde as migrations deste
# projeto as puseram. Habilitá-las pelo painel antes instala em `extensions`,
# e aí o `CREATE EXTENSION IF NOT EXISTS` do dump vira no-op: a extensão
# existe, mas `public.vector` não, e o restore morre na primeira função que
# usa esse tipo.
#
# Então derrubamos as duas antes e deixamos o dump criá-las onde precisa. No
# projeto de destino isso é inofensivo: ele ainda não tem dado nenhum.
echo
echo "Limpando extensões pré-instaladas no schema errado..."
# Sem `2>/dev/null || true`. Essa linha já engoliu a falha uma vez: se o drop
# não passa, o `CREATE EXTENSION IF NOT EXISTS ... WITH SCHEMA public` do dump
# vira no-op — a extensão existe em `extensions`, `public.vector` não existe, e
# o restore morre lá na frente na primeira função que usa o tipo. O erro
# precisa aparecer aqui, onde ainda diz o que fazer.
if ! psql "$URL" -q -c 'DROP EXTENSION IF EXISTS vector CASCADE;' \
                    -c 'DROP EXTENSION IF EXISTS pg_trgm CASCADE;'; then
  echo
  echo "Não consegui derrubar as extensões pré-instaladas."
  echo "Se elas estiverem no schema 'extensions', o restore vai falhar com"
  echo "'type public.vector does not exist'. Resolva isso antes de seguir."
  exit 1
fi

echo
echo "Restaurando. Transação única: ou entra tudo, ou não entra nada."
echo

psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file "$D/roles.filtrado.sql" \
  --file "$D/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$D/data.sql" \
  --dbname "$URL"

echo
echo "Conferindo:"
psql "$URL" -tAc "select '  clientes: '||count(*) from public.clients"
psql "$URL" -tAc "select '  tarefas:  '||count(*) from public.tasks"
psql "$URL" -tAc "select '  logins:   '||count(*) from auth.users"
echo
echo "Pronto. A produção não foi tocada."
