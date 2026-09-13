#!/usr/bin/env bash
# O anônimo consegue chamar rate_limit_hit? Pergunta ao banco de verdade.
#
# Existe porque a resposta mudou sem ninguém perceber: a 057 dizia
# `revoke execute ... from public`, o teste conferia que o texto estava lá, e o
# privilégio continuou de pé — as concessões do Supabase são nominais para
# anon/authenticated, e revogar de PUBLIC não as toca.
#
# Um teste que lê SQL não sabe o que o SQL faz. Isto pergunta.
set -euo pipefail

REF="${SUPABASE_PROJECT_ID:-eorvzmvjmxmfejujbgiu}"

ANON=$(npx --no-install supabase projects api-keys --project-ref "$REF" -o json 2>/dev/null \
  | python3 -c 'import sys,json; print(next(k["api_key"] for k in json.load(sys.stdin) if k["name"]=="anon"))')

[ -n "$ANON" ] || { echo "Não consegui a chave anônima. \`supabase login\` feito?"; exit 1; }

echo "Chamando rate_limit_hit com a chave anônima em $REF..."

CODE=$(curl -s -o /tmp/rl-check.json -w '%{http_code}' -X POST \
  "https://$REF.supabase.co/rest/v1/rpc/rate_limit_hit" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  -H 'Content-Type: application/json' \
  -d '{"p_bucket":"verificacao-anon","p_window_ms":60000,"p_limit":5}')

if [ "$CODE" = "200" ]; then
  echo
  echo "FALHOU: o anônimo executou a função (HTTP $CODE)."
  cat /tmp/rl-check.json; echo
  echo
  echo "A 058 não foi aplicada, ou não pegou. Rode:"
  echo "  psql \"<session pooler URL>\" -f supabase/migrations/058_rate_limit_revoke_named_roles.sql"
  exit 1
fi

echo "OK: negado com HTTP $CODE — que é o esperado."
cat /tmp/rl-check.json; echo
