/**
 * 料金・営業時間・予約枠の単一定義
 * 向日葵株式会社 バスケ体育館（ハーフコート1面）公式料金に厳密準拠。
 *
 * 【貸切（コート）】※税込
 *   ① 平日 9:00–14:00 … 1時間 1,210円（延長30分 660円）
 *   ② 平日 14:00–20:00 … 1時間 1,500円（延長30分 800円）
 *   ③ 土日祝 9:00–20:00 … 1時間 1,800円（1時間単位）
 *   予約単位: 初回1時間から、以降は30分単位で延長（土日祝は1時間単位）。
 *
 * 【バスケフリーゴール】※税込・30分単位・1人あたり
 *   ① 平日 … 440円 / 30分 / 人
 *   ② 土日祝 … 550円 / 30分 / 人
 *
 * 営業時間: 全曜日 9:00–20:00（平日は朝9-14 / 夕14-20 が連続）。
 *
 * ⚠ 本番の確定金額は呼び出し元（LIFF）が計算して渡す設計（himawari-app と同様）。
 *    本モジュールがフロント／DEMO 共通の唯一の料金定義であり、改定時はここを更新する。
 */

import { isWeekendOrHoliday } from "./holidays";

export type BookingMode = "CHARTER" | "FREE";

/** 営業時間（全曜日共通） */
export const OPEN_HOUR = 9;
export const CLOSE_HOUR = 20;

/** 貸切（税込） */
export const CHARTER_WEEKDAY_MORNING = 1210; // 平日 9:00–14:00 / 1時間
export const CHARTER_WEEKDAY_EVENING = 1500; // 平日 14:00–20:00 / 1時間
export const CHARTER_HOLIDAY = 1800; // 土日祝 9:00–20:00 / 1時間
/** 平日 朝/夕 の境界（時） */
export const CHARTER_EVENING_FROM = 14;
/** 平日の30分延長単価（朝 / 夕） */
export const CHARTER_WEEKDAY_MORNING_30 = 660;
export const CHARTER_WEEKDAY_EVENING_30 = 800;

/** フリー（30分・1人・税込） */
export const FREE_WEEKDAY_PER30 = 440;
export const FREE_HOLIDAY_PER30 = 550;
/**
 * フリーの規定人数（同一時間帯あたり）。
 * 9名（himawari-app の予約上限 `partySize > 9` 制御・コーポレートサイト表記と一致）。
 */
export const FREE_MAX_HEADCOUNT = 9;

/** その日が土日祝料金か */
export function isHolidayRate(ymd: string): boolean {
  return isWeekendOrHoliday(ymd);
}

/** 貸切: 指定日の「開始時刻 hour の1時間ブロック」の料金 */
export function charterHourRate(ymd: string, hour: number): number {
  if (isWeekendOrHoliday(ymd)) return CHARTER_HOLIDAY;
  return hour < CHARTER_EVENING_FROM ? CHARTER_WEEKDAY_MORNING : CHARTER_WEEKDAY_EVENING;
}

/**
 * 貸切料金（税込）。startMin/endMin は「その日の分(0-1440)」で 30分刻み。
 * - 平日: 完全な1時間は1時間料金、端数30分は延長30分単価（朝/夕は各ブロックの開始時刻で判定）。
 * - 土日祝: 1時間単位（端数30分は発生しない想定。万一あれば時間分のみ計上）。
 */
export function charterPrice(ymd: string, startMin: number, endMin: number): number {
  const segments = Math.round((endMin - startMin) / 30);
  if (segments <= 0) return 0;

  if (isWeekendOrHoliday(ymd)) {
    return Math.floor(segments / 2) * CHARTER_HOLIDAY;
  }

  const fullHours = Math.floor(segments / 2);
  const hasTrailingHalf = segments % 2 === 1;
  let sum = 0;
  for (let i = 0; i < fullHours; i++) {
    const hourStart = startMin + i * 60;
    sum +=
      hourStart < CHARTER_EVENING_FROM * 60 ? CHARTER_WEEKDAY_MORNING : CHARTER_WEEKDAY_EVENING;
  }
  if (hasTrailingHalf) {
    const halfStart = startMin + fullHours * 60;
    sum +=
      halfStart < CHARTER_EVENING_FROM * 60
        ? CHARTER_WEEKDAY_MORNING_30
        : CHARTER_WEEKDAY_EVENING_30;
  }
  return sum;
}

/** フリー単価（30分・1人・税込） */
export function freePer30(ymd: string): number {
  return isWeekendOrHoliday(ymd) ? FREE_HOLIDAY_PER30 : FREE_WEEKDAY_PER30;
}

/** フリー料金（税込）= 単価 × 30分セグメント数 × 人数 */
export function freePrice(ymd: string, segments30: number, headcount: number): number {
  return freePer30(ymd) * Math.max(1, segments30) * Math.max(1, headcount);
}
