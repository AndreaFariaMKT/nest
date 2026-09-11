#!/usr/bin/env bash
# Cronometra a mesma consulta nos dois bancos, lado a lado.
#
# O número que começou tudo foi 459ms para um `select 1` — uma consulta que não
# lê nada. Uma tela do app faz cinco a dez delas em série, e é daí que saem os
# três segundos por clique.
#
# Isto mede da SUA máquina, não do Vercel. A diferença absoluta vai ser outra
# lá, mas a proporção entre os dois bancos é a mesma — e é a proporção que
# decide se a migração vale.
set -euo pipefail

PROD="wntrsavneabdcrztwudf"
SP="eorvzmvjmxmfejujbgiu"
N=10

medir() {
  local url="$1" nome="$2" total=0 pior=0 melhor=999999

  for _ in $(seq $N); do
    local t0 t1 ms
    t0=$(python3 -c 'import time; print(int(time.time()*1000))')
    psql "$url" -tAc 'select 1' >/dev/null 2>&1 || { echo "  $nome: falhou ao conectar"; return 1; }
    t1=$(python3 -c 'import time; print(int(time.time()*1000))')
    ms=$((t1 - t0))
    total=$((total + ms))
    [ "$ms" -gt "$pior" ] && pior=$ms
    [ "$ms" -lt "$melhor" ] && melhor=$ms
  done

  MEDIA=$((total / N))
  printf "  %-24s media %4dms   melhor %4dms   pior %4dms\n" "$nome" "$MEDIA" "$melhor" "$pior"
}

echo "Senha do banco de PRODUÇÃO (Virgínia)."
read -r -s -p "  senha: " PW_PROD; echo
echo "Senha do banco de SÃO PAULO."
read -r -s -p "  senha: " PW_SP; echo
echo

enc() { python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"; }

# Cada projeto vive num host regional do pooler. Descobrimos qual responde em
# vez de adivinhar.
achar_url() {
  local ref="$1" pw="$2"
  for h in aws-0-us-east-1 aws-1-us-east-1 aws-0-sa-east-1 aws-1-sa-east-1; do
    local u="postgresql://postgres.$ref:$pw@$h.pooler.supabase.com:5432/postgres"
    if psql "$u" -c 'select 1' >/dev/null 2>&1; then echo "$u"; return 0; fi
  done
  return 1
}

U_PROD=$(achar_url "$PROD" "$(enc "$PW_PROD")") || { echo "Não conectei na produção."; exit 1; }
U_SP=$(achar_url "$SP" "$(enc "$PW_SP")")       || { echo "Não conectei em São Paulo."; exit 1; }

echo "$N consultas 'select 1' em cada banco."
echo
medir "$U_PROD" "Produção · Virgínia"
P=$MEDIA
medir "$U_SP" "São Paulo"
S=$MEDIA

echo
if [ "$S" -lt "$P" ] && [ "$S" -gt 0 ]; then
  # Uma casa decimal: divisão inteira transformaria 2,8x em "2x" e esconderia
  # boa parte do ganho.
  RATIO=$(python3 -c "print(f'{$P/$S:.1f}')")
  echo "  São Paulo é ${RATIO}x mais rápido — $((P - S))ms a menos por consulta."
  echo "  Uma tela faz 5 a 10 dessas em série:"
  echo "    economia estimada por clique: $(( (P - S) * 5 ))ms a $(( (P - S) * 10 ))ms"
elif [ "$S" -ge "$P" ]; then
  echo "  São Paulo NÃO ficou mais rápido ($S""ms contra $P""ms)."
  echo "  Vale investigar antes de virar — a migração não resolveria o problema."
else
  echo "  Medição inconclusiva."
fi
