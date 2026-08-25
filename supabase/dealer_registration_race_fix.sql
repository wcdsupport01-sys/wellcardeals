-- =============================================================================
-- Fix: dealer registration "duplicate key value violates profiles_pkey"
-- Run in: Supabase Dashboard → SQL Editor → New query → Run. Safe to re-run.
--
-- ROOT CAUSE:
-- The moment supabase.auth.signUp() succeeds, AuthContext's onAuthStateChange
-- listener fires and (because no profiles row exists yet for the brand-new
-- user) calls ensureBuyerProfile(), which inserts a *buyer* row for that id.
-- This races against DealerRegister's own flow, which uploads files first
-- and only inserts its *dealer* row afterwards — by the time it tries to
-- insert, the id already has a (buyer) row, so the insert hits the
-- profiles_pkey unique constraint.
--
-- FIX (two parts):
--   1. This migration relaxes prevent_self_privilege_escalation() to allow
--      exactly one self-service transition: an existing 'buyer' row turning
--      into a 'pending' 'dealer' row. Nothing else changes — a signed-in
--      user still can never grant themself admin, or flip their own dealer
--      status to 'approved', etc.
--   2. dealerRegister() in src/auth/authApi.js was changed to .upsert(...)
--      instead of .insert(...), so it overwrites that stray buyer row
--      instead of colliding with it.
-- =============================================================================

create or replace function public.prevent_self_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role (Edge Functions, migrations) has no auth.uid() and already
  -- bypasses RLS -- trust it; it does its own admin check before writing.
  -- (Without this, service_role callers like approve-dealer get blocked
  -- below because auth.uid() is null and matches no admin row.)
  if auth.uid() is null then
    return new;
  end if;

  -- Admins can change anything.
  if exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    return new;
  end if;

  -- Allow exactly one self-service transition: a buyer row (usually an
  -- auto-created stub with no real data) claiming itself as a pending
  -- dealer registration. This is what DealerRegister's upsert relies on.
  if old.role = 'buyer' and new.role = 'dealer' and new.status = 'pending' then
    return new;
  end if;

  if new.role <> old.role then
    raise exception 'Only an admin can change a role.';
  end if;
  if new.status <> old.status then
    raise exception 'Only an admin can change status.';
  end if;
  return new;
end;
$$;
