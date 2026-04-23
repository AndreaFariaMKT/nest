-- ═══════════════════════════════════════════════════════════════════════════
-- Nest · pgvector + draft embeddings
--
--   Enables vector similarity search for content_drafts so the generation
--   prompt can pull the most thematically similar prior drafts for a given
--   transcript instead of the naive "last 10 titles" fallback.
--
--   Uses voyage-3.5 (1024 dims). When VOYAGE_API_KEY is missing in env, the
--   app stores nothing; the match_drafts() RPC simply returns an empty set
--   and the generate path falls back to chronological recency.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists vector;

alter table content_drafts
  add column if not exists embedding vector(1024);

-- HNSW works on empty tables (ivfflat requires prior data to build).
create index if not exists content_drafts_embedding_idx
  on content_drafts
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

-- match_drafts(query, client, count) — used by the content engine to find
-- thematically similar drafts. Cosine similarity (1 - <=>). RLS still applies
-- through content_drafts — callers see only drafts they already can read.
create or replace function public.match_drafts(
  query_embedding vector(1024),
  match_client uuid,
  match_count int default 10
)
returns table (
  id uuid,
  title text,
  pillar text,
  similarity float
)
language sql
stable
security invoker
set search_path = public as $$
  select
    d.id,
    d.title,
    d.pillar,
    1 - (d.embedding <=> query_embedding) as similarity
  from content_drafts d
  where d.client_id = match_client
    and d.embedding is not null
  order by d.embedding <=> query_embedding asc
  limit match_count;
$$;
