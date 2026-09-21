/**
 * সংস্থা ব্যবস্থাপনা সিস্টেম — Google Apps Script API (সংস্করণ ২)
 *
 * ব্যবহারবিধি:
 * 1) একটি Google Sheet খুলুন → Extensions → Apps Script
 * 2) এই কোড পুরোটা বসান, Save করুন
 * 3) setup ফাংশন একবার Run করুন (অনুমতি দিন)
 *      — আগের সংস্করণের ডেটা থাকলে setup নিজেই নতুন কাঠামোতে রূপান্তর করে দেবে
 * 4) Deploy → Manage deployments → Edit → New version → Deploy
 *      (প্রথমবার হলে: New deployment → Web app, Execute as: Me, Access: Anyone)
 * 5) Web app URL কপি করে app.js এর API_URL এ বসান
 *
 * ডিফল্ট ব্যবস্থাপনা পাসওয়ার্ড: admin123  (সেটাপ ফরম থেকে পরিবর্তন করুন)
 *
 * শীটে শুধু ফরমের ফিল্ডগুলোই কলাম হিসেবে থাকে; আলাদা id কলাম নেই।
 * প্রতিটি শীটের প্রথম কলামই রেকর্ডের নম্বর/আইডি (সদস্য আইডি, রশিদ নং, ভাউচার নং, নোটিশ নং)।
 */

var ID_PREFIX = 'ASP';          // সদস্য আইডির শুরু, যেমন ASP0001 (app.js এর ID_PREFIX এর সাথে মিল রাখুন)
var DEFAULT_PASSWORD = 'admin123';

// key = কোডে ব্যবহৃত নাম (ক্রম গুরুত্বপূর্ণ), label = শীটের হেডার
var SHEETS = {
  Members: {
    keys:   ['memberId', 'date', 'name', 'mobile', 'occupation', 'fee', 'address'],
    labels: ['সদস্য আইডি', 'তারিখ', 'নাম', 'মোবাইল নং', 'পেশা', 'ধার্য্য', 'ঠিকানা']
  },
  Collections: {
    keys:   ['receiptNo', 'date', 'memberId', 'name', 'mobile', 'address', 'fee', 'dueBefore', 'paid'],
    labels: ['রশিদ নং', 'তারিখ', 'সদস্য আইডি', 'নাম', 'মোবাইল নং', 'ঠিকানা', 'ধার্য্য', 'বকেয়া', 'পরিশোধ']
  },
  Special: {
    keys:   ['receiptNo', 'date', 'name', 'mobile', 'address', 'description', 'amount'],
    labels: ['রশিদ নং', 'তারিখ', 'নাম', 'মোবাইল নং', 'ঠিকানা', 'বিবরণ', 'টাকা']
  },
  Expenses: {
    keys:   ['voucherNo', 'date', 'description', 'amount'],   // প্রতিটি খরচের আইটেম আলাদা সারিতে
    labels: ['ভাউচার নং', 'তারিখ', 'বিবরণ', 'টাকা']
  },
  Notices: {
    keys:   ['noticeNo', 'date', 'title', 'details'],
    labels: ['নোটিশ নং', 'তারিখ', 'শিরোনাম', 'বিস্তারিত']
  },
  FeeChanges: {
    keys:   ['incNo', 'date', 'memberId', 'name', 'mobile', 'address', 'prevFee', 'increase', 'newFee'],
    labels: ['বৃদ্ধি নং', 'তারিখ', 'সদস্য আইডি', 'নাম', 'মোবাইল নং', 'ঠিকানা', 'পূর্ব ধার্য্য', 'বৃদ্ধি', 'নতুন ধার্য্য']
  },
  Programs: {
    keys:   ['serial', 'name', 'date', 'sponsor', 'beneficiary'],
    labels: ['ক্রম', 'কর্মসূচির নাম', 'তারিখ', 'স্পন্সর', 'উপকৃত হয়েছে']
  },
  Settings: {
    keys:   ['key', 'value'],
    labels: ['বিষয়', 'মান']
  }
};

// পাসওয়ার্ড লাগবে এমন শীট
var LOCKED = { Notices: true };

/* ---------- এন্ট্রি পয়েন্ট ---------- */

function setup() {
  migrateV1();
  migrateV3();
  Object.keys(SHEETS).forEach(function (n) { sheet_(n); });
  var def = ss_().getSheetByName('Sheet1');
  if (def && def.getLastRow() === 0 && ss_().getSheets().length > 1) ss_().deleteSheet(def);
}

function doGet(e) {
  var s;
  try { s = getAllJson_(); } catch (err) { s = JSON.stringify({ ok: false, error: String(err.message || err) }); }
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- দ্রুত লোডের জন্য ক্যাশ ---------- */
// প্রতিটি সংরক্ষণ/ডিলেটের পর 'ver' বদলে যায়, ফলে পুরনো ক্যাশ আর ব্যবহৃত হয় না। সর্বোচ্চ ৬০ সেকেন্ড টিকে।
function getAllJson_() {
  var cache = CacheService.getScriptCache();
  var ver = cache.get('ver') || '0';
  var hit = cache.get('all_' + ver);
  if (hit) return hit;
  var s = JSON.stringify(getAll_());
  try { if ((cache.get('ver') || '0') === ver) cache.put('all_' + ver, s, 60); } catch (e) { /* ১০০KB এর বেশি হলে ক্যাশ হয় না */ }
  return s;
}

function bumpVer_() {
  try { CacheService.getScriptCache().put('ver', String(new Date().getTime()) + Math.floor(Math.random() * 1000), 21600); } catch (e) { /* ignore */ }
}

function doPost(e) {
  var out;
  try {
    var req = JSON.parse(e.postData.contents);
    out = handle_(req);
  } catch (err) {
    out = { ok: false, error: String(err.message || err) };
  }
  return json_(out);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- রাউটার ---------- */

var WRITE_ACTIONS = { save: 1, 'delete': 1, saveSettings: 1, changePassword: 1 };

function handle_(req) {
  var res = route_(req);
  if (res && res.ok && WRITE_ACTIONS[req.action]) bumpVer_();
  return res;
}

function route_(req) {
  var a = req.action;

  if (a === 'login') {
    return checkPw_(req.pw) ? { ok: true } : { ok: false, error: 'ভুল পাসওয়ার্ড' };
  }

  if (a === 'saveSettings') {
    if (!checkPw_(req.pw)) return authErr_();
    return withLock_(function () {
      var d = req.data || {};
      Object.keys(d).forEach(function (k) {
        if (k === 'password') return;
        setSetting_(k, d[k]);
      });
      return { ok: true };
    });
  }

  if (a === 'changePassword') {
    if (!checkPw_(req.pw)) return authErr_();
    var np = String(req.newPw || '');
    if (np.length < 4) return { ok: false, error: 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে' };
    return withLock_(function () { setSetting_('password', np); return { ok: true }; });
  }

  if (a === 'save' || a === 'delete') {
    var name = req.sheet;
    if (!SHEETS[name] || name === 'Settings') return { ok: false, error: 'অবৈধ শীট' };
    if (LOCKED[name] && !checkPw_(req.pw)) return authErr_();
    return withLock_(function () {
      if (a === 'delete') return name === 'Expenses' ? deleteExpense_(req.id) : name === 'FeeChanges' ? deleteFeeChange_(req.id) : deleteRecord_(name, req.id);

      var rec = req.record || {};
      // ডাবল এন্ট্রি প্রতিরোধ: নতুন এন্ট্রির টোকেন আগেই সেভ হয়ে থাকলে আগের ফলাফলই ফেরত যাবে
      var tokKey = (!rec.id && rec.token) ? 'tok_' + name + '_' + String(rec.token).slice(0, 60) : '';
      var cache = CacheService.getScriptCache();
      if (tokKey) {
        var hit = cache.get(tokKey);
        if (hit) { try { return JSON.parse(hit); } catch (e) { /* ignore */ } }
      }
      var res = name === 'Expenses' ? saveExpense_(rec) : name === 'FeeChanges' ? saveFeeChange_(rec) : saveRecord_(name, rec);
      if (tokKey && res.ok) { try { cache.put(tokKey, JSON.stringify(res), 21600); } catch (e) { /* বড় ডেটা হলে উপেক্ষা */ } }
      return res;
    });
  }

  return { ok: false, error: 'অজানা অনুরোধ' };
}

function authErr_() { return { ok: false, code: 'AUTH', error: 'ব্যবস্থাপনার পাসওয়ার্ড প্রয়োজন' }; }

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ---------- শীট সহায়ক ---------- */

var _ss = null, _sh = {};   // একবারের চালনায় স্প্রেডশীট/শীট অবজেক্ট পুনর্ব্যবহার (দ্রুত)
function ss_() { return _ss || (_ss = SpreadsheetApp.getActiveSpreadsheet()); }

function formatSheet_(sh, name) {
  var def = SHEETS[name], n = def.keys.length;
  if (sh.getMaxColumns() > n) sh.deleteColumns(n + 1, sh.getMaxColumns() - n); // অতিরিক্ত ফাঁকা কলাম বাদ
  sh.getRange(1, 1, sh.getMaxRows(), n).setNumberFormat('@');                   // সব ঘর টেক্সট
  sh.getRange(1, 1, 1, n).setValues([def.labels])
    .setFontWeight('bold').setBackground('#0f3a7d').setFontColor('#ffffff');
  sh.setFrozenRows(1);
}

function sheet_(name) {
  if (_sh[name]) return _sh[name];
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    formatSheet_(sh, name);
    if (name === 'Settings') sh.getRange(2, 1, 1, 2).setValues([['password', DEFAULT_PASSWORD]]);
  }
  _sh[name] = sh;
  return sh;
}

function str_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v == null ? '' : String(v);
}

function readAll_(name) {
  var sh = sheet_(name), keys = SHEETS[name].keys;
  var n = sh.getLastRow() - 1;
  if (n < 1) return [];
  var vals = sh.getRange(2, 1, n, keys.length).getValues();
  return vals.map(function (r) {
    var o = {};
    keys.forEach(function (k, i) { o[k] = str_(r[i]); });
    return o;
  });
}

function getAll_() {
  if (String(sheet_('Members').getRange(1, 1).getValue()) === 'id') {
    throw new Error('শীটের কাঠামো পুরনো। Apps Script এ setup ফাংশন একবার Run করুন।');
  }
  var settings = {};
  readAll_('Settings').forEach(function (r) {
    if (r.key && r.key !== 'password') settings[r.key] = r.value;
  });
  return {
    ok: true,
    settings: settings,
    members: readAll_('Members'),
    collections: readAll_('Collections'),
    special: readAll_('Special'),
    expenses: groupExpenses_(readAll_('Expenses')),
    feeChanges: readAll_('FeeChanges'),
    programs: readAll_('Programs'),
    notices: readAll_('Notices')
  };
}

/* ---------- সেটিংস ও পাসওয়ার্ড ---------- */

function getSetting_(key) {
  var rows = readAll_('Settings');
  for (var i = 0; i < rows.length; i++) if (rows[i].key === key) return rows[i].value;
  return '';
}

function checkPw_(pw) {
  var real = getSetting_('password') || DEFAULT_PASSWORD;
  return String(pw || '') === String(real);
}

function setSetting_(key, val) {
  var sh = sheet_('Settings');
  var n = sh.getLastRow() - 1;
  var row = -1;
  if (n > 0) {
    var keys = sh.getRange(2, 1, n, 1).getValues();
    for (var i = 0; i < keys.length; i++) if (String(keys[i][0]) === key) { row = i + 2; break; }
  }
  if (row < 0) row = sh.getLastRow() + 1;
  ensureRows_(sh, row);
  var rg = sh.getRange(row, 1, 1, 2);
  rg.setNumberFormat('@');
  rg.setValues([[key, val == null ? '' : String(val)]]);
}

/* ---------- রেকর্ড সংরক্ষণ / মুছে ফেলা ---------- */

function memberId_(n) {
  var s = String(n);
  while (s.length < 4) s = '0' + s;
  return ID_PREFIX + s;
}

// প্রথম কলামের সংখ্যাংশের সর্বোচ্চ মান + ১
function nextNo_(data) {
  var max = 0;
  data.forEach(function (r) {
    var v = parseInt(String(r[0]).replace(/\D/g, ''), 10);
    if (!isNaN(v) && v > max) max = v;
  });
  return max + 1;
}

// req.record.id = বিদ্যমান রেকর্ডের নম্বর/আইডি (নতুন হলে ফাঁকা)। এটি শীটে কলাম হিসেবে যায় না।
function saveRecord_(name, rec) {
  var sh = sheet_(name), keys = SHEETS[name].keys;
  var n = sh.getLastRow() - 1;
  var data = n > 0 ? sh.getRange(2, 1, n, keys.length).getValues() : [];
  var row = -1;
  var existing = rec.id ? String(rec.id) : '';

  if (name === 'Members') {                      // ডাবল এন্ট্রি প্রতিরোধ: একই নাম ও মোবাইল নং
    var nm = normName_(rec.name), mb = normMobile_(rec.mobile);
    for (var d = 0; d < data.length; d++) {
      if (String(data[d][0]) !== existing && normName_(data[d][2]) === nm && normMobile_(data[d][3]) === mb) {
        return { ok: false, error: 'এই সদস্য আগে থেকেই আছেন: ' + data[d][2] + ' (' + data[d][0] + ')' };
      }
    }
  }

  if (existing) {
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]) === existing) { row = i + 2; break; }
    }
    if (row < 0) return { ok: false, error: 'রেকর্ডটি পাওয়া যায়নি' };
    rec[keys[0]] = existing;                 // নম্বর/আইডি অপরিবর্তিত
  } else {
    var no = nextNo_(data);
    rec[keys[0]] = name === 'Members' ? memberId_(no) : String(no);
    row = sh.getLastRow() + 1;
  }

  if (name === 'Members' && existing) {           // ধার্য্য বৃদ্ধির ইতিহাস থাকলে ধার্য্য শুধু বৃদ্ধি ফরম থেকেই বদলাবে
    var hasInc = readAll_('FeeChanges').some(function (r) { return r.memberId === existing; });
    if (hasInc) rec.fee = String(data[row - 2][5]);
  }

  var vals = keys.map(function (k) { return rec[k] == null ? '' : String(rec[k]); });
  ensureRows_(sh, row);
  var rg = sh.getRange(row, 1, 1, keys.length);
  rg.setNumberFormat('@');
  rg.setValues([vals]);

  var out = {};
  keys.forEach(function (k, i) { out[k] = vals[i]; });
  return { ok: true, record: out };
}

var BN_DIGITS = '০১২৩৪৫৬৭৮৯';
function normName_(s) { return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
function normMobile_(s) {
  var d = String(s || '').replace(/[০-৯]/g, function (c) { return BN_DIGITS.indexOf(c); }).replace(/\D/g, '');
  if (d.indexOf('880') === 0 && d.length === 13) d = '0' + d.slice(3);
  else if (d.length === 10 && d.charAt(0) === '1') d = '0' + d;
  return d;
}

function deleteRecord_(name, id) {
  if (name === 'Members') deleteFeeRowsOf_(id);
  var sh = sheet_(name);
  var n = sh.getLastRow() - 1;
  if (n < 1) return { ok: false, error: 'রেকর্ড পাওয়া যায়নি' };
  var ids = sh.getRange(2, 1, n, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) {
      sh.deleteRow(i + 2);
      return { ok: true };
    }
  }
  return { ok: false, error: 'রেকর্ড পাওয়া যায়নি' };
}

/* ---------- আগের সংস্করণ (id কলামসহ) থেকে রূপান্তর ---------- */

function migrateV1() {
  var ss = ss_();

  function oldRows(name) {
    var sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 1 || String(sh.getRange(1, 1).getValue()) !== 'id') return null;
    var n = sh.getLastRow() - 1;
    return n > 0 ? sh.getRange(2, 1, n, sh.getLastColumn()).getValues() : [];
  }

  var oM = oldRows('Members'), oC = oldRows('Collections'), oS = oldRows('Special'),
      oE = oldRows('Expenses'), oN = oldRows('Notices');
  if (!oM && !oC && !oS && !oE && !oN) return;

  var idMap = {};
  var nM = oM && oM.map(function (r, i) {
    var mid = memberId_(parseInt(r[1], 10) || (i + 1));
    idMap[String(r[0])] = mid;
    return [mid, r[2], r[3], r[4], r[5], r[6], r[7]];
  });
  var nC = oC && oC.map(function (r) {
    var mid = idMap[String(r[3])] || memberId_(parseInt(r[4], 10) || 0);
    return [r[1], r[2], mid, r[5], r[6], r[7], r[8], r[9], r[10]];
  });
  var nS = oS && oS.map(function (r) { return r.slice(1, 8); });
  var nE = oE && oE.reduce(function (acc, r) { return acc.concat(expandExpense_(r[1], r[2], r[3])); }, []);
  var nN = oN && oN.map(function (r, i) { return [String(i + 1), r[1], r[2], r[3]]; });

  [['Members', nM], ['Collections', nC], ['Special', nS], ['Expenses', nE], ['Notices', nN]].forEach(function (p) {
    if (!p[1]) return;
    var name = p[0], rows = p[1], sh = ss.getSheetByName(name), w = SHEETS[name].keys.length;
    sh.clear();
    formatSheet_(sh, name);
    if (rows.length) {
      if (sh.getMaxRows() < rows.length + 1) sh.insertRowsAfter(sh.getMaxRows(), rows.length + 1 - sh.getMaxRows());
      var rg = sh.getRange(2, 1, rows.length, w);
      rg.setNumberFormat('@');
      rg.setValues(rows.map(function (r) { return r.slice(0, w).map(str_); }));
    }
  });
}

/* ---------- খরচ: প্রতি আইটেম আলাদা সারি (ভাউচার নং, তারিখ, বিবরণ, টাকা) ---------- */

function ensureRows_(sh, lastRowNeeded) {
  var max = sh.getMaxRows();
  if (max < lastRowNeeded) sh.insertRowsAfter(max, lastRowNeeded - max);
}

function expandExpense_(vno, date, itemsJson) {
  var items = [];
  try { items = JSON.parse(itemsJson) || []; } catch (e) { items = []; }
  return items.map(function (it) { return [str_(vno), str_(date), String(it.d || ''), String(Number(it.a) || 0)]; });
}

// শীটের সারিগুলোকে ভাউচার অনুযায়ী জোড়া লাগিয়ে অ্যাপে পাঠানো (সর্বমোট এখানেই হিসাব হয়)
function groupExpenses_(rows) {
  var order = [], map = {};
  rows.forEach(function (r) {
    var k = r.voucherNo;
    if (!k) return;
    if (!map[k]) { map[k] = { voucherNo: k, date: r.date, items: [], total: 0 }; order.push(k); }
    var a = parseFloat(r.amount) || 0;
    map[k].items.push({ d: r.description, a: a });
    map[k].total += a;
  });
  return order.map(function (k) {
    var v = map[k];
    return { voucherNo: v.voucherNo, date: v.date, items: JSON.stringify(v.items), total: String(v.total) };
  });
}

// rec.id = বিদ্যমান ভাউচার নং (নতুন হলে ফাঁকা); rec.items = JSON [{d, a}]
function saveExpense_(rec) {
  var sh = sheet_('Expenses'), w = SHEETS.Expenses.keys.length;
  var n = sh.getLastRow() - 1;
  var data = n > 0 ? sh.getRange(2, 1, n, w).getValues() : [];
  var items;
  try { items = JSON.parse(rec.items || '[]'); } catch (e) { items = []; }
  if (!items.length) return { ok: false, error: 'কমপক্ষে একটি খরচের বিবরণ দিন' };

  var existing = rec.id ? String(rec.id) : '';
  var vno, pos = -1;
  if (existing) {
    for (var i = data.length - 1; i >= 0; i--) {
      if (String(data[i][0]) === existing) { sh.deleteRow(i + 2); pos = i + 2; }   // পুরনো সারি বাদ; pos = প্রথম সারির অবস্থান
    }
    if (pos < 0) return { ok: false, error: 'রেকর্ডটি পাওয়া যায়নি' };
    vno = existing;
  } else {
    vno = String(nextNo_(data));
  }

  var rows = items.map(function (it) { return [vno, String(rec.date || ''), String(it.d || ''), String(Number(it.a) || 0)]; });
  var start;
  if (pos > 0 && pos <= sh.getLastRow()) { sh.insertRowsBefore(pos, rows.length); start = pos; }   // আগের জায়গাতেই বসবে
  else { start = sh.getLastRow() + 1; ensureRows_(sh, start + rows.length - 1); }
  var rg = sh.getRange(start, 1, rows.length, w);
  rg.setNumberFormat('@');
  rg.setValues(rows);

  var total = rows.reduce(function (s, r) { return s + Number(r[3]); }, 0);
  var clean = items.map(function (it) { return { d: String(it.d || ''), a: Number(it.a) || 0 }; });
  return { ok: true, record: { voucherNo: vno, date: String(rec.date || ''), items: JSON.stringify(clean), total: String(total) } };
}

function deleteExpense_(id) {
  var sh = sheet_('Expenses');
  var n = sh.getLastRow() - 1;
  if (n < 1) return { ok: false, error: 'রেকর্ড পাওয়া যায়নি' };
  var ids = sh.getRange(2, 1, n, 1).getValues();
  var found = false;
  for (var i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]) === String(id)) { sh.deleteRow(i + 2); found = true; }
  }
  return found ? { ok: true } : { ok: false, error: 'রেকর্ড পাওয়া যায়নি' };
}

// আগের কাঠামো (একটি কলামে JSON তালিকা) থেকে প্রতি আইটেম আলাদা সারিতে রূপান্তর
function migrateV3() {
  var sh = ss_().getSheetByName('Expenses');
  if (!sh || sh.getLastRow() < 1 || sh.getLastColumn() < 3) return;
  if (String(sh.getRange(1, 3).getValue()) !== 'খরচের তালিকা') return;
  var n = sh.getLastRow() - 1;
  var vals = n > 0 ? sh.getRange(2, 1, n, 4).getValues() : [];
  var rows = [];
  vals.forEach(function (r) { rows = rows.concat(expandExpense_(r[0], r[1], r[2])); });
  sh.clear();
  formatSheet_(sh, 'Expenses');
  if (rows.length) {
    ensureRows_(sh, rows.length + 1);
    var rg = sh.getRange(2, 1, rows.length, 4);
    rg.setNumberFormat('@');
    rg.setValues(rows);
  }
}

/* ---------- ধার্য্য বৃদ্ধি ---------- */

function monthKey_(iso) {
  var p = String(iso || '').split('-');
  return (parseInt(p[0], 10) || 0) * 12 + (parseInt(p[1], 10) || 1) - 1;
}

function findRow_(data, key) {
  for (var i = 0; i < data.length; i++) if (String(data[i][0]) === String(key)) return i + 2;
  return -1;
}

// rec = { memberId, date, increase }। নতুন ধার্য্য = চলতি ধার্য্য + বৃদ্ধি; সদস্যের চলতি ধার্য্যও হালনাগাদ হয়।
function saveFeeChange_(rec) {
  var mSh = sheet_('Members'), mKeys = SHEETS.Members.keys;
  var mn = mSh.getLastRow() - 1;
  var mData = mn > 0 ? mSh.getRange(2, 1, mn, mKeys.length).getValues() : [];
  var mRow = findRow_(mData, rec.memberId);
  if (mRow < 0) return { ok: false, error: 'সদস্য পাওয়া যায়নি' };
  var m = mData[mRow - 2];

  var inc = Number(rec.increase);
  if (!(inc > 0)) return { ok: false, error: 'বৃদ্ধির পরিমাণ শূন্যের বেশি হতে হবে' };
  var date = String(rec.date || '');
  if (!date) return { ok: false, error: 'তারিখ দিন' };
  var em = monthKey_(date);
  if (em < monthKey_(str_(m[1]))) return { ok: false, error: 'সদস্য হওয়ার তারিখের আগের তারিখ দেওয়া যাবে না' };

  var fSh = sheet_('FeeChanges'), fKeys = SHEETS.FeeChanges.keys, w = fKeys.length;
  var fn = fSh.getLastRow() - 1;
  var fData = fn > 0 ? fSh.getRange(2, 1, fn, w).getValues() : [];
  var last = -1;
  fData.forEach(function (r) { if (String(r[2]) === String(rec.memberId)) last = Math.max(last, monthKey_(str_(r[1]))); });
  if (last >= 0 && em < last) return { ok: false, error: 'আগের বৃদ্ধির তারিখের আগের তারিখ দেওয়া যাবে না' };

  var prev = Number(m[5]) || 0, nw = prev + inc;
  var row = [String(nextNo_(fData)), date, String(m[0]), String(m[2]), String(m[3]), String(m[6]), String(prev), String(inc), String(nw)];
  var start = fSh.getLastRow() + 1;
  ensureRows_(fSh, start);
  var rg = fSh.getRange(start, 1, 1, w);
  rg.setNumberFormat('@');
  rg.setValues([row]);

  var fc = mSh.getRange(mRow, 6);            // সদস্যের চলতি ধার্য্য
  fc.setNumberFormat('@');
  fc.setValue(String(nw));

  var out = {}, mem = {};
  fKeys.forEach(function (k, i) { out[k] = row[i]; });
  mKeys.forEach(function (k, i) { mem[k] = k === 'fee' ? String(nw) : str_(m[i]); });
  return { ok: true, record: out, member: mem };
}

// শুধু সদস্যের সর্বশেষ বৃদ্ধিটি মোছা যায়; চলতি ধার্য্য আগের মানে ফিরে যায়
function deleteFeeChange_(id) {
  var fSh = sheet_('FeeChanges'), w = SHEETS.FeeChanges.keys.length;
  var fn = fSh.getLastRow() - 1;
  if (fn < 1) return { ok: false, error: 'রেকর্ড পাওয়া যায়নি' };
  var fData = fSh.getRange(2, 1, fn, w).getValues();
  var fRow = findRow_(fData, id);
  if (fRow < 0) return { ok: false, error: 'রেকর্ড পাওয়া যায়নি' };
  var r = fData[fRow - 2], memberId = String(r[2]);
  for (var i = 0; i < fData.length; i++) {
    if (String(fData[i][2]) === memberId && (parseInt(fData[i][0], 10) || 0) > (parseInt(r[0], 10) || 0)) {
      return { ok: false, error: 'এই সদস্যের পরবর্তী বৃদ্ধি আছে। আগে সর্বশেষটি মুছুন।' };
    }
  }
  var mSh = sheet_('Members'), mKeys = SHEETS.Members.keys;
  var mn = mSh.getLastRow() - 1;
  var mData = mn > 0 ? mSh.getRange(2, 1, mn, mKeys.length).getValues() : [];
  var mRow = findRow_(mData, memberId), mem = null;
  if (mRow > 0) {
    var fc = mSh.getRange(mRow, 6);
    fc.setNumberFormat('@');
    fc.setValue(String(r[6]));               // পূর্ব ধার্য্য ফিরিয়ে দেওয়া
    mem = {};
    mKeys.forEach(function (k, i) { mem[k] = k === 'fee' ? String(r[6]) : str_(mData[mRow - 2][i]); });
  }
  fSh.deleteRow(fRow);
  return { ok: true, member: mem };
}

function deleteFeeRowsOf_(memberId) {
  var sh = sheet_('FeeChanges');
  var n = sh.getLastRow() - 1;
  if (n < 1) return;
  var ids = sh.getRange(2, 3, n, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === String(memberId)) sh.deleteRow(i + 2);
}
