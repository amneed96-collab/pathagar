/**
 * সংস্থা ব্যবস্থাপনা সিস্টেম — Google Apps Script API
 *
 * ব্যবহারবিধি:
 * 1) একটি নতুন Google Sheet খুলুন → Extensions → Apps Script
 * 2) এই কোড পুরোটা বসান, Save করুন
 * 3) উপরের ড্রপডাউন থেকে setup ফাংশন সিলেক্ট করে একবার Run করুন (অনুমতি দিন)
 * 4) Deploy → New deployment → Web app
 *      Execute as: Me
 *      Who has access: Anyone
 * 5) Web app URL কপি করে app.js এর API_URL এ বসান
 *
 * ডিফল্ট ব্যবস্থাপনা পাসওয়ার্ড: admin123  (সেটাপ ফরম থেকে পরিবর্তন করুন)
 * কোড পরিবর্তন করলে প্রতিবার Deploy → Manage deployments → New version দিন।
 */

var DEFAULT_PASSWORD = 'admin123';

var SHEETS = {
  Members:     ['id', 'serial', 'date', 'name', 'mobile', 'occupation', 'fee', 'address'],
  Collections: ['id', 'receiptNo', 'date', 'memberId', 'serial', 'name', 'mobile', 'address', 'fee', 'dueBefore', 'paid'],
  Special:     ['id', 'receiptNo', 'date', 'name', 'mobile', 'address', 'description', 'amount'],
  Expenses:    ['id', 'voucherNo', 'date', 'items', 'total', 'paid', 'due'],
  Notices:     ['id', 'date', 'title', 'details'],
  Settings:    ['key', 'value']
};

// অটো নম্বর ফিল্ড
var AUTO = { Members: 'serial', Collections: 'receiptNo', Special: 'receiptNo', Expenses: 'voucherNo' };

// পাসওয়ার্ড লাগবে এমন শিট
var LOCKED = { Notices: true };

/* ---------- এন্ট্রি পয়েন্ট ---------- */

function setup() {
  Object.keys(SHEETS).forEach(function (n) { sheet_(n); });
  var def = ss_().getSheetByName('Sheet1');
  if (def && def.getLastRow() === 0 && ss_().getSheets().length > 1) ss_().deleteSheet(def);
}

function doGet(e) {
  var out;
  try { out = getAll_(); } catch (err) { out = { ok: false, error: String(err.message || err) }; }
  return json_(out);
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

function handle_(req) {
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
    if (!SHEETS[name] || name === 'Settings') return { ok: false, error: 'অবৈধ শিট' };
    if (LOCKED[name] && !checkPw_(req.pw)) return authErr_();
    return withLock_(function () {
      return a === 'save' ? saveRecord_(name, req.record || {}) : deleteRecord_(name, req.id);
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

/* ---------- শিট সহায়ক ---------- */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(name) {
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    var h = SHEETS[name];
    // সব ঘর টেক্সট ফরম্যাটে (মোবাইলের শুরুর ০ ও তারিখ ঠিক থাকবে)
    sh.getRange(1, 1, sh.getMaxRows(), h.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, h.length).setValues([h])
      .setFontWeight('bold').setBackground('#0f3a7d').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    if (name === 'Settings') sh.getRange(2, 1, 1, 2).setValues([['password', DEFAULT_PASSWORD]]);
  }
  return sh;
}

function str_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v == null ? '' : String(v);
}

function readAll_(name) {
  var sh = sheet_(name), h = SHEETS[name];
  var n = sh.getLastRow() - 1;
  if (n < 1) return [];
  var vals = sh.getRange(2, 1, n, h.length).getValues();
  return vals.map(function (r) {
    var o = {};
    h.forEach(function (k, i) { o[k] = str_(r[i]); });
    return o;
  });
}

function getAll_() {
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
    expenses: readAll_('Expenses'),
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
  var rg = sh.getRange(row, 1, 1, 2);
  rg.setNumberFormat('@');
  rg.setValues([[key, val == null ? '' : String(val)]]);
}

/* ---------- রেকর্ড সংরক্ষণ / মুছে ফেলা ---------- */

function saveRecord_(name, rec) {
  var sh = sheet_(name), h = SHEETS[name];
  var n = sh.getLastRow() - 1;
  var data = n > 0 ? sh.getRange(2, 1, n, h.length).getValues() : [];
  var row = -1;

  if (rec.id) {
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]) === String(rec.id)) { row = i + 2; break; }
    }
  }

  var auto = AUTO[name];
  if (row < 0) {
    rec.id = Utilities.getUuid();
    if (auto) rec[auto] = String(nextNo_(data, h.indexOf(auto)));
    row = sh.getLastRow() + 1;
  } else if (auto) {
    rec[auto] = String(data[row - 2][h.indexOf(auto)]); // এডিটে অটো নম্বর অপরিবর্তিত
  }

  var vals = h.map(function (k) { return rec[k] == null ? '' : String(rec[k]); });
  var rg = sh.getRange(row, 1, 1, h.length);
  rg.setNumberFormat('@');
  rg.setValues([vals]);

  var out = {};
  h.forEach(function (k, i) { out[k] = vals[i]; });
  return { ok: true, record: out };
}

function nextNo_(data, col) {
  var max = 0;
  data.forEach(function (r) {
    var v = parseInt(r[col], 10);
    if (!isNaN(v) && v > max) max = v;
  });
  return max + 1;
}

function deleteRecord_(name, id) {
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
