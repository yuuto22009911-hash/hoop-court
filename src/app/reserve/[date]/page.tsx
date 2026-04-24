/**
 * S-02 時刻表 + S-03 利用内容入力 (1 画面に統合)
 * 仕様書 §3.4 S-02 / S-03。
 *   - 時刻表の行をタップして開始・終了を選ぶ
 *   - 面数・用途・団体名等を入力して金額確認 (S-04) に進む
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { availabilityRange, listCourts } from "@/lib/gas";
import { formatYen } from "@/lib/format";
import type { AvailabilitySlot, Court } from "@/lib/types";

export default function ReserveDetailPage() {
  const params = useParams<{ date: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const date = params.date;
  const courtParam = search.get("court") || "";

  const [courts, setCourts] = useState<Court[]>([]);
  const [courtId, setCourtId] = useState<string>(courtParam);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [startHour, setStartHour] = useState<number | null>(null);
  const [endHour, setEndHour] = useState<number | null>(null);
  const [sides, setSides] = useState<1 | 2>(1);
  const [purpose, setPurpose] = useState("練習");
  const [groupName, setGroupName] = useState("");
  const [repName, setRepName] = useState("");
  const [headcount, setHeadcount] = useState<number | "">("");
  const [note, setNote] = useState("");

  useEffect(() => {
    listCourts().then((r) => {
      setCourts(r.courts);
      if (!courtId && r.courts[0]) setCourtId(r.courts[0].id);
    });
  }, [courtId]);

  useEffect(() => {
    if (!courtId) return;
    const from = `${date}T00:00:00+09:00`;
    const to = `${date}T24:00:00+09:00`;
    availabilityRange(courtId, from, to)
      .then((r) => setSlots(r.slots))
      .catch(console.error);
  }, [courtId, date]);

  const court = useMemo(() => courts.find((c) => c.id === courtId), [courts, courtId]);

  // 時刻表を slot からビルド
  const rows = useMemo(() => {
    // 9..21 の 13 行
    const out: { hour: number; available: boolean }[] = [];
    for (let h = 9; h < 22; h++) {
      const slot = slots.find((s) => new Date(s.starts_at).getHours() === h);
      out.push({ hour: h, available: Boolean(slot && slot.is_available) });
    }
    return out;
  }, [slots]);

  function onTapHour(h: number, available: boolean) {
    if (!available) return;
    if (startHour === null || endHour !== null) {
      // 新規選択
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
    if (e - s > 4) {
      alert("連続して予約できるのは最大 4 時間までです。");
      return;
    }
    // 範囲内のすべてが空いているかチェック
    for (let x = s; x < e; x++) {
      const row = rows.find((r) => r.hour === x);
      if (!row || !row.available) {
        alert("選択した時間帯に予約できない枠が含まれます。");
        return;
      }
    }
    setStartHour(s);
    setEndHour(e);
  }

  const amount = useMemo(() => {
    if (startHour === null || endHour === null || !court) return 0;
    return estimatePrice(date, court.court_type, startHour, endHour, sides);
  }, [startHour, endHour, court, date, sides]);

  const canProceed =
    startHour !== null &&
    endHour !== null &&
    Boolean(court) &&
    groupName.trim().length > 0;

  function handleProceed() {
    if (!canProceed || !court || startHour === null || endHour === null) return;
    const query = new URLSearchParams({
      court: court.id,
      starts: `${date}T${String(startHour).padStart(2, "0")}:00:00+09:00`,
      ends: `${date}T${String(endHour).padStart(2, "0")}:00:00+09:00`,
      sides: String(sides),
      purpose,
      group: groupName,
      rep: repName,
      head: headcount === "" ? "" : String(headcount),
      note
    });
    router.push(`/reserve/${date}/confirm?${query.toString()}`);
  }

  return (
    <>
      <header className="app-header">
        <button
          type="button"
          className="back"
          onClick={() => router.back()}
          aria-label="戻る"
        >
          ←
        </button>
        {date}
      </header>
      <main className="app-main">
        {/* コート切替 */}
        <div className="flex gap-2 mb-3 overflow-x-auto">
          {courts.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`btn ${c.id === courtId ? "btn-primary" : "btn-ghost"}`}
              onClick={() => {
                setCourtId(c.id);
                setStartHour(null);
                setEndHour(null);
              }}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* 時刻表 */}
        <div className="border border-[#e5e7eb] rounded-[8px] overflow-hidden mb-4">
          {rows.map((r) => {
            const inRange =
              startHour !== null &&
              (endHour === null
                ? r.hour === startHour
                : r.hour >= startHour && r.hour < endHour);
            return (
              <button
                key={r.hour}
                type="button"
                className="w-full text-left px-3 flex justify-between items-center"
                style={{
                  height: 44,
                  background: inRange ? "#fee2e2" : "#fff",
                  borderBottom: "1px solid #e5e7eb",
                  color: r.available ? "#1f2937" : "#cbd5e1",
                  cursor: r.available ? "pointer" : "not-allowed"
                }}
                onClick={() => onTapHour(r.hour, r.available)}
                aria-pressed={inRange}
                disabled={!r.available}
              >
                <span>
                  {String(r.hour).padStart(2, "0")}:00〜
                  {String(r.hour + 1).padStart(2, "0")}:00
                </span>
                <span>{r.available ? (inRange ? "✓" : "◎") : "×"}</span>
              </button>
            );
          })}
        </div>

        {startHour !== null && endHour !== null && (
          <p className="mb-3 text-sm">
            選択: {String(startHour).padStart(2, "0")}:00〜
            {String(endHour).padStart(2, "0")}:00（{endHour - startHour} 時間）
          </p>
        )}

        {/* 利用内容入力 */}
        <label className="field">
          面数<span className="req">*</span>
          <select
            value={sides}
            onChange={(e) => setSides(Number(e.target.value) as 1 | 2)}
          >
            <option value={1}>1 面</option>
            {court && court.sides_max >= 2 && <option value={2}>2 面</option>}
          </select>
        </label>
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
        <label className="field">
          団体名<span className="req">*</span>
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
          人数
          <input
            type="number"
            inputMode="numeric"
            value={headcount}
            min={1}
            max={99}
            onChange={(e) =>
              setHeadcount(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </label>
        <label className="field">
          備考
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
          />
        </label>

        {amount > 0 && (
          <p className="mb-3 font-semibold">金額（目安）: {formatYen(amount)}</p>
        )}

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

/** クライアント側の料金見積 (サーバーと同ロジック §8.1) */
function estimatePrice(
  dateYmd: string,
  courtType: Court["court_type"],
  startHour: number,
  endHour: number,
  sides: number
) {
  const d = new Date(`${dateYmd}T00:00:00+09:00`);
  const dow = d.getDay();
  let sum = 0;
  for (let h = startHour; h < endHour; h++) {
    let base: number;
    if (dow === 0 || dow === 6) base = 3000;
    else if (h >= 18) base = 2400;
    else base = 2000;
    if (courtType === "HALF") base = Math.round(base * 0.82);
    sum += base;
  }
  return sum * Math.max(1, sides);
}

export const runtime = 'edge';
