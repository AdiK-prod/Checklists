-- Add archived column to templates
alter table templates add column if not exists archived boolean not null default false;
create index if not exists idx_templates_archived on templates(archived);
