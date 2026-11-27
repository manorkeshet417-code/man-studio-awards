// ─────────────────────────────────────────────────────────────────────────────
// Firebase settings for MAN STUDIO AWARDS.
// These values are PUBLIC by design (they identify the project, they are not passwords).
// Security comes from firestore.rules, which only lets the admin UID below change content.
// ─────────────────────────────────────────────────────────────────────────────

// 1) Firebase console → Project settings → Your apps → Web app → "firebaseConfig"
export const firebaseConfig = {
  apiKey: 'PASTE_API_KEY',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

// 2) After signing up on the site as "man studio", paste that account's user ID here
//    (and the same ID in firestore.rules). Until then nobody is admin.
export const adminUid = '';
