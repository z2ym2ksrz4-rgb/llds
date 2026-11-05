-- Phase 3: team rooms (posts/comments/reports), official messages with receipts, folders + media, choreography videos, trainer notes.

-- ---------------------------------------------------------------- tenant fix for the phase-2 views
-- Views run as their owner and bypass RLS, so they must filter on the caller's school themselves.
create or replace view session_view as
  select s.*, t.name as team_name, r.name as room_name,
         tr.first_name || ' ' || tr.last_name as trainer_name,
         su.first_name || ' ' || su.last_name as substitute_name
  from session s left join team t on t.id = s.team_id left join room r on r.id = s.room_id
  left join person tr on tr.id = s.trainer_id left join person su on su.id = s.substitute_id
  where s.school_id = my_school_id() and i_am_approved();

create or replace view booking_view as
  select b.*, r.name as room_name, p.first_name || ' ' || p.last_name as person_name
  from booking b join room r on r.id = b.room_id join person p on p.id = b.person_id
  where b.school_id = my_school_id() and i_am_approved();

-- name of any person in my school (for authors/uploaders without exposing the person row)
create or replace function person_name(p uuid) returns text
language sql stable security definer set search_path = public as $$
  select first_name || ' ' || last_name from person where id = p and school_id = my_school_id()
$$;

-- ---------------------------------------------------------------- posts & comments (RLS of the base tables applies: security_invoker)
create or replace view post_view with (security_invoker = true) as
  select p.*, person_name(p.author_id) as author_name, (select name from team t where t.id = p.team_id) as team_name,
         (select count(*) from comment c where c.post_id = p.id and not c.hidden) as comment_count
  from post p;
grant select on post_view to authenticated;

create or replace view comment_view with (security_invoker = true) as
  select c.*, person_name(c.author_id) as author_name from comment c;
grant select on comment_view to authenticated;

-- admin moderation queue: the reported text, who reported, where
create or replace view report_view with (security_invoker = true) as
  select r.*, person_name(r.reporter_id) as reporter_name,
         coalesce(p.body, c.body) as excerpt,
         coalesce(p.author_id, c.author_id) as author_id, person_name(coalesce(p.author_id, c.author_id)) as author_name,
         coalesce(p.team_id, (select team_id from post pp where pp.id = c.post_id)) as team_id,
         coalesce(p.hidden, c.hidden) as hidden
  from report r left join post p on p.id = r.post_id left join comment c on c.id = r.comment_id;
grant select on report_view to authenticated;

-- the reporter may read their own reports (so the UI can show "anmeldt")
create policy report_own on report for select using (reporter_id = my_person_id());

-- ---------------------------------------------------------------- official messages
create or replace view message_view with (security_invoker = true) as
  select m.*, person_name(m.author_id) as author_name,
         (select acted_at from message_receipt r where r.message_id = m.id and r.person_id = my_person_id()) as acted_at
  from message m;
grant select on message_view to authenticated;

-- who should act on a message, and whether they did (staff only)
create or replace function message_status(p_message uuid)
returns table (person_id uuid, name text, acted_at timestamptz)
language sql stable security definer set search_path = public as $$
  with m as (select * from message where id = p_message and school_id = my_school_id()),
  recipients as (
    select p.id from person p, m
    where p.school_id = m.school_id and p.status = 'approved' and p.user_id is not null
      and ((m.audience->>'all')::boolean is true
           or exists (select 1 from membership mm where mm.person_id = p.id and mm.team_id::text in (select jsonb_array_elements_text(coalesce(m.audience->'teams','[]'::jsonb))))
           or exists (select 1 from guardian g join membership mm on mm.person_id = g.child_id where g.parent_id = p.id and mm.team_id::text in (select jsonb_array_elements_text(coalesce(m.audience->'teams','[]'::jsonb)))))
  )
  select p.id, p.first_name || ' ' || p.last_name, r.acted_at
  from recipients x join person p on p.id = x.id left join message_receipt r on r.message_id = p_message and r.person_id = p.id
  where i_am_staff()
  order by r.acted_at nulls first, p.first_name
$$;

-- ---------------------------------------------------------------- folders, media, videos, notes
create or replace view folder_view with (security_invoker = true) as
  select f.*, (select count(*) from media m where m.folder_id = f.id) as media_count,
         (select storage_path from media m where m.folder_id = f.id and m.kind = 'image' order by m.created_at desc limit 1) as cover_path
  from folder f;
grant select on folder_view to authenticated;

create or replace view media_view with (security_invoker = true) as
  select m.*, person_name(m.uploader_id) as uploader_name from media m;
grant select on media_view to authenticated;

create or replace view video_view with (security_invoker = true) as
  select v.*, person_name(v.uploader_id) as uploader_name from video v;
grant select on video_view to authenticated;

create or replace view note_view with (security_invoker = true) as
  select n.*, person_name(n.author_id) as author_name, person_name(n.dancer_id) as dancer_name from note n;
grant select on note_view to authenticated;

-- trainer notes are private to the team's staff (dancers/parents never see them)
drop policy if exists note_read on note;
create policy note_read on note for select using (i_am_staff_of(team_id));

-- storage: videos live at <school>/videos/<team_id>/<file>; readable exactly when the video row is readable (video RLS)
create policy video_bucket_read on storage.objects for select using (
  bucket_id = 'media' and split_part(name,'/',2) = 'videos' and exists (select 1 from video v where v.storage_path = name));
create policy video_bucket_write on storage.objects for insert with check (
  bucket_id = 'media' and split_part(name,'/',2) = 'videos' and i_am_staff_of(split_part(name,'/',3)::uuid));
