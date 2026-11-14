-- US-3 / US-4. Requires US-1 and US-2 migrations. Run manually in SQL Editor.
begin;
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id),
  title text not null check (length(btrim(title)) > 0),
  description text,
  due_date date,
  assignee_id uuid not null,
  created_by uuid not null default auth.uid(),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_assignee_team_fk foreign key (team_id, assignee_id)
    references public.team_members(team_id, user_id),
  constraint tasks_creator_team_fk foreign key (team_id, created_by)
    references public.team_members(team_id, user_id)
);
create index tasks_team_status_idx on public.tasks(team_id, status);
create index tasks_assignee_due_idx on public.tasks(assignee_id, due_date);
create index tasks_creator_team_idx on public.tasks(team_id, created_by);
alter table public.tasks enable row level security;
revoke all on public.tasks from anon, authenticated;
grant select, insert, update on public.tasks to authenticated;

create policy tasks_select_team on public.tasks
for select to authenticated using (team_id = (select private.current_team_id()));
create policy tasks_insert_owner on public.tasks
for insert to authenticated with check (
  team_id = (select private.current_team_id())
  and private.is_team_owner(team_id)
  and created_by = (select auth.uid())
);
create policy tasks_update_owner_or_assignee on public.tasks
for update to authenticated
using (team_id = (select private.current_team_id())
  and (private.is_team_owner(team_id) or assignee_id = (select auth.uid())))
with check (team_id = (select private.current_team_id())
  and (private.is_team_owner(team_id) or assignee_id = (select auth.uid())));

create function public.guard_task_insert()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_team_owner(new.team_id) then
    raise exception 'ONLY_TEAM_OWNER';
  end if;
  if new.status is distinct from 'todo' then raise exception 'INITIAL_STATUS_REQUIRED'; end if;
  new.created_by := (select auth.uid());
  new.title := btrim(new.title);
  new.description := nullif(btrim(new.description), '');
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;
create trigger tasks_guard_insert before insert on public.tasks
for each row execute function public.guard_task_insert();

create function public.guard_task_update()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.team_id is distinct from old.team_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'CANNOT_CHANGE_TASK_IDENTITY';
  end if;
  if not private.is_team_owner(old.team_id) then
    if old.assignee_id is distinct from (select auth.uid()) then
      raise exception 'TASK_UPDATE_FORBIDDEN';
    end if;
    -- Compare every field, including future columns, before setting updated_at.
    if (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
      raise exception 'ONLY_STATUS_ALLOWED';
    end if;
  end if;
  new.title := btrim(new.title);
  new.description := nullif(btrim(new.description), '');
  new.updated_at := now();
  return new;
end;
$$;
create trigger tasks_guard_update before update on public.tasks
for each row execute function public.guard_task_update();
revoke all on function public.guard_task_insert() from public, anon, authenticated;
revoke all on function public.guard_task_update() from public, anon, authenticated;
commit;
