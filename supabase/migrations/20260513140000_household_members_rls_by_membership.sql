-- household_members policies used get_my_household_id(), which picks ONE membership.
-- The app may show another household from AuthContext (e.g. ordered by joined_at), so
-- inserts hit WITH CHECK failures.

drop policy if exists "household users can read members" on household_members;
drop policy if exists "household users can manage members" on household_members;

create policy "household users can read members"
  on household_members for select
  using (
    household_id in (
      select household_id from household_users where user_id = auth.uid()
    )
  );

create policy "household users can insert members"
  on household_members for insert
  with check (
    household_id in (
      select household_id from household_users where user_id = auth.uid()
    )
  );

create policy "household users can update members"
  on household_members for update
  using (
    household_id in (
      select household_id from household_users where user_id = auth.uid()
    )
  )
  with check (
    household_id in (
      select household_id from household_users where user_id = auth.uid()
    )
  );

create policy "household users can delete members"
  on household_members for delete
  using (
    household_id in (
      select household_id from household_users where user_id = auth.uid()
    )
  );
