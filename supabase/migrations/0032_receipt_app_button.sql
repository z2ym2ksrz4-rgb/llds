-- Receipt mails get an "Åbn appen" button → ilumie.com/llds/hent/ (store badge on phone, browser on desktop, QR when read on a computer).
create or replace function receipt_html(p_school uuid, p_title text, p_name text, p_rows jsonb, p_total text, p_note text)
returns text language sql stable as $$
  select '<div style="background:#0a0a0b;padding:32px 16px;font-family:Outfit,Segoe UI,system-ui,sans-serif;color:#f4f1ea"><div style="max-width:560px;margin:0 auto;background:#121214;border:1px solid rgba(201,162,74,.35);border-radius:18px;padding:28px">'
    || '<div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#c9a24a">' || (select name from school where id = p_school) || '</div>'
    || '<h1 style="font-family:Cormorant Garamond,Georgia,serif;font-weight:400;font-size:30px;margin:8px 0 4px">' || p_title || '</h1>'
    || '<p style="color:#a8a49c;margin:0 0 18px">Hej ' || coalesce(p_name, '') || ' – tak for din betaling. Her er din kvittering.</p>'
    || '<table style="width:100%;border-collapse:collapse;font-size:15px">' || (select string_agg('<tr><td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08);color:#f4f1ea">' || (r->>'label') || '</td><td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08);text-align:right;color:#f4f1ea">' || (r->>'value') || '</td></tr>', '') from jsonb_array_elements(p_rows) r)
    || '<tr><td style="padding:12px 0;font-weight:600;color:#f4f1ea">I alt</td><td style="padding:12px 0;text-align:right;font-weight:600;color:#e6c87a">' || p_total || '</td></tr></table>'
    || coalesce('<p style="color:#a8a49c;font-size:14px;margin:16px 0 0">' || p_note || '</p>', '')
    || '<p style="margin:22px 0 0"><a href="https://ilumie.com/llds/hent/" style="display:inline-block;background:#e6c87a;color:#0a0a0b;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">Åbn appen →</a></p>'
    || '<p style="color:#6f6c66;font-size:12px;margin:10px 0 0">Log ind med denne e-mail – du får en kode på mail. På telefonen hentes appen, på computeren åbner den i browseren.</p>'
    || '<p style="color:#6f6c66;font-size:12px;margin:22px 0 0">Betalt ' || to_char(now() at time zone 'Europe/Copenhagen', 'DD.MM.YYYY HH24:MI') || ' · ' || (select name from school where id = p_school) || ' · Vinkelvej 17, 8860 Ulstrup</p>'
    || '</div></div>'
$$;
