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
psql "$URL" -q -c 'DROP EXTENSION IF EXISTS vector CASCADE;' \
              -c 'DROP EXTENSION IF EXISTS pg_trgm CASCADE;' 2>/dev/null || true

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
