-- Optional manual verification of real RLS/constraints after applying migrations.
-- Create A/B in team 1 and C in team 2 through the website first.
-- Replace the three UUID placeholders below using Authentication > Users.
-- Run the ENTIRE file in SQL Editor. All fixture writes are rolled back.
begin;
select set_config('test.user_a', 'REPLACE_WITH_A_USER_UUID', true);
select set_config('test.user_b', 'REPLACE_WITH_B_USER_UUID', true);
select set_config('test.user_c', 'REPLACE_WITH_C_USER_UUID', true);

-- Resolve fixture identities before switching away from administrator privileges.
do $$
declare
  a uuid := current_setting('test.user_a')::uuid;
  b uuid := current_setting('test.user_b')::uuid;
  c uuid := current_setting('test.user_c')::uuid;
  team_a uuid;
  team_b uuid;
  team_c uuid;
begin
  select team_id into team_a from public.team_members where user_id = a;
  select team_id into team_b from public.team_members where user_id = b;
  select team_id into team_c from public.team_members where user_id = c;
  if a = b or a = c or b = c or team_a is null or team_b is distinct from team_a
     or team_c is null or team_c = team_a then
    raise exception 'SETUP: A/B must be distinct users in team 1 and C in team 2';
  end if;
  if not exists (select 1 from public.teams where id = team_a and owner_id = a) then
    raise exception 'SETUP: A must be team 1 owner';
  end if;
  perform set_config('test.team_a', team_a::text, true);
  perform set_config('test.team_c', team_c::text, true);
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test.user_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);
set local role authenticated;
-- All following operations use the same role as logged-in publishable-key requests.
do $$
declare
  new_id uuid;
  count_rows integer;
begin
  insert into public.tasks(team_id, title, assignee_id)
  values (current_setting('test.team_a')::uuid, 'Permission test: B', current_setting('test.user_b')::uuid)
  returning id into new_id;
  perform set_config('test.task_b', new_id::text, true);
  insert into public.tasks(team_id, title, assignee_id)
  values (current_setting('test.team_a')::uuid, 'Permission test: A', current_setting('test.user_a')::uuid)
  returning id into new_id;
  perform set_config('test.task_a', new_id::text, true);

  -- AC-3.4: a forged outsider must fail at the composite FK.
  begin
    insert into public.tasks(team_id, title, assignee_id)
    values (current_setting('test.team_a')::uuid, 'Must fail', current_setting('test.user_c')::uuid);
    raise exception 'FAIL AC-3.4: outsider task was accepted';
  exception when foreign_key_violation then null;
  end;
  -- Also enforce membership when the owner changes an assignee via the API.
  begin
    update public.tasks set assignee_id = current_setting('test.user_c')::uuid
    where id = current_setting('test.task_b')::uuid;
    raise exception 'FAIL AC-3.4: outsider reassignment was accepted';
  exception when foreign_key_violation then null;
  end;
  -- AC-4.2: owner can update a member's task.
  update public.tasks set status = 'in_progress' where id = current_setting('test.task_b')::uuid;
  get diagnostics count_rows = row_count;
  if count_rows <> 1 then raise exception 'FAIL AC-4.2'; end if;
  -- AC-2.4: both paths reject a user who already belongs to a team.
  begin
    perform public.create_team('Should not be created');
    raise exception 'FAIL AC-2.4 create';
  exception when raise_exception then
    if sqlerrm <> 'ALREADY_IN_TEAM' then raise; end if;
  end;
  begin
    perform public.join_team('000000');
    raise exception 'FAIL AC-2.4 join';
  exception when raise_exception then
    if sqlerrm <> 'ALREADY_IN_TEAM' then raise; end if;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test.user_b'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_b'), 'role', 'authenticated')::text, true);
do $$
declare
  count_rows integer;
  field_name text;
begin
  -- AC-3.3: members cannot create tasks, even by direct database access.
  begin
    insert into public.tasks(team_id, title, assignee_id)
    values (current_setting('test.team_a')::uuid, 'Must fail', current_setting('test.user_b')::uuid);
    raise exception 'FAIL AC-3.3';
  exception when raise_exception then
    if sqlerrm <> 'ONLY_TEAM_OWNER' then raise; end if;
  end;
  -- AC-4.1: assignee may change status in either direction.
  update public.tasks set status = 'done' where id = current_setting('test.task_b')::uuid;
  get diagnostics count_rows = row_count;
  if count_rows <> 1 then raise exception 'FAIL AC-4.1'; end if;
  update public.tasks set status = 'todo' where id = current_setting('test.task_b')::uuid;
  -- AC-4.3: a task belonging to A is visible, but is not writable by B.
  update public.tasks set status = 'done' where id = current_setting('test.task_a')::uuid;
  get diagnostics count_rows = row_count;
  if count_rows <> 0 then raise exception 'FAIL AC-4.3'; end if;
  -- AC-4.4: probe every protected business field with direct SQL.
  foreach field_name in array array['title', 'description', 'due_date', 'assignee_id'] loop
    begin
      case field_name
        when 'title' then update public.tasks set title = 'forged' where id = current_setting('test.task_b')::uuid;
        when 'description' then update public.tasks set description = 'forged' where id = current_setting('test.task_b')::uuid;
        when 'due_date' then update public.tasks set due_date = date '2030-01-01' where id = current_setting('test.task_b')::uuid;
        when 'assignee_id' then update public.tasks set assignee_id = current_setting('test.user_a')::uuid where id = current_setting('test.task_b')::uuid;
      end case;
      raise exception 'FAIL AC-4.4: % accepted', field_name;
    exception when raise_exception then
      if sqlerrm <> 'ONLY_STATUS_ALLOWED' then raise; end if;
    end;
  end loop;
  if exists (select 1 from public.tasks where id = current_setting('test.task_b')::uuid
    and (title <> 'Permission test: B' or description is not null or due_date is not null
      or assignee_id <> current_setting('test.user_b')::uuid)) then
    raise exception 'FAIL AC-4.4: original data changed';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test.user_c'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_c'), 'role', 'authenticated')::text, true);
do $$
begin
  -- AC-2.6 / AC-3.7: C cannot inspect team 1 or its members and tasks.
  if exists (select 1 from public.teams where id = current_setting('test.team_a')::uuid)
    or exists (select 1 from public.team_members where team_id = current_setting('test.team_a')::uuid)
    or exists (select 1 from public.profiles where user_id in (current_setting('test.user_a')::uuid, current_setting('test.user_b')::uuid))
    or exists (select 1 from public.tasks where team_id = current_setting('test.team_a')::uuid) then
    raise exception 'FAIL: team 1 data visible to C';
  end if;
end;
$$;
-- Check the opposite direction too.
select set_config('request.jwt.claim.sub', current_setting('test.user_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);
do $$
begin
  if exists (select 1 from public.teams where id = current_setting('test.team_c')::uuid)
    or exists (select 1 from public.profiles where user_id = current_setting('test.user_c')::uuid)
    or exists (select 1 from public.tasks where team_id = current_setting('test.team_c')::uuid) then
    raise exception 'FAIL: team 2 data visible to A';
  end if;
end;
$$;
select 'PASS: AC-2.4, AC-2.6, AC-3.3, AC-3.4, AC-3.7, AC-4.1 through AC-4.4' as result;
rollback;
-- No fixture tasks persist. If an assertion fails, run ROLLBACK before retrying.
