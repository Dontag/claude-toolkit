-- Phase 3: change requests + exclusive 30-minute write windows + admin/audit.
--
-- Model: another user requests write access to one or more of an owner's items.
-- The owner grants it → the requester gets an EXCLUSIVE 30-minute window during
-- which THEY can write those items and the OWNER cannot. When it expires (or is
-- revoked) write access reverts to the owner. Enforcement is in RLS via now() <
-- expires_at on the server clock, so it never depends on the cleanup job.

create type public.request_status as enum ('pending', 'granted', 'denied', 'expired', 'completed', 'cancelled');

-- ── change_requests ───────────────────────────────────────────────────────
create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  toolkit_id uuid not null references public.toolkits (id) on delete cascade,
  message text,
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> owner_id)
);
create index change_requests_owner_idx on public.change_requests (owner_id, status);
create index change_requests_requester_idx on public.change_requests (requester_id, status);

create table public.change_request_items (
  request_id uuid not null references public.change_requests (id) on delete cascade,
  item_id uuid not null references public.toolkit_items (id) on delete cascade,
  primary key (request_id, item_id)
);

-- ── access_grants (one live grant per item, expires_at = granted_at + 30m) ──
create table public.access_grants (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.change_requests (id) on delete cascade,
  item_id uuid not null references public.toolkit_items (id) on delete cascade,
  grantee_id uuid not null references public.profiles (id) on delete cascade,
  granted_by uuid not null references public.profiles (id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create unique index one_live_grant_per_item on public.access_grants (item_id) where revoked_at is null;
create index access_grants_grantee_idx on public.access_grants (grantee_id) where revoked_at is null;

-- ── audit_log + notifications ─────────────────────────────────────────────
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.change_requests enable row level security;
alter table public.change_request_items enable row level security;
alter table public.access_grants enable row level security;
alter table public.audit_log enable row level security;
alter table public.notifications enable row level security;

-- ── helpers (security definer so RLS on access_grants can't hide grant rows
--    from the policy check itself) ──
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

create function public.has_active_grant(p_item uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.access_grants g
    where g.item_id = p_item and g.grantee_id = p_user
      and g.revoked_at is null and now() < g.expires_at
  )
$$;

create function public.item_has_active_grant(p_item uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.access_grants g
    where g.item_id = p_item and g.revoked_at is null and now() < g.expires_at
  )
$$;

-- ── replace the Phase-2 owner-only write policies with the window versions ──
-- toolkit_items UPDATE: owner may write ONLY when no live grant exists on the
-- item; a grantee may write while their grant is live; admins always may.
drop policy if exists "owners update items" on public.toolkit_items;
create policy "write window on items" on public.toolkit_items
  for update using (
    public.is_admin()
    or (public.is_toolkit_owner(toolkit_id) and not public.item_has_active_grant(id))
    or public.has_active_grant(id, auth.uid())
  );

-- item_versions INSERT: same window rule (author must be self)
drop policy if exists "owners append versions" on public.item_versions;
create policy "write window on versions" on public.item_versions
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.toolkit_items i
      where i.id = item_id
        and (
          public.is_admin()
          or (public.is_toolkit_owner(i.toolkit_id) and not public.item_has_active_grant(i.id))
          or public.has_active_grant(i.id, auth.uid())
        )
    )
  );

-- ── RLS: change_requests ──
create policy "see own requests" on public.change_requests
  for select using (requester_id = auth.uid() or owner_id = auth.uid() or public.is_admin());
create policy "requester creates pending" on public.change_requests
  for insert with check (requester_id = auth.uid() and status = 'pending');
create policy "requester cancels / owner denies" on public.change_requests
  for update using (requester_id = auth.uid() or owner_id = auth.uid());

create policy "see request items" on public.change_request_items
  for select using (
    exists (
      select 1 from public.change_requests r
      where r.id = request_id and (r.requester_id = auth.uid() or r.owner_id = auth.uid() or public.is_admin())
    )
  );
create policy "requester adds items to own request" on public.change_request_items
  for insert with check (
    exists (select 1 from public.change_requests r where r.id = request_id and r.requester_id = auth.uid())
  );

-- ── RLS: access_grants — read only; writes go through the edge function
--    (service role) so grants are created/revoked atomically ──
create policy "see grants involving me" on public.access_grants
  for select using (grantee_id = auth.uid() or granted_by = auth.uid() or public.is_admin());

-- ── RLS: audit_log (admin only) + notifications (own) ──
create policy "admin reads audit" on public.audit_log
  for select using (public.is_admin());
create policy "read own notifications" on public.notifications
  for select using (user_id = auth.uid());
create policy "update own notifications" on public.notifications
  for update using (user_id = auth.uid());

-- ── atomic grant (called by the grant-request edge function via service role,
--    or directly by the owner through a security-definer RPC) ──
create function public.grant_change_request(p_request uuid)
returns public.access_grants
language plpgsql security definer set search_path = public as $$
declare
  r public.change_requests;
  itm uuid;
  first_grant public.access_grants;
  exp timestamptz := now() + interval '30 minutes';
begin
  select * into r from public.change_requests where id = p_request for update;
  if r is null then raise exception 'request not found'; end if;
  if r.owner_id <> auth.uid() and not public.is_admin() then
    raise exception 'only the owner may grant';
  end if;
  if r.status <> 'pending' then raise exception 'request is not pending'; end if;

  -- refuse if any requested item already has a live grant
  if exists (
    select 1 from public.change_request_items ci
    join public.access_grants g on g.item_id = ci.item_id and g.revoked_at is null and now() < g.expires_at
    where ci.request_id = p_request
  ) then
    raise exception 'an item in this request is already under an active grant';
  end if;

  for itm in select item_id from public.change_request_items where request_id = p_request loop
    insert into public.access_grants (request_id, item_id, grantee_id, granted_by, expires_at)
    values (p_request, itm, r.requester_id, auth.uid(), exp)
    returning * into first_grant;
  end loop;

  update public.change_requests set status = 'granted', responded_at = now() where id = p_request;
  insert into public.notifications (user_id, type, payload)
  values (r.requester_id, 'grant_opened', jsonb_build_object('request_id', p_request, 'expires_at', exp));
  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'grant', 'change_request', p_request, jsonb_build_object('expires_at', exp));
  return first_grant;
end $$;

-- deny (owner)
create function public.deny_change_request(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.change_requests;
begin
  select * into r from public.change_requests where id = p_request for update;
  if r is null or (r.owner_id <> auth.uid() and not public.is_admin()) then
    raise exception 'not allowed';
  end if;
  update public.change_requests set status = 'denied', responded_at = now() where id = p_request;
  insert into public.notifications (user_id, type, payload)
  values (r.requester_id, 'request_denied', jsonb_build_object('request_id', p_request));
end $$;

-- admin force-revoke a live grant
create function public.revoke_grant(p_grant uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g public.access_grants;
begin
  select * into g from public.access_grants where id = p_grant for update;
  if g is null then raise exception 'grant not found'; end if;
  if not public.is_admin() and g.granted_by <> auth.uid() then
    raise exception 'only an admin or the granting owner may revoke';
  end if;
  update public.access_grants set revoked_at = now() where id = p_grant and revoked_at is null;
  insert into public.notifications (user_id, type, payload)
  values (g.grantee_id, 'grant_revoked', jsonb_build_object('grant_id', p_grant));
  insert into public.audit_log (actor_id, action, target_type, target_id)
  values (auth.uid(), 'revoke_grant', 'access_grant', p_grant);
end $$;

-- expiry sweep (called by pg_cron every minute; RLS already enforces expiry so
-- this is just cleanup + notifications)
create function public.expire_grants() returns void
language plpgsql security definer set search_path = public as $$
declare g record;
begin
  for g in
    select * from public.access_grants where revoked_at is null and now() >= expires_at
  loop
    update public.access_grants set revoked_at = expires_at where id = g.id;
    update public.change_requests set status = 'expired'
      where id = g.request_id and status = 'granted';
    insert into public.notifications (user_id, type, payload)
    values (g.grantee_id, 'grant_expired', jsonb_build_object('grant_id', g.id, 'item_id', g.item_id));
  end loop;
end $$;

-- admin: moderate a toolkit (hide/ban/active)
create function public.admin_set_toolkit_moderation(p_toolkit uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_status not in ('active','hidden','banned') then raise exception 'bad status'; end if;
  update public.toolkits set moderation_status = p_status where id = p_toolkit;
  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'moderate', 'toolkit', p_toolkit, jsonb_build_object('status', p_status));
end $$;

-- admin: change a user's role
create function public.admin_set_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_role not in ('user','admin') then raise exception 'bad role'; end if;
  update public.profiles set role = p_role where id = p_user;
  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'set_role', 'profile', p_user, jsonb_build_object('role', p_role));
end $$;

-- realtime for the notification center + live grant countdowns
alter publication supabase_realtime add table public.change_requests;
alter publication supabase_realtime add table public.access_grants;
alter publication supabase_realtime add table public.notifications;

-- schedule the sweep if pg_cron is available (safe no-op otherwise)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('expire-grants', '* * * * *', 'select public.expire_grants()');
  end if;
end $$;
