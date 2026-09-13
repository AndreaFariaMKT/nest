# Migrations — estado

> **11/09/2026 — o banco de São Paulo está vazio e a produção está apontando
> para ele.** Leia a seção "Incidente" antes de qualquer coisa. O reparo de
> histórico descrito no fim deste arquivo só faz sentido depois que o schema
> estiver de volta.

## Incidente — a virada para São Paulo não terminou

Medido pela CLI já autenticada e pela própria produção:

| verificação | resultado |
|---|---|
| `supabase inspect db table-stats --linked` | nenhuma tabela |
| `supabase migration list --linked` | remoto sem nenhuma das 55 |
| `GET /rest/v1/clients` com a chave anon | `PGRST205` — não existe |
| `GET /api/health` em produção | `status: degraded`, `db.ok: false` |

O bundle em produção aponta para `eorvzmvjmxmfejujbgiu` (São Paulo). O app
sobe, o login redireciona, e **nenhuma leitura de dados funciona**.

**Nada foi perdido.** O projeto antigo `wntrsavneabdcrztwudf` (us-east-1)
continua intacto — `clients` 4, `tasks` 2, `fin_categories` 10 — e os arquivos
do dump continuam em `.migracao-supabase/` (46 tabelas). Foi para isso que
combinamos não apagar o projeto antigo por uma semana.

### Voltar ao ar, na ordem

1. **Trocar a senha do banco.** Ela foi exposta; e o passo 3 precisa da nova.
   Dashboard → Settings → Database → Reset database password.
2. **Opcional, se o estúdio precisa trabalhar agora:** apontar as variáveis da
   Vercel de volta para us-east-1 e redeployar. Volta a funcionar em minutos,
   ao custo de ~460 ms por clique em vez de ~25 ms.
3. `./scripts/restaurar-em-sp.sh` — um passo, pede só a senha nova.
4. **Conferir antes de confiar:**
   `curl -s https://nest-six-beta.vercel.app/api/health` tem que devolver
   `status: ok` **e** `db.ok: true`.

O passo 4 é o que faltou da última vez. As rotas respondiam 307, o que foi lido
como "está no ar" — mas 307 é o middleware conversando com o serviço de auth,
que é independente do Postgres. **Rota que responde não é banco que responde.**

## A CLI estava ligada no projeto errado

`supabase/.temp/project-ref` apontava para `wntrsavneabdcrztwudf` mesmo depois
da virada. Qualquer `--linked` — inclusive o `migration repair` descrito
abaixo — agiria sobre **us-east-1**, e o histórico de São Paulo continuaria
quebrado com a aparência de consertado.

Já religado para `eorvzmvjmxmfejujbgiu`. Antes de rodar qualquer comando com
`--linked`, confira:

```bash
cat supabase/.temp/project-ref   # tem que ser eorvzmvjmxmfejujbgiu
```

## O que cada migration trouxe

Aplicadas à mão em us-east-1 entre agosto e setembro de 2026. Em São Paulo,
voltam junto com o restore — o dump é do schema inteiro, não das migrations.

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

## `db push` continua inseguro — e o reparo é 001–055, não 014–055

Este arquivo dizia que o remoto reportava "001–013 aplicadas e 014 em diante
ausentes". Isso era verdade **em us-east-1**. Em São Paulo o histórico está
completamente vazio, e `supabase_migrations` **não está no dump** — então
depois do restore ele continuará vazio.

Um `db push` nesse estado tentaria aplicar as 55 sobre um schema que já veio
inteiro pelo dump. A maioria falharia no `create table`, mas várias carregam
`drop policy` e `revoke`, **que rodam antes de qualquer erro aparecer**. O modo
de falha não é "o push aborta" — é "políticas de RLS caem em produção e aí o
push aborta".

### Reparar (só escreve na tabela de histórico)

Depois do restore e do health check verde:

```bash
cat supabase/.temp/project-ref                 # eorvzmvjmxmfejujbgiu
supabase migration repair --status applied $(seq -f "%03g" 1 55)
supabase migration list --linked               # tudo aplicado, nos dois lados
```

**Feito em 11/09/2026 — as 55 aparecem dos dois lados.**

## Como aplicar uma migration

```bash
./scripts/aplicar-migration.sh supabase/migrations/0NN_nome.sql
```

Pede só a senha do banco de São Paulo, monta a string do pooler sozinho, roda
com `ON_ERROR_STOP=1` e **só então** registra no histórico.

As duas metades andarem juntas é o ponto. `supabase migration repair` escreve no
histórico e nunca roda o SQL — separá-las por engano produz um registro dizendo
"aplicada" sobre um banco que não mudou, que foi o que aconteceu com a 058.

### O caminho manual, e por que ele erra



O reparo consertou o **histórico**; não conserta a **conexão**. `supabase db push`
sozinho tenta o host direto `db.<ref>.supabase.co`, que é IPv6-only — e daqui ele
expira:

```
failed to connect to postgres: ... failed SASL auth (read tcp [2001:...]:58311
  -> [2600:...]:5432: i/o timeout)
```

É a mesma parede da virada. O que funciona é o **Session pooler**, que é IPv4.
Pegue a string em Connect → Session pooler no painel do projeto, e use uma das
duas formas:

```bash
# a que este projeto usou o tempo todo
psql "<session pooler URL>" -f supabase/migrations/056_finance_founder_is_tenanted.sql

# ou o push, apontado para o pooler em vez do host direto
supabase db push --db-url "<session pooler URL>"
```

`supabase migration list --linked` funciona sem isso porque a CLI cria um papel
temporário pela API de gestão — então "o list funciona" não quer dizer que o
push vai funcionar. Foi o que me fez escrever a instrução errada aqui.

### Pendente agora

**058** — o `revoke` da 057 não revogava nada.

A 057 dizia `revoke execute ... from public`, o teste conferia que o texto
estava no arquivo, e o privilégio continuou de pé: o Supabase concede EXECUTE
em funções novas do `public` a `anon`, `authenticated` e `service_role`
**nominalmente**, e revogar do pseudo-papel PUBLIC não toca nessas concessões.

Medido contra produção depois de aplicar a 057: a chave anônima chamou a função
e recebeu `{"allowed":true,"remaining":4}`. Isso permitia inserir linhas com
nomes de bucket arbitrários sem limite e sem login — o caminho mais curto para
encher o disco — e estourar o contador de um cliente específico usando o bucket
do link de aprovação dele.

```bash
psql "<session pooler URL>" -f supabase/migrations/058_rate_limit_revoke_named_roles.sql
./scripts/verificar-rate-limit.sh    # pergunta ao banco, não ao arquivo
```

Um teste que lê SQL não sabe o que o SQL faz. O script pergunta.

### Já resolvido

Duas, e na mesma leva:

```bash
psql "<session pooler URL>" \
  -f supabase/migrations/056_finance_founder_is_tenanted.sql \
  -f supabase/migrations/057_rate_limits.sql
npm run types:gen        # 057 acrescenta uma função que o código chama
```

**056** — o grant de founder nas tabelas do financeiro não é escopado por
tenant. Mesmo defeito que a 053 corrigiu para a contadora, na cláusula ao lado.
Ninguém perde acesso: um founder continua founder no próprio tenant.

**057** — o rate limit sai da memória do processo para o Postgres. Em
serverless cada instância tinha o seu contador, então o limite efetivo era o
configurado vezes o número de instâncias vivas — e esse número sobe com o
tráfego, ou seja, justamente quando o limite deveria apertar.

Antes do `types:gen`, `checkRateLimitShared` chama a função nova através de um
tipo escrito à mão, contido em um lugar só e preso ao SQL por
`tests/unit/rate-limit-contract.test.ts`. Depois de regenerar os tipos, o
comentário em `src/lib/rate-limit.ts` diz o que apagar.

## A armadilha do `types:gen` — a segunda metade ainda mordia

O script era `supabase gen types ... > src/types/database.gen.ts`, e o `>`
trunca **antes** do comando rodar: um CLI que falhava deixava uma linha de erro
JSON no lugar de 2500 linhas de schema. Isso foi corrigido escrevendo em
temporário e movendo só em caso de sucesso.

Só que a guarda cobria o comando **falhar**, não o comando **ter sucesso
devolvendo um schema vazio** — que é exatamente o que São Paulo devolve hoje.
Rodar `npm run types:gen` agora troca as 3381 linhas de `database.gen.ts` por
155 linhas de `[_ in never]: never`, com código de saída 0 e a mensagem
"Generated src/types/database.gen.ts".

Foi isso que aconteceu com o arquivo em 11/09 — não foi corrupção, foi uma
geração bem-sucedida contra um banco vazio. Todo `supabase.from(...)` da
aplicação passou a ter tipo `never`.

O script agora recusa um schema sem tabelas antes de mover. E enquanto o banco
estiver vazio, `npm run types:check` vai acusar drift: isso é o cheque fazendo
o trabalho dele, não um alarme falso.
