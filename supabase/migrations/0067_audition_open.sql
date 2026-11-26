-- 0067: auditions are invisible until the admin opens them for a team.
-- team.audition_open (default false). Everything about audition in the app and on the website keys off this flag;
-- "Start ny runde" opens it, the admin closes it again when the round is over.
alter table team add column if not exists audition_open boolean not null default false;

do $$
declare d text;
begin
  -- public_teams: append the flag (create or replace may add columns at the end)
  d := pg_get_viewdef('public_teams'::regclass);
  if position('audition_open' in d) = 0 then
    d := regexp_replace(d, '\s+FROM team', E',\n    audition_open\n   FROM team');
    if position('audition_open' in d) = 0 then raise exception 'public_teams: FROM not found'; end if;
    execute 'create or replace view public_teams as ' || d;
  end if;

  -- applying requires the audition to be open (app + website)
  d := pg_get_functiondef('apply_audition'::regproc);
  if position('audition closed' in d) = 0 then
    if position('raise exception ''not an audition team''; end if;' in d) = 0 then raise exception 'apply_audition: anchor not found'; end if;
    d := replace(d, 'raise exception ''not an audition team''; end if;', 'raise exception ''not an audition team''; end if;' || E'\n  if not tm.audition_open then raise exception ''audition closed''; end if;');
    execute d;
  end if;
  d := pg_get_functiondef('web_audition'::regproc);
  if position('audition closed' in d) = 0 then
    if position('raise exception ''not an audition team''; end if;' in d) = 0 then raise exception 'web_audition: anchor not found'; end if;
    d := replace(d, 'raise exception ''not an audition team''; end if;', 'raise exception ''not an audition team''; end if;' || E'\n  if not tm.audition_open then raise exception ''audition closed''; end if;');
    execute d;
  end if;

  -- a new round opens the audition
  d := pg_get_functiondef('audition_new_round'::regproc);
  if position('audition_open = true' in d) = 0 then
    if position('signup_open = true where id = p_team' in d) = 0 then raise exception 'audition_new_round: anchor not found'; end if;
    d := replace(d, 'signup_open = true where id = p_team', 'signup_open = true, audition_open = true where id = p_team');
    execute d;
  end if;
end $$;

-- a round that is already running stays visible: teams with candidates in their current round start as open
update team t set audition_open = true
 where t.admission = 'audition' and exists (select 1 from audition_candidate c where c.team_id = t.id and c.round = t.audition_round);
