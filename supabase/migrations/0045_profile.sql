-- 0045: profile picture + "about me" on person; parents edit their children's; avatars live in the private media bucket under <school>/avatars/<person>/.
alter table person add column if not exists photo_path text;
alter table person add column if not exists bio text;

-- parents may update profile fields of children without own login (photo, bio, phone) – never admin/status
drop policy if exists person_parent_update on person;
create policy person_parent_update on person for update
  using (id in (select child_id from guardian where parent_id = my_person_id()))
  with check (id in (select child_id from guardian where parent_id = my_person_id()) and is_admin = (select is_admin from person p where p.id = person.id) and status = (select status from person p where p.id = person.id));

drop policy if exists media_bucket_read on storage.objects;
create policy media_bucket_read on storage.objects for select using (
  bucket_id = 'media' and i_am_approved() and (
    i_am_admin() or
    (split_part(name,'/',2) = 'avatars' and split_part(name,'/',1) = my_school_id()::text) or
    (split_part(name,'/',2) = 'teams' and (split_part(name,'/',3)::uuid in (select my_team_ids()) or i_am_staff_of(split_part(name,'/',3)::uuid))) or
    (split_part(name,'/',2) = 'folders' and exists (select 1 from folder f where f.id = split_part(name,'/',3)::uuid and ((f.team_id in (select my_team_ids()) and not f.staff_only) or i_am_staff_of(f.team_id))))));
drop policy if exists media_bucket_write on storage.objects;
create policy media_bucket_write on storage.objects for insert with check (
  bucket_id = 'media' and i_am_approved() and (select supervised_by from person where id = my_person_id()) is null and (
    i_am_admin() or
    (split_part(name,'/',2) = 'avatars' and split_part(name,'/',3)::uuid in (select my_people())) or
    (split_part(name,'/',2) = 'folders' and exists (select 1 from folder f where f.id = split_part(name,'/',3)::uuid and (f.team_id in (select my_team_ids()) or i_am_staff_of(f.team_id))))));
