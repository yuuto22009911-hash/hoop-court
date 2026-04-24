/**
 * A-01 管理者ダッシュボード
 * 仕様書 §3.1
 *   - 本日の予約件数
 *   - 本日の売上見込み (total_amount 合計)
 *   - 本日の稼働率 (予約済み時間 / OPEN 時間)
 *   - 直近 30 日の PAID 売上
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminListReservations, adminSalesSummary } from "@/lib/gas";
import { getIdToken } from "@/lib/auth";
import { formatYen } from "@/lib/format";
import type { Reservation } from "@/lib/types";

export default function AdminDashboard() {
  const [today, setToday] = useState<Reservation[] | null>(null);
  const [paidTotal, setPaidTotal] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const idToken = getIdToken();
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const r1 = await adminListReservations(idToken, {
          from: dayStart.toISOString(),
          to: dayEnd.toISOString(),
          status: "CONFIRMED"
        });
        setToday(r1.reservations);

        const from30 = new Date();
        from30.setDate(from30.getDate() - 30);
        const r2 = await adminSalesSummary(
          idToken,
          from30.toISOString(),
          new Date().toISOString()
        );
        setPaidTotal(r2.total);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  const expected = today ? today.reduce((s, r) => s + Number(r.total_amount), 0) : null;

  return (
    <div>
      <section className="mb-4">
        <h2 className="font-semibold mb-2">本日</h2>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="予約件数" value={today ? String(today.length) : "..."} />
          <Stat label="売上見込み" value={expected !== null ? formatYen(expected) : "..."} />
        </div>
      </section>
      <section className="mb-4">
        <h2 className="font-semibold mb-2">直近 30 日の PAID 売上</h2>
        <div className="text-2xl font-semibold">
          {paidTotal !== null ? formatYen(paidTotal) : "..."}
        </div>
      </section>
      <section>
        <h2 className="font-semibold mb-2">クイックリンク</h2>
        <div className="flex flex-col gap-2">
          <Link href="/admin/reservations" className="btn btn-ghost text-left">
            予約一覧
          </Link>
          <Link href="/admin/checkin" className="btn btn-ghost text-left">
            QR スキャン
          </Link>
          <Link href="/admin/slots" className="btn btn-ghost text-left">
            枠カレンダー
          </Link>
          <Link href="/admin/broadcast" className="btn btn-ghost text-left">
            一斉配信
          </Link>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#e5e7eb] rounded-[8px] p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
