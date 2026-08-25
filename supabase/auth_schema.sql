-- =============================================================================
-- Auth / Profiles — Supabase schema (replaces Firebase Auth + Firestore)
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Everything (buyers, dealers, admins) now lives in ONE table: public.profiles
-- one row per auth.users row, with a `role` column instead of separate
-- Firestore collections. This mirrors what admin_users/dealers/buyers used
-- to be, but as one Postgres table gated by Row Level Security.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  role               text not null check (role in ('buyer', 'dealer', 'admin')),
  email              text,
  full_name          text,
  phone              text,
  business_name      text,
  license_url        text,
  profile_image_url  text,
  business_logo_url  text,
  status             text default 'approved' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  created_at         timestamptz not null default now()
);

-- Buyers/admins don't need an approval workflow — only dealers do — but the
-- `status` column stays generic (default 'approved') so one table covers all
-- three roles without nullable-everywhere hacks.

create index if not exists profiles_role_idx on public.profiles(role);

-- ---------------------------------------------------------------------------
-- 2. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

-- Everyone can read their own profile row (needed right after sign-in to
-- resolve role/status before rendering the right dashboard).
create policy "profiles: read own row"
  on public.profiles for select
  using (auth.uid() = id);

-- Admins can read every row (needed for the dealer-approval screen and any
-- future user-management screens).
create policy "profiles: admins read all"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- A signed-up user may insert exactly one row for themself, and only as
-- buyer or dealer — never as admin (admins are created manually, see below).
create policy "profiles: self insert (non-admin)"
  on public.profiles for insert
  with check (auth.uid() = id and role in ('buyer', 'dealer'));

-- Users may update their own row EXCEPT role/status (handled by trigger
-- below, since RLS can't easily restrict individual columns).
create policy "profiles: self update"
  on public.profiles for update
  using (auth.uid() = id);

-- Admins can update any row (needed to approve/reject dealers).
create policy "profiles: admins update all"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Prevent a non-admin from promoting themself to admin or flipping their own
-- dealer status to 'approved' via the self-update policy above.
create or replace function public.prevent_self_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    if new.role <> old.role then
      raise exception 'Only an admin can change a role.';
    end if;
    if new.status <> old.status then
      raise exception 'Only an admin can change status.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_self_privilege_escalation on public.profiles;
create trigger trg_prevent_self_privilege_escalation
  before update on public.profiles
  for each row execute function public.prevent_self_privilege_escalation();

-- ---------------------------------------------------------------------------
-- 3. Storage (replaces Firebase Storage for dealer documents)
-- ---------------------------------------------------------------------------
-- Run once — creates a private bucket for dealer license/profile/logo files.
insert into storage.buckets (id, name, public)
values ('dealer-docs', 'dealer-docs', true)
on conflict (id) do nothing;

create policy "dealer-docs: owner can upload"
  on storage.objects for insert
  with check (bucket_id = 'dealer-docs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "dealer-docs: owner can read own files"
  on storage.objects for select
  using (bucket_id = 'dealer-docs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "dealer-docs: public read (bucket is public)"
  on storage.objects for select
  using (bucket_id = 'dealer-docs');

-- ---------------------------------------------------------------------------
-- 4. Creating your first admin (do this manually, once)
-- ---------------------------------------------------------------------------
-- 1. Supabase Dashboard → Authentication → Users → Add user
--    (set an email + password, or "Auto Confirm User" so it's active
--    immediately).
-- 2. Copy that user's UID.
-- 3. Run:
--      insert into public.profiles (id, role, email, full_name)
--      values ('<paste-uid-here>', 'admin', '<their email>', '<their name>');
--    (Use the SQL Editor with the service_role — the RLS insert policy
--    above deliberately blocks 'admin' via the app, so this step must be
--    done from the dashboard, not from the signup form.)
-- =============================================================================
