-- ============================================================================
-- 057 — o rate limit sai da memória do processo.
--
-- `checkRateLimit` guarda os contadores num Map do módulo. Isso funciona num
-- processo só. Em serverless não existe "um processo": cada instância tem o
-- seu Map, e o limite efetivo é o configurado VEZES o número de instâncias
-- vivas — que ninguém controla e que sobe justamente sob carga, ou seja,
-- exatamente quando o limite deveria apertar. Uma instância nova começa com o
-- contador zerado.
--
-- Onde isso importa hoje: `/a/[token]`, o link de aprovação que vai por e-mail
-- para o cliente e é a única superfície pública que aceita escrita sem login,
-- e `/api/client-error`, que qualquer navegador pode chamar.
--
-- Postgres em vez de Redis porque o Postgres já está aqui. Um contador por
-- janela, em uma tabela, com um upsert atômico — não vale uma conta nova num
-- serviço novo, com mais um segredo para rotacionar, para guardar um inteiro
-- que expira em sessenta segundos.
-- ============================================================================

create table if not exists public.rate_limits (
  -- Quem está sendo limitado e em qual janela. A janela entra na chave para
  -- que virar de janela seja um INSERT novo em vez de um UPDATE que precisa
  -- decidir se zera — o caso em que uma corrida perde a contagem.
  bucket       text not null,
  window_start timestamptz not null,

  count        integer not null default 0,

  primary key (bucket, window_start)
);

-- A varredura precisa achar as janelas velhas sem ler a tabela inteira.
create index if not exists rate_limits_window_idx
  on public.rate_limits (window_start);

-- Ninguém além do serviço fala com esta tabela. Sem policy permissiva: RLS
-- ligada e nenhuma política significa que `authenticated` e `anon` não leem
-- nem escrevem nada, e o service role ignora RLS por definição. A tabela
-- guarda padrões de tráfego por IP e por token de aprovação; não é dado que a
-- aplicação tenha motivo para expor.
alter table public.rate_limits enable row level security;

/**
 * Conta uma tentativa e diz se ela passa.
 *
 * Uma instrução só. A contagem, a decisão e a gravação acontecem dentro do
 * mesmo statement, então duas requisições simultâneas não conseguem ler o
 * mesmo valor e gravar o mesmo incremento — que é a corrida que um
 * `select` seguido de `update` perde silenciosamente e sob carga.
 *
 * Janela fixa, não deslizante. A versão em memória era deslizante e guardava
 * um array de timestamps por chave; aqui isso seria uma linha por requisição.
 * A troca é conhecida: numa janela fixa, quem chega no fim de uma janela e no
 * começo da seguinte consegue até 2× o limite num intervalo curto. Para "um
 * cliente clica aprovar uma vez" e "o cron dispara uma vez por mês", 2× de 10
 * continua sendo muito menos que abuso.
 */
create or replace function public.rate_limit_hit(
  p_bucket    text,
  p_window_ms integer,
  p_limit     integer
)
returns table (allowed boolean, remaining integer, reset_ms integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_count integer;
begin
  -- O início da janela que contém agora. date_bin dá a mesma resposta para
  -- todo mundo que chamar dentro dela, que é o que faz a chave ser estável.
  v_start := date_bin(
    make_interval(secs => p_window_ms / 1000.0),
    now(),
    timestamptz 'epoch'
  );

  insert into public.rate_limits (bucket, window_start, count)
  values (p_bucket, v_start, 1)
  on conflict (bucket, window_start)
    do update set count = public.rate_limits.count + 1
  returning count into v_count;

  return query select
    v_count <= p_limit,
    greatest(0, p_limit - v_count),
    greatest(0, extract(
      epoch from (v_start + make_interval(secs => p_window_ms / 1000.0) - now())
    ) * 1000)::integer;
end;
$$;

comment on function public.rate_limit_hit is
  'Conta uma tentativa e decide, em um statement só. Janela fixa: o começo da '
  'janela entra na chave primária, então virar de janela é uma linha nova e '
  'nenhuma corrida perde a contagem.';

/**
 * Apaga as janelas que já não podem responder nada.
 *
 * Sem isto a tabela cresce para sempre: a chave é por IP e por token, então
 * ela cresce com cada chamador distinto e nunca encolhe. Mesmo raciocínio do
 * `sweep()` que a versão em memória já tinha — uma janela cuja validade
 * passou não é estado, é vazamento.
 */
create or replace function public.rate_limit_sweep(p_older_than interval default '1 hour')
returns integer
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from public.rate_limits
     where window_start < now() - p_older_than
    returning 1
  )
  select count(*)::integer from gone;
$$;

-- Só o service role chama. As duas funções são `security definer`, então quem
-- pode executá-las escreve na tabela como dono — e por padrão o Postgres dá
-- EXECUTE a PUBLIC. Deixar assim seria entregar a qualquer visitante anônimo um
-- jeito de inflar o contador de QUALQUER chave: bastaria chamar a função com o
-- bucket de outra pessoa para deixá-la bloqueada. O limitador é infraestrutura,
-- e a aplicação já fala com ele pelo cliente de serviço.
revoke execute on function public.rate_limit_hit(text, integer, integer) from public;
revoke execute on function public.rate_limit_sweep(interval) from public;
grant  execute on function public.rate_limit_hit(text, integer, integer) to service_role;
grant  execute on function public.rate_limit_sweep(interval) to service_role;
