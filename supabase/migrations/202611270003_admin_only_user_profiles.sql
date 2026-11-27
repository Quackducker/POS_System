create or replace function public.current_active_profile_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select profile.role
  from public.profiles as profile
  where profile.id = auth.uid()
    and profile.active = true
  limit 1;
$$;

revoke all on function public.current_active_profile_role() from public, anon;
grant execute on function public.current_active_profile_role() to authenticated;

drop policy if exists public_profiles on public.profiles;
drop policy if exists profiles_select_self_or_admin on public.profiles;
drop policy if exists profiles_update_admin_only on public.profiles;

create policy profiles_select_self_or_admin
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.current_active_profile_role() = 'Administrator'
  );

create policy profiles_update_admin_only
  on public.profiles for update to authenticated
  using (public.current_active_profile_role() = 'Administrator')
  with check (public.current_active_profile_role() = 'Administrator');

create or replace function public.lookup_login_account(p_username text)
returns table(email text, active boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.email, profile.active
  from public.profiles as profile
  where lower(profile.username) = lower(trim(p_username))
  limit 1;
$$;

revoke all on function public.lookup_login_account(text) from public;
grant execute on function public.lookup_login_account(text) to anon, authenticated;
