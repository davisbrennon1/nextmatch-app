// Server-side logic for NextMatch. index.js wires these to database events and a timer.
// Runs with full database access, so it does the things players must not do themselves:
// award player points, write notifications, send push messages, hide reported posts.
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

const db = () => getFirestore();
const SITE = () => process.env.SITE_URL || `https://${process.env.GCLOUD_PROJECT}.web.app`;
const TZ = 'America/Chicago';
const ptsFor = f => ({ '1v1': 25, '2v2': 40, '3v3': 50, '4v4': 50 }[f] || 75);
const BAD_TOKEN = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument'];

async function nameOf(uid) {
  const d = await db().doc(`users/${uid}`).get();
  return d.exists ? d.data().name : 'A player';
}
function sideName(g, side) { return g[side + 'TeamName'] || (side === 'home' ? g.hostName : 'Challengers'); }
function when(g) { return g.when.toDate().toLocaleString('en-US', { timeZone: TZ, weekday: 'short', hour: 'numeric', minute: '2-digit' }); }

// Push to every phone/browser a player turned notifications on for. Never throws.
async function pushTo(uids, n) {
  for (const uid of new Set(uids)) {
    try {
      const snap = await db().collection(`users/${uid}/tokens`).get();
      if (snap.empty) continue;
      const res = await getMessaging().sendEachForMulticast({
        tokens: snap.docs.map(d => d.id),
        notification: { title: n.title, body: n.body },
        webpush: { fcmOptions: { link: `${SITE()}/#${n.link || ''}` }, notification: { icon: '/icon-192.png', badge: '/icon-192.png' } }
      });
      await Promise.all(res.responses.map((r, i) => !r.success && BAD_TOKEN.includes(r.error?.code) ? snap.docs[i].ref.delete() : null));
    } catch (e) { console.warn('push skipped', uid, e.code || e.message) }
  }
}

// In-app notification (the bell) plus a push message.
async function notify(uids, n, { push = true } = {}) {
  const list = [...new Set(uids)].filter(Boolean);
  if (!list.length) return;
  const batch = db().batch();
  list.forEach(uid => batch.set(db().collection(`users/${uid}/notifications`).doc(), { type: n.type, title: n.title, body: n.body, link: n.link || '', read: false, at: FieldValue.serverTimestamp() }));
  await batch.commit();
  if (push) await pushTo(list, n);
}

// Both sides agreed on the score: award points exactly once.
async function awardResult(ref) {
  return db().runTransaction(async tx => {
    const snap = await tx.get(ref), g = snap.data();
    if (!g || g.status !== 'confirmed' || g.awarded) return null;
    const hs = g.report.home, as = g.report.away, p = ptsFor(g.format);
    const winner = hs > as ? 'home' : as > hs ? 'away' : null;
    const userRefs = [...g.home, ...g.away].map(u => db().doc(`users/${u}`));
    const teamRefs = ['home', 'away'].map(s => g[s + 'TeamId'] ? db().doc(`teams/${g[s + 'TeamId']}`) : null);
    const users = await Promise.all(userRefs.map(r => tx.get(r)));
    const teams = await Promise.all(teamRefs.map(r => r ? tx.get(r) : null));
    if (winner) {
      const loser = winner === 'home' ? 'away' : 'home';
      users.forEach(u => {
        if (!u.exists) return;
        if (g[winner].includes(u.id)) tx.update(u.ref, { rp: FieldValue.increment(p), wins: FieldValue.increment(1) });
        else if (g[loser].includes(u.id)) tx.update(u.ref, { losses: FieldValue.increment(1) });
      });
      teams.forEach((t, i) => {
        if (!t?.exists) return;
        const side = i === 0 ? 'home' : 'away';
        tx.update(t.ref, side === winner ? { rp: FieldValue.increment(p), wins: FieldValue.increment(1) } : { losses: FieldValue.increment(1) });
      });
    }
    tx.update(ref, { status: 'final', awarded: true, final: { home: hs, away: as, winner, pts: winner ? p : 0 }, finalAt: FieldValue.serverTimestamp() });
    return { winner, p };
  });
}

async function onGameUpdated(before, after, ref) {
  const g = after, link = `game/${ref.id}`, title = `${g.format} at ${g.venue}`;
  const joined = (g.players || []).filter(u => !(before.players || []).includes(u) && u !== g.hostUid);
  for (const u of joined) await notify([g.hostUid], { type: 'join', title: `${await nameOf(u)} joined your game`, body: `${title}, ${when(g)}. ${g.players.length} in so far.`, link });

  if (before.status !== 'reported' && g.status === 'reported') {
    const r = g.report, other = r.side === 'home' ? g.away : g.home;
    await notify(other, { type: 'confirm', title: 'Confirm the final score', body: `${await nameOf(r.by)} reported ${sideName(g, 'home')} ${r.home}, ${sideName(g, 'away')} ${r.away}. Confirm it or dispute it.`, link });
  }
  if (before.status === 'reported' && g.status === 'disputed') {
    await notify(g.players, { type: 'disputed', title: 'Score disputed', body: `${await nameOf(g.responseBy)} disputed the score for ${title}. Talk it out, then report it again.`, link });
  }
  if (before.status !== 'confirmed' && g.status === 'confirmed') {
    const res = await awardResult(ref);
    if (res) {
      const score = `${g.report.home}–${g.report.away}`;
      await notify(g.players, { type: 'final', title: `Final: ${score}`, body: res.winner ? `${sideName(g, res.winner)} wins. +${res.p} player points to the winners.` : 'A draw. No points this time.', link });
    }
  }
}

async function onDirectMessage(cid, m) {
  const [a, b] = cid.split('_'), to = m.uid === a ? b : a;
  if ((await db().doc(`users/${to}/blocked/${m.uid}`).get()).exists) return;
  await pushTo([to], { title: await nameOf(m.uid), body: m.text.slice(0, 140), link: `chat/${m.uid}` });
}

async function onTeamMessage(tid, m) {
  const t = await db().doc(`teams/${tid}`).get();
  if (!t.exists) return;
  await pushTo(t.data().members.filter(u => u !== m.uid), { title: t.data().name, body: `${m.name}: ${m.text.slice(0, 120)}`, link: `team/${tid}` });
}

async function onTeamRequest(tid, uid, r) {
  const t = await db().doc(`teams/${tid}`).get();
  if (!t.exists) return;
  await notify([t.data().captainUid], { type: 'team', title: `${r.name} wants to join ${t.data().name}`, body: 'Open the team to approve or decline.', link: `team/${tid}` });
}

// Three different people reporting the same post hides it until you review it.
async function onReport(r) {
  if (r.targetType !== 'post') return;
  const q = await db().collection('reports').where('targetType', '==', 'post').where('targetId', '==', r.targetId).get();
  if (new Set(q.docs.map(d => d.data().by)).size >= 3) await db().doc(`posts/${r.targetId}`).update({ hidden: true }).catch(() => { });
}

// Runs every 15 minutes: remind players about games starting in about an hour.
async function sendReminders(now = new Date()) {
  const from = Timestamp.fromMillis(now.getTime() + 45 * 60e3), to = Timestamp.fromMillis(now.getTime() + 75 * 60e3);
  const q = await db().collection('games').where('when', '>=', from).where('when', '<=', to).get();
  let sent = 0;
  for (const d of q.docs) {
    const g = d.data();
    if (g.reminded || g.status !== 'open') continue;
    await d.ref.update({ reminded: true });
    await notify(g.players, { type: 'reminder', title: 'Game in about an hour', body: `${g.format} ${g.sport} at ${g.venue}, ${when(g)}.`, link: `game/${d.id}` });
    sent++;
  }
  return sent;
}

module.exports = { ptsFor, awardResult, onGameUpdated, onDirectMessage, onTeamMessage, onTeamRequest, onReport, sendReminders, notify };
