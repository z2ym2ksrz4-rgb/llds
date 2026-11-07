-- 0027: reusable extra markers (props, solo spots…) per formation plan, so they can be placed on every frame with one tap.
alter table formation_set add column if not exists markers jsonb not null default '[]'::jsonb;   -- [{key, label, name}]
