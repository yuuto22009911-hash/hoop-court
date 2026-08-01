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
 *      既存のスプレッドシートに後から列を足す場合は 関数 migrateSheets() を一度実行
 *      （Reservations の末尾に source / payment_method / phone / cancel_reason / canceled_by を追加）。
 *   3. Script Properties を設定:
 *        LINE_LOGIN_CHANNEL_ID … LINE ログインチャネルの Channel ID（IDトークン検証用・必須）
 *        LINE_MESSAGING_TOKEN  … Messaging API のチャネルアクセストークン（一斉配信用・任意）
 *        ADMIN_USER_IDS        … 管理者の LINE userId をカンマ区切り（任意。Admins シートでも可）
 *   4. 管理画面に ID/パスワードで入れるようにする（LINE不要・任意）:
 *        Script Properties に ADMIN_LOGIN_USER / ADMIN_LOGIN_PASSWORD を設定 → 関数 setAdminLogin() を実行。
 *        （AdminAuth シートにハッシュ保存し、平文プロパティは自動削除。/admin/login から利用）
 *   5. デプロイ → 新しいデプロイ → 種類: ウェブアプリ / 実行: 自分 / アクセス: 全員
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
/** HOLIDAYS が網羅している年の集合。テーブルを更新すれば自動で追随する。 */
var HOLIDAY_YEARS = (function () {
  var years = {};
  Object.keys(HOLIDAYS).forEach(function (k) { years[k.slice(0, 4)] = 1; });
  return years;
})();
var HOLIDAY_WARNED_ = {};
function isWeekendOrHoliday_(ymd) {
  var year = String(ymd).slice(0, 4);
  // 祝日テーブルが切れた年は、祝日が平日料金として計算されてしまう。
  // 料金の挙動は変えず（土日判定のみで動く）、気づけるよう警告だけ残す。
  if (!HOLIDAY_YEARS[year] && !HOLIDAY_WARNED_[year]) {
    HOLIDAY_WARNED_[year] = 1;
    console.warn(
      "[holidays] " + year + " 年の祝日が未登録です（" + ymd + "）。" +
      "祝日が平日料金として計算されます。Code.gs の HOLIDAYS と " +
      "hoop-court/src/lib/holidays.ts、himawari-site/src/lib/gas/holidays.ts を更新してください。"
    );
  }
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

    case "admin.reservations.create": return adminReservationsCreate_(idToken, p);
    case "admin.reservations.cancel": return adminReservationsCancel_(idToken, p);
    case "admin.slots.list": return adminSlotsList_(idToken, p);
    case "admin.slots.set": return adminSlotsSet_(idToken, p);

    case "admin.login": return adminLogin_(p);
    case "admin.logout": return adminLogout_(idToken);
    case "admin.session": return adminSession_(idToken);
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
  // 1) ID/パスワードでログインした管理セッショントークン（/admin/login 経由・LINE不要）
  var sessUser = adminSessionGet_(idToken);
  if (sessUser) return { sub: "admin:" + sessUser, name: sessUser, admin: true, via: "password" };
  // 2) LINE ログイン + userId 許可リスト（ADMIN_USER_IDS / Admins シート）
  var line = verifyLineUser_(idToken);
  var ids = (props_("ADMIN_USER_IDS") || "").split(",").map(function (s) { return s.trim(); }).filter(String);
  var fromSheet = readTable_("Admins").map(function (r) { return String(r.line_user_id); });
  var allowed = ids.concat(fromSheet);
  if (allowed.indexOf(line.sub) < 0) throw fail_("管理者権限がありません。", "FORBIDDEN");
  line.via = "line";
  return line;
}

// ====================== 管理ログイン（ID/パスワード） ======================
// LINE を使わず PC ブラウザ等から管理画面に入るためのパスワード認証。
// 認証情報は AdminAuth シートに「ソルト＋反復SHA-256ハッシュ」で保存し、平文は保持しない。
// ログイン成功でランダムなセッショントークンを発行し、CacheService に保持（6時間・アクセスで延長）。
var ADMIN_HASH_ITERATIONS = 1000;
var ADMIN_SESSION_TTL_SEC = 21600; // CacheService の上限 = 6時間

function bytesToHex_(bytes) {
  var s = "";
  for (var i = 0; i < bytes.length; i++) {
    var v = bytes[i] & 0xFF;
    s += (v < 16 ? "0" : "") + v.toString(16);
  }
  return s;
}
/** salt(hex) + ":" + password を反復 SHA-256 でハッシュ化（hex を返す）。 */
function hashPassword_(password, saltHex, iterations) {
  var n = iterations || ADMIN_HASH_ITERATIONS;
  var data = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, String(saltHex) + ":" + String(password), Utilities.Charset.UTF_8
  );
  for (var i = 1; i < n; i++) {
    data = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, data);
  }
  return bytesToHex_(data);
}
function randomSaltHex_() {
  return (uuid_() + uuid_()).replace(/-/g, "").slice(0, 32); // 16 byte 分
}
function adminFindCred_(username) {
  var rows = readTable_("AdminAuth");
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].username) === username) return rows[i];
  }
  return null;
}
function adminSessionPut_(username) {
  var token = (uuid_() + uuid_()).replace(/-/g, ""); // 64 hex
  CacheService.getScriptCache().put("adm:" + token, String(username), ADMIN_SESSION_TTL_SEC);
  return token;
}
function adminSessionGet_(token) {
  // セッショントークン形式（64桁hex）のみ参照。LINE の長い JWT はキー長上限に当たるため弾く。
  if (!token || typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return null;
  var cache = CacheService.getScriptCache();
  var username = cache.get("adm:" + token);
  if (username) cache.put("adm:" + token, username, ADMIN_SESSION_TTL_SEC); // アクセスで延長（スライディング）
  return username;
}
function adminSessionRemove_(token) {
  if (token && typeof token === "string" && /^[0-9a-f]{64}$/.test(token)) {
    CacheService.getScriptCache().remove("adm:" + token);
  }
}
function adminLogin_(p) {
  var username = String((p && p.username) || "").trim();
  var password = String((p && p.password) || "");
  if (!username || !password) throw fail_("IDとパスワードを入力してください。", "VALIDATION");
  var cred = adminFindCred_(username);
  // ユーザー有無でタイミング差が出ないよう、未登録でもハッシュ計算は実施する。
  var saltHex = cred ? String(cred.salt) : "00000000000000000000000000000000";
  var iter = cred ? (Number(cred.iterations) || ADMIN_HASH_ITERATIONS) : ADMIN_HASH_ITERATIONS;
  var calc = hashPassword_(password, saltHex, iter);
  if (!cred || calc !== String(cred.hash)) throw fail_("IDまたはパスワードが違います。", "AUTH");
  var token = adminSessionPut_(username);
  return { token: token, username: username, expires_in: ADMIN_SESSION_TTL_SEC };
}
function adminLogout_(idToken) {
  adminSessionRemove_(idToken);
  return { ok: true };
}
function adminSession_(idToken) {
  var a = requireAdmin_(idToken);
  return { ok: true, username: String(a.name || ""), via: a.via || "line" };
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
/**
 * Reservations に後から足した列。物理的にシートへ追加されていないと
 * appendRow_ / updateRow_ がヘッダ名で解決できず、値を黙って捨ててしまう。
 * 追加は migrateSheets()（内部的に ensureReservationColumns_()）で行う。
 */
var RESERVATION_EXTRA_COLUMNS = ["source", "payment_method", "phone", "cancel_reason", "canceled_by"];
/** 指定した列が Reservations に存在しなければ CONFIG エラー（黙って捨てるのを防ぐ） */
function requireReservationColumns_(names) {
  var hs = headers_("Reservations").map(String);
  var missing = names.filter(function (n) { return hs.indexOf(n) < 0; });
  if (missing.length) {
    throw fail_(
      "Reservations シートに列がありません: " + missing.join(", ") +
      "（Apps Script エディタから migrateSheets() を1回実行してください）", "CONFIG"
    );
  }
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

// ====================== 表示フォーマット ======================
var DOW_JA = ["日", "月", "火", "水", "木", "金", "土"];
/** "6月26日(金) 10:00〜11:00"（TZ非依存に ISO 文字列から組み立てる） */
function formatRangeJa_(startsIso, endsIso) {
  var ymd = String(startsIso).slice(0, 10);
  var mm = parseInt(ymd.slice(5, 7), 10);
  var dd = parseInt(ymd.slice(8, 10), 10);
  return mm + "月" + dd + "日(" + DOW_JA[ymdToDow_(ymd)] + ") " +
    String(startsIso).slice(11, 16) + "〜" + String(endsIso).slice(11, 16);
}
/** 1210 → "¥1,210" */
function yen_(n) {
  var v = Math.round(Number(n) || 0);
  return "¥" + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ====================== LINE メッセージ送信 ======================
/**
 * 個別プッシュ送信。LINE_MESSAGING_TOKEN 未設定なら送らず false を返す（例外にしない）。
 * 友だち未追加のユーザーには LINE 側で 403 になるため、失敗も false で返す。
 */
function linePush_(toUserId, text) {
  if (!toUserId || !text) return false;
  var token = props_("LINE_MESSAGING_TOKEN");
  if (!token) return false;
  var res = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify({ to: String(toUserId), messages: [{ type: "text", text: String(text) }] }),
    muteHttpExceptions: true
  });
  return res.getResponseCode() < 300;
}
/** 予約確定時にお客様へ送るメッセージ本文 */
function confirmMessage_(displayNumber, mode, startsIso, endsIso, amount, headcount) {
  var lines = [
    "【ご予約が確定しました】",
    "",
    "予約番号: " + displayNumber,
    "種別: " + (mode === "FREE" ? "バスケフリーゴール" : "貸切（コート）"),
    "日時: " + formatRangeJa_(startsIso, endsIso)
  ];
  if (mode === "FREE" && headcount) lines.push("人数: " + headcount + " 名");
  lines.push("金額: " + yen_(amount) + "（当日現地払い）");
  lines.push("");
  lines.push("当日はマイページの QR コードをご提示ください。");
  lines.push("※ご予約時間を過ぎると30分ごとの追加料金が発生します。");
  lines.push("※当日のご予約も開始時刻前までは承ります（過去の時間帯は不可）。");
  lines.push("※ご予約内容の変更はカウンターのみ（要相談）です。");
  return lines.join("\n");
}

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
    return String(r.court_id) === court_id && isBlockingStatus_(r.status) && String(r.mode) === "CHARTER";
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
  // 開始時刻が現在より過去の枠は予約できない（createReservationCore_ の判定と同一基準）。
  // 唯一の可用性ソースなので、ここで潰せば LIFF・管理画面の双方に一様に効く。
  var nowMs = Date.now();
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
      var blocked = overlapsAny_(resRanges, st, en) || overlapsAny_(ovrRanges, st, en) || st < nowMs;
      slots.push({ slot_id: court_id + "-" + sIso, starts_at: sIso, ends_at: eIso, is_available: !blocked });
    }
    ymd = jstYmd_(new Date(new Date(ymd + "T12:00:00+09:00").getTime() + 24 * 3600 * 1000));
    guard++;
  }
  return { slots: slots };
}
/**
 * 枠を占有しているとみなす予約ステータス。
 *
 * CONFIRMED（確定）に加え、COMPLETED（受付済み）も含める。
 * 当日予約を解禁したことで「受付済みだが、まだ利用中＝終了時刻が未来」の予約が
 * 生じるようになった。COMPLETED を外すと、受付した瞬間にその枠が空きに戻り、
 * 利用中のコートへ別の予約が入ってしまう。
 * NO_SHOW は来なかった枠なので対象外（売り直せる方が運用に合う）。
 */
var BLOCKING_STATUSES = ["CONFIRMED", "COMPLETED"];
function isBlockingStatus_(status) {
  return BLOCKING_STATUSES.indexOf(String(status)) >= 0;
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

// ====================== 予約作成の共通コア ======================
/**
 * 予約1件を検証・採番して Reservations に追記する共通処理。
 * LIFF（reservations.create）と管理版（admin.reservations.create）の双方がここを通る。
 * 重複判定・人数判定・金額算出を二重実装しないための唯一の入口。
 *
 * opts = {
 *   p:              リクエスト payload（court_id / mode / starts_at / ends_at / … ）
 *   user_id:        Users.id、またはカウンター受付の固定値 "WALK_IN"
 *   source:         "" = LIFF 経由 / "manual" = 管理画面から作成
 *   allowPast:      true なら過去時刻の予約を許可（カウンター受付は事後入力になりがち）
 *   phone:          電話番号（任意・phone 列へ）
 *   payment_method: "CASH" | "PAYPAY" | "BANK_TRANSFER"（指定時はその場で PAID にする）
 * }
 * 戻り値: { reservation_id, display_number, amount, mode, starts_at, ends_at, headcount, payment_status }
 */
function createReservationCore_(opts) {
  var p = (opts && opts.p) || {};
  var mode = p.mode || "CHARTER";
  if (!p.starts_at || !p.ends_at) throw fail_("開始・終了時刻は必須です。", "VALIDATION");
  var startDate = new Date(p.starts_at);
  var endDate = new Date(p.ends_at);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw fail_("日時の形式が不正です。", "VALIDATION");
  }
  var ymd = String(p.starts_at).slice(0, 10);
  var startMin = hhmmToMin_(p.starts_at);
  var endMin = hhmmToMin_(p.ends_at);
  var durationMin = endMin - startMin;
  var start = startDate;
  var end = endDate;

  if (durationMin <= 0) throw fail_("終了時刻は開始時刻より後にしてください。", "P0002");
  if (startMin < OPEN_HOUR * 60 || endMin > CLOSE_HOUR * 60) {
    throw fail_("予約は " + OPEN_HOUR + ":00〜" + CLOSE_HOUR + ":00 の範囲で指定してください。", "P0004");
  }
  // 当日でも開始時刻前なら予約できる。過去の時間帯のみ拒否（availabilityRange_ と同一基準）。
  if (!opts.allowPast && start.getTime() < Date.now()) {
    throw fail_("過去の時間帯はご予約いただけません。", "P0005");
  }

  var court_id = String(p.court_id || "");
  var court = null;
  var courts = listCourts_();
  for (var i = 0; i < courts.length; i++) if (courts[i].id === court_id) court = courts[i];
  if (!court) throw fail_("コートが見つかりません。", "P0010");

  var payment_method = String(opts.payment_method || "");
  var payment_status = payment_method ? "PAID" : "UNPAID";

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var blocking = readTable_("Reservations").filter(function (r) {
      return String(r.court_id) === court_id && isBlockingStatus_(r.status);
    });
    var amount;
    if (mode === "FREE") {
      if (durationMin % 30 !== 0) throw fail_("フリーは30分単位でご指定ください。", "P0006");
      var headcount = Number(p.headcount) || 0;
      if (headcount < 1 || headcount > FREE_MAX_HEADCOUNT) {
        throw fail_("フリーの人数は 1〜" + FREE_MAX_HEADCOUNT + " 名でご指定ください。", "P0007");
      }
      var charterClash = blocking.some(function (r) {
        return String(r.mode) === "CHARTER" && new Date(r.starts_at) < end && new Date(r.ends_at) > start;
      });
      if (charterClash) throw fail_("選択した時間帯は貸切のため、フリーはご利用いただけません。", "P0001");
      var overlapHead = blocking.filter(function (r) {
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
      var overlap = blocking.some(function (r) {
        return new Date(r.starts_at) < end && new Date(r.ends_at) > start;
      });
      if (overlap) throw fail_("選択した時間帯はすでに予約済みです。", "P0001");
      amount = charterPrice_(ymd, startMin, endMin);
    }

    var id = uuid_();
    var display_number = "R-" + ymd + "-" + id.slice(0, 4);
    var now = nowIso_();
    appendRow_("Reservations", {
      id: id, display_number: display_number, user_id: String(opts.user_id || ""), court_id: court_id, mode: mode,
      starts_at: jstIso_(start), ends_at: jstIso_(end), sides: 1, purpose: p.purpose || "",
      group_name: p.group_name || "", rep_name: p.rep_name || "", headcount: p.headcount || "",
      note: p.note || "", status: "CONFIRMED", total_amount: amount, payment_status: payment_status,
      paid_at: payment_method ? now : "", checked_in_at: "", created_at: now, updated_at: now, canceled_at: "",
      source: String(opts.source || ""), payment_method: payment_method, phone: String(opts.phone || ""),
      cancel_reason: "", canceled_by: ""
    });
    return {
      reservation_id: id, display_number: display_number, amount: amount, mode: mode,
      starts_at: jstIso_(start), ends_at: jstIso_(end), headcount: p.headcount || "",
      payment_status: payment_status
    };
  } finally {
    lock.releaseLock();
  }
}

// ====================== Member: reservations ======================
function reservationsCreate_(idToken, p) {
  var line = verifyLineUser_(idToken);
  var user = findUserByLineId_(line.sub);
  if (!user) throw fail_("プロフィール登録が必要です。", "UNREGISTERED");

  var created = createReservationCore_({
    p: p, user_id: user.id, source: "", allowPast: false, phone: "", payment_method: ""
  });

  // 予約確定通知（ロック解放後に送る。通知失敗で予約を失敗させない）
  try {
    linePush_(line.sub, confirmMessage_(
      created.display_number, created.mode, created.starts_at, created.ends_at, created.amount, p.headcount
    ));
  } catch (err) {
    // 友だち未追加・トークン未設定などは想定内。予約は成立済みなので無視する。
  }
  return {
    reservation_id: created.reservation_id,
    display_number: created.display_number,
    amount: created.amount
  };
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
    canceled_at: r.canceled_at ? String(r.canceled_at) : undefined,
    // 後から末尾に追加した列（列が無い既存シートでは空文字になる）
    source: r.source ? String(r.source) : "",
    payment_method: r.payment_method ? String(r.payment_method) : "",
    phone: r.phone ? String(r.phone) : "",
    cancel_reason: r.cancel_reason ? String(r.cancel_reason) : "",
    canceled_by: r.canceled_by ? String(r.canceled_by) : ""
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
/**
 * 予約を1件特定する。QR の reservation_id だけでなく、受付で読み上げやすい
 * 予約番号（例 R-2026-06-26-d1f8）でも引けるようにしている（大文字小文字・前後空白は無視）。
 */
function findReservationRow_(rid) {
  var key = String(rid || "").trim();
  if (!key) return null;
  var lower = key.toLowerCase();
  var rows = readTable_("Reservations");
  var i;
  // 1) 内部ID（UUID）は一意なのでそのまま返す
  for (i = 0; i < rows.length; i++) if (String(rows[i].id) === key) return rows[i];
  // 2) 予約番号で照合。R-{日付}-{UUID先頭4桁} は 65,536 通りしかなく、
  //    同じ日に4桁が衝突しうる。黙って別人を受け付けるのが最悪なので、
  //    CONFIRMED を優先し、それでも絞れなければエラーにして現場に気づかせる。
  var matches = [];
  for (i = 0; i < rows.length; i++) {
    if (String(rows[i].display_number).trim().toLowerCase() === lower) matches.push(rows[i]);
  }
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  var stillConfirmed = matches.filter(function (r) { return String(r.status) === "CONFIRMED"; });
  if (stillConfirmed.length === 1) return stillConfirmed[0];
  throw fail_(
    "予約番号「" + key + "」に一致する予約が " + matches.length + " 件あります。" +
    "一覧から対象を選ぶか、予約IDで指定してください。",
    "AMBIGUOUS"
  );
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
/** キャンセル実行者の記録用。認証経路が分かるよう系統を前置きする。 */
function adminActorLabel_(a) {
  if (a && a.via === "password") return "admin:" + String(a.name || "");
  return "line:" + String((a && a.sub) || "");
}
/**
 * 管理者による予約キャンセル。
 * - reservation_id は内部ID・予約番号のどちらでも可（findReservationRow_ を再利用）
 * - すでに CANCELED なら冪等成功（already: true）。二重クリックで運用を止めない
 * - COMPLETED / NO_SHOW も許可（受付後の返金対応があるため）。prev_status を返す
 * - LINE 通知は送らない（会員セルフキャンセルと挙動を揃える）
 */
function adminReservationsCancel_(idToken, p) {
  var admin = requireAdmin_(idToken);
  var rid = String((p && p.reservation_id) || "").trim();
  if (!rid) throw fail_("reservation_id は必須です。", "VALIDATION");
  requireReservationColumns_(["cancel_reason", "canceled_by"]);
  var t = findReservationRow_(rid);
  if (!t) throw fail_("予約が見つかりません。", "NOT_FOUND");

  var prev_status = String(t.status || "");
  if (prev_status === "CANCELED") {
    return {
      status: "CANCELED",
      canceled_at: t.canceled_at ? String(t.canceled_at) : "",
      already: true,
      prev_status: prev_status,
      display_number: String(t.display_number || "")
    };
  }
  var now = nowIso_();
  updateRow_("Reservations", t._row, {
    status: "CANCELED", canceled_at: now, updated_at: now,
    cancel_reason: String((p && p.reason) || ""), canceled_by: adminActorLabel_(admin)
  });
  return {
    status: "CANCELED", canceled_at: now, already: false,
    prev_status: prev_status, display_number: String(t.display_number || "")
  };
}
var PAYMENT_METHODS = ["CASH", "PAYPAY", "BANK_TRANSFER"];
/**
 * カウンター受付（代理予約）。LINE 未登録の来店客を管理者が登録する。
 * 検証・金額算出・排他制御は createReservationCore_ に集約（LIFF 版と同じ経路）。
 * payment_method が指定された場合はその場で PAID とし paid_at も記録する。
 */
function adminReservationsCreate_(idToken, p) {
  requireAdmin_(idToken);
  p = p || {};
  var group_name = String(p.group_name || "").trim();
  if (!group_name) throw fail_("団体名（お名前）は必須です。", "VALIDATION");
  var payment_method = String(p.payment_method || "").trim();
  if (payment_method && PAYMENT_METHODS.indexOf(payment_method) < 0) {
    throw fail_("payment_method は " + PAYMENT_METHODS.join(" / ") + " のいずれかです。", "VALIDATION");
  }
  requireReservationColumns_(["source", "payment_method", "phone"]);
  var created = createReservationCore_({
    p: {
      court_id: p.court_id, mode: p.mode || "CHARTER", starts_at: p.starts_at, ends_at: p.ends_at,
      purpose: p.purpose || "", group_name: group_name, rep_name: p.rep_name || "",
      headcount: p.headcount, note: p.note || ""
    },
    user_id: "WALK_IN",     // Users にゲスト行を作らない。listMine は UUID 完全一致のため混入しない
    source: "manual",
    allowPast: true,        // カウンター入力は事後になりがちなため過去時刻も許可
    phone: p.phone || "",
    payment_method: payment_method
  });
  return {
    reservation_id: created.reservation_id,
    display_number: created.display_number,
    amount: created.amount,
    payment_status: created.payment_status
  };
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
/**
 * 枠ごとの状態一覧（週グリッドの色分け用）。
 * 優先順位は BOOKED > CLOSED/BLOCKED（Slots 由来） > OPEN。
 * 現場は「誰の予約で埋まっているか」を知りたいため予約を最優先する。
 * 過去枠も実績として返す（availability.range と違い時刻での除外はしない）。
 */
function adminSlotsList_(idToken, p) {
  requireAdmin_(idToken);
  var court_id = String((p && p.court_id) || "");
  if (!court_id) throw fail_("court_id は必須です。", "VALIDATION");
  var fromYmd = jstYmd_(new Date(p.from));
  var toYmd = jstYmd_(new Date(p.to));
  var blocking = readTable_("Reservations").filter(function (r) {
    return String(r.court_id) === court_id && isBlockingStatus_(r.status);
  });
  var overrides = readTable_("Slots").filter(function (s) {
    return String(s.court_id) === court_id && String(s.status) !== "OPEN";
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

      var hits = blocking.filter(function (r) {
        return new Date(r.starts_at).getTime() < en && new Date(r.ends_at).getTime() > st;
      });
      var freeHead = hits.filter(function (r) { return String(r.mode) === "FREE"; })
        .reduce(function (s, r) { return s + (Number(r.headcount) || 0); }, 0);

      var slot = {
        slot_id: court_id + "-" + sIso, starts_at: sIso, ends_at: eIso, state: "OPEN",
        free_remaining: Math.max(0, FREE_MAX_HEADCOUNT - freeHead), reservation_count: hits.length
      };
      if (hits.length) {
        // FREE が複数ある枠は先頭1件だけ載せ、他があることは reservation_count で示す
        slot.state = "BOOKED";
        slot.reservation_id = String(hits[0].id);
        slot.display_number = String(hits[0].display_number || "");
        slot.group_name = String(hits[0].group_name || "");
      } else {
        for (var j = 0; j < overrides.length; j++) {
          var ost = new Date(overrides[j].starts_at).getTime();
          var oen = new Date(overrides[j].ends_at).getTime();
          if (ost < en && oen > st) {
            slot.state = String(overrides[j].status) === "BLOCKED" ? "BLOCKED" : "CLOSED";
            break; // 複数重なる場合はシート上の先頭行を採用
          }
        }
      }
      slots.push(slot);
    }
    ymd = jstYmd_(new Date(new Date(ymd + "T12:00:00+09:00").getTime() + 24 * 3600 * 1000));
    guard++;
  }
  return { slots: slots };
}
/**
 * 枠設定の置き換え・解除。bulkUpdate（追加のみ）では CLOSED を戻せないため新設。
 *  1. 指定期間に重なる既存 Slots 行を削除
 *  2. はみ出した前後の残余を元の status のまま再挿入（広い CLOSED の一部だけ開けられる）
 *  3. status が OPEN 以外なら新しい行を1つ追記（OPEN は削除のみ）
 * 行削除はロック内・_row の降順（インデックスずれ防止）。
 */
function adminSlotsSet_(idToken, p) {
  requireAdmin_(idToken);
  var court_id = String((p && p.court_id) || "");
  if (!court_id) throw fail_("court_id は必須です。", "VALIDATION");
  var status = String((p && p.status) || "");
  if (["OPEN", "CLOSED", "BLOCKED"].indexOf(status) < 0) throw fail_("invalid status", "VALIDATION");
  var from = new Date(p.from);
  var to = new Date(p.to);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) throw fail_("from / to が不正です。", "VALIDATION");
  if (from.getTime() >= to.getTime()) throw fail_("to は from より後にしてください。", "VALIDATION");
  var fromMs = from.getTime();
  var toMs = to.getTime();

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var hits = readTable_("Slots").filter(function (s) {
      if (String(s.court_id) !== court_id) return false;
      var st = new Date(s.starts_at).getTime();
      var en = new Date(s.ends_at).getTime();
      if (isNaN(st) || isNaN(en)) return false;
      return st < toMs && en > fromMs;
    });
    var residues = [];
    hits.forEach(function (s) {
      var st = new Date(s.starts_at).getTime();
      var en = new Date(s.ends_at).getTime();
      if (st < fromMs) {
        residues.push({
          court_id: court_id, starts_at: jstIso_(new Date(st)), ends_at: jstIso_(from), status: String(s.status)
        });
      }
      if (en > toMs) {
        residues.push({
          court_id: court_id, starts_at: jstIso_(to), ends_at: jstIso_(new Date(en)), status: String(s.status)
        });
      }
    });
    var sh = sheet_("Slots");
    hits.map(function (s) { return s._row; })
      .sort(function (a, b) { return b - a; })
      .forEach(function (rowNumber) { sh.deleteRow(rowNumber); });

    var added = 0;
    residues.forEach(function (r) { appendRow_("Slots", r); added++; });
    if (status !== "OPEN") {
      appendRow_("Slots", {
        court_id: court_id, starts_at: jstIso_(from), ends_at: jstIso_(to), status: status
      });
      added++;
    }
    return { removed: hits.length, added: added };
  } finally {
    lock.releaseLock();
  }
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
      "paid_at", "checked_in_at", "created_at", "updated_at", "canceled_at",
      "source", "payment_method", "phone", "cancel_reason", "canceled_by"],
    Slots: ["court_id", "starts_at", "ends_at", "status"],
    Admins: ["line_user_id", "note"],
    AdminAuth: ["username", "salt", "hash", "iterations", "note", "created_at", "updated_at"]
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

/**
 * Reservations の末尾に不足している列だけを追記する（冪等）。
 * setup() はヘッダ行が既にあると何もしないため、稼働中のシートにはこちらを使う。
 * 列の並べ替え・削除・改名は一切しない（GAS はヘッダ名で読み書きしている）。
 * 戻り値: 実際に追加した列名の配列
 */
function ensureReservationColumns_() {
  var sh = sheet_("Reservations");
  var lastCol = sh.getLastColumn();
  var current = lastCol > 0
    ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h); })
    : [];
  var missing = RESERVATION_EXTRA_COLUMNS.filter(function (h) { return current.indexOf(h) < 0; });
  if (!missing.length) return [];
  sh.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
  return missing;
}
/**
 * 稼働中のスプレッドシートにスキーマ変更を反映する（Apps Script エディタから手動実行）。
 * 何度実行しても安全。再デプロイの前に1回実行しておくこと。
 */
function migrateSheets() {
  var added = ensureReservationColumns_();
  return added.length
    ? "Reservations に列を追加しました: " + added.join(", ")
    : "追加すべき列はありません（適用済み）。";
}

function ensureAdminAuthSheet_() {
  var book = ss_();
  var sh = book.getSheetByName("AdminAuth");
  if (!sh) sh = book.insertSheet("AdminAuth");
  if (sh.getLastRow() === 0) {
    sh.appendRow(["username", "salt", "hash", "iterations", "note", "created_at", "updated_at"]);
  }
}

/**
 * 管理ログイン（ID/パスワード）を登録・更新する。エディタから一度だけ実行する。
 * 手順:
 *   1. プロジェクトの設定 → スクリプト プロパティに以下を追加
 *        ADMIN_LOGIN_USER     … 管理ログインのユーザーID（例: himawari-admin）
 *        ADMIN_LOGIN_PASSWORD … 管理ログインのパスワード（強固なものを推奨）
 *   2. この setAdminLogin を実行
 *   → AdminAuth シートにソルト＋ハッシュで保存し、平文パスワードのプロパティは自動削除する。
 * パスワードを変えるときも、同じ2手順を再実行すればよい（同一 username は上書き）。
 */
function setAdminLogin() {
  var props = PropertiesService.getScriptProperties();
  var username = String(props.getProperty("ADMIN_LOGIN_USER") || "").trim();
  var password = String(props.getProperty("ADMIN_LOGIN_PASSWORD") || "");
  if (!username || !password) {
    throw new Error(
      "スクリプト プロパティに ADMIN_LOGIN_USER と ADMIN_LOGIN_PASSWORD を設定してから実行してください。"
    );
  }
  ensureAdminAuthSheet_();
  var saltHex = randomSaltHex_();
  var hash = hashPassword_(password, saltHex, ADMIN_HASH_ITERATIONS);
  var now = nowIso_();
  var cred = adminFindCred_(username);
  if (cred) {
    updateRow_("AdminAuth", cred._row, {
      salt: saltHex, hash: hash, iterations: ADMIN_HASH_ITERATIONS, updated_at: now
    });
  } else {
    appendRow_("AdminAuth", {
      username: username, salt: saltHex, hash: hash, iterations: ADMIN_HASH_ITERATIONS,
      note: "", created_at: now, updated_at: now
    });
  }
  // 平文パスワードは保持しない（ハッシュのみ残す）
  props.deleteProperty("ADMIN_LOGIN_PASSWORD");
  return "管理ログインを設定しました: " + username;
}
