-- 0009: emblems (badges). Catalogue per school + awards per person. Auto emblems from attendance (trigger), manual from trainers.
-- Keys mirror src/domain/llds/lib/badges.ts.
create table if not exists badge (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school(id) on delete cascade,
  key text not null,
  name text not null,
  emoji text not null,
  description text,
  kind text not null default 'manual',          -- auto | manual
  monthly boolean not null default false,       -- manual: once per month per dancer
  rule jsonb not null default '{}'::jsonb,      -- auto: {"streak":10} | {"total":50}
  sort int not null default 0,
  active boolean not null default true,
  unique (school_id, key)
);
create table if not exists person_badge (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references person(id) on delete cascade,
  badge_id uuid not null references badge(id) on delete cascade,
  team_id uuid references team(id) on delete set null,
  period text,                                  -- 'YYYY-MM' for monthly emblems, null otherwise
  note text,
  given_by uuid references person(id) on delete set null,
  created_at timestamptz not null default now(),
  unique nulls not distinct (person_id, badge_id, period)
);
create index if not exists person_badge_person on person_badge(person_id);
create index if not exists person_badge_team on person_badge(team_id, created_at desc);

alter table badge enable row level security;
alter table person_badge enable row level security;
drop policy if exists badge_read on badge;
create policy badge_read on badge for select using (school_id = my_school_id() and i_am_approved());
drop policy if exists badge_admin on badge;
create policy badge_admin on badge for all using (school_id = my_school_id() and i_am_admin());
drop policy if exists person_badge_read on person_badge;
create policy person_badge_read on person_badge for select using (
  exists (select 1 from person p where p.id = person_badge.person_id and p.school_id = my_school_id()) and i_am_approved());
drop policy if exists person_badge_write on person_badge;
create policy person_badge_write on person_badge for insert with check (i_am_admin() or (team_id is not null and i_am_staff_of(team_id)));
drop policy if exists person_badge_delete on person_badge;
create policy person_badge_delete on person_badge for delete using (i_am_admin() or (team_id is not null and i_am_staff_of(team_id)));

drop view if exists person_badge_view;
create view person_badge_view with (security_invoker = true) as
  select pb.id, pb.person_id, p.first_name || ' ' || p.last_name as person_name, b.key, b.name, b.emoji, b.description, b.kind,
         pb.team_id, t.name as team_name, pb.period, pb.note, g.first_name || ' ' || g.last_name as given_by_name, pb.created_at
  from person_badge pb join badge b on b.id = pb.badge_id join person p on p.id = pb.person_id
  left join team t on t.id = pb.team_id left join person g on g.id = pb.given_by;
grant select on person_badge_view to authenticated;

-- catalogue
with s as (select id from school where slug = 'llds')
insert into badge(school_id, key, name, emoji, description, kind, monthly, rule, sort)
select s.id, v.key, v.name, v.emoji, v.description, v.kind, v.monthly, v.rule::jsonb, v.sort from s, (values
  ('streak10',  '10 i træk',              '🔥', '10 træninger i træk uden fravær',            'auto',   false, '{"streak":10}', 1),
  ('streak25',  '25 i træk',              '⚡', '25 træninger i træk uden fravær',            'auto',   false, '{"streak":25}', 2),
  ('total50',   '50 træninger',           '💯', '50 registrerede træninger i sæsonen',         'auto',   false, '{"total":50}',  3),
  ('total100',  '100 træninger',          '🏅', '100 registrerede træninger',                  'auto',   false, '{"total":100}', 4),
  ('teammate',  'Månedens holdkammerat',  '🤝', 'Valgt af træneren – for at løfte holdet',     'manual', true,  '{}', 10),
  ('fighter',   'Fighter',                '💪', 'Blev ved, da det var svært',                  'manual', false, '{}', 11),
  ('smile',     'Smilet',                 '😊', 'Spredte godt humør på holdet',                'manual', false, '{}', 12),
  ('helper',    'Hjælpsom',               '🫶', 'Hjalp en holdkammerat videre',                'manual', false, '{}', 13),
  ('star',      'Scenestjerne',           '🌟', 'Strålede på scenen',                          'manual', false, '{}', 14),
  ('firstcomp', 'Første konkurrence',     '🏆', 'Første stævne gennemført',                    'manual', false, '{}', 15),
  ('firstshow', 'Første show',            '🎭', 'Første show gennemført',                      'manual', false, '{}', 16),
  ('yearbest',  'Årets danser',           '⭐', 'Sæsonens danser på holdet',                   'manual', false, '{}', 17)
) as v(key, name, emoji, description, kind, monthly, rule, sort)
on conflict (school_id, key) do update set name = excluded.name, emoji = excluded.emoji, description = excluded.description, rule = excluded.rule, sort = excluded.sort;

-- auto emblems: streak of consecutive registered trainings present (an absence or "not present" breaks it), total present this season
create or replace function award_auto_badges(p_person uuid) returns void language plpgsql security definer set search_path = public as $$
declare sid uuid; total int; streak int := 0; r record; b record; last_team uuid;
begin
  select school_id into sid from person where id = p_person;
  select count(*) into total from attendance a join session s on s.id = a.session_id where a.person_id = p_person and a.present and s.starts_at >= date_trunc('year', now()) - interval '5 months';
  for r in select a.present, exists (select 1 from absence ab where ab.session_id = s.id and ab.person_id = p_person) as absent, s.team_id
           from attendance a join session s on s.id = a.session_id where a.person_id = p_person order by s.starts_at desc loop
    if r.present and not r.absent then streak := streak + 1; if last_team is null then last_team := r.team_id; end if; else exit; end if;
  end loop;
  for b in select * from badge where school_id = sid and kind = 'auto' and active loop
    if (b.rule ? 'streak' and streak >= (b.rule->>'streak')::int) or (b.rule ? 'total' and total >= (b.rule->>'total')::int) then
      insert into person_badge(person_id, badge_id, team_id) values (p_person, b.id, last_team) on conflict do nothing;
    end if;
  end loop;
end $$;

create or replace function trg_attendance_badges() returns trigger language plpgsql security definer set search_path = public as $$
begin perform award_auto_badges(new.person_id); return new; end $$;
drop trigger if exists attendance_badges on attendance;
create trigger attendance_badges after insert or update on attendance for each row execute function trg_attendance_badges();

-- new emblem → dancer + parents get a notification
create or replace function trg_badge_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare r record; b record;
begin
  select * into b from badge where id = new.badge_id;
  for r in select p.id from person p where p.id = new.person_id union select g.parent_id from guardian g where g.child_id = new.person_id loop
    perform notify(r.id, 'badge', 'Nyt emblem ' || b.emoji, b.name || coalesce(' – ' || new.note, ''), jsonb_build_object('badge_id', new.id));
  end loop;
  return new;
end $$;
drop trigger if exists badge_notify on person_badge;
create trigger badge_notify after insert on person_badge for each row execute function trg_badge_notify();
