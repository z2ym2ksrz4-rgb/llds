-- Two separate profiles per trainer: the PUBLIC one on the website (set by the administrator) and the PERSONAL one in the app
-- (set by the trainer, shown only inside the app). The website no longer falls back to the personal "Om mig" text.
create or replace view public_trainers as
  select p.school_id, p.id, trim(p.first_name || ' ' || coalesce(p.last_name, '')) as name, p.site_title as title,
         nullif(trim(p.site_bio), '') as bio, p.site_photo as photo, coalesce(p.site_sort, 9999) as sort,
         (select string_agg(x.name, ' · ' order by x.sort, x.name) from (select distinct t.name, t.sort from membership m join team t on t.id = m.team_id
            where m.person_id = p.id and m.role in ('trainer', 'assistant') and t.visibility = 'public' and not t.archived and not t.is_test) x) as teaches
  from person p where p.site_show and p.status = 'approved';
grant select on public_trainers to anon, authenticated;
insert into schema_migration(name) values ('0077_public_trainer_profile_only') on conflict do nothing;
