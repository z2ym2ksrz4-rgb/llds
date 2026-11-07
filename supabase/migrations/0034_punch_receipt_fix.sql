-- activate_punch_card failed silently in the app: the receipt trigger read new.price_dkk, but the price lives on punch_card_type.
create or replace function trg_punch_receipt() returns trigger language plpgsql security definer set search_path = public as $$
declare em text; nm text; ty punch_card_type; sid uuid; teams text; begin
  if new.status = 'active' and (old.status is distinct from 'active') then
    select coalesce(p.email, (select g.email from guardian x join person g on g.id = x.parent_id where x.child_id = p.id limit 1)), p.first_name, p.school_id into em, nm, sid from person p where p.id = new.person_id;
    select * into ty from punch_card_type where id = new.type_id;
    select string_agg(name, ', ') into teams from team where id = any(new.team_ids);
    if em is not null then
      perform send_mail(sid, em, 'Kvittering – ' || ty.name, receipt_html(sid, 'Klippekort aktiveret', nm,
        jsonb_build_array(jsonb_build_object('label', ty.name, 'value', ty.punches || ' klip'), jsonb_build_object('label', 'Gælder på', 'value', coalesce(teams, '–')), jsonb_build_object('label', 'Gyldigt til', 'value', to_char(new.expires_on, 'DD.MM.YYYY'))),
        dkk(ty.price_dkk), 'Et klip bruges automatisk, når fremmødet registreres.'), 'punch', jsonb_build_object('card_id', new.id));
    end if;
  end if; return new;
end $$;
