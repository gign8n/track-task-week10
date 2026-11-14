-- US-1 / AC-1.1: run manually in Supabase SQL Editor. Never contains credentials.
begin;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) > 0),
  email text not null,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

-- US-2 will add a separate policy for teammates when team_members exists.
create policy profiles_select_own on public.profiles
for select to authenticated
using (user_id = (select auth.uid()));

create function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_name text := btrim(new.raw_user_meta_data ->> 'display_name');
begin
  if profile_name is null or profile_name = '' then
    raise exception 'DISPLAY_NAME_REQUIRED';
  end if;
  insert into public.profiles(user_id, display_name, email)
  values (new.id, profile_name, new.email);
  return new;
end;
$$;
revoke all on function public.handle_new_user_profile() from public, anon, authenticated;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

-- Only Auth's verified email field is authoritative; metadata cannot change it.
create function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where user_id = new.id;
  return new;
end;
$$;
revoke all on function public.sync_profile_email() from public, anon, authenticated;
create trigger on_auth_user_email_changed_profile
after update of email on auth.users
for each row when (old.email is distinct from new.email)
execute function public.sync_profile_email();

-- Preserve existing workshop accounts; new accounts must supply a name above.
insert into public.profiles(user_id, display_name, email)
select id,
  coalesce(nullif(btrim(raw_user_meta_data ->> 'display_name'), ''),
           nullif(split_part(email, '@', 1), ''), 'สมาชิก'),
  email
from auth.users
where email is not null
on conflict (user_id) do nothing;

commit;
