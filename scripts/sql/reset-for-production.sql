-- ═══════════════════════════════════════════════════════════════════════════
-- Limpeza dos dados de teste, antes do primeiro uso real
--
-- Escrito a partir de um levantamento da base em 2026-08-24, que encontrou
-- exatamente cinco linhas de teste e todo o resto zerado:
--
--   clients        "First Client" (first-client)
--   clients        "Demo Client"  (demo-client)  ← tem login de portal ligado
--   contracts      "Monthly retainer"
--   content_drafts "August carousel"
--   meetings       "Kickoff call"
--
-- NÃO apaga: os dois tenants, nenhum login da equipe, nenhuma migration.
--
-- O editor do Supabase já envolve o script numa transação: se qualquer linha
-- falhar, nada é apagado e ele mostra o erro. A conferência no fim mostra o
-- que sobrou.
-- ═══════════════════════════════════════════════════════════════════════════

-- Os dois ids aparecem repetidos em vez de virem de uma tabela temporária.
-- A primeira versão usava `create temporary table ... on commit drop`, e o
-- editor do Supabase não mantém a temporária entre os statements — o script
-- morria no primeiro delete com "relation _doomed does not exist". Repetir o
-- literal é feio e funciona em qualquer cliente SQL.
--
--   4ae438c6-fdef-40ad-b042-037442aa1e6f  First Client
--   991a8220-319b-4450-bf73-740a2a5c6e88  Demo Client

-- ── Apagado em ordem de dependência ───────────────────────────────────────
--
-- As FKs em `clients` são ON DELETE CASCADE, então um `delete from clients`
-- sozinho levaria quase tudo junto. Isto está escrito explícito mesmo assim,
-- por dois motivos: um cascade silencioso não mostra o que levou, e a ordem
-- aqui é a documentação de quem depende de quem.

delete from public.post_metrics m
 using public.published_posts pp, public.content_drafts d
 where m.published_post_id = pp.id
   and pp.draft_id = d.id
   and d.client_id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );

delete from public.published_posts pp
 using public.content_drafts d
 where pp.draft_id = d.id
   and d.client_id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );

delete from public.scheduled_posts sp
 using public.content_drafts d
 where sp.draft_id = d.id
   and d.client_id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );

delete from public.creatives cr
 using public.slides s, public.content_drafts d
 where cr.slide_id = s.id
   and s.draft_id = d.id
   and d.client_id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );

delete from public.slides s
 using public.content_drafts d
 where s.draft_id = d.id
   and d.client_id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );

delete from public.approvals a
 using public.content_drafts d
 where a.draft_id = d.id
   and d.client_id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );

-- ai_edits pendura em draft_id, não em client_id — o registro é de uma
-- geração, e uma geração pertence a uma peça.
delete from public.ai_edits e
 using public.content_drafts d
 where e.draft_id = d.id
   and d.client_id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );

delete from public.content_drafts     where client_id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );

-- Transcrições penduram em reuniões, não em clientes.
delete from public.transcripts t
 using public.meetings mt
 where t.meeting_id = mt.id
   and mt.client_id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );

delete from public.meetings           where client_id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );
delete from public.messages           where client_id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );
delete from public.notes              where client_id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );
delete from public.tasks              where client_id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );
delete from public.cycles             where client_id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );
delete from public.monthly_reports    where client_id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );
delete from public.media_assets       where client_id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );
delete from public.shared_logins      where client_id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );
delete from public.client_social_accounts where client_id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );
delete from public.contracts          where client_id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );
delete from public.client_services    where client_id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );
delete from public.client_members     where client_id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );
delete from public.client_contacts    where client_id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );

delete from public.brand_assets ba
 using public.brand_kits bk
 where ba.brand_kit_id = bk.id
   and bk.client_id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );
delete from public.brand_kits         where client_id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );

-- `primary_contact_id` aponta para client_contacts, já apagado acima; soltar
-- a referência evita a FK reclamar na linha seguinte.
update public.clients set primary_contact_id = null
 where id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );

delete from public.clients            where id in (
     '4ae438c6-fdef-40ad-b042-037442aa1e6f',
     '991a8220-319b-4450-bf73-740a2a5c6e88'
   );

-- ── Conferência ───────────────────────────────────────────────────────────
-- Os quatro primeiros têm que vir zero. tenants = 2 e usuarios = 4 provam que
-- a limpeza não passou do alvo.
select 'clients restantes'        as o_que, count(*) from public.clients
union all select 'content_drafts', count(*) from public.content_drafts
union all select 'contracts',      count(*) from public.contracts
union all select 'meetings',       count(*) from public.meetings
union all select 'tenants (deve ser 2)', count(*) from public.tenants
union all select 'usuarios (nao mexido)', count(*) from auth.users;

