-- 0021: direct conversations ("Skriv til træneren"): a dancer/parent writes to any combination of the team's trainer(s), assistant(s) and the admin (Line);
-- participants reply in the thread. Plus team_staff(p_team) so non-staff can pick recipients.
create table if not exists thread (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school(id) on delete cascade,
  team_id uuid references team(id) on delete set null,
  subject text not null,
  created_by uuid not null references person(id),
  participants uuid[] not null,            -- everyone in the conversation incl. creator
  created_at timestamptz not null default now(),
  last_at timestamptz not null default now()
);
create table if not exists thread_message (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references thread(id) on delete cascade,
  sender_id uuid not null references person(id),
  body text not null,
  created_at timestamptz not null default now()
);
create table if not exists thread_read (
  thread_id uuid not null references thread(id) on delete cascade,
  person_id uuid not null references person(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (thread_id, person_id)
);
create index if not exists thread_participants_idx on thread using gin (participants);
create index if not exists thread_message_thread_idx on thread_message(thread_id, created_at);
alter table thread enable row level security; alter table thread_message enable row level security; alter table thread_read enable row level security;

create policy thread_read_p on thread for select using (school_id = my_school_id() and my_person_id() = any(participants));
create policy thread_insert_p on thread for insert with check (school_id = my_school_id() and i_am_approved() and created_by = my_person_id() and my_person_id() = any(participants));
create policy thread_msg_read on thread_message for select using (exists (select 1 from thread t where t.id = thread_id and my_person_id() = any(t.participants)));
create policy thread_msg_insert on thread_message for insert with check (sender_id = my_person_id() and exists (select 1 from thread t where t.id = thread_id and my_person_id() = any(t.participants)));
create policy thread_read_rw on thread_read for all using (person_id = my_person_id()) with check (person_id = my_person_id());

-- new message: bump last_at + notify the other participants (respects notify_prefs via notify())
create or replace function trg_thread_message() returns trigger language plpgsql security definer set search_path = public as $$
declare th thread; pid uuid; begin
  select * into th from thread where id = new.thread_id;
  update thread set last_at = new.created_at where id = th.id;
  insert into thread_read(thread_id, person_id, read_at) values (th.id, new.sender_id, new.created_at) on conflict (thread_id, person_id) do update set read_at = excluded.read_at;
  foreach pid in array th.participants loop
    if pid <> new.sender_id then perform notify(pid, 'message', person_name(new.sender_id) || ': ' || th.subject, left(new.body, 120), jsonb_build_object('thread_id', th.id)); end if;
  end loop;
  return new;
end $$;
drop trigger if exists thread_message_notify on thread_message;
create trigger thread_message_notify after insert on thread_message for each row execute function trg_thread_message();

-- list for the inbox: participants' names, last message, unread flag
create or replace view thread_view with (security_invoker = true) as
  select t.*, person_name(t.created_by) as created_by_name,
         (select array_agg(person_name(p) order by person_name(p)) from unnest(t.participants) p) as participant_names,
         (select body from thread_message m where m.thread_id = t.id order by created_at desc limit 1) as last_body,
         (select person_name(sender_id) from thread_message m where m.thread_id = t.id order by created_at desc limit 1) as last_sender_name,
         (select count(*) from thread_message m where m.thread_id = t.id) as message_count,
         coalesce((select r.read_at from thread_read r where r.thread_id = t.id and r.person_id = my_person_id()), 'epoch'::timestamptz) < t.last_at as unread
  from thread t;
grant select on thread_view to authenticated;
create or replace view thread_message_view with (security_invoker = true) as
  select m.*, person_name(m.sender_id) as sender_name from thread_message m;
grant select on thread_message_view to authenticated;

-- who can a member write to on this team: trainers + assistants of the team, and the admins
create or replace function team_staff(p_team uuid)
returns table (person_id uuid, name text, role text, is_admin boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.first_name || ' ' || p.last_name, m.role::text, p.is_admin
  from membership m join person p on p.id = m.person_id
  where m.team_id = p_team and m.role in ('trainer','assistant') and p.status = 'approved' and p.school_id = my_school_id() and i_am_approved()
  union
  select p.id, p.first_name || ' ' || p.last_name, 'admin', true
  from person p where p.school_id = my_school_id() and p.is_admin and p.status = 'approved' and i_am_approved()
  order by 3, 2
$$;
grant execute on function team_staff(uuid) to authenticated;
