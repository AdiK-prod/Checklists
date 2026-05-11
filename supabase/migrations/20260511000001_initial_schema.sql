-- ============================================================
-- Migration 001 — Initial Schema
-- PackSmart trip checklist app
-- ============================================================

-- Households
create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Maps auth users to households (supports invited partners)
create table if not exists household_users (
  household_id uuid references households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member', -- 'owner' | 'member'
  joined_at timestamptz default now(),
  primary key (household_id, user_id)
);

-- Household members (people, not necessarily auth users)
create table if not exists household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  role text not null, -- 'parent' | 'kid'
  age integer,        -- nullable, for kids
  initials text not null,
  avatar_colour jsonb not null, -- { bg: '#E6F1FB', text: '#185FA5' }
  is_user boolean default false,
  user_id uuid references auth.users(id),
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Templates
create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  icon text not null, -- lucide icon name
  is_default boolean default false,
  created_at timestamptz default now()
);

-- Template items
create table if not exists template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references templates(id) on delete cascade,
  label text not null,
  category text not null, -- 'Documents' | 'Clothing' | 'Essentials' | 'Toiletries' | 'Entertainment' | 'Medications' | 'Other'
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Trips
create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  destination text not null,
  template_id uuid references templates(id),
  dates_from date,
  dates_to date,
  weather text,
  trip_type text,
  status text default 'upcoming', -- 'upcoming' | 'completed'
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Maps members to trips (who is travelling)
create table if not exists trip_travellers (
  trip_id uuid references trips(id) on delete cascade,
  member_id uuid references household_members(id) on delete cascade,
  primary key (trip_id, member_id)
);

-- Checklist items (copied from template on trip creation, then independent)
create table if not exists checklist_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  member_id uuid references household_members(id) on delete cascade,
  label text not null,
  category text not null,
  sort_order integer default 0,
  checked boolean default false,
  is_ai_suggested boolean default false,
  is_manually_added boolean default false,
  saved_to_template boolean default false,
  created_at timestamptz default now()
);

-- AI suggestions log
create table if not exists ai_suggestions_log (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  household_id uuid references households(id) on delete cascade,
  prompt_sent text not null,
  response_raw text not null,
  suggestions_accepted integer default 0,
  suggestions_total integer default 0,
  model text default 'claude-haiku-4-5-20251001',
  created_at timestamptz default now()
);

-- ── Indexes ──────────────────────────────────────────────────
create index if not exists idx_checklist_items_trip_id on checklist_items(trip_id);
create index if not exists idx_checklist_items_member_id on checklist_items(member_id);
create index if not exists idx_trips_household_id on trips(household_id);
create index if not exists idx_household_members_household_id on household_members(household_id);
create index if not exists idx_template_items_template_id on template_items(template_id);
create index if not exists idx_ai_suggestions_log_trip_id on ai_suggestions_log(trip_id);
