// ─────────────────────────────────────────────────────────────
// NextMatch settings. Fill this in once (see README.md, step 2).
// These values are safe to put in a public website: Firebase
// protects your data with the rules in firestore.rules, not by
// keeping this config secret.
// ─────────────────────────────────────────────────────────────
export const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000"
};

export const FEATURES = {
  // Show "Continue with Google". Turn it on in Firebase → Authentication → Sign-in method.
  google: true,
  // Show "Continue with Apple". Needs an Apple Developer account first (README step 5).
  apple: false,
  // Let people attach photos and videos to posts. Needs Firebase Storage (README step 6).
  uploads: false
};

// Cities people can pick. Games and players are grouped by city.
export const CITIES = ["Austin", "Dallas", "Houston", "San Antonio"];

// Set to true only while testing on your own computer with the Firebase emulators.
export const USE_EMULATORS = false;
