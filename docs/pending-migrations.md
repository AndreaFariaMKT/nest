# Migrations — estado

**048, 049, 050 e 051 estão aplicadas** (07/09/2026). Os tipos foram
regenerados e os contornos temporários saíram: `finance-db.ts` e
`projects-db.ts` agora só reexportam os tipos gerados, e os casts pontuais
das telas foram removidos.

**A 052 não aplicou.** Nem a tabela `project_flow_steps`, nem a coluna
`projects.flow_applied_at` aparecem no schema regenerado — provavelmente o
arquivo não chegou a rodar. O flow automático de projeto está construído e
testado, mas não funciona até ela subir.

O que ainda depende dela:

| onde | o quê |
|---|---|
| `src/lib/projects-db.ts` | `pending()` e `ProjectRowWithFlow` |
| `projects/actions.ts` | `applyProjectFlowAction`, e um `as never` no update |
| `projects/[id]/page.tsx` | a prévia do flow |

Depois de aplicar a 052: `npm run types:gen`, apagar `pending()` e
`ProjectRowWithFlow` de `projects-db.ts`, e trocar as duas leituras de
`pending(supabase).from("project_flow_steps")` pelo cliente normal.

O app compila, os testes passam e o build gera 123 rotas — mas tudo que toca
essas tabelas passa por três arquivos de contorno temporários. Enquanto as
migrations não subirem, as telas novas leem tabelas que não existem.

## Por que não `supabase db push`

`supabase migration list --linked` reporta **001–013 aplicadas e 014–052
ausentes**, e o banco tem os objetos das ausentes: `company_documents`,
`messages`, os tenant floors, tudo. É o **histórico** que está incompleto, não
o schema.

Rodar `db push` nesse estado faria o CLI tentar reaplicar 39 migrations sobre
tabelas que já existem. A maioria falharia no `create table`, mas várias
carregam `drop policy` e `revoke` que **rodam antes** de qualquer erro
aparecer — ou seja, o push pode derrubar políticas de RLS em produção e só
então abortar.

Foi por isso que a 047 acabou indo à mão.

## Dois caminhos

### A. Reparar o histórico primeiro (recomendado)

`migration repair` só escreve na tabela de histórico; não toca no schema.

```bash
supabase migration repair --status applied 014 015 016 017 018 019 020 021 022 \
  023 024 025 026 027 028 029 030 031 032 033 034 035 036 037 038 039 040 041 \
  042 043 044 045 046 047
supabase migration list --linked   # confirmar 001–047 aplicadas, 048–052 pendentes
supabase db push                    # agora sobe só as cinco novas
npm run types:gen
```

### B. Aplicar à mão, como foi com a 047

Rodar o conteúdo de cada arquivo no SQL Editor, **na ordem** — 048 antes de
049 (finanças referenciam `projects`), 049 antes de 050 e 051 (`project_costs`
e a conciliação referenciam `fin_suppliers` e `fin_entries`).

Depois: `npm run types:gen`.

## Depois de aplicar: apagar os contornos

Três arquivos existem só enquanto os tipos não conhecem as tabelas novas, e
saem inteiros:

| arquivo | o que contorna |
|---|---|
| `src/lib/projects-db.ts` | `projects`, `project_members`, `project_flow_steps` |
| `src/lib/finance-db.ts` | as sete `fin_*` mais as duas de importação |
| `projectColumns()` em `tasks/actions.ts` | `project_id` e `follow_up_id` |

Mais os casts pontuais marcados com comentário em:
`projects/page.tsx`, `projects/[id]/page.tsx`, `tasks/page.tsx`,
`finance/invoicing/page.tsx`.

`grep -rn "projects-db\|finance-db\|projectColumns" src` acha todos.

## Ordem de dependência

```
048 projects ──┬── 050 project_finance   (project_costs → fin_suppliers)
               ├── 052 project_flows
               └── 049 finance ── 051 bank_import  (→ fin_entries)
```

049 depende de 048 (`fin_entries.project_id`), e 050 depende das duas.
