# Migrations — estado

**047 a 055 aplicadas**, tipos regenerados, `npm run types:check` sem drift.
**Nenhum contorno temporário no código.**

| # | o que trouxe |
|---|---|
| 047 | `profiles.job_title`, `profiles.department` |
| 048 | `projects`, `project_members`, dados fiscais no cliente, `tasks.project_id` e `follow_up_id` |
| 049 | contas, categorias, fornecedores, lançamentos, a receber, a pagar, câmbio |
| 050 | comercial do projeto e `project_costs` |
| 051 | conciliação bancária |
| 052 | `project_flow_steps` e `flow_applied_at` |
| 053 | escopo de tenant no papel `accountant`; leitura e escrita de `projects` separadas |
| 054 | `amount_brl_cents`, sinais positivos em obrigações, saldo por conta em SQL |
| 055 | progresso do projeto em SQL e seis índices |

## `db push` continua inseguro aqui

`supabase migration list --linked` reporta **001–013 aplicadas e 014 em diante
ausentes**, enquanto o banco tem os objetos de todas. É o **histórico** que
está incompleto, não o schema — por isso da 047 em diante tudo foi aplicado à
mão.

Um `db push` nesse estado tentaria reaplicar dezenas de migrations sobre
tabelas existentes. A maioria falharia no `create table`, mas várias carregam
`drop policy` e `revoke`, **que rodam antes de qualquer erro aparecer**. O modo
de falha não é "o push aborta" — é "políticas de RLS caem em produção e aí o
push aborta".

### Reparar (só escreve na tabela de histórico)

```bash
supabase migration repair --status applied $(seq -f "%03g" 14 55)
supabase migration list --linked   # deve mostrar tudo aplicado
```

Depois disso o `db push` volta a ser o caminho normal da 056 em diante.

## Uma armadilha do `types:gen`, já corrigida

O script era `supabase gen types ... > src/types/database.gen.ts`, e o `>`
trunca **antes** do comando rodar. Quando o CLI falhava, sobrava uma linha de
erro JSON no lugar de 2500 linhas de schema, sem aviso. Agora escreve em
temporário e só move em caso de sucesso.
