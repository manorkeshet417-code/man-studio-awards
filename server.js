// MAN STUDIO AWARDS — zero-dependency Node.js server (SQLite datastore via node:sqlite)
// Run:  node server.js   →  http://localhost:4747
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { openStore } = require('./store');

const PORT = Number(process.env.PORT) || 4747;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const SQLITE_FILE = path.join(DATA_DIR, 'awards.db');
const LEGACY_JSON = path.join(DATA_DIR, 'db.json');
const ADMIN_USERNAME = 'man studio';
const SESSION_DAYS = 30;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ───────────────────────── helpers ─────────────────────────
const uid = (n = 10) => crypto.randomBytes(n).toString('base64url');
const now = () => new Date().toISOString();
const keyOf = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}
function checkPassword(password, user) {
  const { hash } = hashPassword(password, user.salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(user.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ───────────────────────── database ─────────────────────────
// SQLite datastore (data/awards.db). `db` is an in-memory mirror for fast reads;
// every change is written through to SQLite with the store.* calls below.
const store = openStore(SQLITE_FILE);
let db;

function loadDb() {
  // One-time migration from the old JSON file
  if (store.isEmpty() && fs.existsSync(LEGACY_JSON)) {
    store.importJson(JSON.parse(fs.readFileSync(LEGACY_JSON, 'utf8')));
    fs.renameSync(LEGACY_JSON, LEGACY_JSON + '.migrated');
    console.log('  ✓ Imported data/db.json into SQLite');
  }
  store.deleteExpiredSessions();
  db = store.load();

  // Ensure the admin account "man studio" exists
  if (!db.users.find((u) => u.usernameKey === keyOf(ADMIN_USERNAME))) {
    const password = process.env.ADMIN_PASSWORD || uid(9);
    const admin = {
      id: uid(8),
      username: ADMIN_USERNAME,
      usernameKey: keyOf(ADMIN_USERNAME),
      displayName: 'MAN STUDIO',
      role: 'admin',
      ...hashPassword(password),
      createdAt: now(),
    };
    db.users.push(admin);
    store.putUser(admin);
    const file = path.join(ROOT, 'ADMIN-PASSWORD.txt');
    fs.writeFileSync(
      file,
      `MAN STUDIO AWARDS — admin login\r\n\r\nUsername: ${ADMIN_USERNAME}\r\nPassword: ${password}\r\n\r\n` +
        `You can change the password from the admin panel (Settings tab).\r\n` +
        `Delete this file once you've saved the password somewhere safe.\r\n`
    );
    console.log(`\n  ★ Admin account created → see ${file}\n`);
  }
}
loadDb();
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { store.close(); process.exit(0); });

// ───────────────────────── http plumbing ─────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new HttpError(status, message);
};

function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'object' && !Buffer.isBuffer(body) ? MIME['.json'] : headers['Content-Type'] || 'text/plain',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(data);
}

function readBody(req, limit = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, 'Request is too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'Invalid request'));
      }
    });
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function currentUser(req) {
  const token = parseCookies(req).msa_session;
  if (!token) return null;
  const s = db.sessions[token];
  if (!s || s.expires < Date.now()) return null;
  return db.users.find((u) => u.id === s.userId) || null;
}

function sessionCookie(token, maxAge) {
  return `msa_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

const publicUser = (u) =>
  u && { id: u.id, username: u.username, displayName: u.displayName, role: u.role, createdAt: u.createdAt };

// basic login rate-limit
const attempts = new Map();
function rateLimit(ip) {
  const t = Date.now();
  const rec = attempts.get(ip) || { n: 0, t };
  if (t - rec.t > 10 * 60 * 1000) {
    rec.n = 0;
    rec.t = t;
  }
  rec.n++;
  attempts.set(ip, rec);
  if (rec.n > 25) fail(429, 'Too many attempts. Please try again in a few minutes');
}

// ───────────────────────── validation ─────────────────────────
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const IMG_RE = /^(\/(assets|uploads)\/[\w.\-]+|https?:\/\/[^\s"'<>]+)$/i;
const img = (v) => {
  const s = str(v, 600);
  return s && IMG_RE.test(s) ? s : '';
};

function cleanFestival(b, prev = {}) {
  const title = str(b.title, 120);
  if (!title) fail(400, 'The festival needs a name');
  const status = ['upcoming', 'live', 'ended'].includes(b.status) ? b.status : 'upcoming';
  return {
    ...prev,
    title,
    tagline: str(b.tagline, 200),
    description: str(b.description, 4000),
    location: str(b.location, 120),
    startDate: str(b.startDate, 20),
    endDate: str(b.endDate, 20),
    cover: img(b.cover),
    accent: COLOR_RE.test(b.accent || '') ? b.accent : '#22e4ff',
    status,
    highlights: (Array.isArray(b.highlights) ? b.highlights : [])
      .map((h) => str(h, 60))
      .filter(Boolean)
      .slice(0, 12),
  };
}

function cleanAward(b, prev = {}) {
  const title = str(b.title, 120);
  if (!title) fail(400, 'The show needs a name');
  const status = ['draft', 'voting', 'closed', 'announced'].includes(b.status) ? b.status : 'draft';
  const prevCats = prev.categories || [];
  const categories = (Array.isArray(b.categories) ? b.categories : []).slice(0, 60).map((c) => {
    const old = prevCats.find((p) => p.id === c.id);
    const nominees = (Array.isArray(c.nominees) ? c.nominees : []).slice(0, 30).map((nm) => ({
      id: typeof nm.id === 'string' && nm.id.length < 20 && nm.id ? nm.id : uid(5),
      name: str(nm.name, 80) || 'Untitled nominee',
      studio: str(nm.studio, 80),
      image: img(nm.image),
      blurb: str(nm.blurb, 200),
    }));
    const winnerId = nominees.some((n) => n.id === c.winnerId) ? c.winnerId : null;
    return {
      id: old ? old.id : typeof c.id === 'string' && c.id && c.id.length < 20 ? c.id : uid(5),
      name: str(c.name, 80) || 'Untitled category',
      description: str(c.description, 300),
      nominees,
      winnerId,
    };
  });
  const festivalId = db.festivals.some((f) => f.id === b.festivalId) ? b.festivalId : '';
  // keep only votes that still point at existing categories / nominees
  const votes = {};
  for (const c of categories) {
    const old = (prev.votes || {})[c.id] || {};
    const ids = new Set(c.nominees.map((n) => n.id));
    const kept = {};
    for (const [u, n] of Object.entries(old)) if (ids.has(n)) kept[u] = n;
    votes[c.id] = kept;
  }
  return {
    ...prev,
    title,
    year: Number(b.year) || new Date().getFullYear(),
    tagline: str(b.tagline, 200),
    description: str(b.description, 4000),
    ceremonyDate: str(b.ceremonyDate, 25),
    festivalId,
    cover: img(b.cover),
    status,
    categories,
    votes,
  };
}

// ───────────────────────── views ─────────────────────────
function tally(award, cat) {
  const counts = {};
  cat.nominees.forEach((n) => (counts[n.id] = 0));
  for (const nid of Object.values((award.votes || {})[cat.id] || {})) if (nid in counts) counts[nid]++;
  return counts;
}

function awardView(a, user, full = false) {
  const isAdmin = user?.role === 'admin';
  const showCounts = isAdmin || a.status === 'announced';
  const showWinners = isAdmin || a.status === 'announced';
  const voters = new Set();
  Object.values(a.votes || {}).forEach((m) => Object.keys(m).forEach((u) => voters.add(u)));
  const fest = db.festivals.find((f) => f.id === a.festivalId);
  const base = {
    id: a.id,
    title: a.title,
    year: a.year,
    tagline: a.tagline,
    description: a.description,
    ceremonyDate: a.ceremonyDate,
    festivalId: a.festivalId,
    festivalTitle: fest ? fest.title : '',
    cover: a.cover,
    status: a.status,
    categoryCount: a.categories.length,
    nomineeCount: a.categories.reduce((s, c) => s + c.nominees.length, 0),
    voterCount: voters.size,
    createdAt: a.createdAt,
  };
  if (!full) {
    base.previewNominees = a.categories
      .flatMap((c) => c.nominees)
      .filter((n) => n.image)
      .slice(0, 4)
      .map((n) => n.image);
    return base;
  }
  base.categories = a.categories.map((c) => {
    const counts = showCounts ? tally(a, c) : null;
    const total = counts ? Object.values(counts).reduce((s, x) => s + x, 0) : null;
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      winnerId: showWinners ? c.winnerId : null,
      myVote: user ? ((a.votes || {})[c.id] || {})[user.id] || null : null,
      totalVotes: total,
      nominees: c.nominees.map((n) => ({ ...n, votes: counts ? counts[n.id] : null })),
    };
  });
  return base;
}

function festivalView(f, user) {
  return {
    ...f,
    attendees: undefined,
    attendeeCount: (f.attendees || []).length,
    attending: !!user && (f.attendees || []).includes(user.id),
    awards: db.awards
      .filter((a) => a.festivalId === f.id && (a.status !== 'draft' || user?.role === 'admin'))
      .map((a) => ({ id: a.id, title: a.title, status: a.status })),
  };
}

const sortFest = (a, b) => String(a.startDate).localeCompare(String(b.startDate));

// ───────────────────────── routes ─────────────────────────
const routes = [];
const route = (method, pattern, handler, opts = {}) => {
  const keys = [];
  const re = new RegExp(
    '^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$'
  );
  routes.push({ method, re, keys, handler, ...opts });
};

// auth
route('GET', '/api/me', ({ user }) => ({ user: publicUser(user) }));

route('POST', '/api/register', async ({ req, body, ip }) => {
  rateLimit(ip);
  const username = str(body.username, 24).replace(/\s+/g, ' ');
  const password = String(body.password || '');
  const displayName = str(body.displayName, 40) || username;
  if (!/^[\p{L}\p{N} _.\-]{3,24}$/u.test(username)) fail(400, 'Username: 3–24 characters (letters, numbers, spaces, _ . -)');
  if (password.length < 6) fail(400, 'Password must be at least 6 characters');
  if (db.users.some((u) => u.usernameKey === keyOf(username))) fail(409, 'That username is taken');
  const user = {
    id: uid(8),
    username,
    usernameKey: keyOf(username),
    displayName,
    role: 'user',
    ...hashPassword(password),
    createdAt: now(),
  };
  const token = uid(24);
  const session = { userId: user.id, expires: Date.now() + SESSION_DAYS * 864e5 };
  store.tx(() => {
    store.putUser(user);
    store.putSession(token, session);
  });
  db.users.push(user);
  db.sessions[token] = session;
  return { status: 201, body: { user: publicUser(user) }, headers: { 'Set-Cookie': sessionCookie(token, SESSION_DAYS * 86400) } };
});

route('POST', '/api/login', async ({ body, ip }) => {
  rateLimit(ip);
  const user = db.users.find((u) => u.usernameKey === keyOf(body.username));
  if (!user || !checkPassword(String(body.password || ''), user)) fail(401, 'Wrong username or password');
  const token = uid(24);
  const session = { userId: user.id, expires: Date.now() + SESSION_DAYS * 864e5 };
  store.putSession(token, session);
  db.sessions[token] = session;
  return { body: { user: publicUser(user) }, headers: { 'Set-Cookie': sessionCookie(token, SESSION_DAYS * 86400) } };
});

route('POST', '/api/logout', ({ req }) => {
  const token = parseCookies(req).msa_session;
  if (token && db.sessions[token]) {
    store.deleteSession(token);
    delete db.sessions[token];
  }
  return { body: { ok: true }, headers: { 'Set-Cookie': sessionCookie('', 0) } };
});

route(
  'POST',
  '/api/me/password',
  ({ user, body }) => {
    if (!checkPassword(String(body.current || ''), user)) fail(400, 'Current password is incorrect');
    const next = String(body.next || '');
    if (next.length < 6) fail(400, 'New password must be at least 6 characters');
    Object.assign(user, hashPassword(next));
    store.putUser(user);
    return { ok: true };
  },
  { auth: true }
);

route(
  'PUT',
  '/api/me',
  ({ user, body }) => {
    const displayName = str(body.displayName, 40);
    if (!displayName) fail(400, 'Display name can’t be empty');
    user.displayName = displayName;
    store.putUser(user);
    return { user: publicUser(user) };
  },
  { auth: true }
);

route(
  'GET',
  '/api/me/votes',
  ({ user }) => {
    const out = [];
    for (const a of db.awards) {
      if (a.status === 'draft') continue;
      for (const c of a.categories) {
        const nid = ((a.votes || {})[c.id] || {})[user.id];
        if (!nid) continue;
        const n = c.nominees.find((x) => x.id === nid);
        out.push({ awardId: a.id, awardTitle: a.title, category: c.name, nominee: n?.name, image: n?.image || '', won: a.status === 'announced' && c.winnerId === nid });
      }
    }
    return { votes: out };
  },
  { auth: true }
);

// public content
route('GET', '/api/home', ({ user }) => {
  const awards = db.awards.filter((a) => a.status !== 'draft');
  const voters = new Set();
  awards.forEach((a) => Object.values(a.votes || {}).forEach((m) => Object.keys(m).forEach((u) => voters.add(u))));
  return {
    stats: {
      festivals: db.festivals.length,
      awards: awards.length,
      categories: awards.reduce((s, a) => s + a.categories.length, 0),
      members: db.users.length,
      voters: voters.size,
    },
    festivals: [...db.festivals].sort(sortFest).filter((f) => f.status !== 'ended').slice(0, 3).map((f) => festivalView(f, user)),
    awards: awards.map((a) => awardView(a, user)),
  };
});

route('GET', '/api/festivals', ({ user }) => ({ festivals: [...db.festivals].sort(sortFest).map((f) => festivalView(f, user)) }));

route('GET', '/api/festivals/:id', ({ user, params }) => {
  const f = db.festivals.find((x) => x.id === params.id) || fail(404, 'Festival not found');
  return { festival: festivalView(f, user) };
});

route(
  'POST',
  '/api/festivals/:id/attend',
  ({ user, params }) => {
    const f = db.festivals.find((x) => x.id === params.id) || fail(404, 'Festival not found');
    f.attendees ||= [];
    const i = f.attendees.indexOf(user.id);
    store.setAttending(f.id, user.id, i < 0);
    if (i >= 0) f.attendees.splice(i, 1);
    else f.attendees.push(user.id);
    return { festival: festivalView(f, user) };
  },
  { auth: true }
);

route('GET', '/api/awards', ({ user }) => ({
  awards: db.awards.filter((a) => a.status !== 'draft' || user?.role === 'admin').map((a) => awardView(a, user)),
}));

route('GET', '/api/awards/:id', ({ user, params }) => {
  const a = db.awards.find((x) => x.id === params.id);
  if (!a || (a.status === 'draft' && user?.role !== 'admin')) fail(404, 'Awards show not found');
  return { award: awardView(a, user, true) };
});

route(
  'POST',
  '/api/awards/:id/vote',
  ({ user, params, body }) => {
    const a = db.awards.find((x) => x.id === params.id) || fail(404, 'Awards show not found');
    if (a.status !== 'voting') fail(400, 'Voting for this show is closed');
    const c = a.categories.find((x) => x.id === body.categoryId) || fail(404, 'Category not found');
    a.votes ||= {};
    a.votes[c.id] ||= {};
    if (body.nomineeId === null) {
      store.setVote(a.id, c.id, user.id, null);
      delete a.votes[c.id][user.id];
    } else {
      if (!c.nominees.some((n) => n.id === body.nomineeId)) fail(404, 'Nominee not found');
      store.setVote(a.id, c.id, user.id, body.nomineeId);
      a.votes[c.id][user.id] = body.nomineeId;
    }
    return { award: awardView(a, user, true) };
  },
  { auth: true }
);

// ─── admin ───
route(
  'GET',
  '/api/admin/overview',
  () => {
    const voters = new Set();
    let votes = 0;
    db.awards.forEach((a) =>
      Object.values(a.votes || {}).forEach((m) =>
        Object.keys(m).forEach((u) => {
          voters.add(u);
          votes++;
        })
      )
    );
    return {
      stats: {
        users: db.users.length,
        festivals: db.festivals.length,
        awards: db.awards.length,
        votes,
        voters: voters.size,
        attendees: db.festivals.reduce((s, f) => s + (f.attendees || []).length, 0),
      },
      recentUsers: [...db.users].reverse().slice(0, 6).map(publicUser),
    };
  },
  { admin: true }
);

route('GET', '/api/admin/festivals', ({ user }) => ({ festivals: [...db.festivals].sort(sortFest).map((f) => festivalView(f, user)) }), { admin: true });

route(
  'POST',
  '/api/admin/festivals',
  ({ body, user }) => {
    const f = { id: uid(6), attendees: [], createdAt: now(), ...cleanFestival(body) };
    store.putFestival(f);
    db.festivals.push(f);
    return { status: 201, body: { festival: festivalView(f, user) } };
  },
  { admin: true }
);

route(
  'PUT',
  '/api/admin/festivals/:id',
  ({ body, params, user }) => {
    const i = db.festivals.findIndex((x) => x.id === params.id);
    if (i < 0) fail(404, 'Festival not found');
    const next = cleanFestival(body, db.festivals[i]);
    store.putFestival(next);
    db.festivals[i] = next;
    return { festival: festivalView(db.festivals[i], user) };
  },
  { admin: true }
);

route(
  'DELETE',
  '/api/admin/festivals/:id',
  ({ params }) => {
    const linked = db.awards.filter((a) => a.festivalId === params.id);
    store.tx(() => {
      store.deleteFestival(params.id);
      linked.forEach((a) => store.putAward({ ...a, festivalId: '' }));
    });
    db.festivals = db.festivals.filter((x) => x.id !== params.id);
    linked.forEach((a) => (a.festivalId = ''));
    return { ok: true };
  },
  { admin: true }
);

route('GET', '/api/admin/awards/:id', ({ params, user }) => {
  const a = db.awards.find((x) => x.id === params.id) || fail(404, 'Awards show not found');
  return { award: awardView(a, user, true) };
}, { admin: true });

route(
  'POST',
  '/api/admin/awards',
  ({ body, user }) => {
    const a = { id: uid(6), createdAt: now(), ...cleanAward(body) };
    store.saveAwardWithVotes(a);
    db.awards.push(a);
    return { status: 201, body: { award: awardView(a, user, true) } };
  },
  { admin: true }
);

route(
  'PUT',
  '/api/admin/awards/:id',
  ({ body, params, user }) => {
    const i = db.awards.findIndex((x) => x.id === params.id);
    if (i < 0) fail(404, 'Awards show not found');
    const next = cleanAward(body, db.awards[i]);
    store.saveAwardWithVotes(next);
    db.awards[i] = next;
    return { award: awardView(db.awards[i], user, true) };
  },
  { admin: true }
);

route(
  'DELETE',
  '/api/admin/awards/:id',
  ({ params }) => {
    store.deleteAward(params.id);
    db.awards = db.awards.filter((x) => x.id !== params.id);
    return { ok: true };
  },
  { admin: true }
);

route(
  'POST',
  '/api/admin/awards/:id/auto-winners',
  ({ params, user }) => {
    const a = db.awards.find((x) => x.id === params.id) || fail(404, 'Awards show not found');
    for (const c of a.categories) {
      const counts = tally(a, c);
      let best = null;
      let max = 0;
      for (const [id, n] of Object.entries(counts)) if (n > max) (max = n), (best = id);
      if (best) c.winnerId = best;
    }
    store.putAward(a);
    return { award: awardView(a, user, true) };
  },
  { admin: true }
);

route(
  'POST',
  '/api/admin/awards/:id/reset-votes',
  ({ params, user }) => {
    const a = db.awards.find((x) => x.id === params.id) || fail(404, 'Awards show not found');
    store.saveAwardWithVotes({ ...a, votes: {} });
    a.votes = {};
    return { award: awardView(a, user, true) };
  },
  { admin: true }
);

route('GET', '/api/admin/users', () => ({
  users: db.users.map((u) => {
    let votes = 0;
    db.awards.forEach((a) => Object.values(a.votes || {}).forEach((m) => m[u.id] && votes++));
    return { ...publicUser(u), votes };
  }),
}), { admin: true });

route(
  'DELETE',
  '/api/admin/users/:id',
  ({ params, user }) => {
    const target = db.users.find((u) => u.id === params.id) || fail(404, 'User not found');
    if (target.id === user.id || target.usernameKey === keyOf(ADMIN_USERNAME)) fail(400, 'The admin account can’t be deleted');
    store.deleteUser(target.id); // sessions, votes and attendance cascade in SQLite
    db.users = db.users.filter((u) => u.id !== target.id);
    for (const [k, s] of Object.entries(db.sessions)) if (s.userId === target.id) delete db.sessions[k];
    db.awards.forEach((a) => Object.values(a.votes || {}).forEach((m) => delete m[target.id]));
    db.festivals.forEach((f) => (f.attendees = (f.attendees || []).filter((x) => x !== target.id)));
    return { ok: true };
  },
  { admin: true }
);

route(
  'POST',
  '/api/admin/upload',
  ({ body }) => {
    const m = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.data || ''));
    if (!m) fail(400, 'Only PNG / JPG / WEBP / GIF images can be uploaded');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 8 * 1024 * 1024) fail(413, 'Image is larger than 8MB');
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const name = `${Date.now().toString(36)}-${uid(5)}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
    return { status: 201, body: { url: `/uploads/${name}` } };
  },
  { admin: true }
);

// ───────────────────────── server ─────────────────────────
function serveStatic(req, res, pathname) {
  let base = PUBLIC_DIR;
  let rel = pathname;
  if (pathname.startsWith('/uploads/')) {
    base = UPLOAD_DIR;
    rel = pathname.slice('/uploads'.length);
  }
  const file = path.normalize(path.join(base, decodeURIComponent(rel)));
  if (!file.startsWith(base)) return send(res, 403, 'Forbidden');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      // SPA fallback
      if (!path.extname(pathname)) return serveStatic(req, res, '/index.html');
      return send(res, 404, 'Not found');
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': ['.html', '.css', '.js'].includes(ext) ? 'no-cache' : 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  try {
    if (!pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
      return serveStatic(req, res, pathname === '/' ? '/index.html' : pathname);
    }
    // CSRF guard: state-changing requests must come from this origin
    if (req.method !== 'GET') {
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) fail(403, 'Forbidden');
    }
    const r = routes.find((x) => x.method === req.method && x.re.test(pathname));
    if (!r) fail(404, 'Not found');
    const match = r.re.exec(pathname);
    const params = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(match[i + 1])));
    const user = currentUser(req);
    if ((r.auth || r.admin) && !user) fail(401, 'Please log in first');
    if (r.admin && user.role !== 'admin') fail(403, 'Admins only');
    const body = req.method === 'GET' ? {} : await readBody(req);
    const ip = req.socket.remoteAddress;
    const out = await r.handler({ req, res, user, params, body, ip, query: url.searchParams });
    if (out && out.body !== undefined && (out.status || out.headers)) send(res, out.status || 200, out.body, out.headers);
    else send(res, 200, out ?? { ok: true });
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    send(res, e.status || 500, { error: e instanceof HttpError ? e.message : 'Server error' });
  }
});

server.listen(PORT, () => {
  console.log(`\n  ✦ MAN STUDIO AWARDS  →  http://localhost:${PORT}\n`);
});
