/**
 * S-02 時刻表 + S-03 利用内容入力（1 画面に統合）
 *   - 予約種別: 貸切（1時間単位）/ バスケフリーゴール（30分単位・人数）
 *   - ハーフコート1面前提（コート・面数の選択なし）
 *   - 当日予約はカウンターのみ（アプリは翌日以降）
 *   - 金額は向日葵株式会社 公式料金に準拠（lib/pricing）
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { availabilityRange, listCourts } from "@/lib/gas";
import { formatYen } from "@/lib/format";
import {
  CHARTER_EVENING_FROM,
  CHARTER_HOLIDAY,
  CHARTER_WEEKDAY_EVENING,
  CHARTER_WEEKDAY_MORNING,
  CLOSE_HOUR,
  FREE_MAX_HEADCOUNT,
  OPEN_HOUR,
  charterPrice,
  freePer30,
  freePrice,
  isHolidayRate
} from "@/lib/pricing";
import type { AvailabilitySlot, BookingMode } from "@/lib/types";

const PAD = (n: number) => String(n).padStart(2, "0");
const SLOTS_PER_DAY = (CLOSE_HOUR - OPEN_HOUR) * 2; // 30分スロット数
const WDAY = ["日", "月", "火", "水", "木", "金", "土"];

/** 30分スロット index（0=OPEN:00）→ "HH:MM" */
function slotTime(idx: number): string {
  const min = OPEN_HOUR * 60 + idx * 30;
  return `${PAD(Math.floor(min / 60))}:${PAD(min % 60)}`;
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}`;
}

export default function ReserveDetailPage() {
  const params = useParams<{ date: string }>();
  const router = useRouter();
  const date = params.date;
  const holiday = isHolidayRate(date);

  const [courtId, setCourtId] = useState<string>("");
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [mode, setMode] = useState<BookingMode>("CHARTER");

  // 貸切は1時間単位（hour 9..20）、フリーは30分スロット index
  const [startHour, setStartHour] = useState<number | null>(null);
  const [endHour, setEndHour] = useState<number | null>(null);
  const [startSlot, setStartSlot] = useState<number | null>(null);
  const [endSlot, setEndSlot] = useState<number | null>(null);

  const [purpose, setPurpose] = useState("練習");
  const [groupName, setGroupName] = useState("");
  const [repName, setRepName] = useState("");
  const [headcount, setHeadcount] = useState<number>(2);
  const [note, setNote] = useState("");

  const isPastOrToday = date <= todayYmd();

  useEffect(() => {
    listCourts().then((r) => {
      if (r.courts[0]) setCourtId(r.courts[0].id);
    });
  }, []);

  useEffect(() => {
    if (!courtId) return;
    const from = `${date}T00:00:00+09:00`;
    const to = `${date}T24:00:00+09:00`;
    availabilityRange(courtId, from, to)
      .then((r) => setSlots(r.slots))
      .catch(console.error);
  }, [courtId, date]);

  // 30分スロットの空き（index → boolean）
  const slotAvail = useMemo(() => {
    const arr = new Array<boolean>(SLOTS_PER_DAY).fill(false);
    slots.forEach((s) => {
      const d = new Date(s.starts_at);
      const idx = (d.getHours() * 60 + d.getMinutes() - OPEN_HOUR * 60) / 30;
      if (idx >= 0 && idx < SLOTS_PER_DAY) arr[idx] = s.is_available;
    });
    return arr;
  }, [slots]);

  // 貸切: 1時間ブロックの空き（hour → boolean）
  const hourAvail = useMemo(() => {
    const map: Record<number, boolean> = {};
    for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
      const i = (h - OPEN_HOUR) * 2;
      map[h] = Boolean(slotAvail[i] && slotAvail[i + 1]);
    }
    return map;
  }, [slotAvail]);

  function resetSelection() {
    setStartHour(null);
    setEndHour(null);
    setStartSlot(null);
    setEndSlot(null);
  }

  function onTapHour(h: number) {
    if (!hourAvail[h]) return;
    if (startHour === null || endHour !== null) {
      setStartHour(h);
      setEndHour(null);
      return;
    }
    if (h === startHour) {
      setStartHour(null);
      return;
    }
    const s = Math.min(startHour, h);
    const e = Math.max(startHour, h) + 1;
    for (let x = s; x < e; x++) {
      if (!hourAvail[x]) {
        alert("選択した時間帯に予約できない枠が含まれます。");
        return;
      }
    }
    setStartHour(s);
    setEndHour(e);
  }

  function onTapSlot(i: number) {
    if (!slotAvail[i]) return;
    if (startSlot === null || endSlot !== null) {
      setStartSlot(i);
      setEndSlot(null);
      return;
    }
    if (i === startSlot) {
      setStartSlot(null);
      return;
    }
    const s = Math.min(startSlot, i);
    const e = Math.max(startSlot, i) + 1;
    for (let x = s; x < e; x++) {
      if (!slotAvail[x]) {
        alert("選択した時間帯に予約できない枠が含まれます。");
        return;
      }
    }
    setStartSlot(s);
    setEndSlot(e);
  }

  const amount = useMemo(() => {
    if (mode === "CHARTER") {
      if (startHour === null || endHour === null) return 0;
      return charterPrice(date, startHour, endHour);
    }
    if (startSlot === null || endSlot === null) return 0;
    return freePrice(date, endSlot - startSlot, headcount);
  }, [mode, startHour, endHour, startSlot, endSlot, headcount, date]);

  const hasSelection =
    mode === "CHARTER"
      ? startHour !== null && endHour !== null
      : startSlot !== null && endSlot !== null;

  const canProceed = hasSelection && groupName.trim().length > 0 && !isPastOrToday;

  function handleProceed() {
    if (!canProceed || !courtId) return;
    let starts: string;
    let ends: string;
    if (mode === "CHARTER") {
      starts = `${date}T${PAD(startHour as number)}:00:00+09:00`;
      ends = `${date}T${PAD(endHour as number)}:00:00+09:00`;
    } else {
      starts = `${date}T${slotTime(startSlot as number)}:00+09:00`;
      ends = `${date}T${slotTime(endSlot as number)}:00+09:00`;
    }
    const query = new URLSearchParams({
      court: courtId,
      mode,
      starts,
      ends,
      purpose: mode === "FREE" ? "バスケットボール（フリー）" : purpose,
      group: groupName,
      rep: repName,
      head: mode === "FREE" ? String(headcount) : "",
      note
    });
    router.push(`/reserve/${date}/confirm?${query.toString()}`);
  }

  const dow = WDAY[new Date(`${date}T00:00:00+09:00`).getDay()];

  if (isPastOrToday) {
    return (
      <>
        <header className="app-header">
          <button type="button" className="back" onClick={() => router.back()} aria-label="戻る">
            ←
          </button>
          {date}
        </header>
        <main className="app-main">
          <div className="notice">
            <p className="font-semibold mb-1">当日・過去日のご予約はできません</p>
            <p className="text-sm">
              当日のご予約はカウンターのみ（要相談）です。アプリでは翌日以降の枠をご予約いただけます。
            </p>
          </div>
          <button type="button" className="btn btn-ghost w-full" onClick={() => router.push("/")}>
            カレンダーに戻る
          </button>
        </main>
      </>
    );
  }

  return (
    <>
      <header className="app-header">
        <button type="button" className="back" onClick={() => router.back()} aria-label="戻る">
          ←
        </button>
        {date}（{dow}）
      </header>
      <main className="app-main">
        {/* 予約種別の切替 */}
        <div className="seg mb-3" role="tablist" aria-label="予約種別">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "CHARTER"}
            className={`seg-btn ${mode === "CHARTER" ? "active" : ""}`}
            onClick={() => {
              setMode("CHARTER");
              resetSelection();
            }}
          >
            貸切（コート）
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "FREE"}
            className={`seg-btn ${mode === "FREE" ? "active" : ""}`}
            onClick={() => {
              setMode("FREE");
              resetSelection();
            }}
          >
            バスケフリーゴール
          </button>
        </div>

        {/* 料金の目安 */}
        <div className="price-hint mb-3">
          {mode === "CHARTER" ? (
            holiday ? (
              <>土日祝：{formatYen(CHARTER_HOLIDAY)} / 1時間（9:00〜20:00 通し・1時間単位）</>
            ) : (
              <>
                平日：朝(〜{CHARTER_EVENING_FROM}時) {formatYen(CHARTER_WEEKDAY_MORNING)} / 夕(
                {CHARTER_EVENING_FROM}時〜) {formatYen(CHARTER_WEEKDAY_EVENING)}（1時間単位）
              </>
            )
          ) : (
            <>
              {holiday ? "土日祝" : "平日"}：{formatYen(freePer30(date))} / 30分 / 人（最大
              {FREE_MAX_HEADCOUNT}名・バスケットボール限定）
            </>
          )}
        </div>

        {/* 時刻表 */}
        {mode === "CHARTER" ? (
          <div className="timetable mb-4">
            {Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, k) => OPEN_HOUR + k).map((h) => {
              const available = hourAvail[h];
              const inRange =
                startHour !== null &&
                (endHour === null ? h === startHour : h >= startHour && h < endHour);
              return (
                <button
                  key={h}
                  type="button"
                  className={`tt-row ${inRange ? "sel" : ""}`}
                  onClick={() => onTapHour(h)}
                  aria-pressed={inRange}
                  disabled={!available}
                >
                  <span>
                    {PAD(h)}:00〜{PAD(h + 1)}:00
                  </span>
                  <span>{available ? (inRange ? "✓" : "◎") : "×"}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="timetable mb-4">
            {Array.from({ length: SLOTS_PER_DAY }, (_, i) => i).map((i) => {
              const available = slotAvail[i];
              const inRange =
                startSlot !== null &&
                (endSlot === null ? i === startSlot : i >= startSlot && i < endSlot);
              return (
                <button
                  key={i}
                  type="button"
                  className={`tt-row ${inRange ? "sel" : ""}`}
                  onClick={() => onTapSlot(i)}
                  aria-pressed={inRange}
                  disabled={!available}
                >
                  <span>
                    {slotTime(i)}〜{slotTime(i + 1)}
                  </span>
                  <span>{available ? (inRange ? "✓" : "◎") : "×"}</span>
                </button>
              );
            })}
          </div>
        )}

        {hasSelection && (
          <p className="mb-3 text-sm">
            選択:{" "}
            {mode === "CHARTER"
              ? `${PAD(startHour as number)}:00〜${PAD(endHour as number)}:00（${
                  (endHour as number) - (startHour as number)
                } 時間）`
              : `${slotTime(startSlot as number)}〜${slotTime(endSlot as number)}（${
                  ((endSlot as number) - (startSlot as number)) * 30
                } 分）`}
          </p>
        )}

        {/* 利用内容入力 */}
        {mode === "CHARTER" ? (
          <label className="field">
            用途<span className="req">*</span>
            <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              <option>練習</option>
              <option>試合</option>
              <option>部活動</option>
              <option>個人練習</option>
              <option>その他</option>
            </select>
          </label>
        ) : (
          <label className="field">
            人数<span className="req">*</span>
            <select value={headcount} onChange={(e) => setHeadcount(Number(e.target.value))}>
              {Array.from({ length: FREE_MAX_HEADCOUNT }, (_, k) => k + 1).map((n) => (
                <option key={n} value={n}>
                  {n} 名
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          {mode === "FREE" ? "代表者名・グループ名" : "団体名"}
          <span className="req">*</span>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            maxLength={60}
            required
          />
        </label>
        <label className="field">
          代表者名
          <input
            type="text"
            value={repName}
            onChange={(e) => setRepName(e.target.value)}
            maxLength={40}
          />
        </label>
        <label className="field">
          備考
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </label>

        {amount > 0 && <p className="mb-3 font-semibold">金額（目安）: {formatYen(amount)}</p>}

        <button
          type="button"
          className="btn btn-primary w-full"
          onClick={handleProceed}
          disabled={!canProceed}
        >
          金額を確認する
        </button>
      </main>
    </>
  );
}

export const runtime = "edge";
