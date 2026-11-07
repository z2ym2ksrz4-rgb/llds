-- 0015: staff can order a team folder's images and pick the team's front photo.
alter table media add column if not exists sort int not null default 0;
drop view if exists media_view;
create view media_view with (security_invoker = true) as
  select m.*, person_name(m.uploader_id) as uploader_name from media m;
grant select on media_view to authenticated;
