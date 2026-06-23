/**
 * Apps Script Web App へのクライアント
 * 仕様書 §6.2 単一エンドポイント設計 / §10.5 DEMO モード。
 *
 * - 本番: fetch(endpoint, { method: 'POST', body }) で action + idToken を送信
 * - DEMO: NEXT_PUBLIC_DEMO_MODE=1 のとき localStorage に擬似データを保持
 */

import type {
  ApiResponse,
  AvailabilitySlot,
  Court,
  CreateReservationPayload,
  Reservation,
  UserProfile
} from "./types";
import {
  CLOSE_HOUR,
  FREE_MAX_HEADCOUNT,
  OPEN_HOUR,
  charterPrice,
  freePrice
} from "./pricing";

const GAS_ENDPOINT = process.env.NEXT_PUBLIC_GAS_ENDPOINT ?? "";
const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

class GasError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "GasError";
    this.code = code;
  }
}

/** 共通 POST 関数。GET 系も単一エンドポイントに統一 (仕様書 §6.2) */
async function post<T>(action: string, payload?: unknown, idToken?: string): Promise<T> {
  if (DEMO) {
    // DEMO ハンドラに委譲
    return demoHandler<T>(action, payload);
  }
  if (!GAS_ENDPOINT) {
    throw new GasError("NEXT_PUBLIC_GAS_ENDPOINT is not configured", "CONFIG");
  }
  const res = await fetch(GAS_ENDPOINT, {
    method: "POST",
    // GAS の Content-Type 判定を避けるため text/plain を推奨 (CORS preflight 回避)
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify({ action, payload, idToken }),
    redirect: "follow"
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.ok) throw new GasError(json.error, json.code);
  return json.data;
}

// ============ Public API ============

export async function listCourts(): Promise<{ courts: Court[] }> {
  return post("courts.list");
}

export async function availabilityRange(
  court_id: string,
  from: string,
  to: string
): Promise<{ slots: AvailabilitySlot[] }> {
  return post("availability.range", { court_id, from, to });
}

// ============ Member API (idToken 必須) ============

export async function authMe(
  idToken: string
): Promise<{ user: UserProfile | null; registered: boolean }> {
  return post("auth.me", undefined, idToken);
}

export async function authRegister(
  idToken: string,
  payload: {
    display_name: string;
    phone: string;
    email: string;
    team_name?: string;
  }
): Promise<{ registered: true }> {
  return post("auth.register", payload, idToken);
}

export async function createReservation(
  idToken: string,
  payload: CreateReservationPayload
): Promise<{ reservation_id: string; display_number: string; amount: number }> {
  return post("reservations.create", payload, idToken);
}

export async function listMyReservations(
  idToken: string
): Promise<{ reservations: Reservation[] }> {
  return post("reservations.listMine", undefined, idToken);
}

export async function cancelReservation(
  idToken: string,
  reservation_id: string
): Promise<{ charge_rate: number; charge_amount: number }> {
  return post("reservations.cancel", { reservation_id }, idToken);
}

// ============ Admin API ============

export async function adminListReservations(
  idToken: string,
  filter: { from?: string; to?: string; status?: string; court_id?: string; q?: string }
): Promise<{ reservations: Reservation[] }> {
  return post("admin.reservations.list", filter, idToken);
}

export async function adminMarkPaid(
  idToken: string,
  reservation_id: string,
  method: "CASH" | "PAYPAY" | "BANK_TRANSFER",
  options?: { received_by?: string; amount?: number; note?: string }
): Promise<{ paid_at: string }> {
  return post("admin.reservations.markPaid", { reservation_id, method, ...options }, idToken);
}

export async function adminCheckin(
  idToken: string,
  reservation_id: string
): Promise<{ checked_in_at: string; display_number: string; group_name: string }> {
  return post("admin.checkin", { reservation_id }, idToken);
}

export async function adminMarkNoShow(
  idToken: string,
  reservation_id: string
): Promise<{ status: "NO_SHOW" }> {
  return post("admin.reservations.markNoShow", { reservation_id }, idToken);
}

export async function adminSlotsBulk(
  idToken: string,
  court_id: string,
  from: string,
  to: string,
  status: "OPEN" | "CLOSED" | "BLOCKED"
): Promise<{ updated: number }> {
  return post("admin.slots.bulkUpdate", { court_id, from, to, status }, idToken);
}

export async function adminBroadcast(
  idToken: string,
  text: string
): Promise<{ sent: true }> {
  return post("admin.broadcast", { text }, idToken);
}

export async function adminSalesSummary(
  idToken: string,
  from: string,
  to: string
): Promise<{
  total: number;
  by_court: { court_id: string; court_name: string; total: number; count: number }[];
  by_day: { date: string; total: number; count: number }[];
}> {
  return post("admin.sales.summary", { from, to }, idToken);
}

// ============ DEMO モード ============
// 仕様書 §10.5: キー無しで UI 確認ができるよう localStorage に擬似データを持つ

const DEMO_KEY_RES = "hc_demo_reservations";
const DEMO_KEY_USER = "hc_demo_user";

function demoHandler<T>(action: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const result = demoExec(action, payload as Record<string, unknown>);
        resolve(result as T);
      } catch (err) {
        reject(err);
      }
    }, 200);
  });
}

// バスケ体育館はハーフコート1面（向日葵株式会社の実構成）
const DEMO_COURTS: Court[] = [
  {
    id: "demo-court",
    facility_id: "demo-facility",
    name: "バスケコート（ハーフ1面）",
    court_type: "HALF",
    sides_max: 1,
    capacity: FREE_MAX_HEADCOUNT,
    is_active: true,
    created_at: "2026-04-01T00:00:00+09:00"
  }
];

function demoExec(action: string, p: Record<string, unknown>) {
  const stored = typeof window === "undefined" ? [] : safeJson<Reservation[]>(DEMO_KEY_RES, []);
  const userStored =
    typeof window === "undefined" ? null : safeJson<UserProfile | null>(DEMO_KEY_USER, null);

  switch (action) {
    case "courts.list":
      return { courts: DEMO_COURTS };

    case "availability.range": {
      const { court_id, from, to } = p as { court_id: string; from: string; to: string };
      const fromT = new Date(from).getTime();
      const toT = new Date(to).getTime();
      const SLOT = 1800_000; // 30分
      const slots: AvailabilitySlot[] = [];
      for (let t = fromT; t < toT; t += SLOT) {
        const st = new Date(t);
        const en = new Date(t + SLOT);
        // 営業時間 9:00–20:00 の枠だけ生成
        const startMin = st.getHours() * 60 + st.getMinutes();
        const endMin = startMin + 30;
        if (startMin < OPEN_HOUR * 60 || endMin > CLOSE_HOUR * 60) continue;
        // 貸切（CHARTER）の確定予約が重なる枠は予約不可とする
        const blocked = stored.some(
          (r) =>
            r.court_id === court_id &&
            r.status === "CONFIRMED" &&
            r.mode === "CHARTER" &&
            new Date(r.starts_at).getTime() < t + SLOT &&
            new Date(r.ends_at).getTime() > t
        );
        slots.push({
          slot_id: `demo-${court_id}-${st.toISOString()}`,
          starts_at: st.toISOString(),
          ends_at: en.toISOString(),
          is_available: !blocked
        });
      }
      return { slots };
    }

    case "auth.me":
      return { user: userStored, registered: Boolean(userStored) };

    case "auth.register": {
      const user: UserProfile = {
        id: "demo-user",
        line_user_id: "demo-user",
        display_name: String(p.display_name),
        phone: String(p.phone),
        email: String(p.email),
        team_name: p.team_name ? String(p.team_name) : "",
        role: "MEMBER",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      localStorage.setItem(DEMO_KEY_USER, JSON.stringify(user));
      return { registered: true };
    }

    case "reservations.create": {
      const payload = p as unknown as CreateReservationPayload;
      const mode = payload.mode ?? "CHARTER";
      const start = new Date(payload.starts_at);
      const end = new Date(payload.ends_at);
      // タイムゾーン非依存に、文字列(YYYY-MM-DDTHH:MM...+09:00)から壁時計を取り出す
      const ymd = payload.starts_at.slice(0, 10);
      const startMinOfDay = hhmmToMin(payload.starts_at);
      const endMinOfDay = hhmmToMin(payload.ends_at);
      const durationMin = endMinOfDay - startMinOfDay;

      if (durationMin <= 0) {
        throw new GasError("終了時刻は開始時刻より後にしてください。", "P0002");
      }
      if (startMinOfDay < OPEN_HOUR * 60 || endMinOfDay > CLOSE_HOUR * 60) {
        throw new GasError(`予約は ${OPEN_HOUR}:00〜${CLOSE_HOUR}:00 の範囲で指定してください。`, "P0004");
      }
      // 当日予約はカウンターのみ（アプリは翌日以降）
      if (ymd <= todayYmd()) {
        throw new GasError("当日のご予約はカウンターのみ（要相談）です。", "P0005");
      }

      let amount: number;
      if (mode === "FREE") {
        if (durationMin % 30 !== 0) {
          throw new GasError("フリーは30分単位でご指定ください。", "P0006");
        }
        const headcount = Number(payload.headcount) || 0;
        if (headcount < 1 || headcount > FREE_MAX_HEADCOUNT) {
          throw new GasError(`フリーの人数は 1〜${FREE_MAX_HEADCOUNT} 名でご指定ください。`, "P0007");
        }
        // 貸切と重なる枠にはフリー不可
        const charterClash = stored.some(
          (r) =>
            r.court_id === payload.court_id &&
            r.status === "CONFIRMED" &&
            r.mode === "CHARTER" &&
            new Date(r.starts_at) < end &&
            new Date(r.ends_at) > start
        );
        if (charterClash) {
          throw new GasError("選択した時間帯は貸切のため、フリーはご利用いただけません。", "P0001");
        }
        // 同一時間帯のフリー人数が規定人数を超えないか
        const overlapHead = stored
          .filter(
            (r) =>
              r.court_id === payload.court_id &&
              r.status === "CONFIRMED" &&
              r.mode === "FREE" &&
              new Date(r.starts_at) < end &&
              new Date(r.ends_at) > start
          )
          .reduce((s, r) => s + (Number(r.headcount) || 0), 0);
        if (overlapHead + headcount > FREE_MAX_HEADCOUNT) {
          throw new GasError(
            `この時間帯のフリーは残り ${Math.max(0, FREE_MAX_HEADCOUNT - overlapHead)} 名です。`,
            "P0008"
          );
        }
        amount = freePrice(ymd, durationMin / 30, headcount);
      } else {
        // 貸切は1時間単位
        if (startMinOfDay % 60 !== 0 || endMinOfDay % 60 !== 0) {
          throw new GasError("貸切は1時間単位でご指定ください。", "P0009");
        }
        // いずれの確定予約とも重複不可（コートを占有するため）
        const overlap = stored.some(
          (r) =>
            r.court_id === payload.court_id &&
            r.status === "CONFIRMED" &&
            new Date(r.starts_at) < end &&
            new Date(r.ends_at) > start
        );
        if (overlap) throw new GasError("選択した時間帯はすでに予約済みです。", "P0001");
        amount = charterPrice(ymd, startMinOfDay / 60, endMinOfDay / 60);
      }

      const id = cryptoRandomId();
      const display_number = `R-${formatMMDD(start)}-${id.slice(0, 4)}`;
      const now = new Date().toISOString();
      const res: Reservation = {
        id,
        display_number,
        user_id: userStored?.id ?? "demo-user",
        court_id: payload.court_id,
        mode,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        sides: 1,
        purpose: payload.purpose,
        group_name: payload.group_name,
        rep_name: payload.rep_name ?? "",
        headcount: payload.headcount ?? "",
        note: payload.note ?? "",
        status: "CONFIRMED",
        total_amount: amount,
        payment_status: "UNPAID",
        created_at: now,
        updated_at: now
      };
      stored.unshift(res);
      localStorage.setItem(DEMO_KEY_RES, JSON.stringify(stored));
      return { reservation_id: id, display_number, amount };
    }

    case "reservations.listMine":
      return { reservations: stored };

    case "reservations.cancel": {
      const { reservation_id } = p as { reservation_id: string };
      const idx = stored.findIndex((r) => r.id === reservation_id);
      if (idx < 0) throw new GasError("見つかりません", "NOT_FOUND");
      const target = stored[idx];
      // キャンセル規定: 利用開始 72 時間以上前は無料、72 時間未満は 50%。
      // （無連絡不参加の 100% は管理側の No-Show で扱う）
      const hours = (new Date(target.starts_at).getTime() - Date.now()) / 3_600_000;
      const rate = hours >= 72 ? 0 : 0.5;
      target.status = "CANCELED";
      target.canceled_at = new Date().toISOString();
      target.updated_at = target.canceled_at;
      localStorage.setItem(DEMO_KEY_RES, JSON.stringify(stored));
      return { charge_rate: rate, charge_amount: Math.floor(target.total_amount * rate) };
    }

    // 管理系 action は DEMO ではあらゆる呼び出しを許可 (ログインしている体で振る舞う)
    case "admin.reservations.list": {
      return { reservations: stored };
    }
    case "admin.reservations.markPaid": {
      const { reservation_id } = p as { reservation_id: string };
      const target = stored.find((r) => r.id === reservation_id);
      if (!target) throw new GasError("not found", "NOT_FOUND");
      target.payment_status = "PAID";
      target.paid_at = new Date().toISOString();
      target.updated_at = target.paid_at;
      localStorage.setItem(DEMO_KEY_RES, JSON.stringify(stored));
      return { paid_at: target.paid_at };
    }
    case "admin.reservations.markNoShow": {
      const { reservation_id } = p as { reservation_id: string };
      const target = stored.find((r) => r.id === reservation_id);
      if (!target) throw new GasError("not found", "NOT_FOUND");
      target.status = "NO_SHOW";
      target.updated_at = new Date().toISOString();
      localStorage.setItem(DEMO_KEY_RES, JSON.stringify(stored));
      return { status: "NO_SHOW" };
    }
    case "admin.checkin": {
      const { reservation_id } = p as { reservation_id: string };
      const target = stored.find((r) => r.id === reservation_id);
      if (!target) throw new GasError("not found", "NOT_FOUND");
      if (target.status === "COMPLETED" || target.checked_in_at) {
        throw new GasError("already checked in", "ALREADY_CHECKED_IN");
      }
      const now = new Date().toISOString();
      target.status = "COMPLETED";
      target.checked_in_at = now;
      target.updated_at = now;
      localStorage.setItem(DEMO_KEY_RES, JSON.stringify(stored));
      return {
        checked_in_at: now,
        display_number: target.display_number,
        group_name: target.group_name
      };
    }
    case "admin.slots.bulkUpdate":
      return { updated: 0 };
    case "admin.broadcast":
      return { sent: true };
    case "admin.sales.summary": {
      const paidList = stored.filter((r) => r.payment_status === "PAID");
      const total = paidList.reduce((s, r) => s + Number(r.total_amount), 0);
      const byCourt: Record<string, { court_id: string; court_name: string; total: number; count: number }> = {};
      paidList.forEach((r) => {
        const c = DEMO_COURTS.find((x) => x.id === r.court_id);
        if (!byCourt[r.court_id]) {
          byCourt[r.court_id] = {
            court_id: r.court_id,
            court_name: c ? c.name : r.court_id,
            total: 0,
            count: 0
          };
        }
        byCourt[r.court_id].total += Number(r.total_amount);
        byCourt[r.court_id].count += 1;
      });
      return { total, by_court: Object.values(byCourt), by_day: [] };
    }

    default:
      throw new GasError("DEMO: unsupported action " + action, "BAD_REQUEST");
  }
}

function safeJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as Crypto & { randomUUID: () => string }).randomUUID();
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function formatMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}${dd}`;
}

/** "YYYY-MM-DDTHH:MM:SS+09:00" から「その日の分(0-1440)」を取り出す（TZ非依存） */
function hhmmToMin(iso: string): number {
  const hh = Number(iso.slice(11, 13));
  const mm = Number(iso.slice(14, 16));
  return hh * 60 + mm;
}

/** 端末ローカル(JST想定)の今日 YYYY-MM-DD */
function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export { GasError, DEMO };
