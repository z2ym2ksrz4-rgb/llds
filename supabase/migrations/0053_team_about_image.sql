-- 0053: admin chooses both pictures on the team page explicitly – the hero (cover_url) and the one under "Om holdet" (about_url).
alter table team add column if not exists about_url text;
comment on column team.about_url is 'image shown under the team description; catalogue ref (art/catalog/…) or http URL; null = automatic';
