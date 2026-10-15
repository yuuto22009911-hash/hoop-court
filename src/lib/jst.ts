/**
 * 日本時間（JST）の日付ヘルパ。
 * 端末のタイムゾーンが JST 以外でも「今日」が施設の営業日とずれないよう、
 * UTC に +9 時間して日付部分だけを取り出す（日本は夏時間が無いので固定オフセットでよい）。
 */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** エポックミリ秒 → JST の YYYY-MM-DD */
export function jstYmdOf(ms: number): string {
  return new Date(ms + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** JST の今日を YYYY-MM-DD で返す */
export function jstTodayYmd(): string {
  return jstYmdOf(Date.now());
}
