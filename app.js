'use strict';
/* =====================================================================
   সংস্থা ব্যবস্থাপনা সিস্টেম — ফ্রন্টএন্ড
   ডেটা সংরক্ষিত হয় Google Sheet এ (Code.gs এর মাধ্যমে)
   ===================================================================== */

// ▼▼ এখানে আপনার Apps Script Web App URL বসান ▼▼
const API_URL = 'https://script.google.com/macros/s/AKfycbxgZOPwcGzB1blmHXEacgRPhGqI4MnjCPW6tZ4-xONPCtz172hvjQMWxgKy_rKzwSNW/exec';
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

const ID_PREFIX = 'ASP';   // সদস্য আইডির শুরু (Code.gs এর ID_PREFIX এর সাথে মিল রাখুন)
const CACHE_KEY = 'samity_cache_v2';
const S = { settings: {}, members: [], collections: [], special: [], expenses: [], notices: [] };
const PROTECTED = ['setup', 'committeeForm', 'noticeForm'];
let curPage = 'dashboard';

/* ---------- সহায়ক ফাংশন ---------- */
const $ = id => document.getElementById(id);
const BN = '০১২৩৪৫৬৭৮৯';
const bn = v => String(v == null ? '' : v).replace(/\d/g, d => BN[d]);
const en = v => String(v == null ? '' : v).replace(/[০-৯]/g, d => BN.indexOf(d));
const num = v => { const n = parseFloat(en(v).replace(/,/g, '')); return isNaN(n) ? 0 : n; };
const taka = v => '৳ ' + bn(num(v).toLocaleString('en-IN'));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const fdate = iso => { if (!iso) return ''; const p = String(iso).split('-'); return p.length === 3 ? bn(p[2] + '/' + p[1] + '/' + p[0]) : bn(iso); };
const parseJ = (s, d) => { try { return JSON.parse(s) || d; } catch (e) { return d; } };
const nextNo = (list, f) => list.reduce((m, x) => Math.max(m, parseInt(x[f]) || 0), 0) + 1;
const idNum = v => parseInt(String(v || '').replace(/\D/g, ''), 10) || 0;
const bySerial = (a, b) => idNum(a.memberId) - idNum(b.memberId);
const nextMemberId = () => ID_PREFIX + String(S.members.reduce((m, x) => Math.max(m, idNum(x.memberId)), 0) + 1).padStart(4, '0');
// শীটে id কলাম নেই; মেমোরিতে id = প্রথম কলামের নম্বর/আইডি
const KEYS = { members: 'memberId', collections: 'receiptNo', special: 'receiptNo', expenses: 'voucherNo', notices: 'noticeNo' };
const SHEET_KEY = { Members: 'memberId', Collections: 'receiptNo', Special: 'receiptNo', Expenses: 'voucherNo', Notices: 'noticeNo' };
function normalize() { Object.keys(KEYS).forEach(k => (S[k] || []).forEach(x => { x.id = x[KEYS[k]]; })); }
const byNoDesc = f => (a, b) => (parseInt(b[f]) || 0) - (parseInt(a[f]) || 0);
const findMember = id => S.members.find(m => m.id === id);
const upsert = (list, rec) => { const i = list.findIndex(x => x.id === rec.id); if (i < 0) list.push(rec); else list[i] = rec; };
const sum = (list, f) => list.reduce((s, x) => s + num(x[f]), 0);
const has = (q, arr) => arr.join(' ').toLowerCase().includes(q);
const query = id => en($(id).value || '').trim().toLowerCase();

/* ---------- আইকন ---------- */
const IC = {
  dash: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  org: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.5 3.5 0 010 7M18 14.3c2 .7 3.5 2.6 3.5 5.7"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>',
  committee: '<circle cx="12" cy="7" r="3"/><circle cx="5" cy="10" r="2.2"/><circle cx="19" cy="10" r="2.2"/><path d="M6.5 20c0-3.3 2.4-5.5 5.5-5.5s5.5 2.200 5.500 5.500M1.500 18c0-2.200 1.500-3.800 3.500-3.800M22.500 18c0-2.200-1.500-3.800-3.500-3.800"/>',
  bell: '<path d="M6 9a6 6 0 0112 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 004 0"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.900 4.900l2.100 2.100M17 17l2.100 2.100M4.900 19.100L7 17M17 7l2.100-2.100"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  chev: '<path d="M6 9l6 6 6-6"/>',
  print: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13.500 6.500l4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  pin: '<path d="M12 21s7-6.500 7-12a7 7 0 10-14 0c0 5.500 7 12 7 12z"/><circle cx="12" cy="9" r="2.500"/>',
  phone: '<path d="M5 4h4l2 5-2.500 1.500a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  link: '<path d="M10 14a4 4 0 005.700 0l3-3a4 4 0 00-5.700-5.700l-1 1M14 10a4 4 0 00-5.700 0l-3 3a4 4 0 005.700 5.700l1-1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chart: '<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.600 10.500l6.800-4M8.600 13.500l6.800 4"/>',
  wallet: '<path d="M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 7l12-3v3M16 13.500h2"/>'
};
const icon = (n, s = 20) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${IC[n] || ''}</svg>`;

/* ---------- টোস্ট / লোডার ---------- */
function toast(msg, err) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.className = 'toast'; }, 2800);
}
const busy = on => $('loader').classList.toggle('show', on);

/* ---------- সার্ভার যোগাযোগ ---------- */
const apiReady = () => API_URL.indexOf('http') === 0;

async function api(payload, quiet) {
  if (!apiReady()) { toast('app.js এ API_URL বসানো হয়নি', true); return null; }
  busy(true);
  try {
    const body = Object.assign({ pw: sessionStorage.getItem('pw') || '' }, payload);
    const r = await fetch(API_URL, { method: 'POST', body: JSON.stringify(body) });
    const j = await r.json();
    if (!j.ok) {
      if (j.code === 'AUTH') lockNow(true);
      if (!quiet) toast(j.error || 'সমস্যা হয়েছে', true);
      return null;
    }
    if (payload.action === 'save' && j.record) j.record.id = j.record[SHEET_KEY[payload.sheet]];
    return j;
  } catch (e) {
    if (!quiet) toast('সার্ভারের সাথে সংযোগ হয়নি', true);
    return null;
  } finally { busy(false); }
}

const DATA_KEYS = ['settings', 'members', 'collections', 'special', 'expenses', 'notices'];
function cacheSave() {
  try {
    const o = {}; DATA_KEYS.forEach(k => o[k] = S[k]);
    localStorage.setItem(CACHE_KEY, JSON.stringify(o));
  } catch (e) { /* ক্যাশ পূর্ণ হলে উপেক্ষা */ }
}

async function loadData() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (c) DATA_KEYS.forEach(k => { if (c[k]) S[k] = c[k]; });
  } catch (e) { /* ignore */ }
  normalize();
  refreshAll();
  if (!apiReady()) { toast('app.js এ API_URL বসানো হয়নি', true); return; }
  busy(true);
  try {
    const r = await fetch(API_URL + '?action=getAll');
    const j = await r.json();
    if (j.ok) { DATA_KEYS.forEach(k => S[k] = j[k] || (k === 'settings' ? {} : [])); normalize(); cacheSave(); refreshAll(); }
    else toast(j.error || 'ডেটা লোড হয়নি', true);
  } catch (e) { toast('সার্ভারের সাথে সংযোগ হয়নি', true); }
  finally { busy(false); }
}

/* ---------- সাইডমেনু ---------- */
const MENU = [
  { id: 'dashboard', t: 'ড্যাশবোর্ড', i: 'dash' },
  { id: 'about', t: 'সংস্থা তথ্য', i: 'org' },
  { g: 'members', t: 'সদস্য', i: 'users', ch: [{ id: 'memberEntry', t: 'সদস্য এন্ট্রি ফরম' }, { id: 'collection', t: 'সদস্য চাঁদা আদায়' }] },
  { id: 'special', t: 'বিশেষ', i: 'star' },
  { id: 'expense', t: 'খরচ', i: 'receipt' },
  { g: 'reports', t: 'রিপোর্ট', i: 'chart', ch: [{ id: 'report', t: 'শর্ট রিপোর্ট' }, { id: 'cashReport', t: 'ক্যাশ রিপোর্ট' }, { id: 'ledger', t: 'লেজার' }] },
  { id: 'committee', t: 'কমিটি', i: 'committee' },
  { id: 'notices', t: 'নোটিশ', i: 'bell' },
  { g: 'admin', t: 'ব্যবস্থাপনা', i: 'gear', lock: true, ch: [{ id: 'setup', t: 'সেটাপ ফরম' }, { id: 'committeeForm', t: 'কমিটি ফরম' }, { id: 'noticeForm', t: 'নোটিশ ফরম' }] }
];

function buildMenu() {
  $('menu').innerHTML = MENU.map(m => m.g
    ? `<div class="mg" id="mg-${m.g}">
         <button class="mi" onclick="toggleGroup('${m.g}')">${icon(m.i)}<span>${m.t}</span>${m.lock ? `<span class="lk">${icon('lock', 15)}</span>` : ''}<span class="chev">${icon('chev', 18)}</span></button>
         <div class="sub">${m.ch.map(c => `<button class="si" data-pg="${c.id}" onclick="go('${c.id}')">${c.t}</button>`).join('')}</div>
       </div>`
    : `<button class="mi" data-pg="${m.id}" onclick="go('${m.id}')">${icon(m.i)}<span>${m.t}</span></button>`
  ).join('');
}
const toggleGroup = g => $('mg-' + g).classList.toggle('open');
const toggleSide = () => document.body.classList.toggle('side-open');
const closeSide = () => document.body.classList.remove('side-open');

function go(id) {
  closeSide();
  if (PROTECTED.includes(id) && !sessionStorage.getItem('pw')) { askPw(() => go(id)); return; }
  curPage = id;
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'pg-' + id));
  document.querySelectorAll('[data-pg]').forEach(b => b.classList.toggle('on', b.dataset.pg === id));
  const parent = MENU.find(m => m.ch && m.ch.some(c => c.id === id));
  if (parent) $('mg-' + parent.g).classList.add('open');
  if (id === 'memberEntry') resetMemberForm();
  if (id === 'collection') resetCollForm();
  if (id === 'special') resetSpecialForm();
  if (id === 'expense') resetExpForm();
  if (id === 'notices') showNoticeList();
  if (id === 'setup') fillSetup();
  if (id === 'committeeForm') fillCommitteeForm();
  if (id === 'noticeForm') resetNoticeForm();
  window.scrollTo(0, 0);
}

/* ---------- পাসওয়ার্ড ---------- */
let pwCb = null;
function askPw(cb) {
  pwCb = cb; $('pwInput').value = ''; $('pwErr').textContent = '';
  $('pwModal').classList.add('show');
  setTimeout(() => $('pwInput').focus(), 60);
}
function closePw() { $('pwModal').classList.remove('show'); pwCb = null; }
async function submitPw() {
  const pw = $('pwInput').value;
  if (!pw) return;
  const j = await api({ action: 'login', pw }, true);
  if (!j) { $('pwErr').textContent = 'ভুল পাসওয়ার্ড বা সংযোগ সমস্যা'; return; }
  sessionStorage.setItem('pw', pw);
  const cb = pwCb; closePw();
  if (cb) cb();
}
function lockNow(silent) {
  sessionStorage.removeItem('pw');
  if (!silent) toast('ব্যবস্থাপনা লক করা হয়েছে');
  if (PROTECTED.includes(curPage)) go('dashboard');
}

/* ---------- সব রেন্ডার ---------- */
function refreshAll() {
  renderChrome(); renderDashboard();
  renderMembers(); fillMemberSelect(); renderColl(); renderSpecial(); renderExp();
  renderAbout(); renderCommittee(); renderNotices(); fillReportYears(); renderReport(); renderCash(); renderLedger();
  refreshNos();
}
function refreshNos() {
  if (!$('mId').value) $('mSerial').value = nextMemberId();
  if (!$('cId').value) $('cReceipt').value = bn(nextNo(S.collections, 'receiptNo'));
  if ($('nfNo') && !$('nfId').value) $('nfNo').value = bn(nextNo(S.notices, 'noticeNo'));
  if (!$('sId').value) $('sReceipt').value = bn(nextNo(S.special, 'receiptNo'));
  if (!$('eId').value) $('eVoucher').value = bn(nextNo(S.expenses, 'voucherNo'));
}

function renderChrome() {
  const s = S.settings;
  $('orgName').textContent = s.name || 'সংস্থার নাম';
  document.title = s.name || 'সংস্থা ব্যবস্থাপনা';
  const lg = $('orgLogo');
  if (s.logo) { lg.src = s.logo; lg.style.display = ''; } else lg.style.display = 'none';
  const mob = [s.mobile1, s.mobile2, s.mobile3].filter(Boolean);
  let l = `<div class="ft-h">${esc(s.name || '')}</div>`;
  if (s.address) l += `<div class="ft-row">${icon('pin', 16)}<span>${esc(s.address)}</span></div>`;
  if (mob.length) l += `<div class="ft-row">${icon('phone', 16)}<span>${mob.map(m => `<a href="tel:${esc(m)}">${bn(esc(m))}</a>`).join(', ')}</span></div>`;
  if (s.email) l += `<div class="ft-row">${icon('mail', 16)}<a href="mailto:${esc(s.email)}">${esc(s.email)}</a></div>`;
  $('ftLeft').innerHTML = l;
  let r = '';
  if (s.facebook) r += `<a class="chip" href="${esc(s.facebook)}" target="_blank" rel="noopener">${icon('link', 16)} Facebook</a>`;
  if (s.youtube) r += `<a class="chip" href="${esc(s.youtube)}" target="_blank" rel="noopener">${icon('link', 16)} YouTube</a>`;
  $('ftRight').innerHTML = r;
}

/* ---------- হিসাব ---------- */
function monthsBetween(joinISO, asOfISO) {
  if (!joinISO) return 0;
  const a = String(joinISO).split('-').map(Number), b = String(asOfISO).split('-').map(Number);
  return Math.max(0, (b[0] - a[0]) * 12 + (b[1] - a[1]) + 1);
}
const calcAssessed = (m, asOf) => num(m.fee) * monthsBetween(m.date, asOf || todayISO());
const paidBy = (id, excludeId) => S.collections.filter(c => c.memberId === id && c.id !== excludeId).reduce((s, c) => s + num(c.paid), 0);
const dueOf = (m, asOf, excludeId) => calcAssessed(m, asOf) - paidBy(m.id, excludeId);

/* ---------- ড্যাশবোর্ড ---------- */
function renderDashboard() {
  const t = todayISO();
  let assessed = 0, due = 0;
  S.members.forEach(m => { assessed += calcAssessed(m, t); due += Math.max(0, dueOf(m, t)); });
  const collected = sum(S.collections, 'paid');
  const special = sum(S.special, 'amount');
  const spent = sum(S.expenses, 'paid');
  const cash = collected + special - spent;
  const net = collected + special - spent;
  const cards = [
    { l: 'মোট সদস্য', v: bn(S.members.length) + ' জন', i: 'users' },
    { l: 'মোট ধার্য্য', v: taka(assessed), i: 'org' },
    { l: 'মোট আদায়', v: taka(collected), i: 'coin' },
    { l: 'মোট বকেয়া', v: taka(due), i: 'bell', c: 'due' },
    { l: 'মোট খরচ', v: taka(spent), i: 'receipt' },
    { l: net >= 0 ? 'উদ্বৃত্ত' : 'ঘাটতি', v: taka(Math.abs(net)), i: 'chart', c: net >= 0 ? 'plus' : 'due' },
    { l: 'বর্তমান ক্যাশ', v: taka(cash), i: 'wallet', c: 'cash', s: 'সদস্য আদায় + বিশেষ কালেকশন − খরচ' }
  ];
  $('stats').innerHTML = cards.map(c => `<div class="stat ${c.c || ''}"><span>${icon(c.i === 'coin' ? 'receipt' : c.i, 18)}${c.l}</span><b>${c.v}</b>${c.s ? `<small>${c.s}</small>` : ''}</div>`).join('');
}

/* ---------- প্রিন্ট ---------- */
function docHeader(sm) {
  const s = S.settings;
  const mob = [s.mobile1, s.mobile2, s.mobile3].filter(Boolean).map(m => bn(esc(m))).join(', ');
  const line1 = [s.established ? 'প্রতিষ্ঠাকাল: ' + bn(esc(s.established)) : '', s.regNo ? 'রেজি. নং: ' + bn(esc(s.regNo)) : ''].filter(Boolean).join(' | ');
  const line3 = [mob ? 'মোবাইল: ' + mob : '', s.email ? 'ইমেইল: ' + esc(s.email) : ''].filter(Boolean).join(' | ');
  return `<div class="dh${sm ? ' sm' : ''}">${s.logo ? `<img src="${s.logo}" alt="">` : ''}
    <div class="tx"><h1>${esc(s.name || 'সংস্থার নাম')}</h1>${line1 ? `<p>${line1}</p>` : ''}${s.address ? `<p>${esc(s.address)}</p>` : ''}${line3 ? `<p>${line3}</p>` : ''}</div>
    ${s.logo ? '<div style="width:64px"></div>' : ''}</div>`;
}
function printDoc(html) {
  $('printArea').innerHTML = html;
  setTimeout(() => window.print(), 150);
}
const listFoot = () => `<div class="foot">প্রিন্টের তারিখ: ${fdate(todayISO())}</div>`;
const sigBlock = (a, b) => `<div class="sigs"><div>${a}</div><div>${b}</div></div>`;

/* ---------- সংস্থা তথ্য ---------- */
function renderAbout() {
  const s = S.settings;
  const mob = [s.mobile1, s.mobile2, s.mobile3].filter(Boolean).map(m => `<a href="tel:${esc(m)}">${bn(esc(m))}</a>`).join(', ');
  const link = u => u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a>` : '—';
  const f = parseJ(s.founders, []).filter(x => x.name || x.address);
  if (!s.name && !f.length) {
    $('aboutBody').innerHTML = '<div class="empty">সংস্থার তথ্য এখনও যুক্ত করা হয়নি। ব্যবস্থাপনা → সেটাপ ফরম থেকে যুক্ত করুন।</div>';
    return;
  }
  $('aboutBody').innerHTML = `
    <div class="org-hero">${s.logo ? `<img src="${s.logo}" alt="">` : ''}<h3>${esc(s.name || '')}</h3></div>
    <div class="kvs">
      <div><span>প্রতিষ্ঠাকাল</span><b>${bn(esc(s.established || '—'))}</b></div>
      <div><span>রেজিস্ট্রেশন নং</span><b>${bn(esc(s.regNo || '—'))}</b></div>
      <div><span>ঠিকানা</span><b>${esc(s.address || '—')}</b></div>
      <div><span>মোবাইল</span><b>${mob || '—'}</b></div>
      <div><span>Email</span><b>${esc(s.email || '—')}</b></div>
      <div><span>Facebook</span><b>${link(s.facebook)}</b></div>
      <div><span>YouTube</span><b>${link(s.youtube)}</b></div>
    </div>
    ${f.length ? `<h3>প্রতিষ্ঠাতাদের নাম ও ঠিকানা</h3><div class="tw"><table class="rt"><thead><tr><th>ক্রম</th><th>নাম</th><th>ঠিকানা</th></tr></thead><tbody>
      ${f.map((x, i) => `<tr><td data-l="ক্রম">${bn(i + 1)}</td><td data-l="নাম">${esc(x.name)}</td><td data-l="ঠিকানা">${esc(x.address)}</td></tr>`).join('')}
    </tbody></table></div>` : ''}`;
}
function printAbout() {
  const s = S.settings;
  const f = parseJ(s.founders, []).filter(x => x.name || x.address);
  const mob = [s.mobile1, s.mobile2, s.mobile3].filter(Boolean).map(m => bn(esc(m))).join(', ');
  printDoc(docHeader() + `<div class="dt u"><span>সংস্থা পরিচিতি</span></div>
    <table class="kvt">
      <tr><td>সংস্থার নাম</td><td>${esc(s.name || '')}</td></tr>
      <tr><td>প্রতিষ্ঠাকাল</td><td>${bn(esc(s.established || ''))}</td></tr>
      <tr><td>রেজিস্ট্রেশন নং</td><td>${bn(esc(s.regNo || ''))}</td></tr>
      <tr><td>ঠিকানা</td><td>${esc(s.address || '')}</td></tr>
      <tr><td>মোবাইল নং</td><td>${mob}</td></tr>
      <tr><td>Email</td><td>${esc(s.email || '')}</td></tr>
      <tr><td>Facebook</td><td>${esc(s.facebook || '')}</td></tr>
      <tr><td>YouTube</td><td>${esc(s.youtube || '')}</td></tr>
    </table>
    ${f.length ? `<div class="dt">প্রতিষ্ঠাতাদের নাম ও ঠিকানা</div><table><thead><tr><th>ক্রম</th><th>নাম</th><th>ঠিকানা</th></tr></thead><tbody>
      ${f.map((x, i) => `<tr><td>${bn(i + 1)}</td><td>${esc(x.name)}</td><td>${esc(x.address)}</td></tr>`).join('')}</tbody></table>` : ''}
    ${listFoot()}`);
}

/* =====================================================================
   সদস্য
   ===================================================================== */
function resetMemberForm() {
  $('mId').value = '';
  $('mSerial').value = nextMemberId();
  $('mDate').value = todayISO();
  ['mName', 'mMobile', 'mJob', 'mFee', 'mAddr'].forEach(i => $(i).value = '');
  $('mTitle').textContent = 'নতুন সদস্য এন্ট্রি';
  $('mCancel').style.display = 'none';
}
async function saveMember() {
  const rec = {
    id: $('mId').value, date: $('mDate').value, name: $('mName').value.trim(),
    mobile: $('mMobile').value.trim(), occupation: $('mJob').value.trim(),
    fee: String(num($('mFee').value)), address: $('mAddr').value.trim()
  };
  if (!rec.date || !rec.name) { toast('তারিখ ও নাম আবশ্যক', true); return; }
  const j = await api({ action: 'save', sheet: 'Members', record: rec });
  if (!j) return;
  upsert(S.members, j.record); cacheSave();
  resetMemberForm(); refreshAll(); toast('সদস্য সংরক্ষিত হয়েছে');
}
function editMember(id) {
  const m = findMember(id); if (!m) return;
  $('mId').value = m.id; $('mSerial').value = m.memberId; $('mDate').value = m.date;
  $('mName').value = m.name; $('mMobile').value = m.mobile; $('mJob').value = m.occupation;
  $('mFee').value = m.fee; $('mAddr').value = m.address;
  $('mTitle').textContent = 'সদস্য তথ্য সংশোধন';
  $('mCancel').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function delMember(id) {
  const m = findMember(id); if (!m) return;
  if (S.collections.some(c => c.memberId === id)) { toast('এই সদস্যের চাঁদা আদায়ের রেকর্ড আছে। আগে সেগুলো মুছুন।', true); return; }
  if (!confirm('"' + m.name + '" কে মুছে ফেলবেন?')) return;
  const j = await api({ action: 'delete', sheet: 'Members', id }); if (!j) return;
  S.members = S.members.filter(x => x.id !== id); cacheSave();
  if ($('mId').value === id) resetMemberForm();
  refreshAll(); toast('মুছে ফেলা হয়েছে');
}
function renderMembers() {
  const q = query('mSearch');
  const rows = S.members.slice().sort(bySerial).filter(m => !q || has(q, [m.memberId, m.name, m.mobile, m.occupation, m.address]));
  $('mBody').innerHTML = rows.length ? rows.map(m => `<tr>
    <td data-l="সদস্য আইডি"><b>${esc(m.memberId)}</b></td><td data-l="তারিখ">${fdate(m.date)}</td><td data-l="নাম"><b>${esc(m.name)}</b></td>
    <td data-l="মোবাইল">${bn(esc(m.mobile))}</td><td data-l="পেশা">${esc(m.occupation)}</td><td data-l="ধার্য্য">${taka(m.fee)}</td><td data-l="ঠিকানা">${esc(m.address)}</td>
    <td class="act"><button class="ib" title="এডিট" onclick="editMember('${m.id}')">${icon('edit', 17)}</button><button class="ib del" title="ডিলেট" onclick="delMember('${m.id}')">${icon('trash', 17)}</button></td></tr>`).join('')
    : '<tr><td colspan="8" class="empty">কোনো সদস্য পাওয়া যায়নি</td></tr>';
}
function printMembers() {
  const rows = S.members.slice().sort(bySerial);
  printDoc(docHeader() + `<div class="dt u"><span>সদস্য তালিকা</span></div>
    <div class="meta"><span>মোট সদস্য: ${bn(rows.length)} জন</span><span>তারিখ: ${fdate(todayISO())}</span></div>
    <table><thead><tr><th>সদস্য আইডি</th><th>তারিখ</th><th>নাম</th><th>মোবাইল</th><th>পেশা</th><th class="r">ধার্য্য</th><th>ঠিকানা</th></tr></thead><tbody>
    ${rows.map(m => `<tr><td>${esc(m.memberId)}</td><td>${fdate(m.date)}</td><td>${esc(m.name)}</td><td>${bn(esc(m.mobile))}</td><td>${esc(m.occupation)}</td><td class="r">${bn(num(m.fee))}</td><td>${esc(m.address)}</td></tr>`).join('')}
    </tbody></table>${listFoot()}`);
}

/* =====================================================================
   সদস্য চাঁদা আদায়
   ===================================================================== */
function fillMemberSelect() {
  const sel = $('cMember'), cur = sel.value;
  sel.innerHTML = '<option value="">— সদস্য নির্বাচন করুন —</option>' +
    S.members.slice().sort(bySerial).map(m => `<option value="${m.id}">${esc(m.memberId)} — ${esc(m.name)}</option>`).join('');
  sel.value = cur;
}
function resetCollForm() {
  $('cId').value = '';
  $('cReceipt').value = bn(nextNo(S.collections, 'receiptNo'));
  $('cDate').value = todayISO();
  fillMemberSelect(); $('cMember').value = '';
  ['cSerial', 'cMobile', 'cAddr', 'cFee', 'cDue', 'cPaid', 'cRemain'].forEach(i => $(i).value = '');
  $('cTitle').textContent = 'নতুন চাঁদা আদায়';
  $('cCancel').style.display = 'none';
}
function onMemberPick() {
  const m = findMember($('cMember').value);
  if (!m) { ['cSerial', 'cMobile', 'cAddr', 'cFee', 'cDue', 'cRemain'].forEach(i => $(i).value = ''); return; }
  $('cSerial').value = m.memberId; $('cMobile').value = bn(m.mobile); $('cAddr').value = m.address;
  $('cFee').value = bn(num(m.fee));
  recalcDue();
}
function recalcDue() {
  const m = findMember($('cMember').value); if (!m) return;
  $('cDue').value = bn(dueOf(m, $('cDate').value || todayISO(), $('cId').value));
  updateRemain();
}
function updateRemain() {
  if (!$('cMember').value) return;
  $('cRemain').value = bn(num($('cDue').value) - num($('cPaid').value));
}
async function saveColl() {
  const m = findMember($('cMember').value);
  const paid = num($('cPaid').value);
  if (!$('cDate').value) { toast('তারিখ দিন', true); return; }
  if (!m) { toast('সদস্য নির্বাচন করুন', true); return; }
  if (paid <= 0) { toast('পরিশোধের পরিমাণ লিখুন', true); return; }
  const rec = {
    id: $('cId').value, date: $('cDate').value, memberId: m.memberId, name: m.name,
    mobile: m.mobile, address: m.address, fee: m.fee,
    dueBefore: String(num($('cDue').value)), paid: String(paid)
  };
  const j = await api({ action: 'save', sheet: 'Collections', record: rec }); if (!j) return;
  upsert(S.collections, j.record); cacheSave();
  resetCollForm(); refreshAll(); toast('চাঁদা আদায় সংরক্ষিত হয়েছে');
  if (confirm('জমা রশিদ প্রিন্ট করবেন?')) printReceipt(j.record.id);
}
function editColl(id) {
  const c = S.collections.find(x => x.id === id); if (!c) return;
  $('cId').value = c.id; $('cReceipt').value = bn(c.receiptNo); $('cDate').value = c.date;
  fillMemberSelect(); $('cMember').value = c.memberId;
  if (!findMember(c.memberId)) { toast('এই সদস্য আর তালিকায় নেই', true); return; }
  onMemberPick();
  $('cPaid').value = num(c.paid); updateRemain();
  $('cTitle').textContent = 'চাঁদা আদায় সংশোধন';
  $('cCancel').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function delColl(id) {
  if (!confirm('এই আদায়ের রেকর্ড মুছে ফেলবেন?')) return;
  const j = await api({ action: 'delete', sheet: 'Collections', id }); if (!j) return;
  S.collections = S.collections.filter(x => x.id !== id); cacheSave();
  if ($('cId').value === id) resetCollForm();
  refreshAll(); toast('মুছে ফেলা হয়েছে');
}
const collName = c => { const m = findMember(c.memberId); return m ? m.name : c.name; };
function renderColl() {
  const q = query('cSearch');
  const rows = S.collections.slice().sort(byNoDesc('receiptNo')).filter(c => !q || has(q, [c.receiptNo, collName(c), c.memberId, c.mobile]));
  $('cBody').innerHTML = rows.length ? rows.map(c => `<tr>
    <td data-l="রশিদ নং">${bn(c.receiptNo)}</td><td data-l="তারিখ">${fdate(c.date)}</td><td data-l="নাম"><b>${esc(collName(c))}</b></td>
    <td data-l="সদস্য আইডি">${esc(c.memberId)}</td><td data-l="ধার্য্য">${taka(c.fee)}</td><td data-l="পূর্ব বকেয়া">${taka(c.dueBefore)}</td><td data-l="পরিশোধ"><b>${taka(c.paid)}</b></td>
    <td class="act"><button class="ib" title="এডিট" onclick="editColl('${c.id}')">${icon('edit', 17)}</button><button class="ib" title="প্রিন্ট" onclick="printReceipt('${c.id}')">${icon('print', 17)}</button><button class="ib" title="শেয়ার" onclick="openShare('coll','${c.id}')">${icon('share', 17)}</button><button class="ib del" title="ডিলেট" onclick="delColl('${c.id}')">${icon('trash', 17)}</button></td></tr>`).join('')
    : '<tr><td colspan="8" class="empty">কোনো আদায় পাওয়া যায়নি</td></tr>';
}
function receiptHtml(c, copy) {
  const remain = num(c.dueBefore) - num(c.paid);
  return `<div class="rcpt">${docHeader(true)}
    <div class="dt u" style="margin:4px 0"><span>জমা রশিদ</span>${copy ? `<span class="cp">${copy}</span>` : ''}</div>
    <div class="meta"><span>রশিদ নং: <b>${bn(c.receiptNo)}</b></span><span>তারিখ: <b>${fdate(c.date)}</b></span></div>
    <table class="kvt">
      <tr><td>সদস্যের নাম</td><td>${esc(collName(c))} (সদস্য আইডি: ${esc(c.memberId)})</td></tr>
      <tr><td>মোবাইল নং</td><td>${bn(esc(c.mobile))}</td></tr>
      <tr><td>ঠিকানা</td><td>${esc(c.address)}</td></tr>
    </table>
    <table style="margin-top:6px"><thead><tr><th>বিবরণ</th><th class="r">মাসিক ধার্য্য</th><th class="r">পূর্ব বকেয়া</th><th class="r">পরিশোধ</th><th class="r">অবশিষ্ট বকেয়া</th></tr></thead>
    <tbody><tr><td>সদস্য চাঁদা</td><td class="r">${taka(c.fee)}</td><td class="r">${taka(c.dueBefore)}</td><td class="r"><b>${taka(c.paid)}</b></td><td class="r">${taka(remain)}</td></tr></tbody></table>
    ${sigBlock('ক্যাশিয়ার', 'সভাপতি')}</div>`;
}
function printReceipt(id) {
  const c = S.collections.find(x => x.id === id); if (!c) return;
  printDoc(receiptHtml(c, ''));
}
function printCollList() {
  const rows = S.collections.slice().sort(byNoDesc('receiptNo')).reverse();
  printDoc(docHeader() + `<div class="dt u"><span>সদস্য চাঁদা আদায় তালিকা</span></div>
    <table><thead><tr><th>রশিদ নং</th><th>তারিখ</th><th>নাম</th><th>সদস্য আইডি</th><th class="r">ধার্য্য</th><th class="r">পূর্ব বকেয়া</th><th class="r">পরিশোধ</th></tr></thead><tbody>
    ${rows.map(c => `<tr><td>${bn(c.receiptNo)}</td><td>${fdate(c.date)}</td><td>${esc(collName(c))}</td><td>${esc(c.memberId)}</td><td class="r">${bn(num(c.fee))}</td><td class="r">${bn(num(c.dueBefore))}</td><td class="r">${bn(num(c.paid))}</td></tr>`).join('')}
    <tr><td colspan="6" class="r"><b>সর্বমোট</b></td><td class="r"><b>${taka(sum(rows, 'paid'))}</b></td></tr>
    </tbody></table>${listFoot()}`);
}


function printDueList() {
  const t = todayISO();
  const rows = S.members.slice().sort(bySerial).map(m => {
    const total = calcAssessed(m, t), paid = paidBy(m.id);
    return { m, total, paid, due: total - paid };
  }).filter(r => r.due > 0);
  if (!rows.length) { toast('কোনো সদস্যের বকেয়া নেই'); return; }
  const tot = k => rows.reduce((s, r) => s + r[k], 0);
  printDoc(docHeader() + `<div class="dt u"><span>সদস্যভিত্তিক বকেয়া তালিকা</span></div>
    <div class="meta"><span>বকেয়া সদস্য: ${bn(rows.length)} জন</span><span>তারিখ: ${fdate(t)}</span></div>
    <table><thead><tr><th>সদস্য আইডি</th><th>নাম</th><th>মোবাইল নং</th><th class="r">ধার্য্য</th><th class="r">মোট</th><th class="r">পরিশোধ</th><th class="r">বকেয়া</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${esc(r.m.memberId)}</td><td>${esc(r.m.name)}</td><td>${bn(esc(r.m.mobile))}</td><td class="r">${bn(num(r.m.fee))}</td><td class="r">${bn(r.total)}</td><td class="r">${bn(r.paid)}</td><td class="r"><b>${bn(r.due)}</b></td></tr>`).join('')}
    <tr><td colspan="4" class="r"><b>সর্বমোট</b></td><td class="r"><b>${bn(tot('total'))}</b></td><td class="r"><b>${bn(tot('paid'))}</b></td><td class="r"><b>${bn(tot('due'))}</b></td></tr>
    </tbody></table>${listFoot()}`);
}

/* =====================================================================
   বিশেষ কালেকশন
   ===================================================================== */
function resetSpecialForm() {
  $('sId').value = '';
  $('sReceipt').value = bn(nextNo(S.special, 'receiptNo'));
  $('sDate').value = todayISO();
  ['sName', 'sMobile', 'sAddr', 'sDesc', 'sAmt'].forEach(i => $(i).value = '');
  $('sTitle').textContent = 'বিশেষ কালেকশন ফরম';
  $('sCancel').style.display = 'none';
}
async function saveSpecial() {
  const rec = {
    id: $('sId').value, date: $('sDate').value, name: $('sName').value.trim(), mobile: $('sMobile').value.trim(),
    address: $('sAddr').value.trim(), description: $('sDesc').value.trim(), amount: String(num($('sAmt').value))
  };
  if (!rec.date || !rec.name) { toast('তারিখ ও নাম আবশ্যক', true); return; }
  if (num(rec.amount) <= 0) { toast('টাকার পরিমাণ লিখুন', true); return; }
  const j = await api({ action: 'save', sheet: 'Special', record: rec }); if (!j) return;
  upsert(S.special, j.record); cacheSave();
  resetSpecialForm(); refreshAll(); toast('সংরক্ষিত হয়েছে');
  if (confirm('রশিদ প্রিন্ট করবেন?')) printSpecial(j.record.id);
}
function editSpecial(id) {
  const x = S.special.find(v => v.id === id); if (!x) return;
  $('sId').value = x.id; $('sReceipt').value = bn(x.receiptNo); $('sDate').value = x.date;
  $('sName').value = x.name; $('sMobile').value = x.mobile; $('sAddr').value = x.address;
  $('sDesc').value = x.description; $('sAmt').value = num(x.amount);
  $('sTitle').textContent = 'বিশেষ কালেকশন সংশোধন';
  $('sCancel').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function delSpecial(id) {
  if (!confirm('এই রেকর্ড মুছে ফেলবেন?')) return;
  const j = await api({ action: 'delete', sheet: 'Special', id }); if (!j) return;
  S.special = S.special.filter(x => x.id !== id); cacheSave();
  if ($('sId').value === id) resetSpecialForm();
  refreshAll(); toast('মুছে ফেলা হয়েছে');
}
function renderSpecial() {
  const q = query('sSearch');
  const rows = S.special.slice().sort(byNoDesc('receiptNo')).filter(x => !q || has(q, [x.receiptNo, x.name, x.mobile, x.description]));
  $('sBody').innerHTML = rows.length ? rows.map(x => `<tr>
    <td data-l="রশিদ নং">${bn(x.receiptNo)}</td><td data-l="তারিখ">${fdate(x.date)}</td><td data-l="নাম"><b>${esc(x.name)}</b></td>
    <td data-l="মোবাইল">${bn(esc(x.mobile))}</td><td data-l="বিবরণ">${esc(x.description)}</td><td data-l="টাকা"><b>${taka(x.amount)}</b></td>
    <td class="act"><button class="ib" title="এডিট" onclick="editSpecial('${x.id}')">${icon('edit', 17)}</button><button class="ib" title="প্রিন্ট" onclick="printSpecial('${x.id}')">${icon('print', 17)}</button><button class="ib" title="শেয়ার" onclick="openShare('special','${x.id}')">${icon('share', 17)}</button><button class="ib del" title="ডিলেট" onclick="delSpecial('${x.id}')">${icon('trash', 17)}</button></td></tr>`).join('')
    : '<tr><td colspan="7" class="empty">কোনো রেকর্ড পাওয়া যায়নি</td></tr>';
}
function specialHtml(x, copy) {
  return `<div class="rcpt">${docHeader(true)}
    <div class="dt u" style="margin:4px 0"><span>বিশেষ কালেকশন রশিদ</span>${copy ? `<span class="cp">${copy}</span>` : ''}</div>
    <div class="meta"><span>রশিদ নং: <b>${bn(x.receiptNo)}</b></span><span>তারিখ: <b>${fdate(x.date)}</b></span></div>
    <table class="kvt">
      <tr><td>নাম</td><td>${esc(x.name)}</td></tr>
      <tr><td>মোবাইল নং</td><td>${bn(esc(x.mobile))}</td></tr>
      <tr><td>ঠিকানা</td><td>${esc(x.address)}</td></tr>
      <tr><td>বিবরণ</td><td>${esc(x.description)}</td></tr>
      <tr><td>টাকা</td><td><b>${taka(x.amount)}</b></td></tr>
    </table>
    ${sigBlock('ক্যাশিয়ার', 'সভাপতি')}</div>`;
}
function printSpecial(id) {
  const x = S.special.find(v => v.id === id); if (!x) return;
  printDoc(specialHtml(x, ''));
}
function printSpecialList() {
  const rows = S.special.slice().sort(byNoDesc('receiptNo')).reverse();
  printDoc(docHeader() + `<div class="dt u"><span>বিশেষ কালেকশন তালিকা</span></div>
    <table><thead><tr><th>রশিদ নং</th><th>তারিখ</th><th>নাম</th><th>মোবাইল</th><th>ঠিকানা</th><th>বিবরণ</th><th class="r">টাকা</th></tr></thead><tbody>
    ${rows.map(x => `<tr><td>${bn(x.receiptNo)}</td><td>${fdate(x.date)}</td><td>${esc(x.name)}</td><td>${bn(esc(x.mobile))}</td><td>${esc(x.address)}</td><td>${esc(x.description)}</td><td class="r">${bn(num(x.amount))}</td></tr>`).join('')}
    <tr><td colspan="6" class="r"><b>সর্বমোট</b></td><td class="r"><b>${taka(sum(rows, 'amount'))}</b></td></tr>
    </tbody></table>${listFoot()}`);
}

/* =====================================================================
   রশিদ শেয়ার (ছবি / লেখা)
   ===================================================================== */
let shareCtx = null;
const waNum = m => { let d = en(m).replace(/\D/g, ''); if (d.length === 11 && d.indexOf('01') === 0) d = '88' + d; return d; };

function receiptInfo(kind, id) {
  const org = S.settings.name || 'সংস্থা';
  if (kind === 'coll') {
    const c = S.collections.find(x => x.id === id); if (!c) return null;
    return {
      html: receiptHtml(c, ''), title: 'জমা রশিদ নং ' + bn(c.receiptNo), name: 'receipt-' + en(c.receiptNo), mobile: c.mobile,
      text: `${org}\nজমা রশিদ নং: ${bn(c.receiptNo)}\nতারিখ: ${fdate(c.date)}\nসদস্য: ${collName(c)} (আইডি: ${c.memberId})\nপরিশোধ: ${taka(c.paid)}\nঅবশিষ্ট বকেয়া: ${taka(num(c.dueBefore) - num(c.paid))}\nধন্যবাদ।`
    };
  }
  const x = S.special.find(v => v.id === id); if (!x) return null;
  return {
    html: specialHtml(x, ''), title: 'বিশেষ কালেকশন রশিদ নং ' + bn(x.receiptNo), name: 'special-receipt-' + en(x.receiptNo), mobile: x.mobile,
    text: `${org}\nবিশেষ কালেকশন রশিদ নং: ${bn(x.receiptNo)}\nতারিখ: ${fdate(x.date)}\nনাম: ${x.name}\nবিবরণ: ${x.description}\nটাকা: ${taka(x.amount)}\nধন্যবাদ।`
  };
}
async function makeShareImage(info) {
  if (typeof html2canvas === 'undefined') return null;
  const box = $('shotArea');
  box.innerHTML = info.html;
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const cv = await html2canvas(box, {
      scale: 2, backgroundColor: '#ffffff', useCORS: true,
      onclone: d => { const e = d.getElementById('shotArea'); if (e) { e.style.position = 'absolute'; e.style.left = '0'; e.style.top = '0'; } }
    });
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    return blob ? { blob } : null;
  } catch (e) { return null; }
  finally { box.innerHTML = ''; }
}
function openShare(kind, id) {
  const info = receiptInfo(kind, id); if (!info) return;
  closeShare();
  const ctx = shareCtx = { info, img: null, url: '' };
  $('shTitle').textContent = info.title;
  $('shPrev').style.display = 'none';
  $('shStatus').textContent = 'ছবি তৈরি হচ্ছে…';
  $('shareModal').classList.add('show');
  ctx.p = makeShareImage(info).then(img => {
    if (shareCtx !== ctx) return img;
    if (img) {
      ctx.img = img; ctx.url = URL.createObjectURL(img.blob);
      $('shPrev').src = ctx.url; $('shPrev').style.display = ''; $('shStatus').textContent = '';
    } else {
      $('shStatus').textContent = 'ছবি তৈরি হয়নি (ইন্টারনেট সংযোগ দেখুন)। লেখা আকারে পাঠাতে পারবেন।';
    }
    return img;
  });
}
function closeShare() {
  if (shareCtx && shareCtx.url) URL.revokeObjectURL(shareCtx.url);
  shareCtx = null;
  const m = $('shareModal'); if (m) m.classList.remove('show');
}
function downloadShareImage() {
  if (!shareCtx || !shareCtx.img) { toast('ছবি এখনও তৈরি হয়নি', true); return; }
  const a = document.createElement('a');
  a.href = shareCtx.url; a.download = shareCtx.info.name + '.png';
  document.body.appendChild(a); a.click(); a.remove();
}
async function shareImage() {
  if (!shareCtx) return;
  const info = shareCtx.info, img = shareCtx.img || await shareCtx.p;
  if (!img) { toast('ছবি তৈরি হয়নি', true); return; }
  const file = new File([img.blob], info.name + '.png', { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: info.title, text: info.text }); }
    catch (e) { if (e.name !== 'AbortError') toast('শেয়ার করা যায়নি', true); }
  } else {
    downloadShareImage();
    toast('এই ডিভাইস/ব্রাউজারে সরাসরি শেয়ার হয় না। ছবি ডাউনলোড হয়েছে, অ্যাপ থেকে পাঠান।');
  }
}
function shareWhatsApp() {
  if (!shareCtx) return;
  const n = shareCtx.info.mobile ? waNum(shareCtx.info.mobile) : '';
  window.open('https://wa.me/' + n + '?text=' + encodeURIComponent(shareCtx.info.text), '_blank');
}
function shareEmail() {
  if (!shareCtx) return;
  location.href = 'mailto:?subject=' + encodeURIComponent(shareCtx.info.title) + '&body=' + encodeURIComponent(shareCtx.info.text);
}

/* =====================================================================
   গতিশীল সারি (খরচ / প্রতিষ্ঠাতা / কমিটি)
   ===================================================================== */
const DYN = {
  exp: { tb: 'eRows', cols: [{ k: 'desc', ph: 'বিবরণ' }, { k: 'amt', ph: 'টাকা', attr: 'inputmode="decimal"' }], rows: [], blank: { desc: '', amt: '' }, after: () => calcExp() },
  fnd: { tb: 'stFounders', cols: [{ k: 'name', ph: 'নাম' }, { k: 'address', ph: 'ঠিকানা' }], rows: [], blank: { name: '', address: '' } },
  cmt: { tb: 'cfRows', cols: [{ k: 'post', ph: 'পদবি' }, { k: 'name', ph: 'নাম' }, { k: 'mobile', ph: 'মোবাইল নং', attr: 'type="tel" inputmode="tel"' }], rows: [], blank: { post: '', name: '', mobile: '' } }
};
function dynRender(key) {
  const d = DYN[key];
  $(d.tb).innerHTML = d.rows.map((r, i) => `<tr><td class="c">${bn(i + 1)}</td>` +
    d.cols.map(c => `<td><input ${c.attr || ''} placeholder="${c.ph}" value="${esc(r[c.k])}" oninput="dynSet('${key}',${i},'${c.k}',this.value)"></td>`).join('') +
    `<td><button type="button" class="ib del" onclick="dynDel('${key}',${i})" title="সারি মুছুন">${icon('trash', 16)}</button></td></tr>`).join('');
  if (d.after) d.after();
}
function dynSet(k, i, f, v) { DYN[k].rows[i][f] = v; if (DYN[k].after) DYN[k].after(); }
function dynAdd(k) { DYN[k].rows.push(Object.assign({}, DYN[k].blank)); dynRender(k); }
function dynDel(k, i) {
  const d = DYN[k]; d.rows.splice(i, 1);
  if (!d.rows.length) d.rows.push(Object.assign({}, d.blank));
  dynRender(k);
}
function dynLoad(k, arr) {
  const d = DYN[k];
  d.rows = arr.length ? arr.map(r => Object.assign({}, d.blank, r)) : [Object.assign({}, d.blank)];
  dynRender(k);
}

/* =====================================================================
   খরচ
   ===================================================================== */
function resetExpForm() {
  $('eId').value = '';
  $('eVoucher').value = bn(nextNo(S.expenses, 'voucherNo'));
  $('eDate').value = todayISO();
  $('ePaid').value = '';
  dynLoad('exp', []);
  $('eTitle').textContent = 'নতুন খরচ ভাউচার';
  $('eCancel').style.display = 'none';
}
function calcExp() {
  const total = DYN.exp.rows.reduce((s, r) => s + num(r.amt), 0);
  $('eTotal').textContent = taka(total);
  $('eDue').textContent = taka(total - num($('ePaid').value));
}
async function saveExp() {
  const items = DYN.exp.rows.filter(r => r.desc.trim() || num(r.amt)).map(r => ({ d: r.desc.trim(), a: num(r.amt) }));
  if (!$('eDate').value) { toast('তারিখ দিন', true); return; }
  if (!items.length) { toast('কমপক্ষে একটি খরচের বিবরণ দিন', true); return; }
  const total = items.reduce((s, r) => s + r.a, 0), paid = num($('ePaid').value);
  const rec = { id: $('eId').value, date: $('eDate').value, items: JSON.stringify(items), total: String(total), paid: String(paid), due: String(total - paid) };
  const j = await api({ action: 'save', sheet: 'Expenses', record: rec }); if (!j) return;
  upsert(S.expenses, j.record); cacheSave();
  resetExpForm(); refreshAll(); toast('ভাউচার সংরক্ষিত হয়েছে');
  if (confirm('ভাউচার প্রিন্ট করবেন?')) printVoucher(j.record.id);
}
function editExp(id) {
  const x = S.expenses.find(v => v.id === id); if (!x) return;
  $('eId').value = x.id; $('eVoucher').value = bn(x.voucherNo); $('eDate').value = x.date;
  dynLoad('exp', parseJ(x.items, []).map(i => ({ desc: i.d, amt: String(i.a) })));
  $('ePaid').value = num(x.paid); calcExp();
  $('eTitle').textContent = 'খরচ ভাউচার সংশোধন';
  $('eCancel').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function delExp(id) {
  if (!confirm('এই ভাউচার মুছে ফেলবেন?')) return;
  const j = await api({ action: 'delete', sheet: 'Expenses', id }); if (!j) return;
  S.expenses = S.expenses.filter(x => x.id !== id); cacheSave();
  if ($('eId').value === id) resetExpForm();
  refreshAll(); toast('মুছে ফেলা হয়েছে');
}
function renderExp() {
  const q = query('eSearch');
  const rows = S.expenses.slice().sort(byNoDesc('voucherNo')).filter(x => !q || has(q, [x.voucherNo, x.items]));
  $('eBody').innerHTML = rows.length ? rows.map(x => `<tr>
    <td data-l="ভাউচার নং">${bn(x.voucherNo)}</td><td data-l="তারিখ">${fdate(x.date)}</td><td data-l="সর্বমোট"><b>${taka(x.total)}</b></td>
    <td data-l="পরিশোধ">${taka(x.paid)}</td><td data-l="বকেয়া">${taka(x.due)}</td>
    <td class="act"><button class="ib" title="এডিট" onclick="editExp('${x.id}')">${icon('edit', 17)}</button><button class="ib" title="প্রিন্ট" onclick="printVoucher('${x.id}')">${icon('print', 17)}</button><button class="ib del" title="ডিলেট" onclick="delExp('${x.id}')">${icon('trash', 17)}</button></td></tr>`).join('')
    : '<tr><td colspan="6" class="empty">কোনো ভাউচার পাওয়া যায়নি</td></tr>';
}
function printVoucher(id) {
  const x = S.expenses.find(v => v.id === id); if (!x) return;
  const items = parseJ(x.items, []);
  printDoc(docHeader() + `<div class="dt u"><span>খরচ ভাউচার</span></div>
    <div class="meta"><span>ভাউচার নং: <b>${bn(x.voucherNo)}</b></span><span>তারিখ: <b>${fdate(x.date)}</b></span></div>
    <table><thead><tr><th style="width:60px">ক্রম</th><th>বিবরণ</th><th class="r" style="width:130px">টাকা</th></tr></thead><tbody>
    ${items.map((i, n) => `<tr><td>${bn(n + 1)}</td><td>${esc(i.d)}</td><td class="r">${bn(num(i.a))}</td></tr>`).join('')}
    </tbody></table>
    <table class="sum"><tr><td><b>সর্বমোট</b></td><td class="r"><b>${taka(x.total)}</b></td></tr>
    <tr><td>পরিশোধ</td><td class="r">${taka(x.paid)}</td></tr>
    <tr><td>বকেয়া</td><td class="r">${taka(x.due)}</td></tr></table>
    ${sigBlock('ক্যাশিয়ার', 'সভাপতি')}`);
}
function printExpList() {
  const rows = S.expenses.slice().sort(byNoDesc('voucherNo')).reverse();
  printDoc(docHeader() + `<div class="dt u"><span>খরচের তালিকা</span></div>
    <table><thead><tr><th>ভাউচার নং</th><th>তারিখ</th><th>বিবরণ</th><th class="r">সর্বমোট</th><th class="r">পরিশোধ</th><th class="r">বকেয়া</th></tr></thead><tbody>
    ${rows.map(x => `<tr><td>${bn(x.voucherNo)}</td><td>${fdate(x.date)}</td><td>${esc(parseJ(x.items, []).map(i => i.d).filter(Boolean).join(', '))}</td><td class="r">${bn(num(x.total))}</td><td class="r">${bn(num(x.paid))}</td><td class="r">${bn(num(x.due))}</td></tr>`).join('')}
    <tr><td colspan="3" class="r"><b>সর্বমোট</b></td><td class="r"><b>${bn(sum(rows, 'total'))}</b></td><td class="r"><b>${bn(sum(rows, 'paid'))}</b></td><td class="r"><b>${bn(sum(rows, 'due'))}</b></td></tr>
    </tbody></table>${listFoot()}`);
}

/* =====================================================================
   রিপোর্ট (মাসিক / বাৎসরিক / সর্বমোট)
   ===================================================================== */
const REPORT_NOTE = 'সব হিসাব শুরু থেকে নির্বাচিত সময় পর্যন্ত মোট। মোট ধার্য্য = প্রত্যেক সদস্যের মাসিক ধার্য্য × সদস্য হওয়ার মাস থেকে ওই সময় (বা আজ) পর্যন্ত মোট মাস। বকেয়া = মোট ধার্য্য − সদস্যের মোট পরিশোধ।';
const MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
let repType = 'month';
const monthIdx = iso => { const p = String(iso || '').split('-').map(Number); return (p[0] && p[1]) ? p[0] * 12 + p[1] - 1 : null; };

function initReport() {
  $('rMonth').innerHTML = MONTHS.map((n, i) => `<option value="${i + 1}">${n}</option>`).join('');
  $('rMonth').value = String(new Date().getMonth() + 1);
  fillReportYears();
  setReportType('month');
}
function fillYearSel(id) {
  const sel = $(id); if (!sel) return;
  const cur = new Date().getFullYear();
  let min = cur;
  [S.members, S.collections, S.special, S.expenses].forEach(l => l.forEach(x => { const y = parseInt(x.date); if (y && y > 1990 && y < min) min = y; }));
  const keep = sel.value || String(cur);
  let o = '';
  for (let y = cur; y >= min; y--) o += `<option value="${y}">${bn(y)}</option>`;
  sel.innerHTML = o; sel.value = keep;
  if (sel.value !== keep) sel.value = String(cur);
}
function fillReportYears() { ['rYear', 'crYear', 'lgYear'].forEach(fillYearSel); }
function setReportType(t) {
  repType = t;
  document.querySelectorAll('#rSeg button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  $('rMonthWrap').style.display = t === 'month' ? '' : 'none';
  $('rYearWrap').style.display = t === 'all' ? 'none' : '';
  renderReport();
}
function reportCalc(type, y, m) {
  const now = monthIdx(todayISO());
  // শুরু থেকে নির্বাচিত মাস/বছরের শেষ পর্যন্ত মোট হিসাব
  const pe = type === 'month' ? y * 12 + m - 1 : type === 'year' ? y * 12 + 11 : Infinity;
  const upto = iso => { const i = monthIdx(iso); return i !== null && i <= pe; };
  let assessed = 0, due = 0;
  S.members.forEach(mm => {
    const js = monthIdx(mm.date); if (js === null) return;
    // মাসিক ধার্য্য × (সদস্য হওয়ার মাস থেকে নির্বাচিত সময় বা আজ পর্যন্ত মাস)
    const a = Math.max(0, Math.min(pe, now) - js + 1) * num(mm.fee);
    const p = S.collections.filter(c => c.memberId === mm.memberId && upto(c.date)).reduce((s, c) => s + num(c.paid), 0);
    assessed += a; due += Math.max(0, a - p);
  });
  const coll = sum(S.collections.filter(c => upto(c.date)), 'paid');
  const spec = sum(S.special.filter(x => upto(x.date)), 'amount');
  const exp = sum(S.expenses.filter(x => upto(x.date)), 'paid');
  const net = coll + spec - exp;
  return { assessed, coll, spec, due, exp, cash: net, net };
}
function reportView() {
  const y = parseInt($('rYear').value) || new Date().getFullYear(), m = parseInt($('rMonth').value) || 1;
  const r = reportCalc(repType, y, m);
  const meta = {
    month: { t: 'মাসিক রিপোর্ট', s: 'শুরু থেকে ' + MONTHS[m - 1] + ' ' + bn(y) + ' পর্যন্ত' },
    year: { t: 'বাৎসরিক রিপোর্ট', s: 'শুরু থেকে ' + bn(y) + ' সালের শেষ পর্যন্ত' },
    all: { t: 'সর্বমোট রিপোর্ট', s: 'শুরু থেকে ' + fdate(todayISO()) + ' পর্যন্ত' }
  }[repType];
  const rows = [
    ['মোট ধার্য্য', r.assessed, ''], ['মোট আদায়', r.coll, ''], ['বিশেষ কালেকশন', r.spec, ''],
    ['মোট বকেয়া', r.due, ''], ['মোট খরচ', r.exp, ''],
    [r.net >= 0 ? 'উদ্বৃত্ত' : 'ঘাটতি', Math.abs(r.net), r.net >= 0 ? 'pos' : 'neg'],
    [repType === 'all' ? 'বর্তমান ক্যাশ' : 'ক্যাশ', r.cash, 'hi' + (r.cash < 0 ? ' neg' : '')]
  ];
  return { meta, rows };
}
function renderReport() {
  if (!$('rBody')) return;
  const v = reportView();
  $('rTitle').textContent = v.meta.t;
  $('rSub').textContent = v.meta.s;
  $('rNote').textContent = REPORT_NOTE;
  $('rBody').innerHTML = v.rows.map(r => `<tr class="${r[2]}"><td data-l="বিবরণ">${r[0]}</td><td data-l="টাকা">${taka(r[1])}</td></tr>`).join('');
}
function printReport() {
  const v = reportView();
  printDoc(docHeader() + `<div class="dt u"><span>${v.meta.t}</span></div>
    <div class="meta"><span>সময়কাল: <b>${v.meta.s}</b></span><span>তারিখ: ${fdate(todayISO())}</span></div>
    <table><thead><tr><th style="width:60px">ক্রম</th><th>বিবরণ</th><th class="r" style="width:160px">টাকা</th></tr></thead><tbody>
    ${v.rows.map((r, i) => `<tr><td>${bn(i + 1)}</td><td>${r[0]}</td><td class="r"><b>${taka(r[1])}</b></td></tr>`).join('')}
    </tbody></table><div class="foot" style="text-align:left">${REPORT_NOTE}</div>${sigBlock('ক্যাশিয়ার', 'সভাপতি')}${listFoot()}`);
}

/* =====================================================================
   ক্যাশ রিপোর্ট ও লেজার
   ===================================================================== */
const RP = { cr: { type: 'month' }, lg: { type: 'month' } };
const amt = v => bn(num(v).toLocaleString('en-IN'));

function buildCtl(p) {
  return `<div class="seg" id="${p}Seg">
    <button class="on" data-t="month" onclick="setRp('${p}','month')">মাসিক</button>
    <button data-t="year" onclick="setRp('${p}','year')">বাৎসরিক</button>
    <button data-t="all" onclick="setRp('${p}','all')">সর্বমোট</button></div>
    <div class="fg" style="margin-top:12px">
      <label id="${p}MonthWrap">মাস<select id="${p}Month" onchange="renderRp('${p}')"></select></label>
      <label id="${p}YearWrap">বছর<select id="${p}Year" onchange="renderRp('${p}')"></select></label></div>`;
}
function initRp(p) {
  $(p + 'Ctl').innerHTML = buildCtl(p);
  $(p + 'Month').innerHTML = MONTHS.map((n, i) => `<option value="${i + 1}">${n}</option>`).join('');
  $(p + 'Month').value = String(new Date().getMonth() + 1);
  fillYearSel(p + 'Year');
}
function setRp(p, t) {
  RP[p].type = t;
  document.querySelectorAll('#' + p + 'Seg button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  $(p + 'MonthWrap').style.display = t === 'month' ? '' : 'none';
  $(p + 'YearWrap').style.display = t === 'all' ? 'none' : '';
  renderRp(p);
}
function renderRp(p) { if (p === 'cr') renderCash(); else renderLedger(); }
function rpSel(p) {
  return { type: RP[p].type, y: parseInt($(p + 'Year').value) || new Date().getFullYear(), m: parseInt($(p + 'Month').value) || 1 };
}
function rpMeta(p, s) {
  const base = p === 'cr' ? 'ক্যাশ রিপোর্ট' : 'লেজার';
  const tl = { month: 'মাসিক', year: 'বাৎসরিক', all: 'সর্বমোট' }[s.type];
  const sub = { month: MONTHS[s.m - 1] + ' ' + bn(s.y), year: bn(s.y) + ' সাল', all: 'শুরু থেকে ' + fdate(todayISO()) + ' পর্যন্ত' }[s.type];
  return { title: base + ' (' + tl + ')', sub };
}

// আয় ও ব্যয়ের সব এন্ট্রি
function rpEntries() {
  const inc = [], exp = [];
  S.collections.forEach(c => inc.push({
    d: c.date, no: bn(c.receiptNo), n: parseInt(c.receiptNo) || 0, ord: 0, head: 'সদস্য চাঁদা',
    desc: collName(c) + ' (' + c.memberId + ') — সদস্য চাঁদা', amt: num(c.paid)
  }));
  S.special.forEach(x => inc.push({
    d: x.date, no: 'বি-' + bn(x.receiptNo), n: parseInt(x.receiptNo) || 0, ord: 1,
    head: (x.description || '').trim() || 'বিশেষ কালেকশন', desc: x.name + (x.description ? ' — ' + x.description : ''), amt: num(x.amount)
  }));
  S.expenses.forEach(v => {
    const n = parseInt(v.voucherNo) || 0;
    parseJ(v.items, []).forEach(i => {
      const h = (i.d || '').trim() || 'অন্যান্য';
      exp.push({ d: v.date, no: bn(v.voucherNo), n, ord: 0, head: h, desc: h, amt: num(i.a) });
    });
    if (num(v.due) > 0) exp.push({ d: v.date, no: bn(v.voucherNo), n, ord: 1, head: 'অপরিশোধিত বকেয়া (বাদ)', desc: 'অপরিশোধিত বকেয়া (বাদ)', amt: -num(v.due) });
  });
  const cmp = (a, b) => (a.d || '').localeCompare(b.d || '') || a.ord - b.ord || a.n - b.n;
  return { inc: inc.sort(cmp), exp: exp.sort(cmp) };
}
function inPeriod(e, s) {
  const i = monthIdx(e.d); if (i === null) return false;
  if (s.type === 'month') return i === s.y * 12 + s.m - 1;
  if (s.type === 'year') return i >= s.y * 12 && i <= s.y * 12 + 11;
  return true;
}

const SBS_GAP = '<td class="gap"></td>';
function netRow(ti, te, cols) {
  return `<tr class="tt"><td colspan="${cols}" class="r">${ti >= te ? 'উদ্বৃত্ত' : 'ঘাটতি'} (আয় − ব্যয়): ${taka(Math.abs(ti - te))}</td></tr>`;
}
function cashHtml(s) {
  const e = rpEntries(), inc = e.inc.filter(x => inPeriod(x, s)), exp = e.exp.filter(x => inPeriod(x, s));
  const n = Math.max(inc.length, exp.length);
  if (!n) return '<div class="empty">এই সময়ে কোনো লেনদেন নেই</div>';
  let r = '';
  for (let i = 0; i < n; i++) {
    const a = inc[i], b = exp[i];
    r += `<tr><td>${a ? a.no : ''}</td><td>${a ? esc(a.desc) : ''}</td><td class="r">${a ? amt(a.amt) : ''}</td>${SBS_GAP}<td>${b ? b.no : ''}</td><td>${b ? esc(b.desc) : ''}</td><td class="r">${b ? amt(b.amt) : ''}</td></tr>`;
  }
  const ti = sum(inc, 'amt'), te = sum(exp, 'amt');
  return `<table class="sbs"><thead>
    <tr><th colspan="3" class="c">আয়</th><th class="gap"></th><th colspan="3" class="c">ব্যয়</th></tr>
    <tr><th>রশিদ নং</th><th>বিবরণ</th><th class="r">টাকা</th><th class="gap"></th><th>ভাউচার নং</th><th>বিবরণ</th><th class="r">টাকা</th></tr></thead>
    <tbody>${r}
    <tr class="tt"><td colspan="2" class="r">সর্বমোট আয়</td><td class="r">${amt(ti)}</td>${SBS_GAP}<td colspan="2" class="r">সর্বমোট ব্যয়</td><td class="r">${amt(te)}</td></tr>
    ${netRow(ti, te, 7)}</tbody></table>`;
}
function renderCash() {
  if (!$('crOut')) return;
  const s = rpSel('cr'), m = rpMeta('cr', s);
  $('crTitle').textContent = m.title; $('crSub').textContent = m.sub;
  $('crOut').innerHTML = cashHtml(s);
}

// লেজার: খাতভিত্তিক মোট
function ledgerGroups(s) {
  const e = rpEntries();
  const agg = list => { const mp = {}; list.forEach(x => { mp[x.head] = (mp[x.head] || 0) + x.amt; }); return Object.keys(mp).map(k => [k, mp[k]]).sort((a, b) => b[1] - a[1]); };
  if (s.type === 'month') {
    const f = x => inPeriod(x, s);
    return [{ label: '', inc: agg(e.inc.filter(f)), exp: agg(e.exp.filter(f)) }];
  }
  const keyOf = s.type === 'year' ? x => monthIdx(x.d) : x => Math.floor(monthIdx(x.d) / 12);
  const ki = e.inc.filter(x => inPeriod(x, s)), ke = e.exp.filter(x => inPeriod(x, s));
  const keys = Array.from(new Set(ki.concat(ke).map(keyOf))).sort((a, b) => a - b);
  return keys.map(k => ({
    label: s.type === 'year' ? MONTHS[k % 12] + ' ' + bn(s.y) : bn(k) + ' সাল',
    inc: agg(ki.filter(x => keyOf(x) === k)), exp: agg(ke.filter(x => keyOf(x) === k))
  }));
}
function ledgerHtml(s) {
  const groups = ledgerGroups(s);
  if (!groups.length || groups.every(g => !g.inc.length && !g.exp.length)) return '<div class="empty">এই সময়ে কোনো লেনদেন নেই</div>';
  const tot = l => l.reduce((a, r) => a + r[1], 0);
  let ti = 0, te = 0, r = '';
  groups.forEach(g => {
    if (g.label) r += `<tr class="grp"><td colspan="5">${g.label}</td></tr>`;
    const n = Math.max(g.inc.length, g.exp.length);
    for (let i = 0; i < n; i++) {
      const a = g.inc[i], b = g.exp[i];
      r += `<tr><td>${a ? esc(a[0]) : ''}</td><td class="r">${a ? amt(a[1]) : ''}</td>${SBS_GAP}<td>${b ? esc(b[0]) : ''}</td><td class="r">${b ? amt(b[1]) : ''}</td></tr>`;
    }
    const gi = tot(g.inc), ge = tot(g.exp); ti += gi; te += ge;
    if (g.label) r += `<tr class="sub"><td class="r">মোট আয়</td><td class="r">${amt(gi)}</td>${SBS_GAP}<td class="r">মোট ব্যয়</td><td class="r">${amt(ge)}</td></tr>`;
  });
  return `<table class="sbs"><thead>
    <tr><th colspan="2" class="c">আয়</th><th class="gap"></th><th colspan="2" class="c">ব্যয়</th></tr>
    <tr><th>খাত</th><th class="r">টাকা</th><th class="gap"></th><th>খাত</th><th class="r">টাকা</th></tr></thead>
    <tbody>${r}
    <tr class="tt"><td class="r">সর্বমোট আয়</td><td class="r">${amt(ti)}</td>${SBS_GAP}<td class="r">সর্বমোট ব্যয়</td><td class="r">${amt(te)}</td></tr>
    ${netRow(ti, te, 5)}</tbody></table>`;
}
function renderLedger() {
  if (!$('lgOut')) return;
  const s = rpSel('lg'), m = rpMeta('lg', s);
  $('lgTitle').textContent = m.title; $('lgSub').textContent = m.sub;
  $('lgOut').innerHTML = ledgerHtml(s);
}
function printRp(p) {
  const s = rpSel(p), m = rpMeta(p, s);
  const tbl = p === 'cr' ? cashHtml(s) : ledgerHtml(s);
  printDoc(docHeader() + `<div class="dt u"><span>${m.title}</span></div>
    <div class="meta"><span>সময়কাল: <b>${m.sub}</b></span><span>তারিখ: ${fdate(todayISO())}</span></div>
    ${tbl}${sigBlock('ক্যাশিয়ার', 'সভাপতি')}${listFoot()}`);
}

/* =====================================================================
   কমিটি (দেখা ও প্রিন্ট)
   ===================================================================== */
function renderCommittee() {
  const s = S.settings, rows = parseJ(s.committeeMembers, []).filter(r => r.post || r.name || r.mobile);
  if (!rows.length && !s.committeeDate) {
    $('cmBody').innerHTML = '<div class="empty">কমিটির তথ্য এখনও যুক্ত করা হয়নি।</div>'; return;
  }
  $('cmBody').innerHTML = `<div class="kvs"><div><span>গঠনের তারিখ</span><b>${fdate(s.committeeDate) || '—'}</b></div><div><span>মেয়াদকাল</span><b>${bn(esc(s.committeeTerm || '—'))}</b></div></div>
    <div class="tw"><table class="rt"><thead><tr><th>ক্রম</th><th>পদবি</th><th>নাম</th><th>মোবাইল নং</th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td data-l="ক্রম">${bn(i + 1)}</td><td data-l="পদবি"><b>${esc(r.post)}</b></td><td data-l="নাম">${esc(r.name)}</td><td data-l="মোবাইল">${bn(esc(r.mobile))}</td></tr>`).join('')}
    </tbody></table></div>`;
}
function printCommittee() {
  const s = S.settings, rows = parseJ(s.committeeMembers, []).filter(r => r.post || r.name || r.mobile);
  printDoc(docHeader() + `<div class="dt u"><span>কার্যনির্বাহী কমিটি</span></div>
    <div class="meta"><span>গঠনের তারিখ: <b>${fdate(s.committeeDate)}</b></span><span>মেয়াদকাল: <b>${bn(esc(s.committeeTerm || ''))}</b></span></div>
    <table><thead><tr><th style="width:60px">ক্রম</th><th>পদবি</th><th>নাম</th><th>মোবাইল নং</th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td>${bn(i + 1)}</td><td>${esc(r.post)}</td><td>${esc(r.name)}</td><td>${bn(esc(r.mobile))}</td></tr>`).join('')}
    </tbody></table>${listFoot()}`);
}

/* =====================================================================
   নোটিশ (দেখা ও প্রিন্ট)
   ===================================================================== */
const sortedNotices = () => S.notices.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
function renderNotices() {
  const list = sortedNotices();
  $('nList').innerHTML = list.length
    ? list.map(n => `<button class="nitem" onclick="viewNotice('${n.id}')"><span class="nd">${fdate(n.date)}</span><span class="nt">${esc(n.title)}</span></button>`).join('')
    : '<div class="card empty">কোনো নোটিশ নেই</div>';
  renderNoticeAdmin();
}
function noticeBody(n) {
  return `<div class="nmeta">নোটিশ নং: ${bn(n.noticeNo)} &nbsp;|&nbsp; তারিখ: ${fdate(n.date)}</div><h3 class="ntitle">${esc(n.title)}</h3><div class="ndet">${esc(n.details)}</div>${sigBlock('অফিস সম্পাদক', 'সভাপতি')}`;
}
function viewNotice(id) {
  const n = S.notices.find(x => x.id === id); if (!n) return;
  $('nList').style.display = 'none';
  $('nView').style.display = '';
  $('nView').innerHTML = `<div class="btns" style="margin-top:0"><button class="btn ghost" onclick="showNoticeList()">← তালিকা</button><button class="btn" onclick="printNotice('${n.id}')"><i data-ic="print"></i> প্রিন্ট</button></div>
    <div class="paper">${noticeBody(n)}</div>`;
  hydrateIcons();
  window.scrollTo(0, 0);
}
function showNoticeList() { $('nView').style.display = 'none'; $('nView').innerHTML = ''; $('nList').style.display = ''; }
function printNotice(id) {
  const n = S.notices.find(x => x.id === id); if (!n) return;
  printDoc(docHeader() + `<div class="dt u"><span>নোটিশ</span></div>${noticeBody(n)}`);
}

/* =====================================================================
   ব্যবস্থাপনা: সেটাপ ফরম
   ===================================================================== */
let setupLogo = '';
const SETUP_MAP = { stName: 'name', stEst: 'established', stReg: 'regNo', stAddr: 'address', stM1: 'mobile1', stM2: 'mobile2', stM3: 'mobile3', stEmail: 'email', stFb: 'facebook', stYt: 'youtube' };
function fillSetup() {
  const s = S.settings;
  Object.keys(SETUP_MAP).forEach(id => $(id).value = s[SETUP_MAP[id]] || '');
  setupLogo = s.logo || ''; showLogoPrev();
  dynLoad('fnd', parseJ(s.founders, []));
  $('stNewPw').value = ''; $('stLogoFile').value = '';
}
function showLogoPrev() {
  const p = $('stLogoPrev');
  if (setupLogo) { p.src = setupLogo; p.style.display = ''; } else p.style.display = 'none';
}
function clearLogo() { setupLogo = ''; $('stLogoFile').value = ''; showLogoPrev(); }
function onLogoFile(inp) {
  const f = inp.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    const img = new Image();
    img.onload = () => {
      let max = 240, url = '';
      for (let k = 0; k < 6; k++) {
        const sc = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(img.width * sc)); cv.height = Math.max(1, Math.round(img.height * sc));
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        url = cv.toDataURL('image/png');
        if (url.length < 45000) break;
        max *= 0.75;
      }
      if (url.length >= 45000) { toast('ছবিটি অনেক বড়, ছোট ছবি ব্যবহার করুন', true); return; }
      setupLogo = url; showLogoPrev();
    };
    img.onerror = () => toast('ছবি পড়া যায়নি', true);
    img.src = rd.result;
  };
  rd.readAsDataURL(f);
}
async function saveSetup() {
  const data = {};
  Object.keys(SETUP_MAP).forEach(id => data[SETUP_MAP[id]] = $(id).value.trim());
  data.logo = setupLogo;
  data.founders = JSON.stringify(DYN.fnd.rows.filter(r => r.name.trim() || r.address.trim()));
  const j = await api({ action: 'saveSettings', data }); if (!j) return;
  Object.assign(S.settings, data); cacheSave(); refreshAll();
  toast('সেটাপ সংরক্ষিত হয়েছে');
}
async function changePw() {
  const np = $('stNewPw').value;
  if (np.length < 4) { toast('পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে', true); return; }
  const j = await api({ action: 'changePassword', newPw: np }); if (!j) return;
  sessionStorage.setItem('pw', np); $('stNewPw').value = '';
  toast('পাসওয়ার্ড পরিবর্তিত হয়েছে');
}

/* ---------- কমিটি ফরম ---------- */
function fillCommitteeForm() {
  const s = S.settings;
  $('cfDate').value = s.committeeDate || todayISO();
  $('cfTerm').value = s.committeeTerm || '';
  dynLoad('cmt', parseJ(s.committeeMembers, []));
}
async function saveCommittee() {
  const rows = DYN.cmt.rows.filter(r => r.post.trim() || r.name.trim() || r.mobile.trim());
  const data = { committeeDate: $('cfDate').value, committeeTerm: $('cfTerm').value.trim(), committeeMembers: JSON.stringify(rows) };
  const j = await api({ action: 'saveSettings', data }); if (!j) return;
  Object.assign(S.settings, data); cacheSave(); refreshAll();
  toast('কমিটি সংরক্ষিত হয়েছে');
}

/* ---------- নোটিশ ফরম ---------- */
function resetNoticeForm() {
  $('nfId').value = ''; $('nfNo').value = bn(nextNo(S.notices, 'noticeNo')); $('nfDate').value = todayISO(); $('nfTitle').value = ''; $('nfDetails').value = '';
  $('nfTitleH').textContent = 'নতুন নোটিশ'; $('nfCancel').style.display = 'none';
}
async function saveNotice() {
  const rec = { id: $('nfId').value, date: $('nfDate').value, title: $('nfTitle').value.trim(), details: $('nfDetails').value };
  if (!rec.date || !rec.title) { toast('তারিখ ও শিরোনাম আবশ্যক', true); return; }
  const j = await api({ action: 'save', sheet: 'Notices', record: rec }); if (!j) return;
  upsert(S.notices, j.record); cacheSave();
  resetNoticeForm(); refreshAll(); toast('নোটিশ সংরক্ষিত হয়েছে');
}
function editNotice(id) {
  const n = S.notices.find(x => x.id === id); if (!n) return;
  $('nfId').value = n.id; $('nfNo').value = bn(n.noticeNo); $('nfDate').value = n.date; $('nfTitle').value = n.title; $('nfDetails').value = n.details;
  $('nfTitleH').textContent = 'নোটিশ সংশোধন'; $('nfCancel').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function delNotice(id) {
  if (!confirm('এই নোটিশ মুছে ফেলবেন?')) return;
  const j = await api({ action: 'delete', sheet: 'Notices', id }); if (!j) return;
  S.notices = S.notices.filter(x => x.id !== id); cacheSave();
  if ($('nfId').value === id) resetNoticeForm();
  refreshAll(); toast('মুছে ফেলা হয়েছে');
}
function renderNoticeAdmin() {
  const list = sortedNotices();
  $('nfBody').innerHTML = list.length ? list.map(n => `<tr>
    <td data-l="নোটিশ নং">${bn(n.noticeNo)}</td><td data-l="তারিখ">${fdate(n.date)}</td><td data-l="শিরোনাম"><b>${esc(n.title)}</b></td>
    <td class="act"><button class="ib" title="এডিট" onclick="editNotice('${n.id}')">${icon('edit', 17)}</button><button class="ib del" title="ডিলেট" onclick="delNotice('${n.id}')">${icon('trash', 17)}</button></td></tr>`).join('')
    : '<tr><td colspan="4" class="empty">কোনো নোটিশ নেই</td></tr>';
}

/* ---------- শুরু ---------- */
function hydrateIcons() {
  document.querySelectorAll('i[data-ic]').forEach(e => { e.outerHTML = icon(e.dataset.ic, 18); });
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSide(); closePw(); closeShare(); } });
document.addEventListener('DOMContentLoaded', () => {
  hydrateIcons(); buildMenu();
  resetMemberForm(); resetCollForm(); resetSpecialForm(); resetExpForm(); initReport(); initRp('cr'); initRp('lg');
  loadData();
});
