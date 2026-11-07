-- 0014: image catalogue uploaded by admins (bundled illustrations live in the app; these are the school's own), in folders.
create table if not exists catalog_image (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school(id) on delete cascade,
  folder text not null default 'Egne billeder',
  title text,
  storage_path text not null,            -- bucket "public"
  created_by uuid references person(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists catalog_image_school on catalog_image(school_id, folder, created_at desc);
alter table catalog_image enable row level security;
drop policy if exists catalog_read on catalog_image;
create policy catalog_read on catalog_image for select using (school_id = my_school_id() and i_am_approved());
drop policy if exists catalog_admin on catalog_image;
create policy catalog_admin on catalog_image for all using (school_id = my_school_id() and i_am_admin()) with check (school_id = my_school_id() and i_am_admin());
