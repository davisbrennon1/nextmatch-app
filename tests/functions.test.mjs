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

console.log('— Per-player points that don’t add up');
const daveScoredBefore = (await read('users/dave')).scored || 0;
await admin(db => setDoc(doc(db, 'games/g4'), { hostUid: 'dave', hostName: 'Dave', sport: 'Basketball', format: '2v2', need: 'Open', venue: 'Givens', city: 'Austin', when: past, home: ['dave', 'erin'], away: ['bob'], players: ['dave', 'erin', 'bob'], status: 'open' }));
await updateDoc(doc(as('dave'), 'games/g4'), { status: 'reported', report: { by: 'dave', side: 'home', home: 21, away: 10, players: { dave: 30, erin: 30, bob: 10 }, at: serverTimestamp() } });
await updateDoc(doc(as('bob'), 'games/g4'), { status: 'confirmed', responseBy: 'bob' });
const g4 = await waitFor(async () => { const g = await read('games/g4'); return g.status === 'final' && g });
check('a side whose points don’t add up falls back to the side score', g4?.final?.players?.dave?.scored === 21 && g4.final.players.erin.earned === 121 && g4.final.players.bob.scored === 10, JSON.stringify(g4?.final?.players));
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

console.log(`\n${pass} passed, ${failN} failed`);
await env.cleanup(); process.exit(failN ? 1 : 0);
