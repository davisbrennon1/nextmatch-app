// Regenerates public/us-cities.js: every U.S. city and town (50 states + DC).
// Sources: the `zipcodes` package (every place with a ZIP code) and GeoNames via `all-the-cities`
// (geonames.org, CC BY 4.0) for populations and places without their own ZIP code.
// Run from a folder where `npm install zipcodes@8.0.0 all-the-cities@3.1.0` was done:
//   node /path/to/nextmatch-app/scripts/make-cities.cjs /path/to/nextmatch-app/public/us-cities.js
// It also writes functions/us-cities.txt for the server.
const fs = require('fs');
const req = m => require(require.resolve(m, { paths: [process.cwd()] }));
const STATES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
const ok = new Set(STATES);
const places = new Map(); // "name|ST" (lowercase) -> { name, st, pop, lat, lng, n }
const add = (name, st, pop, lat, lng) => {
  name = String(name || '').trim().replace(/\s+/g, ' ');
  if (!ok.has(st) || name.length < 2 || name.length > 36 || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const k = name.toLowerCase() + '|' + st, p = places.get(k);
  if (!p) places.set(k, { name, st, pop: pop || 0, lat, lng, n: 1 });
  else { if (pop > p.pop) { p.pop = pop; p.name = name; p.lat = lat; p.lng = lng; p.n = 0 } else if (!p.pop) { p.lat = (p.lat * p.n + lat) / (p.n + 1); p.lng = (p.lng * p.n + lng) / (p.n + 1); p.n++ } }
};
for (const z of Object.values(req('zipcodes').codes)) add(z.city, z.state, 0, +z.latitude, +z.longitude);
const RENAME = { 'New York City|NY': 'New York' }; // match the name the Postal Service uses
for (const c of req('all-the-cities')) if (c.country === 'US') add(RENAME[c.name + '|' + c.adminCode] || c.name, c.adminCode, c.population, c.loc.coordinates[1], c.loc.coordinates[0]);
const rows = [...places.values()].sort((a, b) => b.pop - a.pop || a.name.localeCompare(b.name))
  .map(p => [p.name, p.st, p.pop || '', p.lat.toFixed(2), p.lng.toFixed(2)].join('|'));
fs.writeFileSync(process.argv[2], `// Every U.S. city and town (50 states + DC), biggest first. One per line: name|state|population|lat|lng
// (population is blank when unknown). Sources: ZIP code data and GeoNames (geonames.org, CC BY 4.0).
// Loaded only when someone opens the city finder. Regenerate with scripts/make-cities.cjs.
export default ${JSON.stringify(rows.join('\n'))};
`);
// The server's copy, used to look up courts and fields near a city.
fs.writeFileSync(require('path').join(__dirname, '..', 'functions', 'us-cities.txt'), rows.join('\n'));
console.log(rows.length, 'places,', new Set(rows.map(r => r.split('|')[1])).size, 'states');
