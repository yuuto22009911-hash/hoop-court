/**
 * 向日葵株式会社 体育館予約 — Google Apps Script バックエンド
 *
 * フロント(hoop-court, src/lib/gas.ts)の単一エンドポイント契約に準拠する Web アプリ。
 *   - リクエスト: POST { action, payload, idToken }（Content-Type: text/plain）
 *   - レスポンス: { ok:true, data } | { ok:false, error, code }
 *
 * データストアは Google スプレッドシート（Courts / Users / Reservations / Slots / Admins）。
 * 料金・予約ルールは src/lib/pricing.ts / src/lib/holidays.ts と厳密一致させている。
 *
 * 【セットアップ】README.md を参照。要点:
 *   1. このスクリプトを Google スプレッドシートに紐付け（コンテナバインド）するか、
 *      スタンドアロンで作り Script Property SPREADSHEET_ID を設定。
 *   2. 関数 setup() を一度実行 → 各シート作成＋ハーフコート1面を投入。
 *   3. Script Properties を設定:
 *        LINE_LOGIN_CHANNEL_ID … LINE ログインチャネルの Channel ID（IDトークン検証用・必須）
 *        LINE_MESSAGING_TOKEN  … Messaging API のチャネルアクセストークン（一斉配信用・任意）
 *        ADMIN_USER_IDS        … 管理者の LINE userId をカンマ区切り（任意。Admins シートでも可）
 *   4. デプロイ → 新しいデプロイ → 種類: ウェブアプリ / 実行: 自分 / アクセス: 全員
 *      → /exec URL を NEXT_PUBLIC_GAS_ENDPOINT に設定。
 */

// ====================== 料金・営業時間（pricing.ts と一致） ======================
var OPEN_HOUR = 9;
var CLOSE_HOUR = 20;
var CHARTER_EVENING_FROM = 14;
var CHARTER_WEEKDAY_MORNING = 1210;
var CHARTER_WEEKDAY_EVENING = 1500;
var CHARTER_HOLIDAY = 1800;
var CHARTER_WEEKDAY_MORNING_30 = 660;
var CHARTER_WEEKDAY_EVENING_30 = 800;
var FREE_WEEKDAY_PER30 = 440;
var FREE_HOLIDAY_PER30 = 550;
var FREE_MAX_HEADCOUNT = 9;

// 祝日（holidays.ts と一致・2026/2027）。年次でメンテすること。
var HOLIDAYS = {
  "2026-01-01": 1, "2026-01-12": 1, "2026-02-11": 1, "2026-02-23": 1, "2026-03-20": 1,
  "2026-04-29": 1, "2026-05-03": 1, "2026-05-04": 1, "2026-05-05": 1, "2026-05-06": 1,
  "2026-07-20": 1, "2026-08-11": 1, "2026-09-21": 1, "2026-09-22": 1, "2026-09-23": 1,
  "2026-10-12": 1, "2026-11-03": 1, "2026-11-23": 1,
  "2027-01-01": 1, "2027-01-11": 1, "2027-02-11": 1, "2027-02-23": 1, "2027-03-21": 1,
  "2027-03-22": 1, "2027-04-29": 1, "2027-05-03": 1, "2027-05-04": 1, "2027-05-05": 1,
  "2027-07-19": 1, "2027-08-11": 1, "2027-09-20": 1, "2027-09-23": 1, "2027-10-11": 1,
  "2027-11-03": 1, "2027-11-23": 1
};

function ymdToDow_(ymd) {
  var p = ymd.split("-");
  return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12)).getUTCDay();
}
function isWeekendOrHoliday_(ymd) {
  var dow = ymdToDow_(ymd);
  return dow === 0 || dow === 6 || !!HOLIDAYS[ymd];
}
function charterHourRate_(ymd, hour) {
  if (isWeekendOrHoliday_(ymd)) return CHARTER_HOLIDAY;
  return hour < CHARTER_EVENING_FROM ? CHARTER_WEEKDAY_MORNING : CHARTER_WEEKDAY_EVENING;
}
/** 貸切料金（税込）。startMin/endMin はその日の分・30分刻み。 */
function charterPrice_(ymd, startMin, endMin) {
  var segments = Math.round((endMin - startMin) / 30);
  if (segments <= 0) return 0;
  if (isWeekendOrHoliday_(ymd)) return Math.floor(segments / 2) * CHARTER_HOLIDAY;
  var fullHours = Math.floor(segments / 2);
  var hasHalf = segments % 2 === 1;
  var sum = 0;
  for (var i = 0; i < fullHours; i++) {
    var hourStart = startMin + i * 60;
    sum += hourStart < CHARTER_EVENING_FROM * 60 ? CHARTER_WEEKDAY_MORNING : CHARTER_WEEKDAY_EVENING;
  }
  if (hasHalf) {
    var halfStart = startMin + fullHours * 60;
    sum += halfStart < CHARTER_EVENING_FROM * 60 ? CHARTER_WEEKDAY_MORNING_30 : CHARTER_WEEKDAY_EVENING_30;
  }
  return sum;
}
function freePer30_(ymd) {
  return isWeekendOrHoliday_(ymd) ? FREE_HOLIDAY_PER30 : FREE_WEEKDAY_PER30;
}
function freePrice_(ymd, segments30, headcount) {
  return freePer30_(ymd) * Math.max(1, segments30) * Math.max(1, headcount);
}

// ====================== エントリ ======================
function doPost(e) {
  try {
    var body = e && e.postData ? JSON.parse(e.postData.contents || "{}") : {};
    var data = handle_(body.action, body.payload || {}, body.idToken);
    return json_({ ok: true, data: data });
  } catch (err) {
    return json_({ ok: false, error: (err && err.message) || String(err), code: (err && err.code) || "ERROR" });
  }
}
function doGet() {
  return json_({ ok: true, data: { status: "ok", service: "himawari-hoop-court-gas" } });
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function fail_(message, code) {
  var e = new Error(message);
  e.code = code || "ERROR";
  return e;
}

// ====================== ルーティング ======================
function handle_(action, p, idToken) {
  switch (action) {
    case "courts.list": return { courts: listCourts_() };
    case "availability.range": return availabilityRange_(p);

    case "auth.me": return authMe_(idToken);
    case "auth.register": return authRegister_(idToken, p);

    case "reservations.create": return reservationsCreate_(idToken, p);
    case "reservations.listMine": return reservationsListMine_(idToken);
    case "reservations.cancel": return reservationsCancel_(idToken, p);

    case "admin.reservations.list": return adminList_(idToken, p);
    case "admin.reservations.markPaid": return adminMarkPaid_(idToken, p);
    case "admin.reservations.markNoShow": return adminMarkNoShow_(idToken, p);
    case "admin.checkin": return adminCheckin_(idToken, p);
    case "admin.slots.bulkUpdate": return adminSlotsBulk_(idToken, p);
    case "admin.broadcast": return adminBroadcast_(idToken, p);
    case "admin.sales.summary": return adminSales_(idToken, p);

    default: throw fail_("unsupported action: " + action, "BAD_REQUEST");
  }
}

// ====================== LINE 認証 ======================
function verifyLineUser_(idToken) {
  if (!idToken) throw fail_("ログインが必要です。", "AUTH");
  var channelId = props_("LINE_LOGIN_CHANNEL_ID");
  if (!channelId) throw fail_("LINE_LOGIN_CHANNEL_ID 未設定", "CONFIG");
  var res = UrlFetchApp.fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "post",
    payload: { id_token: idToken, client_id: channelId },
    muteHttpExceptions: true
  });
  var obj = JSON.parse(res.getContentText() || "{}");
  if (res.getResponseCode() !== 200 || !obj.sub) {
    throw fail_("LINE 認証に失敗しました。", "AUTH");
  }
  return obj; // { sub(userId), name, picture, email? }
}
function requireAdmin_(idToken) {
  var line = verifyLineUser_(idToken);
  var ids = (props_("ADMIN_USER_IDS") || "").split(",").map(function (s) { return s.trim(); }).filter(String);
  var fromSheet = readTable_("Admins").map(function (r) { return String(r.line_user_id); });
  var allowed = ids.concat(fromSheet);
  if (allowed.indexOf(line.sub) < 0) throw fail_("管理者権限がありません。", "FORBIDDEN");
  return line;
}

// ====================== スプレッドシート I/O ======================
function ss_() {
  var id = props_("SPREADSHEET_ID");
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}
function sheet_(name) {
  var s = ss_().getSheetByName(name);
  if (!s) throw fail_("シートがありません: " + name + "（setup() を実行してください）", "CONFIG");
  return s;
}
/** ヘッダ行をキーにして各行をオブジェクト化（_row は 1始まりの実行番号） */
function readTable_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) return [];
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (row.join("") === "") continue;
    var obj = { _row: r + 1 };
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = row[c];
    out.push(obj);
  }
  return out;
}
function headers_(name) {
  return sheet_(name).getRange(1, 1, 1, sheet_(name).getLastColumn()).getValues()[0];
}
function appendRow_(name, obj) {
  var hs = headers_(name);
  var row = hs.map(function (h) { return obj[h] !== undefined && obj[h] !== null ? obj[h] : ""; });
  sheet_(name).appendRow(row);
}
function updateRow_(name, _row, obj) {
  var sh = sheet_(name);
  var hs = headers_(name);
  var range = sh.getRange(_row, 1, 1, hs.length);
  var cur = range.getValues()[0];
  for (var i = 0; i < hs.length; i++) if (obj[hs[i]] !== undefined) cur[i] = obj[hs[i]];
  range.setValues([cur]);
}

// ====================== JST 日時ヘルパ ======================
function jstIso_(d) {
  // 例: 2026-06-25T09:00:00+09:00
  return Utilities.formatDate(d, "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ssXXX");
}
function jstYmd_(d) { return jstIso_(d).slice(0, 10); }
function pad2_(n) { return (n < 10 ? "0" : "") + n; }
function hhmmToMin_(iso) {
  return parseInt(iso.slice(11, 13), 10) * 60 + parseInt(iso.slice(14, 16), 10);
}
function nowIso_() { return jstIso_(new Date()); }
function todayYmd_() { return jstYmd_(new Date()); }
function uuid_() { return Utilities.getUuid(); }

// ====================== Public: courts / availability ======================
function listCourts_() {
  return readTable_("Courts")
    .filter(function (c) { return String(c.is_active) !== "false" && c.is_active !== false; })
    .map(function (c) {
      return {
        id: String(c.id), facility_id: String(c.facility_id || ""), name: String(c.name),
        court_type: String(c.court_type || "HALF"), sides_max: Number(c.sides_max || 1),
        capacity: Number(c.capacity || FREE_MAX_HEADCOUNT), is_active: true,
        created_at: c.created_at ? String(c.created_at) : ""
      };
    });
}

function availabilityRange_(p) {
  var court_id = String(p.court_id || "");
  var fromYmd = jstYmd_(new Date(p.from));
  var toYmd = jstYmd_(new Date(p.to));
  var reservations = readTable_("Reservations").filter(function (r) {
    return String(r.court_id) === court_id && String(r.status) === "CONFIRMED" && String(r.mode) === "CHARTER";
  });
  var overrides = readTable_("Slots").filter(function (s) {
    return String(s.court_id) === court_id && String(s.status) !== "OPEN";
  });
  var resRanges = reservations.map(function (r) {
    return [new Date(r.starts_at).getTime(), new Date(r.ends_at).getTime()];
  });
  var ovrRanges = overrides.map(function (s) {
    return [new Date(s.starts_at).getTime(), new Date(s.ends_at).getTime()];
  });
  var SLOTS_PER_DAY = (CLOSE_HOUR - OPEN_HOUR) * 2;
  var slots = [];
  var ymd = fromYmd;
  var guard = 0;
  while (ymd < toYmd && guard < 400) {
    for (var i = 0; i < SLOTS_PER_DAY; i++) {
      var startMin = OPEN_HOUR * 60 + i * 30;
      var sIso = ymd + "T" + pad2_(Math.floor(startMin / 60)) + ":" + pad2_(startMin % 60) + ":00+09:00";
      var eMin = startMin + 30;
      var eIso = ymd + "T" + pad2_(Math.floor(eMin / 60)) + ":" + pad2_(eMin % 60) + ":00+09:00";
      var st = new Date(sIso).getTime();
      var en = new Date(eIso).getTime();
      var blocked = overlapsAny_(resRanges, st, en) || overlapsAny_(ovrRanges, st, en);
      slots.push({ slot_id: court_id + "-" + sIso, starts_at: sIso, ends_at: eIso, is_available: !blocked });
    }
    ymd = jstYmd_(new Date(new Date(ymd + "T12:00:00+09:00").getTime() + 24 * 3600 * 1000));
    guard++;
  }
  return { slots: slots };
}
function overlapsAny_(ranges, st, en) {
  for (var i = 0; i < ranges.length; i++) if (ranges[i][0] < en && ranges[i][1] > st) return true;
  return false;
}

// ====================== Member: auth ======================
function findUserByLineId_(lineUserId) {
  var users = readTable_("Users");
  for (var i = 0; i < users.length; i++) if (String(users[i].line_user_id) === lineUserId) return users[i];
  return null;
}
function toUserProfile_(u) {
  return {
    id: String(u.id), line_user_id: String(u.line_user_id), display_name: String(u.display_name || ""),
    phone: String(u.phone || ""), email: String(u.email || ""), team_name: u.team_name ? String(u.team_name) : "",
    role: "MEMBER", created_at: String(u.created_at || ""), updated_at: String(u.updated_at || "")
  };
}
function authMe_(idToken) {
  var line = verifyLineUser_(idToken);
  var u = findUserByLineId_(line.sub);
  return { user: u ? toUserProfile_(u) : null, registered: !!u };
}
function authRegister_(idToken, p) {
  var line = verifyLineUser_(idToken);
  if (!p.display_name || !p.phone || !p.email) throw fail_("お名前・電話番号・メールは必須です。", "VALIDATION");
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var existing = findUserByLineId_(line.sub);
    var now = nowIso_();
    if (existing) {
      updateRow_("Users", existing._row, {
        display_name: p.display_name, phone: p.phone, email: p.email,
        team_name: p.team_name || "", updated_at: now
      });
    } else {
      appendRow_("Users", {
        id: uuid_(), line_user_id: line.sub, display_name: p.display_name, phone: p.phone,
        email: p.email, team_name: p.team_name || "", role: "MEMBER", created_at: now, updated_at: now
      });
    }
  } finally {
    lock.releaseLock();
  }
  return { registered: true };
}

// ====================== Member: reservations ======================
function reservationsCreate_(idToken, p) {
  var line = verifyLineUser_(idToken);
  var user = findUserByLineId_(line.sub);
  if (!user) throw fail_("プロフィール登録が必要です。", "UNREGISTERED");

  var mode = p.mode || "CHARTER";
  var ymd = String(p.starts_at).slice(0, 10);
  var startMin = hhmmToMin_(p.starts_at);
  var endMin = hhmmToMin_(p.ends_at);
  var durationMin = endMin - startMin;
  var start = new Date(p.starts_at);
  var end = new Date(p.ends_at);

  if (durationMin <= 0) throw fail_("終了時刻は開始時刻より後にしてください。", "P0002");
  if (startMin < OPEN_HOUR * 60 || endMin > CLOSE_HOUR * 60) {
    throw fail_("予約は " + OPEN_HOUR + ":00〜" + CLOSE_HOUR + ":00 の範囲で指定してください。", "P0004");
  }
  if (ymd <= todayYmd_()) throw fail_("当日のご予約はカウンターのみ（要相談）です。", "P0005");

  var court_id = String(p.court_id || "");
  var court = null;
  var courts = listCourts_();
  for (var i = 0; i < courts.length; i++) if (courts[i].id === court_id) court = courts[i];
  if (!court) throw fail_("コートが見つかりません。", "P0010");

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var confirmed = readTable_("Reservations").filter(function (r) {
      return String(r.court_id) === court_id && String(r.status) === "CONFIRMED";
    });
    var amount;
    if (mode === "FREE") {
      if (durationMin % 30 !== 0) throw fail_("フリーは30分単位でご指定ください。", "P0006");
      var headcount = Number(p.headcount) || 0;
      if (headcount < 1 || headcount > FREE_MAX_HEADCOUNT) {
        throw fail_("フリーの人数は 1〜" + FREE_MAX_HEADCOUNT + " 名でご指定ください。", "P0007");
      }
      var charterClash = confirmed.some(function (r) {
        return String(r.mode) === "CHARTER" && new Date(r.starts_at) < end && new Date(r.ends_at) > start;
      });
      if (charterClash) throw fail_("選択した時間帯は貸切のため、フリーはご利用いただけません。", "P0001");
      var overlapHead = confirmed.filter(function (r) {
        return String(r.mode) === "FREE" && new Date(r.starts_at) < end && new Date(r.ends_at) > start;
      }).reduce(function (s, r) { return s + (Number(r.headcount) || 0); }, 0);
      if (overlapHead + headcount > FREE_MAX_HEADCOUNT) {
        throw fail_("この時間帯のフリーは残り " + Math.max(0, FREE_MAX_HEADCOUNT - overlapHead) + " 名です。", "P0008");
      }
      amount = freePrice_(ymd, durationMin / 30, headcount);
    } else {
      if (durationMin < 60) throw fail_("貸切は1時間以上でご指定ください。", "P0009");
      if (durationMin % 30 !== 0) throw fail_("貸切は30分単位でご指定ください。", "P0009");
      if (isWeekendOrHoliday_(ymd) && durationMin % 60 !== 0) {
        throw fail_("土日祝の貸切は1時間単位でご指定ください。", "P0011");
      }
      var overlap = confirmed.some(function (r) {
        return new Date(r.starts_at) < end && new Date(r.ends_at) > start;
      });
      if (overlap) throw fail_("選択した時間帯はすでに予約済みです。", "P0001");
      amount = charterPrice_(ymd, startMin, endMin);
    }

    var id = uuid_();
    var display_number = "R-" + ymd + "-" + id.slice(0, 4);
    var now = nowIso_();
    appendRow_("Reservations", {
      id: id, display_number: display_number, user_id: user.id, court_id: court_id, mode: mode,
      starts_at: jstIso_(start), ends_at: jstIso_(end), sides: 1, purpose: p.purpose || "",
      group_name: p.group_name || "", rep_name: p.rep_name || "", headcount: p.headcount || "",
      note: p.note || "", status: "CONFIRMED", total_amount: amount, payment_status: "UNPAID",
      paid_at: "", checked_in_at: "", created_at: now, updated_at: now, canceled_at: ""
    });
    return { reservation_id: id, display_number: display_number, amount: amount };
  } finally {
    lock.releaseLock();
  }
}

function toReservation_(r) {
  return {
    id: String(r.id), display_number: String(r.display_number), user_id: String(r.user_id),
    court_id: String(r.court_id), mode: String(r.mode || "CHARTER"),
    starts_at: String(r.starts_at), ends_at: String(r.ends_at), sides: Number(r.sides || 1),
    purpose: String(r.purpose || ""), group_name: String(r.group_name || ""),
    rep_name: r.rep_name ? String(r.rep_name) : "", headcount: r.headcount === "" ? "" : r.headcount,
    note: r.note ? String(r.note) : "", status: String(r.status), total_amount: Number(r.total_amount || 0),
    payment_status: String(r.payment_status || "UNPAID"), paid_at: r.paid_at ? String(r.paid_at) : undefined,
    checked_in_at: r.checked_in_at ? String(r.checked_in_at) : undefined,
    created_at: String(r.created_at || ""), updated_at: String(r.updated_at || ""),
    canceled_at: r.canceled_at ? String(r.canceled_at) : undefined
  };
}
function reservationsListMine_(idToken) {
  var line = verifyLineUser_(idToken);
  var user = findUserByLineId_(line.sub);
  if (!user) return { reservations: [] };
  var list = readTable_("Reservations")
    .filter(function (r) { return String(r.user_id) === String(user.id); })
    .sort(function (a, b) { return new Date(b.starts_at) - new Date(a.starts_at); })
    .map(toReservation_);
  return { reservations: list };
}
function reservationsCancel_(idToken, p) {
  var line = verifyLineUser_(idToken);
  var user = findUserByLineId_(line.sub);
  var rid = String(p.reservation_id || "");
  var rows = readTable_("Reservations");
  var target = null;
  for (var i = 0; i < rows.length; i++) if (String(rows[i].id) === rid) target = rows[i];
  if (!target) throw fail_("予約が見つかりません。", "NOT_FOUND");
  if (!user || String(target.user_id) !== String(user.id)) throw fail_("権限がありません。", "FORBIDDEN");
  // キャンセル規定: 当面いつでも無料（2026-06 暫定方針・フロントと一致）
  var rate = 0;
  var now = nowIso_();
  updateRow_("Reservations", target._row, { status: "CANCELED", canceled_at: now, updated_at: now });
  return { charge_rate: rate, charge_amount: Math.floor(Number(target.total_amount || 0) * rate) };
}

// ====================== Admin ======================
function adminList_(idToken, p) {
  requireAdmin_(idToken);
  var rows = readTable_("Reservations").map(toReservation_);
  if (p.status && p.status !== "ALL") rows = rows.filter(function (r) { return r.status === p.status; });
  if (p.court_id) rows = rows.filter(function (r) { return r.court_id === String(p.court_id); });
  if (p.from) rows = rows.filter(function (r) { return new Date(r.starts_at) >= new Date(p.from); });
  if (p.to) rows = rows.filter(function (r) { return new Date(r.starts_at) < new Date(p.to); });
  if (p.q) {
    var q = String(p.q).toLowerCase();
    rows = rows.filter(function (r) {
      return (r.group_name || "").toLowerCase().indexOf(q) >= 0 || (r.display_number || "").toLowerCase().indexOf(q) >= 0;
    });
  }
  rows.sort(function (a, b) { return new Date(b.starts_at) - new Date(a.starts_at); });
  return { reservations: rows };
}
function findReservationRow_(rid) {
  var rows = readTable_("Reservations");
  for (var i = 0; i < rows.length; i++) if (String(rows[i].id) === String(rid)) return rows[i];
  return null;
}
function adminMarkPaid_(idToken, p) {
  requireAdmin_(idToken);
  var t = findReservationRow_(p.reservation_id);
  if (!t) throw fail_("not found", "NOT_FOUND");
  var now = nowIso_();
  updateRow_("Reservations", t._row, { payment_status: "PAID", paid_at: now, updated_at: now });
  return { paid_at: now };
}
function adminMarkNoShow_(idToken, p) {
  requireAdmin_(idToken);
  var t = findReservationRow_(p.reservation_id);
  if (!t) throw fail_("not found", "NOT_FOUND");
  updateRow_("Reservations", t._row, { status: "NO_SHOW", updated_at: nowIso_() });
  return { status: "NO_SHOW" };
}
function adminCheckin_(idToken, p) {
  requireAdmin_(idToken);
  var t = findReservationRow_(p.reservation_id);
  if (!t) throw fail_("not found", "NOT_FOUND");
  if (String(t.status) === "COMPLETED" || t.checked_in_at) throw fail_("already checked in", "ALREADY_CHECKED_IN");
  var now = nowIso_();
  updateRow_("Reservations", t._row, { status: "COMPLETED", checked_in_at: now, updated_at: now });
  return { checked_in_at: now, display_number: String(t.display_number), group_name: String(t.group_name || "") };
}
function adminSlotsBulk_(idToken, p) {
  requireAdmin_(idToken);
  var status = p.status;
  if (["OPEN", "CLOSED", "BLOCKED"].indexOf(status) < 0) throw fail_("invalid status", "VALIDATION");
  appendRow_("Slots", {
    court_id: String(p.court_id || ""), starts_at: jstIso_(new Date(p.from)),
    ends_at: jstIso_(new Date(p.to)), status: status
  });
  return { updated: 1 };
}
function adminBroadcast_(idToken, p) {
  requireAdmin_(idToken);
  var token = props_("LINE_MESSAGING_TOKEN");
  if (!token) throw fail_("LINE_MESSAGING_TOKEN 未設定（一斉配信は Messaging API 設定が必要）", "CONFIG");
  var res = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/broadcast", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify({ messages: [{ type: "text", text: String(p.text || "") }] }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) throw fail_("配信に失敗: " + res.getContentText(), "BROADCAST");
  return { sent: true };
}
function adminSales_(idToken, p) {
  requireAdmin_(idToken);
  var courts = listCourts_();
  var nameById = {};
  courts.forEach(function (c) { nameById[c.id] = c.name; });
  var paid = readTable_("Reservations").filter(function (r) {
    if (String(r.payment_status) !== "PAID") return false;
    if (p.from && new Date(r.starts_at) < new Date(p.from)) return false;
    if (p.to && new Date(r.starts_at) >= new Date(p.to)) return false;
    return true;
  });
  var total = 0, byCourt = {}, byDay = {};
  paid.forEach(function (r) {
    var amt = Number(r.total_amount || 0);
    total += amt;
    var cid = String(r.court_id);
    if (!byCourt[cid]) byCourt[cid] = { court_id: cid, court_name: nameById[cid] || cid, total: 0, count: 0 };
    byCourt[cid].total += amt; byCourt[cid].count += 1;
    var day = String(r.starts_at).slice(0, 10);
    if (!byDay[day]) byDay[day] = { date: day, total: 0, count: 0 };
    byDay[day].total += amt; byDay[day].count += 1;
  });
  return {
    total: total,
    by_court: Object.keys(byCourt).map(function (k) { return byCourt[k]; }),
    by_day: Object.keys(byDay).sort().map(function (k) { return byDay[k]; })
  };
}

// ====================== Script Properties ======================
function props_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

// ====================== セットアップ（手動実行） ======================
function setup() {
  var book = ss_();
  var schema = {
    Courts: ["id", "facility_id", "name", "court_type", "sides_max", "capacity", "is_active", "created_at"],
    Users: ["id", "line_user_id", "display_name", "phone", "email", "team_name", "role", "created_at", "updated_at"],
    Reservations: ["id", "display_number", "user_id", "court_id", "mode", "starts_at", "ends_at", "sides",
      "purpose", "group_name", "rep_name", "headcount", "note", "status", "total_amount", "payment_status",
      "paid_at", "checked_in_at", "created_at", "updated_at", "canceled_at"],
    Slots: ["court_id", "starts_at", "ends_at", "status"],
    Admins: ["line_user_id", "note"]
  };
  Object.keys(schema).forEach(function (name) {
    var sh = book.getSheetByName(name) || book.insertSheet(name);
    if (sh.getLastRow() === 0) sh.appendRow(schema[name]);
  });
  // ハーフコート1面を投入（未登録なら）
  var courts = readTable_("Courts");
  if (courts.length === 0) {
    appendRow_("Courts", {
      id: "court-half", facility_id: "himawari", name: "バスケコート（ハーフ1面）",
      court_type: "HALF", sides_max: 1, capacity: FREE_MAX_HEADCOUNT, is_active: true, created_at: nowIso_()
    });
  }
  // デフォルトの空シート(Sheet1)があれば削除
  var def = book.getSheetByName("シート1") || book.getSheetByName("Sheet1");
  if (def && book.getSheets().length > 1) book.deleteSheet(def);
  return "setup done";
}
