import { firebaseConfig, FEATURES, CITIES, USE_EMULATORS } from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, GoogleAuthProvider, OAuthProvider, signInWithPopup, signOut, connectAuthEmulator
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc, collection, query, where,
  orderBy, limit, onSnapshot, serverTimestamp, Timestamp, arrayUnion, arrayRemove, writeBatch, connectFirestoreEmulator
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/* ================= Basics ================= */
const $ = s => document.querySelector(s);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = { get(k, d) { try { const v = localStorage.getItem('nm_' + k); return v == null ? d : JSON.parse(v) } catch { return d } }, set(k, v) { try { localStorage.setItem('nm_' + k, JSON.stringify(v)) } catch { } } };
const toDate = t => t?.toDate ? t.toDate() : t instanceof Date ? t : new Date();
function toast(t) { const e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(window._t); window._t = setTimeout(() => e.hidden = true, 3200) }

if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('PASTE')) {
  $('#gate').hidden = true;
  document.body.insertAdjacentHTML('beforeend', `<div class="setup-box"><h2>Almost there</h2><p style="margin-top:12px">NextMatch isn’t connected to Firebase yet. Open <code>public/config.js</code> and paste your Firebase web app settings, as described in step 2 of <code>README.md</code>.</p></div>`);
  throw new Error('NextMatch: firebaseConfig is not filled in.');
}

const fb = initializeApp(firebaseConfig);
const auth = getAuth(fb);
const db = getFirestore(fb);
if (USE_EMULATORS) { connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); connectFirestoreEmulator(db, '127.0.0.1', 8080) }

/* ================= Icons and artwork ================= */
const I = {
  today: '<path d="M4 7h16v13H4z"/><path d="M4 11h16M9 3v4M15 3v4"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.5 3.5 3.5 14.5 0 18M12 3c-3.5 3.5-3.5 14.5 0 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  feed: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="m10 8.5 5 3.5-5 3.5z"/>',
  me: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  msg: '<path d="M4 5h16v11H9l-5 4z"/>',
  swords: '<path d="m5 3 14 18M19 3 5 21"/>',
  whistle: '<circle cx="9" cy="14" r="5"/><path d="M13 11h8v4h-6M9 9V5"/>',
  camera: '<path d="M4 7h4l2-3h4l2 3h4v12H4z"/><circle cx="12" cy="13" r="4"/>',
  dumbbell: '<path d="M3 9v6M6 6v12M6 12h12M18 6v12M21 9v6"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  chat: '<path d="M5 5h14v10H10l-5 4z"/>',
  share: '<path d="M12 4v11M7 9l5-5 5 5M5 14v6h14v-6"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>'
};
const ic = (n, f = false, s = '') => `<svg ${s} viewBox="0 0 24 24" fill="${f ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;
const GOOGLE_G = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.6 42.6 14.6 48 24 48z"/></svg>';
const APPLE = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1zM13.9 5c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z"/></svg>';
function art(kind) {
  const A = {
    ball: `<svg class="art" viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="300" height="300" fill="#7a3d17"/><g fill="none" stroke="#f6dcc0" stroke-opacity=".4" stroke-width="4"><circle cx="40" cy="150" r="80"/><rect x="-20" y="95" width="110" height="110"/></g><circle cx="200" cy="160" r="80" fill="#ee7a22"/><circle cx="175" cy="135" r="60" fill="#ff9a44" opacity=".5"/><g fill="none" stroke="#3a1605" stroke-width="5"><path d="M120 160h160M200 80v160M145 105q35 55 0 110M255 105q-35 55 0 110"/></g></svg>`,
    football: `<svg class="art" viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="300" height="300" fill="#1f5c2e"/>${Array.from({ length: 7 }, (_, i) => `<line x1="${i * 50}" y1="0" x2="${i * 50}" y2="300" stroke="#fff" stroke-opacity=".35" stroke-width="3"/>`).join('')}<g transform="rotate(-28 165 140)"><ellipse cx="165" cy="140" rx="100" ry="58" fill="#7b3f1c"/><path d="M90 118q75-22 150 0M90 162q75 22 150 0" stroke="#fff" stroke-width="5" fill="none" opacity=".75"/><path d="M128 140h74" stroke="#fff" stroke-width="6"/>${[138, 154, 170, 186].map(x => `<line x1="${x}" y1="129" x2="${x}" y2="151" stroke="#fff" stroke-width="5"/>`).join('')}</g></svg>`,
    court: `<svg class="art" viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="300" height="300" fill="#10233a"/><rect y="215" width="300" height="85" fill="#244e3a"/><rect x="128" y="55" width="9" height="170" fill="#cdd5d1"/><rect x="160" y="50" width="110" height="74" rx="4" fill="#fff" opacity=".9"/><rect x="195" y="76" width="40" height="32" fill="none" stroke="#d9480f" stroke-width="4"/><path d="M137 92h23" stroke="#cdd5d1" stroke-width="7"/><ellipse cx="215" cy="130" rx="26" ry="7" fill="none" stroke="#e8590c" stroke-width="5"/></svg>`,
    train: `<svg class="art" viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="300" height="300" fill="#1b1f24"/><g fill="#ff6a2b" fill-opacity=".1">${[0, 1, 2, 3].map(i => `<rect x="${i * 95 - 30}" width="40" height="300" transform="skewX(-14)"/>`).join('')}</g><g transform="translate(150 175) rotate(-10)"><rect x="-120" y="-7" width="240" height="14" rx="5" fill="#b9c1bc"/>${[-100, -82, 82, 100].map((x, i) => `<rect x="${x - 8}" y="${i % 3 === 0 ? -48 : -38}" width="16" height="${i % 3 === 0 ? 96 : 76}" rx="4" fill="#2e353b" stroke="#59646c" stroke-width="2"/>`).join('')}</g></svg>`
  };
  return A[kind] || A.train;
}

/* ================= Game rules and sample content ================= */
const SPORTS = ['Basketball', 'Flag football'];
const FORMATS = { Basketball: ['1v1', '2v2', '3v3', '4v4', '5v5'], 'Flag football': ['2v2', '3v3', '4v4', '5v5', '6v6', '7v7'] };
// Player points: 100 for a win, plus 1 bonus point for every point your side scored.
const WIN_POINTS = 100;
const earnedFor = (score, won) => (won ? WIN_POINTS : 0) + Math.max(0, score | 0);
const earnedOf = (g, side) => g.final?.earned?.[side] ?? earnedFor(g.final?.[side], g.final?.winner === side);
// What one player scored and earned in a finished game (older results only have team totals).
const scoredBy = (g, uid, side) => g.final?.players?.[uid]?.scored ?? g.report?.players?.[uid] ?? g.final?.[side];
const earnedBy = (g, uid, side) => g.final?.players?.[uid]?.earned ?? earnedFor(scoredBy(g, uid, side), g.final?.winner === side);
const breakdown = (g, side, pts) => pts ? (g[side] || []).map(u => `${esc(nameOf(u))} ${pts[u] || 0}`).join(' · ') : '';
const TIERS = [['Rookie', 0], ['Contender', 1000], ['Starter', 1500], ['All-City', 2000], ['Legend', 2500]];
const tierOf = rp => { let i = 0; TIERS.forEach((t, j) => { if (rp >= t[1]) i = j }); return { name: TIERS[i][0], min: TIERS[i][1], next: TIERS[i + 1] } };
const WEEKLY = [{ id: 'footwork', t: 'Quick feet', d: '3 × 30s lateral line steps', fp: 50 }, { id: 'handles', t: 'Handle your game', d: '3 min of dribble drills', fp: 75 }, { id: 'mobility', t: 'Recovery reset', d: '5-minute mobility flow', fp: 40 }];
const TOURNAMENTS = [{ name: 'ATX Hoops Classic', sport: 'Basketball', format: '3v3', when: 'Nov 28', where: 'Austin', size: 16, art: 'ball' }, { name: 'Lone Star Flag Cup', sport: 'Flag football', format: '5v5', when: 'Dec 5', where: 'Austin', size: 12, art: 'football' }];
const AV = ['#c2410c', '#15803d', '#1d4ed8', '#7e22ce', '#b45309', '#0f766e', '#be123c', '#334155'];
const avatar = (n, cls = '') => `<span class="avatar ${cls}" style="--av:${AV[[...String(n || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length]}">${esc((String(n || '?').trim()[0] || '?').toUpperCase())}</span>`;
const sportCls = s => s === 'Flag football' ? 'sport-flag' : 'sport-hoops';
function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function weekKey(d = new Date()) { const x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.toISOString().slice(0, 10) }
function dayLabel(d) { const diff = Math.round((startOfDay(d) - startOfDay()) / 864e5); return diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: diff < 7 ? 'long' : 'short', month: 'short', day: 'numeric' }) }
const timeOf = d => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
function ago(d) { const s = (Date.now() - d) / 1000; return s < 60 ? 'now' : s < 3600 ? Math.floor(s / 60) + 'm' : s < 86400 ? Math.floor(s / 3600) + 'h' : s < 604800 ? Math.floor(s / 86400) + 'd' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
function countdown(d) { const ms = d - Date.now(); if (ms <= 0) return ['NOW', 'Game time']; const h = Math.floor(ms / 36e5), dd = Math.floor(h / 24); return dd > 0 ? [dd + 'D', (h % 24) + 'H to tip-off'] : [h + 'H', Math.floor(ms / 6e4) % 60 + 'M to tip-off'] }

/* ================= State ================= */
const S = {
  uid: null, me: null, tab: 'today', play: 'games', feed: 'all', sport: 'All', fmt: 'All',
  games: [], posts: [], players: [], convos: [], following: new Set(), workouts: [],
  thread: null, msgs: [], profile: null, users: {}, profilePosts: {}, loaded: {},
  myGames: [], world: {}, rankScope: 'city', rankPeriod: 'season', teams: [], myTeams: [], notifs: [], blocked: new Set(), team: null, teamMsgs: [], teamReqs: [], myReq: {}, gameCache: {}, teamCache: {}
};
let subs = [], citySubs = [], threadSub = null, commentSub = null, teamSubs = [], sheetSub = null, worldSubs = {};
const unsubAll = () => { [...subs, ...citySubs, ...teamSubs, ...Object.values(worldSubs)].forEach(u => u()); worldSubs = {}; S.world = {}; subs = []; citySubs = []; teamSubs = []; threadSub?.(); threadSub = null; sheetSub?.(); sheetSub = null };
const myName = () => S.me?.name || 'Player';
const myCity = () => S.me?.city || 'Austin, TX';

/* ───────── Seasons: Winter (Dec–Feb), Spring (Mar–May), Summer (Jun–Aug), Fall (Sep–Nov) ───────── */
function seasonOf(d = new Date()) {
  const m = d.getMonth(), y = d.getFullYear(), yy = n => String(n).slice(2);
  if (m === 11 || m < 2) { const start = m === 11 ? y : y - 1; return { key: `${start}-winter`, label: `Winter ${start}–${yy(start + 1)}`, start: new Date(start, 11, 1), end: new Date(start + 1, 2, 1) } }
  const name = m < 5 ? 'spring' : m < 8 ? 'summer' : 'fall', sm = { spring: 2, summer: 5, fall: 8 }[name];
  return { key: `${y}-${name}`, label: `${name[0].toUpperCase() + name.slice(1)} ${y}`, start: new Date(y, sm, 1), end: new Date(y, sm + 3, 1) };
}
const SEASON = seasonOf();
// A player's points and record for "this season" or "all-time".
const statsFor = (p, period) => period === 'season'
  ? (p.seasonKey === SEASON.key ? { rp: p.seasonRp || 0, w: p.seasonWins || 0, l: p.seasonLosses || 0 } : { rp: 0, w: 0, l: 0 })
  : { rp: p.rp || 0, w: p.wins || 0, l: p.losses || 0 };

/* ───────── Finding a city (every U.S. city and town, stored as "Austin, TX") ───────── */
const STATE_NAMES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming' };
const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
let CITY_LIST = null, cityLoad = null;
// The list is big, so it's only downloaded the first time someone looks for a city.
function loadCities() {
  if (CITY_LIST) return Promise.resolve(CITY_LIST);
  return cityLoad ??= import('./us-cities.js').then(m => {
    CITY_LIST = m.default.split('\n').map(line => {
      const [name, st, pop, lat, lng] = line.split('|'), label = `${name}, ${st}`;
      return { name: label, city: name, st, pop: +pop || 0, lat: +lat, lng: +lng, key: norm(`${name} ${st}`), long: norm(`${name} ${STATE_NAMES[st] || ''}`) };
    }).filter(c => !CITY_FILTER || CITY_FILTER.has(c.name));
    return CITY_LIST;
  }).catch(e => { cityLoad = null; throw e });
}
const CITY_FILTER = Array.isArray(CITIES) && CITIES.length ? new Set(CITIES) : null;
// Exact stored name from whatever someone typed ("austin tx", "Austin, Texas" → "Austin, TX").
async function cityName(typed) {
  const list = await loadCities(), k = norm(typed); if (!k) return null;
  return (list.find(c => c.key === k || c.long === k) || list.find(c => norm(c.city) === k))?.name || null;
}
// Matches by start of name, then start of any word, then anywhere; bigger places first.
function findCities(q, n = 40) {
  const k = norm(q); if (!k || !CITY_LIST) return [];
  const a = [], b = [], c = [];
  for (const x of CITY_LIST) {
    if (x.key.startsWith(k) || x.long.startsWith(k)) a.push(x);
    else if (x.key.split(' ').some(w => w.startsWith(k))) b.push(x);
    else if (k.length > 2 && x.key.includes(k)) c.push(x);
    if (a.length >= n) break;
  }
  return [...a, ...b, ...c].slice(0, n);
}
function nearestCity(lat, lng) {
  let best = null, d = Infinity;
  for (const x of CITY_LIST || []) { const dy = x.lat - lat, dx = (x.lng - lng) * Math.cos(lat * Math.PI / 180), e = dx * dx + dy * dy - (x.pop > 5000 ? 1e-4 : 0); if (e < d) { d = e; best = x } }
  return best;
}
function locateCity(done) {
  if (!navigator.geolocation) return toast('Location isn’t available here. Type your city instead.');
  toast('Finding your city…');
  navigator.geolocation.getCurrentPosition(async p => { await loadCities(); const c = nearestCity(p.coords.latitude, p.coords.longitude); c ? done(c.name) : toast('Couldn’t match your location to a city.') },
    () => toast('Location isn’t available. Type your city instead.'), { timeout: 10000, maximumAge: 600000 });
}
const popText = c => c.pop >= 1e6 ? (c.pop / 1e6).toFixed(1) + 'M people' : c.pop >= 1e4 ? Math.round(c.pop / 1e3) + 'K people' : c.pop ? c.pop.toLocaleString() + ' people' : STATE_NAMES[c.st] || '';
const cityRows = list => list.map(c => `<button type="button" class="city-opt" role="option" data-city="${esc(c.name)}"><span>${esc(c.city)}<em>, ${esc(c.st)}</em></span><small>${popText(c)}</small></button>`).join('');
// An input that suggests cities as you type (used on the setup screen and in Edit profile).
function cityField(id, value = '') {
  return `<div class="cityfield"><input id="${id}" value="${esc(value)}" required autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-list" placeholder="Start typing your city"><button type="button" class="near" id="${id}-near">⌖ Near me</button><div class="city-sug" id="${id}-list" role="listbox" hidden></div></div>`;
}
function bindCityField(id) {
  const input = document.getElementById(id), list = document.getElementById(id + '-list');
  const show = async () => {
    if (!input.value.trim()) { list.hidden = true; return }
    if (!CITY_LIST) { list.innerHTML = '<p class="muted">Loading cities…</p>'; list.hidden = false; try { await loadCities() } catch { list.innerHTML = '<p class="muted">Couldn’t load the city list. Check your connection.</p>'; return } }
    const r = findCities(input.value, 8);
    list.innerHTML = r.length ? cityRows(r) : `<p class="muted">No U.S. city matches “${esc(input.value)}”.</p>`;
    list.hidden = false; input.setAttribute('aria-expanded', 'true');
  };
  const pick = name => { input.value = name; list.hidden = true; input.setAttribute('aria-expanded', 'false') };
  input.addEventListener('input', show);
  input.addEventListener('focus', () => loadCities().catch(() => { }), { once: true });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !list.hidden) { const f = list.querySelector('.city-opt'); if (f) { e.preventDefault(); pick(f.dataset.city) } } if (e.key === 'Escape') list.hidden = true });
  input.addEventListener('blur', () => setTimeout(() => { list.hidden = true }, 150));
  list.addEventListener('mousedown', e => e.preventDefault());
  list.addEventListener('click', e => { const b = e.target.closest('.city-opt'); if (b) pick(b.dataset.city) });
  document.getElementById(id + '-near').onclick = () => locateCity(pick);
}
const recentCities = () => ls.get('recentCities', []).filter(n => typeof n === 'string' && n.includes(', '));
function rememberCity(name) { ls.set('recentCities', [name, ...recentCities().filter(c => c !== name)].slice(0, 5)) }
// The city finder behind the city button at the top of the app.
function openCityPicker() {
  sheet(`<h2>Pick your city</h2><p class="muted" id="citycount">Every city and town in the U.S. You’ll see games, teams and players there.</p><div class="city-search"><input id="cityq" type="search" autocomplete="off" placeholder="Search, e.g. Waco or Springfield, IL" aria-label="Search U.S. cities" aria-controls="citylist"><button type="button" class="btn btn-ghost btn-sm" id="citynear">⌖ Near me</button></div><div class="label city-group">Now showing: ${esc(myCity())}</div><div id="citylist" class="city-list" role="listbox" aria-label="Cities"><p class="muted" style="padding:16px 4px">Loading cities…</p></div>`, 'city');
  const q = $('#cityq');
  const draw = () => {
    const body = $('#citylist'); if (!body || !CITY_LIST) return;
    const v = q.value;
    if (v.trim()) { const r = findCities(v); body.innerHTML = r.length ? cityRows(r) : `<p class="muted" style="padding:16px 4px">No U.S. city matches “${esc(v)}”. Check the spelling, or add the state, like “Springfield, IL”.</p>`; return }
    const byName = new Map(CITY_LIST.map(c => [c.name, c]));
    const recent = recentCities().filter(n => n !== myCity()).map(n => byName.get(n)).filter(Boolean);
    const st = (myCity().split(', ')[1]) || 'TX', near = CITY_LIST.filter(c => c.st === st).slice(0, 10);
    body.innerHTML = (recent.length ? `<div class="label city-group">Recent</div>${cityRows(recent)}` : '') + `<div class="label city-group">Biggest in ${esc(STATE_NAMES[st] || st)}</div>${cityRows(near)}<div class="label city-group">Biggest in the U.S.</div>${cityRows(CITY_LIST.slice(0, 10))}`;
  };
  q.oninput = draw;
  q.onkeydown = e => { if (e.key === 'Enter') { const f = $('#citylist .city-opt'); if (f) { e.preventDefault(); setCity(f.dataset.city) } } };
  $('#citylist').onclick = e => { const b = e.target.closest('.city-opt'); if (b) setCity(b.dataset.city) };
  $('#citynear').onclick = () => locateCity(setCity);
  loadCities().then(list => { if ($('#citycount')) $('#citycount').textContent = `${list.length.toLocaleString()} cities and towns across the U.S. You’ll see games, teams and players there.`; draw() })
    .catch(() => { const b = $('#citylist'); if (b) b.innerHTML = '<p class="muted" style="padding:16px 4px">Couldn’t load the city list. Check your connection and try again.</p>' });
}
async function setCity(name) {
  closeSheet(); if (!name || name === myCity()) return;
  try { await updateDoc(doc(db, 'users', S.uid), { city: name }); rememberCity(name); toast('Showing ' + name + '.') } catch (x) { console.error(x); toast('Couldn’t change city.') }
}
const first = () => myName().split(' ')[0];
const fail = what => err => { console.error(what, err); toast(err?.code === 'failed-precondition' ? `The ${what} list is still being set up. Try again in a few minutes.` : `Couldn’t load ${what}. Check your connection and refresh.`) };

/* ================= Sign in / sign up ================= */
let gateMode = 'signin', gateEmail = ls.get('lastEmail', '');
const AUTH_ERRORS = {
  'auth/email-already-in-use': 'That email already has an account. Sign in instead.',
  'auth/invalid-credential': 'That email and password don’t match. Try again or reset your password.',
  'auth/wrong-password': 'That email and password don’t match. Try again or reset your password.',
  'auth/user-not-found': 'No account uses that email. Create one instead.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/weak-password': 'Use at least 8 characters for your password.',
  'auth/too-many-requests': 'Too many tries. Wait a minute, then try again.',
  'auth/popup-closed-by-user': 'The sign-in window was closed before finishing.',
  'auth/cancelled-popup-request': 'The sign-in window was closed before finishing.',
  'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.',
  'auth/account-exists-with-different-credential': 'This email already signed up another way. Use that method (for example, email and password) instead.',
  'auth/operation-not-allowed': 'This sign-in method isn’t turned on yet. The app owner needs to enable it in Firebase.',
  'auth/unauthorized-domain': 'This website address isn’t approved for sign-in yet. The app owner needs to add it in Firebase.',
  'auth/network-request-failed': 'No connection. Check your internet and try again.'
};
const authMsg = e => AUTH_ERRORS[e?.code] || 'Something went wrong. Please try again.';
function showGate(html) { $('#app').hidden = true; $('#tabbar').hidden = true; $('#gate').hidden = false; $('#gatebody').innerHTML = html }
function renderGate(msg = '', ok = false) {
  const m = gateMode;
  const title = m === 'signup' ? 'Find a game <span>tonight.</span>' : m === 'reset' ? 'Reset your <span>password.</span>' : 'Welcome <span>back.</span>';
  const sub = m === 'signup' ? 'Pickup basketball and flag football across Texas. Make a free account to join games, post highlights and climb your city.' : m === 'reset' ? 'Enter your account email. We’ll send you a link to set a new password.' : 'Sign in to see who’s playing near you.';
  showGate(`<div class="wordmark"><i></i>NextMatch</div><h1>${title}</h1><p>${sub}</p>
  ${m !== 'reset' ? `<div class="auth-sso">${FEATURES.google ? `<button type="button" class="sso sso-google" data-sso="google">${GOOGLE_G}Continue with Google</button>` : ''}${FEATURES.apple ? `<button type="button" class="sso sso-apple" data-sso="apple">${APPLE}Continue with Apple</button>` : ''}</div>${FEATURES.google || FEATURES.apple ? '<div class="or">OR WITH EMAIL</div>' : ''}` : ''}
  <form id="authform" novalidate>
    <label class="field" for="a-email"><span>Email</span><input id="a-email" type="email" autocomplete="email" required maxlength="120" value="${esc(gateEmail)}"></label>
    ${m !== 'reset' ? `<label class="field" for="a-pass"><span>Password</span><input id="a-pass" type="password" required minlength="${m === 'signup' ? 8 : 1}" maxlength="100" autocomplete="${m === 'signup' ? 'new-password' : 'current-password'}">${m === 'signup' ? '<small style="opacity:.7;font-size:12px">At least 8 characters.</small>' : ''}</label>` : ''}
    <button class="btn btn-primary" id="a-go">${m === 'signup' ? 'Create free account' : m === 'reset' ? 'Send reset link' : 'Sign in'}</button>
  </form>
  ${msg ? `<div class="${ok ? 'auth-ok' : 'auth-err'}" role="alert">${esc(msg)}</div>` : ''}
  <div class="auth-links">${m === 'signin' ? '<button data-mode="signup">New here? Create an account</button><button data-mode="reset">Forgot password?</button>' : m === 'signup' ? '<button data-mode="signin">Have an account? Sign in</button>' : '<button data-mode="signin">‹ Back to sign in</button>'}</div>
  <p class="fine">Free friends beta · Adults 18+ · Points have no cash value.</p>`);
  $('#gatebody').querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { gateMode = b.dataset.mode; renderGate() });
  $('#gatebody').querySelectorAll('[data-sso]').forEach(b => b.onclick = () => sso(b.dataset.sso, b));
  $('#authform').onsubmit = async e => {
    e.preventDefault();
    const email = $('#a-email').value.trim(), pass = $('#a-pass')?.value || '';
    gateEmail = email;
    if (!/^\S+@\S+\.\S+$/.test(email)) return renderGate('Enter a valid email address.');
    if (m === 'signup' && pass.length < 8) return renderGate('Use at least 8 characters for your password.');
    if (m === 'signin' && !pass) return renderGate('Enter your password.');
    ls.set('lastEmail', email);
    const btn = $('#a-go'); btn.disabled = true; btn.textContent = 'One moment…';
    try {
      if (m === 'signup') await createUserWithEmailAndPassword(auth, email, pass);
      else if (m === 'signin') await signInWithEmailAndPassword(auth, email, pass);
      else { await sendPasswordResetEmail(auth, email); gateMode = 'signin'; renderGate('If an account uses that email, a reset link is on its way. Check your inbox and spam folder.', true) }
    } catch (err) { renderGate(authMsg(err)) }
  };
}
async function sso(kind, btn) {
  btn.disabled = true;
  try {
    let provider;
    if (kind === 'google') { provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' }) }
    else { provider = new OAuthProvider('apple.com'); provider.addScope('email'); provider.addScope('name') }
    await signInWithPopup(auth, provider);
  } catch (err) { renderGate(authMsg(err)) }
}

/* First sign-in: pick a player name, city and sports. */
function renderSetup(user, msg = '') {
  // Keep what they already typed when showing an error.
  const draft = $('#setupform') ? { name: $('#s-name').value, city: $('#s-city').value, sports: [...document.querySelectorAll('#s-sports .chip.on')].map(b => b.dataset.s), adult: $('#s-adult').checked } : { name: (user.displayName || '').slice(0, 40), city: '', sports: ['Basketball'], adult: false };
  const picked = new Set(draft.sports);
  showGate(`<div class="wordmark"><i></i>NextMatch</div><h1>Set up your <span>player card.</span></h1><p>This is what other players see. You can change it later.</p>
  <form id="setupform">
    <label class="field" for="s-name"><span>Player name</span><input id="s-name" required minlength="2" maxlength="40" autocomplete="nickname" value="${esc(draft.name)}"></label>
    <label class="field" for="s-city"><span>Home city</span></label>${cityField('s-city', draft.city)}
    <label class="field"><span>What do you play?</span></label>
    <div class="chips" id="s-sports">${SPORTS.map(s => `<button type="button" class="chip ${picked.has(s) ? 'on' : ''}" aria-pressed="${picked.has(s)}" data-s="${s}"><span class="dot ${sportCls(s)}"></span>${s}</button>`).join('')}</div>
    <label class="check" for="s-adult"><input id="s-adult" type="checkbox" required ${draft.adult ? 'checked' : ''}>I’m 18 or older and agree to play fair and respect other players.</label>
    <button class="btn btn-primary" id="s-go">Let’s play →</button>
  </form>${msg ? `<div class="auth-err" role="alert">${esc(msg)}</div>` : ''}
  <div class="auth-links"><button id="s-out">Use a different account</button></div>`);
  bindCityField('s-city');
  $('#s-sports').querySelectorAll('.chip').forEach(b => b.onclick = () => { b.classList.toggle('on'); b.setAttribute('aria-pressed', b.classList.contains('on')) });
  $('#s-out').onclick = () => signOut(auth);
  $('#setupform').onsubmit = async e => {
    e.preventDefault();
    const name = $('#s-name').value.trim().replace(/\s+/g, ' '), sports = [...document.querySelectorAll('#s-sports .chip.on')].map(b => b.dataset.s);
    if (name.length < 2) return renderSetup(user, 'Enter a player name with at least 2 characters.');
    const city = await cityName($('#s-city').value).catch(() => null);
    if (!city) return renderSetup(user, 'Pick your home city from the list. Add the state if needed, like “Springfield, IL”.');
    if (!$('#s-adult').checked) return renderSetup(user, 'NextMatch is for adults 18 and older.');
    $('#s-go').disabled = true;
    try {
      await setDoc(doc(db, 'users', user.uid), { name, city, sports: sports.length ? sports : ['Basketball'], rp: 0, wins: 0, losses: 0, adult: true, createdAt: serverTimestamp() });
      enterApp(user);
    } catch (err) { console.error(err); renderSetup(user, 'Couldn’t save your profile. Check your connection and try again.') }
  };
}

onAuthStateChanged(auth, async user => {
  unsubAll();
  if (!user) { if (S.uid) gateMode = 'signin'; S.uid = null; S.me = null; S.tab = 'today'; $('#overlay').innerHTML = ''; renderGate(); return }
  S.uid = user.uid;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) renderSetup(user); else enterApp(user, snap.data());
  } catch (err) { console.error(err); showGate(`<div class="wordmark"><i></i>NextMatch</div><h1>Can’t <span>connect.</span></h1><p>Check your internet connection, then refresh the page.</p>`) }
});

function enterApp(user, data) {
  S.me = data ? { id: user.uid, ...data } : S.me;
  $('#gate').hidden = true; $('#app').hidden = false; $('#tabbar').hidden = false;
  subs.push(onSnapshot(doc(db, 'users', S.uid), d => { if (d.exists()) { const cityChanged = S.me?.city !== d.data().city; S.me = { id: S.uid, ...d.data() }; if (cityChanged || !citySubs.length) subscribeCity(); renderSoon() } }, fail('your profile')));
  subs.push(onSnapshot(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(60)), q => { S.posts = q.docs.map(d => ({ id: d.id, ...d.data() })); S.loaded.posts = true; renderSoon() }, fail('posts')));
  subs.push(onSnapshot(collection(db, 'users', S.uid, 'following'), q => { S.following = new Set(q.docs.map(d => d.id)); renderSoon() }, fail('follows')));
  subs.push(onSnapshot(collection(db, 'users', S.uid, 'workouts'), q => { S.workouts = q.docs.map(d => ({ id: d.id, ...d.data() })); renderSoon() }, fail('workouts')));
  subs.push(onSnapshot(query(collection(db, 'conversations'), where('members', 'array-contains', S.uid), orderBy('updatedAt', 'desc'), limit(50)), q => { S.convos = q.docs.map(d => ({ id: d.id, ...d.data() })); renderSoon() }, fail('messages')));
  subs.push(onSnapshot(query(collection(db, 'games'), where('players', 'array-contains', S.uid), orderBy('when', 'desc'), limit(40)), q => { S.myGames = q.docs.map(d => ({ id: d.id, ...d.data() })); S.myGames.forEach(g => ensureUsers([...g.home, ...g.away])); renderSoon() }, fail('your games')));
  subs.push(onSnapshot(query(collection(db, 'teams'), where('members', 'array-contains', S.uid), limit(20)), q => { S.myTeams = q.docs.map(d => ({ id: d.id, ...d.data() })); S.myTeams.forEach(t => S.teamCache[t.id] = t); renderSoon() }, fail('your teams')));
  subs.push(onSnapshot(query(collection(db, 'users', S.uid, 'notifications'), orderBy('at', 'desc'), limit(50)), q => { S.notifs = q.docs.map(d => ({ id: d.id, ...d.data() })); renderSoon(); if ($('#notifsheet')) openNotifs(false) }, fail('notifications')));
  subs.push(onSnapshot(collection(db, 'users', S.uid, 'blocked'), q => { S.blocked = new Set(q.docs.map(d => d.id)); renderSoon() }, fail('blocked players')));
  render();
  route();
  if (FEATURES.pushKey && 'Notification' in window && Notification.permission === 'granted') enablePush(true);
}
function subscribeCity() {
  citySubs.forEach(u => u()); citySubs = []; S.loaded.games = S.loaded.players = false;
  const since = startOfDay(); since.setDate(since.getDate() - 3);
  citySubs.push(onSnapshot(query(collection(db, 'games'), where('city', '==', myCity()), where('when', '>=', Timestamp.fromDate(since)), orderBy('when'), limit(150)), q => { S.games = q.docs.map(d => ({ id: d.id, ...d.data() })); S.loaded.games = true; S.games.forEach(g => ensureUsers([...g.home, ...g.away])); renderSoon() }, fail('games')));
  citySubs.push(onSnapshot(query(collection(db, 'teams'), where('city', '==', myCity()), limit(100)), q => { S.teams = q.docs.map(d => ({ id: d.id, ...d.data() })); S.teams.forEach(t => S.teamCache[t.id] = t); S.loaded.teams = true; renderSoon() }, fail('teams')));
  citySubs.push(onSnapshot(query(collection(db, 'users'), where('city', '==', myCity()), limit(300)), q => { S.players = q.docs.map(d => ({ id: d.id, ...d.data() })); S.players.forEach(p => S.users[p.id] = p); S.loaded.players = true; renderSoon() }, fail('players')));
}

/* ================= Rendering ================= */
let raf = 0;
function renderSoon() { cancelAnimationFrame(raf); raf = requestAnimationFrame(render) }
function sheet(html, kind = '') { $('#overlay').innerHTML = `<div class="sheet-back" id="sb" role="dialog" aria-modal="true" data-kind="${kind}"><div class="sheet"><div class="grab"></div><div id="sheetbody">${html}</div></div></div>`; $('#sb').onclick = e => { if (e.target.id === 'sb') closeSheet() }; setTimeout(() => $('#sb .sheet')?.querySelector('input,select,textarea,button')?.focus(), 30) }
function closeSheet() { commentSub?.(); commentSub = null; sheetSub?.(); sheetSub = null; S.sheetGame = null; $('#overlay').innerHTML = '' }
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if ($('#sb')) closeSheet(); else if ($('.reels')) closeOverlay() } });
function go(tab, opts = {}) {
  S.tab = tab; Object.assign(S, opts);
  if (tab !== 'messages') { threadSub?.(); threadSub = null }
  if (tab !== 'team') { teamSubs.forEach(u => u()); teamSubs = []; teamInside = []; teamInsideId = null }
  render(); window.scrollTo(0, 0);
}

/* Links like https://your-site.web.app/#game/abc open the right screen (used by notifications). */
async function route() {
  const h = decodeURIComponent(location.hash.slice(1)); if (!h || !S.me) return;
  history.replaceState(null, '', location.pathname);
  routeTo(h);
}
function routeTo(h) {
  const [kind, id] = String(h).split('/');
  if (kind === 'game' && id) openGame(id);
  else if (kind === 'team' && id) openTeam(id);
  else if (kind === 'chat' && id) openThread(id);
  else if (kind === 'notifications') openNotifs();
}
window.addEventListener('hashchange', route);

const TABS = [['today', 'Today'], ['play', 'Play'], ['create', ''], ['feed', 'Feed'], ['me', 'Me']];
function shell() {
  const on = ['profile', 'team'].includes(S.tab) ? 'play' : S.tab;
  $('#tabbar').innerHTML = `<div class="rail-brand wordmark"><i></i>NextMatch</div>` + TABS.map(([k, l]) => k === 'create' ? `<button class="tab-create" aria-label="Create" onclick="openCreate()"><span>${ic('plus')}</span></button>` : `<button class="tab ${on === k ? 'on' : ''}" ${on === k ? 'aria-current="page"' : ''} onclick="go('${k}')">${ic(k)}<span>${l}</span></button>`).join('') + `<div class="rail-foot">Free friends beta · Texas · 18+<br>Points have no cash value.</div>`;
  const unread = S.convos.filter(c => isUnread(c) && !S.blocked.has(otherOf(c))).length, bell = S.notifs.filter(n => !n.read).length;
  $('#btn-msg').innerHTML = ic('msg') + (unread ? `<span class="badge-count">${unread}</span>` : '');
  $('#btn-bell').innerHTML = ic('bell') + (bell ? `<span class="badge-count">${bell > 9 ? '9+' : bell}</span>` : '');
  $('#cityname').textContent = myCity();
}
function render() {
  if (!S.me || $('#app').hidden) return;
  // Keep whatever someone is typing when live data re-renders the page.
  const a = document.activeElement, keep = a && a.id && $('#view').contains(a) ? { id: a.id, v: a.value, s: a.selectionStart } : null;
  shell();
  const V = { today, play, feed, me: mePage, messages, profile: profilePage, team: teamPage }[S.tab] || today;
  $('#view').innerHTML = V();
  if (keep) { const el = document.getElementById(keep.id); if (el) { el.value = keep.v; el.focus(); try { el.setSelectionRange(keep.s, keep.s) } catch { } } }
  if (S.tab === 'messages') { const b = $('#bubbles'); if (b) b.scrollTop = b.scrollHeight }
  if (S.tab === 'team') { const b = $('#teamchat'); if (b && !b.dataset.user) b.scrollTop = b.scrollHeight }
  if ($('#sb')?.dataset.kind === 'game' && !$('#sb').contains(document.activeElement)) drawGameSheet();
}

/* ================= Shared helpers ================= */
const ok = uid => !S.blocked.has(uid);
const nameOf = uid => uid === S.uid ? myName() : S.users[uid]?.name || 'Player';
const loadingUsers = new Set();
function ensureUsers(ids) { const miss = [...new Set(ids)].filter(u => u && !S.users[u] && !loadingUsers.has(u)); if (!miss.length) return; miss.forEach(u => loadingUsers.add(u)); Promise.all(miss.map(loadUser)).then(renderSoon) }
async function loadUser(uid) { if (S.users[uid]) return S.users[uid]; try { const d = await getDoc(doc(db, 'users', uid)); if (d.exists()) S.users[uid] = { id: uid, ...d.data() } } catch (e) { console.error(e) } return S.users[uid] }
const myTeamIds = () => new Set(S.myTeams.map(t => t.id));
const fpTotal = () => S.workouts.reduce((t, w) => t + (w.fp || 0), 0);

/* ================= Games ================= */
const mine = g => g.players?.includes(S.uid);
const sideOf = (g, uid = S.uid) => g.home?.includes(uid) ? 'home' : g.away?.includes(uid) ? 'away' : null;
const other = s => s === 'home' ? 'away' : 'home';
const size = g => parseInt(g.format);
function sideName(g, s) {
  if (g[s + 'TeamName']) return g[s + 'TeamName'];
  const ids = g[s] || [];
  if (!ids.length) return s === 'home' ? g.hostName : 'Open';
  return nameOf(ids[0]) + (ids.length > 1 ? ` +${ids.length - 1}` : '');
}
const gameTitle = g => g.away?.length || g.awayTeamName ? `${sideName(g, 'home')} vs ${sideName(g, 'away')}` : sideName(g, 'home');
const getGame = id => S.gameCache[id] || S.games.find(x => x.id === id) || S.myGames.find(x => x.id === id);
const started = g => toDate(g.when) <= new Date();
function canJoin(g, s) {
  if (g.status !== 'open' || mine(g) || (g[s] || []).length >= size(g)) return false;
  const tid = g[s + 'TeamId']; return !tid || myTeamIds().has(tid);
}
const needsMyConfirm = g => g.status === 'reported' && sideOf(g) && sideOf(g) !== g.report.side;
function statusChip(g) {
  if (g.status === 'final') return `<span class="chip-s final">Final ${g.final.home}–${g.final.away}</span>`;
  if (g.status === 'confirmed') return '<span class="chip-s">Awarding points…</span>';
  if (g.status === 'reported') return `<span class="chip-s warn">${needsMyConfirm(g) ? 'Confirm score' : 'Score reported'}</span>`;
  if (g.status === 'disputed') return '<span class="chip-s bad">Disputed</span>';
  if (started(g) && mine(g)) return '<span class="chip-s warn">Report score</span>';
  return '';
}
function gameRow(g) {
  const w = toDate(g.when), n = (g.home?.length || 0) + (g.away?.length || 0), sd = sideOf(g);
  const line = g.status !== 'open' || started(g) ? statusChip(g) : `${sd ? (g.hostUid === S.uid ? '★ Your game' : '✓ You’re in') : esc(g.need)} · ${n}/${size(g) * 2} players`;
  return `<button class="game ${sportCls(g.sport)}" onclick="openGame('${g.id}')"><div class="fmt">${esc(g.format)}<small>${g.sport === 'Basketball' ? 'HOOPS' : 'FLAG'}</small></div><div style="min-width:0"><h3>${esc(gameTitle(g))}</h3><div class="sub">${esc(g.venue)}</div><div class="sub" style="color:var(--sport);font-weight:700">${line}</div></div><div class="right"><span class="time">${dayLabel(w) === 'Today' ? timeOf(w) : w.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span><span class="rp">Win +${WIN_POINTS}</span></div></button>`;
}

function openGame(id) {
  S.sheetGame = id;
  sheet('<div class="loading">Loading game…</div>', 'game');
  sheetSub?.(); sheetSub = onSnapshot(doc(db, 'games', id), d => {
    if (S.sheetGame !== id) return;
    if (!d.exists()) { $('#sheetbody').innerHTML = '<h2>Game not found</h2><p class="muted">The host may have canceled it.</p><div class="actions"><button class="btn btn-primary" onclick="closeSheet()">OK</button></div>'; return }
    S.gameCache[id] = { id, ...d.data() }; ensureUsers([...S.gameCache[id].home, ...S.gameCache[id].away]); drawGameSheet();
  }, fail('this game'));
}
function drawGameSheet() {
  const g = getGame(S.sheetGame); if (!g || !$('#sheetbody') || $('#sb')?.dataset.kind !== 'game') return;
  const keep = $('#rf') ? [...$('#rf').querySelectorAll('input')].map(i => [i.id, i.value]) : null;
  const w = toDate(g.when), sd = sideOf(g), host = g.hostUid === S.uid;
  const col = s => `<div class="side-col"><div class="label">${s === 'home' ? 'Home' : 'Away'}${g[s + 'TeamName'] ? ' · Team' : ''}</div><h3>${esc(sideName(g, s))}</h3><div class="roster">${(g[s] || []).map(u => `<button class="chip" onclick="closeSheet();openProfile('${u}')">${esc(nameOf(u))}${u === g.hostUid ? ' ★' : ''}</button>`).join('') || '<span class="muted" style="font-size:13px">No one yet</span>'}</div><div class="muted" style="font-size:12px;margin-top:8px">${(g[s] || []).length}/${size(g)}</div>${canJoin(g, s) ? `<button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="joinGame('${g.id}','${s}')">Join ${s}</button>` : g[s + 'TeamId'] && !myTeamIds().has(g[s + 'TeamId']) && !mine(g) && g.status === 'open' ? '<p class="muted" style="font-size:12px;margin-top:8px">Team members only</p>' : ''}</div>`;
  let result = '';
  if (g.status === 'final') result = `<div class="result-box final"><div class="label">Final · confirmed by both sides</div><div class="final-score">${g.final.home}–${g.final.away}</div><p>${g.final.winner ? esc(sideName(g, g.final.winner)) + ' wins.' : 'A draw.'}</p><div class="earned">${['home', 'away'].map(s => `<div class="earned-side"><span class="label">${esc(sideName(g, s))}${g.final.winner === s ? ' · Win' : ''}</span>${(g[s] || []).map(u => `<div class="earned-row ${u === S.uid ? 'me' : ''}"><span>${esc(nameOf(u))}${u === S.uid ? ' (you)' : ''}<small>${g.final.winner === s ? WIN_POINTS + ' win + ' : ''}${scoredBy(g, u, s)} scored</small></span><b>+${earnedBy(g, u, s)}</b></div>`).join('')}</div>`).join('')}</div><p class="muted" style="font-size:12px;margin-top:8px">Player points earned in this game.</p></div>`;
  else if (g.status === 'confirmed') result = `<div class="result-box"><div class="label">Score confirmed</div><div class="final-score">${g.report.home}–${g.report.away}</div><p>Awarding player points…</p></div>`;
  else if (g.status === 'reported') {
    const r = g.report;
    result = `<div class="result-box warn"><div class="label">Score reported by ${esc(nameOf(r.by))}</div><div class="final-score">${r.home}–${r.away}</div><p>${esc(sideName(g, 'home'))} ${r.home}, ${esc(sideName(g, 'away'))} ${r.away}.</p>${r.players ? `<p class="muted" style="font-size:13px;margin-top:4px">Points: ${breakdown(g, 'home', r.players)} | ${breakdown(g, 'away', r.players)}</p>` : ''}${needsMyConfirm(g) ? `<p style="margin-top:6px">Do the scores match what happened? Points are awarded once you confirm.</p><div class="actions" style="justify-content:flex-start"><button class="btn btn-primary btn-sm" onclick="respond('${g.id}','confirmed')">✓ Confirm ${r.home}–${r.away}</button><button class="btn btn-ghost btn-sm" onclick="respond('${g.id}','disputed')">Dispute</button></div>` : sd ? `<p class="muted" style="margin-top:6px">Waiting for someone on the ${other(r.side)} side to confirm.</p>` : ''}</div>`;
  } else if (sd && started(g)) {
    const ready = g.home.length && g.away.length;
    result = `<div class="result-box ${g.status === 'disputed' ? 'bad' : ''}">${g.status === 'disputed' ? `<div class="label">Score disputed</div><p style="margin-bottom:10px">The last report (${g.report.home}–${g.report.away}) was disputed. Agree on the score, then report it again.</p>` : '<div class="label">Report the final score</div>'}${ready ? `<form id="rf" class="rf"><div class="rf-sides">${['home', 'away'].map(s => `<fieldset class="rf-side"><legend><span>${esc(sideName(g, s))}</span><b id="rt-${s}">0</b></legend>${g[s].map(u => `<label class="rf-p" for="rp-${u}"><span>${esc(nameOf(u))}${u === S.uid ? ' (you)' : ''}</span><input id="rp-${u}" data-side="${s}" data-uid="${u}" type="number" inputmode="numeric" min="0" max="999" placeholder="0" aria-label="Points scored by ${esc(nameOf(u))}"></label>`).join('')}</fieldset>`).join('')}</div><button class="btn btn-primary btn-sm" style="margin-top:12px">Submit final score</button></form><p class="muted" style="font-size:12px;margin-top:8px">Enter the points each player scored. Team totals add up for you. The other side confirms before anyone gets points.</p>` : '<p class="muted">Both sides need at least one player before a score can be reported.</p>'}</div>`;
  }
  $('#sheetbody').innerHTML = `<div style="display:flex;justify-content:space-between;gap:10px;align-items:start"><span class="sportbar ${sportCls(g.sport)}"><span class="dot"></span>${esc(g.sport)} · ${esc(g.format)}</span><button class="more" aria-label="More options" onclick="moreMenu('game','${g.id}','${g.hostUid}')">⋯</button></div><h2 style="margin-top:8px">${esc(gameTitle(g))}</h2><div style="display:grid;gap:4px;font-size:14px;margin-top:10px"><span>◷ ${dayLabel(w)}, ${timeOf(w)}</span><span>⌖ ${esc(g.venue)}, ${esc(g.city)} · <a class="link" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(g.venue + ' ' + g.city)}" target="_blank" rel="noopener">Directions ↗</a></span><span style="color:var(--gold);font-weight:700">Win: +${WIN_POINTS} player points, plus 1 for every point you score</span></div>${result}<div class="sides-grid">${col('home')}${col('away')}</div><p class="muted" style="font-size:13px;margin-top:12px">${g.sport === 'Flag football' ? 'Flag pulls end the play. No tackling. Captains confirm field size and scoring before kickoff.' : 'Games to 21, win by 2 unless captains agree otherwise.'}</p><div class="actions">${host && g.status === 'open' ? `<button class="btn btn-ghost" onclick="cancelGame('${g.id}')">Cancel game</button>` : ''}${sd && !host && g.status === 'open' ? `<button class="btn btn-ghost" onclick="leaveGame('${g.id}')">Leave game</button>` : ''}${sd && !['final', 'confirmed'].includes(g.status) ? `<button class="btn btn-primary" onclick="startGame('${g.id}')">Open scoreboard</button>` : `<button class="btn btn-ghost" onclick="closeSheet()">Close</button>`}</div>`;
  const f = $('#rf');
  if (f) {
    if (keep) keep.forEach(([id, v]) => { const el = document.getElementById(id); if (el) el.value = v });
    const totals = () => { const t = { home: 0, away: 0 }; f.querySelectorAll('input').forEach(i => t[i.dataset.side] += Math.max(0, parseInt(i.value) || 0)); $('#rt-home').textContent = t.home; $('#rt-away').textContent = t.away; return t };
    f.oninput = totals; totals();
    f.onsubmit = e => {
      e.preventDefault(); const pts = {};
      for (const i of f.querySelectorAll('input')) { const v = i.value.trim() === '' ? 0 : Number(i.value); if (!Number.isInteger(v) || v < 0 || v > 999) return toast('Points must be whole numbers from 0 to 999.'); pts[i.dataset.uid] = v }
      const t = totals(); if (!t.home && !t.away) return toast('Enter the points each player scored.');
      reportScore(g.id, t.home, t.away, pts);
    };
  }
}
async function joinGame(id, side) {
  const g = getGame(id); if (!g || !canJoin(g, side)) return toast('You can’t join that side.');
  try { await updateDoc(doc(db, 'games', id), { [side]: arrayUnion(S.uid), players: arrayUnion(S.uid) }); toast('You’re in. See you there.') }
  catch (e) { console.error(e); toast('Couldn’t join. The game may be full.') }
}
async function leaveGame(id) {
  const g = getGame(id), sd = sideOf(g); if (!sd) return;
  try { await updateDoc(doc(db, 'games', id), { [sd]: arrayRemove(S.uid), players: arrayRemove(S.uid) }); toast('You left the game.') }
  catch (e) { console.error(e); toast('Couldn’t update the game. Try again.') }
}
function cancelGame(id) {
  sheet(`<h2>Cancel this game?</h2><p class="muted">Everyone who joined will see it disappear from their schedule.</p><div class="actions"><button class="btn btn-ghost" onclick="openGame('${id}')">Keep it</button><button class="btn btn-primary" id="cg">Cancel game</button></div>`);
  $('#cg').onclick = async () => { try { await deleteDoc(doc(db, 'games', id)); closeSheet(); toast('Game canceled.') } catch (e) { console.error(e); toast('Couldn’t cancel. Try again.') } };
}
async function reportScore(id, h, a, players = null) {
  const g = getGame(id), sd = sideOf(g);
  if (!sd || !Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0 || h > 999 || a > 999) return toast('Enter both scores as whole numbers.');
  const report = { by: S.uid, side: sd, home: h, away: a, at: serverTimestamp() };
  if (players) report.players = Object.fromEntries([...g.home, ...g.away].map(u => [u, players[u] || 0]));
  try { await updateDoc(doc(db, 'games', id), { status: 'reported', report }); toast('Score sent. The other side will be asked to confirm.') }
  catch (e) { console.error(e); toast('Couldn’t submit the score. Try again.') }
}
async function respond(id, status) {
  try { await updateDoc(doc(db, 'games', id), { status, responseBy: S.uid }); toast(status === 'confirmed' ? 'Confirmed. Points are on the way.' : 'Disputed. Talk it out, then report again.') }
  catch (e) { console.error(e); toast('Couldn’t save your answer. Try again.') }
}
function postGame(vs = '', vsTeam = '') {
  const def = new Date(Date.now() + 36e5 * 3); def.setMinutes(0, 0, 0);
  const local = new Date(def - def.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
  sheet(`<h2>Post a game</h2><p class="muted">${vs ? 'Challenge ' + esc(vs) + '.' : 'Anyone in ' + esc(myCity()) + ' can join.'}</p><form id="pg"><label class="field" for="pgs"><span>Sport</span><select id="pgs">${SPORTS.map(s => `<option ${(S.teamCache[vsTeam]?.sport || (S.me.sports || [])[0]) === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label class="field" for="pgf"><span>Format</span><select id="pgf"></select></label><label class="field" for="pgt"><span>Play as</span><select id="pgt"></select></label><label class="field" for="pgo"><span>Opponent team (optional)</span><select id="pgo"></select></label><label class="field" for="pgn"><span>Looking for</span><select id="pgn">${(vs ? ['Challenge: ' + vs] : ['Open challenge', 'Need players', 'Team challenge', 'Casual run']).map(x => `<option>${esc(x.slice(0, 40))}</option>`).join('')}</select></label><label class="field" for="pgv"><span>Where</span><input id="pgv" required minlength="2" maxlength="100" placeholder="e.g. Pease Park Courts"></label><label class="field" for="pgd"><span>When</span><input id="pgd" type="datetime-local" required value="${local}"></label><p id="pgerr" class="auth-err" hidden></p><div class="actions"><button type="button" class="btn btn-ghost" onclick="closeSheet()">Cancel</button><button class="btn btn-primary" id="pggo">Post game</button></div></form>`);
  const fill = () => {
    const sp = $('#pgs').value, mineT = S.myTeams.filter(t => t.sport === sp), opp = S.teams.filter(t => t.sport === sp && !myTeamIds().has(t.id) && ok(t.captainUid));
    $('#pgf').innerHTML = FORMATS[sp].map(f => `<option ${f === '3v3' ? 'selected' : ''}>${f}</option>`).join('');
    $('#pgt').innerHTML = `<option value="">Just me (pickup)</option>` + mineT.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
    $('#pgo').innerHTML = `<option value="">Anyone</option>` + opp.map(t => `<option value="${t.id}" ${t.id === vsTeam ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
  };
  $('#pgs').onchange = fill; fill();
  $('#pg').onsubmit = async e => {
    e.preventDefault(); const when = new Date($('#pgd').value), venue = $('#pgv').value.trim(), err = $('#pgerr');
    if (venue.length < 2) { err.hidden = false; err.textContent = 'Add where you’re playing.'; return }
    if (isNaN(when) || when < Date.now() - 6e4) { err.hidden = false; err.textContent = 'Pick a time in the future.'; return }
    const ht = $('#pgt').value, at = $('#pgo').value;
    $('#pggo').disabled = true;
    try {
      const g = { hostUid: S.uid, hostName: myName(), sport: $('#pgs').value, format: $('#pgf').value, need: $('#pgn').value, venue, city: myCity(), when: Timestamp.fromDate(when), home: [S.uid], away: [], players: [S.uid], status: 'open', createdAt: serverTimestamp() };
      if (ht) Object.assign(g, { homeTeamId: ht, homeTeamName: S.teamCache[ht].name });
      if (at) Object.assign(g, { awayTeamId: at, awayTeamName: S.teamCache[at].name });
      await addDoc(collection(db, 'games'), g); closeSheet(); go('play', { play: 'games', sport: 'All', fmt: 'All' }); toast('Game posted.');
    } catch (x) { console.error(x); err.hidden = false; err.textContent = 'Couldn’t post the game. Check your connection and try again.'; $('#pggo').disabled = false }
  };
}

/* ================= Today ================= */
function seasonCard() {
  const rp = S.me.rp || 0, t = tierOf(rp), pct = t.next ? Math.round((rp - t.min) / (t.next[1] - t.min) * 100) : 100, games = (S.me.wins || 0) + (S.me.losses || 0);
  return `<section class="card season"><div class="season-top"><div><div class="label">${SEASON.label} · ${esc(myCity())}</div><div class="big" style="margin-top:8px">${rp.toLocaleString()}<small>player points</small></div></div><span class="tier">★ ${t.name}</span></div><div><div class="bar"><i style="width:${pct}%"></i></div><p class="muted" style="font-size:13px;margin-top:8px">${t.next ? (t.next[1] - rp).toLocaleString() + ' points to ' + t.next[0] + '.' : 'Top tier reached.'} Win confirmed games to earn points.</p></div><div class="kv"><div><b>${S.me.wins || 0}–${S.me.losses || 0}</b><span>Record</span></div><div><b>${S.players.length ? '#' + (S.players.filter(p => (p.rp || 0) > rp).length + 1) : '—'}</b><span>City rank</span></div><div><b>${statsFor(S.me, 'season').rp.toLocaleString()}</b><span>Season pts</span></div></div></section>`;
}
function weekCard() {
  const wk = weekKey(), thisWeek = S.workouts.filter(w => w.week === wk), dow = (new Date().getDay() + 6) % 7;
  const active = new Set(thisWeek.map(w => (toDate(w.at).getDay() + 6) % 7));
  S.posts.filter(p => p.uid === S.uid && p.kind === 'Training' && weekKey(toDate(p.createdAt)) === wk).forEach(p => active.add((toDate(p.createdAt).getDay() + 6) % 7));
  return `<section class="card"><div class="season-top"><div><div class="label">This week</div><h2 style="margin-top:6px">${active.size} active day${active.size === 1 ? '' : 's'}</h2></div><div style="text-align:right"><div class="big" style="font-size:34px">${fpTotal()}</div><span class="label">Fitness pts</span></div></div><div class="week">${'MTWTFSS'.split('').map((d, i) => `<div class="${active.has(i) ? 'done' : ''} ${i === dow ? 'today' : ''}"><i>${active.has(i) ? '✓' : ''}</i>${d}</div>`).join('')}</div>${WEEKLY.map(w => { const d = thisWeek.some(x => x.challenge === w.id); return `<div class="wc"><div><b>${w.t}</b><small>${w.d} · +${w.fp} FP</small></div><button class="btn btn-sm ${d ? 'btn-ghost' : 'btn-primary'}" ${d ? 'disabled' : ''} onclick="doWorkout('${w.id}')">${d ? '✓ Done' : 'Complete'}</button></div>` }).join('')}</section>`;
}
function actionItems() {
  const items = [];
  S.myGames.forEach(g => {
    if (needsMyConfirm(g)) items.push(`<button class="todo warn" onclick="openGame('${g.id}')"><b>Confirm the score</b><span>${esc(nameOf(g.report.by))} reported ${g.report.home}–${g.report.away} for ${esc(gameTitle(g))}</span><em>Review →</em></button>`);
    else if (['open', 'disputed'].includes(g.status) && started(g) && g.home.length && g.away.length && Date.now() - toDate(g.when) < 7 * 864e5) items.push(`<button class="todo" onclick="openGame('${g.id}')"><b>${g.status === 'disputed' ? 'Re-report the score' : 'How did it go?'}</b><span>Report the final score for ${esc(gameTitle(g))}</span><em>Report →</em></button>`);
  });
  S.myTeams.filter(t => t.captainUid === S.uid && t.pending).forEach(t => items.push(`<button class="todo" onclick="openTeam('${t.id}')"><b>Join requests</b><span>${esc(t.name)}</span><em>Review →</em></button>`));
  return items.length ? `<div class="todos">${items.join('')}</div>` : '';
}
function today() {
  const now = new Date(), hr = now.getHours(), hi = hr < 12 ? 'Morning' : hr < 17 ? 'Afternoon' : 'Evening';
  const next = S.myGames.filter(g => g.status === 'open' && toDate(g.when) > new Date(Date.now() - 2 * 36e5)).sort((a, b) => toDate(a.when) - toDate(b.when))[0];
  const todays = S.games.filter(g => ok(g.hostUid) && dayLabel(toDate(g.when)) === 'Today');
  let ticket;
  if (next) { const w = toDate(next.when), [cd, cdl] = countdown(w); ticket = `<section class="ticket ${sportCls(next.sport)}" aria-label="Your next game"><div class="main"><div class="label">Next up · ${esc(next.format)} ${esc(next.sport)}</div><h2>${esc(gameTitle(next))}</h2><div class="meta"><span>◷ ${dayLabel(w)}, ${timeOf(w)}</span><span>⌖ ${esc(next.venue)}</span><span>${next.players.length} in</span></div><div class="row"><button class="btn btn-primary btn-sm" onclick="startGame('${next.id}')">${ic('whistle', false, 'width="16" height="16"')} Open scoreboard</button><a class="btn btn-ghost btn-sm" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(next.venue + ' ' + next.city)}" target="_blank" rel="noopener">Directions ↗</a><button class="btn btn-ghost btn-sm" onclick="openGame('${next.id}')">Details</button></div></div><div class="stub"><b style="font-family:var(--display)">${cd}</b><small>${cdl}</small></div></section>` }
  else ticket = `<section class="ticket"><div class="main"><div class="label">Next up</div><h2>No game on your <em>calendar.</em></h2><div class="meta"><span>Join a game below or post your own and see who shows up.</span></div><div class="row"><button class="btn btn-primary btn-sm" onclick="postGame()">＋ Post a game</button><button class="btn btn-ghost btn-sm" onclick="go('play',{play:'games'})">Browse games</button></div></div><div class="stub"><b style="font-family:var(--display)">0</b><small>Games booked</small></div></section>`;
  const recent = visiblePosts(S.posts).slice(0, 3);
  return `<div class="cols two"><div style="min-width:0"><div class="greet"><div><div class="label">${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div><h1 style="margin-top:6px">${hi}, <span>${esc(first())}.</span></h1></div></div>${actionItems()}${ticket}
  <div class="sec"><h2>Today in ${esc(myCity())}</h2><button class="link" onclick="go('play',{play:'games'})">All games →</button></div>${!S.loaded.games ? '<div class="loading">Loading games…</div>' : `<div class="games">${todays.map(gameRow).join('') || '<div class="empty">No games today yet. Post one and see who shows up.</div>'}</div>`}
  ${rankChart()}
  ${window.innerWidth < 960 ? `<div style="display:grid;gap:18px;margin-top:22px">${seasonCard()}${FEATURES.workouts ? weekCard() : ''}</div>` : ''}
  <div class="sec"><h2>From the community</h2><button class="link" onclick="openReels()">Watch reels →</button></div>${recent.length ? `<div class="hl-grid">${recent.map((p, i) => `<button class="hl" onclick="openReels(${i})">${p.mediaUrl && p.mediaType?.startsWith('image/') ? `<img src="${esc(p.mediaUrl)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">` : art(p.art)}<span>${esc(p.name)}<small>${esc(p.caption.slice(0, 42))}${p.caption.length > 42 ? '…' : ''}</small></span></button>`).join('')}</div>` : '<div class="empty">No posts yet. Be the first to share a highlight.</div>'}</div>
  <aside class="rail">${seasonCard()}${FEATURES.workouts ? weekCard() : ''}</aside></div>`;
}

/* Front-page ranking chart: top players in your city by player points, with your spot. */
function rankChart() {
  if (!S.loaded.players) return `<div class="sec"><h2>${esc(myCity())} rankings</h2></div><div class="loading">Loading rankings…</div>`;
  const all = S.players.filter(p => ok(p.id)).sort((a, b) => (b.rp || 0) - (a.rp || 0) || a.name.localeCompare(b.name));
  if (!all.length) return '';
  const top = all.slice(0, 8), myRank = all.findIndex(p => p.id === S.uid), max = Math.max(1, all[0].rp || 0);
  const row = (p, i) => {
    const pts = p.rp || 0, me = p.id === S.uid, w = Math.max(pts > 0 ? 1.5 : 0, pts / max * 100), tip = `#${i + 1} · ${p.name} · ${pts.toLocaleString()} player points · ${p.wins || 0}–${p.losses || 0} · ${tierOf(pts).name}`;
    return `<li><button class="rk-row ${me ? 'me' : ''}" onclick="openProfile('${p.id}')" aria-label="${esc(tip)}. Open profile."><span class="rk-n">${i + 1}</span><span class="rk-name">${esc(p.name)}${me ? ' <em>You</em>' : ''}<small>${p.wins || 0}–${p.losses || 0} · ${tierOf(pts).name}</small></span><span class="rk-track" aria-hidden="true"><i style="width:${w.toFixed(1)}%"></i></span><span class="rk-val">${pts.toLocaleString()}</span><span class="rk-tip" role="tooltip">${esc(tip)}</span></button></li>`;
  };
  const extra = myRank >= top.length ? `<li class="rk-gap" aria-hidden="true">···</li>${row(all[myRank], myRank)}` : '';
  return `<div class="sec"><h2>${esc(myCity())} rankings</h2><button class="link" onclick="go('play',{play:'players'})">Full list →</button></div><section class="card rankchart" aria-label="Top players in ${esc(myCity())} by player points"><div class="rk-head"><span class="label">Player · record</span><span class="label">Player points</span></div><ol class="rk">${top.map(row).join('')}${extra}</ol><p class="muted rk-foot">${myRank >= 0 ? `You’re <b>#${myRank + 1}</b> of ${all.length} in ${esc(myCity())}. ` : ''}Win confirmed games to earn player points.</p></section>`;
}

/* ================= Play ================= */
function play() {
  const segs = [['games', 'Games'], ['players', 'Rankings'], ['teams', 'Teams'], ['tournaments', 'Tournaments']];
  const btn = S.play === 'teams' ? '<button class="btn btn-primary" onclick="createTeam()">＋ Create a team</button>' : '<button class="btn btn-primary" onclick="postGame()">＋ Post a game</button>';
  return `<div class="greet"><div><div class="label">${esc(myCity())} · ${SEASON.label}</div><h1 style="margin-top:6px">Play</h1></div>${btn}</div><div class="seg" role="tablist">${segs.map(([k, l]) => `<button role="tab" aria-selected="${S.play === k}" class="${S.play === k ? 'on' : ''}" onclick="S.play='${k}';render()">${l}</button>`).join('')}</div>${{ games: playGames, teams: playTeams, players: playPlayers, tournaments: playTours }[S.play]()}`;
}
function playGames() {
  if (!S.loaded.games) return '<div class="loading">Loading games…</div>';
  const fm = S.sport === 'All' ? ['1v1', '2v2', '3v3', '4v4', '5v5', '6v6', '7v7'] : FORMATS[S.sport];
  const list = S.games.filter(g => ok(g.hostUid) && toDate(g.when) >= startOfDay() && (S.sport === 'All' || g.sport === S.sport) && (S.fmt === 'All' || g.format === S.fmt));
  const groups = {}; list.forEach(g => (groups[dayLabel(toDate(g.when))] ??= []).push(g));
  return `<div class="toolbar"><div class="chips">${['All', ...SPORTS].map(s => `<button class="chip ${S.sport === s ? 'on' : ''}" onclick="S.sport='${s}';S.fmt='All';render()">${s !== 'All' ? `<span class="dot ${sportCls(s)}"></span>` : ''}${s}</button>`).join('')}</div><select aria-label="Game size" onchange="S.fmt=this.value;render()"><option value="All">Any size</option>${fm.map(f => `<option ${S.fmt === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div><div class="games">${Object.entries(groups).map(([d, gs]) => `<div class="day-label">${d}</div>${gs.map(gameRow).join('')}`).join('') || `<div class="empty">No upcoming games in ${esc(myCity())}${S.sport !== 'All' || S.fmt !== 'All' ? ' that match' : ''}. Post the first one.</div>`}</div>
  <button class="card" style="width:100%;text-align:left;margin-top:16px;display:flex;gap:14px;align-items:center" onclick="startGame()"><span style="width:48px;height:48px;border-radius:12px;display:grid;place-items:center;background:var(--surface-2);color:var(--brand)">${ic('whistle', false, 'width="24" height="24"')}</span><span style="flex:1"><b style="display:block">Practice scoreboard</b><small class="muted">Try the clock and scoring without a game.</small></span><span class="link">Open →</span></button>`;
}
function teamRow(t) { const m = myTeamIds().has(t.id); return `<button class="lb-row ${sportCls(t.sport)}" onclick="openTeam('${t.id}')"><span class="dot" style="justify-self:center"></span>${avatar(t.name, 'sm')}<span style="min-width:0"><strong>${esc(t.name)}${m ? ' · Your team' : ''}</strong><small>${esc(t.sport)} · ${t.members.length} player${t.members.length === 1 ? '' : 's'} · ${tierOf(t.rp || 0).name}</small></span><span class="pts">${(t.rp || 0).toLocaleString()}<small>${t.wins || 0}–${t.losses || 0}</small></span></button>` }
function playTeams() {
  if (!S.loaded.teams) return '<div class="loading">Loading teams…</div>';
  const others = S.teams.filter(t => !myTeamIds().has(t.id) && ok(t.captainUid)).sort((a, b) => (b.rp || 0) - (a.rp || 0));
  return `${S.myTeams.length ? `<div class="label" style="margin-bottom:8px">Your teams</div><div class="lb" style="margin-bottom:20px">${S.myTeams.map(teamRow).join('')}</div>` : ''}<div class="label" style="margin-bottom:8px">Teams in ${esc(myCity())}</div><div class="lb">${others.map(teamRow).join('') || '<div class="empty" style="border:0">No other teams here yet. Start one and invite your crew.</div>'}</div>`;
}
// Rankings: my city or the whole world, this season or all-time.
function worldList(period) {
  if (!worldSubs[period]) {
    const q = period === 'season' ? query(collection(db, 'users'), where('seasonKey', '==', SEASON.key), orderBy('seasonRp', 'desc'), limit(100)) : query(collection(db, 'users'), orderBy('rp', 'desc'), limit(100));
    worldSubs[period] = onSnapshot(q, snap => { S.world[period] = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderSoon() }, fail('world rankings'));
  }
  return S.world[period];
}
function playPlayers() {
  const scope = S.rankScope, period = S.rankPeriod, md = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const filters = `<div class="rank-filters"><div class="seg seg-sm" role="group" aria-label="Where">${[['city', '⌖ ' + myCity()], ['world', '🌎 World']].map(([k, l]) => `<button class="${scope === k ? 'on' : ''}" aria-pressed="${scope === k}" onclick="S.rankScope='${k}';render()">${esc(l)}</button>`).join('')}</div><div class="seg seg-sm" role="group" aria-label="When">${[['season', SEASON.label], ['all', 'All-time']].map(([k, l]) => `<button class="${period === k ? 'on' : ''}" aria-pressed="${period === k}" onclick="S.rankPeriod='${k}';render()">${l}</button>`).join('')}</div></div>`;
  const src = scope === 'city' ? (S.loaded.players ? S.players : null) : worldList(period);
  if (!src) return filters + '<div class="loading">Loading rankings…</div>';
  const rows = src.filter(p => ok(p.id)).map(p => ({ p, s: statsFor(p, period) })).filter(x => scope === 'city' || x.s.rp > 0 || x.p.id === S.uid)
    .sort((a, b) => b.s.rp - a.s.rp || a.p.name.localeCompare(b.p.name));
  const row = ({ p, s }, i) => `<button class="lb-row ${p.id === S.uid ? 'me' : ''}" onclick="openProfile('${p.id}')"><span class="n">${i === null ? '—' : i + 1}</span>${avatar(p.name, 'sm')}<span style="min-width:0"><strong>${esc(p.name)}${p.id === S.uid ? ' · You' : ''}</strong><small>${scope === 'world' ? esc(p.city || '') + ' · ' : ''}${tierOf(p.rp || 0).name}</small></span><span class="pts">${s.rp.toLocaleString()}<small>${s.w}–${s.l}</small></span></button>`;
  const meIn = rows.some(x => x.p.id === S.uid), me = { p: { ...S.me, id: S.uid }, s: statsFor(S.me, period) };
  const extra = !meIn ? `<div class="rk-gap" aria-hidden="true">···</div>${row(me, null)}` : '';
  const note = period === 'season' ? `${SEASON.label} runs ${md(SEASON.start)} – ${md(new Date(SEASON.end - 864e5))}. Season points start over ${md(SEASON.end)}.` : 'All points since joining.';
  const where = scope === 'city' ? `in ${esc(myCity())}` : `worldwide${rows.length >= 100 ? ' (top 100)' : ''}`;
  return `${filters}<div class="lb">${rows.map(row).join('') || `<div class="empty" style="border:0">No one has ${period === 'season' ? 'earned points this season' : 'earned points'} yet. Win a confirmed game to get on the board.</div>`}${extra}</div><p class="muted" style="font-size:13px;margin-top:12px">${rows.length} player${rows.length === 1 ? '' : 's'} ${where}, ranked by player points. ${note}${!meIn && scope === 'world' ? ' You’re not in the top 100 yet.' : ''}</p>`;
}
function playTours() {
  const interested = new Set(S.me.tournamentInterest || []);
  return TOURNAMENTS.map(t => `<section class="card tour ${sportCls(t.sport)}" style="margin-bottom:14px"><div class="art-box">${art(t.art)}</div><div class="body"><span class="sportbar"><span class="dot"></span>${t.sport} · ${t.format}</span><h2>${t.name}</h2><p class="muted" style="font-size:13px">${t.when} · ${t.where} · Group play, then single elimination · ${t.size} teams</p><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span class="label">Registration opens soon</span><button class="btn btn-sm ${interested.has(t.name) ? 'btn-ghost' : 'btn-primary'}" onclick="interest('${t.name}')">${interested.has(t.name) ? '✓ Interested' : 'I’m interested'}</button></div></div></section>`).join('') + `<p class="muted" style="font-size:13px">No entry fees or prizes yet. We’ll use the interest list to plan brackets.</p>`;
}
async function interest(name) { const has = (S.me.tournamentInterest || []).includes(name); try { await updateDoc(doc(db, 'users', S.uid), { tournamentInterest: has ? arrayRemove(name) : arrayUnion(name) }); toast(has ? 'Removed from the interest list.' : 'You’re on the interest list.') } catch (e) { console.error(e); toast('Couldn’t save. Try again.') } }

/* ================= Teams ================= */
function createTeam() {
  sheet(`<h2>Create a team</h2><p class="muted">You’ll be the captain. Players ask to join and you approve them.</p><form id="ct"><label class="field" for="ctn"><span>Team name</span><input id="ctn" required minlength="2" maxlength="40" placeholder="e.g. Eastside Buckets"></label><label class="field" for="cts"><span>Sport</span><select id="cts">${SPORTS.map(s => `<option>${s}</option>`).join('')}</select></label><p class="muted" style="font-size:12px;margin-top:10px">Based in ${esc(myCity())}. Up to 15 players.</p><div class="actions"><button type="button" class="btn btn-ghost" onclick="closeSheet()">Cancel</button><button class="btn btn-primary" id="ctgo">Create team</button></div></form>`);
  $('#ct').onsubmit = async e => {
    e.preventDefault(); const name = $('#ctn').value.trim().replace(/\s+/g, ' '); if (name.length < 2) return toast('Name needs at least 2 characters.');
    $('#ctgo').disabled = true;
    try { const r = await addDoc(collection(db, 'teams'), { name, sport: $('#cts').value, city: myCity(), captainUid: S.uid, members: [S.uid], rp: 0, wins: 0, losses: 0, createdAt: serverTimestamp() }); closeSheet(); openTeam(r.id); toast('Team created. Share it so your crew can join.') }
    catch (x) { console.error(x); toast('Couldn’t create the team. Try again.'); $('#ctgo').disabled = false }
  };
}
function openTeam(id) {
  closeSheet(); teamSubs.forEach(u => u()); teamSubs = []; teamInside = []; teamInsideId = null;
  S.team = id; S.teamMsgs = []; S.teamReqs = []; S.myReq[id] = S.myReq[id] ?? null; S.tab = 'team'; render(); window.scrollTo(0, 0);
  teamSubs.push(onSnapshot(doc(db, 'teams', id), d => {
    if (!d.exists()) { S.teamCache[id] = { missing: true }; renderSoon(); return }
    const t = { id, ...d.data() }, isMember = t.members.includes(S.uid);
    S.teamCache[id] = t; ensureUsers(t.members);
    if (isMember && teamInsideId !== id) subscribeTeamInside(id, t);
    if (!isMember && teamInsideId === id) { teamInside.forEach(u => u()); teamInside = []; teamInsideId = null; S.teamMsgs = []; S.teamReqs = [] }
    renderSoon();
  }, fail('this team')));
  getDoc(doc(db, 'teams', id, 'requests', S.uid)).then(d => { S.myReq[id] = d.exists(); renderSoon() }).catch(() => { });
}
let teamInside = [], teamInsideId = null;
function subscribeTeamInside(id, t) {
  teamInside.forEach(u => u()); teamInside = []; teamInsideId = id;
  const chat = onSnapshot(query(collection(db, 'teams', id, 'messages'), orderBy('at', 'desc'), limit(100)), q => { S.teamMsgs = q.docs.map(d => ({ id: d.id, ...d.data() })).reverse(); renderSoon() }, fail('team chat'));
  teamSubs.push(chat); teamInside.push(chat);
  if (t.captainUid === S.uid) { const r = onSnapshot(collection(db, 'teams', id, 'requests'), q => { S.teamReqs = q.docs.map(d => ({ id: d.id, ...d.data() })); const mt = S.myTeams.find(x => x.id === id); if (mt) mt.pending = S.teamReqs.length; renderSoon() }, fail('join requests')); teamSubs.push(r); teamInside.push(r) }
}
function teamPage() {
  const t = S.teamCache[S.team];
  if (!t) return '<div class="loading">Loading team…</div>';
  if (t.missing) return '<div class="empty">This team no longer exists.</div>';
  const member = t.members.includes(S.uid), cap = t.captainUid === S.uid, req = S.myReq[t.id];
  const games = [...S.games, ...S.myGames].filter((g, i, a) => a.findIndex(x => x.id === g.id) === i && (g.homeTeamId === t.id || g.awayTeamId === t.id)).sort((a, b) => toDate(b.when) - toDate(a.when)).slice(0, 8);
  const btns = member ? `${cap ? `<button class="btn btn-primary btn-sm" onclick="postGame('','')">⚔ Post a team game</button><button class="btn btn-ghost btn-sm" onclick="renameTeam()">Rename</button>` : `<button class="btn btn-ghost btn-sm" onclick="leaveTeam()">Leave team</button>`}<button class="btn btn-ghost btn-sm" onclick="shareTeam()">Invite players</button>` : `${req ? '<button class="btn btn-ghost btn-sm" onclick="cancelRequest()">Request sent · Cancel</button>' : `<button class="btn btn-primary btn-sm" onclick="requestJoin()">Ask to join</button>`}${S.myTeams.some(m => m.sport === t.sport && m.captainUid === S.uid) ? `<button class="btn btn-ghost btn-sm" onclick="postGame('${esc(t.name).replace(/'/g, '&#39;')}','${t.id}')">⚔ Challenge</button>` : ''}<button class="btn btn-ghost btn-sm" onclick="moreMenu('team','${t.id}','${t.captainUid}')">⋯</button>`;
  return `<button class="link" style="margin-bottom:14px" onclick="go('play',{play:'teams'})">‹ Back to teams</button><div class="cols two"><div style="min-width:0">
  <section class="pcard"><div class="stripe"></div><div class="label">${esc(t.city)} · ${esc(t.sport)} · Team</div><h1>${esc(t.name)}</h1><span class="tier">★ ${tierOf(t.rp || 0).name}</span><div class="pc-stats"><div><b>${(t.rp || 0).toLocaleString()}</b><span>Player pts</span></div><div><b>${t.wins || 0}–${t.losses || 0}</b><span>Record</span></div><div><b>${t.members.length}</b><span>Players</span></div><div><b>${games.filter(g => g.status !== 'final' && toDate(g.when) > new Date()).length}</b><span>Upcoming</span></div></div><div class="row">${btns}</div></section>
  ${cap && S.teamReqs.length ? `<div class="sec"><h2>Join requests</h2></div><section class="card">${S.teamReqs.filter(r => ok(r.id)).map(r => `<div class="team-row">${avatar(r.name)}<div style="min-width:0"><button onclick="openProfile('${r.id}')"><strong>${esc(r.name)}</strong></button><small>Wants to join</small></div><span style="display:flex;gap:6px"><button class="btn btn-sm btn-primary" onclick="approve('${r.id}')">Approve</button><button class="btn btn-sm btn-ghost" onclick="decline('${r.id}')">Decline</button></span></div>`).join('')}</section>` : ''}
  ${member ? `<div class="sec"><h2>Team chat</h2></div><section class="card team-chat"><div class="bubbles" id="teamchat" onscroll="this.dataset.user=this.scrollTop+this.clientHeight<this.scrollHeight-40?'1':''">${S.teamMsgs.filter(m => ok(m.uid)).map(m => `<div class="bubble ${m.uid === S.uid ? 'me' : ''}">${m.uid === S.uid ? '' : `<b class="who">${esc(m.name)}</b>`}${esc(m.text)}<small>${m.at ? dayLabel(toDate(m.at)) + ', ' + timeOf(toDate(m.at)) : 'Sending…'}</small></div>`).join('') || '<p class="muted" style="text-align:center;margin:auto;font-size:13px">Start the team chat. Set up your next run.</p>'}</div><form class="compose" id="tc"><input id="tci" maxlength="1000" placeholder="Message ${esc(t.name)}…" aria-label="Team message" autocomplete="off"><button class="btn btn-primary btn-sm">Send</button></form></section>` : `<div class="empty" style="margin-top:20px">Team chat is for members. ${req ? 'Your request is waiting for the captain.' : 'Ask to join to chat with the team.'}</div>`}
  </div><aside class="rail" style="display:flex">${teamSide(t, games)}</aside>${window.innerWidth < 960 ? `<div style="display:grid;gap:18px">${teamSide(t, games)}</div>` : ''}</div>`;
}
function teamSide(t, games) {
  const cap = t.captainUid === S.uid;
  return `<section class="card"><div class="label">Roster · ${t.members.length}/15</div>${t.members.map(u => `<div class="team-row">${avatar(nameOf(u))}<div style="min-width:0"><button onclick="openProfile('${u}')"><strong>${esc(nameOf(u))}</strong></button><small>${u === t.captainUid ? 'Captain' : 'Player'}</small></div>${cap && u !== S.uid ? `<button class="btn btn-sm btn-ghost" onclick="removeMember('${u}')">Remove</button>` : '<span></span>'}</div>`).join('')}</section><section class="card"><div class="label">Team games</div>${games.map(g => `<div class="team-row ${sportCls(g.sport)}"><span class="fmt" style="font-size:20px">${esc(g.format)}</span><div style="min-width:0"><strong>${esc(gameTitle(g))}</strong><small>${dayLabel(toDate(g.when))} · ${g.status === 'final' ? 'Final ' + g.final.home + '–' + g.final.away : esc(g.venue)}</small></div><button class="btn btn-ghost btn-sm" onclick="openGame('${g.id}')">View</button></div>`).join('') || '<p class="muted" style="font-size:13px;margin-top:8px">No team games yet.</p>'}</section>`;
}
async function requestJoin() { const t = S.teamCache[S.team]; try { await setDoc(doc(db, 'teams', t.id, 'requests', S.uid), { name: myName(), at: serverTimestamp() }); S.myReq[t.id] = true; render(); toast('Request sent to the captain.') } catch (e) { console.error(e); toast('Couldn’t send the request.') } }
async function cancelRequest() { const t = S.teamCache[S.team]; try { await deleteDoc(doc(db, 'teams', t.id, 'requests', S.uid)); S.myReq[t.id] = false; render() } catch (e) { console.error(e) } }
async function approve(uid) {
  const t = S.teamCache[S.team]; if (t.members.length >= 15) return toast('Teams can have up to 15 players.');
  try { const b = writeBatch(db); b.update(doc(db, 'teams', t.id), { members: arrayUnion(uid), lastChange: uid }); b.delete(doc(db, 'teams', t.id, 'requests', uid)); await b.commit(); toast(nameOf(uid) + ' joined the team.') }
  catch (e) { console.error(e); toast('Couldn’t approve. Try again.') }
}
async function decline(uid) { try { await deleteDoc(doc(db, 'teams', S.team, 'requests', uid)) } catch (e) { console.error(e) } }
function removeMember(uid) {
  sheet(`<h2>Remove ${esc(nameOf(uid))}?</h2><p class="muted">They’ll lose access to team chat. They can ask to join again later.</p><div class="actions"><button class="btn btn-ghost" onclick="closeSheet()">Keep</button><button class="btn btn-primary" id="rm">Remove</button></div>`);
  $('#rm').onclick = async () => { try { await updateDoc(doc(db, 'teams', S.team), { members: arrayRemove(uid), lastChange: uid }); closeSheet(); toast('Removed.') } catch (e) { console.error(e); toast('Couldn’t remove. Try again.') } };
}
function leaveTeam() {
  sheet(`<h2>Leave the team?</h2><p class="muted">You’ll lose access to team chat.</p><div class="actions"><button class="btn btn-ghost" onclick="closeSheet()">Stay</button><button class="btn btn-primary" id="lv">Leave</button></div>`);
  $('#lv').onclick = async () => { try { await updateDoc(doc(db, 'teams', S.team), { members: arrayRemove(S.uid) }); closeSheet(); toast('You left the team.') } catch (e) { console.error(e); toast('Couldn’t leave. Try again.') } };
}
function renameTeam() {
  const t = S.teamCache[S.team];
  sheet(`<h2>Team settings</h2><form id="rn"><label class="field" for="rnn"><span>Team name</span><input id="rnn" required minlength="2" maxlength="40" value="${esc(t.name)}"></label><div class="actions">${t.members.length === 1 ? '<button type="button" class="btn btn-ghost" id="deltm">Delete team</button>' : ''}<button type="button" class="btn btn-ghost" onclick="closeSheet()">Cancel</button><button class="btn btn-primary">Save</button></div>${t.members.length > 1 ? '<p class="muted" style="font-size:12px;margin-top:10px">To delete the team, remove the other players first.</p>' : ''}</form>`);
  $('#rn').onsubmit = async e => { e.preventDefault(); try { await updateDoc(doc(db, 'teams', t.id), { name: $('#rnn').value.trim().replace(/\s+/g, ' ') }); closeSheet(); toast('Saved.') } catch (x) { console.error(x); toast('Couldn’t save.') } };
  const del = $('#deltm'); if (del) del.onclick = async () => { try { await deleteDoc(doc(db, 'teams', t.id)); closeSheet(); go('play', { play: 'teams' }); toast('Team deleted.') } catch (x) { console.error(x); toast('Couldn’t delete.') } };
}
function shareTeam() { const url = location.origin + '/#team/' + S.team; (navigator.share ? navigator.share({ title: S.teamCache[S.team].name, text: 'Join my team on NextMatch', url }) : navigator.clipboard.writeText(url).then(() => toast('Invite link copied.'))).catch(() => { }) }

/* ================= Create menu, posts, workouts ================= */
function openCreate() { sheet(`<h2>What’s the play?</h2>${[['swords', 'Post a game', 'Pickup or team challenge', 'postGame()'], ['users', 'Create a team', 'Roster and team chat', 'createTeam()'], ['camera', 'Share a highlight', FEATURES.uploads ? 'Photo or video from your game' : 'Tell everyone how the run went', "newPost('Highlight')"], ...(FEATURES.workouts ? [['dumbbell', 'Log a workout', 'Training and fitness points', "newPost('Training')"]] : []), ['whistle', 'Practice scoreboard', 'Run the clock and score', 'startGame()']].map(o => `<button class="create-opt" onclick="closeSheet();${o[3]}"><span class="ic">${ic(o[0])}</span><span><b>${o[1]}</b><small>${o[2]}</small></span><span class="muted">›</span></button>`).join('')}`) }
function newPost(kind, prefill = '') {
  sheet(`<h2>${kind === 'Training' ? 'Log a workout' : 'Share a highlight'}</h2><form id="np"><label class="field" for="npc"><span>Caption</span><textarea id="npc" required maxlength="1000" placeholder="${kind === 'Training' ? 'What did you work on? How did it feel?' : 'What happened out there?'}">${esc(prefill)}</textarea></label><label class="field" for="npa"><span>Sport</span><select id="npa">${SPORTS.map(s => `<option>${s}</option>`).join('')}</select></label>${FEATURES.uploads ? `<label class="field" for="npf"><span>Photo or video (optional, up to 25 MB)</span><input id="npf" type="file" accept="image/*,video/*"></label>` : ''}<p id="nperr" class="auth-err" hidden></p><div class="actions"><button type="button" class="btn btn-ghost" onclick="closeSheet()">Cancel</button><button class="btn btn-primary" id="npgo">Post</button></div></form>`);
  $('#np').onsubmit = async e => {
    e.preventDefault(); const cap = $('#npc').value.trim(), err = $('#nperr'), f = $('#npf')?.files[0];
    if (!cap) { err.hidden = false; err.textContent = 'Write a caption first.'; return }
    if (f && f.size > 25 * 1024 * 1024) { err.hidden = false; err.textContent = 'Pick a file under 25 MB.'; return }
    $('#npgo').disabled = true; $('#npgo').textContent = f ? 'Uploading…' : 'Posting…';
    try {
      let mediaUrl = null, mediaType = null;
      if (f) { const st = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js'); const r = st.ref(st.getStorage(fb), `posts/${S.uid}/${Date.now()}_${f.name.replace(/[^\w.-]/g, '_').slice(-60)}`); await st.uploadBytes(r, f, { contentType: f.type }); mediaUrl = await st.getDownloadURL(r); mediaType = f.type }
      const sp = $('#npa').value;
      await addDoc(collection(db, 'posts'), { uid: S.uid, name: myName(), city: myCity(), kind, caption: cap, sport: sp, art: kind === 'Training' ? 'train' : sp === 'Flag football' ? 'football' : (Math.random() < .5 ? 'ball' : 'court'), mediaUrl, mediaType, likedBy: [], createdAt: serverTimestamp() });
      closeSheet(); go('feed', { feed: 'all' }); toast('Posted.');
    } catch (x) { console.error(x); err.hidden = false; err.textContent = 'Couldn’t post. Check your connection and try again.'; $('#npgo').disabled = false; $('#npgo').textContent = 'Post' }
  };
}
function doWorkout(id) {
  const w = WEEKLY.find(x => x.id === id);
  sheet(`<div class="label">Weekly challenge · +${w.fp} FP</div><h2 style="margin-top:8px">${w.t}</h2><p class="muted">${w.d}. You can complete each challenge once a week.</p><form id="wk"><label style="display:flex;gap:10px;align-items:start;margin-top:14px;font-size:14px" for="wkc"><input id="wkc" type="checkbox" required style="width:auto;margin-top:4px;accent-color:var(--brand)">I finished this challenge myself.</label><div class="actions"><button type="button" class="btn btn-ghost" onclick="closeSheet()">Cancel</button><button class="btn btn-primary">Claim +${w.fp} FP</button></div></form>`);
  $('#wk').onsubmit = async e => { e.preventDefault(); const wk = weekKey(); try { await setDoc(doc(db, 'users', S.uid, 'workouts', wk + '_' + id), { challenge: id, week: wk, fp: w.fp, at: serverTimestamp() }); closeSheet(); toast('+' + w.fp + ' fitness points.') } catch (x) { console.error(x); toast('Already claimed this week, or no connection.') } };
}

/* ================= Feed ================= */
function postCard(p) {
  const l = (p.likedBy || []).includes(S.uid), when = toDate(p.createdAt);
  return `<article class="post"><div class="post-head"><button onclick="openProfile('${p.uid}')">${avatar(p.name)}</button><div><button onclick="openProfile('${p.uid}')"><strong>${esc(p.name)}</strong></button><small>${ago(when)} · ${esc(p.city || '')}</small></div><span class="kind">${esc(p.kind)}</span><button class="more" aria-label="More options" onclick="moreMenu('post','${p.id}','${p.uid}')">⋯</button></div><p class="cap">${esc(p.caption)}</p><div class="media">${p.mediaUrl ? (p.mediaType?.startsWith('video/') ? `<video src="${esc(p.mediaUrl)}" controls playsinline preload="metadata"></video>` : `<img src="${esc(p.mediaUrl)}" alt="Photo from ${esc(p.name)}" loading="lazy">`) : art(p.art)}</div><div class="acts"><button class="${l ? 'on' : ''}" aria-pressed="${l}" onclick="like('${p.id}')">${ic('heart', l)} ${(p.likedBy || []).length}</button><button onclick="openComments('${p.id}','${p.uid}')">${ic('chat')} Comment</button><button onclick="share()">${ic('share')} Share</button></div></article>`;
}
const visiblePosts = list => list.filter(p => ok(p.uid) && (!p.hidden || p.uid === S.uid) && (FEATURES.workouts || p.kind !== 'Training'));
async function like(id) { const p = S.posts.find(x => x.id === id) || Object.values(S.profilePosts).flat().find(x => x.id === id); if (!p) return; const l = (p.likedBy || []).includes(S.uid); try { await updateDoc(doc(db, 'posts', id), { likedBy: l ? arrayRemove(S.uid) : arrayUnion(S.uid) }) } catch (e) { console.error(e); toast('Couldn’t save your like.') } }
function deletePost(id) { sheet(`<h2>Delete this post?</h2><p class="muted">It will be removed for everyone.</p><div class="actions"><button class="btn btn-ghost" onclick="closeSheet()">Keep it</button><button class="btn btn-primary" id="dp">Delete</button></div>`); $('#dp').onclick = async () => { try { await deleteDoc(doc(db, 'posts', id)); closeSheet(); toast('Post deleted.') } catch (e) { console.error(e); toast('Couldn’t delete. Try again.') } } }
function share() { const url = location.origin; (navigator.share ? navigator.share({ title: 'NextMatch', text: 'Find a pickup game with me on NextMatch', url }) : navigator.clipboard.writeText(url).then(() => toast('Link copied.'))).catch(() => { }) }
function openComments(pid, owner) {
  sheet(`<h2>Comments</h2><div id="clist"><div class="loading">Loading…</div></div>${S.blocked.has(owner) ? '' : `<form id="cf" class="compose" style="padding:12px 0 0;border:0"><input id="cfi" maxlength="500" placeholder="Add a comment…" aria-label="Comment" autocomplete="off"><button class="btn btn-primary btn-sm">Post</button></form>`}`);
  commentSub = onSnapshot(query(collection(db, 'posts', pid, 'comments'), orderBy('at'), limit(100)), q => { const el = $('#clist'); if (!el) return; el.innerHTML = q.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => ok(c.uid)).map(c => `<div class="comment">${avatar(c.name, 'sm')}<div><strong>${esc(c.name)}</strong><p>${esc(c.text)}</p></div>${c.uid === S.uid ? `<button class="link" onclick="delComment('${pid}','${c.id}')">Delete</button>` : `<button class="link" style="color:var(--muted)" onclick="reportSheet('message','${pid}/${c.id}','${c.uid}','this comment')">Report</button>`}</div>`).join('') || '<p class="muted" style="padding:10px 0">No comments yet. Start the conversation.</p>' }, fail('comments'));
  const f = $('#cf'); if (f) f.onsubmit = async e => { e.preventDefault(); const t = $('#cfi').value.trim(); if (!t) return; $('#cfi').value = ''; try { await addDoc(collection(db, 'posts', pid, 'comments'), { uid: S.uid, name: myName(), text: t, at: serverTimestamp() }) } catch (x) { console.error(x); toast('Couldn’t post your comment.') } };
}
async function delComment(pid, cid) { try { await deleteDoc(doc(db, 'posts', pid, 'comments', cid)) } catch (e) { console.error(e) } }
function feed() {
  const segs = [['all', 'For you'], ['following', 'Following'], ...(FEATURES.workouts ? [['training', 'Training']] : [])];
  const list = visiblePosts(S.posts).filter(p => S.feed === 'all' || (S.feed === 'training' ? p.kind === 'Training' : S.following.has(p.uid) || p.uid === S.uid));
  const suggest = S.players.filter(p => p.id !== S.uid && !S.following.has(p.id) && ok(p.id)).slice(0, 5);
  return `<div class="cols two"><div style="min-width:0"><div class="greet"><h1>Feed</h1><button class="btn btn-ghost btn-sm" onclick="openReels()">▶ Reels</button></div><div class="seg">${segs.map(([k, l]) => `<button class="${S.feed === k ? 'on' : ''}" onclick="S.feed='${k}';render()">${l}</button>`).join('')}</div><div class="composer">${avatar(myName())}<button onclick="newPost('Highlight')">Share a highlight, ${esc(first())}…</button></div>${!S.loaded.posts ? '<div class="loading">Loading posts…</div>' : list.map(postCard).join('') || `<div class="empty">${S.feed === 'following' ? 'Follow players to fill this feed.' : 'Nothing here yet. Post the first one.'}</div>`}</div><aside class="rail"><section class="card"><div class="label">Players in ${esc(myCity())}</div>${suggest.map(p => `<div class="team-row">${avatar(p.name)}<div style="min-width:0"><button onclick="openProfile('${p.id}')"><strong>${esc(p.name)}</strong></button><small>${esc((p.sports || []).join(' · '))}</small></div><button class="btn btn-sm btn-primary" onclick="follow('${p.id}')">Follow</button></div>`).join('') || '<p class="muted" style="font-size:13px;margin-top:8px">You’re following everyone here. Invite more friends.</p>'}<button class="btn btn-ghost btn-sm" style="margin-top:12px;width:100%" onclick="share()">Invite friends</button></section></aside></div>`;
}
async function follow(uid) { const f = S.following.has(uid), r = doc(db, 'users', S.uid, 'following', uid); try { f ? await deleteDoc(r) : await setDoc(r, { at: serverTimestamp() }); toast(f ? 'Unfollowed.' : 'Following.') } catch (e) { console.error(e); toast('Couldn’t update. Try again.') } }

/* ================= Reels ================= */
function openReels(start = 0) {
  const list = visiblePosts(S.posts); if (!list.length) return toast('No posts yet.');
  $('#overlay').innerHTML = `<div class="reels" role="dialog" aria-label="Reels"><button class="reels-close" aria-label="Close reels" onclick="closeOverlay()">✕</button><div class="reels-stream" id="rs" tabindex="0">${list.map(p => { const l = (p.likedBy || []).includes(S.uid); return `<article class="reel">${p.mediaUrl ? (p.mediaType?.startsWith('video/') ? `<video src="${esc(p.mediaUrl)}" autoplay muted loop playsinline></video>` : `<img src="${esc(p.mediaUrl)}" alt="">`) : art(p.art)}<div class="reel-txt"><div style="display:flex;gap:10px;align-items:center">${avatar(p.name, 'sm')}<b style="margin:0">${esc(p.name)}</b></div><b>${esc(p.caption)}</b><small>${esc(p.kind)} · ${ago(toDate(p.createdAt))}</small></div><div class="reel-acts"><button class="${l ? 'on' : ''}" aria-label="Like" onclick="like('${p.id}').then(()=>openReels(${list.indexOf(p)}))">${ic('heart', l)}${(p.likedBy || []).length}</button>${p.uid !== S.uid ? `<button aria-label="View profile" onclick="closeOverlay();openProfile('${p.uid}')">${ic('me')}Profile</button>` : ''}<button aria-label="Share" onclick="share()">${ic('share')}Share</button></div></article>` }).join('')}</div></div>`;
  const rs = $('#rs'); rs.scrollTop = start * rs.clientHeight; rs.focus();
}
function closeOverlay() { $('#overlay').innerHTML = '' }

/* ================= Notifications ================= */
function openNotifs(markRead = true) {
  const list = S.notifs;
  const body = `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h2>Notifications</h2>${list.length ? '<button class="link" onclick="clearNotifs()">Clear all</button>' : ''}</div>${pushBanner()}${list.map(n => `<button class="notif ${n.read ? '' : 'new'}" onclick="closeSheet();routeTo('${esc(n.link || '')}')"><span class="nicon">${{ join: '＋', confirm: '✓', final: '★', disputed: '!', reminder: '◷', team: '⚑' }[n.type] || '•'}</span><span><strong>${esc(n.title)}</strong><small>${esc(n.body)}</small><small class="when">${n.at ? ago(toDate(n.at)) : ''}</small></span></button>`).join('') || '<p class="muted" style="padding:20px 0">Nothing yet. Game reminders, score confirmations and join requests show up here.</p>'}`;
  if ($('#notifsheet')) $('#notifsheet').innerHTML = body; else sheet(`<div id="notifsheet">${body}</div>`, 'notifs');
  if (markRead) { const unread = list.filter(n => !n.read); if (unread.length) { const b = writeBatch(db); unread.forEach(n => b.update(doc(db, 'users', S.uid, 'notifications', n.id), { read: true })); b.commit().catch(e => console.error(e)) } }
}
async function clearNotifs() { const b = writeBatch(db); S.notifs.forEach(n => b.delete(doc(db, 'users', S.uid, 'notifications', n.id))); try { await b.commit() } catch (e) { console.error(e) } }
const pushSupported = () => FEATURES.pushKey && 'serviceWorker' in navigator && 'Notification' in window && 'PushManager' in window;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
function pushBanner() {
  if (!FEATURES.pushKey) return '';
  if (pushSupported() && Notification.permission === 'granted') return '';
  if (isIOS() && !standalone()) return `<div class="push-banner">To get alerts on iPhone: tap <b>Share</b> → <b>Add to Home Screen</b>, open NextMatch from your home screen, then turn on notifications.</div>`;
  if (!pushSupported()) return '';
  if (Notification.permission === 'denied') return '<div class="push-banner">Notifications are blocked for this site. Allow them in your browser’s site settings to get game reminders.</div>';
  return `<div class="push-banner"><span>Get game reminders and messages on this device.</span><button class="btn btn-primary btn-sm" onclick="enablePush()">Turn on</button></div>`;
}
async function enablePush(quiet = false) {
  if (!pushSupported()) { if (!quiet) toast(isIOS() && !standalone() ? 'Add NextMatch to your Home Screen first, then try again.' : 'This browser doesn’t support notifications.'); return }
  try {
    if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') { if (!quiet) toast('Notifications stay off. You can change this in your browser settings.'); return }
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js?config=' + encodeURIComponent(JSON.stringify(firebaseConfig)));
    const m = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js');
    const messaging = m.getMessaging(fb);
    const token = await m.getToken(messaging, { vapidKey: FEATURES.pushKey, serviceWorkerRegistration: reg });
    if (!token) throw new Error('no token');
    const r = doc(db, 'users', S.uid, 'tokens', token);
    if (!(await getDoc(r)).exists()) await setDoc(r, { at: serverTimestamp(), ua: navigator.userAgent.slice(0, 200) });
    ls.set('pushToken', token);
    m.onMessage(messaging, p => toast((p.notification?.title || '') + (p.notification?.body ? ': ' + p.notification.body : '')));
    if (!quiet) { toast('Notifications are on for this device.'); if ($('#notifsheet')) openNotifs(false); renderSoon() }
  } catch (e) { console.error(e); if (!quiet) toast('Couldn’t turn on notifications. Try again later.') }
}

/* ================= Safety: report and block ================= */
function moreMenu(type, id, uid) {
  const mineItem = uid === S.uid, label = { post: 'post', game: 'game', team: 'team', user: 'player' }[type];
  const items = [];
  if (type === 'post' && mineItem) items.push(`<button class="create-opt" onclick="deletePost('${id}')"><span class="ic">✕</span><span><b>Delete post</b><small>Removes it for everyone</small></span></button>`);
  if (!mineItem) {
    items.push(`<button class="create-opt" onclick="reportSheet('${type}','${id}','${uid}','this ${label}')"><span class="ic">⚑</span><span><b>Report ${label}</b><small>Only the NextMatch team sees reports</small></span></button>`);
    if (uid) items.push(S.blocked.has(uid) ? `<button class="create-opt" onclick="unblock('${uid}')"><span class="ic">↺</span><span><b>Unblock ${esc(nameOf(uid))}</b><small>See their posts and games again</small></span></button>` : `<button class="create-opt" onclick="blockSheet('${uid}')"><span class="ic">⊘</span><span><b>Block ${esc(nameOf(uid))}</b><small>Hide them and stop their messages</small></span></button>`);
  }
  ensureUsers([uid]);
  sheet(`<h2>Options</h2>${items.join('') || '<p class="muted">Nothing to do here.</p>'}<div class="actions"><button class="btn btn-ghost" onclick="closeSheet()">Close</button></div>`);
}
const REASONS = ['Harassment or hate', 'Spam or scam', 'Inappropriate content', 'Cheating or fake results', 'Unsafe at a game', 'Other'];
function reportSheet(type, id, uid, what) {
  sheet(`<h2>Report ${esc(what)}</h2><p class="muted">Reports are private. The person isn’t told who reported them.</p><form id="rp"><fieldset class="reasons"><legend class="label">What’s wrong?</legend>${REASONS.map((r, i) => `<label class="reason" for="rr${i}"><input type="radio" name="rr" id="rr${i}" value="${r}" ${i === 0 ? 'required' : ''}>${r}</label>`).join('')}</fieldset><label class="field" for="rpd"><span>Details (optional)</span><textarea id="rpd" maxlength="500" placeholder="What happened? Include dates or game details if it helps."></textarea></label>${uid && uid !== S.uid && !S.blocked.has(uid) ? `<label class="reason" for="rpb" style="margin-top:12px"><input type="checkbox" id="rpb">Also block ${esc(nameOf(uid))}</label>` : ''}<p class="muted" style="font-size:12px;margin-top:10px">If someone is in danger, call 911.</p><div class="actions"><button type="button" class="btn btn-ghost" onclick="closeSheet()">Cancel</button><button class="btn btn-primary" id="rpgo">Send report</button></div></form>`);
  $('#rp').onsubmit = async e => {
    e.preventDefault(); const reason = document.querySelector('input[name=rr]:checked')?.value; if (!reason) return toast('Pick a reason.');
    $('#rpgo').disabled = true;
    try { await addDoc(collection(db, 'reports'), { by: S.uid, targetType: type, targetId: String(id).slice(0, 200), targetUid: uid || '', reason, details: $('#rpd').value.trim().slice(0, 500), at: serverTimestamp() }); if ($('#rpb')?.checked) await block(uid, true); closeSheet(); toast('Thanks. Your report was sent.') }
    catch (x) { console.error(x); toast('Couldn’t send the report. Try again.'); $('#rpgo').disabled = false }
  };
}
function blockSheet(uid) {
  sheet(`<h2>Block ${esc(nameOf(uid))}?</h2><p class="muted">You won’t see their posts, games, comments or messages, and they can’t message you or comment on your posts. They aren’t told.</p><div class="actions"><button class="btn btn-ghost" onclick="closeSheet()">Cancel</button><button class="btn btn-primary" id="bk">Block</button></div>`);
  $('#bk').onclick = () => block(uid);
}
async function block(uid, quiet = false) {
  try { await setDoc(doc(db, 'users', S.uid, 'blocked', uid), { at: serverTimestamp() }); if (S.following.has(uid)) await deleteDoc(doc(db, 'users', S.uid, 'following', uid)); if (!quiet) { closeSheet(); toast('Blocked.'); if (S.tab === 'profile' || S.tab === 'messages') go('today') } }
  catch (e) { console.error(e); toast('Couldn’t block. Try again.') }
}
async function unblock(uid) { try { await deleteDoc(doc(db, 'users', S.uid, 'blocked', uid)); closeSheet(); toast('Unblocked.') } catch (e) { console.error(e) } }

/* ================= Me and other players ================= */
function playerCard(p, buttons) {
  const rp = p.rp || 0;
  return `<section class="pcard"><div class="stripe"></div><div class="num">${String(rp % 90 + 1)}</div><div class="label">${esc(p.city || '')} · ${esc((p.sports || []).join(' · '))}</div><h1>${esc(p.name)}</h1><span class="tier">★ ${tierOf(rp).name}</span><div class="pc-stats"><div><b>${rp.toLocaleString()}</b><span>Player pts</span></div><div><b>${p.wins || 0}–${p.losses || 0}</b><span>Record</span></div><div><b>${(p.scored || 0).toLocaleString()}</b><span>Pts scored</span></div><div><b>${p.id === S.uid && FEATURES.workouts ? fpTotal() : (p.id === S.uid ? S.myTeams.length : S.teams.filter(t => t.members.includes(p.id)).length)}</b><span>${p.id === S.uid && FEATURES.workouts ? 'Fitness' : 'Teams'}</span></div></div><div class="row">${buttons}</div></section>`;
}
function resultRow(g) { const sd = sideOf(g), f = g.final, won = f.winner === sd; return `<button class="result" style="width:100%;text-align:left" onclick="openGame('${g.id}')"><span class="wl ${f.winner ? (won ? 'w' : 'l') : 'l'}">${f.winner ? (won ? 'W' : 'L') : 'D'}</span><div style="min-width:0"><strong>${f[sd]}–${f[other(sd)]} vs ${esc(sideName(g, other(sd)))}</strong><small>${esc(g.format)} · You scored ${scoredBy(g, S.uid, sd)} · +${earnedBy(g, S.uid, sd)} pts</small></div><span class="mono muted" style="font-size:12px">${toDate(g.when).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></button>` }
function mePage() {
  const myPosts = visiblePosts(S.posts.filter(p => p.uid === S.uid)), upcoming = S.myGames.filter(g => g.status === 'open' && toDate(g.when) >= startOfDay()).sort((a, b) => toDate(a.when) - toDate(b.when)), done = S.myGames.filter(g => g.status === 'final');
  return `<div class="cols two"><div style="min-width:0">${playerCard({ ...S.me, id: S.uid }, `<button class="btn btn-primary btn-sm" onclick="editMe()">Edit profile</button><button class="btn btn-ghost btn-sm" onclick="share()">Invite friends</button>`)}<div class="sec"><h2>Your games</h2></div><div class="games">${upcoming.map(gameRow).join('') || '<div class="empty">You haven’t joined any upcoming games.</div>'}</div><div class="sec"><h2>Results</h2></div><section class="card">${done.map(resultRow).join('') || '<p class="muted" style="font-size:13px">Confirmed results show up here.</p>'}</section><div class="sec"><h2>Your posts</h2><button class="link" onclick="newPost('Highlight')">＋ New</button></div>${myPosts.map(postCard).join('') || '<div class="empty">Share your first highlight.</div>'}</div><aside class="rail" style="display:flex">${meSide()}</aside>${window.innerWidth < 960 ? `<div style="display:grid;gap:18px">${meSide()}</div>` : ''}</div>`;
}
function meSide() {
  const pushOn = pushSupported() && Notification.permission === 'granted' && ls.get('pushToken', '');
  return `<section class="card"><div class="label">Your teams</div>${S.myTeams.map(t => `<div class="team-row ${sportCls(t.sport)}">${avatar(t.name)}<div style="min-width:0"><strong>${esc(t.name)}</strong><small>${t.captainUid === S.uid ? 'Captain' : 'Player'} · ${t.members.length} players</small></div><button class="btn btn-ghost btn-sm" onclick="openTeam('${t.id}')">Open</button></div>`).join('') || '<p class="muted" style="font-size:13px;margin-top:8px">No team yet.</p>'}<button class="btn btn-ghost btn-sm" style="width:100%;margin-top:10px" onclick="go('play',{play:'teams'})">Find or create a team</button></section><section class="card"><div class="label">Settings</div><div class="setrow" style="margin-top:6px"><div><strong>Signed in as</strong><small>${esc(auth.currentUser?.email || 'Google or Apple account')}</small></div></div>${FEATURES.pushKey ? `<div class="setrow"><div><strong>Notifications on this device</strong><small>${pushOn ? 'On: reminders, scores and messages' : 'Game reminders, scores and messages'}</small></div>${pushOn ? '<span class="label">On</span>' : '<button class="btn btn-ghost btn-sm" onclick="enablePush()">Turn on</button>'}</div>` : ''}<div class="setrow"><div><strong>Blocked players</strong><small>${S.blocked.size ? [...S.blocked].map(u => esc(nameOf(u))).join(', ') : 'No one'}</small></div>${S.blocked.size ? '<button class="btn btn-ghost btn-sm" onclick="manageBlocked()">Manage</button>' : ''}</div><div class="setrow"><div><strong>Sign out</strong><small>You can sign back in any time</small></div><button class="btn btn-ghost btn-sm" onclick="doSignOut()">Sign out</button></div></section>`;
}
function manageBlocked() { ensureUsers([...S.blocked]); sheet(`<h2>Blocked players</h2>${[...S.blocked].map(u => `<div class="team-row">${avatar(nameOf(u))}<div><strong>${esc(nameOf(u))}</strong></div><button class="btn btn-ghost btn-sm" onclick="unblock('${u}')">Unblock</button></div>`).join('') || '<p class="muted">No one.</p>'}<div class="actions"><button class="btn btn-ghost" onclick="closeSheet()">Done</button></div>`) }
function editMe() {
  const sp = new Set(S.me.sports || []);
  sheet(`<h2>Edit profile</h2><form id="em"><label class="field" for="emn"><span>Player name</span><input id="emn" required minlength="2" maxlength="40" value="${esc(S.me.name)}"></label><label class="field" for="emc"><span>City</span></label>${cityField('emc', myCity())}<label class="field"><span>Sports</span></label><div class="chips" id="emsp">${SPORTS.map(s => `<button type="button" class="chip ${sp.has(s) ? 'on' : ''}" data-s="${s}" aria-pressed="${sp.has(s)}">${s}</button>`).join('')}</div><p class="muted" style="font-size:12px;margin-top:12px">Posts you already made keep the name you used then.</p><div class="actions"><button type="button" class="btn btn-ghost" onclick="closeSheet()">Cancel</button><button class="btn btn-primary">Save</button></div></form>`);
  bindCityField('emc');
  $('#emsp').querySelectorAll('.chip').forEach(b => b.onclick = () => { b.classList.toggle('on'); b.setAttribute('aria-pressed', b.classList.contains('on')) });
  $('#em').onsubmit = async e => { e.preventDefault(); const name = $('#emn').value.trim().replace(/\s+/g, ' '); if (name.length < 2) return toast('Name needs at least 2 characters.'); const city = await cityName($('#emc').value).catch(() => null); if (!city) return toast('Pick your city from the list. Add the state if needed, like “Springfield, IL”.'); const sports = [...document.querySelectorAll('#emsp .chip.on')].map(b => b.dataset.s); try { await updateDoc(doc(db, 'users', S.uid), { name, city, sports: sports.length ? sports : ['Basketball'] }); closeSheet(); toast('Profile saved.') } catch (x) { console.error(x); toast('Couldn’t save. Try again.') } };
}
async function doSignOut() {
  closeSheet(); S.tab = 'today';
  const t = ls.get('pushToken', ''); if (t) { try { await deleteDoc(doc(db, 'users', S.uid, 'tokens', t)) } catch { } ls.set('pushToken', '') }
  signOut(auth);
}
async function openProfile(uid) {
  closeSheet(); if (uid === S.uid) return go('me');
  S.profile = uid; go('profile');
  await loadUser(uid);
  if (!S.profilePosts[uid]) { try { const q = await getDocs(query(collection(db, 'posts'), where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(30))); S.profilePosts[uid] = q.docs.map(d => ({ id: d.id, ...d.data() })) } catch (e) { fail('their posts')(e); S.profilePosts[uid] = [] } }
  if (S.tab === 'profile' && S.profile === uid) render();
}
function profilePage() {
  const uid = S.profile, p = S.users[uid];
  if (!p) return '<div class="loading">Loading player…</div>';
  if (S.blocked.has(uid)) return `<button class="link" style="margin-bottom:14px" onclick="go('play')">‹ Back to Play</button><div class="empty">You blocked ${esc(p.name)}.<br><button class="btn btn-ghost btn-sm" style="margin-top:12px" onclick="unblock('${uid}')">Unblock</button></div>`;
  const f = S.following.has(uid), theirs = visiblePosts(S.posts.filter(x => x.uid === uid).length ? S.posts.filter(x => x.uid === uid) : (S.profilePosts[uid] || []));
  const games = S.games.filter(g => g.players.includes(uid) && g.status === 'open' && toDate(g.when) >= startOfDay());
  const h2h = S.myGames.filter(g => g.status === 'final' && sideOf(g) && sideOf(g, uid) && sideOf(g) !== sideOf(g, uid));
  const w = h2h.filter(g => g.final.winner === sideOf(g)).length, l = h2h.filter(g => g.final.winner && g.final.winner !== sideOf(g)).length;
  return `<button class="link" style="margin-bottom:14px" onclick="go('play')">‹ Back to Play</button><div class="cols two"><div style="min-width:0">${playerCard(p, `<button class="btn btn-primary btn-sm" onclick="postGame('${esc(p.name).replace(/'/g, '&#39;')}')">⚔ Challenge</button><button class="btn btn-ghost btn-sm" onclick="follow('${uid}')">${f ? 'Following' : 'Follow'}</button><button class="btn btn-ghost btn-sm" onclick="openThread('${uid}')">Message</button><button class="btn btn-ghost btn-sm" aria-label="More options" onclick="moreMenu('user','${uid}','${uid}')">⋯</button>`)}<div class="sec"><h2>Posts</h2></div>${theirs.map(postCard).join('') || '<div class="empty">No posts yet.</div>'}</div><aside class="rail"><section class="card"><div class="label">Head to head</div><h2 style="margin-top:8px">${w}–${l}</h2><p class="muted" style="font-size:13px;margin-top:6px">${h2h.length ? `Your confirmed games against ${esc(p.name.split(' ')[0])}.` : 'No confirmed games against each other yet.'}</p></section><section class="card"><div class="label">Upcoming games</div>${games.map(g => `<div class="team-row ${sportCls(g.sport)}"><span class="fmt" style="font-size:20px">${esc(g.format)}</span><div style="min-width:0"><strong>${esc(g.venue)}</strong><small>${dayLabel(toDate(g.when))}, ${timeOf(toDate(g.when))}</small></div><button class="btn btn-ghost btn-sm" onclick="openGame('${g.id}')">View</button></div>`).join('') || '<p class="muted" style="font-size:13px;margin-top:8px">No upcoming games in your city.</p>'}</section></aside></div>`;
}

/* ================= Messages ================= */
const convoId = o => [S.uid, o].sort().join('_');
const otherOf = c => c.members.find(m => m !== S.uid);
const isUnread = c => c.lastUid && c.lastUid !== S.uid && toDate(c.updatedAt) > new Date(ls.get('seen_' + c.id, 0));
async function openThread(o) {
  closeSheet(); await loadUser(o);
  const id = convoId(o); S.thread = { id, other: o }; S.msgs = []; ls.set('seen_' + id, Date.now());
  threadSub?.(); threadSub = onSnapshot(query(collection(db, 'conversations', id, 'messages'), orderBy('at'), limit(200)), q => { S.msgs = q.docs.map(d => d.data()); ls.set('seen_' + id, Date.now()); renderSoon() }, fail('this conversation'));
  S.tab = 'messages'; render(); window.scrollTo(0, 0);
}
function messages() {
  const t = S.thread, o = t && S.users[t.other], blocked = t && S.blocked.has(t.other);
  return `<div class="greet"><h1>Messages</h1></div><div class="inbox ${t ? 'open' : ''}"><div class="threads">${S.convos.filter(c => ok(otherOf(c))).map(c => { const x = otherOf(c); return `<button class="thread ${t?.id === c.id ? 'on' : ''}" onclick="openThread('${x}')">${avatar(c.names?.[x])}<div style="min-width:0"><strong>${esc(c.names?.[x] || 'Player')}</strong><small>${c.lastUid === S.uid ? 'You: ' : ''}${esc(c.last)}</small></div>${isUnread(c) ? '<span class="unread" aria-label="Unread"></span>' : '<span></span>'}</button>` }).join('') || '<div class="empty" style="border:0">No conversations yet. Open a player’s profile and tap Message.</div>'}</div><div class="convo">${t ? `<div class="convo-head"><button class="link convo-back" onclick="S.thread=null;render()" aria-label="Back to conversations">‹</button>${avatar(o?.name, 'sm')}<div style="flex:1;min-width:0"><button onclick="openProfile('${t.other}')"><strong>${esc(o?.name || 'Player')}</strong></button><small>${esc(o?.city || '')}</small></div><button class="more" aria-label="More options" onclick="moreMenu('user','${t.other}','${t.other}')">⋯</button></div><div class="bubbles" id="bubbles">${S.msgs.map(m => `<div class="bubble ${m.uid === S.uid ? 'me' : ''}">${esc(m.text)}<small>${m.at ? timeOf(toDate(m.at)) : 'Sending…'}</small></div>`).join('') || '<p class="muted" style="text-align:center;margin:auto;font-size:13px">Say hi and set up a game.</p>'}</div>${blocked ? '<p class="muted" style="padding:14px;text-align:center">You blocked this player.</p>' : `<form class="compose" id="mc"><input id="mci" maxlength="1000" placeholder="Message ${esc((o?.name || '').split(' ')[0])}…" aria-label="Message" autocomplete="off"><button class="btn btn-primary btn-sm">Send</button></form>`}` : '<div class="empty" style="margin:auto;border:0">Pick a conversation.</div>'}</div></div>`;
}
document.addEventListener('submit', async e => {
  if (e.target.id === 'mc') {
    e.preventDefault(); const input = $('#mci'), text = input.value.trim(), t = S.thread; if (!text || !t) return;
    input.value = '';
    try {
      await setDoc(doc(db, 'conversations', t.id), { members: t.id.split('_'), names: { [S.uid]: myName(), [t.other]: S.users[t.other]?.name || 'Player' }, last: text.slice(0, 120), lastUid: S.uid, updatedAt: serverTimestamp() }, { merge: true });
      await addDoc(collection(db, 'conversations', t.id, 'messages'), { uid: S.uid, text, at: serverTimestamp() });
    } catch (x) { console.error(x); input.value = text; toast(x?.code === 'permission-denied' ? 'This player isn’t accepting messages from you.' : 'Message not sent. Try again.') }
  }
  if (e.target.id === 'tc') {
    e.preventDefault(); const input = $('#tci'), text = input.value.trim(); if (!text) return;
    input.value = ''; const b = $('#teamchat'); if (b) b.dataset.user = '';
    try { await addDoc(collection(db, 'teams', S.team, 'messages'), { uid: S.uid, name: myName(), text, at: serverTimestamp() }) }
    catch (x) { console.error(x); input.value = text; toast('Message not sent. Try again.') }
  }
});

/* ================= Scoreboard (runs on this device) ================= */
let G = null, T = null;
function startGame(id) {
  closeSheet(); const g = id && getGame(id);
  G = g ? { id: g.id, home: sideName(g, 'home'), away: sideName(g, 'away'), sport: g.sport, format: g.format, venue: g.venue, roster: { h: [...g.home], a: [...g.away] } } : { home: 'Home', away: 'Away', sport: (S.me.sports || ['Basketball'])[0], format: '3v3', venue: 'Practice', roster: null };
  const f = G.sport === 'Flag football';
  Object.assign(G, { pp: {}, pick: null, stage: 1, hs: 0, as: 0, per: 1, maxPer: f ? 2 : 4, perLen: f ? 1200 : 600, rem: f ? 1200 : 600, run: false, t0: 0, base: 0, log: [], hist: [] });
  logIt('Scoreboard opened.'); drawSB();
}
const secs = () => !G ? 0 : G.run ? Math.max(0, G.base - Math.floor((Date.now() - G.t0) / 1000)) : G.rem;
const clk = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
function logIt(t) { G.log.unshift([(G.sport === 'Flag football' ? 'H' : 'Q') + G.per + ' ' + clk(secs()), t]) }
function drawSB() {
  if (!G) { closeOverlay(); return }
  const g = G, s = secs(), inc = g.sport === 'Flag football' ? [1, 2, 6] : [1, 2, 3], game = g.id && getGame(g.id), canReport = game && sideOf(game) && ['open', 'disputed'].includes(game.status) && started(game) && game.home.length && game.away.length;
  let body;
  if (g.stage < 3) body = `<div class="sb-meta"><span class="label">${g.stage === 2 ? 'Final' : g.run ? '● Live' : 'Clock stopped'} · ${g.sport === 'Flag football' ? 'Half' : 'Quarter'} ${g.per}</span></div><div class="led ${g.run ? '' : 'paused'}" id="led">${clk(s)}</div><div class="sb-period">${Array.from({ length: g.maxPer }, (_, i) => `<i class="${i < g.per ? 'on' : ''}"></i>`).join('')}</div><div class="sides">${['h', 'a'].map(k => { const sc = g[k + 's'], ot = g[(k === 'h' ? 'a' : 'h') + 's'], nm = k === 'h' ? g.home : g.away; return `<div class="side ${sc > ot ? 'lead' : ''}"><div class="nm">${esc(nm)}</div><div class="tag">${k === 'h' ? 'HOME' : 'AWAY'}</div><div class="pts">${sc}</div>${g.roster && g.roster[k].length ? `<div class="sb-who">${g.roster[k].map(u => `<span>${esc(nameOf(u).split(' ')[0])} <b>${g.pp[u] || 0}</b></span>`).join('')}</div>` : ''}${g.stage === 1 ? `<div class="add">${inc.map(n => `<button ${g.run ? '' : 'disabled'} aria-label="Add ${n} for ${esc(nm)}" onclick="addPts('${k}',${n})">+${n}</button>`).join('')}</div>` : ''}</div>` }).join('')}</div>${g.pick ? `<div class="sb-pick" role="dialog" aria-label="Who scored"><p>Who scored <b>+${g.pick.n}</b> for ${esc(g.pick.k === 'h' ? g.home : g.away)}?</p><div>${g.roster[g.pick.k].map(u => `<button class="sb-btn go" onclick="pickScorer('${u}')">${esc(nameOf(u))}</button>`).join('')}</div><button class="sb-btn" onclick="cancelPick()">Cancel</button></div>` : ''}${g.stage === 1 ? `${!g.run && s > 0 ? '<p class="sb-note">Start the clock to score.</p>' : ''}${s === 0 ? '<p class="sb-note" style="color:var(--sb-led)">Period over. Move to the next one or finish.</p>' : ''}<div class="sb-ctl"><button class="sb-btn go" ${!g.run && s === 0 ? 'disabled' : ''} onclick="clockToggle()">${g.run ? '❚❚ Stop clock' : '▶ Start clock'}</button><button class="sb-btn" ${g.per >= g.maxPer ? 'disabled' : ''} onclick="nextPer()">Next ${g.sport === 'Flag football' ? 'half' : 'quarter'}</button><button class="sb-btn" ${g.hist.length ? '' : 'disabled'} onclick="undoPts()">Undo</button><button class="sb-btn" onclick="finish()">Finish →</button></div>` : `<div class="sb-box" style="margin-top:18px">Final: <b>${g.hs}–${g.as}</b>. ${canReport ? 'Submit it so the other side can confirm and points get awarded.' : game ? 'You can report the score from the game page once the game has started and both sides have players.' : 'Practice score. Nothing is saved.'}</div><div class="sb-ctl"><button class="sb-btn" onclick="reopenSB()">Fix the score</button>${canReport ? `<button class="sb-btn go" onclick="submitFromSB()">Submit ${g.hs}–${g.as} as final</button>` : ''}<button class="sb-btn ${canReport ? '' : 'go'}" onclick="closeSB();newPost('Highlight','${esc(`${g.home} ${g.hs}, ${g.away} ${g.as}`).replace(/'/g, '&#39;')}')">Post the result</button><button class="sb-btn" onclick="closeSB()">Done</button></div>`}`;
  $('#overlay').innerHTML = `<div class="sb" role="dialog" aria-label="Scoreboard"><div class="sb-in"><div class="sb-top"><button class="sb-x" aria-label="Close scoreboard" onclick="closeSB()">✕</button><div class="sb-steps"></div><span class="label" style="min-width:40px;text-align:right">${esc(g.format)}</span></div>${body}${g.log.length ? `<details class="sb-log"><summary>Game log · ${g.log.length}</summary>${g.log.slice(0, 12).map(l => `<div><small>${l[0]}</small><span>${esc(l[1])}</span></div>`).join('')}</details>` : ''}<p class="sb-note">${g.id ? esc(g.venue) + '. ' : 'Practice mode. '}The live score stays on this device until you submit it.</p></div></div>`;
}
async function submitFromSB() { const id = G.id, h = G.hs, a = G.as, pp = G.roster ? { ...G.pp } : null; closeSB(); await reportScore(id, h, a, pp); openGame(id) }
function pickScorer(uid) { const p = G.pick; G.pick = null; if (p) score(p.k, p.n, uid) }
function cancelPick() { G.pick = null; drawSB() }
function clockToggle() { if (G.run) { G.rem = secs(); G.run = false; clearInterval(T); logIt('Clock stopped.') } else { if (G.rem <= 0) return; G.base = G.rem; G.t0 = Date.now(); G.run = true; logIt('Clock started.'); T = setInterval(() => { const s = secs(), el = $('#led'); if (el) el.textContent = clk(s); if (s === 0) { G.rem = 0; G.run = false; clearInterval(T); logIt('End of period.'); drawSB() } }, 250) } drawSB() }
// In a real game each point goes to a player: ask who scored when a side has more than one.
function addPts(k, n) {
  if (!G.run) return;
  const r = G.roster?.[k] || [];
  if (r.length > 1) { G.pick = { k, n }; drawSB(); return }
  score(k, n, r[0] || null);
}
function score(k, n, uid) {
  G[k + 's'] += n; if (uid) G.pp[uid] = (G.pp[uid] || 0) + n;
  G.hist.push([k, n, uid]); logIt((uid ? nameOf(uid) : k === 'h' ? G.home : G.away) + ' +' + n); drawSB();
}
function undoPts() { const l = G.hist.pop(); if (!l) return; G[l[0] + 's'] -= l[1]; if (l[2]) G.pp[l[2]] -= l[1]; logIt('Undo −' + l[1] + (l[2] ? ' ' + nameOf(l[2]) : '')); drawSB() }
function pauseQ() { if (G?.run) { G.rem = secs(); G.run = false; clearInterval(T) } }
function nextPer() { pauseQ(); G.per++; G.rem = G.perLen; logIt('New period.'); drawSB() }
function finish() { pauseQ(); G.stage = 2; logIt('Final ' + G.hs + '–' + G.as + '.'); drawSB() }
function reopenSB() { G.stage = 1; logIt('Reopened.'); drawSB() }
function closeSB() { pauseQ(); G = null; closeOverlay() }

/* ================= Header and startup ================= */
$('#btn-msg').onclick = () => { S.thread = null; go('messages') };
$('#btn-bell').onclick = () => openNotifs();
$('#citybtn').onclick = () => openCityPicker();
let wide = window.innerWidth >= 960; window.addEventListener('resize', () => { if (wide !== (window.innerWidth >= 960)) { wide = !wide; render() } });

// Inline onclick handlers in the templates call these.
Object.assign(window, { go, render, S, routeTo, setCity, pickScorer, cancelPick, openCreate, openGame, joinGame, leaveGame, cancelGame, postGame, respond, newPost, doWorkout, like, deletePost, share, openComments, delComment, follow, openReels, closeOverlay, editMe, doSignOut, openProfile, openThread, startGame, clockToggle, addPts, undoPts, nextPer, finish, closeSB, reopenSB, submitFromSB, closeSheet, interest, createTeam, openTeam, requestJoin, cancelRequest, approve, decline, removeMember, leaveTeam, renameTeam, shareTeam, openNotifs, clearNotifs, enablePush, moreMenu, reportSheet, blockSheet, unblock, manageBlocked });
