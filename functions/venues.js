// Courts, fields, parks and rec centers for a city, from OpenStreetMap (openstreetmap.org,
// © OpenStreetMap contributors, ODbL). Looked up once per city through the Overpass API, then
// kept in the database (venues/{city}) for 30 days so the app stays fast and polite to OSM.
const fs = require('fs');
const path = require('path');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const FRESH_DAYS = 30;
let cities = null;

// "Austin, TX" -> { lat, lng, pop } from the same city list the app uses.
function cityInfo(name) {
  if (!cities) {
    cities = new Map();
    for (const line of fs.readFileSync(path.join(__dirname, 'us-cities.txt'), 'utf8').split('\n')) {
      const [n, st, pop, lat, lng] = line.split('|');
      if (n) cities.set(`${n}, ${st}`, { lat: +lat, lng: +lng, pop: +pop || 0 });
    }
  }
  return cities.get(name) || null;
}

// Search radius grows with the size of the city.
function bbox({ lat, lng, pop }) {
  const km = pop > 1e6 ? 28 : pop > 3e5 ? 18 : pop > 5e4 ? 11 : pop > 5e3 ? 7 : 5;
  const dLat = km / 111, dLng = km / (111 * Math.cos(lat * Math.PI / 180));
  return [lat - dLat, lng - dLng, lat + dLat, lng + dLng].map(v => v.toFixed(4)).join(',');
}

function overpassQuery(b) {
  return `[out:json][timeout:25];(
nwr["leisure"="pitch"]["sport"~"basketball|american_football|soccer|multi|rugby"](${b});
nwr["leisure"="sports_centre"](${b});
nwr["leisure"="park"]["name"](${b});
nwr["amenity"="community_centre"]["name"~"Recreation|Rec Center|Community Center",i](${b});
);out center tags 1500;`;
}

const BASKETBALL = /basketball/, FOOTBALL = /american_football|soccer|rugby/;
const BLOCKED = new Set(['private', 'no', 'customers', 'members', 'permit', 'permissive_private']);

// Turns raw map data into the list the app shows. Exported for tests.
function normalize(elements) {
  const pts = elements.map(e => ({ e, t: e.tags || {}, lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon })).filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lng) && !BLOCKED.has(x.t.access));
  const parks = pts.filter(x => x.t.leisure === 'park' && x.t.name);
  const nearestPark = x => {
    let best = null, d = Infinity;
    for (const p of parks) { const dy = p.lat - x.lat, dx = (p.lng - x.lng) * Math.cos(x.lat * Math.PI / 180), e = dx * dx + dy * dy; if (e < d) { d = e; best = p } }
    return best && Math.sqrt(d) * 111 < 0.6 ? best.t.name : '';
  };
  const out = new Map();
  for (const x of pts) {
    const t = x.t, sport = String(t.sport || '');
    let kind, sports;
    if (t.leisure === 'pitch') {
      if (BASKETBALL.test(sport)) { kind = 'Basketball court'; sports = ['Basketball'] }
      else if (FOOTBALL.test(sport)) { kind = 'Field'; sports = ['Flag football'] }
      else { kind = 'Sports court'; sports = ['Basketball', 'Flag football'] }
    } else if (t.leisure === 'sports_centre' || t.amenity === 'community_centre') { kind = 'Rec center'; sports = BASKETBALL.test(sport) ? ['Basketball'] : FOOTBALL.test(sport) ? ['Flag football'] : ['Basketball', 'Flag football'] }
    else if (t.leisure === 'park') { kind = 'Park'; sports = ['Basketball', 'Flag football'] }
    else continue;
    const park = kind === 'Park' ? '' : nearestPark(x);
    const name = (t.name || (park ? `${park} ${kind === 'Field' ? 'fields' : kind === 'Basketball court' ? 'courts' : 'courts'}` : '')).trim().slice(0, 90);
    if (!name) continue; // an unnamed court far from any park can't be found by players
    const key = (name + '|' + kind).toLowerCase();
    const prev = out.get(key);
    if (prev) { prev.count++; continue }
    const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
    out.set(key, { name, kind, sports, park: park !== name ? park : '', lat: +x.lat.toFixed(5), lng: +x.lng.toFixed(5), address: street.slice(0, 80), lit: t.lit === 'yes', count: 1 });
  }
  const rank = { 'Basketball court': 0, Field: 0, 'Sports court': 1, 'Rec center': 2, Park: 3 };
  return [...out.values()].sort((a, b) => rank[a.kind] - rank[b.kind] || a.name.localeCompare(b.name)).slice(0, 400);
}

async function overpass(query) {
  let last;
  for (const url of MIRRORS) {
    try {
      const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: query }), headers: { 'User-Agent': 'NextMatch/1.0 (pickup sports app)' }, signal: AbortSignal.timeout(28000) });
      if (!res.ok) throw new Error('Overpass ' + res.status);
      const json = await res.json();
      if (!Array.isArray(json.elements)) throw new Error('Overpass returned no elements');
      return json.elements;
    } catch (e) { last = e }
  }
  throw last;
}

// Returns { city, venues, updatedAt, source } for a city, from the saved copy when it's fresh.
async function getVenues(city, { fetchElements = overpass, now = Date.now() } = {}) {
  const info = cityInfo(city);
  if (!info) { const e = new Error('Unknown city'); e.code = 'invalid-argument'; throw e }
  const ref = getFirestore().doc(`venues/${city.replace(/[^A-Za-z0-9]+/g, '_')}`);
  const saved = await ref.get();
  if (saved.exists && now - saved.data().updatedAt.toMillis() < FRESH_DAYS * 864e5) return { city, venues: saved.data().venues, source: 'saved' };
  try {
    const venues = normalize(await fetchElements(overpassQuery(bbox(info))));
    await ref.set({ city, venues, updatedAt: FieldValue.serverTimestamp() });
    return { city, venues, source: 'openstreetmap' };
  } catch (e) {
    if (saved.exists) return { city, venues: saved.data().venues, source: 'saved' }; // old list beats none
    throw e;
  }
}

module.exports = { getVenues, normalize, bbox, cityInfo };
