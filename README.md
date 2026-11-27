# MAN STUDIO AWARDS

Festivals, game awards and community voting for MAN STUDIO.

- **Hosting:** GitHub Pages. Every push to `main` deploys the `public/` folder through [.github/workflows/pages.yml](.github/workflows/pages.yml).
- **Accounts:** Firebase Authentication (username + password).
- **Datastore:** Cloud Firestore (festivals, awards shows, votes, uploaded images).
- **Security:** [firestore.rules](firestore.rules). Only the admin account (`man studio`) can change content. Members can only cast or change their own votes, and only while voting is open.

## One-time Firebase setup
1. Go to https://console.firebase.google.com, create a project, then **Add app → Web**.
2. **Authentication → Sign-in method** → enable **Email/Password**.
3. **Authentication → Settings → Authorized domains** → add `manorkeshet417-code.github.io`.
4. **Firestore Database → Create database** (production mode).
5. Copy the web app's `firebaseConfig` into [public/firebase-config.js](public/firebase-config.js).
6. Open the site and **sign up as `man studio`**. Your profile page shows your user ID.
7. Put that ID in `adminUid` in `public/firebase-config.js` **and** replace `ADMIN_UID` in `firestore.rules`.
8. **Firestore → Rules** → paste `firestore.rules` → **Publish**.
9. Commit and push. The site redeploys within about a minute.

The values in `firebase-config.js` are public by design. Firebase uses them only to find the project, and the rules decide who can do what.

## Run locally
```
python -m http.server 4747 --directory public
```
Then open http://localhost:4747 (`localhost` is authorized in Firebase by default).

## Notes
- Uploaded images are resized in the browser and stored in Firestore, so Firebase Storage (a paid feature) isn't needed.
- Vote totals are private while voting is open. When the admin saves a show as **Winners announced**, the totals are published.
- Removing a member deletes their profile, votes and festival sign-ups and blocks the account.
