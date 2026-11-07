-- New post in a team room → 'post' notification to the team's members and their parents (not the author). Gives the Hold tab its unread number;
-- people can switch the kind off under Indstillinger → Notifikationer ("post" already exists there).
create or replace function trg_post_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare tn text; an text; recips uuid[];
begin
  if new.hidden then return new; end if;
  select first_name into an from person where id = new.author_id;
  if new.team_id is not null then
    select name into tn from team where id = new.team_id;
    select coalesce(array_agg(distinct x), '{}') into recips from (
      select m.person_id as x from membership m where m.team_id = new.team_id
      union select g.parent_id from membership m join guardian g on g.child_id = m.person_id where m.team_id = new.team_id and m.role = 'dancer'
    ) r where x <> new.author_id;
  else
    select coalesce(array_agg(id), '{}') into recips from person where school_id = new.school_id and status = 'approved' and id <> new.author_id and user_id is not null;
    tn := null;
  end if;
  perform notify(x, 'post', coalesce(an, 'Nyt opslag') || case when new.official then ' (officielt)' else '' end || coalesce(' · ' || tn, ''), left(new.body, 120), jsonb_build_object('post_id', new.id, 'team_id', new.team_id)) from unnest(recips) x;
  return new;
end $$;
drop trigger if exists post_notify on post;
create trigger post_notify after insert on post for each row execute function trg_post_notify();
