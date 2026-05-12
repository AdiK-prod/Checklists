-- Hierarchical templates & checklists (sections → subcategories → items)
-- Destructive: drops flat checklist/template item tables and truncates trips.

truncate table trips cascade;

drop table if exists checklist_items cascade;
drop table if exists trip_travellers cascade;
drop table if exists template_items cascade;

drop function if exists public.seed_default_templates(uuid);

-- Sections on a template: either a shared category or a named family member
create table template_sections (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references templates(id) on delete cascade,
  section_type text not null check (section_type in ('shared', 'person')),
  name text not null,
  member_id uuid references household_members(id) on delete set null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table template_subcategories (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references template_sections(id) on delete cascade,
  name text not null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table template_items (
  id uuid primary key default gen_random_uuid(),
  subcategory_id uuid references template_subcategories(id) on delete cascade,
  label text not null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table trip_travellers (
  trip_id uuid references trips(id) on delete cascade,
  member_id uuid references household_members(id) on delete cascade,
  primary key (trip_id, member_id)
);

create table checklist_sections (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  section_type text not null check (section_type in ('shared', 'person')),
  name text not null,
  member_id uuid references household_members(id) on delete set null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table checklist_subcategories (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references checklist_sections(id) on delete cascade,
  name text not null,
  sort_order integer default 0,
  is_manually_added boolean default false,
  created_at timestamptz default now()
);

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  subcategory_id uuid references checklist_subcategories(id) on delete cascade,
  label text not null,
  sort_order integer default 0,
  checked boolean default false,
  is_ai_suggested boolean default false,
  is_manually_added boolean default false,
  saved_to_template boolean default false,
  created_at timestamptz default now()
);

create index idx_template_sections_template_id
  on template_sections(template_id);
create index idx_template_subcategories_section_id
  on template_subcategories(section_id);
create index idx_template_items_subcategory_id
  on template_items(subcategory_id);
create index idx_checklist_sections_trip_id
  on checklist_sections(trip_id);
create index idx_checklist_subcategories_section_id
  on checklist_subcategories(section_id);
create index idx_checklist_items_subcategory_id
  on checklist_items(subcategory_id);

alter table template_sections enable row level security;
alter table template_subcategories enable row level security;
alter table template_items enable row level security;
alter table checklist_sections enable row level security;
alter table checklist_subcategories enable row level security;
alter table checklist_items enable row level security;

create policy "household users can manage template sections"
  on template_sections for all
  using (
    template_id in (
      select id from templates where household_id = get_my_household_id()
    )
  )
  with check (
    template_id in (
      select id from templates where household_id = get_my_household_id()
    )
  );

create policy "household users can manage template subcategories"
  on template_subcategories for all
  using (
    section_id in (
      select ts.id from template_sections ts
      join templates t on t.id = ts.template_id
      where t.household_id = get_my_household_id()
    )
  )
  with check (
    section_id in (
      select ts.id from template_sections ts
      join templates t on t.id = ts.template_id
      where t.household_id = get_my_household_id()
    )
  );

create policy "household users can manage template items"
  on template_items for all
  using (
    subcategory_id in (
      select tsc.id from template_subcategories tsc
      join template_sections ts on ts.id = tsc.section_id
      join templates t on t.id = ts.template_id
      where t.household_id = get_my_household_id()
    )
  )
  with check (
    subcategory_id in (
      select tsc.id from template_subcategories tsc
      join template_sections ts on ts.id = tsc.section_id
      join templates t on t.id = ts.template_id
      where t.household_id = get_my_household_id()
    )
  );

create policy "household users can manage checklist sections"
  on checklist_sections for all
  using (
    trip_id in (
      select id from trips where household_id = get_my_household_id()
    )
  )
  with check (
    trip_id in (
      select id from trips where household_id = get_my_household_id()
    )
  );

create policy "household users can manage checklist subcategories"
  on checklist_subcategories for all
  using (
    section_id in (
      select cs.id from checklist_sections cs
      join trips t on t.id = cs.trip_id
      where t.household_id = get_my_household_id()
    )
  )
  with check (
    section_id in (
      select cs.id from checklist_sections cs
      join trips t on t.id = cs.trip_id
      where t.household_id = get_my_household_id()
    )
  );

create policy "household users can manage checklist items"
  on checklist_items for all
  using (
    subcategory_id in (
      select csc.id from checklist_subcategories csc
      join checklist_sections cs on cs.id = csc.section_id
      join trips t on t.id = cs.trip_id
      where t.household_id = get_my_household_id()
    )
  )
  with check (
    subcategory_id in (
      select csc.id from checklist_subcategories csc
      join checklist_sections cs on cs.id = csc.section_id
      join trips t on t.id = cs.trip_id
      where t.household_id = get_my_household_id()
    )
  );
