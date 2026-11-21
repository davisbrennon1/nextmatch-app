// Preview backend: an in-browser stand-in for Firebase, filled with sample players,
// teams and games. The real app (public/app.js) runs on top of it unchanged, so the
// preview link shows exactly what players will see. Nothing here is saved; reload to reset.
// It also plays the server's part (points, notifications) and makes sample players
// respond: they confirm scores you report, approve your team requests and reply to messages.

/* ───────── Timestamps and field helpers ───────── */
export class Timestamp {
  constructor(seconds, nanoseconds = 0) { this.seconds = seconds; this.nanoseconds = nanoseconds }
  static fromMillis(ms) { const t = new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6); t._ms = ms; return t }
  static fromDate(d) { return Timestamp.fromMillis(d.getTime()) }
  static now() { return Timestamp.fromMillis(Date.now()) }
  toMillis() { return this._ms ?? this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6) }
  toDate() { return new Date(this.toMillis()) }
  valueOf() { return this.toMillis() }
}
const SENT = Symbol('fieldValue');
export const serverTimestamp = () => ({ [SENT]: 'ts' });
export const arrayUnion = (...vals) => ({ [SENT]: 'union', vals });
export const arrayRemove = (...vals) => ({ [SENT]: 'remove', vals });
export const increment = n => ({ [SENT]: 'inc', n });
const isSent = v => v && typeof v === 'object' && SENT in v;
const isMap = v => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Timestamp) && !isSent(v);
const clone = v => v instanceof Timestamp ? v : Array.isArray(v) ? v.map(clone) : isMap(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : v;
function resolve(v, old) {
  if (isSent(v)) {
    const t = v[SENT];
    if (t === 'ts') return Timestamp.now();
    if (t === 'inc') return (typeof old === 'number' ? old : 0) + v.n;
    const arr = Array.isArray(old) ? [...old] : [];
    if (t === 'union') { v.vals.forEach(x => { if (!arr.includes(x)) arr.push(x) }); return arr }
    if (t === 'remove') return arr.filter(x => !v.vals.includes(x));
  }
  if (isMap(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x, undefined)]));
  if (Array.isArray(v)) return v.map(x => resolve(x));
  return v;
}
function merge(base, data) {
  const out = { ...base };
  for (const [k, v] of Object.entries(data)) out[k] = isMap(v) && isMap(base?.[k]) ? merge(base[k], v) : resolve(v, base?.[k]);
  return out;
}
const autoId = () => Array.from(crypto.getRandomValues(new Uint8Array(15)), b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[b % 62]).join('');
const err = (code, message) => Object.assign(new Error(message || code), { code });

/* ───────── The database ───────── */
const docs = new Map();
const listeners = new Set();
let pending = false;
function changed() { if (pending) return; pending = true; setTimeout(() => { pending = false; listeners.forEach(fire) }, 0) }
function write(path, data, { silent = false } = {}) {
  const before = docs.get(path) ?? null;
  if (data === null) docs.delete(path); else docs.set(path, data);
  changed();
  if (!silent) setTimeout(() => trigger(path, before && clone(before), data && clone(data)), 250);
}
export const getFirestore = () => ({ type: 'firestore' });
export const connectFirestoreEmulator = () => { };
const docRef = path => ({ type: 'doc', path, id: path.split('/').pop() });
const colRef = path => ({ type: 'collection', path, id: path.split('/').pop() });
export function doc(base, ...segs) {
  if (base?.type === 'collection') return docRef(base.path + '/' + (segs[0] ?? autoId()));
  return docRef(segs.join('/'));
}
export function collection(base, ...segs) { return colRef((base?.type === 'doc' ? base.path + '/' : '') + segs.join('/')) }
export const where = (f, op, v) => ({ kind: 'where', f, op, v });
export const orderBy = (f, dir = 'asc') => ({ kind: 'order', f, dir });
export const limit = n => ({ kind: 'limit', n });
export const query = (col, ...cons) => ({ type: 'query', path: col.path, cons });
const val = v => v instanceof Timestamp ? v.toMillis() : v;
const field = (d, f) => f.split('.').reduce((o, k) => o?.[k], d);
function cmp(a, b) { a = val(a); b = val(b); if (a == null) return b == null ? 0 : -1; if (b == null) return 1; return a < b ? -1 : a > b ? 1 : 0 }
function run(target) {
  if (target.type === 'doc') return snapDoc(target.path);
  const prefix = target.path + '/', depth = prefix.split('/').length;
  let rows = [...docs.keys()].filter(p => p.startsWith(prefix) && p.split('/').length === depth).map(p => ({ path: p, data: docs.get(p) }));
  for (const c of target.cons || []) {
    if (c.kind !== 'where') continue;
    rows = rows.filter(({ data }) => {
      const x = field(data, c.f);
      switch (c.op) {
        case '==': return cmp(x, c.v) === 0 && x != null;
        case '!=': return cmp(x, c.v) !== 0;
        case '>=': return x != null && cmp(x, c.v) >= 0;
        case '<=': return x != null && cmp(x, c.v) <= 0;
        case '>': return x != null && cmp(x, c.v) > 0;
        case '<': return x != null && cmp(x, c.v) < 0;
        case 'array-contains': return Array.isArray(x) && x.includes(c.v);
        case 'in': return c.v.includes(x);
        default: return true;
      }
    });
  }
  const orders = (target.cons || []).filter(c => c.kind === 'order');
  if (orders.length) rows.sort((a, b) => { for (const o of orders) { const r = cmp(field(a.data, o.f), field(b.data, o.f)); if (r) return o.dir === 'desc' ? -r : r } return 0 });
  const lim = (target.cons || []).find(c => c.kind === 'limit');
  if (lim) rows = rows.slice(0, lim.n);
  const list = rows.map(r => snapDoc(r.path));
  return { docs: list, size: list.length, empty: !list.length, forEach: f => list.forEach(f) };
}
function snapDoc(path) { const d = docs.get(path); return { id: path.split('/').pop(), ref: docRef(path), exists: () => d !== undefined, data: () => d === undefined ? undefined : clone(d) } }
function fire(l) { try { l.next(run(l.target)) } catch (e) { console.error(e) } }
export function onSnapshot(target, next, error) {
  const l = { target, next: typeof next === 'function' ? next : next.next, error };
  listeners.add(l); setTimeout(() => listeners.has(l) && fire(l), 0);
  return () => listeners.delete(l);
}
export const getDoc = async ref => snapDoc(ref.path);
export const getDocs = async q => run(q.type === 'collection' ? { ...q, cons: [] } : q);
export async function setDoc(ref, data, opts = {}) { const before = docs.get(ref.path); write(ref.path, opts.merge && before ? merge(before, data) : merge({}, data)) }
export async function updateDoc(ref, data) {
  const before = docs.get(ref.path); if (!before) throw err('not-found', 'No document to update.');
  const after = { ...before };
  for (const [k, v] of Object.entries(data)) after[k] = resolve(v, before[k]);
  write(ref.path, after);
}
export async function addDoc(col, data) { const ref = docRef(col.path + '/' + autoId()); await setDoc(ref, data); return ref }
export async function deleteDoc(ref) { if (docs.has(ref.path)) write(ref.path, null) }
export function writeBatch() {
  const ops = [];
  return { set(r, d, o) { ops.push(() => setDoc(r, d, o)); return this }, update(r, d) { ops.push(() => updateDoc(r, d)); return this }, delete(r) { ops.push(() => deleteDoc(r)); return this }, async commit() { for (const op of ops) await op() } };
}
const get = p => docs.get(p);
const put = (p, d) => write(p, d, { silent: true });

/* ───────── Sign-in ───────── */
const auth = { currentUser: null, cbs: new Set() };
const accounts = new Map(); // email -> { uid, password }
export const getAuth = () => auth;
export const connectAuthEmulator = () => { };
export function onAuthStateChanged(a, cb) { auth.cbs.add(cb); setTimeout(() => cb(auth.currentUser), 0); return () => auth.cbs.delete(cb) }
function setUser(u) { auth.currentUser = u; auth.cbs.forEach(cb => cb(u)); drawPanel() }
export async function createUserWithEmailAndPassword(a, email, password) {
  email = email.toLowerCase(); if (accounts.has(email)) throw err('auth/email-already-in-use'); if (password.length < 6) throw err('auth/weak-password');
  const uid = autoId(); accounts.set(email, { uid, password }); setUser({ uid, email, displayName: '' }); return { user: auth.currentUser };
}
export async function signInWithEmailAndPassword(a, email, password) {
  const acct = accounts.get(email.toLowerCase());
  if (!acct || (acct.password && acct.password !== password)) throw err('auth/invalid-credential');
  setUser({ uid: acct.uid, email: email.toLowerCase(), displayName: '' }); return { user: auth.currentUser };
}
export async function sendPasswordResetEmail() { }
export async function signInWithPopup() { setUser({ uid: 'you', email: 'jordan@example.com', displayName: 'Jordan Davis' }); return { user: auth.currentUser } }
export async function signOut() { setUser(null) }
export class GoogleAuthProvider { setCustomParameters() { } }
export class OAuthProvider { constructor(id) { this.providerId = id } addScope() { } }
export const initializeApp = () => ({ name: 'preview' });

/* ───────── Server behaviour (mirrors functions/lib.js) ───────── */
// Player points: 100 for a win, plus 1 bonus point for every point your side scored.
const WIN_POINTS = 100;
const earnedFor = (score, won) => (won ? WIN_POINTS : 0) + Math.max(0, score | 0);
const nameOf = uid => get('users/' + uid)?.name || 'A player';
const sideName = (g, s) => { if (g[s + 'TeamName']) return g[s + 'TeamName']; const ids = g[s] || []; if (!ids.length) return s === 'home' ? g.hostName : 'Challengers'; return nameOf(ids[0]) + (ids.length > 1 ? ` +${ids.length - 1}` : '') };
const whenText = g => g.when.toDate().toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
function notify(uids, n) { [...new Set(uids)].filter(Boolean).forEach(u => put(`users/${u}/notifications/${autoId()}`, { type: n.type, title: n.title, body: n.body, link: n.link || '', read: false, at: Timestamp.now() })) }
function splitResult(g) {
  const score = { home: g.report.home, away: g.report.away };
  const winner = score.home > score.away ? 'home' : score.away > score.home ? 'away' : null;
  const given = g.report.players || {}, players = {};
  for (const side of ['home', 'away']) {
    const ids = g[side] || [], vals = ids.map(u => Number.isInteger(given[u]) && given[u] >= 0 ? given[u] : 0);
    const exact = ids.length > 0 && ids.every(u => u in given) && vals.reduce((a, b) => a + b, 0) === score[side];
    ids.forEach((u, i) => { const scored = exact ? vals[i] : score[side]; players[u] = { side, scored, earned: earnedFor(scored, winner === side), counted: exact || ids.length === 1 } });
  }
  return { score, winner, players, earned: { home: earnedFor(score.home, winner === 'home'), away: earnedFor(score.away, winner === 'away') } };
}
function award(path) {
  const g = get(path); if (!g || g.status !== 'confirmed' || g.awarded) return null;
  const { winner, players, earned } = splitResult(g);
  const record = (d, side) => winner ? (winner === side ? { wins: (d.wins || 0) + 1 } : { losses: (d.losses || 0) + 1 }) : {};
  Object.entries(players).forEach(([u, p]) => { const d = get('users/' + u); if (d) put('users/' + u, { ...d, rp: (d.rp || 0) + p.earned, scored: (d.scored || 0) + (p.counted ? p.scored : 0), ...record(d, p.side) }) });
  ['home', 'away'].forEach(side => { const id = g[side + 'TeamId'], t = id && get('teams/' + id); if (t) put('teams/' + id, { ...t, rp: (t.rp || 0) + earned[side], ...record(t, side) }) });
  put(path, { ...g, status: 'final', awarded: true, final: { home: g.report.home, away: g.report.away, winner, pts: winner ? WIN_POINTS : 0, earned, players: Object.fromEntries(Object.entries(players).map(([u, p]) => [u, { scored: p.scored, earned: p.earned }])) }, finalAt: Timestamp.now() });
  return { winner, earned, players };
}
const BOTS = new Set(['marcus', 'devin', 'chris', 'tyler', 'andre', 'riley', 'sam', 'kendra', 'jaylen', 'omar', 'lucia']);
const human = () => auth.currentUser?.uid;
const later = (ms, fn) => setTimeout(fn, ms);
function trigger(path, before, after) {
  const seg = path.split('/');
  if (seg[0] === 'games' && seg.length === 2 && before && after) gameChanged(path, before, after);
  if (seg[0] === 'teams' && seg[2] === 'requests' && seg.length === 4 && !before && after) joinRequested(seg[1], seg[3], after);
  if (seg[0] === 'conversations' && seg[2] === 'messages' && !before && after) messageSent(seg[1], after);
}
function gameChanged(path, b, g) {
  const id = path.split('/')[1], link = 'game/' + id, title = `${g.format} at ${g.venue}`;
  (g.players || []).filter(u => !(b.players || []).includes(u) && u !== g.hostUid).forEach(u => notify([g.hostUid], { type: 'join', title: `${nameOf(u)} joined your game`, body: `${title}, ${whenText(g)}. ${g.players.length} in so far.`, link }));
  if (b.status !== 'reported' && g.status === 'reported') {
    const r = g.report, other = r.side === 'home' ? g.away : g.home;
    notify(other, { type: 'confirm', title: 'Confirm the final score', body: `${nameOf(r.by)} reported ${sideName(g, 'home')} ${r.home}, ${sideName(g, 'away')} ${r.away}. Confirm it or dispute it.`, link });
    const bot = other.find(u => BOTS.has(u) && u !== human());
    if (r.by === human() && bot) later(2500, () => { const now = get(path); if (now?.status === 'reported') updateDoc(docRef(path), { status: 'confirmed', responseBy: bot }) });
  }
  if (b.status === 'reported' && g.status === 'disputed') notify(g.players, { type: 'disputed', title: 'Score disputed', body: `${nameOf(g.responseBy)} disputed the score for ${title}. Talk it out, then report it again.`, link });
  if (b.status !== 'confirmed' && g.status === 'confirmed') {
    const res = award(path);
    if (res) Object.entries(res.players).forEach(([u, p]) => { const sc = `${g.report.home}–${g.report.away}`; notify([u], { type: 'final', title: `Final: ${sc}`, body: `${res.winner ? `${sideName(g, res.winner)} won ${sc}.` : `A ${sc} draw.`} You earned ${p.earned} player points (${res.winner === p.side ? `${WIN_POINTS} for the win + ` : ''}${p.scored} you scored).`, link }) });
  }
}
function joinRequested(tid, uid, r) {
  const t = get('teams/' + tid); if (!t) return;
  notify([t.captainUid], { type: 'team', title: `${r.name} wants to join ${t.name}`, body: 'Open the team to approve or decline.', link: 'team/' + tid });
  if (BOTS.has(t.captainUid) && t.captainUid !== human()) later(2500, async () => {
    const now = get('teams/' + tid); if (!now || !get(`teams/${tid}/requests/${uid}`) || now.members.length >= 15) return;
    put('teams/' + tid, { ...now, members: [...now.members, uid], lastChange: uid }); put(`teams/${tid}/requests/${uid}`, null);
    notify([uid], { type: 'team', title: `You’re on ${now.name}`, body: `${nameOf(now.captainUid)} approved your request. Say hi in team chat.`, link: 'team/' + tid });
    put(`teams/${tid}/messages/${autoId()}`, { uid: now.captainUid, name: nameOf(now.captainUid), text: `Welcome to ${now.name}, ${nameOf(uid).split(' ')[0]}!`, at: Timestamp.now() });
  });
}
const REPLIES = ['Bet. See you there.', 'I’m down. What time works?', 'Let’s run it. Bring a ball.', 'Good game last time. Rematch soon?', 'Say less. I’ll be there.'];
let replyN = 0;
function messageSent(cid, m) {
  const [a, b] = cid.split('_'), to = m.uid === a ? b : a;
  if (!BOTS.has(to) || m.uid !== human()) return;
  later(1800, () => {
    const text = REPLIES[replyN++ % REPLIES.length];
    put(`conversations/${cid}/messages/${autoId()}`, { uid: to, text, at: Timestamp.now() });
    const c = get('conversations/' + cid) || {}; put('conversations/' + cid, { ...c, members: cid.split('_'), last: text, lastUid: to, updatedAt: Timestamp.now() });
  });
}

/* ───────── Sample data ───────── */
function seed() {
  const ts = ms => Timestamp.fromMillis(ms), H = 36e5, D = 864e5, now = Date.now();
  const at = (days, hour, min = 0) => { const d = new Date(now + days * D); d.setHours(hour, min, 0, 0); return ts(d.getTime()) };
  const soon = () => { const d = new Date(now + 3 * H); d.setMinutes(0, 0, 0); return ts(d.getTime()) };
  const users = {
    you: ['Jordan Davis', ['Basketball'], 1240, 12, 4], marcus: ['Marcus Williams', ['Basketball'], 2480, 24, 6], devin: ['Devin Carter', ['Basketball'], 1985, 18, 7],
    chris: ['Chris Evans', ['Flag football', 'Basketball'], 1180, 10, 6], tyler: ['Tyler Brooks', ['Basketball'], 960, 8, 6], andre: ['Andre Johnson', ['Flag football'], 1410, 11, 7],
    riley: ['Riley Ortiz', ['Flag football'], 1560, 13, 4], sam: ['Sam Patel', ['Basketball'], 640, 5, 5],
    kendra: ['Kendra Reed', ['Basketball'], 1720, 15, 5, 'Dallas'], jaylen: ['Jaylen Brooks', ['Basketball'], 1330, 11, 6, 'Dallas'],
    omar: ['Omar Haddad', ['Flag football'], 1490, 12, 5, 'Houston'], lucia: ['Lucia Flores', ['Basketball', 'Flag football'], 880, 7, 6, 'Houston']
  };
  for (const [id, [name, sports, rp, wins, losses, city = 'Austin']] of Object.entries(users)) {
    put('users/' + id, { name, city, sports, rp, wins, losses, scored: Math.round(rp * 0.31), adult: true, createdAt: ts(now - 40 * D) });
    accounts.set((id === 'you' ? 'jordan' : id) + '@example.com', { uid: id, password: '' });
  }
  const team = (id, name, sport, captainUid, members, rp, wins, losses) => put('teams/' + id, { name, sport, city: 'Austin', captainUid, members, rp, wins, losses, createdAt: ts(now - 30 * D) });
  team('eastside', 'Eastside Buckets', 'Basketball', 'you', ['you', 'tyler', 'sam'], 1840, 16, 6);
  team('northloop', 'North Loop Ballers', 'Basketball', 'marcus', ['marcus', 'devin'], 2210, 20, 5);
  team('outlaws', 'ATX Outlaws', 'Flag football', 'riley', ['riley', 'andre', 'chris'], 1560, 13, 4);
  put('teams/eastside/messages/m1', { uid: 'tyler', name: 'Tyler Brooks', text: 'Who’s got the ball Thursday?', at: ts(now - 5 * H) });
  put('teams/eastside/messages/m2', { uid: 'sam', name: 'Sam Patel', text: 'I got it. Court’s booked for 6.', at: ts(now - 4 * H) });
  put('teams/eastside/requests/chris', { name: 'Chris Evans', at: ts(now - 3 * H) });
  const game = (id, g) => put('games/' + id, { sport: 'Basketball', city: 'Austin', away: [], status: 'open', createdAt: ts(now - 2 * D), ...g, players: [...g.home, ...(g.away || [])] });
  game('marcus1v1', { hostUid: 'marcus', hostName: 'Marcus Williams', format: '1v1', need: 'Open challenge', venue: 'Pease Park Courts', when: soon(), home: ['marcus'] });
  game('pickup3', { hostUid: 'tyler', hostName: 'Tyler Brooks', format: '3v3', need: 'Need players', venue: 'Pan Am Recreation Center', when: at(0, 23, 30) > Timestamp.fromMillis(now + H) ? at(0, 23, 30) : at(1, 19), home: ['tyler', 'sam'], away: ['devin'] });
  game('teamgame', { hostUid: 'you', hostName: 'Jordan Davis', format: '3v3', need: 'Team challenge', venue: 'Pan Am Recreation Center', when: at(2, 18), home: ['you', 'tyler'], away: ['marcus'], homeTeamId: 'eastside', homeTeamName: 'Eastside Buckets', awayTeamId: 'northloop', awayTeamName: 'North Loop Ballers' });
  game('outlaws', { sport: 'Flag football', hostUid: 'riley', hostName: 'Riley Ortiz', format: '5v5', need: 'Need players', venue: 'Zilker Metropolitan Park', when: at(1, 10), home: ['riley', 'andre'] });
  game('devin2v2', { hostUid: 'devin', hostName: 'Devin Carter', format: '2v2', need: 'Open challenge', venue: 'Givens District Park', when: at(3, 18), home: ['devin'] });
  game('dallas1', { city: 'Dallas', hostUid: 'kendra', hostName: 'Kendra Reed', format: '2v2', need: 'Need players', venue: 'Fair Park Courts', when: at(1, 18), home: ['kendra', 'jaylen'] });
  game('houston1', { city: 'Houston', sport: 'Flag football', hostUid: 'omar', hostName: 'Omar Haddad', format: '5v5', need: 'Open challenge', venue: 'Memorial Park', when: at(2, 10), home: ['omar', 'lucia'] });
  game('lastnight', { hostUid: 'you', hostName: 'Jordan Davis', format: '1v1', need: 'Open challenge', venue: 'Mueller Lake Park', when: ts(now - 2 * H), home: ['you'], away: ['chris'] });
  game('twovtwo', { hostUid: 'you', hostName: 'Jordan Davis', format: '2v2', need: 'Team challenge', venue: 'Pan Am Recreation Center', when: ts(now - 3 * H), home: ['you', 'tyler'], away: ['marcus', 'devin'], homeTeamId: 'eastside', homeTeamName: 'Eastside Buckets', awayTeamId: 'northloop', awayTeamName: 'North Loop Ballers' });
  game('needsconfirm', { hostUid: 'devin', hostName: 'Devin Carter', format: '1v1', need: 'Open challenge', venue: 'Givens District Park', when: ts(now - D), home: ['devin'], away: ['you'], status: 'reported', report: { by: 'devin', side: 'home', home: 21, away: 18, players: { devin: 21, you: 18 }, at: ts(now - 20 * H) } });
  game('lostmarcus', { hostUid: 'you', hostName: 'Jordan Davis', format: '1v1', need: 'Open challenge', venue: 'Pease Park Courts', when: ts(now - 5 * D), home: ['you'], away: ['marcus'], status: 'final', awarded: true, report: { by: 'marcus', side: 'away', home: 15, away: 21, at: ts(now - 5 * D) }, final: { home: 15, away: 21, winner: 'away', pts: 100, earned: { home: 15, away: 121 }, players: { you: { scored: 15, earned: 15 }, marcus: { scored: 21, earned: 121 } } } });
  game('beatsam', { hostUid: 'sam', hostName: 'Sam Patel', format: '1v1', need: 'Open challenge', venue: 'Mueller Lake Park', when: ts(now - 8 * D), home: ['sam'], away: ['you'], status: 'final', awarded: true, report: { by: 'you', side: 'away', home: 12, away: 21, at: ts(now - 8 * D) }, final: { home: 12, away: 21, winner: 'away', pts: 100, earned: { home: 12, away: 121 }, players: { sam: { scored: 12, earned: 12 }, you: { scored: 21, earned: 121 } } } });
  const post = (id, uid, kind, caption, art, likedBy, ago) => put('posts/' + id, { uid, name: users[uid][0], city: 'Austin', kind, caption, sport: art === 'football' ? 'Flag football' : 'Basketball', art, mediaUrl: null, mediaType: null, likedBy, createdAt: ts(now - ago) });
  post('p1', 'marcus', 'Highlight', 'Late night runs at Pease. No shortcuts. #HoopLife', 'court', ['devin', 'tyler'], 2 * H);
  post('p2', 'riley', 'Highlight', 'Sunday is our kind of day. One team, one more rep. #ATXOutlaws', 'football', ['andre', 'you'], 5 * H);
  post('p3', 'you', 'Training', 'Leg day. Game-day foundation. Three rounds, controlled reps.', 'train', ['tyler'], D);
  post('p4', 'devin', 'Training', 'Ball handling, footwork and finishing. The details that show up late in games.', 'ball', ['marcus'], 26 * H);
  post('p5', 'chris', 'Highlight', 'Flag pull of the year at Zilker. Still thinking about it.', 'football', [], 2 * D);
  put('posts/p1/comments/c1', { uid: 'devin', name: 'Devin Carter', text: 'Saturday. You and me.', at: ts(now - H) });
  const convo = (other, msgs) => {
    const cid = ['you', other].sort().join('_');
    msgs.forEach(([uid, text, ago], i) => put(`conversations/${cid}/messages/m${i}`, { uid, text, at: ts(now - ago) }));
    const last = msgs[msgs.length - 1];
    put('conversations/' + cid, { members: cid.split('_'), names: { you: 'Jordan Davis', [other]: users[other][0] }, last: last[1], lastUid: last[0], updatedAt: ts(now - last[2]) });
  };
  convo('marcus', [['marcus', 'Run it back Saturday? Pease Park, 7pm.', D], ['you', 'I’m in. 1v1 to 21?', D - 600e3], ['marcus', 'Bet. Bring your jumper this time.', 2 * H]]);
  convo('devin', [['devin', 'Confirm our game from yesterday when you get a sec.', 20 * H]]);
  const n = (id, type, title, body, link, read, ago) => put(`users/you/notifications/${id}`, { type, title, body, link, read, at: ts(now - ago) });
  n('n1', 'confirm', 'Confirm the final score', 'Devin Carter reported Devin Carter 21, Jordan Davis 18. Confirm it or dispute it.', 'game/needsconfirm', false, 20 * H);
  n('n2', 'team', 'Chris Evans wants to join Eastside Buckets', 'Open the team to approve or decline.', 'team/eastside', false, 3 * H);
  n('n3', 'final', 'Final: 15–21', 'Marcus Williams won 15–21. You earned 15 player points (15 you scored).', 'game/lostmarcus', true, 5 * D);
  ['marcus', 'riley'].forEach(u => put(`users/you/following/${u}`, { at: ts(now - 10 * D) }));
  const wk = (() => { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10) })();
  put(`users/you/workouts/${wk}_handles`, { challenge: 'handles', week: wk, fp: 75, at: ts(now - 2 * H) });
}
seed();
auth.currentUser = { uid: 'you', email: 'jordan@example.com', displayName: 'Jordan Davis' };

/* ───────── Preview panel ───────── */
let panel;
function drawPanel() {
  if (!document.body) return;
  if (!panel) {
    const css = document.createElement('style');
    css.textContent = `.pv-btn{position:fixed;z-index:65;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(96px + env(safe-area-inset-bottom,0px));background:var(--ink);color:var(--bg);border:0;border-radius:999px;padding:9px 14px;font:700 12px var(--body);box-shadow:0 6px 20px #0004;cursor:pointer}
@media(min-width:960px){.pv-btn{bottom:20px}}
.pv-card{position:fixed;z-index:66;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(140px + env(safe-area-inset-bottom,0px));width:min(320px,calc(100vw - 32px));background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:14px;padding:16px;box-shadow:0 16px 50px #0005;font:14px/1.5 var(--body)}
@media(min-width:960px){.pv-card{bottom:64px}}
.pv-card h4{margin:0 0 6px;font:800 18px var(--display);text-transform:uppercase}.pv-card p{margin:0 0 12px;color:var(--muted);font-size:13px}
.pv-card label{display:grid;gap:6px;font-size:12px;font-weight:700;margin-bottom:12px}.pv-card select{width:100%}
.pv-card .row{display:flex;gap:8px;flex-wrap:wrap}`;
    document.head.appendChild(css);
    panel = document.createElement('div'); document.body.appendChild(panel);
  }
  const open = panel.dataset.open === '1', me = human();
  const people = [...docs.keys()].filter(p => /^users\/[^/]+$/.test(p)).map(p => [p.slice(6), docs.get(p).name]);
  panel.innerHTML = `<button class="pv-btn" aria-expanded="${open}" id="pv-toggle">Preview ${open ? '▾' : '▴'}</button>${open ? `<div class="pv-card" role="dialog" aria-label="Preview options"><h4>Preview mode</h4><p>Sample players, teams and games. Sample players respond to you. Nothing is saved; reloading starts over.</p><label for="pv-who">View the app as<select id="pv-who">${me ? '' : '<option value="">Signed out</option>'}${people.map(([id, n]) => `<option value="${id}" ${id === me ? 'selected' : ''}>${n}${id === 'you' ? ' (main demo player)' : ''}</option>`).join('')}</select></label><div class="row"><button class="btn btn-ghost btn-sm" id="pv-out">Show sign-in screen</button><button class="btn btn-ghost btn-sm" id="pv-reset">Reset sample data</button></div></div>` : ''}`;
  panel.querySelector('#pv-toggle').onclick = () => { panel.dataset.open = open ? '' : '1'; drawPanel() };
  if (open) {
    panel.querySelector('#pv-who').onchange = e => { const id = e.target.value; panel.dataset.open = ''; if (id) setUser({ uid: id, email: (id === 'you' ? 'jordan' : id) + '@example.com', displayName: '' }) };
    panel.querySelector('#pv-out').onclick = () => { panel.dataset.open = ''; setUser(null) };
    panel.querySelector('#pv-reset').onclick = () => location.reload();
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', drawPanel); else drawPanel();
