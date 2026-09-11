# A virada para São Paulo — passo a passo

O ensaio já provou que a migração funciona. Isto é a virada de verdade.

**Reserve 1h30 e faça com ninguém usando o sistema.** Avise a equipe e a
Nayara: "o Nest fica fora do ar das 8h às 9h30."

---

## Antes da janela (pode ser na véspera)

### 1. Copiar os arquivos do storage

Os arquivos não vão no dump do banco. São três buckets, e sem eles toda imagem
de marca do app vira 404.

```
./scripts/copiar-storage.sh
```

Ele pede a chave **service_role** dos dois projetos — abre o link de cada um —
e faz a simulação antes, mostrando quantos arquivos copiaria. Você confirma e
ele copia.

A service_role fica em **Settings → API Keys → Reveal**. Não use a `anon`: ela
não enxerga os arquivos.

Pode ser feito antes porque é aditivo: na janela você roda de novo e ele copia
só o que surgiu, pulando o resto.

### 2. Ligar o realtime

Painel de São Paulo → **Database → Publications → supabase_realtime** → marcar
a tabela **messages**.

Sem isso o chat fica mudo e nada dá erro.

---

## A janela

A partir daqui o sistema sai do ar. A ordem importa: **todo dado gravado entre
o passo 3 e o 6 se perde.**

### 3. Avisar e parar de usar

Confirme que ninguém está com o Nest aberto — equipe e clientes no portal.

### 4. Dump fresco da produção

O dump do ensaio está velho. Refaça agora, com o sistema parado:

```
rm -rf .migracao-supabase
./scripts/migrate-supabase-to-sp.sh --ensaio
```

Responda **n** quando ele perguntar se quer reaproveitar. Deixe-o ir até o fim
das etapas de dump — depois disso pode interromper com Ctrl-C.

### 5. Restaurar por cima, limpando antes

O banco de São Paulo tem os dados do ensaio. Sem limpar, dá chave duplicada.

```
LIMPAR=1 ./scripts/restaurar-em-sp.sh
```

Ele pede a senha de São Paulo, confirma a limpeza e restaura. Confira os
números que ele imprime no fim contra a produção.

### 6. Trocar as chaves na Vercel

Painel de São Paulo → **Settings → API Keys**. Copie:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / publishable** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role / secret** → `SUPABASE_SERVICE_ROLE_KEY`

Na Vercel → projeto `nest` → **Settings → Environment Variables** → atualizar
as três em **Production** → **Redeploy**.

São só essas três das 27. As outras 24 não mudam.

### 7. Copiar os arquivos que surgiram

```
./scripts/copiar-storage.sh
```

Mesmo comando do passo 1. Pula o que já foi copiado.

---

## Depois

### 8. Conferir

Abra https://nest-six-beta.vercel.app/api/health e olhe `latencyMs`.

- antes: **459ms**
- esperado: **menos de 30ms**

Depois entre no app e teste: login, abrir um cliente, criar uma tarefa, o chat
(realtime), e uma imagem de marca (storage).

### 9. Trocar o ref no repositório

```
sed -i '' 's/wntrsavneabdcrztwudf/eorvzmvjmxmfejujbgiu/g' package.json ROADMAP.md
npm run types:gen && npm run types:check
```

Sem isso o `types:gen` lê o banco errado e o job de drift do CI discorda da
produção para sempre.

### 10. NÃO apague o projeto antigo

Deixe-o parado por uma semana. É o seu botão de desfazer, e ele custa menos que
uma restauração.

---

## Se algo der errado no meio

O restore é uma transação única: ou entra tudo, ou não entra nada. Se falhar,
São Paulo fica como estava e a produção nunca foi tocada — basta não trocar as
chaves.

Se já tiver trocado as chaves e algo estiver errado, o desfazer é colocar as
chaves antigas de volta na Vercel e redeployar. O banco antigo continua lá,
intacto, com tudo que tinha até o passo 4.
