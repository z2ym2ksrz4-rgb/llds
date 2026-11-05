-- Native push: device tokens per person + delivery marker on notifications. The edge function supabase/functions/push sends.
create table if not exists push_token (
  token text primary key,
  person_id uuid not null references person(id) on delete cascade,
  platform text not null,           -- ios | android | web
  updated_at timestamptz not null default now()
);
create index if not exists push_token_person on push_token(person_id);
alter table push_token enable row level security;
create policy push_token_own on push_token for all using (person_id = my_person_id()) with check (person_id = my_person_id());

alter table notification add column if not exists pushed_at timestamptz;
create index if not exists notification_unpushed on notification(created_at) where pushed_at is null;

-- the edge function runs with the service role; it reads unpushed notifications + tokens and marks them pushed.
