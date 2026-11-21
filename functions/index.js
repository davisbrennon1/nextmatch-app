// Connects the logic in lib.js to database events and a 15-minute timer.
// Deploy with: firebase deploy --only functions
const { onDocumentUpdated, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
initializeApp();
const lib = require('./lib');
const venues = require('./venues');

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

exports.gameUpdated = onDocumentUpdated('games/{gid}', ev =>
  lib.onGameUpdated(ev.data.before.data(), ev.data.after.data(), ev.data.after.ref));

exports.directMessage = onDocumentCreated('conversations/{cid}/messages/{mid}', ev =>
  lib.onDirectMessage(ev.params.cid, ev.data.data()));

exports.teamMessage = onDocumentCreated('teams/{tid}/messages/{mid}', ev =>
  lib.onTeamMessage(ev.params.tid, ev.data.data()));

exports.teamRequest = onDocumentCreated('teams/{tid}/requests/{uid}', ev =>
  lib.onTeamRequest(ev.params.tid, ev.params.uid, ev.data.data()));

exports.leagueEntry = onDocumentCreated('leagues/{lid}/entries/{teamId}', ev => lib.onLeagueEntry(ev.params.lid, ev.params.teamId, ev.data.data()));
exports.leagueUpdated = onDocumentUpdated('leagues/{lid}', ev => lib.onLeagueUpdated(ev.params.lid, ev.data.before.data(), ev.data.after.data()));
exports.kidAdded = onDocumentCreated('teams/{tid}/kids/{kidId}', ev => lib.onKidAdded(ev.params.tid, ev.params.kidId, ev.data.data()));

exports.reportFiled = onDocumentCreated('reports/{rid}', ev => lib.onReport(ev.data.data()));

exports.gameReminders = onSchedule({ schedule: 'every 15 minutes', timeZone: 'America/Chicago' }, () => lib.sendReminders());

// Courts, fields and parks near a city, for the "Where" box when posting a game.
exports.venues = onCall({ timeoutSeconds: 60, memory: '512MiB' }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const city = String(req.data?.city || '').slice(0, 60);
  try { return await venues.getVenues(city) }
  catch (e) {
    if (e.code === 'invalid-argument') throw new HttpsError('invalid-argument', 'Unknown city.');
    console.error('venues', city, e);
    throw new HttpsError('unavailable', 'Couldn’t load places right now.');
  }
});
