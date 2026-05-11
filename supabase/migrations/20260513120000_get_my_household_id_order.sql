-- When a user belongs to multiple households, RLS must use the same choice as the app
-- (oldest membership by joined_at). Otherwise trips/templates can belong to one household
-- while AuthContext shows another.

create or replace function get_my_household_id()
returns uuid as $$
  select household_id from household_users
  where user_id = auth.uid()
  order by joined_at asc nulls last
  limit 1;
$$ language sql security definer;
