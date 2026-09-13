-- ============================================================================
-- 058 — o revoke da 057 não revogava nada.
--
-- A 057 escreveu:
--
--     revoke execute on function public.rate_limit_hit(...) from public;
--     grant  execute on function public.rate_limit_hit(...) to service_role;
--
-- e o comentário ao lado explicava, corretamente, por que isso importa: as
-- duas funções são `security definer`, então quem pode executá-las escreve na
-- tabela como dono.
--
-- O que estava errado é que `from public` remove a concessão do pseudo-papel
-- PUBLIC e mais nada. O projeto Supabase tem, no schema `public`:
--
--     alter default privileges ... grant all on functions
--       to anon, authenticated, service_role;
--
-- — concessões NOMINAIS, criadas no momento em que a função nasce. Revogar de
-- PUBLIC não toca nelas.
--
-- Medido contra o banco de produção depois de aplicar a 057: uma chamada com a
-- chave anônima devolveu 200 e `{"allowed":true,"remaining":4}`. O anônimo
-- executava.
--
-- O que isso permitia, em ordem de facilidade:
--
--   1. Encher a tabela. Cada chamada com um `p_bucket` novo é uma linha nova,
--      sem limite e sem login. É o caminho mais curto para consumir o disco do
--      projeto.
--   2. Estourar o contador de outra pessoa. Quem tiver o link de aprovação de
--      um cliente — ele vai por e-mail — pode chamar a função com aquele
--      bucket até o limite, e o cliente perde a capacidade de aprovar o
--      próprio post.
--
-- O teste que eu escrevi para guardar isso conferia se o texto do `revoke`
-- estava no arquivo, e estava. Um teste que lê o SQL não sabe o que o SQL faz.
-- ============================================================================

revoke execute on function public.rate_limit_hit(text, integer, integer)
  from anon, authenticated;
revoke execute on function public.rate_limit_sweep(interval)
  from anon, authenticated;

-- E das futuras, para que a próxima função de infraestrutura não repita isto.
-- Só afeta o que for criado daqui em diante pelo mesmo dono.
alter default privileges in schema public
  revoke execute on functions from anon, authenticated;

-- A aplicação fala com estas duas pelo cliente de serviço — `createAdminClient`
-- em src/lib/rate-limit.ts — então nada no produto perde acesso. A 057 já
-- concedeu a service_role; repetido aqui porque este arquivo tem que ser
-- suficiente sozinho se alguém o ler para entender quem pode chamar.
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.rate_limit_sweep(interval) to service_role;
