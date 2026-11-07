-- 0025: notes on a choreography video (trainer writes, everyone who sees the video reads). video_view recreated so the new column is exposed.
alter table video add column if not exists notes text;
drop view if exists video_view;
create view video_view with (security_invoker = true) as select v.*, person_name(v.uploader_id) as uploader_name from video v;
grant select on video_view to authenticated;
