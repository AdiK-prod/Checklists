-- ============================================================
-- Migration 002 — Row Level Security Policies
-- PackSmart trip checklist app
-- ============================================================

-- ── Enable RLS on all tables ─────────────────────────────────
alter table households enable row level security;
alter table household_users enable row level security;
alter table household_members enable row level security;
alter table templates enable row level security;
alter table template_items enable row level security;
alter table trips enable row level security;
alter table trip_travellers enable row level security;
alter table checklist_items enable row level security;
alter table ai_suggestions_log enable row level security;

-- ── Helper function ──────────────────────────────────────────
-- Returns the household_id for the currently authenticated user.
-- security definer so it can query household_users without RLS recursion.
create or replace function get_my_household_id()
returns uuid as $$
  select household_id from household_users
  where user_id = auth.uid()
  limit 1;
$$ language sql security definer;

-- ── Households ───────────────────────────────────────────────
create policy "household members can read"
  on households for select
  using (id = get_my_household_id());

create policy "owner can update household"
  on households for update
  using (owner_id = auth.uid());

create policy "authenticated user can insert household"
  on households for insert
  with check (owner_id = auth.uid());

-- ── Household users ──────────────────────────────────────────
create policy "user can read own household_users row"
  on household_users for select
  using (user_id = auth.uid() or household_id = get_my_household_id());

create policy "user can insert own household_users row"
  on household_users for insert
  with check (user_id = auth.uid());

-- ── Household members ────────────────────────────────────────
create policy "household users can read members"
  on household_members for select
  using (household_id = get_my_household_id());

create policy "household users can manage members"
  on household_members for all
  using (household_id = get_my_household_id());

-- ── Templates ────────────────────────────────────────────────
create policy "household users can manage templates"
  on templates for all
  using (household_id = get_my_household_id());

-- ── Template items ───────────────────────────────────────────
create policy "household users can manage template items"
  on template_items for all
  using (
    template_id in (
      select id from templates where household_id = get_my_household_id()
    )
  );

-- ── Trips ────────────────────────────────────────────────────
create policy "household users can manage trips"
  on trips for all
  using (household_id = get_my_household_id());

-- ── Trip travellers ──────────────────────────────────────────
create policy "household users can manage trip travellers"
  on trip_travellers for all
  using (
    trip_id in (
      select id from trips where household_id = get_my_household_id()
    )
  );

-- ── Checklist items ──────────────────────────────────────────
create policy "household users can manage checklist items"
  on checklist_items for all
  using (
    trip_id in (
      select id from trips where household_id = get_my_household_id()
    )
  );

-- ── AI suggestions log ───────────────────────────────────────
create policy "household users can read suggestions log"
  on ai_suggestions_log for select
  using (household_id = get_my_household_id());

create policy "household users can insert suggestions log"
  on ai_suggestions_log for insert
  with check (household_id = get_my_household_id());
