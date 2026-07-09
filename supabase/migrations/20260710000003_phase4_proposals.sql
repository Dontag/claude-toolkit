-- Phase 4: propose-and-approve editing.
--
-- When a grantee edits a shared item during their 30-minute window, the change
-- is NOT applied live — it becomes a PROPOSAL the owner must approve. On
-- approval the proposal's content becomes the item's new current version (and
-- the owner's app writes it back to their local file); on rejection it's
-- discarded. Guards: proposed content may not be empty, and only the owner (or
-- an admin) may approve/reject.

-- link a version back to the request whose approved proposal produced it
alter table public.item_versions
  add column if not exists change_request_id uuid references public.change_requests (id);

create type public.proposal_status as enum ('pending', 'approved', 'rejected', 'superseded');

create table public.item_proposals (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.toolkit_items (id) on delete cascade,
  request_id uuid references public.change_requests (id) on delete set null,
  proposer_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  content_hash text not null,
  status public.proposal_status not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint content_not_blank check (length(btrim(content)) > 0)  -- can't blank the item
);
create index item_proposals_item_idx on public.item_proposals (item_id, status);

alter table public.item_proposals enable row level security;

-- visible to the proposer, the item's owner, and admins
create policy "see relevant proposals" on public.item_proposals
  for select using (
    proposer_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.toolkit_items i
      where i.id = item_id and public.is_toolkit_owner(i.toolkit_id)
    )
  );

-- ── propose a change (grantee during their window, or the owner directly) ──
create function public.propose_item_change(p_item uuid, p_content text)
returns public.item_proposals
language plpgsql security definer set search_path = public as $$
declare
  prop public.item_proposals;
  owner_uid uuid;
  is_owner boolean;
  has_grant boolean;
  req uuid;
begin
  if length(btrim(p_content)) = 0 then
    raise exception 'proposed content cannot be empty';
  end if;
  select t.owner_id into owner_uid
    from public.toolkit_items i join public.toolkits t on t.id = i.toolkit_id
    where i.id = p_item;
  if owner_uid is null then raise exception 'item not found'; end if;

  is_owner := owner_uid = auth.uid();
  has_grant := public.has_active_grant(p_item, auth.uid());
  if not is_owner and not has_grant then
    raise exception 'you need an active grant to propose changes to this item';
  end if;

  -- link the grant's originating request if there is one
  select g.request_id into req from public.access_grants g
    where g.item_id = p_item and g.grantee_id = auth.uid() and g.revoked_at is null and now() < g.expires_at
    limit 1;

  -- supersede any earlier pending proposal from the same author on this item
  update public.item_proposals set status = 'superseded', resolved_at = now()
    where item_id = p_item and proposer_id = auth.uid() and status = 'pending';

  insert into public.item_proposals (item_id, request_id, proposer_id, content, content_hash, status)
  values (p_item, req, auth.uid(), p_content, md5(p_content), 'pending')
  returning * into prop;

  -- notify the owner (unless they proposed to their own item)
  if not is_owner then
    insert into public.notifications (user_id, type, payload)
    values (owner_uid, 'proposal_pending',
      jsonb_build_object('proposal_id', prop.id, 'item_id', p_item, 'proposer', auth.uid()));
  end if;
  insert into public.audit_log (actor_id, action, target_type, target_id)
  values (auth.uid(), 'propose', 'item', p_item);
  return prop;
end $$;

-- ── approve: proposal content becomes the item's new current version ──
create function public.approve_proposal(p_proposal uuid)
returns public.item_versions
language plpgsql security definer set search_path = public as $$
declare
  prop public.item_proposals;
  owner_uid uuid;
  ver public.item_versions;
  next_v int;
begin
  select * into prop from public.item_proposals where id = p_proposal for update;
  if prop is null then raise exception 'proposal not found'; end if;
  if prop.status <> 'pending' then raise exception 'proposal already resolved'; end if;

  select t.owner_id into owner_uid
    from public.toolkit_items i join public.toolkits t on t.id = i.toolkit_id
    where i.id = prop.item_id;
  if owner_uid <> auth.uid() and not public.is_admin() then
    raise exception 'only the owner may approve';
  end if;
  if length(btrim(prop.content)) = 0 then raise exception 'proposal content is empty'; end if;

  select coalesce(max(version), 0) + 1 into next_v from public.item_versions where item_id = prop.item_id;
  insert into public.item_versions (item_id, version, content, content_hash, author_id, change_request_id)
  values (prop.item_id, next_v, prop.content, prop.content_hash, prop.proposer_id, prop.request_id)
  returning * into ver;
  update public.toolkit_items set current_version_id = ver.id, updated_at = now() where id = prop.item_id;
  update public.item_proposals set status = 'approved', resolved_at = now() where id = p_proposal;
  if prop.request_id is not null then
    update public.change_requests set status = 'completed' where id = prop.request_id;
  end if;

  insert into public.notifications (user_id, type, payload)
  values (prop.proposer_id, 'proposal_approved', jsonb_build_object('proposal_id', p_proposal, 'item_id', prop.item_id));
  insert into public.audit_log (actor_id, action, target_type, target_id)
  values (auth.uid(), 'approve_proposal', 'item_proposal', p_proposal);
  return ver;
end $$;

-- ── reject: discard the proposal ──
create function public.reject_proposal(p_proposal uuid) returns void
language plpgsql security definer set search_path = public as $$
declare prop public.item_proposals; owner_uid uuid;
begin
  select * into prop from public.item_proposals where id = p_proposal for update;
  if prop is null then raise exception 'proposal not found'; end if;
  select t.owner_id into owner_uid
    from public.toolkit_items i join public.toolkits t on t.id = i.toolkit_id
    where i.id = prop.item_id;
  if owner_uid <> auth.uid() and not public.is_admin() then
    raise exception 'only the owner may reject';
  end if;
  update public.item_proposals set status = 'rejected', resolved_at = now() where id = p_proposal;
  insert into public.notifications (user_id, type, payload)
  values (prop.proposer_id, 'proposal_rejected', jsonb_build_object('proposal_id', p_proposal, 'item_id', prop.item_id));
end $$;

alter publication supabase_realtime add table public.item_proposals;
