/**
 * S-01 カレンダー画面
 * 仕様書 §3.4 S-01。
 *   - コート切替タブ (courts.list)
 *   - 月ナビ
 *   - 日付セルに空き状況シンボル (◎ ○ ×)
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LiffGate from "@/components/LiffGate";
import TabBar from "@/components/TabBar";
import { listCourts, availabilityRange } from "@/lib/gas";
import { availabilitySymbol } from "@/lib/format";
import type { Court } from "@/lib/types";

export default function CalendarPage() {
  return (
    <LiffGate>
      <header className="app-header">Hoop Court</header>
      <main className="app-main">
        <Calendar />
      </main>
      <TabBar />
    </LiffGate>
  );
}

function Calendar() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [activeCourtId, setActiveCourtId] = useState<string | null>(null);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  // 日付文字列 (yyyy-mm-dd) → 空き比率
  const [availMap, setAvailMap] = useState<Record<string, number>>({});

  // コート初期化
  useEffect(() => {
    listCourts()
      .then((r) => {
        setCourts(r.courts);
        if (r.courts[0]) setActiveCourtId(r.courts[0].id);
      })
      .catch(console.error);
  }, []);

  // 表示月の空き状況取得
  useEffect(() => {
    if (!activeCourtId) return;
    const from = new Date(month);
    const to = new Date(month);
    to.setMonth(to.getMonth() + 1);
    availabilityRange(activeCourtId, from.toISOString(), to.toISOString())
      .then((r) => {
        const map: Record<string, { total: number; avail: number }> = {};
        r.slots.forEach((s) => {
          const key = s.starts_at.slice(0, 10);
          if (!map[key]) map[key] = { total: 0, avail: 0 };
          map[key].total += 1;
          if (s.is_available) map[key].avail += 1;
        });
        const out: Record<string, number> = {};
        Object.entries(map).forEach(([k, v]) => {
          out[k] = v.total === 0 ? 0 : v.avail / v.total;
        });
        setAvailMap(out);
      })
      .catch(console.error);
  }, [activeCourtId, month]);

  const grid = useMemo(() => buildMonthGrid(month), [month]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div>
      {/* コート切替 */}
      <div className="flex gap-2 mb-3 overflow-x-auto">
        {courts.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`btn ${
              c.id === activeCourtId ? "btn-primary" : "btn-ghost"
            }`}
            onClick={() => setActiveCourtId(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* 月ナビ */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setMonth(addMonth(month, -1))}
          aria-label="前の月"
        >
          ◀
        </button>
        <div className="font-semibold">
          {month.getFullYear()}年 {month.getMonth() + 1}月
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setMonth(addMonth(month, 1))}
          aria-label="次の月"
        >
          ▶
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="wday-header">
        <span className="sun">日</span>
        <span>月</span>
        <span>火</span>
        <span>水</span>
        <span>木</span>
        <span>金</span>
        <span className="sat">土</span>
      </div>

      {/* 日付グリッド */}
      <div className="cal-grid">
        {grid.map((cell) => {
          const key = formatYmd(cell.date);
          const ratio = availMap[key] ?? null;
          const sym = ratio === null ? "—" : availabilitySymbol(ratio);
          const isPast = cell.date < today;
          const isOther = cell.date.getMonth() !== month.getMonth();
          const disabled = isPast || isOther || sym === "×";
          if (disabled) {
            return (
              <div
                key={key}
                className="cal-cell"
                data-disabled="true"
                data-today={cell.date.getTime() === today.getTime()}
              >
                <span className="date">{cell.date.getDate()}</span>
                <span className="sym">{isOther ? "" : sym}</span>
              </div>
            );
          }
          return (
            <Link
              key={key}
              href={`/reserve/${key}?court=${activeCourtId ?? ""}`}
              className="cal-cell"
              data-today={cell.date.getTime() === today.getTime()}
            >
              <span className="date">{cell.date.getDate()}</span>
              <span className="sym">{sym}</span>
            </Link>
          );
        })}
      </div>

      {/* 凡例 */}
      <p className="mt-3 text-sm text-muted">
        ◎ 空きあり / ○ 残りわずか / × 満席
      </p>
    </div>
  );
}

function buildMonthGrid(month: Date) {
  const first = new Date(month);
  const startIdx = first.getDay(); // 0=Sun
  const start = new Date(first);
  start.setDate(1 - startIdx);
  const cells: { date: Date }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({ date: d });
  }
  return cells;
}

function addMonth(d: Date, delta: number) {
  const next = new Date(d);
  next.setMonth(next.getMonth() + delta);
  return next;
}

function formatYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const runtime = 'edge';
