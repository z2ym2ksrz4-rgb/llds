-- 0018: Julebal filled in as a complete example event (meet time, programme, pack list, info, deadline, price). Line edits it in Admin → Events.
update event set
  meet_time = '10:15 i hallen (dansere) – dørene åbner 10:45 for familie',
  plan = '[{"time":"10:15","text":"Dansere møder – omklædning og opvarmning"},{"time":"10:45","text":"Dørene åbner for familie og venner"},{"time":"11:00","text":"Velkomst ved Line"},{"time":"11:10","text":"Opvisning: Mini- og børnehold"},{"time":"12:00","text":"Pause – kaffe, kakao og æbleskiver"},{"time":"12:30","text":"Opvisning: Junior- og voksenhold"},{"time":"13:30","text":"Fællesdans og julemanden kommer forbi"},{"time":"14:30","text":"Uddeling af emblemer og tak for i år"},{"time":"15:00","text":"Farvel og god jul"}]'::jsonb,
  pack_list = array['Holdkostume (hænger på knagen i studiet)','Dansesko / rene indendørssko','Nissehue 🎅','Vandflaske','Hårelastikker og nåle','Lidt lommepenge til kagebod'],
  info = E'Julebal for alle hold – opvisning, hygge og julestemning. Familie og venner er velkomne, og entréen er gratis for publikum.\n\nTilmelding gælder pr. danser og dækker julepose, æbleskiver og kakao. Betales via MobilePay efter tilmelding – husk danserens navn i beskeden.\n\nSpørgsmål: skriv til Line i appen.',
  signup_deadline = '2026-12-12',
  price_dkk = 50,
  place = 'Ulstrup Hallen, Vinkelvej 17, 8860 Ulstrup',
  image_key = coalesce(image_key, 'event-julebal')
where title = 'Julebal' and starts_at::date = '2026-12-19';
