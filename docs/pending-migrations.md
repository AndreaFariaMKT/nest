# Migrations 047–052 — aplicadas

**Todas aplicadas** (setembro de 2026), tipos regenerados, `npm run types:check`
sem drift. Nenhum contorno temporário sobrou no código.

| # | o que trouxe |
|---|---|
| 047 | `profiles.job_title`, `profiles.department` |
| 048 | `projects`, `project_members`, dados fiscais no cliente, `tasks.project_id` e `tasks.follow_up_id` |
| 049 | contas, categorias, fornecedores, lançamentos, a receber, a pagar, câmbio |
| 050 | comercial do projeto e `project_costs` |
| 051 | `fin_imports` e `fin_import_lines` (conciliação) |
| 052 | `project_flow_steps` e `projects.flow_applied_at` |

## O que continua valendo: `db push` não é seguro aqui

Este documento nasceu porque `supabase migration list --linked` reportava
**001–013 aplicadas e 014 em diante ausentes**, enquanto o banco tinha os
objetos de todas elas. É o **histórico** que está incompleto, não o schema —
e por isso a 047 em diante foram aplicadas à mão.

Enquanto o histórico não for reparado, um `supabase db push` tentaria reaplicar
dezenas de migrations sobre tabelas existentes. A maioria falharia no
`create table`, mas várias carregam `drop policy` e `revoke`, **que rodam antes
de qualquer erro aparecer**. O modo de falha não é "o push aborta" — é
"políticas de RLS caem em produção e aí o push aborta".

### Reparar (só escreve na tabela de histórico)

```bash
supabase migration repair --status applied 014 015 016 017 018 019 020 021 022 \
  023 024 025 026 027 028 029 030 031 032 033 034 035 036 037 038 039 040 041 \
  042 043 044 045 046 047 048 049 050 051 052
supabase migration list --linked   # deve mostrar tudo aplicado
```

Depois disso o `db push` volta a ser o caminho normal para a 053 em diante.

## Uma armadilha do `types:gen`, já corrigida

O script era `supabase gen types ... > src/types/database.gen.ts`, e o `>`
trunca **antes** do comando rodar. Quando o CLI falhava, sobrava uma linha de
erro JSON no lugar de 2500 linhas de schema, sem aviso. Agora escreve em
temporário e só move em caso de sucesso.
