/**
 * 日時・金額・表示ヘルパ
 */

const WDAY = ["日", "月", "火", "水", "木", "金", "土"];

/** YYYY/M/D(曜) */
export function formatDate(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  return `${x.getFullYear()}/${x.getMonth() + 1}/${x.getDate()}(${WDAY[x.getDay()]})`;
}

/** HH:mm */
export function formatTime(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  return `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
}

/** M/D(曜) HH:mm〜HH:mm */
export function formatRange(start: Date | string, end: Date | string): string {
  const s = typeof start === "string" ? new Date(start) : start;
  const e = typeof end === "string" ? new Date(end) : end;
  return `${s.getMonth() + 1}/${s.getDate()}(${WDAY[s.getDay()]}) ${formatTime(s)}〜${formatTime(e)}`;
}

export function formatYen(n: number): string {
  return `¥${Number(n).toLocaleString("ja-JP")}`;
}

/**
 * 空き状況シンボル生成 (仕様書 §2.3)
 * ratio = 空き slot / 全 slot
 */
export function availabilitySymbol(availableRatio: number): "◎" | "○" | "×" {
  if (availableRatio <= 0) return "×";
  if (availableRatio < 0.3) return "○";
  return "◎";
}
