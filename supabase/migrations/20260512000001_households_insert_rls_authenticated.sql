-- Household insert: explicit authenticated + stable auth.uid() check.

drop policy if exists "authenticated user can insert household" on households;

create policy "authenticated user can insert household"
  on households
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);
