-- =============================================================================
-- Dealer Applications — Dealer ID generation on approval
-- Run in: Supabase Dashboard → SQL Editor → New query → Run. Safe to re-run.
--
-- SCOPE:
--   - When an admin approves a dealer application, generate a sequential,
--     human-readable Dealer ID like "DLR-000001" and save it on the row.
--   - Status becomes 'approved'.
--   - Still NO password, NO auth account — just the ID + status change.
--   - Generation happens inside a single security-definer function
--     (approve_dealer_application) so two admins double-clicking Approve at
--     the same moment can never hand out the same Dealer ID (the sequence
--     itself guarantees uniqueness, and re-approving an already-approved
--     row is a no-op that returns the existing ID instead of burning a new
--     sequence value).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Column + sequence backing the human-readable Dealer ID
-- ---------------------------------------------------------------------------
alter table public.dealer_applications
  add column if not exists dealer_id text unique;

create sequence if not exists public.dealer_id_seq start 1;

-- ---------------------------------------------------------------------------
-- 2. approve_dealer_application(id)
--    Admin-only. Idempotent: calling it again on an already-approved row
--    just returns the row unchanged instead of generating a second ID.
-- ---------------------------------------------------------------------------
drop function if exists public.approve_dealer_application(uuid);
create or replace function public.approve_dealer_application(p_id uuid)
returns public.dealer_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.dealer_applications;
  v_new_id text;
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Only an admin can approve a dealer application.';
  end if;

  select * into v_row from public.dealer_applications where id = p_id;
  if v_row.id is null then
    raise exception 'Dealer application not found.';
  end if;

  -- Already approved (and therefore already has a Dealer ID) -- no-op.
  if v_row.status = 'approved' and v_row.dealer_id is not null then
    return v_row;
  end if;

  v_new_id := 'DLR-' || lpad(nextval('public.dealer_id_seq')::text, 6, '0');

  update public.dealer_applications
  set status = 'approved',
      dealer_id = v_new_id
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.approve_dealer_application(uuid) to authenticated;
