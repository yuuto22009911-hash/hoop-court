/**
 * S-04 予約内容確認 + S-05 予約完了
 * 確認内容を再表示し、予約確定ボタンで reservations.create を叩く。
 */

"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createReservation } from "@/lib/gas";
import { getIdToken } from "@/lib/auth";
import { formatRange, formatYen } from "@/lib/format";
import type { BookingMode } from "@/lib/types";

export default function ConfirmPage() {
  const search = useSearchParams();
  const router = useRouter();
  const mode = (search.get("mode") as BookingMode) || "CHARTER";
  const payload = useMemo(
    () => ({
      court_id: search.get("court") || "",
      mode,
      starts_at: search.get("starts") || "",
      ends_at: search.get("ends") || "",
      purpose: search.get("purpose") || "",
      group_name: search.get("group") || "",
      rep_name: search.get("rep") || "",
      headcount: search.get("head") ? Number(search.get("head")) : undefined,
      note: search.get("note") || ""
    }),
    [search, mode]
  );

  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    reservation_id: string;
    display_number: string;
    amount: number;
  } | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const r = await createReservation(getIdToken(), payload);
      setDone(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const modeLabel = mode === "FREE" ? "バスケフリーゴール" : "貸切（コート）";

  if (done) {
    return (
      <>
        <header className="app-header">予約完了</header>
        <main className="app-main">
          <div className="notice notice-success">
            <h2 className="font-semibold mb-2">ご予約が確定しました</h2>
            <p className="text-sm mb-1">予約番号: {done.display_number}</p>
            <p className="text-sm mb-1">種別: {modeLabel}</p>
            <p className="text-sm mb-1">日時: {formatRange(payload.starts_at, payload.ends_at)}</p>
            <p className="text-sm">金額: {formatYen(done.amount)}（当日現地払い）</p>
          </div>
          <button
            type="button"
            className="btn btn-primary w-full mb-2"
            onClick={() => router.push("/mypage")}
          >
            マイページで確認する
          </button>
          <button type="button" className="btn btn-ghost w-full" onClick={() => router.push("/")}>
            予約トップに戻る
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
        ご予約内容の確認
      </header>
      <main className="app-main">
        <dl className="text-sm mb-4">
          <Row label="種別" value={modeLabel} />
          <Row label="日時" value={formatRange(payload.starts_at, payload.ends_at)} />
          {mode === "FREE" && payload.headcount ? (
            <Row label="人数" value={`${payload.headcount} 名`} />
          ) : null}
          <Row label="用途" value={payload.purpose} />
          <Row label={mode === "FREE" ? "代表者名・グループ名" : "団体名"} value={payload.group_name} />
          {payload.rep_name && <Row label="代表者" value={payload.rep_name} />}
          {payload.note && <Row label="備考" value={payload.note} />}
        </dl>

        <div className="notice mb-4">
          <p className="text-sm mb-1 font-semibold">当日現地でお支払いください</p>
          <p className="text-xs text-muted">
            お支払いは PayPay（当日カウンターは現金も可）に対応しています。
          </p>
        </div>

        <div className="notice mb-4">
          <p className="text-sm font-semibold mb-1">ご利用にあたって</p>
          <ul className="text-xs text-muted list-disc pl-4 space-y-0.5">
            <li>ご予約時間を過ぎると、30分ごとの追加料金が発生します。</li>
            <li>コートはご予約を最優先でご案内します。</li>
            <li>当日のご予約・変更はカウンターのみ（要相談）です。</li>
          </ul>
        </div>

        <label className="flex items-start gap-2 mb-3">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm">
            キャンセル規定（当面はいつでも無料です）と利用規約に同意します
          </span>
        </label>

        {error && (
          <p className="text-danger mb-3" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          className="btn btn-primary w-full"
          disabled={!agreed || submitting}
          onClick={handleConfirm}
        >
          {submitting ? "確定中..." : "予約を確定する"}
        </button>
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex py-2 border-b border-line">
      <dt className="w-24 text-muted">{label}</dt>
      <dd className="flex-1">{value}</dd>
    </div>
  );
}

export const runtime = "edge";
