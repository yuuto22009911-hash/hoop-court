/**
 * 共通の API 型定義
 * 仕様書 §5 データモデル / §6 API 仕様 に対応。
 */

export type ReservationStatus = "CONFIRMED" | "CANCELED" | "NO_SHOW" | "COMPLETED";
export type PaymentStatus = "UNPAID" | "PAID" | "REFUNDED";
export type CourtType = "FULL" | "HALF" | "THREE_X_THREE";
export type SlotStatus = "OPEN" | "CLOSED" | "BLOCKED";

export interface Facility {
  id: string;
  name: string;
  address: string;
  timezone: string;
  created_at: string;
}

export interface Court {
  id: string;
  facility_id: string;
  name: string;
  court_type: CourtType;
  sides_max: number;
  capacity: number;
  is_active: boolean;
  created_at: string;
}

export interface AvailabilitySlot {
  slot_id: string;
  starts_at: string;
  ends_at: string;
  is_available: boolean;
}

export interface Reservation {
  id: string;
  display_number: string;
  user_id: string;
  court_id: string;
  starts_at: string;
  ends_at: string;
  sides: number;
  purpose: string;
  group_name: string;
  rep_name?: string;
  headcount?: number | string;
  note?: string;
  status: ReservationStatus;
  total_amount: number;
  payment_status: PaymentStatus;
  paid_at?: string;
  checked_in_at?: string;
  created_at: string;
  updated_at: string;
  canceled_at?: string;
}

export interface UserProfile {
  id: string;
  line_user_id: string;
  display_name: string;
  phone: string;
  email: string;
  team_name?: string;
  role: "MEMBER";
  created_at: string;
  updated_at: string;
}

/** すべての API で共通のレスポンス形状 */
export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

/** reservations.create の payload */
export interface CreateReservationPayload {
  court_id: string;
  starts_at: string;
  ends_at: string;
  sides: number;
  purpose: string;
  group_name: string;
  rep_name?: string;
  headcount?: number;
  note?: string;
}
