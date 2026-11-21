import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, addDoc, deleteDoc, collection, query, where, orderBy, getDocs, serverTimestamp, Timestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import fs from 'fs';

const env = await initializeTestEnvironment({ projectId: 'demo-nextmatch', firestore: { rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 } });
const A = env.authenticatedContext('alice').firestore(), B = env.authenticatedContext('bob').firestore(), C = env.authenticatedContext('carol').firestore(), anon = env.unauthenticatedContext().firestore();
let pass = 0, failN = 0;
async function t(name, p) { try { await p; pass++; console.log('ok  ', name) } catch (e) { failN++; console.log('FAIL', name, '-', e.message.split('\n')[0]) } }
const user = n => ({ name: n, city: 'Austin', sports: ['Basketball'], rp: 0, wins: 0, losses: 0, adult: true, createdAt: serverTimestamp() });

// users
await t('alice creates own profile', assertSucceeds(setDoc(doc(A, 'users/alice'), user('Alice A'))));
await t('bob creates own profile', assertSucceeds(setDoc(doc(B, 'users/bob'), user('Bob B'))));
await t('profile with rp 500 refused', assertFails(setDoc(doc(C, 'users/carol'), { ...user('Carol'), rp: 500 })));
await t('profile without 18+ refused', assertFails(setDoc(doc(C, 'users/carol'), { ...user('Carol'), adult: false })));
await t('cannot create someone else profile', assertFails(setDoc(doc(C, 'users/dave'), user('Dave'))));
await t('signed-out cannot read users', assertFails(getDoc(doc(anon, 'users/alice'))));
await t('bob reads alice', assertSucceeds(getDoc(doc(B, 'users/alice'))));
await t('alice edits name/city', assertSucceeds(updateDoc(doc(A, 'users/alice'), { name: 'Alice Allen', city: 'Dallas' })));
await t('alice cannot raise own rp', assertFails(updateDoc(doc(A, 'users/alice'), { rp: 9999 })));
await t('alice cannot edit bob', assertFails(updateDoc(doc(A, 'users/bob'), { name: 'Hacked' })));
await t('tournament interest', assertSucceeds(updateDoc(doc(A, 'users/alice'), { tournamentInterest: arrayUnion('ATX Hoops Classic') })));
await updateDoc(doc(A, 'users/alice'), { city: 'Austin' });
// follows + workouts
await t('alice follows bob', assertSucceeds(setDoc(doc(A, 'users/alice/following/bob'), { at: serverTimestamp() })));
await t('alice cannot make bob follow', assertFails(setDoc(doc(A, 'users/bob/following/alice'), { at: serverTimestamp() })));
await t('workout claim', assertSucceeds(setDoc(doc(A, 'users/alice/workouts/2026-11-16_handles'), { challenge: 'handles', week: '2026-11-16', fp: 75, at: serverTimestamp() })));
await t('same workout twice refused', assertFails(setDoc(doc(A, 'users/alice/workouts/2026-11-16_handles'), { challenge: 'handles', week: '2026-11-16', fp: 75, at: serverTimestamp() })));
await t('inflated fp refused', assertFails(setDoc(doc(A, 'users/alice/workouts/2026-11-16_footwork'), { challenge: 'footwork', week: '2026-11-16', fp: 5000, at: serverTimestamp() })));
await t('bob cannot read alice workouts', assertFails(getDoc(doc(B, 'users/alice/workouts/2026-11-16_handles'))));
// games
const when = Timestamp.fromDate(new Date(Date.now() + 864e5));
const game = { hostUid: 'alice', hostName: 'Alice', sport: 'Basketball', format: '1v1', need: 'Open challenge', venue: 'Pease Park Courts', city: 'Austin', when, players: ['alice'], createdAt: serverTimestamp() };
await t('alice posts game', assertSucceeds(setDoc(doc(A, 'games/g1'), game)));
await t('game posted as bob refused', assertFails(setDoc(doc(A, 'games/g2'), { ...game, hostUid: 'bob' })));
await t('bob joins', assertSucceeds(updateDoc(doc(B, 'games/g1'), { players: arrayUnion('bob') })));
await t('carol joins full 1v1 refused', assertFails(updateDoc(doc(C, 'games/g1'), { players: arrayUnion('carol') })));
await t('bob cannot add carol', assertFails(updateDoc(doc(B, 'games/g1'), { players: ['alice', 'bob', 'carol'] })));
await t('bob cannot change venue', assertFails(updateDoc(doc(B, 'games/g1'), { venue: 'Elsewhere' })));
await t('bob cannot remove alice', assertFails(updateDoc(doc(B, 'games/g1'), { players: ['bob'] })));
await t('bob leaves', assertSucceeds(updateDoc(doc(B, 'games/g1'), { players: arrayRemove('bob') })));
await t('city game query', assertSucceeds(getDocs(query(collection(B, 'games'), where('city', '==', 'Austin'), where('when', '>=', Timestamp.fromDate(new Date(Date.now() - 864e5))), orderBy('when')))));
await t('bob cannot delete alice game', assertFails(deleteDoc(doc(B, 'games/g1'))));
await t('alice deletes own game', assertSucceeds(deleteDoc(doc(A, 'games/g1'))));
// posts
const post = { uid: 'alice', name: 'Alice', city: 'Austin', kind: 'Highlight', caption: 'Hello court', sport: 'Basketball', art: 'ball', mediaUrl: null, mediaType: null, likedBy: [], createdAt: serverTimestamp() };
await t('alice posts', assertSucceeds(setDoc(doc(A, 'posts/p1'), post)));
await t('post as someone else refused', assertFails(setDoc(doc(B, 'posts/p2'), post)));
await t('post with fake likes refused', assertFails(setDoc(doc(A, 'posts/p3'), { ...post, likedBy: ['x', 'y'] })));
await t('bob likes', assertSucceeds(updateDoc(doc(B, 'posts/p1'), { likedBy: arrayUnion('bob') })));
await t('bob cannot add fake likes', assertFails(updateDoc(doc(B, 'posts/p1'), { likedBy: ['bob', 'x', 'y'] })));
await t('bob cannot edit caption', assertFails(updateDoc(doc(B, 'posts/p1'), { caption: 'pwned' })));
await t('bob comments', assertSucceeds(addDoc(collection(B, 'posts/p1/comments'), { uid: 'bob', name: 'Bob', text: 'Nice', at: serverTimestamp() })));
await t('comment as alice by bob refused', assertFails(addDoc(collection(B, 'posts/p1/comments'), { uid: 'alice', name: 'Alice', text: 'fake', at: serverTimestamp() })));
await t('profile posts query', assertSucceeds(getDocs(query(collection(B, 'posts'), where('uid', '==', 'alice'), orderBy('createdAt', 'desc')))));
await t('bob cannot delete alice post', assertFails(deleteDoc(doc(B, 'posts/p1'))));
// messages
const cid = ['alice', 'bob'].sort().join('_');
await t('alice opens convo', assertSucceeds(setDoc(doc(A, 'conversations', cid), { members: cid.split('_'), names: { alice: 'Alice', bob: 'Bob' }, last: 'yo', lastUid: 'alice', updatedAt: serverTimestamp() }, { merge: true })));
await t('alice sends message', assertSucceeds(addDoc(collection(A, 'conversations', cid, 'messages'), { uid: 'alice', text: 'yo', at: serverTimestamp() })));
await t('bob reads message', assertSucceeds(getDocs(collection(B, 'conversations', cid, 'messages'))));
await t('bob replies', assertSucceeds(setDoc(doc(B, 'conversations', cid), { members: cid.split('_'), names: { alice: 'Alice', bob: 'Bob' }, last: 'sup', lastUid: 'bob', updatedAt: serverTimestamp() }, { merge: true })));
await t('carol cannot read their messages', assertFails(getDocs(collection(C, 'conversations', cid, 'messages'))));
await t('carol cannot read convo', assertFails(getDoc(doc(C, 'conversations', cid))));
await t('carol cannot post in it', assertFails(addDoc(collection(C, 'conversations', cid, 'messages'), { uid: 'carol', text: 'hi', at: serverTimestamp() })));
await t('inbox query', assertSucceeds(getDocs(query(collection(B, 'conversations'), where('members', 'array-contains', 'bob'), orderBy('updatedAt', 'desc')))));
await t('fake convo with wrong members refused', assertFails(setDoc(doc(C, 'conversations', 'alice_carol'), { members: ['alice', 'bob'], last: 'x', lastUid: 'carol', updatedAt: serverTimestamp() })));
console.log(`\n${pass} passed, ${failN} failed`);
await env.cleanup(); process.exit(failN ? 1 : 0);
