# NextMatch

Pickup basketball and flag football app for Texas. Plain HTML/CSS/JS (no build step) on Firebase:
`public/` is the site, `firestore.rules` the security rules, `functions/` the server code (player points,
notifications, reminders, auto-hiding reported posts). Setup steps for the owner are in README.md.

## The owner reviews changes through the preview link

The owner is not a developer. They review every change at the **preview link**:
https://claude.ai/artifact/NkD6tfxsr5zSZthu2FVbhQ

It runs the real `public/app.js` on an in-browser stand-in for Firebase with sample players
(`preview/mock/core.js`), so no Firebase project is needed. After any change to `public/`:

1. `node preview/build.mjs` (writes `preview/dist/`, which is git-ignored)
2. Publish with the Artifact tool, passing `url` = the preview link above, `file_path` =
   `preview/dist/index.html`, and `files` mapping each of `app.js`, `config.js`, `styles.css`,
   `auth.css`, `mock/core.js`, `mock/firebase-app.js`, `mock/firebase-auth.js`,
   `mock/firebase-firestore.js` to the same path under `preview/dist/`. Read the artifact first
   if this session hasn't read or published it.
3. Give the owner the link and say in plain words what changed.

If the app starts using a new Firebase function, add it to the matching file in `preview/mock/`
(and to `core.js`). If a server rule changes in `functions/lib.js`, mirror it in `core.js`
("Server behaviour" section) so the preview behaves the same. Add sample data in `seed()`.

## Checks before saving to GitHub

- `node --check public/app.js`
- `npm test` runs 113 security-rule checks and 21 server-code checks (needs Java and
  `npm install` in the root and in `functions/`). GitHub Actions runs the same on every push.
- Pushing to `main` publishes the live site once the owner has finished the README's
  "Automatic publishing" setup. Server code is published by hand: `firebase deploy --only functions`.

Write to the owner in plain language: no jargon, short steps, and say what they will see.
