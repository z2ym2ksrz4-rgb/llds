-- 0012: training-count emblems after 100 are gold medals (🥇 150, 200 …), not another 💯.
update badge set emoji = '🥇' where key like 'total%' and key not in ('total50', 'total100');
