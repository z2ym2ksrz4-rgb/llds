-- 0061: one place for the school's website URL. Mails and links read school.settings.site_url instead of a hard-coded
-- ilumie.com/llds – so moving the site to the school's own domain is one update here + app.config.json.
create or replace function school_site_url(p_school uuid) returns text language sql stable as $$
  select rtrim(coalesce(settings->>'site_url', 'https://ilumie.com/llds/'), '/') || '/' from school where id = p_school
$$;
update school set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('site_url', 'https://ilumie.com/llds/') where settings->>'site_url' is null;

create or replace function app_mail_html(p_school uuid, p_title text, p_name text, p_body text)
returns text language sql stable as $$
  select '<div style="background:#0a0a0b;padding:32px 16px;font-family:Outfit,Segoe UI,system-ui,sans-serif;color:#f4f1ea"><div style="max-width:560px;margin:0 auto;background:#121214;border:1px solid rgba(201,162,74,.35);border-radius:18px;padding:28px">'
    || '<div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#c9a24a">' || (select name from school where id = p_school) || '</div>'
    || '<h1 style="font-family:Cormorant Garamond,Georgia,serif;font-weight:400;font-size:30px;margin:8px 0 4px">' || p_title || '</h1>'
    || '<p style="color:#a8a49c;margin:0 0 18px">Hej ' || coalesce(p_name, '') || '</p>'
    || '<div style="font-size:15px;line-height:1.55">' || p_body || '</div>'
    || '<p style="margin:24px 0 0"><a href="' || school_site_url(p_school) || 'hent/" style="display:inline-block;background:#e6c87a;color:#0a0a0b;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">Åbn appen →</a></p>'
    || '<p style="color:#6f6c66;font-size:12px;margin:10px 0 0">Log ind med denne e-mail – du får en kode (eller et link) på mail. På telefonen hentes appen, på computeren åbner den i browseren.</p>'
    || '<p style="color:#6f6c66;font-size:12px;margin:22px 0 0">' || (select name from school where id = p_school) || ' · Vinkelvej 17, 8860 Ulstrup</p>'
    || '</div></div>'
$$;

create or replace function receipt_html(p_school uuid, p_title text, p_name text, p_rows jsonb, p_total text, p_note text)
returns text language sql stable as $$
  select '<div style="background:#0a0a0b;padding:32px 16px;font-family:Outfit,Segoe UI,system-ui,sans-serif;color:#f4f1ea"><div style="max-width:560px;margin:0 auto;background:#121214;border:1px solid rgba(201,162,74,.35);border-radius:18px;padding:28px">'
    || '<div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#c9a24a">' || (select name from school where id = p_school) || '</div>'
    || '<h1 style="font-family:Cormorant Garamond,Georgia,serif;font-weight:400;font-size:30px;margin:8px 0 4px">' || p_title || '</h1>'
    || '<p style="color:#a8a49c;margin:0 0 18px">Hej ' || coalesce(p_name, '') || ' – tak for din betaling. Her er din kvittering.</p>'
    || '<table style="width:100%;border-collapse:collapse;font-size:15px">' || (select string_agg('<tr><td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08);color:#f4f1ea">' || (r->>'label') || '</td><td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08);text-align:right;color:#f4f1ea">' || (r->>'value') || '</td></tr>', '') from jsonb_array_elements(p_rows) r)
    || '<tr><td style="padding:12px 0;font-weight:600;color:#f4f1ea">I alt</td><td style="padding:12px 0;text-align:right;font-weight:600;color:#e6c87a">' || p_total || '</td></tr></table>'
    || coalesce('<p style="color:#a8a49c;font-size:14px;margin:16px 0 0">' || p_note || '</p>', '')
    || '<p style="margin:22px 0 0"><a href="' || school_site_url(p_school) || 'hent/" style="display:inline-block;background:#e6c87a;color:#0a0a0b;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">Åbn appen →</a></p>'
    || '<p style="color:#6f6c66;font-size:12px;margin:10px 0 0">Log ind med denne e-mail – du får en kode på mail. På telefonen hentes appen, på computeren åbner den i browseren.</p>'
    || '<p style="color:#6f6c66;font-size:12px;margin:22px 0 0">Betalt ' || to_char(now() at time zone 'Europe/Copenhagen', 'DD.MM.YYYY HH24:MI') || ' · ' || (select name from school where id = p_school) || ' · Vinkelvej 17, 8860 Ulstrup</p>'
    || '</div></div>'
$$;

select 'chk' as chk, school_site_url(id) as url from school limit 1;
