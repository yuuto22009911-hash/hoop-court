/**
 * S-06 マイページ
 * 仕様書 §3.1 / §3.4 S-06。
 * 自分の予約一覧と入場 QR を表示する。
 * キャンセルはお客様からは受け付けない（2026-10-15 オーナー決定）。電話連絡 → スタッフが管理画面で取り消す。
 */

"use client";

import { useEffect, useRef, useState } from "react";
import LiffGate from "@/components/LiffGate";
import TabBar from "@/components/TabBar";
import { listMyReservations } from "@/lib/gas";
import { PHONE_NUMBER } from "@/lib/contact";
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
  // 読込失敗を「予約0件」と区別する。0件と表示すると、予約が消えたと思って
  // 予約し直してしまう（二重予約の誘因になる）。
  const [loadError, setLoadError] = useState(false);
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
    setLoadError(false);
    try {
      const r = await listMyReservations(getIdToken());
      setItems(r.reservations);
    } catch (err) {
      console.error(err);
      setLoadError(true);
    }
  }

  if (loadError) {
    return (
      <div className="text-center py-6">
        <p className="mb-1">予約を読み込めませんでした。</p>
        <p className="text-sm text-muted mb-4">
          通信状況をご確認のうえ、もう一度お試しください。
          <br />
          解決しない場合はお電話（{PHONE_NUMBER}）でお問い合わせください。
        </p>
        <button type="button" className="btn btn-primary" onClick={() => load()}>
          再読み込み
        </button>
      </div>
    );
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
          className="border border-line rounded-card p-3 mb-3"
        >
          <div className="flex justify-between items-center mb-1">
            <span className="font-semibold">{r.display_number}</span>
            <StatusBadge status={r.status} />
          </div>
          <div className="text-sm">{formatRange(r.starts_at, r.ends_at)}</div>
          <div className="text-sm text-muted">
            {r.mode === "FREE" ? "バスケフリーゴール" : "貸切"} ・ {r.group_name}
            {r.mode === "FREE" && r.headcount ? ` ・ ${r.headcount}名` : ""}
          </div>
          <div className="text-sm mt-1">
            {formatYen(Number(r.total_amount))}（
            {r.payment_status === "PAID" ? "支払い済み" : "未払い・当日現地で現金"}）
          </div>
          {r.status === "CONFIRMED" && new Date(r.ends_at).getTime() > Date.now() && (
            <div className="mt-2">
              <button
                type="button"
                className="btn btn-primary w-full"
                onClick={() => setQrId(r.id)}
              >
                入場 QR
              </button>
              {new Date(r.starts_at).getTime() > Date.now() && (
                <p className="text-xs text-muted mt-2">
                  来られなくなった場合はお電話ください（代表{" "}
                  <a href={`tel:${PHONE_NUMBER}`} className="underline">
                    {PHONE_NUMBER}
                  </a>
                  ）。LINE からのキャンセルは受け付けておりません。
                </p>
              )}
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
    CONFIRMED: { label: "確定", color: "#5B8C4A" },
    COMPLETED: { label: "完了", color: "#5E4F3C" },
    CANCELED: { label: "キャンセル", color: "#C24A3A" },
    NO_SHOW: { label: "No-Show", color: "#D9962A" }
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
