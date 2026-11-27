// ─────────────────────────────────────────────────────────────────────────────
// Firebase settings for MAN STUDIO AWARDS.
// These values are PUBLIC by design (they identify the project, they are not passwords).
// Security comes from firestore.rules, which only lets the admin UID below change content.
// ─────────────────────────────────────────────────────────────────────────────

// 1) Firebase console → Project settings → Your apps → Web app → "firebaseConfig"
export const firebaseConfig = {
  apiKey: 'AIzaSyBmQKPdy9YKkeaKNRyt2R5oyANT2Gcafco',
  authDomain: 'nexusplay-30872.firebaseapp.com',
  projectId: 'nexusplay-30872',
  storageBucket: 'nexusplay-30872.firebasestorage.app',
  messagingSenderId: '974702271971',
  appId: '1:974702271971:web:9c9f5d2baa0b8eba1854d6',
};

// 2) After signing up on the site as "man studio", paste that account's user ID here
//    (and the same ID in firestore.rules). Until then nobody is admin.
export const adminUid = '';
