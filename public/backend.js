// ═══════════════════════ MAN STUDIO AWARDS — Firebase data layer ═══════════════════════
// The site is static (GitHub Pages). Accounts live in Firebase Authentication and data in
// Cloud Firestore. This module exposes `api(method, url, body)` with the same routes and
// response shapes the UI expects, so pages don't need to know where data comes from.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, writeBatch, getCountFromServer,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig, adminUid } from './firebase-config.js';

export const configured = !!(firebaseConfig && firebaseConfig.apiKey && !/^PASTE/.test(firebaseConfig.apiKey) && firebaseConfig.projectId);

const ADMIN_USERNAME = 'man studio';
const EMAIL_DOMAIN = 'users.man-studio-awards.app'; // usernames are mapped to sign-in emails; no mail is ever sent

let auth, fdb;
let current = null; // { id, username, displayName, role, createdAt }
let readyResolve;
const ready = new Promise((r) => (readyResolve = r));

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };

// ───────────── helpers ─────────────
const now = () => new Date().toISOString();
const keyOf = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
const emailFor = (username) => keyOf(username).replace(/ /g, '+') + '@' + EMAIL_DOMAIN;
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const IMG_RE = /^(img:[A-Za-z0-9]{6,40}|assets\/[\w.\-]+|https:\/\/[^\s"'<>]+)$/i;
const img = (v) => { const s = str(v, 600); return s && IMG_RE.test(s) ? s : ''; };
const isAdmin = () => current?.role === 'admin';
const newId = (c) => doc(collection(fdb, c)).id;
const shortId = () => Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 5);

const col = (...p) => collection(fdb, ...p);
const ref = (...p) => doc(fdb, ...p);
const rows = async (q) => (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }));
async function one(r) {
  try {
    const s = await getDoc(r);
    return s.exists() ? { id: s.id, ...s.data() } : null;
  } catch (e) {
    if (e.code === 'permission-denied') return null;
    throw e;
  }
}
const count = async (q) => (await getCountFromServer(q)).data().count;

function friendly(e) {
  if (e instanceof HttpError) return e;
  const c = e?.code || '';
  const map = {
    'auth/invalid-credential': [401, 'Wrong username or password'],
    'auth/wrong-password': [401, 'Wrong username or password'],
    'auth/user-not-found': [401, 'Wrong username or password'],
    'auth/invalid-email': [400, 'That username can’t be used'],
    'auth/email-already-in-use': [409, 'That username is taken'],
    'auth/weak-password': [400, 'Password must be at least 6 characters'],
    'auth/too-many-requests': [429, 'Too many attempts. Please try again in a few minutes'],
    'auth/network-request-failed': [503, 'Network error. Check your connection'],
    'auth/operation-not-allowed': [500, 'Username/password sign-in is not enabled in Firebase yet'],
    'auth/unauthorized-domain': [500, 'This website’s address is not on Firebase’s authorized domains list yet'],
    'permission-denied': [403, 'You don’t have permission to do that'],
    unavailable: [503, 'The database is unreachable right now. Try again shortly'],
  };
  const [status, msg] = map[c] || [500, e?.message || 'Something went wrong'];
  if (!map[c]) console.error(e);
  return new HttpError(status, msg);
}

// ───────────── auth state ─────────────
async function loadProfile(u) {
  if (!u) return null;
  const blocked = await one(ref('blocked', u.uid));
  if (blocked) {
    await signOut(auth);
    return null;
  }
  let p = await one(ref('users', u.uid));
  if (!p) {
    // profile missing (e.g. account created in the Firebase console) → create it from the email
    const username = decodeURIComponent((u.email || '').split('@')[0]).replace(/\+/g, ' ') || 'member';
    p = { username, usernameKey: keyOf(username), displayName: username === ADMIN_USERNAME ? 'MAN STUDIO' : username, createdAt: now() };
    await setDoc(ref('users', u.uid), p);
  }
  return {
    id: u.uid,
    username: p.username,
    displayName: p.displayName,
    createdAt: p.createdAt,
    role: adminUid && u.uid === adminUid ? 'admin' : 'user',
    adminConfigured: !!adminUid,
  };
}

if (configured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  fdb = getFirestore(app);
  let first = true;
  onAuthStateChanged(auth, async (u) => {
    try { current = await loadProfile(u); } catch (e) { console.error(e); current = null; }
    if (first) { first = false; readyResolve(); }
  });
} else readyResolve();

// ───────────── data cleaning (admin forms) ─────────────
function cleanFestival(b) {
  const title = str(b.title, 120);
  if (!title) fail(400, 'The festival needs a name');
  return {
    title,
    tagline: str(b.tagline, 200),
    description: str(b.description, 4000),
    location: str(b.location, 120),
    startDate: str(b.startDate, 20),
    endDate: str(b.endDate, 20),
    cover: img(b.cover),
    accent: COLOR_RE.test(b.accent || '') ? b.accent : '#22e4ff',
    status: ['upcoming', 'live', 'ended'].includes(b.status) ? b.status : 'upcoming',
    highlights: (Array.isArray(b.highlights) ? b.highlights : []).map((h) => str(h, 60)).filter(Boolean).slice(0, 12),
  };
}

function cleanAward(b, festivals) {
  const title = str(b.title, 120);
  if (!title) fail(400, 'The show needs a name');
  const okId = (v) => typeof v === 'string' && /^[\w-]{1,20}$/.test(v);
  const categories = (Array.isArray(b.categories) ? b.categories : []).slice(0, 60).map((c) => {
    const nominees = (Array.isArray(c.nominees) ? c.nominees : []).slice(0, 30).map((nm) => ({
      id: okId(nm.id) ? nm.id : shortId(),
      name: str(nm.name, 80) || 'Untitled nominee',
      studio: str(nm.studio, 80),
      image: img(nm.image),
      blurb: str(nm.blurb, 200),
    }));
    return {
      id: okId(c.id) ? c.id : shortId(),
      name: str(c.name, 80) || 'Untitled category',
      description: str(c.description, 300),
      nominees,
      winnerId: nominees.some((n) => n.id === c.winnerId) ? c.winnerId : null,
    };
  });
  return {
    title,
    year: Number(b.year) || new Date().getFullYear(),
    tagline: str(b.tagline, 200),
    description: str(b.description, 4000),
    ceremonyDate: str(b.ceremonyDate, 25),
    festivalId: festivals.some((f) => f.id === b.festivalId) ? b.festivalId : '',
    cover: img(b.cover),
    status: ['draft', 'voting', 'closed', 'announced'].includes(b.status) ? b.status : 'draft',
    categories,
  };
}

// ───────────── reads ─────────────
const PUBLIC_STATUSES = ['voting', 'closed', 'announced'];
const byCreated = (a, b) => String(a.createdAt).localeCompare(String(b.createdAt));
const sortFest = (a, b) => String(a.startDate).localeCompare(String(b.startDate));

async function visibleAwards({ includeDrafts = isAdmin() } = {}) {
  const list = includeDrafts ? await rows(col('awards')) : await rows(query(col('awards'), where('status', 'in', PUBLIC_STATUSES)));
  return list.sort(byCreated);
}
const allFestivals = async () => (await rows(col('festivals'))).sort(sortFest);

// votes map {categoryId: {uid: nomineeId}} — admin only
async function votesFor(awardId) {
  const map = {};
  for (const v of await rows(query(col('votes'), where('awardId', '==', awardId)))) (map[v.categoryId] ||= {})[v.uid] = v.nomineeId;
  return map;
}
async function myVotesFor(awardId) {
  if (!current) return {};
  const out = {};
  for (const v of await rows(query(col('votes'), where('uid', '==', current.id), where('awardId', '==', awardId)))) out[v.categoryId] = v.nomineeId;
  return out;
}
function tallyFromVotes(votes, cat) {
  const counts = {};
  cat.nominees.forEach((n) => (counts[n.id] = 0));
  for (const nid of Object.values(votes[cat.id] || {})) if (nid in counts) counts[nid]++;
  return counts;
}
function votersOf(votes) {
  const s = new Set();
  Object.values(votes).forEach((m) => Object.keys(m).forEach((u) => s.add(u)));
  return s.size;
}

async function awardView(a, full = false, festivals = null) {
  const admin = isAdmin();
  const votes = admin ? await votesFor(a.id) : null;
  const showCounts = admin || a.status === 'announced';
  const showWinners = admin || a.status === 'announced';
  festivals ||= await allFestivals();
  const fest = festivals.find((f) => f.id === a.festivalId);
  const categories = a.categories || [];
  const base = {
    id: a.id, title: a.title, year: a.year, tagline: a.tagline, description: a.description,
    ceremonyDate: a.ceremonyDate, festivalId: a.festivalId, festivalTitle: fest ? fest.title : '',
    cover: a.cover, status: a.status, createdAt: a.createdAt,
    categoryCount: categories.length,
    nomineeCount: categories.reduce((s, c) => s + c.nominees.length, 0),
    voterCount: votes ? votersOf(votes) : a.voterCount || 0,
  };
  if (!full) {
    base.previewNominees = categories.flatMap((c) => c.nominees).filter((n) => n.image).slice(0, 4).map((n) => n.image);
    return base;
  }
  const mine = await myVotesFor(a.id);
  base.categories = categories.map((c) => {
    let counts = null;
    if (showCounts) counts = votes ? tallyFromVotes(votes, c) : { ...Object.fromEntries(c.nominees.map((n) => [n.id, 0])), ...((a.results || {})[c.id] || {}) };
    const total = counts ? Object.values(counts).reduce((s, x) => s + x, 0) : null;
    return {
      id: c.id, name: c.name, description: c.description,
      winnerId: showWinners ? c.winnerId : null,
      myVote: mine[c.id] || null,
      totalVotes: total,
      nominees: c.nominees.map((n) => ({ ...n, votes: counts ? counts[n.id] || 0 : null })),
    };
  });
  return base;
}

async function festivalView(f, awards) {
  const [attendeeCount, attending] = await Promise.all([
    count(col('festivals', f.id, 'attendees')),
    current ? one(ref('festivals', f.id, 'attendees', current.id)).then(Boolean) : false,
  ]);
  return {
    ...f,
    attendeeCount,
    attending,
    awards: awards.filter((a) => a.festivalId === f.id).map((a) => ({ id: a.id, title: a.title, status: a.status })),
  };
}

// Admin: recompute stored public stats (results only once winners are announced)
async function publishStats(awardId, award) {
  const votes = await votesFor(awardId);
  const results = {};
  if (award.status === 'announced') for (const c of award.categories) results[c.id] = tallyFromVotes(votes, c);
  return { voterCount: votersOf(votes), results: award.status === 'announced' ? results : null };
}

async function deleteWhere(q) {
  const docs = (await getDocs(q)).docs;
  for (let i = 0; i < docs.length; i += 450) {
    const b = writeBatch(fdb);
    docs.slice(i, i + 450).forEach((d) => b.delete(d.ref));
    await b.commit();
  }
}

// ───────────── images (stored in Firestore, resized in the browser) ─────────────
function resizeImage(file, maxW = 1280) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return reject(new HttpError(400, 'Only PNG / JPG / WEBP / GIF images can be uploaded'));
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const scale = Math.min(1, maxW / im.width);
      const c = document.createElement('canvas');
      c.width = Math.round(im.width * scale);
      c.height = Math.round(im.height * scale);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#080b2b';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let q = 0.85, data = c.toDataURL('image/jpeg', q);
      while (data.length > 850000 && q > 0.35) data = c.toDataURL('image/jpeg', (q -= 0.1));
      if (data.length > 850000) return reject(new HttpError(413, 'That image is too large, try a smaller one'));
      resolve(data);
    };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new HttpError(400, 'Could not read that image')); };
    im.src = url;
  });
}

const imageCache = new Map();
export function imageData(refStr) {
  const id = String(refStr).slice(4);
  if (!imageCache.has(id)) imageCache.set(id, one(ref('images', id)).then((d) => d?.data || ''));
  return imageCache.get(id);
}

// ───────────── routes ─────────────
const routes = [];
const route = (method, pattern, handler, opts = {}) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
  routes.push({ method, re, keys, handler, ...opts });
};

route('GET', '/api/me', () => ({ user: current }));

route('POST', '/api/register', async ({ body }) => {
  const username = str(body.username, 24).replace(/\s+/g, ' ');
  const password = String(body.password || '');
  const displayName = str(body.displayName, 40) || username;
  if (!/^[a-z0-9][a-z0-9 _-]{1,22}[a-z0-9]$/i.test(username)) fail(400, 'Username: 3–24 characters (English letters, numbers, spaces, _ -)');
  if (password.length < 6) fail(400, 'Password must be at least 6 characters');
  if (keyOf(username) === ADMIN_USERNAME && adminUid) fail(409, 'That username is taken');
  const cred = await createUserWithEmailAndPassword(auth, emailFor(username), password);
  const p = { username, usernameKey: keyOf(username), displayName: keyOf(username) === ADMIN_USERNAME ? 'MAN STUDIO' : displayName, createdAt: now() };
  await setDoc(ref('users', cred.user.uid), p);
  current = await loadProfile(cred.user);
  return { user: current };
});

route('POST', '/api/login', async ({ body }) => {
  if (!str(body.username)) fail(400, 'Enter your username');
  const cred = await signInWithEmailAndPassword(auth, emailFor(body.username), String(body.password || ''));
  current = await loadProfile(cred.user);
  if (!current) fail(403, 'This account has been removed');
  return { user: current };
});

route('POST', '/api/logout', async () => {
  await signOut(auth);
  current = null;
  return { ok: true };
});

route('POST', '/api/me/password', async ({ body }) => {
  const next = String(body.next || '');
  if (next.length < 6) fail(400, 'New password must be at least 6 characters');
  try {
    await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, String(body.current || '')));
  } catch {
    fail(400, 'Current password is incorrect');
  }
  await updatePassword(auth.currentUser, next);
  return { ok: true };
}, { auth: true });

route('PUT', '/api/me', async ({ body }) => {
  const displayName = str(body.displayName, 40);
  if (!displayName) fail(400, 'Display name can’t be empty');
  await updateDoc(ref('users', current.id), { displayName });
  current = { ...current, displayName };
  return { user: current };
}, { auth: true });

route('GET', '/api/me/votes', async () => {
  const [mine, awards] = await Promise.all([rows(query(col('votes'), where('uid', '==', current.id))), visibleAwards({ includeDrafts: false })]);
  const out = [];
  for (const v of mine) {
    const a = awards.find((x) => x.id === v.awardId);
    const c = a?.categories.find((x) => x.id === v.categoryId);
    const n = c?.nominees.find((x) => x.id === v.nomineeId);
    if (!n) continue;
    out.push({ awardId: a.id, awardTitle: a.title, category: c.name, nominee: n.name, image: n.image || '', won: a.status === 'announced' && c.winnerId === n.id });
  }
  return { votes: out };
}, { auth: true });

route('GET', '/api/home', async () => {
  const [awards, festivals] = await Promise.all([visibleAwards({ includeDrafts: false }), allFestivals()]);
  const upcoming = festivals.filter((f) => f.status !== 'ended').slice(0, 3);
  return {
    stats: {
      festivals: festivals.length,
      awards: awards.length,
      categories: awards.reduce((s, a) => s + a.categories.length, 0),
      nominees: awards.reduce((s, a) => s + a.categories.reduce((t, c) => t + c.nominees.length, 0), 0),
    },
    festivals: await Promise.all(upcoming.map((f) => festivalView(f, awards))),
    awards: await Promise.all(awards.map((a) => awardView(a, false, festivals))),
  };
});

route('GET', '/api/festivals', async () => {
  const [festivals, awards] = await Promise.all([allFestivals(), visibleAwards()]);
  return { festivals: await Promise.all(festivals.map((f) => festivalView(f, awards))) };
});

route('GET', '/api/festivals/:id', async ({ params }) => {
  const f = (await one(ref('festivals', params.id))) || fail(404, 'Festival not found');
  return { festival: await festivalView(f, await visibleAwards()) };
});

route('POST', '/api/festivals/:id/attend', async ({ params }) => {
  const f = (await one(ref('festivals', params.id))) || fail(404, 'Festival not found');
  const r = ref('festivals', f.id, 'attendees', current.id);
  if (await one(r)) await deleteDoc(r);
  else await setDoc(r, { createdAt: now() });
  return { festival: await festivalView(f, await visibleAwards()) };
}, { auth: true });

route('GET', '/api/awards', async () => {
  const [awards, festivals] = await Promise.all([visibleAwards(), allFestivals()]);
  return { awards: await Promise.all(awards.map((a) => awardView(a, false, festivals))) };
});

route('GET', '/api/awards/:id', async ({ params }) => {
  const a = await one(ref('awards', params.id));
  if (!a || (a.status === 'draft' && !isAdmin())) fail(404, 'Awards show not found');
  return { award: await awardView(a, true) };
});

route('POST', '/api/awards/:id/vote', async ({ params, body }) => {
  const a = (await one(ref('awards', params.id))) || fail(404, 'Awards show not found');
  if (a.status !== 'voting') fail(400, 'Voting for this show is closed');
  const c = a.categories.find((x) => x.id === body.categoryId) || fail(404, 'Category not found');
  const r = ref('votes', `${a.id}_${c.id}_${current.id}`);
  if (body.nomineeId === null) await deleteDoc(r);
  else {
    if (!c.nominees.some((n) => n.id === body.nomineeId)) fail(404, 'Nominee not found');
    await setDoc(r, { awardId: a.id, categoryId: c.id, uid: current.id, nomineeId: body.nomineeId, createdAt: now() });
  }
  return { award: await awardView(a, true) };
}, { auth: true });

// ─── admin ───
route('GET', '/api/admin/overview', async () => {
  const [users, festivals, awards, votes] = await Promise.all([rows(col('users')), allFestivals(), rows(col('awards')), rows(col('votes'))]);
  const attendees = (await Promise.all(festivals.map((f) => count(col('festivals', f.id, 'attendees'))))).reduce((s, n) => s + n, 0);
  return {
    stats: { users: users.length, festivals: festivals.length, awards: awards.length, votes: votes.length, voters: new Set(votes.map((v) => v.uid)).size, attendees },
    recentUsers: users.sort(byCreated).reverse().slice(0, 6).map((u) => ({ id: u.id, username: u.username, displayName: u.displayName, createdAt: u.createdAt, role: u.id === adminUid ? 'admin' : 'user' })),
  };
}, { admin: true });

route('GET', '/api/admin/festivals', async () => {
  const [festivals, awards] = await Promise.all([allFestivals(), visibleAwards()]);
  return { festivals: await Promise.all(festivals.map((f) => festivalView(f, awards))) };
}, { admin: true });

route('POST', '/api/admin/festivals', async ({ body }) => {
  const id = newId('festivals');
  const f = { ...cleanFestival(body), createdAt: now() };
  await setDoc(ref('festivals', id), f);
  return { festival: await festivalView({ id, ...f }, []) };
}, { admin: true });

route('PUT', '/api/admin/festivals/:id', async ({ body, params }) => {
  const prev = (await one(ref('festivals', params.id))) || fail(404, 'Festival not found');
  const f = { ...cleanFestival(body), createdAt: prev.createdAt || now() };
  await setDoc(ref('festivals', params.id), f);
  return { festival: await festivalView({ id: params.id, ...f }, await visibleAwards()) };
}, { admin: true });

route('DELETE', '/api/admin/festivals/:id', async ({ params }) => {
  await deleteWhere(col('festivals', params.id, 'attendees'));
  const linked = await rows(query(col('awards'), where('festivalId', '==', params.id)));
  const b = writeBatch(fdb);
  linked.forEach((a) => b.update(ref('awards', a.id), { festivalId: '' }));
  b.delete(ref('festivals', params.id));
  await b.commit();
  return { ok: true };
}, { admin: true });

route('GET', '/api/admin/awards/:id', async ({ params }) => {
  const a = (await one(ref('awards', params.id))) || fail(404, 'Awards show not found');
  return { award: await awardView(a, true) };
}, { admin: true });

route('POST', '/api/admin/awards', async ({ body }) => {
  const id = newId('awards');
  const a = { ...cleanAward(body, await allFestivals()), createdAt: now(), voterCount: 0, results: null };
  await setDoc(ref('awards', id), a);
  return { award: await awardView({ id, ...a }, true) };
}, { admin: true });

route('PUT', '/api/admin/awards/:id', async ({ body, params }) => {
  const prev = (await one(ref('awards', params.id))) || fail(404, 'Awards show not found');
  const a = { ...cleanAward(body, await allFestivals()), createdAt: prev.createdAt || now() };
  Object.assign(a, await publishStats(params.id, a));
  await setDoc(ref('awards', params.id), a);
  return { award: await awardView({ id: params.id, ...a }, true) };
}, { admin: true });

route('DELETE', '/api/admin/awards/:id', async ({ params }) => {
  await deleteWhere(query(col('votes'), where('awardId', '==', params.id)));
  await deleteDoc(ref('awards', params.id));
  return { ok: true };
}, { admin: true });

route('POST', '/api/admin/awards/:id/reset-votes', async ({ params }) => {
  await deleteWhere(query(col('votes'), where('awardId', '==', params.id)));
  await updateDoc(ref('awards', params.id), { voterCount: 0, results: null });
  return { ok: true };
}, { admin: true });

route('GET', '/api/admin/users', async () => {
  const [users, votes] = await Promise.all([rows(col('users')), rows(col('votes'))]);
  return {
    users: users.sort(byCreated).map((u) => ({
      id: u.id, username: u.username, displayName: u.displayName, createdAt: u.createdAt,
      role: u.id === adminUid ? 'admin' : 'user',
      votes: votes.filter((v) => v.uid === u.id).length,
    })),
  };
}, { admin: true });

route('DELETE', '/api/admin/users/:id', async ({ params }) => {
  if (params.id === adminUid) fail(400, 'The admin account can’t be deleted');
  await deleteWhere(query(col('votes'), where('uid', '==', params.id)));
  const festivals = await allFestivals();
  const b = writeBatch(fdb);
  festivals.forEach((f) => b.delete(ref('festivals', f.id, 'attendees', params.id)));
  b.set(ref('blocked', params.id), { createdAt: now() });
  b.delete(ref('users', params.id));
  await b.commit();
  return { ok: true };
}, { admin: true });

route('POST', '/api/admin/upload', async ({ body }) => {
  const data = await resizeImage(body.file);
  const id = newId('images');
  await setDoc(ref('images', id), { data, createdAt: now() });
  imageCache.set(id, Promise.resolve(data));
  return { url: 'img:' + id };
}, { admin: true });

// ───────────── entry point ─────────────
export async function api(method, url, body) {
  if (!configured) throw new HttpError(503, 'The site isn’t connected to Firebase yet');
  await ready;
  try {
    const r = routes.find((x) => x.method === method && x.re.test(url));
    if (!r) fail(404, 'Not found');
    const m = r.re.exec(url);
    const params = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
    if ((r.auth || r.admin) && !current) fail(401, 'Please log in first');
    if (r.admin && !isAdmin()) fail(403, 'Admins only');
    return await r.handler({ params, body: body || {} });
  } catch (e) {
    throw friendly(e);
  }
}
