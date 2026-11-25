-- 0066: a sign-up that costs money is a *registration* until the payment is confirmed.
-- Mails say "Registrering modtaget" first and "Tilmelding bekræftet" when the school has confirmed the payment.
-- Only wording changes: each function is re-created from its current definition with the texts swapped (fails loudly if a text is not found).
do $$
declare d text;
  procedure_missing constant text := 'wording not found in ';
begin
  -- team sign-up (app / website / audition)
  d := pg_get_functiondef('trg_web_signup_mail'::regproc);
  if position('''Tilmelding modtaget: ''' in d) = 0 or position('Vi har modtaget tilmeldingen til ' in d) = 0 then raise exception '%', procedure_missing || 'trg_web_signup_mail'; end if;
  d := replace(d, '''Tilmelding modtaget: ''', '''Registrering modtaget: ''');
  d := replace(d, 'Vi har modtaget tilmeldingen til ', 'Tak for din registrering til ');
  d := replace(d, '– pladsen er klar, når betalingen er registreret.', '– du er først tilmeldt, når betalingen er bekræftet. Så får du en bekræftelse på tilmeldingen.');
  execute d;

  -- team sign-up paid
  d := pg_get_functiondef('trg_web_signup_receipt'::regproc);
  if position('''Kvittering – '' || tm' in d) = 0 then raise exception '%', procedure_missing || 'trg_web_signup_receipt'; end if;
  d := replace(d, '''Kvittering – '' || tm', 'case when new.source = ''admin'' then ''Kvittering – '' else ''Tilmelding bekræftet – '' end || tm');
  execute d;

  -- event sign-up from the website
  d := pg_get_functiondef('web_event_signup'::regproc);
  if position('''<p>Tak for tilmeldingen af <b>''' in d) = 0 or position('''Tilmelding modtaget – '' || ev.title' in d) = 0 or position('app_mail_html(sid, ''Tilmelding modtaget'',' in d) = 0 then raise exception '%', procedure_missing || 'web_event_signup'; end if;
  d := replace(d, '''<p>Tak for tilmeldingen af <b>''', '''<p>Tak for '' || case when ev.price_dkk is not null then ''registreringen'' else ''tilmeldingen'' end || '' af <b>''');
  d := replace(d, 'Du får en kvittering, når betalingen er registreret.', 'Tilmeldingen gælder først, når betalingen er bekræftet – så får du en bekræftelse på mail.');
  d := replace(d, '''Tilmelding modtaget – '' || ev.title', 'case when ev.price_dkk is not null then ''Registrering modtaget – '' else ''Du er tilmeldt – '' end || ev.title');
  d := replace(d, 'app_mail_html(sid, ''Tilmelding modtaget'',', 'app_mail_html(sid, case when ev.price_dkk is not null then ''Registrering modtaget'' else ''Du er tilmeldt'' end,');
  d := replace(d, '(afventer betaling)', '(registreret – afventer betaling)');
  execute d;

  -- website guest paid
  d := pg_get_functiondef('trg_event_guest_paid'::regproc);
  if position('''Kvittering – '' || t,' in d) = 0 then raise exception '%', procedure_missing || 'trg_event_guest_paid'; end if;
  d := replace(d, '''Kvittering – '' || t,', '''Tilmelding bekræftet – '' || t,');
  d := replace(d, '''Betaling modtaget'', coalesce(new.contact_name', '''Tilmelding bekræftet'', coalesce(new.contact_name');
  execute d;
end $$;
