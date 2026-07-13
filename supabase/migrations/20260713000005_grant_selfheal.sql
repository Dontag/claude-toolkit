-- Fix: "Couldn't grant — an item may already be under a grant" on items that
-- have NO live grant.
--
-- access_grants has a partial unique index `one_live_grant_per_item (item_id)
-- WHERE revoked_at IS NULL`. Expired grants only get revoked_at stamped by the
-- expire_grants() sweep, which is scheduled ONLY when pg_cron is available. On a
-- project without pg_cron, an expired grant keeps revoked_at = NULL forever, so:
--   * grant_change_request's guard (now() < expires_at) correctly sees it as
--     NOT active and lets the grant proceed, but
--   * the INSERT then collides with the leftover row on the unique index →
--     the whole RPC raises and the client shows "couldn't grant".
-- Net effect: any item that ever had a grant expire can never be granted again.
--
-- Self-heal: before inserting, revoke (retire) any expired grants on the items
-- in this request. This removes the dependency on pg_cron entirely — the unique
-- index only ever sees genuinely-live grants.

create or replace function public.grant_change_request(p_request uuid)
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

  -- reclaim expired-but-unswept grants on these items (pg_cron may be off), so
  -- the partial unique index one_live_grant_per_item won't block the new insert
  update public.access_grants g
  set revoked_at = g.expires_at
  where g.revoked_at is null
    and now() >= g.expires_at
    and g.item_id in (select ci.item_id from public.change_request_items ci where ci.request_id = p_request);

  -- refuse only if an item still has a genuinely LIVE grant
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
