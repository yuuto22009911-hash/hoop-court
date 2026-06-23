/**
 * 料金・営業時間・予約枠の単一定義
 * 向日葵株式会社 バスケ体育館（ハーフコート1面）公式料金に厳密準拠。
 *
 * 【貸切（コート）】※税込・1時間単位（追加時間も1時間単位）
 *   ① 平日 9:00–14:00 … 1時間 1,210円
 *   ② 平日 14:00–20:00 … 1時間 1,500円
 *   ③ 土日祝 9:00–20:00 … 1時間 1,800円
 *   ※ 30分料金(平日朝660 / 夕800)は「時間超過時」に現地で発生するペナルティで、
 *      オンライン予約の単位ではない（予約は1時間単位）。
 *
 * 【バスケフリーゴール】※税込・30分単位・1人あたり
 *   ① 平日 … 440円 / 30分 / 人
 *   ② 土日祝 … 550円 / 30分 / 人
 *
 * 営業時間: 全曜日 9:00–20:00（平日は朝9-14 / 夕14-20 が連続）。
 *
 * ⚠ 本番の確定金額は GAS（このリポジトリ外）が計算する。本モジュールはフロントの
 *    見積/DEMO を GAS と一致させるための定義であり、料金改定時は GAS と同時に更新すること。
 */

import { isWeekendOrHoliday } from "./holidays";

export type BookingMode = "CHARTER" | "FREE";

/** 営業時間（全曜日共通） */
export const OPEN_HOUR = 9;
export const CLOSE_HOUR = 20;

/** 貸切（1時間・税込） */
export const CHARTER_WEEKDAY_MORNING = 1210; // 平日 9:00–14:00
export const CHARTER_WEEKDAY_EVENING = 1500; // 平日 14:00–20:00
export const CHARTER_HOLIDAY = 1800; // 土日祝 9:00–20:00
/** 平日 朝/夕 の境界（時） */
export const CHARTER_EVENING_FROM = 14;
/** 時間超過時に現地発生する30分ペナルティ（参考・案内表示用） */
export const CHARTER_OVERTIME_WEEKDAY_MORNING = 660;
export const CHARTER_OVERTIME_WEEKDAY_EVENING = 800;

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
 * 貸切料金（税込）。startHour〜endHour は整数時・1時間単位。
 * 平日に朝/夕をまたぐ場合は各1時間ブロックを開始時刻の区分で合算する。
 */
export function charterPrice(ymd: string, startHour: number, endHour: number): number {
  let sum = 0;
  for (let h = startHour; h < endHour; h++) {
    sum += charterHourRate(ymd, h);
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
