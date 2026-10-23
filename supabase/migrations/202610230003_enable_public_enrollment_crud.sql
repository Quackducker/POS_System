grant select, insert, update, delete on public.enrollments to anon, authenticated;
grant usage, select on sequence public.enrollments_enrollment_id_seq to anon, authenticated;

drop policy if exists enrollments_select_authenticated on public.enrollments;
drop policy if exists enrollments_select_public on public.enrollments;
create policy enrollments_select_public
  on public.enrollments for select to anon, authenticated using (true);

drop policy if exists enrollments_insert_authenticated on public.enrollments;
drop policy if exists enrollments_insert_public on public.enrollments;
create policy enrollments_insert_public
  on public.enrollments for insert to anon, authenticated with check (true);

drop policy if exists enrollments_update_public on public.enrollments;
create policy enrollments_update_public
  on public.enrollments for update to anon, authenticated
  using (true) with check (true);

drop policy if exists enrollments_delete_public on public.enrollments;
create policy enrollments_delete_public
  on public.enrollments for delete to anon, authenticated using (true);
