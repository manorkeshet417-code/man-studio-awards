/* ═══════════════════════ MAN STUDIO AWARDS — client ═══════════════════════ */
(() => {
'use strict';

// ───────────── utils ─────────────
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const app = $('#app');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = (name) => esc((String(name || '?').trim()[0] || '?').toUpperCase());
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
let me = null;
let timers = [];
let observers = [];
let leaveGuard = null; // returns true if it's OK to leave the current page

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong, please try again');
    err.status = res.status;
    throw err;
  }
  return data;
}

const LOCALE = 'en-US';
const fmtDate = (d, opts = { day: 'numeric', month: 'long', year: 'numeric' }) => {
  if (!d) return '';
  const dt = new Date(d.length <= 10 ? d + 'T00:00' : d);
  return isNaN(dt) ? '' : dt.toLocaleDateString(LOCALE, opts);
};
const fmtDateTime = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt) ? '' : dt.toLocaleString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};
const fmtRange = (a, b) => (a && b && a !== b ? `${fmtDate(a, { day: 'numeric', month: 'short' })} – ${fmtDate(b)}` : fmtDate(a || b));

// ───────────── icons & art ─────────────
const ICON = {
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
  vote: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><rect x="3" y="3" width="18" height="18" rx="4"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg>',
  up: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
};

let trophyN = 0;
function trophySVG(cls = 'trophy') {
  const id = 'tg' + ++trophyN;
  return `<svg class="${cls}" viewBox="0 0 200 260" aria-hidden="true">
  <defs>
    <linearGradient id="${id}a" x1="0" x2="1"><stop offset="0" stop-color="#8a5a00"/><stop offset=".25" stop-color="#ffd36b"/><stop offset=".45" stop-color="#fff5cf"/><stop offset=".65" stop-color="#ffc443"/><stop offset="1" stop-color="#9a6200"/></linearGradient>
    <linearGradient id="${id}b" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1a1f5c"/><stop offset="1" stop-color="#070a2a"/></linearGradient>
    <radialGradient id="${id}c" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <path d="M52 48 H26 C14 48 12 64 16 76 C22 96 40 110 60 112" fill="none" stroke="url(#${id}a)" stroke-width="9" stroke-linecap="round"/>
  <path d="M148 48 H174 C186 48 188 64 184 76 C178 96 160 110 140 112" fill="none" stroke="url(#${id}a)" stroke-width="9" stroke-linecap="round"/>
  <path d="M46 26 H154 V72 C154 124 128 150 100 156 C72 150 46 124 46 72 Z" fill="url(#${id}a)"/>
  <path d="M46 26 H154 V34 H46 Z" fill="#fff5cf" opacity=".55"/>
  <path d="M62 40 C60 80 66 118 86 140" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="6" stroke-linecap="round"/>
  <polygon points="100,62 108,82 130,82 112,95 119,116 100,103 81,116 88,95 70,82 92,82" fill="#fff8de" opacity=".95"/>
  <rect x="90" y="154" width="20" height="30" fill="url(#${id}a)"/>
  <ellipse cx="100" cy="186" rx="26" ry="7" fill="url(#${id}a)"/>
  <path d="M68 192 H132 L142 218 H58 Z" fill="url(#${id}a)"/>
  <rect x="44" y="218" width="112" height="30" rx="6" fill="url(#${id}b)" stroke="url(#${id}a)" stroke-width="3"/>
  <rect x="70" y="228" width="60" height="10" rx="3" fill="url(#${id}a)" opacity=".85"/>
  <circle cx="74" cy="58" r="22" fill="url(#${id}c)" opacity=".35"/>
</svg>`;
}

const FEST_STATUS = {
  upcoming: ['Upcoming', 'cyan'],
  live: ['Live now', 'pink live'],
  ended: ['Ended', 'gray'],
};
const AWARD_STATUS = {
  draft: ['Draft', 'gray'],
  voting: ['Voting open', 'cyan live'],
  closed: ['Voting closed', 'pink'],
  announced: ['Winners announced', 'gold'],
};
const badge = (map, s) => {
  const [label, cls] = map[s] || ['', 'gray'];
  return `<span class="badge ${cls}">${label}</span>`;
};

function coverHTML(src, fallbackText, accent) {
  return src
    ? `<img src="${esc(src)}" alt="" loading="lazy" />`
    : `<div class="cover-fallback" style="--accent:${esc(accent || '#22e4ff')}"><span>${esc(fallbackText)}</span></div>`;
}

// ───────────── toasts, modals, confetti ─────────────
function toast(msg, type = 'ok') {
  const icon = { ok: '✓', err: '⚠', gold: '🏆', info: '✦' }[type] || '✦';
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icon}</span><span>${esc(msg)}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 3400);
}

function confirmModal({ title, text, ok = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true">
      <h3>${esc(title)}</h3><p>${esc(text)}</p>
      <div class="actions"><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(ok)}</button><button class="btn btn-ghost" data-cancel>Cancel</button></div>
    </div></div>`;
    const close = (v) => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => e.key === 'Escape' && close(false);
    document.addEventListener('keydown', onKey);
    $('[data-ok]', root).onclick = () => close(true);
    $('[data-cancel]', root).onclick = () => close(false);
    $('.modal-backdrop', root).onclick = (e) => e.target.classList.contains('modal-backdrop') && close(false);
    $('[data-ok]', root).focus();
  });
}

function confetti(amount = 180) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  const colors = ['#ffd36b', '#fff0b8', '#22e4ff', '#ff3df2', '#f2a516', '#ffffff'];
  const parts = Array.from({ length: amount }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 200,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 16,
    vy: -Math.random() * 14 - 4,
    w: 6 + Math.random() * 6, h: 8 + Math.random() * 10,
    r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
    c: colors[(Math.random() * colors.length) | 0],
  }));
  const start = performance.now();
  (function frame(t) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts.forEach((p) => {
      p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - (t - start) / 3800);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.cos(p.r * 2));
      ctx.restore();
    });
    if (t - start < 3800) requestAnimationFrame(frame); else c.remove();
  })(start);
}

// ───────────── background particles ─────────────
(function bg() {
  const c = $('#bg-canvas');
  const ctx = c.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W, H, parts = [];
  const colors = ['34,228,255', '255,61,242', '255,211,107', '200,210,255'];
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(110, Math.round((W * H) / 16000));
    parts = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.6 + 0.3,
      s: Math.random() * 0.25 + 0.05, p: Math.random() * Math.PI * 2, c: colors[(Math.random() * colors.length) | 0],
    }));
  }
  function draw(t = 0) {
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      if (!reduced) { p.y -= p.s; if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W; } }
      const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t / 900 + p.p));
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.c},${a})`; ctx.shadowBlur = 8; ctx.shadowColor = `rgba(${p.c},1)`; ctx.fill();
    }
    if (!reduced) requestAnimationFrame(draw);
  }
  addEventListener('resize', resize);
  resize(); draw();
})();

addEventListener('scroll', () => $('#nav').classList.toggle('scrolled', scrollY > 10), { passive: true });
$('#year').textContent = new Date().getFullYear();
$('#burger').onclick = () => $('#nav-links').classList.toggle('open');

function reveal() {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))), { threshold: 0.08 });
  $$('.reveal', app).forEach((el, i) => { el.style.transitionDelay = `${Math.min(i % 6, 5) * 70}ms`; io.observe(el); });
  observers.push(io);
}

// ───────────── nav / session ─────────────
function renderNavUser() {
  const box = $('#nav-user');
  $('.admin-link').hidden = me?.role !== 'admin';
  if (!me) {
    box.innerHTML = `<a class="btn btn-ghost btn-sm" href="#/login">Log in</a><a class="btn btn-primary btn-sm" href="#/register">Sign up</a>`;
    return;
  }
  box.innerHTML = `<button class="user-chip" id="user-chip" aria-haspopup="menu"><span>${esc(me.displayName)}</span><i class="avatar ${me.role === 'admin' ? 'av-admin' : ''}">${initials(me.displayName)}</i></button>`;
  $('#user-chip').onclick = (e) => {
    e.stopPropagation();
    const open = $('.menu', box);
    if (open) return open.remove();
    const m = document.createElement('div');
    m.className = 'menu';
    m.setAttribute('role', 'menu');
    m.innerHTML = `
      <a href="#/profile">👤 My profile</a>
      ${me.role === 'admin' ? '<a href="#/admin">⚙️ Admin panel</a><a href="#/admin/festival/new">🎪 New festival</a><a href="#/admin/award/new">🏆 New awards show</a>' : ''}
      <hr /><button data-logout>↩ Log out</button>`;
    box.appendChild(m);
    $('[data-logout]', m).onclick = logout;
    setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }));
  };
}

async function logout() {
  await api('POST', '/api/logout').catch(() => {});
  me = null;
  renderNavUser();
  toast('You have been logged out. See you at the show!', 'info');
  location.hash = '#/';
}

// ───────────── router ─────────────
const routes = [
  [/^\/?$/, pageHome, 'home'],
  [/^\/festivals$/, pageFestivals, 'festivals'],
  [/^\/festival\/([\w-]+)$/, pageFestival, 'festivals'],
  [/^\/awards$/, pageAwards, 'awards'],
  [/^\/award\/([\w-]+)$/, pageAward, 'awards'],
  [/^\/login$/, () => pageAuth('login'), ''],
  [/^\/register$/, () => pageAuth('register'), ''],
  [/^\/profile$/, pageProfile, ''],
  [/^\/admin(?:\/(\w+))?(?:\/([\w-]+))?$/, pageAdmin, 'admin'],
];

let lastHash = location.hash;
async function router() {
  if (leaveGuard && !leaveGuard()) {
    history.replaceState(null, '', lastHash || '#/');
    return;
  }
  leaveGuard = null;
  lastHash = location.hash;
  timers.forEach(clearInterval); timers = [];
  observers.forEach((o) => o.disconnect()); observers = [];
  $('#nav-links').classList.remove('open');
  const path = location.hash.replace(/^#/, '').split('?')[0] || '/';
  const r = routes.find(([re]) => re.test(path));
  $$('[data-nav]').forEach((a) => a.classList.toggle('active', !!r && a.dataset.nav === r[2]));
  if (!r) return pageNotFound();
  const m = path.match(r[0]);
  app.innerHTML = '<div class="loader"><div class="ring"></div></div>';
  scrollTo({ top: 0, behavior: 'instant' });
  try {
    await r[1](...m.slice(1));
    reveal();
  } catch (e) {
    if (e.status === 401) { location.hash = '#/login?next=' + encodeURIComponent(path); return; }
    if (e.status === 404) return pageNotFound(e.message);
    app.innerHTML = `<div class="container section"><div class="empty"><div class="ic">⚠️</div><h3>Oops</h3><p>${esc(e.message)}</p></div></div>`;
  }
}
addEventListener('hashchange', router);
addEventListener('beforeunload', (e) => { if (leaveGuard && !leaveGuard(true)) { e.preventDefault(); e.returnValue = ''; } });

function pageNotFound(msg) {
  app.innerHTML = `<div class="page not-found"><h1>404</h1><h2>${esc(msg || 'This page got lost in space')}</h2><p class="muted">Maybe it’s still in development…</p><a class="btn btn-primary" href="#/">Back to home</a></div>`;
}

// ───────────── shared blocks ─────────────
const emptyBlock = (ic, title, text, cta = '') => `<div class="empty"><div class="ic">${ic}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${cta}</div>`;

function festivalCard(f) {
  return `<a class="card hover reveal" href="#/festival/${esc(f.id)}" style="--accent:${esc(f.accent)}">
    <div class="card-cover">${badge(FEST_STATUS, f.status)}${coverHTML(f.cover, f.title, f.accent)}</div>
    <div class="card-body">
      <h3 class="card-title">${esc(f.title)}</h3>
      <p class="card-text">${esc(f.tagline || f.description)}</p>
      <div class="meta">
        ${f.startDate ? `<span>${ICON.cal}${esc(fmtRange(f.startDate, f.endDate))}</span>` : ''}
        ${f.location ? `<span>${ICON.pin}${esc(f.location)}</span>` : ''}
      </div>
      <div class="card-foot"><span class="meta"><span>${ICON.users}${plural(f.attendeeCount, 'attendee', 'attendees')}</span></span>${f.attending ? '<span class="badge green">You’re going ✓</span>' : '<span class="badge plain gray">Details →</span>'}</div>
    </div>
  </a>`;
}

function awardCard(a) {
  const thumbs = (a.previewNominees || []).map((s) => `<img src="${esc(s)}" alt="" loading="lazy" />`).join('');
  return `<a class="card hover award-card reveal" href="#/award/${esc(a.id)}">
    <div class="card-cover">
      ${badge(AWARD_STATUS, a.status)}
      ${a.cover ? `<img src="${esc(a.cover)}" alt="" loading="lazy" />` : `<div class="award-art"><div class="thumbs">${thumbs}</div>${trophySVG('mini-trophy')}</div>`}
      <span class="award-year">${esc(a.year)}</span>
    </div>
    <div class="card-body">
      <h3 class="card-title">${esc(a.title)}</h3>
      <p class="card-text">${esc(a.tagline || a.description)}</p>
      <div class="meta">
        ${a.ceremonyDate ? `<span>${ICON.cal}${esc(fmtDate(a.ceremonyDate))}</span>` : ''}
        <span>${ICON.grid}${plural(a.categoryCount, 'category', 'categories')}</span>
        <span>${ICON.vote}${plural(a.voterCount, 'voter', 'voters')}</span>
      </div>
      <div class="card-foot">
        <span class="muted" style="font-size:14px">${a.festivalTitle ? '🎪 ' + esc(a.festivalTitle) : plural(a.nomineeCount, 'nomination', 'nominations')}</span>
        <span class="btn btn-sm ${a.status === 'voting' ? 'btn-primary' : a.status === 'announced' ? 'btn-gold' : 'btn-ghost'}">${a.status === 'voting' ? 'Vote now' : a.status === 'announced' ? 'See winners' : 'See nominees'}</span>
      </div>
    </div>
  </a>`;
}

function startCountdown(el, target) {
  const t = new Date(target).getTime();
  const tick = () => {
    const d = Math.max(0, t - Date.now());
    const parts = [Math.floor(d / 864e5), Math.floor((d % 864e5) / 36e5), Math.floor((d % 36e5) / 6e4), Math.floor((d % 6e4) / 1e3)];
    const labels = ['DAYS', 'HOURS', 'MINUTES', 'SECONDS'];
    el.innerHTML = parts.map((v, i) => `<div class="cd-unit"><b>${String(v).padStart(2, '0')}</b><span>${labels[i]}</span></div>`).join('');
  };
  tick();
  timers.push(setInterval(tick, 1000));
}

// ───────────── HOME ─────────────
async function pageHome() {
  const { stats, festivals, awards } = await api('GET', '/api/home');
  const voting = awards.find((a) => a.status === 'voting');
  const nextCeremony = awards
    .filter((a) => a.ceremonyDate && new Date(a.ceremonyDate) > new Date())
    .sort((a, b) => new Date(a.ceremonyDate) - new Date(b.ceremonyDate))[0];
  const sparkles = Array.from({ length: 14 }, () => `<i class="sparkle" style="top:${Math.random() * 90 + 5}%;left:${Math.random() * 90 + 5}%;animation-delay:${(Math.random() * 3).toFixed(2)}s"></i>`).join('');
  const isAdmin = me?.role === 'admin';

  app.innerHTML = `<div class="page">
  <section class="hero"><div class="container hero-grid">
    <div>
      ${voting ? `<a class="hero-badge" href="#/award/${esc(voting.id)}"><span class="dot"></span>Voting is open · ${esc(voting.title)} →</a>` : '<span class="hero-badge"><span class="dot"></span>The MAN STUDIO stage</span>'}
      <h1 class="hero-title"><span class="l1">MAN</span><span class="l2">studio</span><span class="l3 gold-text">AWARDS</span></h1>
      <p class="hero-sub">Festivals, awards shows, and a community that decides who takes home the trophy. Vote, show up, and be part of the big night.</p>
      <div class="hero-actions">
        ${voting ? `<a class="btn btn-gold btn-lg" href="#/award/${esc(voting.id)}">🏆 Vote now</a>` : `<a class="btn btn-gold btn-lg" href="#/awards">🏆 Awards shows</a>`}
        <a class="btn btn-ghost btn-lg" href="#/festivals">Festivals</a>
      </div>
      ${nextCeremony ? `<div class="countdown-card"><div class="countdown-label">Next ceremony<b>${esc(nextCeremony.title)}</b>${esc(fmtDateTime(nextCeremony.ceremonyDate))}</div><div class="countdown" id="cd"></div></div>` : ''}
    </div>
    <div class="hero-visual"><div class="trophy-stage"><div class="trophy-ring"></div><div class="trophy-ring r2"></div>${sparkles}<div class="trophy-floor"></div>${trophySVG()}</div></div>
  </div></section>

  <section class="container"><div class="stats-strip reveal">
    <div class="stat"><b>${stats.festivals}</b><span>Festivals</span></div>
    <div class="stat"><b>${stats.awards}</b><span>Awards shows</span></div>
    <div class="stat"><b>${stats.categories}</b><span>Categories</span></div>
    <div class="stat"><b>${stats.members}</b><span>Members</span></div>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><div><div class="eyebrow gold">The Game Awards</div><h2 class="h2">Awards <span class="gold-text">shows</span></h2><p class="lead">The community votes. The winners take the stage.</p></div><a class="btn btn-ghost" href="#/awards">All awards shows →</a></div>
    ${awards.length ? `<div class="grid grid-2">${awards.slice(0, 4).map(awardCard).join('')}</div>` : emptyBlock('🏆', 'No awards shows yet', 'The first show is on its way.', isAdmin ? '<a class="btn btn-gold" style="margin-top:14px" href="#/admin/award/new">+ Create an awards show</a>' : '')}
  </div></section>

  <section class="section" style="padding-top:0"><div class="container">
    <div class="section-head"><div><div class="eyebrow">Festivals</div><h2 class="h2">Upcoming <span class="grad-text">festivals</span></h2><p class="lead">Events, conferences and competitions. Sign up early so you don’t miss a thing.</p></div><a class="btn btn-ghost" href="#/festivals">All festivals →</a></div>
    ${festivals.length ? `<div class="grid grid-3">${festivals.map(festivalCard).join('')}</div>` : emptyBlock('🎪', 'No upcoming festivals', 'Stay tuned. Something big is coming.', isAdmin ? '<a class="btn btn-primary" style="margin-top:14px" href="#/admin/festival/new">+ Open a festival</a>' : '')}
  </div></section>

  <section class="section" style="padding-top:0"><div class="container">
    <div class="section-head"><div><div class="eyebrow pink">How it works</div><h2 class="h2">How it <span class="grad-text">works</span></h2></div></div>
    <div class="steps">
      <div class="card step reveal"><span class="n">01</span><h3>Sign up</h3><p>Create an account in seconds and join the MAN STUDIO community.</p></div>
      <div class="card step reveal"><span class="n">02</span><h3>Vote</h3><p>Pick your favorite in every category. You can change your mind until voting closes.</p></div>
      <div class="card step reveal"><span class="n">03</span><h3>Celebrate</h3><p>On ceremony night the winners are revealed, with full results and percentages.</p></div>
    </div>
  </div></section>

  ${!me ? `<section class="container" style="padding-bottom:40px"><div class="card cta-band reveal"><div class="eyebrow gold" style="justify-content:center">Join the show</div><h2>Your vote <span class="gold-text">matters</span></h2><p>Join now, vote for your favorites, and hear about every new festival first.</p><div class="hero-actions" style="justify-content:center"><a class="btn btn-primary btn-lg" href="#/register">Create an account</a><a class="btn btn-ghost btn-lg" href="#/login">I already have one</a></div></div></section>` : ''}
  </div>`;
  if (nextCeremony) startCountdown($('#cd'), nextCeremony.ceremonyDate);
}

// ───────────── FESTIVALS ─────────────
async function pageFestivals() {
  const { festivals } = await api('GET', '/api/festivals');
  let filter = 'all';
  const filters = [['all', 'All'], ['upcoming', 'Upcoming'], ['live', 'Live now'], ['ended', 'Ended']];
  const draw = () => {
    const list = festivals.filter((f) => filter === 'all' || f.status === filter);
    $('#fest-list').innerHTML = list.length
      ? `<div class="grid grid-3">${list.map(festivalCard).join('')}</div>`
      : emptyBlock('🎪', festivals.length ? 'Nothing here' : 'No festivals yet', festivals.length ? 'Try a different filter.' : 'Check back soon.');
    $$('[data-f]').forEach((b) => (b.style.cssText = b.dataset.f === filter ? 'color:#fff;border-color:var(--cyan);background:rgba(34,228,255,.1)' : ''));
    reveal();
  };
  app.innerHTML = `<div class="page container">
    <div class="page-hero"><div class="eyebrow">Festivals</div><h1 class="h2">MAN STUDIO <span class="grad-text">festivals</span></h1><p class="lead">Conferences, launches, competitions and community events. Pick a festival and sign up.</p></div>
    <div class="cat-nav-inner" style="margin-bottom:26px">${filters.map(([k, l]) => `<button class="cat-pill" data-f="${k}">${l}</button>`).join('')}</div>
    <div id="fest-list"></div><div style="height:60px"></div>
  </div>`;
  $$('[data-f]').forEach((b) => (b.onclick = () => { filter = b.dataset.f; draw(); }));
  draw();
}

async function pageFestival(id) {
  const { festival: f } = await api('GET', `/api/festivals/${id}`);
  const draw = () => {
    app.innerHTML = `<div class="page">
    <section class="detail-hero" style="--accent:${esc(f.accent)}">
      <div class="bg">${coverHTML(f.cover, '', f.accent)}</div>
      <div class="container">
        <a class="back-link" href="#/festivals">${ICON.back} All festivals</a><br/>
        ${badge(FEST_STATUS, f.status)}
        <h1>${esc(f.title)}</h1>
        ${f.tagline ? `<p class="tagline">${esc(f.tagline)}</p>` : ''}
        <div class="meta">${f.startDate ? `<span>${ICON.cal}${esc(fmtRange(f.startDate, f.endDate))}</span>` : ''}${f.location ? `<span>${ICON.pin}${esc(f.location)}</span>` : ''}<span>${ICON.users}${plural(f.attendeeCount, 'attendee', 'attendees')}</span></div>
      </div>
    </section>
    <div class="container detail-layout">
      <div>
        <div class="eyebrow">About</div>
        <h2 class="h2" style="font-size:30px;margin-bottom:14px">About the festival</h2>
        <p class="prose">${esc(f.description || 'More details coming soon.')}</p>
        ${f.highlights?.length ? `<h3 style="margin-top:34px;font-size:20px">What to expect</h3><div class="chips">${f.highlights.map((h) => `<span class="chip">✦ ${esc(h)}</span>`).join('')}</div>` : ''}
        ${f.awards.length ? `<h3 style="margin:40px 0 16px;font-size:20px">Awards shows at this festival</h3><div class="grid" style="gap:12px">${f.awards.map((a) => `<a class="list-row" href="#/award/${esc(a.id)}"><div class="thumb" style="display:grid;place-items:center">${trophySVG('mini-trophy" style="width:34px')}</div><div class="info"><b>${esc(a.title)}</b><small>${AWARD_STATUS[a.status]?.[0] || ''}</small></div><span class="btn btn-sm btn-gold">View →</span></a>`).join('')}</div>` : ''}
      </div>
      <aside class="card side-card">
        <div class="row"><span>Status</span>${badge(FEST_STATUS, f.status)}</div>
        <div class="row"><span>Dates</span><b>${esc(fmtRange(f.startDate, f.endDate) || 'TBA')}</b></div>
        <div class="row"><span>Location</span><b>${esc(f.location || 'TBA')}</b></div>
        <div class="row"><span>Attendees</span><b>${f.attendeeCount}</b></div>
        <div style="margin-top:18px">${
          f.status === 'ended'
            ? '<button class="btn btn-ghost" style="width:100%" disabled>This festival has ended</button>'
            : `<button class="btn ${f.attending ? 'btn-ghost' : 'btn-primary'} btn-lg" style="width:100%" id="attend">${f.attending ? '✓ You’re going · click to cancel' : 'I’m going! 🎟️'}</button>`
        }</div>
        ${me?.role === 'admin' ? `<a class="btn btn-ghost btn-sm" style="width:100%;margin-top:10px" href="#/admin/festival/${esc(f.id)}">✏️ Edit festival</a>` : ''}
      </aside>
    </div></div>`;
    const btn = $('#attend');
    if (btn) btn.onclick = async () => {
      if (!me) return (location.hash = '#/login?next=' + encodeURIComponent('/festival/' + f.id));
      btn.disabled = true;
      try {
        const r = await api('POST', `/api/festivals/${f.id}/attend`);
        Object.assign(f, r.festival);
        if (f.attending) { toast('You’re in! See you there 🎉'); confetti(90); } else toast('Your spot has been cancelled', 'info');
        draw();
      } catch (e) { toast(e.message, 'err'); btn.disabled = false; }
    };
  };
  draw();
}

// ───────────── AWARDS ─────────────
async function pageAwards() {
  const { awards } = await api('GET', '/api/awards');
  app.innerHTML = `<div class="page container">
    <div class="page-hero"><div class="eyebrow gold">The Game Awards</div><h1 class="h2">Awards <span class="gold-text">shows</span></h1><p class="lead">Every show: open for voting, waiting for the big reveal, or already in the history books.</p></div>
    ${awards.length ? `<div class="grid grid-2">${awards.map(awardCard).join('')}</div>` : emptyBlock('🏆', 'No awards shows yet', 'The first show is on its way.')}
    <div style="height:70px"></div></div>`;
}

async function pageAward(id) {
  let { award: a } = await api('GET', `/api/awards/${id}`);
  let celebrated = false;

  const draw = () => {
    const voting = a.status === 'voting';
    const announced = a.status === 'announced';
    const showResults = a.categories.some((c) => c.totalVotes !== null);
    const done = a.categories.filter((c) => c.myVote).length;
    const total = a.categories.length;
    const next = encodeURIComponent('/award/' + a.id);

    let banner = '';
    if (voting && !me) banner = `<div class="status-banner"><span class="ic">🗳️</span><div><b>Voting is open!</b><p>To vote, <a href="#/login?next=${next}" style="color:var(--cyan);font-weight:700">log in</a> or <a href="#/register?next=${next}" style="color:var(--cyan);font-weight:700">create an account</a>.</p></div></div>`;
    else if (voting) banner = `<div class="status-banner"><span class="ic">🗳️</span><div style="flex:1"><b>${done === total ? 'You voted in every category! 🎉' : `You’ve voted in ${done} of ${total} categories`}</b><p>Click a nominee to vote. You can change your pick until voting closes.</p><div class="progress"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div></div></div>`;
    else if (a.status === 'closed') banner = `<div class="status-banner gray"><span class="ic">🔒</span><div><b>Voting is closed</b><p>The votes are being counted… Winners will be revealed at the ceremony${a.ceremonyDate ? ' on ' + esc(fmtDateTime(a.ceremonyDate)) : ''}.</p></div></div>`;
    else if (announced) banner = `<div class="status-banner gold"><span class="ic">🏆</span><div><b>The winners are in!</b><p>Thanks to all ${plural(a.voterCount, 'voter', 'voters')}. Here are the full results.</p></div></div>`;
    else if (a.status === 'draft') banner = `<div class="status-banner gray"><span class="ic">📝</span><div><b>Draft: only admins can see this page</b><p>Change the status in the admin panel to publish it.</p></div></div>`;

    app.innerHTML = `<div class="page">
    <section class="award-hero"><div class="container">
      <a class="back-link" href="#/awards">${ICON.back} All awards shows</a>
      ${trophySVG('trophy-sm')}
      <div style="margin-bottom:12px">${badge(AWARD_STATUS, a.status)}</div>
      <h1>${esc(a.title)}</h1>
      ${a.tagline ? `<p class="tagline">${esc(a.tagline)}</p>` : ''}
      <div class="meta">
        ${a.ceremonyDate ? `<span>${ICON.cal}${esc(fmtDateTime(a.ceremonyDate))}</span>` : ''}
        ${a.festivalTitle ? `<a href="#/festival/${esc(a.festivalId)}" style="display:inline-flex;gap:6px;align-items:center">🎪 ${esc(a.festivalTitle)}</a>` : ''}
        <span>${ICON.grid}${plural(total, 'category', 'categories')}</span><span>${ICON.vote}${plural(a.voterCount, 'voter', 'voters')}</span>
      </div>
      ${a.description ? `<p class="lead" style="margin:18px auto 0;text-align:center">${esc(a.description)}</p>` : ''}
      ${banner}
      ${me?.role === 'admin' ? `<div style="margin-top:18px"><a class="btn btn-ghost btn-sm" href="#/admin/award/${esc(a.id)}">✏️ Edit awards show</a></div>` : ''}
    </div></section>
    ${total ? `<nav class="cat-nav"><div class="container"><div class="cat-nav-inner">${a.categories.map((c) => `<a class="cat-pill ${voting && c.myVote ? 'done' : ''}" href="javascript:void 0" data-jump="${esc(c.id)}">${esc(c.name)}</a>`).join('')}</div></div></nav>` : ''}
    <div class="container">
      ${total ? a.categories.map((c, i) => categoryBlock(c, i, voting, showResults)).join('') : emptyBlock('📋', 'No categories yet', 'Categories will be announced soon.')}
      <div style="height:70px"></div>
    </div></div>`;

    $$('[data-jump]').forEach((p) => (p.onclick = () => document.getElementById('cat-' + p.dataset.jump)?.scrollIntoView({ behavior: 'smooth' })));
    $$('.nominee.votable').forEach((el) => (el.onclick = () => vote(el.dataset.cat, el.dataset.nom)));
    if (announced && !celebrated) { celebrated = true; setTimeout(() => confetti(220), 400); }
  };

  async function vote(catId, nomId) {
    if (!me) return (location.hash = '#/login?next=' + encodeURIComponent('/award/' + a.id));
    const cat = a.categories.find((c) => c.id === catId);
    const removing = cat.myVote === nomId;
    const y = scrollY;
    try {
      const r = await api('POST', `/api/awards/${a.id}/vote`, { categoryId: catId, nomineeId: removing ? null : nomId });
      a = r.award;
      draw();
      scrollTo({ top: y, behavior: 'instant' });
      reveal();
      if (removing) toast('Vote removed', 'info');
      else {
        const n = cat.nominees.find((x) => x.id === nomId);
        toast(`You voted for ${n.name} · ${cat.name}`, 'gold');
        if (a.categories.every((c) => c.myVote)) { confetti(); toast('You voted in every category. Thank you! 🎉', 'gold'); }
        else {
          const idx = a.categories.findIndex((c) => c.id === catId);
          const nextCat = a.categories.slice(idx + 1).find((c) => !c.myVote);
          if (nextCat) setTimeout(() => document.getElementById('cat-' + nextCat.id)?.scrollIntoView({ behavior: 'smooth' }), 450);
        }
      }
    } catch (e) { toast(e.message, 'err'); }
  }
  draw();
}

function categoryBlock(c, i, voting, showResults) {
  const hasWinner = !!c.winnerId;
  const max = Math.max(1, ...c.nominees.map((n) => n.votes || 0));
  return `<section class="category" id="cat-${esc(c.id)}">
    <div class="category-head"><div><h2><span class="num">${String(i + 1).padStart(2, '0')}</span>${esc(c.name)}</h2>${c.description ? `<p>${esc(c.description)}</p>` : ''}</div>
    ${showResults ? `<span class="badge plain gray">${plural(c.totalVotes, 'vote', 'votes')}</span>` : voting && c.myVote ? '<span class="badge green">Voted ✓</span>' : ''}</div>
    ${c.nominees.length ? `<div class="nominees">${c.nominees.map((n) => {
      const isWin = hasWinner && c.winnerId === n.id;
      const pct = showResults && c.totalVotes ? Math.round(((n.votes || 0) / c.totalVotes) * 100) : 0;
      const cls = ['nominee', 'reveal', voting ? 'votable' : '', c.myVote === n.id ? 'selected' : '', isWin ? 'winner' : '', hasWinner && !isWin ? 'loser' : ''].join(' ');
      return `<${voting ? 'button' : 'div'} class="${cls}" data-cat="${esc(c.id)}" data-nom="${esc(n.id)}" ${voting ? `aria-pressed="${c.myVote === n.id}"` : ''}>
        ${isWin ? '<span class="winner-tag">🏆 WINNER</span>' : ''}
        <span class="vote-tag">✓ Your vote</span>
        <div class="n-img">${n.image ? `<img src="${esc(n.image)}" alt="" loading="lazy" />` : `<div class="n-fallback">${esc(n.name)}</div>`}</div>
        <div class="n-body">
          <h3>${esc(n.name)}</h3>
          ${n.studio ? `<span class="studio">${esc(n.studio)}</span>` : ''}
          ${n.blurb ? `<p class="blurb">${esc(n.blurb)}</p>` : ''}
          ${showResults ? `<div class="n-bar"><div class="row"><span>${plural(n.votes, 'vote', 'votes')}</span><b>${pct}%</b></div><div class="progress"><i style="width:${((n.votes || 0) / max) * 100}%;${isWin ? 'background:linear-gradient(90deg,#fff0b8,var(--gold),var(--gold-2))' : ''}"></i></div></div>` : ''}
        </div>
      </${voting ? 'button' : 'div'}>`;
    }).join('')}</div>` : '<p class="muted">Nominees coming soon.</p>'}
  </section>`;
}

// ───────────── AUTH ─────────────
function nextParam() {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const n = q.get('next');
  return n && n.startsWith('/') ? '#' + n : '#/';
}

async function pageAuth(mode) {
  if (me) { location.hash = nextParam(); return; }
  const isLogin = mode === 'login';
  const qs = location.hash.includes('?') ? '?' + location.hash.split('?')[1] : '';
  app.innerHTML = `<div class="page auth-wrap">
    <div class="auth-art"><img class="logo" src="/assets/logo.jpg" alt="MAN studio" /><p class="quote">“Every great game started with one person who believed in it.”</p></div>
    <div class="auth-form-side"><form class="auth-box" id="auth-form" novalidate>
      <div class="eyebrow ${isLogin ? '' : 'pink'}">${isLogin ? 'Welcome back' : 'Join the show'}</div>
      <h1>${isLogin ? 'Welcome <span class="grad-text">back</span>' : 'Create an <span class="grad-text">account</span>'}</h1>
      <p>${isLogin ? 'Log in to vote, sign up for festivals and follow the results.' : 'It takes a second, and then you’re in. Your vote is waiting.'}</p>
      <div id="auth-err"></div>
      <label class="field"><span>Username</span><input class="input" name="username" autocomplete="username" required minlength="3" maxlength="24" /></label>
      ${isLogin ? '' : '<label class="field"><span>Display name</span><input class="input" name="displayName" maxlength="40" /><small>Optional. You can change it later.</small></label>'}
      <label class="field"><span>Password</span><div class="pw-wrap"><input class="input" type="password" name="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" required minlength="${isLogin ? 1 : 6}" placeholder="${isLogin ? '' : 'At least 6 characters'}" /><button type="button" class="pw-toggle">Show</button></div></label>
      <button class="btn btn-primary btn-lg" style="width:100%;margin-top:6px" type="submit">${isLogin ? 'Log in' : 'Create account ✦'}</button>
      <p class="form-foot">${isLogin ? `Don’t have an account? <a href="#/register${esc(qs)}">Sign up</a>` : `Already have an account? <a href="#/login${esc(qs)}">Log in</a>`}</p>
    </form></div></div>`;
  const form = $('#auth-form');
  $('.pw-toggle', form).onclick = (e) => {
    const inp = $('[name=password]', form);
    inp.type = inp.type === 'password' ? 'text' : 'password';
    e.target.textContent = inp.type === 'password' ? 'Show' : 'Hide';
  };
  $('[name=username]', form).focus();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const btn = $('[type=submit]', form);
    btn.disabled = true;
    try {
      const r = await api('POST', isLogin ? '/api/login' : '/api/register', data);
      me = r.user;
      renderNavUser();
      toast(isLogin ? `Welcome back, ${me.displayName}!` : `Welcome to the community, ${me.displayName}! 🎉`, isLogin ? 'ok' : 'gold');
      if (!isLogin) confetti(120);
      const next = nextParam();
      location.hash = me.role === 'admin' && next === '#/' ? '#/admin' : next;
    } catch (err) {
      $('#auth-err').innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
      btn.disabled = false;
    }
  };
}

// ───────────── PROFILE ─────────────
async function pageProfile() {
  if (!me) { location.hash = '#/login?next=/profile'; return; }
  const { votes } = await api('GET', '/api/me/votes');
  app.innerHTML = `<div class="page container" style="padding-top:44px;padding-bottom:70px">
    <div class="card profile-head reveal"><i class="avatar lg ${me.role === 'admin' ? 'av-admin' : ''}">${initials(me.displayName)}</i>
      <div style="flex:1"><h1>${esc(me.displayName)}</h1><span class="muted">@${esc(me.username)}</span> ${me.role === 'admin' ? '<span class="badge gold" style="margin-inline-start:8px">Admin</span>' : ''}<div class="muted" style="font-size:14px;margin-top:4px">Member since ${esc(fmtDate(me.createdAt))}</div></div>
      ${me.role === 'admin' ? '<a class="btn btn-gold" href="#/admin">⚙️ Admin panel</a>' : ''}
    </div>
    <div class="detail-layout" style="padding:0">
      <div class="card panel reveal"><h3>🗳️ My votes <span class="badge plain gray">${votes.length}</span></h3>
        ${votes.length ? `<div class="vote-list">${votes.map((v) => `<a class="vote-item" href="#/award/${esc(v.awardId)}"><div class="thumb">${v.image ? `<img src="${esc(v.image)}" alt=""/>` : ''}</div><div class="info"><b>${esc(v.nominee)}</b><small>${esc(v.category)} · ${esc(v.awardTitle)}</small></div>${v.won ? '<span class="badge gold">Won! 🏆</span>' : ''}</a>`).join('')}</div>` : emptyBlock('🗳️', 'No votes yet', 'Head over to the awards shows and make your voice heard.')}
      </div>
      <div>
        <form class="card panel reveal" id="name-form"><h3>Display name</h3><label class="field"><input class="input" name="displayName" value="${esc(me.displayName)}" maxlength="40" required /></label><button class="btn btn-primary btn-sm">Save</button></form>
        ${passwordForm()}
      </div>
    </div></div>`;
  $('#name-form').onsubmit = async (e) => {
    e.preventDefault();
    try { const r = await api('PUT', '/api/me', Object.fromEntries(new FormData(e.target))); me = r.user; renderNavUser(); toast('Name updated'); router(); }
    catch (err) { toast(err.message, 'err'); }
  };
  bindPasswordForm();
}

const passwordForm = () => `<form class="card panel reveal" id="pw-form"><h3>🔒 Change password</h3>
  <label class="field"><span>Current password</span><input class="input" type="password" name="current" autocomplete="current-password" required /></label>
  <label class="field"><span>New password</span><input class="input" type="password" name="next" autocomplete="new-password" minlength="6" required /></label>
  <button class="btn btn-primary btn-sm">Update password</button></form>`;
function bindPasswordForm() {
  $('#pw-form').onsubmit = async (e) => {
    e.preventDefault();
    try { await api('POST', '/api/me/password', Object.fromEntries(new FormData(e.target))); e.target.reset(); toast('Password updated 🔒'); }
    catch (err) { toast(err.message, 'err'); }
  };
}

// ───────────── ADMIN ─────────────
async function pageAdmin(tab = 'overview', id) {
  if (!me) { location.hash = '#/login?next=/admin'; return; }
  if (me.role !== 'admin') return pageNotFound('The admin panel is for admins only');
  const tabs = [
    ['overview', '📊', 'Overview'],
    ['festivals', '🎪', 'Festivals'],
    ['awards', '🏆', 'Awards shows'],
    ['users', '👥', 'Users'],
    ['settings', '🔒', 'Settings'],
  ];
  const activeTab = tab === 'festival' ? 'festivals' : tab === 'award' ? 'awards' : tab;
  app.innerHTML = `<div class="page container admin">
    <aside class="card admin-side">
      <div class="who"><i class="avatar av-admin">${initials(me.displayName)}</i><div><b>${esc(me.displayName)}</b><small>ADMIN</small></div></div>
      ${tabs.map(([k, ic, l]) => `<a class="admin-tab ${k === activeTab ? 'active' : ''}" href="#/admin/${k}"><span class="ic">${ic}</span>${l}</a>`).join('')}
    </aside>
    <section class="admin-main" id="admin-main"><div class="loader" style="min-height:300px"><div class="ring"></div></div></section>
  </div>`;
  const main = $('#admin-main');
  const views = { overview: adminOverview, festivals: adminFestivals, festival: adminFestivalEditor, awards: adminAwards, award: adminAwardEditor, users: adminUsers, settings: adminSettings };
  await (views[tab] || adminOverview)(main, id);
}

async function adminOverview(main) {
  const { stats, recentUsers } = await api('GET', '/api/admin/overview');
  const { awards } = await api('GET', '/api/awards');
  main.innerHTML = `
    <div class="admin-top"><div><h1>Hi, <span class="gold-text">${esc(me.displayName)}</span> 👋</h1><p>Here’s what’s happening on MAN STUDIO AWARDS</p></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-primary" href="#/admin/festival/new">+ New festival</a><a class="btn btn-gold" href="#/admin/award/new">+ New awards show</a></div></div>
    <div class="kpis">
      ${[['👥', stats.users, 'Users', 'var(--cyan)'], ['🎪', stats.festivals, 'Festivals', 'var(--pink)'], ['🏆', stats.awards, 'Awards shows', 'var(--gold)'], ['🗳️', stats.votes, 'Votes cast', 'var(--green)'], ['✋', stats.voters, 'Voters', 'var(--cyan)'], ['🎟️', stats.attendees, 'Festival sign-ups', 'var(--pink)']]
        .map(([ic, v, l, c]) => `<div class="card kpi reveal"><span class="ic">${ic}</span><b style="color:${c}">${v}</b><span>${l}</span></div>`).join('')}
    </div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
      <div class="card panel reveal"><h3>Awards shows <a class="btn btn-ghost btn-sm" href="#/admin/awards">View all</a></h3>
        ${awards.length ? awards.slice(0, 5).map((a) => `<a class="list-row" href="#/admin/award/${esc(a.id)}"><div class="info"><b>${esc(a.title)}</b><small>${plural(a.categoryCount, 'category', 'categories')} · ${plural(a.voterCount, 'voter', 'voters')}</small></div>${badge(AWARD_STATUS, a.status)}</a>`).join('') : '<p class="muted">No awards shows yet.</p>'}
      </div>
      <div class="card panel reveal"><h3>Newest members <a class="btn btn-ghost btn-sm" href="#/admin/users">View all</a></h3>
        ${recentUsers.map((u) => `<div class="list-row"><i class="avatar ${u.role === 'admin' ? 'av-admin' : ''}">${initials(u.displayName)}</i><div class="info"><b>${esc(u.displayName)}</b><small>@${esc(u.username)}</small></div><small class="muted">${esc(fmtDate(u.createdAt, { day: 'numeric', month: 'short' }))}</small></div>`).join('')}
      </div>
    </div>`;
}

async function adminFestivals(main) {
  const { festivals } = await api('GET', '/api/admin/festivals');
  main.innerHTML = `
    <div class="admin-top"><div><h1>🎪 Festivals</h1><p>Open, edit and delete festivals</p></div><a class="btn btn-primary" href="#/admin/festival/new">+ Open a new festival</a></div>
    ${festivals.length ? festivals.map((f) => `<div class="list-row reveal">
      <div class="thumb">${coverHTML(f.cover, f.title, f.accent)}</div>
      <div class="info"><b>${esc(f.title)}</b><small>${esc(fmtRange(f.startDate, f.endDate) || 'No date')} · ${plural(f.attendeeCount, 'attendee', 'attendees')}</small></div>
      ${badge(FEST_STATUS, f.status)}
      <div class="actions"><a class="btn btn-ghost btn-sm" href="#/festival/${esc(f.id)}">View</a><a class="btn btn-primary btn-sm" href="#/admin/festival/${esc(f.id)}">Edit</a><button class="btn btn-danger btn-sm" data-del="${esc(f.id)}" data-name="${esc(f.title)}">Delete</button></div>
    </div>`).join('') : emptyBlock('🎪', 'No festivals yet', 'Click “Open a new festival” to get started.')}`;
  $$('[data-del]', main).forEach((b) => (b.onclick = async () => {
    if (!(await confirmModal({ title: 'Delete this festival?', text: `“${b.dataset.name}” and its attendee list will be permanently deleted. Linked awards shows will be kept.`, ok: 'Delete', danger: true }))) return;
    try { await api('DELETE', `/api/admin/festivals/${b.dataset.del}`); toast('Festival deleted'); adminFestivals(main).then(reveal); }
    catch (e) { toast(e.message, 'err'); }
  }));
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file selected'));
    if (file.size > 8 * 1024 * 1024) return reject(new Error('Image is larger than 8MB'));
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read the file'));
    r.readAsDataURL(file);
  });
}
async function uploadImage(file) {
  const data = await readImage(file);
  const { url } = await api('POST', '/api/admin/upload', { data });
  return url;
}
function pickFile() {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/png,image/jpeg,image/webp,image/gif';
    inp.onchange = () => resolve(inp.files[0]);
    inp.click();
  });
}

const UNSAVED = 'You have unsaved changes. Leave anyway?';

async function adminFestivalEditor(main, id) {
  const isNew = !id || id === 'new';
  let f = isNew
    ? { title: '', tagline: '', description: '', location: '', startDate: '', endDate: '', cover: '', accent: '#22e4ff', status: 'upcoming', highlights: [], attendeeCount: 0 }
    : (await api('GET', `/api/festivals/${id}`)).festival;
  let dirty = false;
  leaveGuard = (silent) => !dirty || (!silent && confirm(UNSAVED));

  main.innerHTML = `
    <a class="back-link" href="#/admin/festivals">${ICON.back} Back to festivals</a>
    <div class="admin-top"><div><h1>${isNew ? '🎪 New festival' : '✏️ Edit festival'}</h1><p>${isNew ? 'Fill in the details. The preview updates live.' : esc(f.title)}</p></div></div>
    <div class="editor-layout">
      <form id="fest-form" class="card panel" novalidate>
        <div class="form-grid">
          <label class="field full"><span>Festival name *</span><input class="input" name="title" required maxlength="120" value="${esc(f.title)}" /></label>
          <label class="field full"><span>Tagline</span><input class="input" name="tagline" maxlength="200" value="${esc(f.tagline)}" placeholder="One line that sells it" /></label>
          <label class="field full"><span>Description</span><textarea class="textarea" name="description" maxlength="4000" placeholder="What’s happening, who it’s for, why come…">${esc(f.description)}</textarea></label>
          <label class="field"><span>Start date</span><input class="input" type="date" name="startDate" value="${esc(f.startDate)}" /></label>
          <label class="field"><span>End date</span><input class="input" type="date" name="endDate" value="${esc(f.endDate)}" /></label>
          <label class="field"><span>Location</span><input class="input" name="location" maxlength="120" value="${esc(f.location)}" /></label>
          <label class="field"><span>Status</span><select class="select" name="status">${Object.entries(FEST_STATUS).map(([k, [l]]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="field full"><span>Highlights</span><input class="input" name="highlights" value="${esc((f.highlights || []).join(', '))}" /><small>Separate with commas</small></label>
          <div class="field full"><span>Cover image</span>
            <div class="cover-pick"><div class="preview" id="cover-prev">${f.cover ? `<img src="${esc(f.cover)}" alt=""/>` : 'No image'}</div>
            <div class="grow"><button type="button" class="btn btn-ghost btn-sm" id="cover-up">⬆ Upload image</button><input class="input" name="cover" value="${esc(f.cover)}" placeholder="…or paste an image link (https://…)" /></div></div>
          </div>
          <label class="field"><span>Accent color</span><input class="input" type="color" name="accent" value="${esc(f.accent)}" /></label>
        </div>
        <div class="sticky-save"><span class="muted" id="dirty-note">${isNew ? '' : 'All changes saved'}</span><div style="display:flex;gap:10px">${isNew ? '' : `<a class="btn btn-ghost" href="#/festival/${esc(f.id)}">View page</a>`}<button class="btn btn-primary" type="submit">${isNew ? '🚀 Open festival' : '💾 Save'}</button></div></div>
      </form>
      <div><div class="eyebrow">Live preview</div><div id="fest-preview"></div></div>
    </div>`;
  const form = $('#fest-form', main);
  const collect = () => {
    const d = Object.fromEntries(new FormData(form));
    d.highlights = String(d.highlights || '').split(',').map((s) => s.trim()).filter(Boolean);
    return d;
  };
  const preview = () => {
    const d = { ...f, ...collect(), id: f.id || 'preview', attending: false, attendeeCount: f.attendeeCount || 0 };
    if (!d.title) d.title = 'Festival name';
    $('#fest-preview').innerHTML = festivalCard(d).replace('reveal', '').replace(/href="[^"]*"/, '');
    $('#cover-prev').innerHTML = d.cover ? `<img src="${esc(d.cover)}" alt=""/>` : 'No image';
  };
  form.oninput = () => { dirty = true; $('#dirty-note').textContent = '● Unsaved changes'; preview(); };
  $('#cover-up').onclick = async () => {
    const file = await pickFile();
    if (!file) return;
    try { toast('Uploading image…', 'info'); form.cover.value = await uploadImage(file); form.oninput(); toast('Image uploaded'); }
    catch (e) { toast(e.message, 'err'); }
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const d = collect();
    if (!d.title.trim()) { toast('The festival needs a name', 'err'); form.title.focus(); return; }
    try {
      const r = isNew ? await api('POST', '/api/admin/festivals', d) : await api('PUT', `/api/admin/festivals/${f.id}`, d);
      dirty = false;
      leaveGuard = null;
      if (isNew) { toast('Festival is open! 🎉', 'gold'); confetti(120); location.hash = `#/admin/festival/${r.festival.id}`; }
      else { f = r.festival; toast('Saved ✓'); $('#dirty-note').textContent = 'All changes saved'; }
    } catch (err) { toast(err.message, 'err'); }
  };
  preview();
}

async function adminAwards(main) {
  const { awards } = await api('GET', '/api/awards');
  main.innerHTML = `
    <div class="admin-top"><div><h1>🏆 Awards shows</h1><p>Create Game Awards: categories, nominees and winners</p></div><a class="btn btn-gold" href="#/admin/award/new">+ New awards show</a></div>
    ${awards.length ? awards.map((a) => `<div class="list-row reveal">
      <div class="thumb" style="display:grid;place-items:center;background:radial-gradient(circle at 50% 120%,rgba(255,196,70,.4),transparent 60%),#0a0c33">${trophySVG('mini-trophy" style="width:30px')}</div>
      <div class="info"><b>${esc(a.title)}</b><small>${plural(a.categoryCount, 'category', 'categories')} · ${plural(a.nomineeCount, 'nomination', 'nominations')} · ${plural(a.voterCount, 'voter', 'voters')}</small></div>
      ${badge(AWARD_STATUS, a.status)}
      <div class="actions"><a class="btn btn-ghost btn-sm" href="#/award/${esc(a.id)}">View</a><a class="btn btn-primary btn-sm" href="#/admin/award/${esc(a.id)}">Edit</a><button class="btn btn-danger btn-sm" data-del="${esc(a.id)}" data-name="${esc(a.title)}">Delete</button></div>
    </div>`).join('') : emptyBlock('🏆', 'No awards shows yet', 'Click “New awards show” to get started.')}`;
  $$('[data-del]', main).forEach((b) => (b.onclick = async () => {
    if (!(await confirmModal({ title: 'Delete this awards show?', text: `“${b.dataset.name}” will be permanently deleted, including all categories and votes.`, ok: 'Delete', danger: true }))) return;
    try { await api('DELETE', `/api/admin/awards/${b.dataset.del}`); toast('Awards show deleted'); adminAwards(main).then(reveal); }
    catch (e) { toast(e.message, 'err'); }
  }));
}

const tmpId = () => 'n' + Math.random().toString(36).slice(2, 9);
const AWARD_STATUS_DESC = {
  draft: 'Only admins can see it',
  voting: 'The community votes',
  closed: 'No voting, no results',
  announced: 'Winners and results are public',
};

async function adminAwardEditor(main, id) {
  const isNew = !id || id === 'new';
  const { festivals } = await api('GET', '/api/admin/festivals');
  let a = isNew
    ? { title: '', year: new Date().getFullYear(), tagline: '', description: '', ceremonyDate: '', festivalId: '', cover: '', status: 'draft', categories: [] }
    : (await api('GET', `/api/admin/awards/${id}`)).award;
  let dirty = false;
  leaveGuard = (silent) => !dirty || (!silent && confirm(UNSAVED));
  const markDirty = () => { dirty = true; const n = $('#dirty-note'); if (n) n.textContent = '● Unsaved changes'; };

  const nomRow = (c, n) => `<div class="editor-nom ${c.winnerId === n.id ? 'is-winner' : ''}" data-nom="${esc(n.id)}">
      <div class="img-pick" data-img title="Click to upload an image">${n.image ? `<img src="${esc(n.image)}" alt=""/>` : '+ Image'}</div>
      <input class="input" data-k="name" value="${esc(n.name)}" placeholder="Game / nominee name" maxlength="80" />
      <input class="input" data-k="studio" value="${esc(n.studio)}" placeholder="Studio / creator" maxlength="80" />
      <div class="nom-actions">
        ${!isNew && n.votes != null ? `<span class="vcount" title="Votes">${n.votes} 🗳️</span>` : ''}
        <button type="button" class="win-btn ${c.winnerId === n.id ? 'on' : ''}" data-win>${c.winnerId === n.id ? '🏆 Winner' : 'Set as winner'}</button>
        ${n.image ? `<button type="button" class="icon-btn" data-clearimg title="Remove image">🖼️</button>` : ''}
        <button type="button" class="icon-btn danger" data-delnom title="Delete nominee">${ICON.trash}</button>
      </div>
      <input class="input" data-k="blurb" value="${esc(n.blurb || '')}" placeholder="Short line about the nominee (optional)" maxlength="200" style="grid-column:2 / -1" />
    </div>`;

  const catBlock = (c, i) => `<div class="editor-cat" data-cat="${esc(c.id)}">
      <div class="editor-cat-head">
        <span class="num">${String(i + 1).padStart(2, '0')}</span>
        <input class="input" data-ck="name" value="${esc(c.name)}" placeholder="Category name" maxlength="80" />
        <button type="button" class="icon-btn" data-mv="-1" title="Move up" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button>
        <button type="button" class="icon-btn" data-mv="1" title="Move down" ${i === a.categories.length - 1 ? 'disabled' : ''}>${ICON.down}</button>
        <button type="button" class="icon-btn danger" data-delcat title="Delete category">${ICON.trash}</button>
      </div>
      <input class="input" data-ck="description" value="${esc(c.description)}" placeholder="Short category description (optional)" maxlength="300" />
      <div class="editor-nominees">${c.nominees.map((n) => nomRow(c, n)).join('')}</div>
      <button type="button" class="btn btn-ghost btn-sm" data-addnom style="margin-top:12px">+ Add nominee</button>
    </div>`;

  const drawCats = () => {
    $('#cats').innerHTML = a.categories.length ? a.categories.map(catBlock).join('') : emptyBlock('📋', 'No categories yet', 'Add your first category.');
    $('#cat-count').textContent = `${plural(a.categories.length, 'category', 'categories')} · ${plural(a.categories.reduce((s, c) => s + c.nominees.length, 0), 'nomination', 'nominations')}`;
  };
  const drawStatus = () => {
    $('#status-picker').innerHTML = Object.entries(AWARD_STATUS).map(([k, [l]]) => `<button type="button" class="status-opt ${a.status === k ? 'on' : ''} ${k === 'announced' ? 'gold' : ''}" data-status="${k}"><b>${l}</b><small>${AWARD_STATUS_DESC[k]}</small></button>`).join('');
  };

  main.innerHTML = `
    <a class="back-link" href="#/admin/awards">${ICON.back} Back to awards shows</a>
    <div class="admin-top"><div><h1>${isNew ? '🏆 New awards show' : '✏️ Edit awards show'}</h1><p>${isNew ? 'Build your Game Awards: details, categories and nominees' : esc(a.title)}</p></div>
      ${isNew ? '' : `<a class="btn btn-ghost" href="#/award/${esc(a.id)}">👁️ View show page</a>`}</div>
    <form id="award-form" novalidate>
      <div class="card panel"><h3>Show details</h3>
        <div class="form-grid">
          <label class="field full"><span>Show name *</span><input class="input" name="title" required maxlength="120" value="${esc(a.title)}" /></label>
          <label class="field"><span>Year</span><input class="input" type="number" name="year" min="2000" max="2100" value="${esc(a.year)}" /></label>
          <label class="field"><span>Ceremony date & time</span><input class="input" type="datetime-local" name="ceremonyDate" value="${esc(a.ceremonyDate)}" /></label>
          <label class="field full"><span>Tagline</span><input class="input" name="tagline" maxlength="200" value="${esc(a.tagline)}" /></label>
          <label class="field full"><span>Description</span><textarea class="textarea" name="description" maxlength="4000">${esc(a.description)}</textarea></label>
          <label class="field"><span>Festival</span><select class="select" name="festivalId"><option value="">None</option>${festivals.map((f) => `<option value="${esc(f.id)}" ${a.festivalId === f.id ? 'selected' : ''}>${esc(f.title)}</option>`).join('')}</select></label>
          <div class="field"><span>Cover image (optional)</span><div style="display:flex;gap:8px"><input class="input" name="cover" value="${esc(a.cover)}" placeholder="Paste a link or upload" /><button type="button" class="btn btn-ghost btn-sm" id="cover-up">⬆</button></div></div>
        </div>
      </div>
      <div class="card panel"><h3>Show status</h3><div class="status-picker" id="status-picker"></div></div>
      <div class="card panel"><h3><span>Categories & nominees <small class="muted" id="cat-count" style="font-weight:500;font-size:14px"></small></span>
        <span style="display:flex;gap:8px;flex-wrap:wrap">${isNew ? '' : '<button type="button" class="btn btn-gold btn-sm" id="auto-win">🏆 Pick winners by votes</button><button type="button" class="btn btn-danger btn-sm" id="reset-votes">Reset votes</button>'}</span></h3>
        <div id="cats"></div>
        <button type="button" class="btn btn-primary" id="add-cat" style="margin-top:6px">+ Add category</button>
      </div>
      <div class="sticky-save"><span class="muted" id="dirty-note">${isNew ? '' : 'All changes saved'}</span><button class="btn btn-gold" type="submit">${isNew ? '🚀 Create show' : '💾 Save show'}</button></div>
    </form>`;
  drawStatus();
  drawCats();

  const form = $('#award-form', main);
  const catOf = (el) => a.categories.find((c) => c.id === el.closest('[data-cat]').dataset.cat);
  const nomOf = (el, c) => c.nominees.find((n) => n.id === el.closest('[data-nom]').dataset.nom);

  form.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.ck) catOf(t)[t.dataset.ck] = t.value;
    else if (t.dataset.k) { const c = catOf(t); nomOf(t, c)[t.dataset.k] = t.value; }
    markDirty();
  });

  form.addEventListener('click', async (e) => {
    const t = e.target.closest('button, [data-img]');
    if (!t) return;
    if (t.dataset.status) {
      a.status = t.dataset.status;
      drawStatus(); markDirty();
      if (a.status === 'announced') {
        const missing = a.categories.filter((c) => !c.winnerId).length;
        if (missing) toast(`Heads up: ${plural(missing, 'category has', 'categories have')} no winner yet`, 'info');
      }
      return;
    }
    if (t.id === 'add-cat') {
      a.categories.push({ id: tmpId(), name: '', description: '', winnerId: null, nominees: [{ id: tmpId(), name: '', studio: '', image: '', blurb: '' }] });
      drawCats(); markDirty();
      const blocks = $$('.editor-cat', main); const last = blocks[blocks.length - 1];
      last.scrollIntoView({ behavior: 'smooth', block: 'center' }); $('[data-ck=name]', last).focus();
      return;
    }
    if (t.id === 'cover-up') {
      const file = await pickFile(); if (!file) return;
      try { form.cover.value = await uploadImage(file); markDirty(); toast('Image uploaded'); } catch (err) { toast(err.message, 'err'); }
      return;
    }
    if (t.id === 'auto-win') {
      let n = 0;
      a.categories.forEach((c) => {
        const best = [...c.nominees].sort((x, y) => (y.votes || 0) - (x.votes || 0))[0];
        if (best && best.votes > 0) { c.winnerId = best.id; n++; }
      });
      drawCats(); markDirty();
      toast(n ? `Winners picked by votes in ${plural(n, 'category', 'categories')}. Don’t forget to save!` : 'No votes to count yet', n ? 'gold' : 'info');
      return;
    }
    if (t.id === 'reset-votes') {
      if (!(await confirmModal({ title: 'Reset all votes?', text: 'Every vote in this show will be permanently deleted. This can’t be undone.', ok: 'Reset', danger: true }))) return;
      try { await api('POST', `/api/admin/awards/${a.id}/reset-votes`); toast('Votes reset'); dirty = false; router(); } catch (err) { toast(err.message, 'err'); }
      return;
    }
    if (!t.closest('[data-cat]')) return;
    const c = catOf(t);
    if (t.dataset.delcat !== undefined) {
      if (c.nominees.length && !(await confirmModal({ title: 'Delete this category?', text: `“${c.name || 'Untitled'}” and its ${plural(c.nominees.length, 'nominee', 'nominees')} will be deleted when you save.`, ok: 'Delete', danger: true }))) return;
      a.categories = a.categories.filter((x) => x !== c);
    } else if (t.dataset.mv) {
      const i = a.categories.indexOf(c); const j = i + Number(t.dataset.mv);
      if (j < 0 || j >= a.categories.length) return;
      [a.categories[i], a.categories[j]] = [a.categories[j], a.categories[i]];
    } else if (t.dataset.addnom !== undefined) {
      c.nominees.push({ id: tmpId(), name: '', studio: '', image: '', blurb: '' });
      drawCats(); markDirty();
      const rows = $$(`[data-cat="${c.id}"] .editor-nom`, main); $('[data-k=name]', rows[rows.length - 1]).focus();
      return;
    } else if (t.dataset.delnom !== undefined) {
      const n = nomOf(t, c);
      c.nominees = c.nominees.filter((x) => x !== n);
      if (c.winnerId === n.id) c.winnerId = null;
    } else if (t.dataset.win !== undefined) {
      const n = nomOf(t, c);
      c.winnerId = c.winnerId === n.id ? null : n.id;
    } else if (t.dataset.clearimg !== undefined) {
      nomOf(t, c).image = '';
    } else if (t.dataset.img !== undefined) {
      const n = nomOf(t, c);
      const file = await pickFile(); if (!file) return;
      try { t.innerHTML = '…'; n.image = await uploadImage(file); toast('Image uploaded'); } catch (err) { toast(err.message, 'err'); }
    } else return;
    drawCats(); markDirty();
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    if (!d.title.trim()) { toast('The show needs a name', 'err'); form.title.focus(); return; }
    const payload = { ...d, status: a.status, categories: a.categories.map((c) => ({ ...c, nominees: c.nominees.map(({ votes, ...n }) => n) })) };
    try {
      const r = isNew ? await api('POST', '/api/admin/awards', payload) : await api('PUT', `/api/admin/awards/${a.id}`, payload);
      dirty = false; leaveGuard = null;
      if (isNew) { toast('Awards show created! 🏆', 'gold'); confetti(140); location.hash = `#/admin/award/${r.award.id}`; }
      else {
        a = r.award; drawCats(); drawStatus();
        $('#dirty-note').textContent = 'All changes saved';
        toast(a.status === 'announced' ? 'Saved. The winners are now public! 🏆' : 'Show saved ✓', a.status === 'announced' ? 'gold' : 'ok');
        if (a.status === 'announced') confetti();
      }
    } catch (err) { toast(err.message, 'err'); }
  };
}

async function adminUsers(main) {
  const { users } = await api('GET', '/api/admin/users');
  main.innerHTML = `
    <div class="admin-top"><div><h1>👥 Users</h1><p>${plural(users.length, 'registered user', 'registered users')}</p></div><input class="input" id="user-q" placeholder="Search users…" style="max-width:260px" /></div>
    <div class="card panel" style="overflow-x:auto"><table class="table"><thead><tr><th>User</th><th>Username</th><th>Role</th><th>Votes</th><th>Joined</th><th></th></tr></thead>
    <tbody>${users.map((u) => `<tr data-q="${esc((u.username + ' ' + u.displayName).toLowerCase())}">
      <td><div class="user-cell"><i class="avatar ${u.role === 'admin' ? 'av-admin' : ''}">${initials(u.displayName)}</i><b>${esc(u.displayName)}</b></div></td>
      <td class="muted">@${esc(u.username)}</td>
      <td>${u.role === 'admin' ? '<span class="badge gold">Admin</span>' : '<span class="badge plain gray">Member</span>'}</td>
      <td>${u.votes}</td><td class="muted">${esc(fmtDate(u.createdAt, { day: 'numeric', month: 'short', year: 'numeric' }))}</td>
      <td>${u.role === 'admin' ? '' : `<button class="btn btn-danger btn-sm" data-del="${esc(u.id)}" data-name="${esc(u.displayName)}">Delete</button>`}</td>
    </tr>`).join('')}</tbody></table></div>`;
  $('#user-q').oninput = (e) => { const q = e.target.value.trim().toLowerCase(); $$('tbody tr', main).forEach((tr) => (tr.hidden = q && !tr.dataset.q.includes(q))); };
  $$('[data-del]', main).forEach((b) => (b.onclick = async () => {
    if (!(await confirmModal({ title: 'Delete this user?', text: `${b.dataset.name} will be permanently deleted, along with all their votes and festival sign-ups.`, ok: 'Delete', danger: true }))) return;
    try { await api('DELETE', `/api/admin/users/${b.dataset.del}`); toast('User deleted'); adminUsers(main); } catch (e) { toast(e.message, 'err'); }
  }));
}

async function adminSettings(main) {
  main.innerHTML = `<div class="admin-top"><div><h1>🔒 Settings</h1><p>Admin account security</p></div></div>
    <div style="max-width:520px">${passwordForm()}
    <div class="card panel"><h3>ℹ️ About this account</h3><p class="muted" style="margin:0">The admin username is <b style="color:var(--gold)">${esc(me.username)}</b>. Only this account can access the admin panel. After changing the password, delete the ADMIN-PASSWORD.txt file from the project folder.</p></div></div>`;
  bindPasswordForm();
}

// ───────────── boot ─────────────
(async () => {
  try { me = (await api('GET', '/api/me')).user; } catch {}
  renderNavUser();
  router();
})();
})();
