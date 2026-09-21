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
const S = { settings: {}, members: [], collections: [], special: [], expenses: [], notices: [], feeChanges: [], programs: [] };
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
const KEYS = { members: 'memberId', collections: 'receiptNo', special: 'receiptNo', expenses: 'voucherNo', notices: 'noticeNo', feeChanges: 'incNo', programs: 'serial' };
const SHEET_KEY = { Members: 'memberId', Collections: 'receiptNo', Special: 'receiptNo', Expenses: 'voucherNo', Notices: 'noticeNo', FeeChanges: 'incNo', Programs: 'serial' };
function normalize() { Object.keys(KEYS).forEach(k => (S[k] || []).forEach(x => { x.id = x[KEYS[k]]; })); }
const byNo = f => (a, b) => (parseInt(a[f]) || 0) - (parseInt(b[f]) || 0);
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

// ডাবল এন্ট্রি প্রতিরোধ: (১) সংরক্ষণ চলাকালীন আরেকটি সংরক্ষণ/ডিলেট চালু হয় না,
// (২) প্রতিটি নতুন এন্ট্রির জন্য একটি ইউনিক টোকেন যায়; সার্ভার একই টোকেন দ্বিতীয়বার পেলে নতুন সারি বানায় না।
let writing = false;
const TOK = {};
const newToken = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

// নেটওয়ার্ক: সময়সীমা + স্বয়ংক্রিয় পুনরায় চেষ্টা (৩ বার)। ধীর সংযোগ বা Google এর সাময়িক ত্রুটিতেও কাজ চালিয়ে যায়।
async function fetchJson(url, opts, tries) {
  tries = tries || 3;
  let lastErr;
  for (let i = 0; i < tries; i++) {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 30000);
    try {
      const r = await fetch(url, Object.assign({ signal: ctl.signal }, opts));
      const j = JSON.parse(await r.text());        // HTML ত্রুটি পাতা এলে এখানে ব্যতিক্রম হয়
      return { j, retried: i > 0 };
    } catch (e) { lastErr = e; }
    finally { clearTimeout(to); }
    if (i < tries - 1) await new Promise(res => setTimeout(res, 900 * (i + 1)));
  }
  throw lastErr;
}

async function api(payload, quiet) {
  if (!apiReady()) { toast('app.js এ API_URL বসানো হয়নি', true); return null; }
  const isWrite = payload.action === 'save' || payload.action === 'delete';
  if (isWrite) {
    if (writing) return null;                       // ডাবল ক্লিক: আগেরটি শেষ না হওয়া পর্যন্ত উপেক্ষা
    writing = true; document.body.classList.add('saving');
  }
  const isNew = payload.action === 'save' && payload.record && !payload.record.id;
  const tk = payload.sheet + ':' + ((payload.record && payload.record.memberId) || '');
  if (isNew) payload.record.token = TOK[tk] || (TOK[tk] = newToken());
  busy(true);
  const slow = setTimeout(() => toast('সার্ভার সাড়া দিতে একটু দেরি হচ্ছে, অপেক্ষা করুন…'), 7000);
  try {
    const body = Object.assign({ pw: sessionStorage.getItem('pw') || '' }, payload);
    // পাসওয়ার্ড পরিবর্তন ছাড়া বাকি সবই নিরাপদে পুনরায় পাঠানো যায় (নতুন এন্ট্রিতে টোকেন থাকায় ডাবল হয় না)
    const { j, retried } = await fetchJson(API_URL, { method: 'POST', body: JSON.stringify(body) }, payload.action === 'changePassword' ? 1 : 3);
    if (!j.ok) {
      // ডিলেট সফল হয়েও উত্তর হারালে পুনরায় চেষ্টায় "পাওয়া যায়নি" আসে; সেটিকে সফল ধরে ডেটা মিলিয়ে নেওয়া হয়
      if (payload.action === 'delete' && retried && /পাওয়া যায়নি/.test(j.error || '')) { setTimeout(() => loadData(), 0); return { ok: true, resync: true }; }
      if (j.code === 'AUTH') lockNow(true);
      if (!quiet) toast(j.error || 'সমস্যা হয়েছে', true);
      return null;
    }
    if (payload.action === 'save' && j.record) j.record.id = j.record[SHEET_KEY[payload.sheet]];
    if (isNew) delete TOK[tk];           // সফল হলে পরের এন্ট্রির জন্য নতুন টোকেন
    return j;
  } catch (e) {
    if (!quiet) toast(isWrite ? 'সংযোগে সমস্যা হয়েছে। আবার সংরক্ষণ চাপুন — ডাবল এন্ট্রি হবে না।' : 'সার্ভারের সাথে সংযোগ হয়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।', true);
    return null;
  } finally {
    clearTimeout(slow);
    busy(false);
    if (isWrite) { writing = false; document.body.classList.remove('saving'); }
  }
}

const DATA_KEYS = ['settings', 'members', 'collections', 'special', 'expenses', 'notices', 'feeChanges', 'programs'];
function cacheSave() {
  try {
    const o = {}; DATA_KEYS.forEach(k => o[k] = S[k]);
    localStorage.setItem(CACHE_KEY, JSON.stringify(o));
  } catch (e) { /* ক্যাশ পূর্ণ হলে উপেক্ষা */ }
}

let loadingNow = false, lastLoad = 0, autoRetry = 0;
async function loadData(initial) {
  if (loadingNow) return;
  loadingNow = true;
  let hadCache = false;
  if (initial) {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (c) { hadCache = true; DATA_KEYS.forEach(k => { if (c[k]) S[k] = c[k]; }); }
    } catch (e) { /* ignore */ }
    normalize();
    refreshAll();          // সংরক্ষিত ডেটা সাথে সাথে দেখানো হয়, নতুনটা পেছনে লোড হয়
  }
  if (!apiReady()) { toast('app.js এ API_URL বসানো হয়নি', true); loadingNow = false; return; }
  busy(true);
  try {
    const { j } = await fetchJson(API_URL + '?action=getAll', {}, 3);
    if (j.ok) {
      DATA_KEYS.forEach(k => S[k] = j[k] || (k === 'settings' ? {} : []));
      normalize(); cacheSave(); refreshAll();
      lastLoad = Date.now(); autoRetry = 0;
    } else toast(j.error || 'ডেটা লোড হয়নি', true);
  } catch (e) {
    const have = hadCache || S.members.length > 0;
    toast(have ? 'সার্ভার এখন সাড়া দিচ্ছে না — সংরক্ষিত ডেটা দেখানো হচ্ছে' : 'সার্ভারের সাথে সংযোগ হয়নি। ইন্টারনেট দেখুন।', !have);
    if (autoRetry++ < 3) setTimeout(() => loadData(), 10000);   // পেছনে আবার চেষ্টা
  } finally { busy(false); loadingNow = false; }
}

/* ---------- সাইডমেনু ---------- */
const MENU = [
  { id: 'dashboard', t: 'ড্যাশবোর্ড', i: 'dash' },
  { id: 'about', t: 'সংস্থা তথ্য', i: 'org' },
  { g: 'members', t: 'সদস্য', i: 'users', ch: [{ id: 'memberEntry', t: 'সদস্য এন্ট্রি ফরম' }, { id: 'collection', t: 'সদস্য চাঁদা আদায়' }] },
  { id: 'special', t: 'বিশেষ', i: 'star' },
  { id: 'expense', t: 'খরচ', i: 'receipt' },
  { id: 'program', t: 'কর্মসূচি', i: 'committee' },
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
  if (id === 'memberEntry') { resetMemberForm(); resetFeeForm(); }
  if (id === 'collection') resetCollForm();
  if (id === 'special') resetSpecialForm();
  if (id === 'expense') resetExpForm();
  if (id === 'notices') showNoticeList();
  if (id === 'program') resetProgramForm();
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
  renderMembers(); renderFee(); fillMemberSelect(); renderColl(); renderSpecial(); renderExp();
  renderAbout(); renderCommittee(); renderNotices(); renderProgram(); fillReportYears(); renderReport(); renderCash(); renderLedger();
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
// মাসভিত্তিক ধার্য্যের সময়সূচি: সদস্য হওয়ার মাস থেকে প্রথম বৃদ্ধির আগ পর্যন্ত পূর্ব ধার্য্য, তারপর প্রতিটি বৃদ্ধির মাস থেকে নতুন ধার্য্য
function feeSegs(m) {
  const js = monthIdx(m.date); if (js === null) return [];
  const incs = S.feeChanges.filter(x => x.memberId === m.memberId).sort((a, b) => (parseInt(a.incNo) || 0) - (parseInt(b.incNo) || 0));
  const segs = [{ from: js, fee: incs.length ? num(incs[0].prevFee) : num(m.fee) }];
  incs.forEach(x => { const e = monthIdx(x.date); segs.push({ from: Math.max(js, e === null ? js : e), fee: num(x.newFee) }); });
  return segs;
}
function assessedTo(m, endIdx) {
  const segs = feeSegs(m); let total = 0;
  segs.forEach((s, k) => {
    const hi = Math.min(k + 1 < segs.length ? segs[k + 1].from - 1 : endIdx, endIdx);
    if (hi >= s.from) total += (hi - s.from + 1) * s.fee;
  });
  return total;
}
const calcAssessed = (m, asOf) => assessedTo(m, monthIdx(asOf || todayISO()));
const paidBy = (id, excludeId) => S.collections.filter(c => c.memberId === id && c.id !== excludeId).reduce((s, c) => s + num(c.paid), 0);
const dueOf = (m, asOf, excludeId) => calcAssessed(m, asOf) - paidBy(m.id, excludeId);

/* ---------- ড্যাশবোর্ড ---------- */
function renderDashboard() {
  const t = todayISO(), nowIdx = monthIdx(t), now = new Date();
  const inMonth = iso => monthIdx(iso) === nowIdx;
  let assessed = 0, due = 0, mAssessed = 0, mDue = 0;
  S.members.forEach(m => {
    const a = assessedTo(m, nowIdx), ma = a - assessedTo(m, nowIdx - 1);
    assessed += a; mAssessed += ma;
    due += Math.max(0, a - paidBy(m.id));
    const mp = S.collections.filter(c => c.memberId === m.memberId && inMonth(c.date)).reduce((s, c) => s + num(c.paid), 0);
    mDue += Math.max(0, ma - mp);     // চলতি মাসের বকেয়া = এ মাসের ধার্য্য − এ মাসে সদস্যের পরিশোধ
  });
  const noFee = S.members.filter(m => num(m.fee) <= 0).length;   // মাসিক ধার্য্য লেখা হয়নি এমন সদস্য
  const coll = sum(S.collections, 'paid'), spec = sum(S.special, 'amount'), spent = sum(S.expenses, 'total');
  const mColl = sum(S.collections.filter(c => inMonth(c.date)), 'paid');
  const mSpec = sum(S.special.filter(x => inMonth(x.date)), 'amount');
  const mSpent = sum(S.expenses.filter(x => inMonth(x.date)), 'total');
  const net = coll + spec - spent, mNet = mColl + mSpec - mSpent;
  const card = c => `<div class="stat ${c.c || ''}"><span>${icon(c.i, 18)}${c.l}</span><b>${c.v}</b>${c.s ? `<small>${c.s}</small>` : ''}</div>`;
  const netCard = (label, v) => ({ l: (v >= 0 ? 'উদ্বৃত্ত' : 'ঘাটতি') + label, v: taka(Math.abs(v)), i: 'chart', c: v >= 0 ? 'plus' : 'due' });
  const month = [
    { l: 'মোট ধার্য্য', v: taka(mAssessed), i: 'org' },
    { l: 'মোট আদায়', v: taka(mColl), i: 'receipt' },
    { l: 'মোট বকেয়া', v: taka(mDue), i: 'bell', c: 'due' },
    { l: 'মোট বিশেষ কালেকশন', v: taka(mSpec), i: 'star' },
    { l: 'মোট খরচ', v: taka(mSpent), i: 'receipt' },
    netCard(' (এ মাসের)', mNet)
  ];
  const total = [
    { l: 'মোট ধার্য্য', v: taka(assessed), i: 'org' },
    { l: 'মোট আদায়', v: taka(coll), i: 'receipt' },
    { l: 'মোট বকেয়া', v: taka(due), i: 'bell', c: 'due' },
    { l: 'মোট বিশেষ কালেকশন', v: taka(spec), i: 'star' },
    { l: 'মোট খরচ', v: taka(spent), i: 'receipt' },
    netCard(' (বর্তমান)', net),
    { l: 'বর্তমান ক্যাশ', v: taka(net), i: 'wallet', c: 'cash', s: 'সদস্য আদায় + বিশেষ কালেকশন − খরচ' }
  ];
  $('stats').innerHTML =
    `<div class="stats">${card({ l: 'মোট সদস্য', v: bn(S.members.length) + ' জন', i: 'users' })}${card({ l: 'মোট ধার্য্য হয়নি', v: bn(noFee) + ' জন', i: 'bell', c: noFee > 0 ? 'due' : '', s: 'মাসিক ধার্য্য লেখা হয়নি' })}</div>
     <h3 class="sec">চলতি মাস <small>${MONTHS[now.getMonth()]} ${bn(now.getFullYear())}</small></h3>
     <div class="stats">${month.map(card).join('')}</div>
     <h3 class="sec">সর্বমোট <small>শুরু থেকে আজ পর্যন্ত</small></h3>
     <div class="stats">${total.map(card).join('')}</div>`;
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
const CENTER_HEADS = ['ক্রম', 'রশিদ নং', 'ভাউচার নং', 'সদস্য আইডি', 'নোটিশ নং', 'বৃদ্ধি নং'];
function centerCols(root) {
  root.querySelectorAll('table').forEach(t => {
    const hr = t.tHead && t.tHead.rows[t.tHead.rows.length - 1]; if (!hr) return;
    const idx = [];
    let col = 0;
    Array.from(hr.cells).forEach(th => { if (CENTER_HEADS.includes(th.textContent.trim())) { idx.push(col); th.style.textAlign = 'center'; } col += th.colSpan; });
    if (!idx.length) return;
    Array.from(t.tBodies).forEach(tb => Array.from(tb.rows).forEach(r => {
      let c = 0;
      Array.from(r.cells).forEach(cell => { if (cell.colSpan === 1 && idx.includes(c)) cell.style.textAlign = 'center'; c += cell.colSpan; });
    }));
  });
}
let _cc = 0;
function watchCenter() {
  const main = document.querySelector('main.wrap'); if (!main) return;
  new MutationObserver(() => { cancelAnimationFrame(_cc); _cc = requestAnimationFrame(() => centerCols(main)); }).observe(main, { childList: true, subtree: true });
  centerCols(main);
}
function printDoc(html, bw) {
  $('printArea').innerHTML = bw ? '<div class="bw">' + html + '</div>' : html;
  centerCols($('printArea'));
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
    ${f.length ? `<h3>প্রতিষ্ঠাতাদের নাম ও ঠিকানা</h3><div class="tw"><table class="rt"><thead><tr><th>নাম</th><th>ঠিকানা</th></tr></thead><tbody>
      ${f.map(x => `<tr><td data-l="নাম">${esc(x.name)}</td><td data-l="ঠিকানা">${esc(x.address)}</td></tr>`).join('')}
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
    ${f.length ? `<div class="dt">প্রতিষ্ঠাতাদের নাম ও ঠিকানা</div><table><thead><tr><th>নাম</th><th>ঠিকানা</th></tr></thead><tbody>
      ${f.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.address)}</td></tr>`).join('')}</tbody></table>` : ''}
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
  $('mFee').readOnly = false;
  $('mTitle').textContent = 'নতুন সদস্য এন্ট্রি';
  $('mCancel').style.display = 'none'; closeForm('m');
}
const normName = s => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
function normMobile(s) {
  let d = en(s).replace(/\D/g, '');
  if (d.indexOf('880') === 0 && d.length === 13) d = '0' + d.slice(3);
  else if (d.length === 10 && d[0] === '1') d = '0' + d;
  return d;
}
async function saveMember() {
  const rec = {
    id: $('mId').value, date: $('mDate').value, name: $('mName').value.trim(),
    mobile: $('mMobile').value.trim(), occupation: $('mJob').value.trim(),
    fee: String(num($('mFee').value)), address: $('mAddr').value.trim()
  };
  if (!rec.date || !rec.name) { toast('তারিখ ও নাম আবশ্যক', true); return; }
  // ডাবল এন্ট্রি প্রতিরোধ: নাম ও মোবাইল নং মিলিয়ে দেখা
  const nm = normName(rec.name), mb = normMobile(rec.mobile);
  const others = S.members.filter(m => m.id !== rec.id);
  const same = others.find(m => normName(m.name) === nm && normMobile(m.mobile) === mb);
  if (same) { toast('এই সদস্য আগে থেকেই আছেন: ' + same.name + ' (' + same.memberId + ')', true); return; }
  const sameMob = mb && others.find(m => normMobile(m.mobile) === mb);
  if (sameMob && !confirm('এই মোবাইল নম্বরটি আগে থেকেই "' + sameMob.name + '" (' + sameMob.memberId + ') এর নামে আছে।\nতবুও নতুন সদস্য হিসেবে সংরক্ষণ করবেন?')) return;
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
  $('mFee').readOnly = S.feeChanges.some(x => x.memberId === m.memberId);
  $('mTitle').textContent = 'সদস্য তথ্য সংশোধন';
  $('mCancel').style.display = ''; openForm('m');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function delMember(id) {
  const m = findMember(id); if (!m) return;
  if (S.collections.some(c => c.memberId === id)) { toast('এই সদস্যের চাঁদা আদায়ের রেকর্ড আছে। আগে সেগুলো মুছুন।', true); return; }
  if (!confirm('"' + m.name + '" কে মুছে ফেলবেন?')) return;
  const j = await api({ action: 'delete', sheet: 'Members', id }); if (!j) return;
  S.members = S.members.filter(x => x.id !== id); S.feeChanges = S.feeChanges.filter(x => x.memberId !== id); cacheSave();
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
    S.members.slice().sort(bySerial).map(m => `<option value="${m.id}">${esc(m.name)} (${esc(m.memberId)})</option>`).join('');
  sel.value = cur;
}
function resetCollForm() {
  $('cId').value = '';
  $('cReceipt').value = bn(nextNo(S.collections, 'receiptNo'));
  $('cDate').value = todayISO();
  fillMemberSelect(); $('cMember').value = '';
  ['cSerial', 'cMobile', 'cAddr', 'cFee', 'cDue', 'cPaid', 'cRemain'].forEach(i => $(i).value = '');
  $('cTitle').textContent = 'নতুন চাঁদা আদায়';
  $('cCancel').style.display = 'none'; closeForm('c');
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
  $('cCancel').style.display = ''; openForm('c');
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
  const rows = S.collections.slice().sort(byNo('receiptNo')).filter(c => !q || has(q, [c.receiptNo, collName(c), c.memberId, c.mobile]));
  $('cBody').innerHTML = rows.length ? rows.map(c => `<tr>
    <td data-l="রশিদ নং">${bn(c.receiptNo)}</td><td data-l="তারিখ">${fdate(c.date)}</td><td data-l="সদস্য আইডি">${esc(c.memberId)}</td><td data-l="নাম"><b>${esc(collName(c))}</b></td>
    <td data-l="ধার্য্য">${taka(c.fee)}</td><td data-l="পূর্ব বকেয়া">${taka(c.dueBefore)}</td><td data-l="পরিশোধ"><b>${taka(c.paid)}</b></td>
    <td class="act"><button class="ib" title="এডিট" onclick="editColl('${c.id}')">${icon('edit', 17)}</button><button class="ib" title="প্রিন্ট" onclick="printReceipt('${c.id}')">${icon('print', 17)}</button><button class="ib" title="শেয়ার" onclick="openShare('coll','${c.id}')">${icon('share', 17)}</button><button class="ib del" title="ডিলেট" onclick="delColl('${c.id}')">${icon('trash', 17)}</button></td></tr>`).join('')
    : '<tr><td colspan="8" class="empty">কোনো আদায় পাওয়া যায়নি</td></tr>';
}
function receiptHtml(c, copy) {
  const remain = num(c.dueBefore) - num(c.paid);
  return `<div class="rcpt">${docHeader(true)}
    <div class="dt u" style="margin:4px 0"><span>জমা রশিদ</span>${copy ? `<span class="cp">${copy}</span>` : ''}</div>
    <div class="meta"><span>রশিদ নং: <b>${bn(c.receiptNo)}</b></span><span>তারিখ: <b>${fdate(c.date)}</b></span></div>
    <table class="kvt">
      <tr><td>সদস্যের নাম</td><td>${esc(collName(c))} (${esc(c.memberId)})</td></tr>
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
  const rows = S.collections.slice().sort(byNo('receiptNo'));
  printDoc(docHeader() + `<div class="dt u"><span>সদস্য চাঁদা আদায় তালিকা</span></div>
    <table><thead><tr><th>রশিদ নং</th><th>তারিখ</th><th>সদস্য আইডি</th><th>নাম</th><th class="r">ধার্য্য</th><th class="r">পূর্ব বকেয়া</th><th class="r">পরিশোধ</th></tr></thead><tbody>
    ${rows.map(c => `<tr><td>${bn(c.receiptNo)}</td><td>${fdate(c.date)}</td><td>${esc(c.memberId)}</td><td>${esc(collName(c))}</td><td class="r">${bn(num(c.fee))}</td><td class="r">${bn(num(c.dueBefore))}</td><td class="r">${bn(num(c.paid))}</td></tr>`).join('')}
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
  $('sCancel').style.display = 'none'; closeForm('s');
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
  $('sCancel').style.display = ''; openForm('s');
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
  const rows = S.special.slice().sort(byNo('receiptNo')).filter(x => !q || has(q, [x.receiptNo, x.name, x.mobile, x.description]));
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
  const rows = S.special.slice().sort(byNo('receiptNo'));
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
      text: `${org}\nজমা রশিদ নং: ${bn(c.receiptNo)}\nতারিখ: ${fdate(c.date)}\nসদস্য: ${collName(c)} (${c.memberId})\nপরিশোধ: ${taka(c.paid)}\nঅবশিষ্ট বকেয়া: ${taka(num(c.dueBefore) - num(c.paid))}\nধন্যবাদ।`
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
  fnd: { noNo: true, tb: 'stFounders', cols: [{ k: 'name', ph: 'নাম' }, { k: 'address', ph: 'ঠিকানা' }], rows: [], blank: { name: '', address: '' } },
  cmt: { noNo: true, tb: 'cfRows', cols: [{ k: 'post', ph: 'পদবি' }, { k: 'name', ph: 'নাম' }, { k: 'mobile', ph: 'মোবাইল নং', attr: 'type="tel" inputmode="tel"' }], rows: [], blank: { post: '', name: '', mobile: '' } }
};
function dynRender(key) {
  const d = DYN[key];
  $(d.tb).innerHTML = d.rows.map((r, i) => `<tr>${d.noNo ? '' : `<td class="c">${bn(i + 1)}</td>`}` +
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
  dynLoad('exp', []);
  $('eTitle').textContent = 'নতুন খরচ ভাউচার';
  $('eCancel').style.display = 'none'; closeForm('e');
}
function calcExp() {
  const total = DYN.exp.rows.reduce((s, r) => s + num(r.amt), 0);
  $('eTotal').textContent = taka(total);
}
async function saveExp() {
  const items = DYN.exp.rows.filter(r => r.desc.trim() || num(r.amt)).map(r => ({ d: r.desc.trim(), a: num(r.amt) }));
  if (!$('eDate').value) { toast('তারিখ দিন', true); return; }
  if (!items.length) { toast('কমপক্ষে একটি খরচের বিবরণ দিন', true); return; }
  const total = items.reduce((s, r) => s + r.a, 0);
  const rec = { id: $('eId').value, date: $('eDate').value, items: JSON.stringify(items), total: String(total) };
  const j = await api({ action: 'save', sheet: 'Expenses', record: rec }); if (!j) return;
  upsert(S.expenses, j.record); cacheSave();
  resetExpForm(); refreshAll(); toast('ভাউচার সংরক্ষিত হয়েছে');
  if (confirm('ভাউচার প্রিন্ট করবেন?')) printVoucher(j.record.id);
}
function editExp(id) {
  const x = S.expenses.find(v => v.id === id); if (!x) return;
  $('eId').value = x.id; $('eVoucher').value = bn(x.voucherNo); $('eDate').value = x.date;
  dynLoad('exp', parseJ(x.items, []).map(i => ({ desc: i.d, amt: String(i.a) })));
  calcExp();
  $('eTitle').textContent = 'খরচ ভাউচার সংশোধন';
  $('eCancel').style.display = ''; openForm('e');
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
  const rows = S.expenses.slice().sort(byNo('voucherNo')).filter(x => !q || has(q, [x.voucherNo, x.items]));
  $('eBody').innerHTML = rows.length ? rows.map(x => `<tr>
    <td data-l="ভাউচার নং">${bn(x.voucherNo)}</td><td data-l="তারিখ">${fdate(x.date)}</td><td data-l="সর্বমোট"><b>${taka(x.total)}</b></td>
    <td class="act"><button class="ib" title="এডিট" onclick="editExp('${x.id}')">${icon('edit', 17)}</button><button class="ib" title="প্রিন্ট" onclick="printVoucher('${x.id}')">${icon('print', 17)}</button><button class="ib del" title="ডিলেট" onclick="delExp('${x.id}')">${icon('trash', 17)}</button></td></tr>`).join('')
    : '<tr><td colspan="4" class="empty">কোনো ভাউচার পাওয়া যায়নি</td></tr>';
}
function printVoucher(id) {
  const x = S.expenses.find(v => v.id === id); if (!x) return;
  const items = parseJ(x.items, []);
  printDoc(docHeader() + `<div class="dt u"><span>খরচ ভাউচার</span></div>
    <div class="meta"><span>ভাউচার নং: <b>${bn(x.voucherNo)}</b></span><span>তারিখ: <b>${fdate(x.date)}</b></span></div>
    <table><thead><tr><th style="width:60px">ক্রম</th><th>বিবরণ</th><th class="r" style="width:130px">টাকা</th></tr></thead><tbody>
    ${items.map((i, n) => `<tr><td>${bn(n + 1)}</td><td>${esc(i.d)}</td><td class="r">${bn(num(i.a))}</td></tr>`).join('')}
    </tbody></table>
    <table class="sum"><tr><td><b>সর্বমোট</b></td><td class="r"><b>${taka(x.total)}</b></td></tr></table>
    ${sigBlock('ক্যাশিয়ার', 'সভাপতি')}`);
}
function printExpList() {
  const rows = S.expenses.slice().sort(byNo('voucherNo'));
  printDoc(docHeader() + `<div class="dt u"><span>খরচের তালিকা</span></div>
    <table><thead><tr><th>ভাউচার নং</th><th>তারিখ</th><th>বিবরণ</th><th class="r">সর্বমোট</th></tr></thead><tbody>
    ${rows.map(x => `<tr><td>${bn(x.voucherNo)}</td><td>${fdate(x.date)}</td><td>${esc(parseJ(x.items, []).map(i => i.d).filter(Boolean).join(', '))}</td><td class="r">${bn(num(x.total))}</td></tr>`).join('')}
    <tr><td colspan="3" class="r"><b>সর্বমোট</b></td><td class="r"><b>${bn(sum(rows, 'total'))}</b></td></tr>
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
    const a = assessedTo(mm, Math.min(pe, now));
    const p = S.collections.filter(c => c.memberId === mm.memberId && upto(c.date)).reduce((s, c) => s + num(c.paid), 0);
    assessed += a; due += Math.max(0, a - p);
  });
  const coll = sum(S.collections.filter(c => upto(c.date)), 'paid');
  const spec = sum(S.special.filter(x => upto(x.date)), 'amount');
  const exp = sum(S.expenses.filter(x => upto(x.date)), 'total');
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
    <table><thead><tr><th>বিবরণ</th><th class="r" style="width:160px">টাকা</th></tr></thead><tbody>
    ${v.rows.map(r => `<tr><td>${r[0]}</td><td class="r"><b>${taka(r[1])}</b></td></tr>`).join('')}
    </tbody></table><div class="foot" style="text-align:left">${REPORT_NOTE}</div>${sigBlock('ক্যাশিয়ার', 'সভাপতি')}${listFoot()}`, true);
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
    desc: collName(c) + ' (' + c.memberId + ')', amt: num(c.paid)
  }));
  S.special.forEach(x => inc.push({
    d: x.date, no: 'বি-' + bn(x.receiptNo), n: parseInt(x.receiptNo) || 0, ord: 1,
    head: (x.description || '').trim() || 'বিশেষ কালেকশন', desc: x.name, amt: num(x.amount)
  }));
  S.expenses.forEach(v => {
    const n = parseInt(v.voucherNo) || 0;
    parseJ(v.items, []).forEach(i => {
      const h = (i.d || '').trim() || 'অন্যান্য';
      exp.push({ d: v.date, no: bn(v.voucherNo), n, ord: 0, head: h, desc: h, amt: num(i.a) });
    });
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
  return `<tr class="net"><td colspan="${cols}" class="r">${ti >= te ? 'উদ্বৃত্ত' : 'ঘাটতি'} (আয় − ব্যয়): ${taka(Math.abs(ti - te))}</td></tr>`;
}
const HEAD_FIRST = 'সদস্য চাঁদা';
// খাত অনুযায়ী ভাগ: "সদস্য চাঁদা" আগে, বাকিগুলো প্রথম আসার ক্রমে
function groupByHead(list) {
  const order = [], mp = {};
  list.forEach(x => { if (!mp[x.head]) { mp[x.head] = []; order.push(x.head); } mp[x.head].push(x); });
  order.sort((a, b) => (a === HEAD_FIRST ? 0 : 1) - (b === HEAD_FIRST ? 0 : 1));
  return order.map(h => ({ head: h, items: mp[h] }));
}
function cashCells(L) {
  if (!L || L.t === 'blank') return '<td></td><td></td><td></td>';
  if (L.t === 'head') return `<td colspan="3" class="hd">${esc(L.text)}</td>`;
  if (L.t === 'sub') return `<td colspan="2" class="r st">${esc(L.text)}</td><td class="r st">${amt(L.v)}</td>`;
  return `<td>${L.x.no}</td><td>${esc(L.x.desc)}</td><td class="r">${amt(L.x.amt)}</td>`;
}
function cashHtml(s) {
  const e = rpEntries();
  const inc = e.inc.filter(x => inPeriod(x, s)), exp = e.exp.filter(x => inPeriod(x, s));
  // গত মাস/বছর পর্যন্ত জের (আয় − ব্যয়)
  const start = s.type === 'month' ? s.y * 12 + s.m - 1 : s.type === 'year' ? s.y * 12 : null;
  const before = x => { const i = monthIdx(x.d); return start !== null && i !== null && i < start; };
  const prevNet = start === null ? 0 : sum(e.inc.filter(before), 'amt') - sum(e.exp.filter(before), 'amt');
  if (!inc.length && !exp.length && !prevNet) return '<div class="empty">এই সময়ে কোনো লেনদেন নেই</div>';

  // আয়: প্রতিটি খাতের হেডার → এন্ট্রি → "মোট" সারি → ফাঁকা সারি
  const left = [];
  groupByHead(inc).forEach((g, gi) => {
    if (gi) left.push({ t: 'blank' });
    left.push({ t: 'head', text: g.head });
    g.items.forEach(x => left.push({ t: 'row', x }));
    left.push({ t: 'sub', text: 'মোট ' + g.head, v: sum(g.items, 'amt') });
  });
  const right = exp.map(x => ({ t: 'row', x }));
  const n = Math.max(left.length, right.length);
  while (left.length < n) left.push({ t: 'blank' });
  while (right.length < n) right.push({ t: 'blank' });
  let r = '';
  for (let i = 0; i < n; i++) r += `<tr>${cashCells(left[i])}${SBS_GAP}${cashCells(right[i])}</tr>`;

  // নিচের যোগফল অংশ: দুই দিকের সারি একই লাইনে
  const ti = sum(inc, 'amt'), te = sum(exp, 'amt');
  const TI = ti + Math.max(prevNet, 0), TE = te + Math.max(-prevNet, 0);
  const per = s.type === 'month' ? 'গত মাসের' : 'গত বছরের';
  const pairs = [];
  if (s.type !== 'all') pairs.push([{ t: 'sub', text: 'সবখাতের যোগফল', v: ti }, { t: 'sub', text: 'মোট খরচ', v: te }]);
  if (prevNet > 0) pairs.push([{ t: 'sub', text: per + ' উদ্বৃত্ত', v: prevNet }, null]);
  if (prevNet < 0) pairs.push([null, { t: 'sub', text: per + ' ঘাটতি', v: -prevNet }]);
  pairs.push([{ t: 'sub', text: 'সর্বমোট আয়', v: TI }, { t: 'sub', text: 'সর্বমোট ব্যয়', v: TE }]);
  pairs.forEach(pr => { r += `<tr class="tt">${cashCells(pr[0])}${SBS_GAP}${cashCells(pr[1])}</tr>`; });

  return `<table class="sbs"><colgroup><col style="width:9%"><col style="width:29%"><col style="width:11%"><col style="width:2%"><col style="width:9%"><col style="width:29%"><col style="width:11%"></colgroup><thead>
    <tr><th colspan="3" class="c">আয়</th><th class="gap"></th><th colspan="3" class="c">ব্যয়</th></tr>
    <tr><th>রশিদ নং</th><th>বিবরণ</th><th class="r">টাকা</th><th class="gap"></th><th>ভাউচার নং</th><th>বিবরণ</th><th class="r">টাকা</th></tr></thead>
    <tbody>${r}
    <tr class="net"><td colspan="7" class="r">বর্তমান ${TI >= TE ? 'উদ্বৃত্ত' : 'ঘাটতি'}: ${taka(Math.abs(TI - TE))}</td></tr></tbody></table>`;
}
function renderCash() {
  if (!$('crOut')) return;
  const s = rpSel('cr'), m = rpMeta('cr', s);
  $('crTitle').textContent = m.title; $('crSub').textContent = m.sub;
  $('crOut').innerHTML = cashHtml(s);
}

// লেজার: মাসিক = খাত ও মোট; বাৎসরিক = খাত, তার নিচে মাসভিত্তিক মোট; সর্বমোট = খাত, তার নিচে বছরভিত্তিক মোট
function ledgerSide(list, s) {
  const byTot = (heads, tot) => Object.keys(heads).sort((a, b) => (a === HEAD_FIRST ? 0 : 1) - (b === HEAD_FIRST ? 0 : 1) || tot(b) - tot(a));
  if (s.type === 'month') {
    const mp = {};
    list.forEach(x => { mp[x.head] = (mp[x.head] || 0) + x.amt; });
    return byTot(mp, h => mp[h]).map(h => ({ t: 'row', a: h, b: mp[h] }));
  }
  const keyOf = s.type === 'year' ? x => monthIdx(x.d) : x => Math.floor(monthIdx(x.d) / 12);
  const label = k => s.type === 'year' ? MONTHS[k % 12] : bn(k) + ' সাল';
  const heads = {};
  list.forEach(x => {
    const h = heads[x.head] = heads[x.head] || { tot: 0, per: {} }, k = keyOf(x);
    h.tot += x.amt; h.per[k] = (h.per[k] || 0) + x.amt;
  });
  const lines = [];
  byTot(heads, h => heads[h].tot).forEach((h, i) => {
    if (i) lines.push({ t: 'blank' });
    lines.push({ t: 'head', a: h });
    Object.keys(heads[h].per).map(Number).sort((a, b) => a - b).forEach(k => lines.push({ t: 'row', a: label(k), b: heads[h].per[k] }));
  });
  return lines;
}
function ledgerHtml(s) {
  const e = rpEntries(), inc = e.inc.filter(x => inPeriod(x, s)), exp = e.exp.filter(x => inPeriod(x, s));
  if (!inc.length && !exp.length) return '<div class="empty">এই সময়ে কোনো লেনদেন নেই</div>';
  const L = ledgerSide(inc, s), R = ledgerSide(exp, s);
  const cell = x => !x || x.t === 'blank' ? '<td></td><td></td>'
    : x.t === 'head' ? `<td colspan="2" class="hd">${esc(x.a)}</td>`
    : `<td>${esc(x.a)}</td><td class="r">${amt(x.b)}</td>`;
  let r = '';
  for (let i = 0, n = Math.max(L.length, R.length); i < n; i++) r += `<tr>${cell(L[i])}${SBS_GAP}${cell(R[i])}</tr>`;
  const ti = sum(inc, 'amt'), te = sum(exp, 'amt');
  const col = { month: 'খাত', year: 'খাত / মাস', all: 'খাত / বছর' }[s.type];
  return `<table class="sbs"><colgroup><col style="width:34%"><col style="width:15%"><col style="width:2%"><col style="width:34%"><col style="width:15%"></colgroup><thead>
    <tr><th colspan="2" class="c">আয়</th><th class="gap"></th><th colspan="2" class="c">ব্যয়</th></tr>
    <tr><th>${col}</th><th class="r">টাকা</th><th class="gap"></th><th>${col}</th><th class="r">টাকা</th></tr></thead>
    <tbody>${r}
    <tr class="tt"><td class="r">সর্বমোট আয়</td><td class="r">${amt(ti)}</td>${SBS_GAP}<td class="r">সর্বমোট ব্যয়</td><td class="r">${amt(te)}</td></tr>
    <tr class="net"><td colspan="5" class="r">বর্তমান ${ti >= te ? 'উদ্বৃত্ত' : 'ঘাটতি'}: ${taka(Math.abs(ti - te))}</td></tr></tbody></table>`;
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
    ${tbl}${sigBlock('ক্যাশিয়ার', 'সভাপতি')}${listFoot()}`, true);
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
    <div class="tw"><table class="rt"><thead><tr><th>পদবি</th><th>নাম</th><th>মোবাইল নং</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td data-l="পদবি"><b>${esc(r.post)}</b></td><td data-l="নাম">${esc(r.name)}</td><td data-l="মোবাইল">${bn(esc(r.mobile))}</td></tr>`).join('')}
    </tbody></table></div>`;
}
function printCommittee() {
  const s = S.settings, rows = parseJ(s.committeeMembers, []).filter(r => r.post || r.name || r.mobile);
  printDoc(docHeader() + `<div class="dt u"><span>কার্যনির্বাহী কমিটি</span></div>
    <div class="meta"><span>গঠনের তারিখ: <b>${fdate(s.committeeDate)}</b></span><span>মেয়াদকাল: <b>${bn(esc(s.committeeTerm || ''))}</b></span></div>
    <table><thead><tr><th>পদবি</th><th>নাম</th><th>মোবাইল নং</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${esc(r.post)}</td><td>${esc(r.name)}</td><td>${bn(esc(r.mobile))}</td></tr>`).join('')}
    </tbody></table>${listFoot()}`);
}

/* =====================================================================
   নোটিশ (দেখা ও প্রিন্ট)
   ===================================================================== */
const sortedNotices = () => S.notices.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '') || (parseInt(a.noticeNo) || 0) - (parseInt(b.noticeNo) || 0));
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

/* =====================================================================
   কর্মসূচি
   ===================================================================== */
function resetProgramForm() {
  $('pgId').value = '';
  $('pgSerial').value = bn(nextNo(S.programs, 'serial'));
  $('pgDate').value = todayISO();
  ['pgName', 'pgSponsor', 'pgBenef'].forEach(i => $(i).value = '');
  $('pgTitle').textContent = 'নতুন কর্মসূচি';
  $('pgCancel').style.display = 'none';
  closeForm('pg');
}
async function saveProgram() {
  const rec = {
    id: $('pgId').value, name: $('pgName').value.trim(), date: $('pgDate').value,
    sponsor: $('pgSponsor').value.trim(), beneficiary: $('pgBenef').value.trim()
  };
  if (!rec.name || !rec.date) { toast('কর্মসূচির নাম ও তারিখ আবশ্যক', true); return; }
  const j = await api({ action: 'save', sheet: 'Programs', record: rec }); if (!j) return;
  upsert(S.programs, j.record); cacheSave();
  resetProgramForm(); refreshAll(); toast('কর্মসূচি সংরক্ষিত হয়েছে');
}
function editProgram(id) {
  const x = S.programs.find(v => v.id === id); if (!x) return;
  $('pgId').value = x.id; $('pgSerial').value = bn(x.serial); $('pgName').value = x.name;
  $('pgDate').value = x.date; $('pgSponsor').value = x.sponsor; $('pgBenef').value = x.beneficiary;
  $('pgTitle').textContent = 'কর্মসূচি সংশোধন';
  $('pgCancel').style.display = '';
  openForm('pg');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function delProgram(id) {
  if (!confirm('এই কর্মসূচি মুছে ফেলবেন?')) return;
  const j = await api({ action: 'delete', sheet: 'Programs', id }); if (!j) return;
  S.programs = S.programs.filter(x => x.id !== id); cacheSave();
  if ($('pgId').value === id) resetProgramForm();
  refreshAll(); toast('মুছে ফেলা হয়েছে');
}
function renderProgram() {
  if (!$('pgBody')) return;
  const q = query('pgSearch');
  const rows = S.programs.slice().sort(byNo('serial')).filter(x => !q || has(q, [x.serial, x.name, x.sponsor, x.beneficiary]));
  $('pgBody').innerHTML = rows.length ? rows.map(x => `<tr>
    <td data-l="ক্রম">${bn(x.serial)}</td><td data-l="কর্মসূচির নাম"><b>${esc(x.name)}</b></td><td data-l="তারিখ">${fdate(x.date)}</td>
    <td data-l="স্পন্সর">${esc(x.sponsor)}</td><td data-l="উপকৃত হয়েছে">${esc(x.beneficiary)}</td>
    <td class="act"><button class="ib" title="এডিট" onclick="editProgram('${x.id}')">${icon('edit', 17)}</button><button class="ib" title="প্রিন্ট" onclick="printProgram('${x.id}')">${icon('print', 17)}</button><button class="ib del" title="ডিলেট" onclick="delProgram('${x.id}')">${icon('trash', 17)}</button></td></tr>`).join('')
    : '<tr><td colspan="6" class="empty">কোনো কর্মসূচি পাওয়া যায়নি</td></tr>';
}
function printProgram(id) {
  const x = S.programs.find(v => v.id === id); if (!x) return;
  printDoc(docHeader() + `<div class="dt u"><span>কর্মসূচি</span></div>
    <table class="kvt">
      <tr><td>ক্রম</td><td>${bn(x.serial)}</td></tr>
      <tr><td>কর্মসূচির নাম</td><td>${esc(x.name)}</td></tr>
      <tr><td>তারিখ</td><td>${fdate(x.date)}</td></tr>
      <tr><td>স্পন্সর</td><td>${esc(x.sponsor)}</td></tr>
      <tr><td>উপকৃত হয়েছে</td><td>${esc(x.beneficiary)}</td></tr>
    </table>${listFoot()}`);
}
function printProgramList() {
  const rows = S.programs.slice().sort(byNo('serial'));
  printDoc(docHeader() + `<div class="dt u"><span>কর্মসূচি তালিকা</span></div>
    <table><thead><tr><th>ক্রম</th><th>কর্মসূচির নাম</th><th>তারিখ</th><th>স্পন্সর</th><th>উপকৃত হয়েছে</th></tr></thead><tbody>
    ${rows.map(x => `<tr><td>${bn(x.serial)}</td><td>${esc(x.name)}</td><td>${fdate(x.date)}</td><td>${esc(x.sponsor)}</td><td>${esc(x.beneficiary)}</td></tr>`).join('')}
    </tbody></table>${listFoot()}`);
}

/* =====================================================================
   ধার্য্য বৃদ্ধি
   ===================================================================== */
const FI = {};   // সদস্যভিত্তিক লেখা মান: { inc, date } (রিফ্রেশে হারাবে না)
let feeAllBusy = false;
const lastFeeNo = mid => S.feeChanges.filter(x => x.memberId === mid).reduce((m, x) => Math.max(m, parseInt(x.incNo) || 0), 0);

function renderFee() {
  if (!$('fBody')) return;
  const q = query('fSearch');
  const rows = S.members.slice().sort(bySerial).filter(m => !q || has(q, [m.memberId, m.name, m.mobile, m.address]));
  $('fBody').innerHTML = rows.length ? rows.map(m => {
    const st = FI[m.id] || {}, inc = st.inc || '', date = st.date || todayISO();
    return `<tr>
      <td data-l="নাম (আইডি)"><b>${esc(m.name)}</b> (${esc(m.memberId)})</td>
      <td data-l="মোবাইল নং">${bn(esc(m.mobile))}</td><td data-l="ঠিকানা">${esc(m.address)}</td>
      <td data-l="পূর্ব ধার্য্য">${taka(m.fee)}</td>
      <td data-l="বৃদ্ধির পরিমাণ"><input inputmode="decimal" value="${esc(inc)}" placeholder="০" oninput="onFeeInput('${m.id}','inc',this.value)"></td>
      <td data-l="নতুন ধার্য্য"><b id="fn-${m.id}">${num(inc) > 0 ? taka(num(m.fee) + num(inc)) : '—'}</b></td>
      <td data-l="তারিখ"><input type="date" value="${esc(date)}" onchange="onFeeInput('${m.id}','date',this.value)"></td>
      <td class="act"><button class="btn sm" onclick="saveFee('${m.id}')">এন্ট্রি</button></td></tr>`;
  }).join('') : '<tr><td colspan="8" class="empty">কোনো সদস্য পাওয়া যায়নি</td></tr>';

  const hist = S.feeChanges.slice().sort(byNo('incNo'));
  $('fhBody').innerHTML = hist.length ? hist.map(x => {
    const mm = findMember(x.memberId), latest = (parseInt(x.incNo) || 0) === lastFeeNo(x.memberId);
    return `<tr><td data-l="বৃদ্ধি নং">${bn(x.incNo)}</td><td data-l="তারিখ">${fdate(x.date)}</td><td data-l="সদস্য আইডি">${esc(x.memberId)}</td>
      <td data-l="নাম">${esc(mm ? mm.name : x.name)}</td><td data-l="পূর্ব ধার্য্য">${taka(x.prevFee)}</td><td data-l="বৃদ্ধি">${taka(x.increase)}</td><td data-l="নতুন ধার্য্য"><b>${taka(x.newFee)}</b></td>
      <td class="act">${latest ? `<button class="ib del" title="ডিলেট" onclick="delFee('${x.id}')">${icon('trash', 17)}</button>` : ''}</td></tr>`;
  }).join('') : '<tr><td colspan="8" class="empty">এখনও কোনো ধার্য্য বৃদ্ধি নেই</td></tr>';
}
function onFeeInput(id, field, v) {
  const st = FI[id] = FI[id] || {};
  st[field] = v;
  if (field === 'inc') {
    const m = findMember(id), el = $('fn-' + id);
    if (m && el) el.textContent = num(v) > 0 ? taka(num(m.fee) + num(v)) : '—';
  }
}
function fillAllFee() {
  const v = $('fAll').value;
  if (num(v) <= 0) { toast('সবার জন্য বৃদ্ধির পরিমাণ লিখুন', true); return; }
  const q = query('fSearch');
  S.members.forEach(m => {
    if (q && !has(q, [m.memberId, m.name, m.mobile, m.address])) return;
    (FI[m.id] = FI[m.id] || {}).inc = String(num(v));
  });
  renderFee();
}
async function saveFee(id, quiet) {
  const m = findMember(id); if (!m) return false;
  const st = FI[id] || {}, inc = num(st.inc), date = st.date || todayISO();
  if (inc <= 0) { toast('"' + m.name + '" এর বৃদ্ধির পরিমাণ লিখুন', true); return false; }
  if (date.slice(0, 7) < String(m.date).slice(0, 7)) { toast('"' + m.name + '": সদস্য হওয়ার তারিখের আগের তারিখ দেওয়া যাবে না', true); return false; }
  const lastDate = S.feeChanges.filter(x => x.memberId === m.memberId).reduce((a, x) => (x.date > a ? x.date : a), '');
  if (lastDate && date.slice(0, 7) < lastDate.slice(0, 7)) { toast('"' + m.name + '": আগের বৃদ্ধির তারিখের আগের তারিখ দেওয়া যাবে না', true); return false; }
  const j = await api({ action: 'save', sheet: 'FeeChanges', record: { memberId: m.memberId, date, increase: String(inc) } });
  if (!j) return false;
  upsert(S.feeChanges, j.record);
  if (j.member) { j.member.id = j.member.memberId; upsert(S.members, j.member); }
  delete FI[id]; cacheSave(); refreshAll();
  if (!quiet) toast('ধার্য্য বৃদ্ধি সংরক্ষিত হয়েছে');
  return true;
}
async function saveFeeAll() {
  if (feeAllBusy) return;
  const ids = S.members.filter(m => num((FI[m.id] || {}).inc) > 0).map(m => m.id);
  if (!ids.length) { toast('কোনো সদস্যের বৃদ্ধির পরিমাণ লেখা হয়নি', true); return; }
  if (!confirm(bn(ids.length) + ' জন সদস্যের ধার্য্য বৃদ্ধি সংরক্ষণ করবেন?')) return;
  feeAllBusy = true;
  let ok = 0;
  try { for (const id of ids) { if (!(await saveFee(id, true))) break; ok++; } }
  finally { feeAllBusy = false; }
  toast(bn(ok) + 'টি ধার্য্য বৃদ্ধি সংরক্ষিত হয়েছে', ok !== ids.length);
}
async function delFee(id) {
  if (!confirm('এই ধার্য্য বৃদ্ধি মুছে ফেলবেন? সদস্যের ধার্য্য আগের মানে ফিরে যাবে।')) return;
  const j = await api({ action: 'delete', sheet: 'FeeChanges', id }); if (!j) return;
  S.feeChanges = S.feeChanges.filter(x => x.id !== id);
  if (j.member) { j.member.id = j.member.memberId; upsert(S.members, j.member); }
  cacheSave(); refreshAll(); toast('মুছে ফেলা হয়েছে');
}
function resetFeeForm() {
  Object.keys(FI).forEach(k => delete FI[k]);
  if ($('fAll')) $('fAll').value = '';
  if ($('fSearch')) $('fSearch').value = '';
  renderFee(); closeForm('f');
}

/* ---------- ফরম খোলা/বন্ধ (বাটন) ---------- */
function openForm(p) { if (p === 'f') closeForm('m'); if (p === 'm') closeForm('f'); $(p + 'FormCard').classList.add('open'); $(p + 'Tog').setAttribute('aria-expanded', 'true'); }
function closeForm(p) { const c = $(p + 'FormCard'); if (!c) return; c.classList.remove('open'); $(p + 'Tog').setAttribute('aria-expanded', 'false'); }
function toggleForm(p) {
  if ($(p + 'FormCard').classList.contains('open')) ({ m: resetMemberForm, c: resetCollForm, s: resetSpecialForm, e: resetExpForm, f: resetFeeForm, pg: resetProgramForm })[p]();
  else openForm(p);
}

/* ---------- শুরু ---------- */
function hydrateIcons() {
  document.querySelectorAll('i[data-ic]').forEach(e => { e.outerHTML = icon(e.dataset.ic, 18); });
}
// অ্যাপে ফিরে এলে (২ মিনিটের বেশি পর) ডেটা নতুন করে আনা
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastLoad > 120000 && !writing) loadData(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSide(); closePw(); closeShare(); } });
document.addEventListener('DOMContentLoaded', () => {
  hydrateIcons(); buildMenu(); watchCenter();
  resetMemberForm(); resetCollForm(); resetSpecialForm(); resetExpForm(); initReport(); initRp('cr'); initRp('lg');
  loadData(true);
});
