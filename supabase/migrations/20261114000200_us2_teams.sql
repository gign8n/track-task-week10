-- US-2. Requires 20261114000100_us1_profiles.sql. Run manually in SQL Editor.
begin;

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  owner_id uuid not null unique references public.profiles(user_id),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now()
);
create table public.team_members (
  user_id uuid primary key references public.profiles(user_id),
  team_id uuid not null references public.teams(id),
  joined_at timestamptz not null default now(),
  unique (team_id, user_id)
);
-- The creator must also be a member. Both rows are created atomically by create_team.
alter table public.teams add constraint teams_owner_membership_fk
  foreign key (id, owner_id) references public.team_members(team_id, user_id)
  deferrable initially deferred;
create index team_members_team_id_idx on public.team_members(team_id);
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
revoke all on public.teams, public.team_members from anon, authenticated;
grant select on public.teams, public.team_members to authenticated;

-- These helpers bypass recursive RLS only to inspect the caller's own membership.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create function private.current_team_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select m.team_id from public.team_members m where m.user_id = (select auth.uid());
$$;
create function private.is_team_owner(p_team_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.teams t
    where t.id = p_team_id and t.owner_id = (select auth.uid()));
$$;
revoke all on function private.current_team_id() from public, anon, authenticated;
revoke all on function private.is_team_owner(uuid) from public, anon, authenticated;
grant execute on function private.current_team_id() to authenticated;
grant execute on function private.is_team_owner(uuid) to authenticated;

create policy teams_select_own_team on public.teams
for select to authenticated using (id = (select private.current_team_id()));
create policy team_members_select_teammates on public.team_members
for select to authenticated using (team_id = (select private.current_team_id()));
create policy profiles_select_teammates on public.profiles
for select to authenticated using (exists (
  select 1 from public.team_members m
  where m.user_id = profiles.user_id
    and m.team_id = (select private.current_team_id())
));

create function public.create_team(p_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_id uuid;
  v_attempt integer;
begin
  if v_uid is null then raise exception 'NOT_LOGGED_IN'; end if;
  -- Serialize create/join for the same user, including requests arriving together.
  perform 1 from public.profiles where user_id = v_uid for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if exists (select 1 from public.team_members where user_id = v_uid) then
    raise exception 'ALREADY_IN_TEAM';
  end if;
  if coalesce(btrim(p_name), '') = '' then raise exception 'TEAM_NAME_REQUIRED'; end if;
  for v_attempt in 1..10 loop
    insert into public.teams(name, owner_id, invite_code)
    values (btrim(p_name), v_uid, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)))
    on conflict (invite_code) do nothing returning id into v_team_id;
    exit when v_team_id is not null;
  end loop;
  if v_team_id is null then raise exception 'INVITE_CODE_UNAVAILABLE'; end if;
  insert into public.team_members(user_id, team_id) values (v_uid, v_team_id);
  return v_team_id;
end;
$$;

create function public.join_team(p_code text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_id uuid;
begin
  if v_uid is null then raise exception 'NOT_LOGGED_IN'; end if;
  perform 1 from public.profiles where user_id = v_uid for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if exists (select 1 from public.team_members where user_id = v_uid) then
    raise exception 'ALREADY_IN_TEAM';
  end if;
  if coalesce(upper(btrim(p_code)), '') !~ '^[A-Z0-9]{6}$' then
    raise exception 'TEAM_NOT_FOUND';
  end if;
  select id into v_team_id from public.teams where invite_code = upper(btrim(p_code));
  if v_team_id is null then raise exception 'TEAM_NOT_FOUND'; end if;
  insert into public.team_members(user_id, team_id) values (v_uid, v_team_id);
  return v_team_id;
end;
$$;
revoke all on function public.create_team(text) from public, anon, authenticated;
revoke all on function public.join_team(text) from public, anon, authenticated;
grant execute on function public.create_team(text) to authenticated;
grant execute on function public.join_team(text) to authenticated;
commit;
