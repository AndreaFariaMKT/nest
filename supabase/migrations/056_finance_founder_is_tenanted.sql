-- ============================================================================
-- 056 — o grant de founder no financeiro era do mesmo tipo que a 053 corrigiu.
--
-- 053 fechou este buraco para a contadora e parou ali. As políticas de 049
-- ficaram assim:
--
--     using (
--       public.is_owner()                       -- ← sem tenant
--       or exists (select 1 from tenant_members m
--                   where m.user_id = auth.uid()
--                     and m.tenant_id = fin_x.tenant_id   -- ← com tenant
--                     and m.role = 'accountant')
--     )
--
-- `is_owner()` (038) é, por definição, "founder de ALGUM tenant" — e não pode
-- receber um tenant, porque não recebe argumento. O comentário dela diz que os
-- pisos restritivos já limitam a linha a um tenant, e limitam: `is_tenant_member
-- (tenant_id)`. Só que esse piso pede **participação**, em qualquer papel.
--
-- Os dois juntos dizem: "membro deste tenant E founder de algum". Então quem é
-- founder da AFM e entra num segundo estúdio como designer passa a ler e
-- escrever o livro-caixa daquele estúdio, o CPF e a chave PIX de cada
-- fornecedor e o que cada cliente paga.
--
-- Hoje são dois tenants e dois logins, ambos founder — o risco é pequeno e a
-- correção é barata. É a segunda coisa que se quer de um convite de equipe, e
-- o convite de equipe é a próxima coisa a existir.
--
-- Só a cláusula permissiva muda. Ninguém que hoje enxerga algo deixa de
-- enxergar: um founder continua founder no seu próprio tenant.
-- ============================================================================

-- A metade legada de is_owner(), sozinha, para que a política acima possa usar
-- uma sem a outra. is_owner() em si não muda: dezenas de políticas dependem
-- dela e estreitá-la aqui revogaria acesso em silêncio, que é exatamente o que
-- o comentário da 038 avisa para não fazer.
create or replace function public.is_owner_legacy()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and role = 'owner'
  );
$$;

comment on function public.is_owner_legacy is
  'Só a metade profiles.role=''owner'' de is_owner(). Existe para as políticas '
  'do financeiro, que precisam escopar o founder por tenant sem perder a '
  'escada de volta do papel legado.';

do $$
declare t text;
begin
  foreach t in array array[
    'fin_accounts', 'fin_categories', 'fin_suppliers',
    'fin_entries', 'fin_receivables', 'fin_payables', 'fin_fx_rates'
  ]
  loop
    execute format('drop policy if exists finance_staff_all on public.%I', t);
    execute format($f$
      create policy finance_staff_all on public.%I
        for all to authenticated
        using (
          exists (
            select 1 from public.tenant_members m
             where m.user_id = auth.uid()
               and m.tenant_id = %I.tenant_id
               and m.role in ('founder', 'accountant')
          )
          -- O papel legado da 038. Continua sem tenant porque `profiles.role`
          -- não tem um, e é o único caminho de volta se alguém ficar de fora
          -- de tenant_members. O piso restritivo da 014 ainda se aplica.
          or public.is_owner_legacy()
        )
        with check (
          exists (
            select 1 from public.tenant_members m
             where m.user_id = auth.uid()
               and m.tenant_id = %I.tenant_id
               and m.role in ('founder', 'accountant')
          )
          or public.is_owner_legacy()
        )
    $f$, t, t, t);
  end loop;
end $$;
