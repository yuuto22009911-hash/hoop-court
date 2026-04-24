/**
 * S-06 マイページ
 * 仕様書 §3.1 / §3.4 S-06。
 * 自分の予約一覧を表示し、QR 表示・キャンセルが可能。
 */

"use client";

import { useEffect, useRef, useState } from "react";
import LiffGate from "@/components/LiffGate";
import TabBar from "@/components/TabBar";
import { cancelReservation, listMyReservations } from "@/lib/gas";
import { getIdToken } from "@/lib/auth";
import { formatRange, formatYen } from "@/lib/format";
import { renderReservationQr } from "@/lib/qr";
import type { Reservation } from "@/lib/types";

export default function MyPage() {
  return (
    <LiffGate>
      <header className="app-header">マイページ</header>
      <main className="app-main">
        <MyPageInner />
      </main>
      <TabBar />
    </LiffGate>
  );
}

function MyPageInner() {
  const [items, setItems] = useState<Reservation[] | null>(null);
  const [qrId, setQrId] = useState<string | null>(null);
  const qrRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (qrId && qrRef.current) {
      renderReservationQr(qrRef.current, qrId).catch(console.error);
    }
  }, [qrId]);

  async function load() {
    try {
      const r = await listMyReservations(getIdToken());
      setItems(r.reservations);
    } catch (err) {
      console.error(err);
      setItems([]);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("予約をキャンセルしてよろしいですか？")) return;
    try {
      const r = await cancelReservation(getIdToken(), id);
      alert(
        `キャンセルを受け付けました。\n` +
          `キャンセル料率: ${Math.round(r.charge_rate * 100)}%\n` +
          `キャンセル料: ${formatYen(r.charge_amount)}`
      );
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  if (items === null) return <p className="text-muted">読み込み中...</p>;
  if (items.length === 0) {
    return <p className="text-muted">まだ予約はありません。</p>;
  }

  return (
    <div>
      {items.map((r) => (
        <article
          key={r.id}
          className="border border-[#e5e7eb] rounded-[8px] p-3 mb-3"
        >
          <div className="flex justify-between items-center mb-1">
            <span className="font-semibold">{r.display_number}</span>
            <StatusBadge status={r.status} />
          </div>
          <div className="text-sm">{formatRange(r.starts_at, r.ends_at)}</div>
          <div className="text-sm text-muted">{r.group_name}</div>
          <div className="text-sm mt-1">
            {formatYen(Number(r.total_amount))}（
            {r.payment_status === "PAID" ? "支払い済み" : "未払い・当日現地で"}）
          </div>
          {r.status === "CONFIRMED" && (
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                className="btn btn-primary flex-1"
                onClick={() => setQrId(r.id)}
              >
                入場 QR
              </button>
              <button
                type="button"
                className="btn btn-ghost flex-1"
                onClick={() => handleCancel(r.id)}
              >
                キャンセル
              </button>
            </div>
          )}
        </article>
      ))}

      {qrId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-30"
          onClick={() => setQrId(null)}
        >
          <div
            className="bg-white rounded-[8px] p-4 flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <canvas ref={qrRef} width={240} height={240} aria-label="予約 QR" />
            <p className="text-sm text-muted">受付でスタッフに提示してください</p>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setQrId(null)}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Reservation["status"] }) {
  const map: Record<Reservation["status"], { label: string; color: string }> = {
    CONFIRMED: { label: "確定", color: "#047857" },
    COMPLETED: { label: "完了", color: "#6b7280" },
    CANCELED: { label: "キャンセル", color: "#b91c1c" },
    NO_SHOW: { label: "No-Show", color: "#92400e" }
  };
  const v = map[status];
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-[3px] text-white"
      style={{ background: v.color }}
    >
      {v.label}
    </span>
  );
}

export const runtime = 'edge';
