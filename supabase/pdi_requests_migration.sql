-- =============================================================================
-- PDI (Pre-Delivery Inspection) requests — from the "Request PDI" form on the
-- /pdi-service page. Staff can view & manage these from the Admin/Manager
-- panel (Manage PDI Requests page).
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run. Safe to re-run.
-- =============================================================================

create table if not exists public.pdi_requests (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null,
  car_details text not null,
  location    text,
  message     text,
  status      text not null default 'pending' check (status in ('pending', 'scheduled', 'completed', 'cancelled')),
  created_at  timestamptz not null default now()
);

create index if not exists pdi_requests_created_idx on public.pdi_requests (created_at desc);
create index if not exists pdi_requests_status_idx on public.pdi_requests (status);

alter table public.pdi_requests enable row level security;

-- Anyone (including logged-out visitors on the PDI Service page) can submit
-- a request.
drop policy if exists "pdi_requests: public insert" on public.pdi_requests;
create policy "pdi_requests: public insert"
  on public.pdi_requests for insert to anon, authenticated
  with check (true);

-- Only staff (admin / manager / team_lead) can read requests in the panel.
drop policy if exists "pdi_requests: staff read" on public.pdi_requests;
create policy "pdi_requests: staff read"
  on public.pdi_requests for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'manager', 'team_lead')));

-- Only staff can update status (Pending / Scheduled / Completed / Cancelled).
drop policy if exists "pdi_requests: staff update" on public.pdi_requests;
create policy "pdi_requests: staff update"
  on public.pdi_requests for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'manager', 'team_lead')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'manager', 'team_lead')));

-- Only admin can delete.
drop policy if exists "pdi_requests: admin delete" on public.pdi_requests;
create policy "pdi_requests: admin delete"
  on public.pdi_requests for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

notify pgrst, 'reload schema';
