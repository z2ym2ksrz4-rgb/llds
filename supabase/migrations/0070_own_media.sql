-- 0070: the school's pictures no longer live on the old WordPress site – point stored URLs at our own copies.
-- Only the URL prefix changes; the path after wp-content/uploads/ is the same under /llds/media/.
do $$
declare o constant text := 'https://lldancestudio.dk/wp-content/uploads/'; n constant text := 'https://ilumie.com/llds/media/';
begin
  update team set cover_url = replace(cover_url, o, n) where cover_url like o || '%';
  update team set about_url = replace(about_url, o, n) where about_url like o || '%';
  update team set audition_video_url = replace(audition_video_url, o, n) where audition_video_url like o || '%';
  update team set photos = (select array_agg(replace(x, o, n) order by i) from unnest(photos) with ordinality as u(x, i)) where exists (select 1 from unnest(photos) x where x like o || '%');
  update team set gallery = (select array_agg(replace(x, o, n) order by i) from unnest(gallery) with ordinality as u(x, i)) where exists (select 1 from unnest(gallery) x where x like o || '%');
  update product set image_path = replace(image_path, o, n) where image_path like o || '%';
  update event set image_key = replace(image_key, o, n) where image_key like o || '%';
  update school set appearance = replace(appearance::text, o, n)::jsonb where appearance::text like '%' || o || '%';
end $$;
insert into schema_migration(name) values ('0070_own_media') on conflict do nothing;
