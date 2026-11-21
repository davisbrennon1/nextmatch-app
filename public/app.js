import { firebaseConfig, FEATURES, CITIES, USE_EMULATORS } from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, GoogleAuthProvider, OAuthProvider, signInWithPopup, signOut, connectAuthEmulator
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc, collection, query, where,
  orderBy, limit, onSnapshot, serverTimestamp, Timestamp, arrayUnion, arrayRemove, connectFirestoreEmulator
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
  share: '<path d="M12 4v11M7 9l5-5 5 5M5 14v6h14v-6"/>'
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
const ptsFor = f => ({ '1v1': 25, '2v2': 40, '3v3': 50, '4v4': 50 }[f] || 75);
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
  thread: null, msgs: [], profile: null, users: {}, profilePosts: {}, loaded: {}
};
let subs = [], citySubs = [], threadSub = null, commentSub = null;
const unsubAll = () => { [...subs, ...citySubs].forEach(u => u()); subs = []; citySubs = []; threadSub?.(); threadSub = null };
const myName = () => S.me?.name || 'Player';
const myCity = () => S.me?.city || CITIES[0];
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
  const picked = new Set(['Basketball']);
  showGate(`<div class="wordmark"><i></i>NextMatch</div><h1>Set up your <span>player card.</span></h1><p>This is what other players see. You can change it later.</p>
  <form id="setupform">
    <label class="field" for="s-name"><span>Player name</span><input id="s-name" required minlength="2" maxlength="40" autocomplete="nickname" value="${esc((user.displayName || '').slice(0, 40))}"></label>
    <label class="field" for="s-city"><span>Home city</span><select id="s-city">${CITIES.map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
    <label class="field"><span>What do you play?</span></label>
    <div class="chips" id="s-sports">${SPORTS.map(s => `<button type="button" class="chip ${picked.has(s) ? 'on' : ''}" aria-pressed="${picked.has(s)}" data-s="${s}"><span class="dot ${sportCls(s)}"></span>${s}</button>`).join('')}</div>
    <label class="check" for="s-adult"><input id="s-adult" type="checkbox" required>I’m 18 or older and agree to play fair and respect other players.</label>
    <button class="btn btn-primary" id="s-go">Let’s play →</button>
  </form>${msg ? `<div class="auth-err" role="alert">${esc(msg)}</div>` : ''}
  <div class="auth-links"><button id="s-out">Use a different account</button></div>`);
  $('#s-sports').querySelectorAll('.chip').forEach(b => b.onclick = () => { b.classList.toggle('on'); b.setAttribute('aria-pressed', b.classList.contains('on')) });
  $('#s-out').onclick = () => signOut(auth);
  $('#setupform').onsubmit = async e => {
    e.preventDefault();
    const name = $('#s-name').value.trim().replace(/\s+/g, ' '), sports = [...document.querySelectorAll('#s-sports .chip.on')].map(b => b.dataset.s);
    if (name.length < 2) return renderSetup(user, 'Enter a player name with at least 2 characters.');
    if (!$('#s-adult').checked) return renderSetup(user, 'NextMatch is for adults 18 and older.');
    $('#s-go').disabled = true;
    try {
      await setDoc(doc(db, 'users', user.uid), { name, city: $('#s-city').value, sports: sports.length ? sports : ['Basketball'], rp: 0, wins: 0, losses: 0, adult: true, createdAt: serverTimestamp() });
      enterApp(user);
    } catch (err) { console.error(err); renderSetup(user, 'Couldn’t save your profile. Check your connection and try again.') }
  };
}

onAuthStateChanged(auth, async user => {
  unsubAll();
  if (!user) { if (S.uid) gateMode = 'signin'; S.uid = null; S.me = null; S.tab = 'today'; closeSheet(); renderGate(); return }
  S.uid = user.uid;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) renderSetup(user); else enterApp(user, snap.data());
  } catch (err) { console.error(err); showGate(`<div class="wordmark"><i></i>NextMatch</div><h1>Can’t <span>connect.</span></h1><p>Check your internet connection, then refresh the page.</p>`) }
});

function enterApp(user, data) {
  S.me = data ? { id: user.uid, ...data } : S.me;
  $('#gate').hidden = true; $('#app').hidden = false; $('#tabbar').hidden = false;
  $('#citysel').innerHTML = CITIES.map(c => `<option>${esc(c)}</option>`).join('');
  subs.push(onSnapshot(doc(db, 'users', S.uid), d => { if (d.exists()) { const cityChanged = S.me?.city !== d.data().city; S.me = { id: S.uid, ...d.data() }; if (cityChanged || !citySubs.length) subscribeCity(); renderSoon() } }, fail('your profile')));
  subs.push(onSnapshot(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(60)), q => { S.posts = q.docs.map(d => ({ id: d.id, ...d.data() })); S.loaded.posts = true; renderSoon() }, fail('posts')));
  subs.push(onSnapshot(collection(db, 'users', S.uid, 'following'), q => { S.following = new Set(q.docs.map(d => d.id)); renderSoon() }, fail('follows')));
  subs.push(onSnapshot(collection(db, 'users', S.uid, 'workouts'), q => { S.workouts = q.docs.map(d => ({ id: d.id, ...d.data() })); renderSoon() }, fail('workouts')));
  subs.push(onSnapshot(query(collection(db, 'conversations'), where('members', 'array-contains', S.uid), orderBy('updatedAt', 'desc'), limit(50)), q => { S.convos = q.docs.map(d => ({ id: d.id, ...d.data() })); renderSoon() }, fail('messages')));
  render();
}
function subscribeCity() {
  citySubs.forEach(u => u()); citySubs = []; S.loaded.games = S.loaded.players = false;
  citySubs.push(onSnapshot(query(collection(db, 'games'), where('city', '==', myCity()), where('when', '>=', Timestamp.fromDate(startOfDay())), orderBy('when'), limit(100)), q => { S.games = q.docs.map(d => ({ id: d.id, ...d.data() })); S.loaded.games = true; renderSoon() }, fail('games')));
  citySubs.push(onSnapshot(query(collection(db, 'users'), where('city', '==', myCity()), limit(300)), q => { S.players = q.docs.map(d => ({ id: d.id, ...d.data() })); S.players.forEach(p => S.users[p.id] = p); S.loaded.players = true; renderSoon() }, fail('players')));
}

/* ================= Rendering ================= */
let raf = 0;
function renderSoon() { cancelAnimationFrame(raf); raf = requestAnimationFrame(render) }
function sheet(html) { $('#overlay').innerHTML = `<div class="sheet-back" id="sb" role="dialog" aria-modal="true"><div class="sheet"><div class="grab"></div>${html}</div></div>`; $('#sb').onclick = e => { if (e.target.id === 'sb') closeSheet() }; setTimeout(() => $('#sb .sheet')?.querySelector('input,select,textarea,button')?.focus(), 30) }
function closeSheet() { commentSub?.(); commentSub = null; $('#overlay').innerHTML = '' }
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if ($('#sb')) closeSheet(); else if ($('.reels')) closeOverlay() } });
function go(tab, opts = {}) { S.tab = tab; Object.assign(S, opts); if (tab !== 'messages') { threadSub?.(); threadSub = null } render(); window.scrollTo(0, 0) }

const TABS = [['today', 'Today'], ['play', 'Play'], ['create', ''], ['feed', 'Feed'], ['me', 'Me']];
function shell() {
  const on = S.tab === 'profile' ? 'play' : S.tab;
  $('#tabbar').innerHTML = `<div class="rail-brand wordmark"><i></i>NextMatch</div>` + TABS.map(([k, l]) => k === 'create' ? `<button class="tab-create" aria-label="Create" onclick="openCreate()"><span>${ic('plus')}</span></button>` : `<button class="tab ${on === k ? 'on' : ''}" ${on === k ? 'aria-current="page"' : ''} onclick="go('${k}')">${ic(k)}<span>${l}</span></button>`).join('') + `<div class="rail-foot">Free friends beta · Texas · 18+<br>Points have no cash value.</div>`;
  const unread = S.convos.filter(isUnread).length;
  $('#btn-msg').innerHTML = ic('msg') + (unread ? `<span class="badge-count">${unread}</span>` : '');
  if (document.activeElement !== $('#citysel')) $('#citysel').value = myCity();
}
function render() {
  if (!S.me || $('#app').hidden) return;
  // Keep whatever someone is typing when live data re-renders the page.
  const a = document.activeElement, keep = a && a.id && $('#view').contains(a) ? { id: a.id, v: a.value, s: a.selectionStart } : null;
  shell();
  const V = { today, play, feed, me: mePage, messages, profile: profilePage }[S.tab] || today;
  $('#view').innerHTML = V();
  if (keep) { const el = document.getElementById(keep.id); if (el) { el.value = keep.v; el.focus(); try { el.setSelectionRange(keep.s, keep.s) } catch { } } }
  if (S.tab === 'messages') { const b = $('#bubbles'); if (b) b.scrollTop = b.scrollHeight }
}

/* ---------- Today ---------- */
const mine = g => g.players?.includes(S.uid);
function gameRow(g) {
  const w = toDate(g.when), n = g.players?.length || 0, cap = parseInt(g.format) * 2;
  return `<button class="game ${sportCls(g.sport)}" onclick="openGame('${g.id}')"><div class="fmt">${esc(g.format)}<small>${g.sport === 'Basketball' ? 'HOOPS' : 'FLAG'}</small></div><div style="min-width:0"><h3>${esc(g.hostName)}</h3><div class="sub">${esc(g.venue)}</div><div class="sub" style="color:var(--sport);font-weight:700">${mine(g) ? (g.hostUid === S.uid ? '★ Your game' : '✓ You’re in') : esc(g.need)} · ${n}/${cap} players</div></div><div class="right"><span class="time">${timeOf(w)}</span><span class="rp">+${ptsFor(g.format)} RP</span></div></button>`;
}
function seasonCard() {
  const rp = S.me.rp || 0, t = tierOf(rp), pct = t.next ? Math.round((rp - t.min) / (t.next[1] - t.min) * 100) : 100, games = (S.me.wins || 0) + (S.me.losses || 0);
  return `<section class="card season"><div class="season-top"><div><div class="label">Fall season · ${esc(myCity())}</div><div class="big" style="margin-top:8px">${rp.toLocaleString()}<small>RP</small></div></div><span class="tier">★ ${t.name}</span></div><div><div class="bar"><i style="width:${pct}%"></i></div><p class="muted" style="font-size:13px;margin-top:8px">${t.next ? (t.next[1] - rp).toLocaleString() + ' RP to ' + t.next[0] + '.' : 'Top tier reached.'} Ranking points come from confirmed game results.</p></div><div class="kv"><div><b>${S.me.wins || 0}–${S.me.losses || 0}</b><span>Record</span></div><div><b>${S.players.length ? '#' + (S.players.filter(p => (p.rp || 0) > rp).length + 1) : '—'}</b><span>City rank</span></div><div><b>${games ? Math.round((S.me.wins || 0) / games * 100) + '%' : '—'}</b><span>Win rate</span></div></div></section>`;
}
const fpTotal = () => S.workouts.reduce((t, w) => t + (w.fp || 0), 0);
function weekCard() {
  const wk = weekKey(), thisWeek = S.workouts.filter(w => w.week === wk), dow = (new Date().getDay() + 6) % 7;
  const active = new Set(thisWeek.map(w => (toDate(w.at).getDay() + 6) % 7));
  S.posts.filter(p => p.uid === S.uid && p.kind === 'Training' && weekKey(toDate(p.createdAt)) === wk).forEach(p => active.add((toDate(p.createdAt).getDay() + 6) % 7));
  return `<section class="card"><div class="season-top"><div><div class="label">This week</div><h2 style="margin-top:6px">${active.size} active day${active.size === 1 ? '' : 's'}</h2></div><div style="text-align:right"><div class="big" style="font-size:34px">${fpTotal()}</div><span class="label">Fitness pts</span></div></div><div class="week">${'MTWTFSS'.split('').map((d, i) => `<div class="${active.has(i) ? 'done' : ''} ${i === dow ? 'today' : ''}"><i>${active.has(i) ? '✓' : ''}</i>${d}</div>`).join('')}</div>${WEEKLY.map(w => { const d = thisWeek.some(x => x.challenge === w.id); return `<div class="wc"><div><b>${w.t}</b><small>${w.d} · +${w.fp} FP</small></div><button class="btn btn-sm ${d ? 'btn-ghost' : 'btn-primary'}" ${d ? 'disabled' : ''} onclick="doWorkout('${w.id}')">${d ? '✓ Done' : 'Complete'}</button></div>` }).join('')}</section>`;
}
function today() {
  const now = new Date(), hr = now.getHours(), hi = hr < 12 ? 'Morning' : hr < 17 ? 'Afternoon' : 'Evening';
  const next = S.games.filter(g => mine(g) && toDate(g.when) > new Date(Date.now() - 2 * 36e5)).sort((a, b) => toDate(a.when) - toDate(b.when))[0];
  const tonight = S.games.filter(g => dayLabel(toDate(g.when)) === 'Today');
  let ticket;
  if (next) { const w = toDate(next.when), [cd, cdl] = countdown(w); ticket = `<section class="ticket ${sportCls(next.sport)}" aria-label="Your next game"><div class="main"><div class="label">Next up · ${esc(next.format)} ${esc(next.sport)}</div><h2>${esc(next.hostName)}${next.hostUid === S.uid ? ' <em>· your game</em>' : ''}</h2><div class="meta"><span>◷ ${dayLabel(w)}, ${timeOf(w)}</span><span>⌖ ${esc(next.venue)}</span><span>${next.players.length} in</span></div><div class="row"><button class="btn btn-primary btn-sm" onclick="startGame('${next.id}')">${ic('whistle', false, 'width="16" height="16"')} Open scoreboard</button><a class="btn btn-ghost btn-sm" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(next.venue + ' ' + next.city + ' TX')}" target="_blank" rel="noopener">Directions ↗</a><button class="btn btn-ghost btn-sm" onclick="openGame('${next.id}')">Details</button></div></div><div class="stub"><b style="font-family:var(--display)">${cd}</b><small>${cdl}</small></div></section>` }
  else ticket = `<section class="ticket"><div class="main"><div class="label">Next up</div><h2>No game on your <em>calendar.</em></h2><div class="meta"><span>Join a game below or post your own and see who shows up.</span></div><div class="row"><button class="btn btn-primary btn-sm" onclick="postGame()">＋ Post a game</button><button class="btn btn-ghost btn-sm" onclick="go('play',{play:'games'})">Browse games</button></div></div><div class="stub"><b style="font-family:var(--display)">0</b><small>Games booked</small></div></section>`;
  const recent = S.posts.slice(0, 3);
  return `<div class="cols two"><div style="min-width:0"><div class="greet"><div><div class="label">${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div><h1 style="margin-top:6px">${hi}, <span>${esc(first())}.</span></h1></div></div>${ticket}
  <div class="sec"><h2>Today in ${esc(myCity())}</h2><button class="link" onclick="go('play',{play:'games'})">All games →</button></div>${!S.loaded.games ? '<div class="loading">Loading games…</div>' : `<div class="games">${tonight.map(gameRow).join('') || '<div class="empty">No games today yet. Post one and see who shows up.</div>'}</div>`}
  ${window.innerWidth < 960 ? `<div style="display:grid;gap:18px;margin-top:22px">${seasonCard()}${weekCard()}</div>` : ''}
  <div class="sec"><h2>From the community</h2><button class="link" onclick="openReels()">Watch reels →</button></div>${recent.length ? `<div class="hl-grid">${recent.map((p, i) => `<button class="hl" onclick="openReels(${i})">${p.mediaUrl && p.mediaType?.startsWith('image/') ? `<img src="${esc(p.mediaUrl)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">` : art(p.art)}<span>${esc(p.name)}<small>${esc(p.caption.slice(0, 42))}${p.caption.length > 42 ? '…' : ''}</small></span></button>`).join('')}</div>` : '<div class="empty">No posts yet. Be the first to share a highlight.</div>'}</div>
  <aside class="rail">${seasonCard()}${weekCard()}</aside></div>`;
}

/* ---------- Play ---------- */
function play() {
  const segs = [['games', 'Games'], ['players', 'Players'], ['tournaments', 'Tournaments']];
  return `<div class="greet"><div><div class="label">${esc(myCity())} · Fall season</div><h1 style="margin-top:6px">Play</h1></div><button class="btn btn-primary" onclick="postGame()">＋ Post a game</button></div><div class="seg" role="tablist">${segs.map(([k, l]) => `<button role="tab" aria-selected="${S.play === k}" class="${S.play === k ? 'on' : ''}" onclick="S.play='${k}';render()">${l}</button>`).join('')}</div>${{ games: playGames, players: playPlayers, tournaments: playTours }[S.play]()}`;
}
function playGames() {
  if (!S.loaded.games) return '<div class="loading">Loading games…</div>';
  const fm = S.sport === 'All' ? ['1v1', '2v2', '3v3', '4v4', '5v5', '6v6', '7v7'] : FORMATS[S.sport];
  const list = S.games.filter(g => (S.sport === 'All' || g.sport === S.sport) && (S.fmt === 'All' || g.format === S.fmt));
  const groups = {}; list.forEach(g => (groups[dayLabel(toDate(g.when))] ??= []).push(g));
  return `<div class="toolbar"><div class="chips">${['All', ...SPORTS].map(s => `<button class="chip ${S.sport === s ? 'on' : ''}" onclick="S.sport='${s}';S.fmt='All';render()">${s !== 'All' ? `<span class="dot ${sportCls(s)}"></span>` : ''}${s}</button>`).join('')}</div><select aria-label="Game size" onchange="S.fmt=this.value;render()"><option value="All">Any size</option>${fm.map(f => `<option ${S.fmt === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div><div class="games">${Object.entries(groups).map(([d, gs]) => `<div class="day-label">${d}</div>${gs.map(gameRow).join('')}`).join('') || `<div class="empty">No upcoming games in ${esc(myCity())}${S.sport !== 'All' || S.fmt !== 'All' ? ' that match' : ''}. Post the first one.</div>`}</div>
  <button class="card" style="width:100%;text-align:left;margin-top:16px;display:flex;gap:14px;align-items:center" onclick="startGame()"><span style="width:48px;height:48px;border-radius:12px;display:grid;place-items:center;background:var(--surface-2);color:var(--brand)">${ic('whistle', false, 'width="24" height="24"')}</span><span style="flex:1"><b style="display:block">Practice scoreboard</b><small class="muted">Try the clock and scoring without a game.</small></span><span class="link">Open →</span></button>`;
}
function playPlayers() {
  if (!S.loaded.players) return '<div class="loading">Loading players…</div>';
  const list = [...S.players].sort((a, b) => (b.rp || 0) - (a.rp || 0) || a.name.localeCompare(b.name));
  return `<div class="lb">${list.map((p, i) => `<button class="lb-row ${p.id === S.uid ? 'me' : ''}" onclick="openProfile('${p.id}')"><span class="n">${i + 1}</span>${avatar(p.name, 'sm')}<span style="min-width:0"><strong>${esc(p.name)}${p.id === S.uid ? ' · You' : ''}</strong><small>${esc((p.sports || []).join(' · '))} · ${tierOf(p.rp || 0).name}</small></span><span class="pts">${(p.rp || 0).toLocaleString()}<small>${p.wins || 0}–${p.losses || 0}</small></span></button>`).join('') || '<div class="empty">No players here yet.</div>'}</div><p class="muted" style="font-size:13px;margin-top:12px">${list.length} player${list.length === 1 ? '' : 's'} in ${esc(myCity())}, ranked by points from confirmed results. Points are free and have no cash value.</p>`;
}
function playTours() {
  const interested = new Set(S.me.tournamentInterest || []);
  return TOURNAMENTS.map(t => `<section class="card tour ${sportCls(t.sport)}" style="margin-bottom:14px"><div class="art-box">${art(t.art)}</div><div class="body"><span class="sportbar"><span class="dot"></span>${t.sport} · ${t.format}</span><h2>${t.name}</h2><p class="muted" style="font-size:13px">${t.when} · ${t.where} · Group play, then single elimination · ${t.size} teams</p><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span class="label">Registration opens soon</span><button class="btn btn-sm ${interested.has(t.name) ? 'btn-ghost' : 'btn-primary'}" onclick="interest('${t.name}')">${interested.has(t.name) ? '✓ Interested' : 'I’m interested'}</button></div></div></section>`).join('') + `<p class="muted" style="font-size:13px">No entry fees or prizes yet. We’ll use the interest list to plan brackets.</p>`;
}
async function interest(name) { const has = (S.me.tournamentInterest || []).includes(name); try { await updateDoc(doc(db, 'users', S.uid), { tournamentInterest: has ? arrayRemove(name) : arrayUnion(name) }); toast(has ? 'Removed from the interest list.' : 'You’re on the interest list.') } catch (e) { console.error(e); toast('Couldn’t save. Try again.') } }

/* ---------- Games: details, join, post ---------- */
async function openGame(id) {
  const g = S.games.find(x => x.id === id); if (!g) return;
  const w = toDate(g.when), j = mine(g), host = g.hostUid === S.uid, cap = parseInt(g.format) * 2;
  sheet(`<span class="sportbar ${sportCls(g.sport)}"><span class="dot"></span>${esc(g.sport)} · ${esc(g.format)}</span><h2 style="margin-top:8px">${esc(g.hostName)}</h2><div style="display:grid;gap:6px;font-size:14px;margin-top:10px"><span>◷ ${dayLabel(w)}, ${timeOf(w)}</span><span>⌖ ${esc(g.venue)}, ${esc(g.city)}</span><span style="color:var(--gold);font-weight:700">+${ptsFor(g.format)} RP for a confirmed win</span></div><div class="label" style="margin-top:16px">${g.players.length}/${cap} players in</div><div class="roster" id="roster">${g.players.map(u => `<span class="chip">${esc(S.users[u]?.name || '…')}</span>`).join('')}</div><p class="muted" style="font-size:13px;margin-top:12px">${g.sport === 'Flag football' ? 'Flag pulls end the play. No tackling. Captains confirm field size and scoring before kickoff.' : 'Games to 21, win by 2 unless captains agree otherwise.'}</p><div class="actions">${host ? `<button class="btn btn-ghost" onclick="cancelGame('${id}')">Cancel game</button>` : `<button class="btn btn-ghost" onclick="closeSheet();openProfile('${g.hostUid}')">View host</button>`}${host ? `<button class="btn btn-primary" onclick="startGame('${id}')">Open scoreboard</button>` : `<button class="btn btn-primary" onclick="joinGame('${id}')">${j ? 'Leave game' : 'I’m in'}</button>`}</div>`);
  const missing = g.players.filter(u => !S.users[u]);
  if (missing.length) { await Promise.all(missing.map(loadUser)); const r = $('#roster'); if (r) r.innerHTML = g.players.map(u => `<span class="chip">${esc(S.users[u]?.name || 'Player')}</span>`).join('') }
}
async function loadUser(uid) { if (S.users[uid]) return S.users[uid]; try { const d = await getDoc(doc(db, 'users', uid)); if (d.exists()) S.users[uid] = { id: uid, ...d.data() } } catch (e) { console.error(e) } return S.users[uid] }
async function joinGame(id) {
  const g = S.games.find(x => x.id === id), j = mine(g);
  if (!j && g.players.length >= parseInt(g.format) * 2) return toast('This game is full.');
  try { await updateDoc(doc(db, 'games', id), { players: j ? arrayRemove(S.uid) : arrayUnion(S.uid) }); closeSheet(); toast(j ? 'You left the game.' : 'You’re in. See you there.') }
  catch (e) { console.error(e); toast('Couldn’t update the game. Try again.') }
}
async function cancelGame(id) {
  sheet(`<h2>Cancel this game?</h2><p class="muted">Everyone who joined will see it disappear from their schedule.</p><div class="actions"><button class="btn btn-ghost" onclick="closeSheet()">Keep it</button><button class="btn btn-primary" id="cg">Cancel game</button></div>`);
  $('#cg').onclick = async () => { try { await deleteDoc(doc(db, 'games', id)); closeSheet(); toast('Game canceled.') } catch (e) { console.error(e); toast('Couldn’t cancel. Try again.') } };
}
function postGame(vs = '') {
  const def = new Date(Date.now() + 36e5 * 3); def.setMinutes(0, 0, 0);
  const local = new Date(def - def.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
  sheet(`<h2>Post a game</h2><p class="muted">${vs ? 'Challenge ' + esc(vs) + '. They’ll see it in ' + esc(myCity()) + '’s game list.' : 'Anyone in ' + esc(myCity()) + ' can join.'}</p><form id="pg"><label class="field" for="pgs"><span>Sport</span><select id="pgs">${SPORTS.map(s => `<option ${(S.me.sports || [])[0] === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label class="field" for="pgf"><span>Format</span><select id="pgf"></select></label><label class="field" for="pgn"><span>Looking for</span><select id="pgn">${(vs ? ['Challenge: ' + vs] : ['Open challenge', 'Need players', 'Team challenge', 'Casual run']).map(x => `<option>${esc(x.slice(0, 40))}</option>`).join('')}</select></label><label class="field" for="pgv"><span>Where</span><input id="pgv" required minlength="2" maxlength="100" placeholder="e.g. Pease Park Courts"></label><label class="field" for="pgd"><span>When</span><input id="pgd" type="datetime-local" required value="${local}"></label><p id="pgerr" class="auth-err" hidden></p><div class="actions"><button type="button" class="btn btn-ghost" onclick="closeSheet()">Cancel</button><button class="btn btn-primary" id="pggo">Post game</button></div></form>`);
  const fill = () => { $('#pgf').innerHTML = FORMATS[$('#pgs').value].map(f => `<option ${f === '3v3' ? 'selected' : ''}>${f}</option>`).join('') }; $('#pgs').onchange = fill; fill();
  $('#pg').onsubmit = async e => {
    e.preventDefault(); const when = new Date($('#pgd').value), venue = $('#pgv').value.trim(), err = $('#pgerr');
    if (venue.length < 2) { err.hidden = false; err.textContent = 'Add where you’re playing.'; return }
    if (isNaN(when) || when < Date.now() - 6e4) { err.hidden = false; err.textContent = 'Pick a time in the future.'; return }
    $('#pggo').disabled = true;
    try { await addDoc(collection(db, 'games'), { hostUid: S.uid, hostName: myName(), sport: $('#pgs').value, format: $('#pgf').value, need: $('#pgn').value, venue, city: myCity(), when: Timestamp.fromDate(when), players: [S.uid], createdAt: serverTimestamp() }); closeSheet(); go('play', { play: 'games', sport: 'All', fmt: 'All' }); toast('Game posted.') }
    catch (x) { console.error(x); err.hidden = false; err.textContent = 'Couldn’t post the game. Check your connection and try again.'; $('#pggo').disabled = false }
  };
}

/* ---------- Create menu, posts, workouts ---------- */
function openCreate() { sheet(`<h2>What’s the play?</h2>${[['swords', 'Post a game', 'Open challenge or call out a player', 'postGame()'], ['whistle', 'Practice scoreboard', 'Run the clock and score', 'startGame()'], ['camera', 'Share a highlight', FEATURES.uploads ? 'Photo or video from your game' : 'Tell everyone how the run went', "newPost('Highlight')"], ['dumbbell', 'Log a workout', 'Training and fitness points', "newPost('Training')"]].map(o => `<button class="create-opt" onclick="closeSheet();${o[3]}"><span class="ic">${ic(o[0])}</span><span><b>${o[1]}</b><small>${o[2]}</small></span><span class="muted">›</span></button>`).join('')}`) }
function newPost(kind) {
  sheet(`<h2>${kind === 'Training' ? 'Log a workout' : 'Share a highlight'}</h2><form id="np"><label class="field" for="npc"><span>Caption</span><textarea id="npc" required maxlength="1000" placeholder="${kind === 'Training' ? 'What did you work on? How did it feel?' : 'What happened out there?'}"></textarea></label><label class="field" for="npa"><span>Sport</span><select id="npa">${SPORTS.map(s => `<option>${s}</option>`).join('')}</select></label>${FEATURES.uploads ? `<label class="field" for="npf"><span>Photo or video (optional, up to 25 MB)</span><input id="npf" type="file" accept="image/*,video/*"></label>` : ''}<p id="nperr" class="auth-err" hidden></p><div class="actions"><button type="button" class="btn btn-ghost" onclick="closeSheet()">Cancel</button><button class="btn btn-primary" id="npgo">Post</button></div></form>`);
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

/* ---------- Feed ---------- */
function postCard(p) {
  const l = (p.likedBy || []).includes(S.uid), when = toDate(p.createdAt);
  return `<article class="post"><div class="post-head"><button onclick="openProfile('${p.uid}')">${avatar(p.name)}</button><div><button onclick="openProfile('${p.uid}')"><strong>${esc(p.name)}</strong></button><small>${ago(when)} · ${esc(p.city || '')}</small></div><span class="kind">${esc(p.kind)}</span>${p.uid === S.uid ? `<button class="del" onclick="deletePost('${p.id}')" aria-label="Delete post">Delete</button>` : ''}</div><p class="cap">${esc(p.caption)}</p><div class="media">${p.mediaUrl ? (p.mediaType?.startsWith('video/') ? `<video src="${esc(p.mediaUrl)}" controls playsinline preload="metadata"></video>` : `<img src="${esc(p.mediaUrl)}" alt="Photo from ${esc(p.name)}" loading="lazy">`) : art(p.art)}</div><div class="acts"><button class="${l ? 'on' : ''}" aria-pressed="${l}" onclick="like('${p.id}')">${ic('heart', l)} ${(p.likedBy || []).length}</button><button onclick="openComments('${p.id}')">${ic('chat')} Comment</button><button onclick="share()">${ic('share')} Share</button></div></article>`;
}
async function like(id) { const p = S.posts.find(x => x.id === id) || Object.values(S.profilePosts).flat().find(x => x.id === id); if (!p) return; const l = (p.likedBy || []).includes(S.uid); try { await updateDoc(doc(db, 'posts', id), { likedBy: l ? arrayRemove(S.uid) : arrayUnion(S.uid) }) } catch (e) { console.error(e); toast('Couldn’t save your like.') } }
function deletePost(id) { sheet(`<h2>Delete this post?</h2><p class="muted">It will be removed for everyone.</p><div class="actions"><button class="btn btn-ghost" onclick="closeSheet()">Keep it</button><button class="btn btn-primary" id="dp">Delete</button></div>`); $('#dp').onclick = async () => { try { await deleteDoc(doc(db, 'posts', id)); closeSheet(); toast('Post deleted.') } catch (e) { console.error(e); toast('Couldn’t delete. Try again.') } } }
function share() { const url = location.origin; (navigator.share ? navigator.share({ title: 'NextMatch', text: 'Find a pickup game with me on NextMatch', url }) : navigator.clipboard.writeText(url).then(() => toast('Link copied.'))).catch(() => { }) }
function openComments(pid) {
  sheet(`<h2>Comments</h2><div id="clist"><div class="loading">Loading…</div></div><form id="cf" class="compose" style="padding:12px 0 0;border:0"><input id="cfi" maxlength="500" placeholder="Add a comment…" aria-label="Comment" autocomplete="off"><button class="btn btn-primary btn-sm">Post</button></form>`);
  commentSub = onSnapshot(query(collection(db, 'posts', pid, 'comments'), orderBy('at'), limit(100)), q => { const el = $('#clist'); if (!el) return; el.innerHTML = q.docs.map(d => { const c = d.data(); return `<div class="comment">${avatar(c.name, 'sm')}<div><strong>${esc(c.name)}</strong><p>${esc(c.text)}</p></div>${c.uid === S.uid ? `<button class="link" onclick="delComment('${pid}','${d.id}')">Delete</button>` : '<span></span>'}</div>` }).join('') || '<p class="muted" style="padding:10px 0">No comments yet. Start the conversation.</p>' }, fail('comments'));
  $('#cf').onsubmit = async e => { e.preventDefault(); const t = $('#cfi').value.trim(); if (!t) return; $('#cfi').value = ''; try { await addDoc(collection(db, 'posts', pid, 'comments'), { uid: S.uid, name: myName(), text: t, at: serverTimestamp() }) } catch (x) { console.error(x); toast('Couldn’t post your comment.') } };
}
async function delComment(pid, cid) { try { await deleteDoc(doc(db, 'posts', pid, 'comments', cid)) } catch (e) { console.error(e) } }
function feed() {
  const segs = [['all', 'For you'], ['following', 'Following'], ['training', 'Training']];
  const list = S.posts.filter(p => S.feed === 'all' || (S.feed === 'training' ? p.kind === 'Training' : S.following.has(p.uid) || p.uid === S.uid));
  const suggest = S.players.filter(p => p.id !== S.uid && !S.following.has(p.id)).slice(0, 5);
  return `<div class="cols two"><div style="min-width:0"><div class="greet"><h1>Feed</h1><button class="btn btn-ghost btn-sm" onclick="openReels()">▶ Reels</button></div><div class="seg">${segs.map(([k, l]) => `<button class="${S.feed === k ? 'on' : ''}" onclick="S.feed='${k}';render()">${l}</button>`).join('')}</div><div class="composer">${avatar(myName())}<button onclick="newPost('Highlight')">Share a highlight, ${esc(first())}…</button></div>${!S.loaded.posts ? '<div class="loading">Loading posts…</div>' : list.map(postCard).join('') || `<div class="empty">${S.feed === 'following' ? 'Follow players to fill this feed.' : 'Nothing here yet. Post the first one.'}</div>`}</div><aside class="rail"><section class="card"><div class="label">Players in ${esc(myCity())}</div>${suggest.map(p => `<div class="team-row">${avatar(p.name)}<div style="min-width:0"><button onclick="openProfile('${p.id}')"><strong>${esc(p.name)}</strong></button><small>${esc((p.sports || []).join(' · '))}</small></div><button class="btn btn-sm btn-primary" onclick="follow('${p.id}')">Follow</button></div>`).join('') || '<p class="muted" style="font-size:13px;margin-top:8px">You’re following everyone here. Invite more friends.</p>'}<button class="btn btn-ghost btn-sm" style="margin-top:12px;width:100%" onclick="share()">Invite friends</button></section></aside></div>`;
}
async function follow(uid) { const f = S.following.has(uid), r = doc(db, 'users', S.uid, 'following', uid); try { f ? await deleteDoc(r) : await setDoc(r, { at: serverTimestamp() }); toast(f ? 'Unfollowed.' : 'Following.') } catch (e) { console.error(e); toast('Couldn’t update. Try again.') } }

/* ---------- Reels ---------- */
function openReels(start = 0) {
  const list = S.posts; if (!list.length) return toast('No posts yet.');
  $('#overlay').innerHTML = `<div class="reels" role="dialog" aria-label="Reels"><button class="reels-close" aria-label="Close reels" onclick="closeOverlay()">✕</button><div class="reels-stream" id="rs" tabindex="0">${list.map(p => { const l = (p.likedBy || []).includes(S.uid); return `<article class="reel">${p.mediaUrl ? (p.mediaType?.startsWith('video/') ? `<video src="${esc(p.mediaUrl)}" autoplay muted loop playsinline></video>` : `<img src="${esc(p.mediaUrl)}" alt="">`) : art(p.art)}<div class="reel-txt"><div style="display:flex;gap:10px;align-items:center">${avatar(p.name, 'sm')}<b style="margin:0">${esc(p.name)}</b></div><b>${esc(p.caption)}</b><small>${esc(p.kind)} · ${ago(toDate(p.createdAt))}</small></div><div class="reel-acts"><button class="${l ? 'on' : ''}" aria-label="Like" onclick="like('${p.id}').then(()=>openReels(${list.indexOf(p)}))">${ic('heart', l)}${(p.likedBy || []).length}</button>${p.uid !== S.uid ? `<button aria-label="View profile" onclick="closeOverlay();openProfile('${p.uid}')">${ic('me')}Profile</button>` : ''}<button aria-label="Share" onclick="share()">${ic('share')}Share</button></div></article>` }).join('')}</div></div>`;
  const rs = $('#rs'); rs.scrollTop = start * rs.clientHeight; rs.focus();
}
function closeOverlay() { $('#overlay').innerHTML = '' }

/* ---------- Me and other players ---------- */
function playerCard(p, buttons) {
  const rp = p.rp || 0;
  return `<section class="pcard"><div class="stripe"></div><div class="num">${String(rp % 90 + 1)}</div><div class="label">${esc(p.city || '')}, TX · ${esc((p.sports || []).join(' · '))}</div><h1>${esc(p.name)}</h1><span class="tier">★ ${tierOf(rp).name}</span><div class="pc-stats"><div><b>${rp.toLocaleString()}</b><span>Rank pts</span></div><div><b>${p.wins || 0}–${p.losses || 0}</b><span>Record</span></div><div><b>${p.id === S.uid ? fpTotal() : '—'}</b><span>Fitness</span></div><div><b>${p.id === S.uid ? S.following.size : (S.users[p.id]?.id ? '•' : '—')}</b><span>${p.id === S.uid ? 'Following' : 'Status'}</span></div></div><div class="row">${buttons}</div></section>`;
}
function mePage() {
  const myPosts = S.posts.filter(p => p.uid === S.uid), upcoming = S.games.filter(mine).sort((a, b) => toDate(a.when) - toDate(b.when));
  return `<div class="cols two"><div style="min-width:0">${playerCard({ ...S.me, id: S.uid }, `<button class="btn btn-primary btn-sm" onclick="editMe()">Edit profile</button><button class="btn btn-ghost btn-sm" onclick="share()">Invite friends</button>`)}<div class="sec"><h2>Your games</h2></div><div class="games">${upcoming.map(gameRow).join('') || '<div class="empty">You haven’t joined any upcoming games.</div>'}</div><div class="sec"><h2>Your posts</h2><button class="link" onclick="newPost('Highlight')">＋ New</button></div>${myPosts.map(postCard).join('') || '<div class="empty">Share your first highlight.</div>'}</div><aside class="rail" style="display:flex">${meSide()}</aside>${window.innerWidth < 960 ? `<div style="display:grid;gap:18px">${meSide()}</div>` : ''}</div>`;
}
function meSide() { return `<section class="card"><div class="label">Account</div><div class="setrow" style="margin-top:6px"><div><strong>Signed in as</strong><small>${esc(auth.currentUser?.email || 'Google or Apple account')}</small></div></div><div class="setrow"><div><strong>Appearance</strong><small>Light or dark follows your device</small></div></div><div class="setrow"><div><strong>Sign out</strong><small>You can sign back in any time</small></div><button class="btn btn-ghost btn-sm" onclick="doSignOut()">Sign out</button></div></section>` }
function editMe() {
  const sp = new Set(S.me.sports || []);
  sheet(`<h2>Edit profile</h2><form id="em"><label class="field" for="emn"><span>Player name</span><input id="emn" required minlength="2" maxlength="40" value="${esc(S.me.name)}"></label><label class="field" for="emc"><span>City</span><select id="emc">${CITIES.map(c => `<option ${c === myCity() ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label><label class="field"><span>Sports</span></label><div class="chips" id="emsp">${SPORTS.map(s => `<button type="button" class="chip ${sp.has(s) ? 'on' : ''}" data-s="${s}" aria-pressed="${sp.has(s)}">${s}</button>`).join('')}</div><p class="muted" style="font-size:12px;margin-top:12px">Posts you already made keep the name you used then.</p><div class="actions"><button type="button" class="btn btn-ghost" onclick="closeSheet()">Cancel</button><button class="btn btn-primary">Save</button></div></form>`);
  $('#emsp').querySelectorAll('.chip').forEach(b => b.onclick = () => { b.classList.toggle('on'); b.setAttribute('aria-pressed', b.classList.contains('on')) });
  $('#em').onsubmit = async e => { e.preventDefault(); const name = $('#emn').value.trim().replace(/\s+/g, ' '); if (name.length < 2) return toast('Name needs at least 2 characters.'); const sports = [...document.querySelectorAll('#emsp .chip.on')].map(b => b.dataset.s); try { await updateDoc(doc(db, 'users', S.uid), { name, city: $('#emc').value, sports: sports.length ? sports : ['Basketball'] }); closeSheet(); toast('Profile saved.') } catch (x) { console.error(x); toast('Couldn’t save. Try again.') } };
}
function doSignOut() { closeSheet(); S.tab = 'today'; signOut(auth) }
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
  const f = S.following.has(uid), theirs = S.posts.filter(x => x.uid === uid).length ? S.posts.filter(x => x.uid === uid) : (S.profilePosts[uid] || []);
  const games = S.games.filter(g => g.players.includes(uid));
  return `<button class="link" style="margin-bottom:14px" onclick="go('play')">‹ Back to Play</button><div class="cols two"><div style="min-width:0">${playerCard(p, `<button class="btn btn-primary btn-sm" onclick="postGame('${esc(p.name).replace(/'/g, '&#39;')}')">⚔ Challenge</button><button class="btn btn-ghost btn-sm" onclick="follow('${uid}')">${f ? 'Following' : 'Follow'}</button><button class="btn btn-ghost btn-sm" onclick="openThread('${uid}')">Message</button>`)}<div class="sec"><h2>Posts</h2></div>${theirs.map(postCard).join('') || '<div class="empty">No posts yet.</div>'}</div><aside class="rail"><section class="card"><div class="label">Upcoming games</div>${games.map(g => `<div class="team-row ${sportCls(g.sport)}"><span class="fmt" style="font-size:20px">${esc(g.format)}</span><div style="min-width:0"><strong>${esc(g.venue)}</strong><small>${dayLabel(toDate(g.when))}, ${timeOf(toDate(g.when))}</small></div><button class="btn btn-ghost btn-sm" onclick="openGame('${g.id}')">View</button></div>`).join('') || '<p class="muted" style="font-size:13px;margin-top:8px">No upcoming games in your city.</p>'}</section></aside></div>`;
}

/* ---------- Messages ---------- */
const convoId = other => [S.uid, other].sort().join('_');
const otherOf = c => c.members.find(m => m !== S.uid);
const isUnread = c => c.lastUid && c.lastUid !== S.uid && toDate(c.updatedAt) > new Date(ls.get('seen_' + c.id, 0));
async function openThread(other) {
  closeSheet(); await loadUser(other);
  const id = convoId(other); S.thread = { id, other }; S.msgs = []; ls.set('seen_' + id, Date.now());
  threadSub?.(); threadSub = onSnapshot(query(collection(db, 'conversations', id, 'messages'), orderBy('at'), limit(200)), q => { S.msgs = q.docs.map(d => d.data()); ls.set('seen_' + id, Date.now()); renderSoon() }, fail('this conversation'));
  S.tab = 'messages'; render(); window.scrollTo(0, 0);
}
function messages() {
  const t = S.thread, other = t && S.users[t.other];
  return `<div class="greet"><h1>Messages</h1></div><div class="inbox ${t ? 'open' : ''}"><div class="threads">${S.convos.map(c => { const o = otherOf(c); return `<button class="thread ${t?.id === c.id ? 'on' : ''}" onclick="openThread('${o}')">${avatar(c.names?.[o])}<div style="min-width:0"><strong>${esc(c.names?.[o] || 'Player')}</strong><small>${c.lastUid === S.uid ? 'You: ' : ''}${esc(c.last)}</small></div>${isUnread(c) ? '<span class="unread" aria-label="Unread"></span>' : '<span></span>'}</button>` }).join('') || '<div class="empty" style="border:0">No conversations yet. Open a player’s profile and tap Message.</div>'}</div><div class="convo">${t ? `<div class="convo-head"><button class="link convo-back" onclick="S.thread=null;render()" aria-label="Back to conversations">‹</button>${avatar(other?.name, 'sm')}<div><button onclick="openProfile('${t.other}')"><strong>${esc(other?.name || 'Player')}</strong></button><small>${esc(other?.city || '')}</small></div></div><div class="bubbles" id="bubbles">${S.msgs.map(m => `<div class="bubble ${m.uid === S.uid ? 'me' : ''}">${esc(m.text)}<small>${m.at ? timeOf(toDate(m.at)) : 'Sending…'}</small></div>`).join('') || '<p class="muted" style="text-align:center;margin:auto;font-size:13px">Say hi and set up a game.</p>'}</div><form class="compose" id="mc"><input id="mci" maxlength="1000" placeholder="Message ${esc((other?.name || '').split(' ')[0])}…" aria-label="Message" autocomplete="off"><button class="btn btn-primary btn-sm">Send</button></form>` : '<div class="empty" style="margin:auto;border:0">Pick a conversation.</div>'}</div></div>`;
}
document.addEventListener('submit', async e => {
  if (e.target.id !== 'mc') return; e.preventDefault();
  const input = $('#mci'), text = input.value.trim(), t = S.thread; if (!text || !t) return;
  input.value = '';
  try {
    const other = S.users[t.other];
    await setDoc(doc(db, 'conversations', t.id), { members: t.id.split('_'), names: { [S.uid]: myName(), [t.other]: other?.name || 'Player' }, last: text.slice(0, 120), lastUid: S.uid, updatedAt: serverTimestamp() }, { merge: true });
    await addDoc(collection(db, 'conversations', t.id, 'messages'), { uid: S.uid, text, at: serverTimestamp() });
  } catch (x) { console.error(x); input.value = text; toast('Message not sent. Try again.') }
});

/* ---------- Scoreboard (runs on this device) ---------- */
let G = null, T = null;
function startGame(id) {
  closeSheet(); const g = S.games.find(x => x.id === id);
  G = g ? { home: g.hostName, away: g.need?.startsWith('Challenge: ') ? g.need.slice(11) : 'Challengers', sport: g.sport, format: g.format, venue: g.venue, pts: ptsFor(g.format) } : { home: 'Home', away: 'Away', sport: (S.me.sports || ['Basketball'])[0], format: '3v3', venue: 'Practice', pts: 0 };
  const f = G.sport === 'Flag football';
  Object.assign(G, { stage: 1, hs: 0, as: 0, per: 1, maxPer: f ? 2 : 4, perLen: f ? 1200 : 600, rem: f ? 1200 : 600, run: false, t0: 0, base: 0, log: [], hist: [], practice: !g });
  logIt('Scoreboard opened.'); drawSB();
}
const secs = () => !G ? 0 : G.run ? Math.max(0, G.base - Math.floor((Date.now() - G.t0) / 1000)) : G.rem;
const clk = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
function logIt(t) { G.log.unshift([(G.sport === 'Flag football' ? 'H' : 'Q') + G.per + ' ' + clk(secs()), t]) }
function drawSB() {
  if (!G) { closeOverlay(); return }
  const g = G, s = secs(), inc = g.sport === 'Flag football' ? [1, 2, 6] : [1, 2, 3];
  let body;
  if (g.stage < 3) body = `<div class="sb-meta"><span class="label">${g.stage === 2 ? 'Final' : g.run ? '● Live' : 'Clock stopped'} · ${g.sport === 'Flag football' ? 'Half' : 'Quarter'} ${g.per}</span></div><div class="led ${g.run ? '' : 'paused'}" id="led">${clk(s)}</div><div class="sb-period">${Array.from({ length: g.maxPer }, (_, i) => `<i class="${i < g.per ? 'on' : ''}"></i>`).join('')}</div><div class="sides">${['h', 'a'].map(k => { const sc = g[k + 's'], ot = g[(k === 'h' ? 'a' : 'h') + 's'], nm = k === 'h' ? g.home : g.away; return `<div class="side ${sc > ot ? 'lead' : ''}"><div class="nm">${esc(nm)}</div><div class="tag">${k === 'h' ? 'HOME' : 'AWAY'}</div><div class="pts">${sc}</div>${g.stage === 1 ? `<div class="add">${inc.map(n => `<button ${g.run ? '' : 'disabled'} aria-label="Add ${n} for ${esc(nm)}" onclick="addPts('${k}',${n})">+${n}</button>`).join('')}</div>` : ''}</div>` }).join('')}</div>${g.stage === 1 ? `${!g.run && s > 0 ? '<p class="sb-note">Start the clock to score.</p>' : ''}${s === 0 ? '<p class="sb-note" style="color:var(--sb-led)">Period over. Move to the next one or finish.</p>' : ''}<div class="sb-ctl"><button class="sb-btn go" ${!g.run && s === 0 ? 'disabled' : ''} onclick="clockToggle()">${g.run ? '❚❚ Stop clock' : '▶ Start clock'}</button><button class="sb-btn" ${g.per >= g.maxPer ? 'disabled' : ''} onclick="nextPer()">Next ${g.sport === 'Flag football' ? 'half' : 'quarter'}</button><button class="sb-btn" ${g.hist.length ? '' : 'disabled'} onclick="undoPts()">Undo</button><button class="sb-btn" onclick="finish()">Finish →</button></div>` : `<div class="sb-box" style="margin-top:18px">Final: <b>${g.hs}–${g.as}</b>. Two-sided result confirmation and ranking points are the next feature to build.</div><div class="sb-ctl"><button class="sb-btn" onclick="reopenSB()">Fix the score</button><button class="sb-btn go" onclick="closeSB();newPost('Highlight')">Post the result</button><button class="sb-btn" onclick="closeSB()">Done</button></div>`}`;
  $('#overlay').innerHTML = `<div class="sb" role="dialog" aria-label="Scoreboard"><div class="sb-in"><div class="sb-top"><button class="sb-x" aria-label="Close scoreboard" onclick="closeSB()">✕</button><div class="sb-steps"></div><span class="label" style="min-width:40px;text-align:right">${esc(g.format)}</span></div>${body}${g.log.length ? `<details class="sb-log"><summary>Game log · ${g.log.length}</summary>${g.log.slice(0, 12).map(l => `<div><small>${l[0]}</small><span>${esc(l[1])}</span></div>`).join('')}</details>` : ''}<p class="sb-note">${g.practice ? 'Practice mode.' : esc(g.venue) + '.'} The score lives on this device only.</p></div></div>`;
}
function clockToggle() { if (G.run) { G.rem = secs(); G.run = false; clearInterval(T); logIt('Clock stopped.') } else { if (G.rem <= 0) return; G.base = G.rem; G.t0 = Date.now(); G.run = true; logIt('Clock started.'); T = setInterval(() => { const s = secs(), el = $('#led'); if (el) el.textContent = clk(s); if (s === 0) { G.rem = 0; G.run = false; clearInterval(T); logIt('End of period.'); drawSB() } }, 250) } drawSB() }
function addPts(k, n) { if (!G.run) return; G[k + 's'] += n; G.hist.push([k, n]); logIt((k === 'h' ? G.home : G.away) + ' +' + n); drawSB() }
function undoPts() { const l = G.hist.pop(); if (!l) return; G[l[0] + 's'] -= l[1]; logIt('Undo −' + l[1]); drawSB() }
function pauseQ() { if (G?.run) { G.rem = secs(); G.run = false; clearInterval(T) } }
function nextPer() { pauseQ(); G.per++; G.rem = G.perLen; logIt('New period.'); drawSB() }
function finish() { pauseQ(); G.stage = 2; logIt('Final ' + G.hs + '–' + G.as + '.'); drawSB() }
function reopenSB() { G.stage = 1; logIt('Reopened.'); drawSB() }
function closeSB() { pauseQ(); G = null; closeOverlay() }

/* ---------- Header ---------- */
$('#btn-msg').onclick = () => { S.thread = null; go('messages') };
$('#citysel').onchange = async e => { try { await updateDoc(doc(db, 'users', S.uid), { city: e.target.value }); toast('Showing ' + e.target.value + '.') } catch (x) { console.error(x); toast('Couldn’t change city.') } };
let wide = window.innerWidth >= 960; window.addEventListener('resize', () => { if (wide !== (window.innerWidth >= 960)) { wide = !wide; render() } });

// Inline onclick handlers in the templates call these.
Object.assign(window, { go, render, S, openCreate, openGame, joinGame, cancelGame, postGame, newPost, doWorkout, like, deletePost, share, openComments, delComment, follow, openReels, closeOverlay, editMe, doSignOut, openProfile, openThread, startGame, clockToggle, addPts, undoPts, nextPer, finish, closeSB, closeSheet, interest, reopenSB });
