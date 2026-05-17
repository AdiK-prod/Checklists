create table if not exists user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  household_id uuid references households(id) on delete set null,
  category text not null check (category in ('bug', 'feature', 'general')),
  message text not null,
  app_version text,
  created_at timestamptz default now()
);

alter table user_feedback enable row level security;

create policy "users can submit feedback"
  on user_feedback for insert
  with check (user_id = auth.uid());
