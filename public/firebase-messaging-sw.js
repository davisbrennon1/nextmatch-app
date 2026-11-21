// Shows push notifications when NextMatch isn't open. The app passes its
// Firebase settings in the address when it registers this file.
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
const config = JSON.parse(new URL(self.location).searchParams.get('config') || '{}');
if (config.apiKey) {
  firebase.initializeApp(config);
  firebase.messaging();
}
