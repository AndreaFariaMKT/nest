#!/usr/bin/env bash
# Copia os arquivos do storage entre os dois projetos.
#
# A versão anterior pedia quatro valores — duas URLs e duas chaves — e não
# dizia de onde vinham. Os refs já estão aqui, e a URL de um projeto é só
# https://<ref>.supabase.co, então sobram as duas chaves.
set -euo pipefail

cd "$(dirname "$0")/.."

PROD="wntrsavneabdcrztwudf"
SP="eorvzmvjmxmfejujbgiu"

echo "Copiar os arquivos do storage: produção → São Paulo."
echo
echo "Precisa da chave service_role dos DOIS projetos."
echo "Onde: painel do projeto → Settings → API Keys → service_role (Reveal)."
echo
echo "ATENÇÃO: é a service_role, não a anon. A anon não enxerga os arquivos."
echo

echo "Projeto de PRODUÇÃO ($PROD):"
echo "  https://supabase.com/dashboard/project/$PROD/settings/api-keys"
read -r -s -p "  service_role: " K_PROD; echo

echo
echo "Projeto de SÃO PAULO ($SP):"
echo "  https://supabase.com/dashboard/project/$SP/settings/api-keys"
read -r -s -p "  service_role: " K_SP; echo

[ -n "$K_PROD" ] && [ -n "$K_SP" ] || { echo "Chave vazia."; exit 1; }

export OLD_URL="https://$PROD.supabase.co"
export NEW_URL="https://$SP.supabase.co"
export OLD_SERVICE_KEY="$K_PROD"
export NEW_SERVICE_KEY="$K_SP"

echo
echo "─── Simulação: nada é gravado ───"
echo
node scripts/copy-storage.mjs --dry-run

echo
read -r -p "A contagem de arquivos faz sentido? [s/N] " OK
case "$OK" in
  s|S|y|Y) ;;
  *) echo "Parado. Nada foi copiado."; exit 0 ;;
esac

echo
echo "─── Copiando ───"
echo
node scripts/copy-storage.mjs

echo
echo "Se caiu no meio, rode este script de novo — ele pula o que já copiou."
