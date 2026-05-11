-- Prevent silent deletion of checklist rows when a household_member is removed (Postgres default CASCADE on implicit FK).
-- Blueprint: items remain on trips; deletion of member should fail if still referenced.

alter table checklist_items
  drop constraint if exists checklist_items_member_id_fkey;

alter table checklist_items
  add constraint checklist_items_member_id_fkey
  foreign key (member_id) references household_members(id)
  on delete restrict;
