#!/usr/bin/env bash
# Regenera src/types/database.gen.ts a partir do banco ligado ao projeto.
#
# Duas guardas, e a segunda existe por experiência própria.
#
# A primeira é o arquivo temporário: `supabase gen types > arquivo` trunca o
# destino ANTES do comando rodar, então um CLI que falha deixa uma linha de
# erro no lugar do schema inteiro.
#
# A segunda é a contagem de tabelas. A primeira guarda cobre o comando FALHAR;
# não cobre o comando ter SUCESSO devolvendo um schema vazio. Em 11/09/2026 o
# projeto de São Paulo respondeu 200 com zero tabelas, `mv` fez o seu trabalho,
# e as 3381 linhas viraram 155 de `[_ in never]: never` — com código de saída 0
# e a mensagem "Generated". Todo `supabase.from(...)` da aplicação passou a ter
# tipo `never` e nada avisou.
set -euo pipefail

REF="${SUPABASE_PROJECT_ID:-eorvzmvjmxmfejujbgiu}"
OUT="src/types/database.gen.ts"
TMP="$OUT.tmp"

# Um schema vazio tem 0; o do Nest tem 48. Dez é folga suficiente para
# nunca reclamar de um banco real e recusar qualquer coisa perto de vazio.
MIN_TABELAS=10

trap 'rm -f "$TMP"' EXIT

if ! supabase gen types typescript --project-id "$REF" > "$TMP"; then
  echo "Geração falhou — $OUT intacto (falta \`supabase login\`?)." >&2
  exit 1
fi

tabelas=$(grep -c 'Row: {' "$TMP" || true)

if [ "$tabelas" -lt "$MIN_TABELAS" ]; then
  echo "O banco respondeu com $tabelas tabelas — $OUT intacto." >&2
  echo "Um schema vazio quase sempre quer dizer que o projeto ($REF) está" >&2
  echo "sem as migrations, não que o schema encolheu. Ver docs/pending-migrations.md." >&2
  exit 1
fi

mv "$TMP" "$OUT"
echo "Gerado $OUT · $tabelas tabelas."
