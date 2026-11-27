// SQLite datastore for MAN STUDIO AWARDS (uses Node's built-in node:sqlite — no installs).
// The server keeps an in-memory copy for fast reads and writes every change through to SQLite.
'use strict';

const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  username     TEXT NOT NULL,
  username_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'user',
  salt         TEXT NOT NULL,
  hash         TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token   TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS festivals (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  tagline     TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  location    TEXT NOT NULL DEFAULT '',
  start_date  TEXT NOT NULL DEFAULT '',
  end_date    TEXT NOT NULL DEFAULT '',
  cover       TEXT NOT NULL DEFAULT '',
  accent      TEXT NOT NULL DEFAULT '#22e4ff',
  status      TEXT NOT NULL DEFAULT 'upcoming',
  highlights  TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attendees (
  festival_id TEXT NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (festival_id, user_id)
);

CREATE TABLE IF NOT EXISTS awards (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  year          INTEGER NOT NULL,
  tagline       TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  ceremony_date TEXT NOT NULL DEFAULT '',
  festival_id   TEXT NOT NULL DEFAULT '',
  cover         TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'draft',
  categories    TEXT NOT NULL DEFAULT '[]',   -- JSON: [{id,name,description,winnerId,nominees:[...]}]
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS votes (
  award_id    TEXT NOT NULL REFERENCES awards(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nominee_id  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (award_id, category_id, user_id)
);
`;

function openStore(file) {
  const sql = new DatabaseSync(file);
  sql.exec(SCHEMA);
  const now = () => new Date().toISOString();

  const q = {
    putUser: sql.prepare(`INSERT INTO users (id, username, username_key, display_name, role, salt, hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET username=excluded.username, username_key=excluded.username_key,
        display_name=excluded.display_name, role=excluded.role, salt=excluded.salt, hash=excluded.hash`),
    delUser: sql.prepare('DELETE FROM users WHERE id = ?'),
    putSession: sql.prepare('INSERT OR REPLACE INTO sessions (token, user_id, expires) VALUES (?, ?, ?)'),
    delSession: sql.prepare('DELETE FROM sessions WHERE token = ?'),
    delExpired: sql.prepare('DELETE FROM sessions WHERE expires < ?'),
    putFestival: sql.prepare(`INSERT INTO festivals (id, title, tagline, description, location, start_date, end_date, cover, accent, status, highlights, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title, tagline=excluded.tagline, description=excluded.description,
        location=excluded.location, start_date=excluded.start_date, end_date=excluded.end_date, cover=excluded.cover,
        accent=excluded.accent, status=excluded.status, highlights=excluded.highlights`),
    delFestival: sql.prepare('DELETE FROM festivals WHERE id = ?'),
    addAttend: sql.prepare('INSERT OR IGNORE INTO attendees (festival_id, user_id, created_at) VALUES (?, ?, ?)'),
    delAttend: sql.prepare('DELETE FROM attendees WHERE festival_id = ? AND user_id = ?'),
    putAward: sql.prepare(`INSERT INTO awards (id, title, year, tagline, description, ceremony_date, festival_id, cover, status, categories, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title, year=excluded.year, tagline=excluded.tagline,
        description=excluded.description, ceremony_date=excluded.ceremony_date, festival_id=excluded.festival_id,
        cover=excluded.cover, status=excluded.status, categories=excluded.categories`),
    delAward: sql.prepare('DELETE FROM awards WHERE id = ?'),
    putVote: sql.prepare('INSERT OR REPLACE INTO votes (award_id, category_id, user_id, nominee_id, created_at) VALUES (?, ?, ?, ?, ?)'),
    delVote: sql.prepare('DELETE FROM votes WHERE award_id = ? AND category_id = ? AND user_id = ?'),
    delAwardVotes: sql.prepare('DELETE FROM votes WHERE award_id = ?'),
  };

  function tx(fn) {
    sql.exec('BEGIN');
    try {
      const r = fn();
      sql.exec('COMMIT');
      return r;
    } catch (e) {
      sql.exec('ROLLBACK');
      throw e;
    }
  }

  const store = {
    isEmpty() {
      return sql.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0;
    },

    // Load everything into the in-memory shape the server uses.
    load() {
      const db = { users: [], sessions: {}, festivals: [], awards: [] };
      for (const r of sql.prepare('SELECT * FROM users ORDER BY created_at').all())
        db.users.push({ id: r.id, username: r.username, usernameKey: r.username_key, displayName: r.display_name, role: r.role, salt: r.salt, hash: r.hash, createdAt: r.created_at });
      for (const r of sql.prepare('SELECT * FROM sessions').all()) db.sessions[r.token] = { userId: r.user_id, expires: Number(r.expires) };
      const att = {};
      for (const r of sql.prepare('SELECT * FROM attendees ORDER BY created_at').all()) (att[r.festival_id] ||= []).push(r.user_id);
      for (const r of sql.prepare('SELECT * FROM festivals ORDER BY created_at').all())
        db.festivals.push({
          id: r.id, title: r.title, tagline: r.tagline, description: r.description, location: r.location,
          startDate: r.start_date, endDate: r.end_date, cover: r.cover, accent: r.accent, status: r.status,
          highlights: JSON.parse(r.highlights || '[]'), attendees: att[r.id] || [], createdAt: r.created_at,
        });
      const votes = {};
      for (const r of sql.prepare('SELECT * FROM votes').all()) ((votes[r.award_id] ||= {})[r.category_id] ||= {})[r.user_id] = r.nominee_id;
      for (const r of sql.prepare('SELECT * FROM awards ORDER BY created_at').all())
        db.awards.push({
          id: r.id, title: r.title, year: Number(r.year), tagline: r.tagline, description: r.description,
          ceremonyDate: r.ceremony_date, festivalId: r.festival_id, cover: r.cover, status: r.status,
          categories: JSON.parse(r.categories || '[]'), votes: votes[r.id] || {}, createdAt: r.created_at,
        });
      return db;
    },

    putUser(u) {
      q.putUser.run(u.id, u.username, u.usernameKey, u.displayName, u.role, u.salt, u.hash, u.createdAt);
    },
    deleteUser(id) {
      q.delUser.run(id); // sessions, votes and attendees cascade
    },
    putSession(token, s) {
      q.putSession.run(token, s.userId, s.expires);
    },
    deleteSession(token) {
      q.delSession.run(token);
    },
    deleteExpiredSessions(t = Date.now()) {
      q.delExpired.run(t);
    },
    putFestival(f) {
      q.putFestival.run(f.id, f.title, f.tagline || '', f.description || '', f.location || '', f.startDate || '', f.endDate || '',
        f.cover || '', f.accent || '#22e4ff', f.status || 'upcoming', JSON.stringify(f.highlights || []), f.createdAt);
    },
    deleteFestival(id) {
      q.delFestival.run(id);
    },
    setAttending(festivalId, userId, on) {
      if (on) q.addAttend.run(festivalId, userId, now());
      else q.delAttend.run(festivalId, userId);
    },
    putAward(a) {
      q.putAward.run(a.id, a.title, a.year, a.tagline || '', a.description || '', a.ceremonyDate || '', a.festivalId || '',
        a.cover || '', a.status, JSON.stringify(a.categories || []), a.createdAt);
    },
    deleteAward(id) {
      q.delAward.run(id); // votes cascade
    },
    setVote(awardId, categoryId, userId, nomineeId) {
      if (nomineeId) q.putVote.run(awardId, categoryId, userId, nomineeId, now());
      else q.delVote.run(awardId, categoryId, userId);
    },
    // Saves an award document and replaces its votes with the given map in one transaction.
    saveAwardWithVotes(a) {
      tx(() => {
        store.putAward(a);
        q.delAwardVotes.run(a.id);
        for (const [catId, m] of Object.entries(a.votes || {}))
          for (const [userId, nomId] of Object.entries(m)) q.putVote.run(a.id, catId, userId, nomId, now());
      });
    },
    // One-time import of the old JSON file format.
    importJson(data) {
      tx(() => {
        for (const u of data.users || []) store.putUser(u);
        for (const [t, s] of Object.entries(data.sessions || {})) if (data.users.some((u) => u.id === s.userId)) store.putSession(t, s);
        for (const f of data.festivals || []) {
          store.putFestival(f);
          for (const uid of f.attendees || []) if (data.users.some((u) => u.id === uid)) q.addAttend.run(f.id, uid, now());
        }
        for (const a of data.awards || []) {
          store.putAward(a);
          for (const [catId, m] of Object.entries(a.votes || {}))
            for (const [userId, nomId] of Object.entries(m)) if (data.users.some((u) => u.id === userId)) q.putVote.run(a.id, catId, userId, nomId, now());
        }
      });
    },
    tx,
    close() {
      sql.close();
    },
  };
  return store;
}

module.exports = { openStore };
