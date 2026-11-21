# NextMatch

Pickup basketball and flag football across Texas. Anyone with the link can create
a free account with **email, Google, or Apple**, then post and join games, report
and confirm scores to earn player points, build teams with team chat, share
highlights, message each other, get game reminders, and report or block players.

It runs on **Firebase** (Google's free app platform): Firebase handles sign-in,
the database, and the public website link. You don't need to run a server.

You'll do this once. It takes about 20 minutes. Apple sign-in is optional and
takes longer (step 5).

---

## What's in this folder

| File | What it is |
|---|---|
| `public/` | The app itself (the website people visit) |
| `public/config.js` | **The only file you need to edit.** Your Firebase settings and feature switches |
| `firestore.rules` | Security rules: who can read and change what in the database |
| `firestore.indexes.json` | Database indexes the app needs |
| `storage.rules` | Rules for photo/video uploads (only if you turn uploads on) |
| `functions/` | Server code: awards player points, sends reminders and notifications, hides reported posts |
| `firebase.json` | Tells Firebase how to publish the site |
| `tests/` | Automated checks for the security rules and the server code |

---

## Step 1: Create a Firebase project

1. Go to **https://console.firebase.google.com** and sign in with a Google account.
2. Click **Create a project**. Name it `nextmatch` (Firebase may add numbers to the
   end; that's fine).
3. Google Analytics: turn it **off** (you can add it later). Click **Create project**.

You start on the free **Spark** plan. Step 4b moves you to **Blaze**, which the
server code needs (it's still free at beta size).

## Step 2: Connect the app to your project

1. On the project's home page, click the **web icon `</>`** ("Add an app to get started").
2. Nickname: `NextMatch web`. Tick **Also set up Firebase Hosting**. Click **Register app**.
3. Firebase shows a block of code with `const firebaseConfig = { ... }`.
   Copy the values into `public/config.js`, replacing the placeholders:

   ```js
   export const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "nextmatch-1234.firebaseapp.com",
     projectId: "nextmatch-1234",
     storageBucket: "nextmatch-1234.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```

   These values are meant to be public. Your data is protected by `firestore.rules`.
4. Click through the remaining screens (you'll do the deploy commands in step 7).

## Step 3: Turn on sign-in methods

1. Left menu: **Build → Authentication → Get started**.
2. **Sign-in method** tab:
   - **Email/Password** → Enable → Save. (Leave "Email link" off.)
   - **Google** → Enable → pick your support email → Save.
3. **Settings** tab → **Authorized domains**. `localhost`, `YOUR-PROJECT.web.app` and
   `YOUR-PROJECT.firebaseapp.com` should already be listed. If you later use your own
   domain (like `nextmatch.app`), add it here or sign-in will be blocked on it.
4. Optional: **Templates** tab → **Password reset** → change the sender name to
   `NextMatch` so reset emails look right.

## Step 4: Create the database

1. Left menu: **Build → Firestore Database → Create database**.
2. Location: **`nam5 (United States)`** or **`us-central1`**. You can't change this later.
3. Start in **production mode** (the app's own rules replace the defaults when you deploy).

## Step 4b: Turn on the Blaze plan (needed for points, reminders and notifications)

Player points, game reminders, notifications and auto-hiding reported posts run as
**Cloud Functions** (server code in `functions/`). Firebase only runs those on the
**Blaze** pay-as-you-go plan, which needs a card on file. Its free allowance
(2 million function runs a month) is far more than a friends beta uses, so expect
$0, but set an alert anyway:

1. Firebase → ⚙️ **Usage and billing** → **Details & settings** → **Modify plan** → **Blaze**.
2. **Budgets & alerts** → create a budget of **$5** with email alerts.

Without Blaze, the app still works for sign-in, games, teams, chat, posts and
reporting, but confirmed scores won't award points and no reminders or notifications
are sent.

## Step 5 (optional): Sign in with Apple

Apple requires a paid **Apple Developer Program** membership ($99/year). Skip this
for now if you don't have one. Everything else works without it.

1. At **https://developer.apple.com/account** → Certificates, Identifiers & Profiles:
   1. **Identifiers → +** → **App IDs** → App → description `NextMatch`, bundle ID
      `com.YOURNAME.nextmatch`, tick **Sign In with Apple** → Register.
   2. **Identifiers → +** → **Services IDs** → description `NextMatch Web`, identifier
      `com.YOURNAME.nextmatch.web` → Register. Open it, tick **Sign In with Apple** →
      **Configure**:
      - Primary App ID: the App ID from the previous step
      - Domains: `YOUR-PROJECT.firebaseapp.com`
      - Return URLs: `https://YOUR-PROJECT.firebaseapp.com/__/auth/handler`
   3. **Keys → +** → name `NextMatch Sign in`, tick **Sign In with Apple** → Configure →
      pick your App ID → Register → **Download** the `.p8` key file (you can only download
      it once). Note the **Key ID**. Your **Team ID** is in the top-right of the page.
2. In Firebase → Authentication → Sign-in method → **Apple** → Enable:
   - Services ID: `com.YOURNAME.nextmatch.web`
   - Under **OAuth code flow configuration**: Apple Team ID, Key ID, and paste the
     contents of the `.p8` file as the private key → Save.
3. Firebase shows a domain-verification note for Apple. Follow it if it appears.
4. In `public/config.js`, set `apple: true`, then deploy again (step 7).

## Step 6 (optional): Photo and video uploads

Needs the Blaze plan from step 4b.

1. **Build → Storage → Get started** → production mode → same location as your database.
2. Its free allowance is 5 GB stored, which covers a beta easily.
3. In `public/config.js`, set `uploads: true`.
4. Deploy with storage included: `firebase deploy --only hosting,firestore,storage`.

Without uploads, posts use built-in sport artwork instead of photos.

## Step 7: Publish the site

You need **Node.js** on your computer: install the **LTS** version from
**https://nodejs.org**. Then open Terminal (Mac) or Command Prompt (Windows):

```bash
npm install -g firebase-tools
```

```bash
firebase login
```

Go into this folder (replace the path with where you saved it):

```bash
cd ~/Downloads/nextmatch
```

Link the folder to your project (pick your project from the list, and type
`default` when asked for an alias):

```bash
firebase use --add
```

Install the server code's packages (one time, and again if `functions/package.json` changes):

```bash
cd functions && npm install && cd ..
```

Publish everything:

```bash
firebase deploy --only hosting,firestore,functions
```

The first functions deploy can take a few minutes and may ask you to enable some
Google Cloud services. Answer **yes**. If you skipped Blaze (step 4b), leave
`,functions` off the end of that command.

When it finishes it prints a **Hosting URL** like `https://nextmatch-1234.web.app`.
**That's your open link.** Anyone can visit it and create an account.

The database indexes take a few minutes to build after the first deploy. Until
they're ready, the game list or inbox may show "still being set up". Wait about five
minutes and refresh.

To publish changes later, run the same `firebase deploy` command again.

## Step 8 (optional): Push notifications on phones and computers

The bell in the app works without this. This step adds alerts that pop up even when
NextMatch is closed: game reminders an hour before, score confirmations, join
requests and new messages.

1. Firebase → ⚙️ **Project settings** → **Cloud Messaging** tab.
2. Under **Web configuration** → **Web Push certificates** → **Generate key pair**.
3. Copy the long key and paste it into `public/config.js` as `pushKey: "..."`.
4. Deploy again (step 7).

Players then turn alerts on from the bell or the **Me** tab.
**iPhone users** must first add NextMatch to their Home Screen (Safari → Share →
Add to Home Screen) and open it from there. Apple only allows web alerts that way.

---

## How results and player points work

1. After a game's start time, anyone who played reports the final score from the game page
   (or straight from the scoreboard).
2. Someone on the **other** side confirms it or disputes it. Teammates can't confirm
   their own side's report.
3. Whoever reports enters **each player's points**. The team totals add up automatically.
   The live scoreboard does this too: in team games, every +1/+2/+3 asks who scored.
4. Once confirmed, the server gives each player:
   - **100 player points if their side won**, plus
   - **1 bonus player point for every point they scored themselves**, win or lose.

   Example: Eastside beats North Loop 21–18. Jordan scored 14 and gets 114 (100 + 14);
   Tyler scored 7 and gets 107; Marcus scored 10 and gets 10. A tie gives no win bonus.
   Each player's career "Pts scored" goes up by their own points. Teams get 100 for a win plus
   their team total. If a report's player points don't add up to the team score, everyone on
   that side gets the team score instead and career totals aren't changed.
5. A disputed score awards nothing. Players talk it out and report again.

## Safety: reports and blocks

- Players can report a player, post, comment, game or team from its **⋯** menu.
  Reports are private.
- **Review reports** in Firebase → Firestore Database → `reports`. Each one shows who
  reported, the reason, details, and the id of what was reported.
- A post reported by **3 different people** is hidden automatically (field `hidden: true`
  on the post). To restore it, delete the `hidden` field in the console.
- **Blocking** hides that person's posts, games, comments and messages, and stops them
  messaging you or commenting on your posts. The blocked person isn't told.

## Running the beta

- **See who signed up:** Firebase → Authentication → Users.
- **Remove a post or game:** Firebase → Firestore Database → `posts` or `games` →
  pick the document → delete.
- **Ban someone:** Authentication → Users → ⋮ → **Disable account**.
- **Fix player points:** players can't change their own points. To correct a mistake,
  edit `rp`, `wins`, `losses` in Firestore → `users` (or `teams`).
- **Cities:** players pick from 34,408 U.S. cities and towns (all 50 states and DC), with search
  and a "Near me" button. Cities are stored with their state, like "Austin, TX". The list is in
  `public/us-cities.js` (from ZIP code data and GeoNames, geonames.org, CC BY 4.0) and only
  downloads when someone opens the city finder. To offer only some cities, set `CITIES` in
  `public/config.js`, e.g. `["Austin, TX", "Dallas, TX"]`.
- **Workouts are switched off** for now (`workouts: false` in `public/config.js`). Set it to
  `true` to bring back weekly fitness challenges and workout posts.
- **Delete someone's account at their request:** Authentication → Users → ⋮ →
  Delete account, then delete their document in Firestore → `users`.

## What works today

- Accounts with email + password (with password reset), Google, and Apple (once set up)
- First-time profile setup with an 18+ confirmation
- Pickup and team games with home and away sides, roster limits, and team-only sides
- Report → confirm → automatic player points, wins and losses (players and teams)
- Teams: create, ask to join, captain approves or removes, team chat, team record
- Notification bell, push alerts, and game reminders an hour before
- Report and block, with auto-hiding of posts that get 3 reports
- Feed with highlights and workouts, likes, comments, and full-screen reels
- Follow players, view their profiles, head-to-head record and upcoming games
- Direct messages that update live, with unread dots
- Weekly fitness challenges (one claim per challenge per week)
- Tournament interest list
- A courtside scoreboard that can submit its final score

## Not built yet

- Email notifications (alerts are in-app and push only)
- Transferring team captain to someone else
- A moderation screen inside the app (you review reports in the Firebase console)
- Deleting your own account from inside the app

---

## Automatic publishing (after the code is on GitHub)

Once this folder is a GitHub repository, every change saved to the `main` branch is
checked (all the automated tests) and then the website and database rules are published
automatically. Server code in `functions/` changes rarely; when it does, publish it with
`firebase deploy --only functions`.
You won't need to run `firebase deploy` again. One-time setup:

1. **Create a publishing key.** Go to **https://console.cloud.google.com/iam-admin/serviceaccounts**
   and pick your Firebase project at the top. Click **Create service account** → name it
   `github-publisher` → **Create and continue**. Add two roles: **Firebase Admin** and
   **Service Account User** → **Done**.
2. Click the new account → **Keys** tab → **Add key → Create new key → JSON**. A file downloads.
   Treat it like a password: never post it or commit it.
3. In your GitHub repository: **Settings → Secrets and variables → Actions**.
   - **Secrets** tab → **New repository secret** → name `FIREBASE_SERVICE_ACCOUNT` → paste
     the entire contents of the JSON file → Add.
   - **Variables** tab → **New repository variable** → name `FIREBASE_PROJECT_ID` → your
     project ID (for example `nextmatch-1234`) → Add.
4. Delete the downloaded JSON file from your computer.

Check progress under the repository's **Actions** tab. A green check means the change is live.
If a security test fails, nothing is published.

## Automated checks (for developers)

- **115 security-rule checks**: for example, nobody can give themselves points, confirm
  their own side's score, join a team without the captain's approval, read another
  team's chat or other people's messages, or message someone who blocked them.
- **25 server-code checks**: points awarded once and only to winners, ties and disputes,
  team records, notifications, reminders, and auto-hiding reported posts.

With Java installed:

```bash
npm install && (cd functions && npm install)
```

```bash
npm test
```
