#!/usr/bin/env bash
# Aplica uma migration no banco de São Paulo e registra no histórico.
#
#   ./scripts/aplicar-migration.sh supabase/migrations/058_....sql
#
# Por que existe, em duas linhas:
#
# 1. Pedir a string de conexão inteira foi um erro a primeira vez e foi de
#    novo: ela tem quatro partes que precisam estar certas ao mesmo tempo, e
#    colada dentro de aspas num comando de exemplo ela vira o nome de um banco
#    local que não existe. Aqui só falta a senha; o resto o script monta.
#
# 2. `supabase migration repair` escreve no histórico e NUNCA roda o SQL. As
#    duas metades são fáceis de separar por engano — e o resultado é um
#    registro dizendo "aplicada" sobre um banco que não mudou, que foi
#    exatamente o que aconteceu com a 058. Aqui as duas andam juntas, nesta
#    ordem, e o repair só acontece se o SQL passar.
set -euo pipefail

SP="eorvzmvjmxmfejujbgiu"
FILE="${1:-}"

[ -n "$FILE" ] || { echo "Uso: $0 supabase/migrations/0NN_nome.sql"; exit 1; }
[ -f "$FILE" ] || { echo "Não achei $FILE"; exit 1; }

VERSION=$(basename "$FILE" | cut -d_ -f1)
case "$VERSION" in
  [0-9][0-9][0-9]) ;;
  *) echo "Nome fora do padrão 0NN_...: $FILE"; exit 1;;
esac

echo "Migration $VERSION — $(basename "$FILE")"
echo
echo "Senha do banco do projeto de SÃO PAULO ($SP)."
echo "  Painel → Settings → Database. Se não souber, use 'Reset database password'."
echo
read -r -s -p "  senha: " PW
echo

[ -n "$PW" ] || { echo "Senha vazia."; exit 1; }

# @ : / e # na senha viram separadores da URL se não forem escapados, e a
# string quebra de um jeito que parece "senha errada".
PW_ENC=$(python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$PW")

URL=""
for HOST in aws-0-sa-east-1.pooler.supabase.com aws-1-sa-east-1.pooler.supabase.com; do
  TRY="postgresql://postgres.$SP:$PW_ENC@$HOST:5432/postgres"
  printf "  testando %s ... " "${HOST%%.*}"
  if psql "$TRY" -c 'select 1' >/dev/null 2>&1; then
    echo "conectou"; URL="$TRY"; break
  fi
  echo "não"
done

if [ -z "$URL" ]; then
  echo
  echo "Não conectei em nenhum dos dois hosts do pooler de São Paulo."
  echo "O mais provável é a senha. Redefina em Settings → Database e rode de novo."
  exit 1
fi

echo
echo "Aplicando. ON_ERROR_STOP: qualquer erro interrompe aqui."
echo

# Sem --single-transaction: várias migrations deste projeto contêm comandos que
# não podem rodar dentro de um bloco (ALTER TYPE, CREATE INDEX CONCURRENTLY).
# ON_ERROR_STOP é o que garante que uma falha não passe despercebida — foi a
# ausência dele que deixou o `revoke` da 057 falhar em silêncio.
psql "$URL" -v ON_ERROR_STOP=1 -f "$FILE"

echo
echo "Registrando no histórico..."
npx --no-install supabase migration repair --status applied "$VERSION"

echo
echo "Pronto. Confira:"
echo "  npx supabase migration list --linked"
