-- 0043: formations follow the choreography rule – parents only when the child has no own login, is under 13, or the team allows it.
drop policy if exists formation_read on formation_set;
create policy formation_read on formation_set for select using (
  i_am_admin() or i_am_staff_of(team_id) or
  exists (select 1 from membership m where m.team_id = formation_set.team_id and m.person_id = my_person_id()) or
  exists (select 1 from membership m join guardian g on g.child_id = m.person_id join team t on t.id = m.team_id join person c on c.id = m.person_id
          where m.team_id = formation_set.team_id and g.parent_id = my_person_id()
            and (t.parents_see_video or c.user_id is null or (person_age(c) is not null and person_age(c) < 13))));
-- same for choreography videos: a child without own login → the parent sees them
drop policy if exists video_read on video;
create policy video_read on video for select using (
  i_am_staff_of(team_id) or
  exists (select 1 from membership m where m.team_id = video.team_id and m.person_id = my_person_id()) or
  exists (select 1 from membership m join guardian g on g.child_id = m.person_id join team t on t.id = m.team_id join person c on c.id = m.person_id
          where m.team_id = video.team_id and g.parent_id = my_person_id()
            and (t.parents_see_video or c.user_id is null or (person_age(c) is not null and person_age(c) < 13))));
