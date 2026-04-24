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

// 仕様書どおり 2 コート固定 (facility_id は任意)
const DEMO_COURTS: Court[] = [
  {
    id: "demo-court-a",
    facility_id: "demo-facility",
    name: "Aコート（フル）",
    court_type: "FULL",
    sides_max: 1,
    capacity: 10,
    is_active: true,
    created_at: "2026-04-01T00:00:00+09:00"
  },
  {
    id: "demo-court-b",
    facility_id: "demo-facility",
    name: "Bコート（ハーフ）",
    court_type: "HALF",
    sides_max: 2,
    capacity: 10,
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
      const slots: AvailabilitySlot[] = [];
      for (let t = fromT; t < toT; t += 3600_000) {
        const st = new Date(t);
        const hour = st.getHours();
        if (hour < 9 || hour >= 22) continue;
        const en = new Date(t + 3600_000);
        const overlap = stored.some(
          (r) =>
            r.court_id === court_id &&
            r.status === "CONFIRMED" &&
            new Date(r.starts_at).getTime() < t + 3600_000 &&
            new Date(r.ends_at).getTime() > t
        );
        slots.push({
          slot_id: `demo-${court_id}-${st.toISOString()}`,
          starts_at: st.toISOString(),
          ends_at: en.toISOString(),
          is_available: !overlap
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
      const court = DEMO_COURTS.find((c) => c.id === payload.court_id)!;
      const start = new Date(payload.starts_at);
      const end = new Date(payload.ends_at);
      const hours = (end.getTime() - start.getTime()) / 3_600_000;
      // 仕様書 §8.1 の簡易再現
      let amount = 0;
      for (let t = start.getTime(); t < end.getTime(); t += 3_600_000) {
        const d = new Date(t);
        const dow = d.getDay();
        const hour = d.getHours();
        let base: number;
        if (dow === 0 || dow === 6) base = 3000;
        else if (hour >= 18) base = 2400;
        else base = 2000;
        if (court.court_type === "HALF") base = Math.round(base * 0.82);
        amount += base;
      }
      amount *= Math.max(1, payload.sides || 1);
      if (hours > 4) throw new GasError("連続して予約できるのは最大 4 時間までです。", "P0003");

      const overlap = stored.some(
        (r) =>
          r.court_id === payload.court_id &&
          r.status === "CONFIRMED" &&
          new Date(r.starts_at) < end &&
          new Date(r.ends_at) > start
      );
      if (overlap) throw new GasError("選択した時間帯はすでに予約済みです。", "P0001");

      const id = cryptoRandomId();
      const display_number = `R-${formatMMDD(start)}-${id.slice(0, 4)}`;
      const now = new Date().toISOString();
      const res: Reservation = {
        id,
        display_number,
        user_id: userStored?.id ?? "demo-user",
        court_id: payload.court_id,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        sides: payload.sides,
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
      const hours = (new Date(target.starts_at).getTime() - Date.now()) / 3_600_000;
      let rate = 0;
      if (hours >= 24 * 7) rate = 0;
      else if (hours >= 24 * 3) rate = 0.5;
      else rate = 1;
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

export { GasError, DEMO };
