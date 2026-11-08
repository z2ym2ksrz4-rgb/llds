-- Comments on a trainer's team message (questions, "we'll be 10 min late"). Anyone who can read the message can comment; staff can delete.
create table if not exists message_comment (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references message(id) on delete cascade,
  author_id uuid not null references person(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists message_comment_msg on message_comment(message_id, created_at);
alter table message_comment enable row level security;
drop policy if exists mc_read on message_comment;
create policy mc_read on message_comment for select using (exists (select 1 from message m where m.id = message_id));   -- message RLS decides
drop policy if exists mc_insert on message_comment;
create policy mc_insert on message_comment for insert with check (author_id = my_person_id() and exists (select 1 from message m where m.id = message_id));
drop policy if exists mc_delete on message_comment;
create policy mc_delete on message_comment for delete using (author_id = my_person_id() or i_am_staff());
drop view if exists message_comment_view;
create view message_comment_view with (security_invoker = true) as
  select c.*, p.first_name || ' ' || p.last_name as author_name from message_comment c join person p on p.id = c.author_id;
grant select on message_comment_view to authenticated;
-- notify the message author (trainer) + earlier commenters, not the writer
create or replace function trg_message_comment_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare m message; who uuid;
begin
  select * into m from message where id = new.message_id;
  for who in select distinct x from (select m.author_id as x union select author_id from message_comment where message_id = new.message_id) r where x <> new.author_id loop
    perform notify(who, 'message', person_name(new.author_id) || ' · ' || m.title, left(new.body, 120), jsonb_build_object('message_id', m.id));
  end loop;
  return new;
end $$;
drop trigger if exists message_comment_notify on message_comment;
create trigger message_comment_notify after insert on message_comment for each row execute function trg_message_comment_notify();
-- only admins may post "official" / school-wide posts in the feed (trainers and dancers post to their own team)
drop policy if exists post_insert on post;
create policy post_insert on post for insert with check (
  school_id = my_school_id() and author_id = my_person_id() and i_am_approved()
  and (case when team_id is null or official then i_am_admin() when channel = 'trainers' then i_am_staff() else team_id in (select my_team_ids()) or i_am_admin() end));
