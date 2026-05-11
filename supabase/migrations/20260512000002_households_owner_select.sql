-- Allow owners to read households they own. Without this, INSERT ... RETURNING
-- fails with 403: RLS allows the insert, but SELECT only allowed rows visible via
-- get_my_household_id(), which is empty until household_users is inserted.

create policy "owner can read own household"
  on households
  for select
  using (owner_id = auth.uid());
