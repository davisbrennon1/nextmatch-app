// Server-side logic for NextMatch. index.js wires these to database events and a timer.
// Runs with full database access, so it does the things players must not do themselves:
// award player points, write notifications, send push messages, hide reported posts.
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

const db = () => getFirestore();
const SITE = () => process.env.SITE_URL || `https://${process.env.GCLOUD_PROJECT}.web.app`;
const TZ = 'America/Chicago';
// Player points: 100 for a win, plus 1 bonus point for every point your side scored.
const WIN_POINTS = 100;
const earnedFor = (score, won) => (won ? WIN_POINTS : 0) + Math.max(0, score | 0);

// Works out each player's points from a confirmed score. If the report lists every player's
// points and they add up to their side's score, each player gets their own points. Otherwise
// (older reports) everyone on a side gets the side's score.
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
const BAD_TOKEN = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument'];

async function nameOf(uid) {
  const d = await db().doc(`users/${uid}`).get();
  return d.exists ? d.data().name : 'A player';
}
// "Eastside Buckets" for team games; "Chris Evans" or "Chris Evans +2" for pickup games.
async function sideLabel(g, side) {
  if (g[side + 'TeamName']) return g[side + 'TeamName'];
  const ids = g[side] || [];
  if (!ids.length) return side === 'home' ? g.hostName : 'Challengers';
  const n = await nameOf(ids[0]);
  return ids.length > 1 ? `${n} +${ids.length - 1}` : n;
}
// Seasons follow the calendar: Winter (Dec–Feb), Spring (Mar–May), Summer (Jun–Aug), Fall (Sep–Nov).
function seasonKey(date) {
  const d = new Date(date.toLocaleString('en-US', { timeZone: TZ })), m = d.getMonth(), y = d.getFullYear();
  if (m === 11) return `${y}-winter`;
  if (m < 2) return `${y - 1}-winter`;
  return `${y}-${m < 5 ? 'spring' : m < 8 ? 'summer' : 'fall'}`;
}
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
    const hs = g.report.home, as = g.report.away, { winner, players, earned } = splitResult(g);
    const userRefs = [...g.home, ...g.away].map(u => db().doc(`users/${u}`));
    const teamRefs = ['home', 'away'].map(s => g[s + 'TeamId'] ? db().doc(`teams/${g[s + 'TeamId']}`) : null);
    const users = await Promise.all(userRefs.map(r => tx.get(r)));
    const teams = await Promise.all(teamRefs.map(r => r ? tx.get(r) : null));
    // Season or tournament game: read the league, and for youth games the kids on both rosters.
    const leagueSnap = g.leagueId ? await tx.get(db().doc(`leagues/${g.leagueId}`)) : null;
    const L = leagueSnap?.exists && [g.homeTeamId, g.awayTeamId].every(t => leagueSnap.data().teamIds.includes(t)) ? leagueSnap.data() : null;
    const youth = L?.division === 'youth';
    const kidPts = youth ? Object.entries({ ...(g.report.kids || {}), ...(g.confirmKids || {}) }).filter(([k, v]) => /^[A-Za-z0-9_-]{1,40}$/.test(k) && Number.isInteger(v) && v >= 0 && v <= 999).slice(0, 160) : [];
    const kidSnaps = [];
    for (const [kid] of kidPts) for (const side of ['home', 'away']) kidSnaps.push({ kid, side, snap: await tx.get(db().doc(`teams/${g[side + 'TeamId']}/kids/${kid}`)) });
    const season = seasonKey(g.when.toDate());
    const record = side => winner ? { [winner === side ? 'wins' : 'losses']: FieldValue.increment(1) } : {};
    users.forEach(u => {
      const p = players[u.id]; if (!u.exists || !p || youth) return; // coaches don't earn points from youth games
      // Season totals restart when a game lands in a new season.
      const d = u.data(), fresh = d.seasonKey !== season, won = winner === p.side, lost = winner && !won;
      const seasonal = fresh ? { seasonKey: season, seasonRp: p.earned, seasonWins: won ? 1 : 0, seasonLosses: lost ? 1 : 0 }
        : { seasonRp: FieldValue.increment(p.earned), ...(won ? { seasonWins: FieldValue.increment(1) } : {}), ...(lost ? { seasonLosses: FieldValue.increment(1) } : {}) };
      tx.update(u.ref, { rp: FieldValue.increment(p.earned), ...(p.counted ? { scored: FieldValue.increment(p.scored) } : {}), ...record(p.side), ...seasonal });
    });
    teams.forEach((t, i) => { const side = i === 0 ? 'home' : 'away'; if (t?.exists) tx.update(t.ref, { rp: FieldValue.increment(earned[side]), ...record(side) }) });
    if (L) {
      const inc = n => FieldValue.increment(n), wl = side => winner ? { [winner === side ? 'wins' : 'losses']: inc(1) } : { ties: inc(1) };
      const score = { home: hs, away: as };
      for (const side of ['home', 'away']) {
        const other = side === 'home' ? 'away' : 'home';
        tx.set(db().doc(`leagues/${g.leagueId}/standings/${g[side + 'TeamId']}`), { name: g[side + 'TeamName'] || 'Team', games: inc(1), pf: inc(score[side]), pa: inc(score[other]), ...wl(side) }, { merge: true });
      }
      const statRow = (name, side, scored, counted, extra) => ({ name, teamId: g[side + 'TeamId'], teamName: g[side + 'TeamName'] || '', rp: inc(earnedFor(scored, winner === side)), ...(counted ? { scored: inc(scored) } : {}), games: inc(1), ...(winner ? { [winner === side ? 'wins' : 'losses']: inc(1) } : {}), ...extra });
      if (youth) {
        const done = new Set();
        for (const { kid, side, snap } of kidSnaps) {
          if (done.has(kid) || !snap.exists || snap.data().status !== 'approved') continue;
          done.add(kid);
          const pts = Object.fromEntries(kidPts)[kid];
          tx.set(db().doc(`leagues/${g.leagueId}/stats/kid_${kid}`), statRow(snap.data().name, side, pts, true, { youth: true, parentUid: snap.data().parentUid, jersey: snap.data().jersey || '' }), { merge: true });
        }
      } else {
        users.forEach(u => { const p = players[u.id]; if (u.exists && p) tx.set(db().doc(`leagues/${g.leagueId}/stats/${u.id}`), statRow(u.data().name, p.side, p.scored, p.counted, { youth: false }), { merge: true }) });
      }
    }
    const final = { home: hs, away: as, winner, pts: winner ? WIN_POINTS : 0, earned, players: youth ? {} : Object.fromEntries(Object.entries(players).map(([u, p]) => [u, { scored: p.scored, earned: p.earned }])), ...(youth ? { youth: true } : {}) };
    tx.update(ref, { status: 'final', awarded: true, final, finalAt: FieldValue.serverTimestamp() });
    return { winner, earned, players: youth ? {} : players, youth, league: L?.name || '' };
  });
}

async function onGameUpdated(before, after, ref) {
  const g = after, link = `game/${ref.id}`, title = `${g.format} at ${g.venue}`;
  const labels = { home: await sideLabel(g, 'home'), away: await sideLabel(g, 'away') }, sideName = (_, side) => labels[side];
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
      if (res.youth) await notify(g.players, { type: 'final', title: `Final: ${score}`, body: `${res.winner ? sideName(g, res.winner) + ' won.' : 'A draw.'} ${res.league} standings and kid stats are updated.`, link });
      for (const [u, p] of Object.entries(res.players)) {
        const head = res.winner ? `${sideName(g, res.winner)} won ${score}.` : `A ${score} draw.`;
        await notify([u], { type: 'final', title: `Final: ${score}`, body: `${head} You earned ${p.earned} player points (${res.winner === p.side ? `${WIN_POINTS} for the win + ` : ''}${p.scored} you scored).`, link });
      }
    }
  }
}

// Seasons and tournaments
async function onLeagueEntry(lid, teamId, e) {
  const l = await db().doc(`leagues/${lid}`).get(); if (!l.exists) return;
  await notify([l.data().organizerUid], { type: 'team', title: `${e.teamName} wants to enter ${l.data().name}`, body: `${e.captainName} asked. Open the ${l.data().type} to approve.`, link: `league/${lid}` });
}
async function onLeagueUpdated(lid, before, after) {
  const added = (after.teamIds || []).filter(t => !(before.teamIds || []).includes(t));
  for (const t of added) {
    const team = await db().doc(`teams/${t}`).get(); if (!team.exists) continue;
    await notify(team.data().members, { type: 'team', title: `${team.data().name} is in ${after.name}`, body: `The organizer approved your team. Check the schedule and standings.`, link: `league/${lid}` });
  }
}
async function onKidAdded(tid, kidId, k) {
  const t = await db().doc(`teams/${tid}`).get(); if (!t.exists) return;
  await notify([t.data().captainUid], { type: 'team', title: `${k.parentName} added ${k.name} to ${t.data().name}`, body: 'Open the team to approve the player.', link: `team/${tid}` });
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

module.exports = { onLeagueEntry, onLeagueUpdated, onKidAdded, WIN_POINTS, earnedFor, splitResult, seasonKey, awardResult, onGameUpdated, onDirectMessage, onTeamMessage, onTeamRequest, onReport, sendReminders, notify };
