# MAN STUDIO AWARDS

Festivals, game awards and community voting for MAN STUDIO. No installs needed, just Node.js.

## Run
Double-click `START.bat`, or run:

```
node server.js
```

Then open http://localhost:4747

## Admin account
- Username: `man studio`
- The password is generated on first run and saved to `ADMIN-PASSWORD.txt`.
- Change it in Admin panel → Settings, then delete that file.

## Datastore
Data is stored in a SQLite database at `data/awards.db`, using Node's built-in `node:sqlite` (Node 22.5+, no npm installs).

Tables: `users`, `sessions`, `festivals`, `attendees`, `awards`, `votes`. See [store.js](store.js) for the schema.

- `data/awards.db`: users, festivals, awards shows and votes
- `data/uploads/`: images uploaded from the admin panel

The `data/` folder and `ADMIN-PASSWORD.txt` are git-ignored, so accounts, votes and passwords never end up on GitHub.
Back up `data/` to keep your data.

To start completely fresh, stop the server and delete the `data/` folder (a new admin password will be generated).
