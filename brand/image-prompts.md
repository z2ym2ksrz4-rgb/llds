# Billedkatalog – prompts til billedgenerering

Alle billeder i samme udtryk som appen og websitet: **sort baggrund, varmt guldlys, redaktionelt/magasin-agtigt, ingen tekst, ingen logoer, ingen genkendelige ansigter i nærbillede** (dansere set fra siden/bagfra, i bevægelse eller i modlys). Format **3:2 (fx 1536×1024)**, gem som JPG i kvalitet 85, og læg dem i `public/art/catalog/` med **præcis det filnavn**, der står ud for hver prompt. Kør derefter `npm run catalog && npm run site` (eller bare `npm run build` – kataloget genereres automatisk) – så dukker de op i vælgeren under Admin → Events / Hold og i opslag.

**Fælles stil-præfiks (sæt foran hver prompt):**
> Editorial fine-art photograph, cinematic, black background, warm gold rim light and soft gold haze, high contrast, shallow depth of field, elegant and premium, Scandinavian minimalism, 35mm, no text, no logos, no watermark —

**Negativ prompt (hvis modellen har det):**
> text, letters, logo, watermark, caption, extra limbs, distorted hands, cartoon, 3d render, oversaturated, cluttered background, daylight, white background

## Events (15 – ét unikt billede pr. event i sæson 26/27)

| Filnavn | Event | Prompt (efter præfikset) |
|---|---|---|
| `event-julebal.jpg` | Julebal 19/12 | a festive dance hall at night, warm golden fairy lights bokeh, a group of young dancers in sparkling costumes mid-pose seen from behind, confetti catching the light, celebration atmosphere |
| `event-rangliste-1-junior.jpg` | KC Rangliste 1 – Junior & Voksen | a large competition arena floor, a junior showdance team of eight in a tight formation frozen mid-leap, dramatic single gold spotlight from above, audience as dark silhouettes |
| `event-rangliste-1-born.jpg` | KC Rangliste 1 – Mini Børn & Børn | small children dancers in a neat line on a competition floor, viewed from low angle behind the first dancer, glittering costumes, gold stage light, excited and proud mood |
| `event-rangliste-2-born2.jpg` | KC Rangliste 2 – Børn 2, Junior 2 & Voksen | wide shot of a competition stage with two teams waiting at the edge, gold light beams cutting through haze, numbered floor markings softly visible, tension before the music starts |
| `event-rangliste-2-born1.jpg` | KC Rangliste 2 – Mini Børn, Børn 1 & Junior 1 | a young dancer's feet and legs in jazz shoes on a shiny competition floor, reflections of gold stage lights, blurred teammates behind, intimate detail |
| `event-danmark-danser.jpg` | Danmark Danser – Solo & Duo | a single dancer alone on a vast dark stage in a long gold-lit spotlight, dramatic shadow, elegant extended arm, concert-hall atmosphere |
| `event-cph-open.jpg` | CPH Open | an elite showdance team in black and gold costumes mid-performance, synchronized arms, motion blur on the edges, cool blue rim light mixed with warm gold, big-city competition energy |
| `event-semifinale.jpg` | KC Semifinale | backstage corridor before a semifinal: dancers' silhouettes lined up against a bright gold stage door, haze, anticipation, seen from behind |
| `event-cph-open-finale.jpg` | CPH Open Finale | a close-up of a gold trophy on a black podium with a dance team blurred in celebration behind it, gold confetti falling, shallow focus |
| `event-kc-finale.jpg` | KC Finale | an opera-house stage seen from the wings, red velvet curtain edge, a dance team in formation under a dense gold spotlight, grand and ceremonial |
| `event-dm-junior-voksen.jpg` | DM Showdance – Børn, Junior & Voksen | the Danish Championship: a full showdance team in a powerful final pose on a huge stage, pyrotechnic gold sparks in the background, wide cinematic frame |
| `event-dm-mini.jpg` | DM Showdance – Mini Børn Debutant & Talent | tiny dancers holding hands taking a bow on a big stage, gold light flooding from above, parents as warm blurred bokeh in the audience, heartwarming |
| `event-show-it.jpg` | Show IT | a joyful show number: dancers in colourful costumes caught mid-jump with fabric flying, theatrical gold and amber stage lighting, playful energy |
| `event-afdansningsbal.jpg` | Afdansningsbal | end-of-season ball: a sports hall transformed with gold balloons and garlands, dancers of all ages hugging and celebrating, seen from behind, warm nostalgic light |
| `event-dd-finale.jpg` | Danmark Danser – Finale (Solo & Duo) | a duo of dancers mirrored in perfect symmetry on a royal theatre stage, gilded balcony details softly visible in the dark, single warm spotlight |

## Hold (6 – ét pr. kategori/stil, bruges som cover når Line ikke har et foto)

| Filnavn | Bruges til | Prompt |
|---|---|---|
| `team-mini.jpg` | Mini-hold | a playful dance class of small children in sparkly tutus seen from behind in a mirrored studio, gold studio lamps, bokeh, joy and movement |
| `team-kids-showdance.jpg` | Børne-showdance | a kids' showdance team rehearsing a formation in a dark studio, gold light streaks, focus on synchronized arms, energetic |
| `team-junior-elite.jpg` | Junior-/elitehold | an elite junior showdance team in black-and-gold costumes, dramatic low-angle shot mid-routine, sweat and intensity, gold rim light |
| `team-hiphop.jpg` | Hip hop | a hip hop crew freezing in a strong pose in a dark studio, streetwear, gold neon-like rim light on concrete, dynamic and cool |
| `team-contemporary.jpg` | Contemporary | a contemporary dancer in a flowing fabric mid-turn, long exposure light trails in gold, abstract and artistic, dark studio |
| `team-fitness-adult.jpg` | Hit Fit / voksne | adults in a fun dance-fitness class, motion blur, warm gold gym lighting, water bottles and smiles, seen from the side |

## Opslag (3 – stemningsbilleder til nyheder og beskeder)

| Filnavn | Stemning | Prompt |
|---|---|---|
| `post-news.jpg` | Nyt fra studiet | a dance studio at dusk with a single gold-lit ballet barre and a mirror reflecting warm light, calm and inviting, no people |
| `post-celebration.jpg` | Tillykke / resultater | gold medals and a small trophy on black velvet, soft gold confetti, celebratory macro shot |
| `post-reminder.jpg` | Påmindelser / praktisk | a neatly packed dance bag with jazz shoes, water bottle and a folded black team jacket on a dark bench, warm gold side light |

Alle 24 filnavne er allerede registreret i `brand/catalog.json` med danske titler og tags, så de får rigtige navne i vælgeren, så snart filerne ligger i mappen.
