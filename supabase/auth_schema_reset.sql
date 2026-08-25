-- =============================================================================
-- Auth / Profiles — RESET + REBUILD (safe to run again and again)
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Clean slate — drop everything from any previous attempt first
-- ---------------------------------------------------------------------------
drop table if exists public.profiles cascade;
drop function if exists public.prevent_self_privilege_escalation() cascade;

drop policy if exists "dealer-docs: owner can upload" on storage.objects;
drop policy if exists "dealer-docs: owner can read own files" on storage.objects;
drop policy if exists "dealer-docs: public read (bucket is public)" on storage.objects;

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table public.profiles (
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

create index profiles_role_idx on public.profiles(role);

-- ---------------------------------------------------------------------------
-- 2. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles: read own row"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: admins read all"
  on public.profiles for select
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "profiles: self insert (non-admin)"
  on public.profiles for insert
  with check (auth.uid() = id and role in ('buyer', 'dealer'));

create policy "profiles: self update"
  on public.profiles for update
  using (auth.uid() = id);

create policy "profiles: admins update all"
  on public.profiles for update
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create or replace function public.prevent_self_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
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

create trigger trg_prevent_self_privilege_escalation
  before update on public.profiles
  for each row execute function public.prevent_self_privilege_escalation();

-- ---------------------------------------------------------------------------
-- 3. Storage bucket for dealer documents
-- ---------------------------------------------------------------------------
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

-- =============================================================================
-- 4. Creating your first admin (do this manually, once, AFTER running this)
-- =============================================================================
-- 1. Dashboard → Authentication → Users → Add user (email + password,
--    tick "Auto Confirm User").
-- 2. Copy that user's UID.
-- 3. Run (replace the placeholders):
--      insert into public.profiles (id, role, email, full_name)
--      values ('<uid-here>', 'admin', '<email-here>', '<name-here>');
-- =============================================================================
