-- 0028: how a team admits dancers – shown as badges on the website and in the app. Set by admin when editing a team.
alter table team add column if not exists admission text not null default 'open' check (admission in ('open','tryout','audition'));
alter table team add column if not exists admission_note text;
update team set admission = 'audition' where closed and admission = 'open';
update team set admission = 'tryout', admission_note = 'Ingen audition, men 4 prøvegange hvor træneren vurderer niveau' where name in ('Control', 'Sky Stars') and admission = 'open';
drop view if exists public_teams;
create view public_teams as select school_id, id, name, admission, admission_note, closed, punch_card_open from team where visibility = 'public' and not archived;
grant select on public_teams to anon, authenticated;
