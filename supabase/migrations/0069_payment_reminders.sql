-- 0069: one button in Admin → Betalinger reminds everyone whose payment has waited 7+ days (at most one reminder a week per payment).
alter table web_signup add column if not exists reminded_at timestamptz;

create or replace function remind_unpaid(p_team uuid default null) returns integer language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0; tm text; fn text;
begin
  if not i_am_admin() then raise exception 'not admin'; end if;
  for r in select w.* from web_signup w
            where w.school_id = my_school_id() and w.status = 'awaiting_payment' and w.claimed_paid_at is null and w.amount_dkk is not null
              and w.created_at < now() - interval '7 days' and (w.reminded_at is null or w.reminded_at < now() - interval '7 days')
              and (p_team is null or w.team_id = p_team) and w.contact_id is not null loop
    select name into tm from team where id = r.team_id; select first_name into fn from person where id = r.dancer_id;
    perform notify_mail(r.contact_id, 'payment', 'Påmindelse: betaling mangler – ' || coalesce(tm, ''),
      'Vi mangler stadig betalingen for ' || coalesce(fn, '') || ' på ' || coalesce(tm, 'holdet') || ': '
        || case when coalesce(r.installments, 1) > 1 then r.per_rate_dkk || ' kr. (rate ' || (coalesce(r.rates_paid, 0) + 1) || ' af ' || r.installments || ')' else r.amount_dkk || ' kr.' end
        || ' med MobilePay og referencen "' || r.reference || '". Tilmeldingen gælder først, når betalingen er bekræftet. Har du allerede betalt, så tryk "Jeg har betalt" i appen under Betalinger.',
      jsonb_build_object('payment_id', r.id));
    update web_signup set reminded_at = now() where id = r.id; n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function remind_unpaid(uuid) to authenticated;
insert into schema_migration(name) values ('0069_payment_reminders') on conflict do nothing;
