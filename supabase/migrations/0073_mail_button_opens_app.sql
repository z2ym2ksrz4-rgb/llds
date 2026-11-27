-- "Åbn appen" in e-mails went to the website's Backstage page even when the app was installed.
-- It now points at an address the installed app owns (…/app/open/): the phone opens the app; without the app the page sends phones on to Backstage and computers to the app in the browser.
do $$
declare f text; src text;
begin
  foreach f in array array['app_mail_html', 'receipt_html'] loop
    select pg_get_functiondef(p.oid) into src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = f;
    if src is null or position('|| ''hent/"' in src) = 0 then raise exception 'anchor missing in %', f; end if;
    execute replace(src, '|| ''hent/"', '|| ''app/open/"');
  end loop;
end $$;
insert into schema_migration(name) values ('0073_mail_button_opens_app') on conflict do nothing;
