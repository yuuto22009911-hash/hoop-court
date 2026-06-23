/**
 * S-02 時刻表 + S-03 利用内容入力（1 画面に統合）
 * 仕様書 §3.4 S-02 / S-03。
 *   - 時刻表の行をタップして開始・終了を選ぶ
 *   - 用途・団体名等を入力して金額確認（S-04）に進む
 *
 * 2026-06 改定: ハーフコートA/B のみ。面数・CourtType 廃止。
 *   貸切: 平日朝(9-14) 1,210円/h, 平日夕(14-20) 1,500円/h,
 *         土日祝(9-20) 1,800円/h。延長 30 分単位(土日祝は 1h 単位)。
 *   フリー: 平日 440円/30min/人, 土日祝 550円/30min/人。
 *   当日予約: アプリ不可。カレンダーは翌日以降のみ選択可。
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { availabilityRange, listCourts } from "@/lib/gas";
import { formatYen } from "@/lib/format";
import { isHoliday } from "@/lib/holidays";
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
    // 種別: "貸切（コート）" or "バスケフリーゴール"
  const [purpose, setPurpose] = useState<string>("貸切（コート）");
    const [groupName, setGroupName] = useState("");
    const [repName, setRepName] = useState("");
    const [headcount, setHeadcount] = useState<number | "">("");
    const [note, setNote] = useState("");

  useEffect(() => {
        listCourts()
          .then((r) => {
                    setCourts(r.courts);
                    if (!courtId && r.courts[0]) setCourtId(r.courts[0].id);
          })
          .catch(console.error);
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

  // 時刻表を slot からビルド (9..20 の 12 行)
  const rows = useMemo(() => {
        const out: { hour: number; available: boolean }[] = [];
        for (let h = 9; h < 20; h++) {
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
        // 終了時刻を決める
      if (h <= startHour) {
              setStartHour(h);
              setEndHour(null);
              return;
      }
        // 選択範囲内に不可スロットがないか確認
      for (let x = startHour; x < h; x++) {
              const row = rows.find((r) => r.hour === x);
              if (!row || !row.available) {
                        alert("選択した時間帯に予約できない枠が含まれます。");
                        return;
              }
      }
        setStartHour(startHour);
        setEndHour(h);
  }

  const amount = useMemo(() => {
        if (startHour === null || endHour === null || !court) return 0;
        return estimatePrice(date, startHour, endHour, purpose);
  }, [startHour, endHour, court, date, purpose]);

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
                purpose,
                group: groupName,
                rep: repName,
                head: headcount === "" ? "" : String(headcount),
                note,
        });
        router.push(`/reserve/${date}/confirm?${query.toString()}`);
  }

  return (
        <LiffGateWrapper>
              <header className="app-header">時刻を選ぶ</header>
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
                                                        }}
                                                        onClick={() => onTapHour(r.hour, r.available)}
                                                        disabled={!r.available}
                                                      >
                                                      <span>{r.hour}:00</span>
                                                      <span className="text-xs">
                                                        {r.available ? "◎" : "×"}
                                                      </span>
                                      </button>
                                    );
        })}
                      </div>
              
                {/* 利用内容 */}
                      <label className="field">
                                種別<span className="req">*</span>
                                <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                                            <option value="貸切（コート）">貸切（コート）</option>
                                            <option value="バスケフリーゴール">バスケフリーゴール</option>
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
        </LiffGateWrapper>
      );
}

// ローカルの LiffGate ラッパー（import 元に合わせる）
function LiffGateWrapper({ children }: { children: React.ReactNode }) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: LiffGate } = require("@/components/LiffGate");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: TabBar } = require("@/components/TabBar");
    return (
          <LiffGate>
            {children}
                <TabBar />
          </LiffGate>
        );
}

/**
 * クライアント側の料金見積（2026-06 新モデル）
  *
   * 貸切（コート）:
    *   平日朝 9:00–14:00 → 1,210円/h
     *   平日夕 14:00–20:00 → 1,500円/h
      *   土日祝 9:00–20:00 → 1,800円/h
       *
        * バスケフリーゴール（per-person は確認画面で計算）:
         *   平日 440円/30min/人, 土日祝 550円/30min/人
          *   ここでは「1名あたり単価×コマ数」の目安を返す（人数未定のため 1 名想定）
           */
function estimatePrice(
    dateYmd: string,
    startHour: number,
    endHour: number,
    purpose: string
  ): number {
    const d = new Date(`${dateYmd}T00:00:00+09:00`);
    const dow = d.getDay(); // 0=Sun, 6=Sat
    const holiday = isHoliday(d);
    const isWeekend = dow === 0 || dow === 6 || holiday;
  
    if (purpose === "バスケフリーゴール") {
          // 30 分コマ数 × 1 名 × 単価
          const slots30 = (endHour - startHour) * 2;
          const unitPrice = isWeekend ? 550 : 440;
          return slots30 * unitPrice;
    }
  
    // 貸切（コート）: 1 時間単位で集計
    let sum = 0;
    for (let h = startHour; h < endHour; h++) {
          if (isWeekend) {
                  sum += 1800;
          } else if (h < 14) {
                  sum += 1210;
          } else {
                  sum += 1500;
          }
    }
    return sum;
}

export const runtime = "edge";</LiffGateWrapper>
