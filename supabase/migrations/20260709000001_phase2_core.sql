-- Phase 2: profiles, toolkits, items, versions + RLS for per-item publishing.
-- (Phase 3 adds change_requests / access_grants / audit_log and the 30-minute
-- exclusive write-window policies on top of these tables.)

create type public.item_kind as enum ('skill', 'agent', 'command', 'hook');

-- ── profiles ──────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  handle text unique not null,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are public" on public.profiles
  for select using (true);

create policy "users update own profile" on public.profiles
  for update using (auth.uid() = id);

-- role is immutable to clients; only the service role may change it
create function public.guard_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    raise exception 'role can only be changed by an administrator';
  end if;
  return new;
end $$;

create trigger profiles_role_guard
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- auto-create a profile + default toolkit on signup
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base_handle text;
begin
  base_handle := coalesce(
    new.raw_user_meta_data ->> 'user_name',           -- github login
    split_part(new.email, '@', 1)
  );
  -- ensure uniqueness with a short suffix on collision
  if exists (select 1 from public.profiles where handle = base_handle) then
    base_handle := base_handle || '-' || substr(new.id::text, 1, 4);
  end if;
  insert into public.profiles (id, handle, display_name, avatar_url)
  values (
    new.id,
    base_handle,
    coalesce(new.raw_user_meta_data ->> 'full_name', base_handle),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  insert into public.toolkits (owner_id, name, slug)
  values (new.id, 'My Toolkit', 'main');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── toolkits ──────────────────────────────────────────────────────────────
create table public.toolkits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  slug text not null,
  visibility text not null default 'public' check (visibility in ('public', 'unlisted', 'private')),
  moderation_status text not null default 'active' check (moderation_status in ('active', 'hidden', 'banned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

alter table public.toolkits enable row level security;

create policy "public toolkits are visible" on public.toolkits
  for select using (
    (visibility = 'public' and moderation_status = 'active')
    or owner_id = auth.uid()
  );

create policy "owners insert toolkits" on public.toolkits
  for insert with check (owner_id = auth.uid());

create policy "owners update toolkits" on public.toolkits
  for update using (owner_id = auth.uid());

create policy "owners delete toolkits" on public.toolkits
  for delete using (owner_id = auth.uid());

-- ── toolkit_items (item-level visibility = the Share-to-Galaxy toggle) ────
create table public.toolkit_items (
  id uuid primary key default gen_random_uuid(),
  toolkit_id uuid not null references public.toolkits (id) on delete cascade,
  kind public.item_kind not null,
  name text not null,
  path text not null,
  description text not null default '',
  frontmatter jsonb not null default '{}',
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (toolkit_id, path)
);

create index toolkit_items_toolkit_idx on public.toolkit_items (toolkit_id);

alter table public.toolkit_items enable row level security;

create function public.is_toolkit_owner(p_toolkit uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.toolkits t
    where t.id = p_toolkit and t.owner_id = auth.uid()
  )
$$;

create policy "public items are visible" on public.toolkit_items
  for select using (
    (
      visibility = 'public'
      and deleted_at is null
      and exists (
        select 1 from public.toolkits t
        where t.id = toolkit_id
          and t.visibility in ('public', 'unlisted')
          and t.moderation_status = 'active'
      )
    )
    or public.is_toolkit_owner(toolkit_id)
  );

create policy "owners insert items" on public.toolkit_items
  for insert with check (public.is_toolkit_owner(toolkit_id));

-- NOTE: Phase 3 replaces this policy with the grant-window version:
--   (owner AND no live grant) OR grantee-with-live-grant
create policy "owners update items" on public.toolkit_items
  for update using (public.is_toolkit_owner(toolkit_id));

create policy "owners delete items" on public.toolkit_items
  for delete using (public.is_toolkit_owner(toolkit_id));

-- ── item_versions (append-only) ───────────────────────────────────────────
create table public.item_versions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.toolkit_items (id) on delete cascade,
  version int not null,
  content text not null,
  content_hash text not null,
  author_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (item_id, version)
);

create index item_versions_item_idx on public.item_versions (item_id, version desc);

alter table public.toolkit_items
  add constraint toolkit_items_current_version_fk
  foreign key (current_version_id) references public.item_versions (id);

alter table public.item_versions enable row level security;

create function public.can_see_item(p_item uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.toolkit_items i
    join public.toolkits t on t.id = i.toolkit_id
    where i.id = p_item
      and (
        (i.visibility = 'public' and i.deleted_at is null
          and t.visibility in ('public', 'unlisted') and t.moderation_status = 'active')
        or t.owner_id = auth.uid()
      )
  )
$$;

create policy "versions of visible items are readable" on public.item_versions
  for select using (public.can_see_item(item_id));

-- NOTE: Phase 3 extends this with grantee-with-live-grant
create policy "owners append versions" on public.item_versions
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.toolkit_items i
      where i.id = item_id and public.is_toolkit_owner(i.toolkit_id)
    )
  );

-- ── realtime ──────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.toolkit_items;
alter publication supabase_realtime add table public.item_versions;
