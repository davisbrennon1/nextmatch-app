// Server-code checks against the emulators. Run with: npm run test:functions
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, addDoc, collection, getDocs, serverTimestamp, Timestamp, arrayUnion } from 'firebase/firestore';
import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);
const env = await initializeTestEnvironment({ projectId: 'demo-nextmatch', firestore: { rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 } });
await env.clearFirestore();
const as = uid => env.authenticatedContext(uid).firestore();
const admin = async fn => { let r; await env.withSecurityRulesDisabled(async ctx => { r = await fn(ctx.firestore()) }); return r };
let pass = 0, failN = 0;
const check = (name, ok, extra = '') => { ok ? pass++ : failN++; console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : extra) };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, ms = 20000) { const end = Date.now() + ms; while (Date.now() < end) { const v = await fn(); if (v) return v; await sleep(400) } return null }
const user = n => ({ name: n, city: 'Austin', sports: ['Basketball'], rp: 0, wins: 0, losses: 0, adult: true, createdAt: serverTimestamp() });
for (const n of ['alice', 'bob', 'carol', 'dave', 'erin']) await setDoc(doc(as(n), 'users', n), user(n[0].toUpperCase() + n.slice(1)));
const read = async p => (await admin(db => getDoc(doc(db, p)))).data();
const notifs = async uid => (await admin(db => getDocs(collection(db, 'users', uid, 'notifications')))).docs.map(d => d.data());

// Teams for a team game.
await setDoc(doc(as('alice'), 'teams/t1'), { name: 'Eastside', sport: 'Basketball', city: 'Austin', captainUid: 'alice', members: ['alice'], rp: 0, wins: 0, losses: 0, createdAt: serverTimestamp() });
await setDoc(doc(as('bob'), 'teams/t2'), { name: 'North Loop', sport: 'Basketball', city: 'Austin', captainUid: 'bob', members: ['bob'], rp: 0, wins: 0, losses: 0, createdAt: serverTimestamp() });

console.log('— Join request notifies the captain');
await setDoc(doc(as('carol'), 'teams/t1/requests/carol'), { name: 'Carol', at: serverTimestamp() });
const reqN = await waitFor(async () => (await notifs('alice')).find(n => n.type === 'team'));
check('captain notified of join request', !!reqN && /Carol wants to join Eastside/.test(reqN.title), JSON.stringify(reqN));
await admin(db => updateDoc(doc(db, 'teams/t1'), { members: ['alice', 'carol'] }));

console.log('— Joining a game notifies the host');
const when = Timestamp.fromDate(new Date(Date.now() + 864e5));
await setDoc(doc(as('alice'), 'games/g1'), { hostUid: 'alice', hostName: 'Alice', sport: 'Basketball', format: '2v2', need: 'Team challenge', venue: 'Pease Park', city: 'Austin', when, home: ['alice'], away: [], players: ['alice'], status: 'open', homeTeamId: 't1', homeTeamName: 'Eastside', awayTeamId: 't2', awayTeamName: 'North Loop', createdAt: serverTimestamp() });
await updateDoc(doc(as('carol'), 'games/g1'), { home: arrayUnion('carol'), players: arrayUnion('carol') });
await updateDoc(doc(as('bob'), 'games/g1'), { away: arrayUnion('bob'), players: arrayUnion('bob') });
const joinN = await waitFor(async () => (await notifs('alice')).filter(n => n.type === 'join').length >= 2 && (await notifs('alice')).filter(n => n.type === 'join'));
check('host notified for each player who joins', joinN?.length === 2, JSON.stringify(joinN));

console.log('— Report → confirm → points');
await admin(db => updateDoc(doc(db, 'games/g1'), { when: Timestamp.fromDate(new Date(Date.now() - 36e5)) }));
await updateDoc(doc(as('bob'), 'games/g1'), { status: 'reported', report: { by: 'bob', side: 'away', home: 21, away: 17, players: { alice: 14, carol: 7, bob: 17 }, at: serverTimestamp() } });
const confN = await waitFor(async () => (await notifs('carol')).find(n => n.type === 'confirm'));
check('other side asked to confirm', !!confN && /21/.test(confN.body), JSON.stringify(confN));
check('reporter’s own side is not asked', !(await notifs('bob')).some(n => n.type === 'confirm'));
await updateDoc(doc(as('carol'), 'games/g1'), { status: 'confirmed', responseBy: 'carol' });
const fin = await waitFor(async () => { const g = await read('games/g1'); return g.status === 'final' && g });
check('game finalized with each player’s points', fin?.final?.winner === 'home' && fin.final.home === 21 && fin.final.players?.alice?.earned === 114 && fin.final.players?.carol?.scored === 7 && fin.final.earned?.home === 121, JSON.stringify(fin?.final));
const [a, c, b] = [await read('users/alice'), await read('users/carol'), await read('users/bob')];
check('each winner gets 100 + their own points (114 and 107)', a.rp === 114 && a.wins === 1 && c.rp === 107 && c.wins === 1, JSON.stringify({ a, c }));
check('points scored are added to each player’s career total', a.scored === 14 && c.scored === 7, JSON.stringify({ a: a.scored, c: c.scored }));
check('season totals start with this game', a.seasonRp === 114 && a.seasonWins === 1 && a.seasonLosses === 0 && /^\d{4}-(winter|spring|summer|fall)$/.test(a.seasonKey) && b.seasonRp === 17 && b.seasonLosses === 1, JSON.stringify({ a: [a.seasonKey, a.seasonRp, a.seasonWins], b: [b.seasonRp, b.seasonLosses] }));
check('loser gets their own points (17) and a loss', b.rp === 17 && b.scored === 17 && b.losses === 1 && b.wins === 0, JSON.stringify(b));
const [t1, t2] = [await read('teams/t1'), await read('teams/t2')];
check('winning team gets 121 and a win', t1.rp === 121 && t1.wins === 1, JSON.stringify(t1));
check('losing team gets 17 and a loss', t2.losses === 1 && t2.rp === 17, JSON.stringify(t2));
const finalN = await waitFor(async () => (await notifs('carol')).find(n => n.type === 'final'));
check('each player told what they earned', !!finalN && /You earned 107 player points \(100 for the win \+ 7 you scored\)/.test(finalN.body), JSON.stringify(finalN));
await sleep(1500);
const again = await read('users/alice');
check('points awarded exactly once', again.rp === 114 && again.wins === 1, JSON.stringify(again));

console.log('— Tie and dispute');
const past = Timestamp.fromDate(new Date(Date.now() - 36e5));
await admin(db => setDoc(doc(db, 'games/g2'), { hostUid: 'dave', hostName: 'Dave', sport: 'Basketball', format: '1v1', need: 'Open', venue: 'Givens', city: 'Austin', when: past, home: ['dave'], away: ['erin'], players: ['dave', 'erin'], status: 'open' }));
await updateDoc(doc(as('dave'), 'games/g2'), { status: 'reported', report: { by: 'dave', side: 'home', home: 21, away: 3, at: serverTimestamp() } });
await updateDoc(doc(as('erin'), 'games/g2'), { status: 'disputed', responseBy: 'erin' });
const dispN = await waitFor(async () => (await notifs('dave')).find(n => n.type === 'disputed'));
check('dispute notifies players', !!dispN, '');
check('no points after a dispute', (await read('users/dave')).rp === 0);
await updateDoc(doc(as('erin'), 'games/g2'), { status: 'reported', report: { by: 'erin', side: 'away', home: 20, away: 20, at: serverTimestamp() } });
await updateDoc(doc(as('dave'), 'games/g2'), { status: 'confirmed', responseBy: 'dave' });
const tie = await waitFor(async () => { const g = await read('games/g2'); return g.status === 'final' && g });
check('tie finalizes with no winner', tie?.final?.winner === null && tie.final.pts === 0 && tie.final.earned?.home === 20, JSON.stringify(tie?.final));
const [dv, er] = [await read('users/dave'), await read('users/erin')];
check('tie changes nobody’s record', dv.wins === 0 && dv.losses === 0 && er.wins === 0 && er.losses === 0);
check('tie gives each player their scored points (20)', dv.rp === 20 && er.rp === 20, JSON.stringify({ dv: dv.rp, er: er.rp }));
await admin(db => updateDoc(doc(db, 'users/erin'), { seasonKey: '1999-fall', seasonRp: 999, seasonWins: 9, seasonLosses: 9 }));

console.log('— Per-player points that don’t add up');
const daveScoredBefore = (await read('users/dave')).scored || 0;
await admin(db => setDoc(doc(db, 'games/g4'), { hostUid: 'dave', hostName: 'Dave', sport: 'Basketball', format: '2v2', need: 'Open', venue: 'Givens', city: 'Austin', when: past, home: ['dave', 'erin'], away: ['bob'], players: ['dave', 'erin', 'bob'], status: 'open' }));
await updateDoc(doc(as('dave'), 'games/g4'), { status: 'reported', report: { by: 'dave', side: 'home', home: 21, away: 10, players: { dave: 30, erin: 30, bob: 10 }, at: serverTimestamp() } });
await updateDoc(doc(as('bob'), 'games/g4'), { status: 'confirmed', responseBy: 'bob' });
const g4 = await waitFor(async () => { const g = await read('games/g4'); return g.status === 'final' && g });
check('a side whose points don’t add up falls back to the side score', g4?.final?.players?.dave?.scored === 21 && g4.final.players.erin.earned === 121 && g4.final.players.bob.scored === 10, JSON.stringify(g4?.final?.players));
const er4 = await read('users/erin'), dv4 = await read('users/dave');
check('an old season’s totals restart with the new game', er4.seasonKey !== '1999-fall' && er4.seasonRp === 121 && er4.seasonWins === 1 && er4.seasonLosses === 0, JSON.stringify([er4.seasonKey, er4.seasonRp, er4.seasonWins]));
check('a second game this season adds to the season total', dv4.seasonRp === 20 + 121 && dv4.seasonWins === 1, JSON.stringify([dv4.seasonRp, dv4.seasonWins]));
check('fallback points are not added to career totals', ((await read('users/dave')).scored || 0) === daveScoredBefore, JSON.stringify(await read('users/dave')));

console.log('— Reported posts');
await setDoc(doc(as('erin'), 'posts/p1'), { uid: 'erin', name: 'Erin', city: 'Austin', kind: 'Highlight', caption: 'spam spam', sport: 'Basketball', art: 'ball', mediaUrl: null, mediaType: null, likedBy: [], createdAt: serverTimestamp() });
const rep = by => addDoc(collection(as(by), 'reports'), { by, targetType: 'post', targetId: 'p1', targetUid: 'erin', reason: 'Spam or scam', details: '', at: serverTimestamp() });
await rep('alice'); await rep('alice'); await rep('bob'); await sleep(2500);
check('two people reporting does not hide a post', !(await read('posts/p1')).hidden);
await rep('carol');
check('three different people hide it', !!(await waitFor(async () => (await read('posts/p1')).hidden)));

console.log('— Game reminders');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'; process.env.GCLOUD_PROJECT = 'demo-nextmatch';
const { initializeApp } = require(require.resolve('firebase-admin/app', { paths: [new URL('../functions/', import.meta.url).pathname] }));
initializeApp({ projectId: 'demo-nextmatch' });
const lib = require('../functions/lib.js');
const inAnHour = Timestamp.fromDate(new Date(Date.now() + 60 * 6e4)), tomorrow = Timestamp.fromDate(new Date(Date.now() + 864e5));
await admin(async db => {
  await setDoc(doc(db, 'games/r1'), { hostUid: 'alice', hostName: 'Alice', sport: 'Basketball', format: '1v1', need: 'Open', venue: 'Zilker', city: 'Austin', when: inAnHour, home: ['alice'], away: ['bob'], players: ['alice', 'bob'], status: 'open' });
  await setDoc(doc(db, 'games/r2'), { hostUid: 'carol', hostName: 'Carol', sport: 'Basketball', format: '1v1', need: 'Open', venue: 'Mueller', city: 'Austin', when: tomorrow, home: ['carol'], away: [], players: ['carol'], status: 'open' });
});
const sent = await lib.sendReminders();
check('reminder sent for the game in an hour only', sent === 1, 'sent=' + sent);
check('both players reminded', (await notifs('bob')).some(n => n.type === 'reminder') && (await notifs('alice')).some(n => n.type === 'reminder'));
check('no reminder for tomorrow’s game', !(await notifs('carol')).some(n => n.type === 'reminder'));
check('reminders are not sent twice', (await lib.sendReminders()) === 0);

console.log('— Seasons and tournaments');
const lpast = Timestamp.fromDate(new Date(Date.now() - 36e5));
await admin(async db => {
  await setDoc(doc(db, 'leagues/L1'), { type: 'season', division: 'adult', sport: 'Basketball', format: '2v2', name: 'ATX Fall Hoops', description: '', start: Timestamp.fromDate(new Date(Date.now() - 864e6)), end: Timestamp.fromDate(new Date(Date.now() + 864e6)), city: 'Austin, TX', organizerUid: 'dave', organizerName: 'Dave', teamIds: ['t1'], teamNames: { t1: 'Eastside' }, staff: ['dave', 'alice'] });
});
await setDoc(doc(as('bob'), 'leagues/L1/entries/t2'), { teamName: 'North Loop', captainUid: 'bob', captainName: 'Bob', at: serverTimestamp() });
check('organizer told about the entry', !!(await waitFor(async () => (await notifs('dave')).find(n => /North Loop wants to enter ATX Fall Hoops/.test(n.title)))));
await updateDoc(doc(as('dave'), 'leagues/L1'), { teamIds: arrayUnion('t2'), teamNames: { t1: 'Eastside', t2: 'North Loop' }, staff: arrayUnion('bob'), lastChange: 't2' });
check('team told it’s in', !!(await waitFor(async () => (await notifs('bob')).find(n => /North Loop is in ATX Fall Hoops/.test(n.title)))));
await admin(db => setDoc(doc(db, 'games/s1'), { hostUid: 'alice', hostName: 'Alice', sport: 'Basketball', format: '2v2', need: 'Season game', venue: 'Pan Am', city: 'Austin, TX', when: lpast, home: ['alice', 'carol'], away: ['bob'], players: ['alice', 'carol', 'bob'], status: 'open', homeTeamId: 't1', homeTeamName: 'Eastside', awayTeamId: 't2', awayTeamName: 'North Loop', leagueId: 'L1', leagueName: 'ATX Fall Hoops' }));
await updateDoc(doc(as('alice'), 'games/s1'), { status: 'reported', report: { by: 'alice', side: 'home', home: 21, away: 18, players: { alice: 15, carol: 6, bob: 18 }, at: serverTimestamp() } });
await updateDoc(doc(as('bob'), 'games/s1'), { status: 'confirmed', responseBy: 'bob' });
await waitFor(async () => (await read('games/s1')).status === 'final');
const [st1, st2] = [await read('leagues/L1/standings/t1'), await read('leagues/L1/standings/t2')];
check('standings updated', st1?.wins === 1 && st1.pf === 21 && st1.pa === 18 && st2?.losses === 1 && st2.pf === 18, JSON.stringify({ st1, st2 }));
const [sa, sb] = [await read('leagues/L1/stats/alice'), await read('leagues/L1/stats/bob')];
check('season stats per player', sa?.rp === 115 && sa.scored === 15 && sa.wins === 1 && sa.youth === false && sa.teamName === 'Eastside' && sb?.rp === 18 && sb.losses === 1, JSON.stringify({ sa, sb }));
console.log('— Youth season');
await admin(async db => {
  await setDoc(doc(db, 'leagues/LY'), { type: 'season', division: 'youth', ageGroup: '12U', sport: 'Football', format: '11v11', name: 'Austin Youth Football 12U', city: 'Austin, TX', organizerUid: 'carol', organizerName: 'Carol', teamIds: ['y1', 'y2'], teamNames: { y1: 'Eagles', y2: 'Panthers' }, staff: ['carol', 'dave', 'erin'] });
  await setDoc(doc(db, 'teams/y1'), { name: 'Eagles', sport: 'Football', city: 'Austin, TX', captainUid: 'dave', members: ['dave'], rp: 0, wins: 0, losses: 0, youth: true, ageGroup: '12U' });
  await setDoc(doc(db, 'teams/y2'), { name: 'Panthers', sport: 'Football', city: 'Austin, TX', captainUid: 'erin', members: ['erin'], rp: 0, wins: 0, losses: 0, youth: true, ageGroup: '12U' });
  await setDoc(doc(db, 'teams/y2/kids/k2'), { name: 'Mia T.', jersey: '7', parentUid: 'bob', parentName: 'Bob', status: 'approved' });
  await setDoc(doc(db, 'teams/y1/kids/k3'), { name: 'Not Approved', jersey: '', parentUid: 'bob', parentName: 'Bob', status: 'pending' });
});
await setDoc(doc(as('alice'), 'teams/y1/kids/k1'), { name: 'Jayden R.', jersey: '12', parentUid: 'alice', parentName: 'Alice', status: 'pending', at: serverTimestamp() });
check('coach told a parent added a kid', !!(await waitFor(async () => (await notifs('dave')).find(n => /Alice added Jayden R\. to Eagles/.test(n.title)))));
await updateDoc(doc(as('dave'), 'teams/y1/kids/k1'), { status: 'approved' });
const daveBefore = (await read('users/dave')).rp || 0;
await admin(db => setDoc(doc(db, 'games/yg1'), { hostUid: 'dave', hostName: 'Dave', sport: 'Football', format: '11v11', need: 'Season game', venue: 'House Park', city: 'Austin, TX', when: lpast, home: ['dave'], away: ['erin'], players: ['dave', 'erin'], status: 'open', homeTeamId: 'y1', homeTeamName: 'Eagles', awayTeamId: 'y2', awayTeamName: 'Panthers', leagueId: 'LY', leagueName: 'Austin Youth Football 12U' }));
await updateDoc(doc(as('dave'), 'games/yg1'), { status: 'reported', report: { by: 'dave', side: 'home', home: 21, away: 7, kids: { k1: 14, k3: 30, nobody: 50 }, at: serverTimestamp() } });
await updateDoc(doc(as('erin'), 'games/yg1'), { status: 'confirmed', responseBy: 'erin', confirmKids: { k2: 7 } });
const yg = await waitFor(async () => { const g = await read('games/yg1'); return g.status === 'final' && g });
const [k1, k2, k3, kn] = [await read('leagues/LY/stats/kid_k1'), await read('leagues/LY/stats/kid_k2'), await read('leagues/LY/stats/kid_k3'), await read('leagues/LY/stats/kid_nobody')];
check('kids get their own points: 100 for the win + points scored', k1?.rp === 114 && k1.scored === 14 && k1.wins === 1 && k1.youth === true && k1.parentUid === 'alice' && k2?.rp === 7 && k2.losses === 1, JSON.stringify({ k1, k2 }));
check('unapproved or unknown kids get nothing', !k3 && !kn);
check('coaches don’t earn points from youth games', ((await read('users/dave')).rp || 0) === daveBefore && Object.keys(yg.final.players).length === 0);
check('youth standings updated', (await read('leagues/LY/standings/y1'))?.wins === 1);
check('kid names stay off the game record', !JSON.stringify(yg).includes('Jayden'));

console.log('— Courts, fields and parks');
const V = require('../functions/venues.js');
const sample = [
  { type: 'way', id: 1, center: { lat: 30.285, lon: -97.755 }, tags: { leisure: 'park', name: 'Pease Park' } },
  { type: 'way', id: 2, center: { lat: 30.2853, lon: -97.7552 }, tags: { leisure: 'pitch', sport: 'basketball' } },
  { type: 'way', id: 3, center: { lat: 30.2855, lon: -97.7549 }, tags: { leisure: 'pitch', sport: 'basketball' } },
  { type: 'way', id: 4, center: { lat: 30.40, lon: -97.90 }, tags: { leisure: 'pitch', sport: 'american_football' } },
  { type: 'way', id: 5, center: { lat: 30.266, lon: -97.77 }, tags: { leisure: 'pitch', sport: 'soccer', name: 'Zilker Field 3' } },
  { type: 'node', id: 6, lat: 30.25, lon: -97.71, tags: { leisure: 'sports_centre', name: 'Pan American Recreation Center', 'addr:housenumber': '2100', 'addr:street': 'E 3rd St' } },
  { type: 'way', id: 7, center: { lat: 30.3, lon: -97.7 }, tags: { leisure: 'pitch', sport: 'basketball', name: 'Private Court', access: 'private' } },
  { type: 'way', id: 8, center: { lat: 30.29, lon: -97.72 }, tags: { leisure: 'pitch', sport: 'basketball;tennis', name: 'Rosewood Park Basketball Court', lit: 'yes' } }
];
const list = V.normalize(sample), names = list.map(v => v.name);
check('unnamed courts in a park get the park’s name', names.includes('Pease Park courts') && list.find(v => v.name === 'Pease Park courts').count === 2, JSON.stringify(names));
check('unnamed courts far from any park are left out', !list.some(v => v.lat === 30.4));
check('private courts are left out', !names.includes('Private Court'));
check('fields are for flag football, courts for basketball', list.find(v => v.name === 'Zilker Field 3').sports.join() === 'Flag football' && list.find(v => v.name === 'Rosewood Park Basketball Court').sports.join() === 'Basketball');
check('rec centers keep their address', list.find(v => v.kind === 'Rec center')?.address === '2100 E 3rd St');
check('courts and fields are listed before parks', list.findIndex(v => v.kind === 'Park') > list.findIndex(v => v.kind === 'Field'));
check('city lookup works', !!V.cityInfo('Austin, TX') && !V.cityInfo('Atlantis, TX'));
let calls = 0;
const fake = async q => { calls++; if (!/leisure/.test(q)) throw new Error('bad query'); return sample };
const first = await V.getVenues('Austin, TX', { fetchElements: fake });
const second = await V.getVenues('Austin, TX', { fetchElements: fake });
check('looks a city up once, then uses the saved list', calls === 1 && first.source === 'openstreetmap' && second.source === 'saved' && second.venues.length === first.venues.length, JSON.stringify({ calls, a: first.source, b: second.source }));
const later = await V.getVenues('Austin, TX', { fetchElements: async () => { throw new Error('map down') }, now: Date.now() + 40 * 864e5 });
check('if the map is down, the old saved list is used', later.source === 'saved' && later.venues.length === first.venues.length);
let unknown = null; try { await V.getVenues('Atlantis, TX', { fetchElements: fake }) } catch (e) { unknown = e.code }
check('unknown cities are refused', unknown === 'invalid-argument');

console.log(`\n${pass} passed, ${failN} failed`);
await env.cleanup(); process.exit(failN ? 1 : 0);
