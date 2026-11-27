create or replace function public.delete_pos_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_actor_active boolean;
begin
  if auth.uid() is null or auth.uid() = p_user_id then
    raise exception 'You cannot delete this account.';
  end if;

  select profile.role, profile.active
  into v_actor_role, v_actor_active
  from public.profiles as profile
  where profile.id = auth.uid();

  if coalesce(v_actor_active, false) is false
    or coalesce(v_actor_role not in ('Administrator', 'Manager'), true) then
    raise exception 'Only an active Administrator or Manager can delete user accounts.';
  end if;

  update public.sales
  set cashier_id = null
  where cashier_id = p_user_id;

  delete from auth.users
  where id = p_user_id;

  if not found then
    raise exception 'User account not found.';
  end if;
end;
$$;

revoke all on function public.delete_pos_user(uuid) from public, anon;
grant execute on function public.delete_pos_user(uuid) to authenticated;
