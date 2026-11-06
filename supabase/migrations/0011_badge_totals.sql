-- 0011: training-count emblems: 🏅 50, 💯 100, then every 50 (150, 200 …) created on the fly by award_auto_badges.
update badge set emoji = '🏅', description = '50 registrerede træninger' where key = 'total50';
update badge set emoji = '💯' where key = 'total100';

create or replace function award_auto_badges(p_person uuid) returns void language plpgsql security definer set search_path = public as $$
declare sid uuid; total int; streak int := 0; r record; b record; last_team uuid; n int; bid uuid;
begin
  select school_id into sid from person where id = p_person;
  select count(*) into total from attendance a join session s on s.id = a.session_id where a.person_id = p_person and a.present;
  for r in select a.present, exists (select 1 from absence ab where ab.session_id = s.id and ab.person_id = p_person) as absent, s.team_id
           from attendance a join session s on s.id = a.session_id where a.person_id = p_person order by s.starts_at desc loop
    if r.present and not r.absent then streak := streak + 1; if last_team is null then last_team := r.team_id; end if; else exit; end if;
  end loop;
  -- streak emblems from the catalogue
  for b in select * from badge where school_id = sid and kind = 'auto' and active and rule ? 'streak' loop
    if streak >= (b.rule->>'streak')::int then insert into person_badge(person_id, badge_id, team_id) values (p_person, b.id, last_team) on conflict do nothing; end if;
  end loop;
  -- training-count emblems: every 50, catalogue rows created as needed
  n := 50;
  while n <= total loop
    insert into badge(school_id, key, name, emoji, description, kind, rule, sort)
      values (sid, 'total' || n, n || ' træninger', case when n = 50 then '🏅' when n = 100 then '💯' else '🥇' end, n || ' registrerede træninger', 'auto', jsonb_build_object('total', n), 2 + n / 50)
      on conflict (school_id, key) do nothing;
    select id into bid from badge where school_id = sid and key = 'total' || n;
    insert into person_badge(person_id, badge_id, team_id) values (p_person, bid, last_team) on conflict do nothing;
    n := n + 50;
  end loop;
end $$;
