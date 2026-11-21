// Builds the preview page in preview/dist from the real app in public/.
// Run: node preview/build.mjs   (then publish preview/dist, see CLAUDE.md)
import fs from 'fs';
const root = new URL('..', import.meta.url).pathname, out = root + 'preview/dist/';
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out + 'mock', { recursive: true });
for (const f of ['app.js', 'us-cities.js', 'styles.css', 'auth.css']) fs.copyFileSync(root + 'public/' + f, out + f);
for (const f of fs.readdirSync(root + 'preview/mock')) fs.copyFileSync(root + 'preview/mock/' + f, out + 'mock/' + f);
fs.writeFileSync(out + 'config.js', `// Preview settings: runs on sample data, no Firebase needed.
export const firebaseConfig = { apiKey: 'preview', authDomain: 'preview', projectId: 'preview', appId: 'preview' };
export const FEATURES = ${(fs.readFileSync(root + 'public/config.js', 'utf8').match(/export const FEATURES = (\{[\s\S]*?\n\});/) || [, '{}'])[1].replace(/pushKey: "[^"]*"/, 'pushKey: ""').replace(/uploads: true/, 'uploads: false')};
export const CITIES = [];
export const USE_EMULATORS = false;
`);
const html = fs.readFileSync(root + 'public/index.html', 'utf8');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script type="module" src="app.js"><\/script>/, '').trim();
const fonts = html.match(/<link rel="stylesheet" href="https:\/\/fonts[^>]*>/)[0];
const V = '10.12.2', map = { imports: Object.fromEntries(['app', 'auth', 'firestore', 'functions'].map(m => [`https://www.gstatic.com/firebasejs/${V}/firebase-${m}.js`, `./mock/firebase-${m}.js`])) };
fs.writeFileSync(out + 'index.html', `<title>NextMatch Preview</title>
<meta name="description" content="Live preview of the NextMatch app with sample players.">
<meta name="theme-color" content="#0c1217">
<link rel="preconnect" href="https://fonts.googleapis.com">
${fonts}
<link rel="stylesheet" href="styles.css">
<link rel="stylesheet" href="auth.css">
${body}
<script type="importmap">${JSON.stringify(map)}</script>
<script type="module" src="mock/core.js"></script>
<script type="module" src="app.js"></script>
`);
console.log('Built', fs.readdirSync(out).concat(fs.readdirSync(out + 'mock').map(f => 'mock/' + f)).join(', '));
