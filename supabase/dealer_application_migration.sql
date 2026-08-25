-- =============================================================================
-- Dealer Registration — application intake (Phase 1 of dealer onboarding)
-- Run in: Supabase Dashboard → SQL Editor → New query → Run. Safe to re-run.
--
-- SCOPE OF THIS MIGRATION (intentionally minimal):
--   - Anyone can submit a dealer application from the public registration
--     form (business_name, dealer_name, business_address, mobile_number,
--     email).
--   - The application is stored with status = 'pending'.
--   - Nothing else happens:
--       * No auth.users account is created.
--       * No password is set.
--       * No dealer_id / login credential is generated.
--       * The dealer CANNOT log in from this table — there is no auth
--         identity tied to it yet.
--   - Turning a pending application into an actual logged-in dealer
--     (creating the auth account, a real Dealer ID, RLS'd profile row,
--     access code, etc.) is a separate, later step for the admin-approval
--     flow and is deliberately NOT part of this migration.
-- =============================================================================

create table if not exists public.dealer_applications (
  id                uuid primary key default gen_random_uuid(),
  business_name     text not null,
  dealer_name       text not null,
  business_address  text not null,
  mobile_number     text not null,
  email             text not null,
  status            text not null default 'pending'
                      check (status in ('pending', 'approved', 'rejected')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_dealer_applications_status
  on public.dealer_applications(status);

create index if not exists idx_dealer_applications_email
  on public.dealer_applications(email);

-- Keep updated_at fresh on any future status change (admin approval step).
create or replace function public.set_dealer_application_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_dealer_applications_updated_at on public.dealer_applications;
create trigger trg_dealer_applications_updated_at
  before update on public.dealer_applications
  for each row execute function public.set_dealer_application_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: public (anon + authenticated) can submit an application, but cannot
-- read, update, or delete any application — including their own. Only an
-- admin (checked against public.profiles) can review applications.
-- ---------------------------------------------------------------------------
alter table public.dealer_applications enable row level security;

drop policy if exists "dealer_applications_public_insert" on public.dealer_applications;
create policy "dealer_applications_public_insert" on public.dealer_applications
  for insert
  to anon, authenticated
  with check (
    status = 'pending'
  );

drop policy if exists "dealer_applications_admin_select" on public.dealer_applications;
create policy "dealer_applications_admin_select" on public.dealer_applications
  for select
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "dealer_applications_admin_update" on public.dealer_applications;
create policy "dealer_applications_admin_update" on public.dealer_applications
  for update
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
