// Connects the logic in lib.js to database events and a 15-minute timer.
// Deploy with: firebase deploy --only functions
const { onDocumentUpdated, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
initializeApp();
const lib = require('./lib');

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

exports.gameUpdated = onDocumentUpdated('games/{gid}', ev =>
  lib.onGameUpdated(ev.data.before.data(), ev.data.after.data(), ev.data.after.ref));

exports.directMessage = onDocumentCreated('conversations/{cid}/messages/{mid}', ev =>
  lib.onDirectMessage(ev.params.cid, ev.data.data()));

exports.teamMessage = onDocumentCreated('teams/{tid}/messages/{mid}', ev =>
  lib.onTeamMessage(ev.params.tid, ev.data.data()));

exports.teamRequest = onDocumentCreated('teams/{tid}/requests/{uid}', ev =>
  lib.onTeamRequest(ev.params.tid, ev.params.uid, ev.data.data()));

exports.reportFiled = onDocumentCreated('reports/{rid}', ev => lib.onReport(ev.data.data()));

exports.gameReminders = onSchedule({ schedule: 'every 15 minutes', timeZone: 'America/Chicago' }, () => lib.sendReminders());
