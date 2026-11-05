import fs from 'node:fs';
const dir = process.argv[2] + '/store/listing';
const H = {
  name: /^## (App name|Appnavn|Appname|App-Name|Appnamn)/i,
  sub: /^## (Subtitle|Undertitel|Undertittel|Untertitel|Underrubrik)/i,
  desc: /^## (Description|Beskrivelse|Beschreibung|Beskrivning)\s*$/i,
};
for (const f of fs.readdirSync(dir).filter(f => /^[a-z]{2}\.md$/.test(f)).sort()) {
  const lines = fs.readFileSync(`${dir}/${f}`, 'utf8').split('\n');
  const section = (re) => {
    const i = lines.findIndex(l => re.test(l));
    if (i < 0) return '';
    const out = [];
    for (let j = i + 1; j < lines.length && !lines[j].startsWith('## '); j++) out.push(lines[j]);
    return out.join('\n').trim();
  };
  const name = section(H.name).split('\n')[0].trim();
  const short = (section(H.sub).match(/^Play(?: short description)?:\s*(.*)$/m) || [])[1] || '';
  const full = section(H.desc).split('\n').filter(l => !/^(Terms of Use|Privacy Policy|Brugsvilkår|Privatlivspolitik|Nutzungsbedingungen|Datenschutz|Användarvillkor|Integritetspolicy|Bruksvilkår|Personvern)/i.test(l)).join('\n').trim();
  const ok = (n, max) => n <= max ? 'ok' : `TOO LONG (${n}>${max})`;
  console.log(`${f}: name ${name.length} ${ok(name.length, 30)} | short ${short.length} ${ok(short.length, 80)} | full ${full.length} ${ok(full.length, 4000)}`);
  if (!name || !short || !full) console.log('  !! missing field(s)');
}
