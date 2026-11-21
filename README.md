# NextMatch

Pickup basketball and flag football across Texas. Anyone with the link can create
a free account with **email, Google, or Apple**, then post and join games, share
highlights, follow players, message each other, and log workouts.

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
| `firebase.json` | Tells Firebase how to publish the site |
| `tests/` | Automated checks for the security rules |

---

## Step 1: Create a Firebase project

1. Go to **https://console.firebase.google.com** and sign in with a Google account.
2. Click **Create a project**. Name it `nextmatch` (Firebase may add numbers to the
   end; that's fine).
3. Google Analytics: turn it **off** (you can add it later). Click **Create project**.

You're on the free **Spark** plan. It covers a friends beta easily.

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

Firebase Storage needs the **Blaze** (pay-as-you-go) plan, which means adding a card.
Its free allowance is large (5 GB stored), so a friends beta usually costs $0, but
set a budget alert to be safe.

1. Firebase → ⚙️ **Usage and billing** → **Details & settings** → **Modify plan** → Blaze.
   Then **Budgets & alerts** → create a budget of $5 with email alerts.
2. **Build → Storage → Get started** → production mode → same location as your database.
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

Publish:

```bash
firebase deploy --only hosting,firestore
```

When it finishes it prints a **Hosting URL** like `https://nextmatch-1234.web.app`.
**That's your open link.** Anyone can visit it and create an account.

The database indexes take a few minutes to build after the first deploy. Until
they're ready, the game list or inbox may show "still being set up". Wait about five
minutes and refresh.

To publish changes later, run the same `firebase deploy` command again.

---

## Running the beta

- **See who signed up:** Firebase → Authentication → Users.
- **Remove a post or game:** Firebase → Firestore Database → `posts` or `games` →
  pick the document → delete.
- **Ban someone:** Authentication → Users → ⋮ → **Disable account**.
- **Give ranking points:** players can't change their own points. Until automatic
  result confirmation is built, you can set them by hand: Firestore → `users` →
  pick the player → edit `rp`, `wins`, `losses`.
- **Add a city:** edit `CITIES` in `public/config.js` and deploy.
- **Delete someone's account at their request:** Authentication → Users → ⋮ →
  Delete account, then delete their document in Firestore → `users`.

## What works today

- Accounts with email + password (with password reset), Google, and Apple (once set up)
- First-time profile setup with an 18+ confirmation
- Post, join, leave and cancel games, grouped by city, with roster limits
- Feed with highlights and workouts, likes, comments, and full-screen reels
- Follow players, view their profiles and upcoming games
- Direct messages that update live, with unread dots
- Weekly fitness challenges (one claim per challenge per week)
- Tournament interest list
- A courtside scoreboard (the score stays on the phone running it)

## Not built yet

- **Confirmed results and automatic ranking points.** Both sides confirming a final
  score needs a small server function; this is the next feature to add.
- Push or email notifications for new messages and game reminders
- Teams with rosters and team chat
- Deleting your own account from inside the app
- Reporting or blocking other players (you can moderate from the console meanwhile)

---

## Automatic publishing (after the code is on GitHub)

Once this folder is a GitHub repository, every change saved to the `main` branch is
checked (the 47 security-rule tests) and then published to your site automatically.
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

## Checking the security rules (for developers)

The rules are covered by 47 automated checks (for example: nobody can raise their
own ranking points, edit someone else's post, read other people's messages, or
fill a game past its size). With Java installed:

```bash
npm install
```

```bash
npm run test:rules
```
