// Regenerates public/cities.js from GeoNames data (CC BY 4.0, geonames.org).
// Run from a folder where `npm install all-the-cities@3.1.0` was done:
//   node /path/to/nextmatch-app/scripts/make-cities.cjs /path/to/nextmatch-app/public/cities.js
const fs = require('fs');
const all = require(require.resolve('all-the-cities', { paths: [process.cwd()] }));
const best = new Map();
for (const c of all) {
  if (c.country !== 'US' || c.adminCode !== 'TX') continue;
  const name = c.name.trim();
  if (name.length < 2 || name.length > 40) continue;
  const prev = best.get(name);
  if (!prev || c.population > prev.population) best.set(name, c);
}
const rows = [...best.values()].sort((a, b) => b.population - a.population)
  .map(c => [c.name, c.population, +c.loc.coordinates[1].toFixed(3), +c.loc.coordinates[0].toFixed(3)]);
fs.writeFileSync(process.argv[2], `// Every Texas city and town in GeoNames (geonames.org, CC BY 4.0), largest first.
// Each entry: [name, population, latitude, longitude]. Regenerate with scripts/make-cities.cjs.
export const TEXAS_CITIES = ${JSON.stringify(rows)};
`);
console.log(rows.length, 'cities written');
