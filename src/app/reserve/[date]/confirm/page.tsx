/**
 * S-04 予約内容確認 + S-05 予約完了
 * 仕様書 §3.4 S-04 / S-05。
 * 確認内容を再表示し、予約確定ボタンで reservations.create を叩く。
 */

"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createReservation } from "@/lib/gas";
import { getIdToken } from "@/lib/auth";
import { formatRange, formatYen } from "@/lib/format";

export default function ConfirmPage() {
  const params = useParams<{ date: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const payload = useMemo(
    () => ({
      court_id: search.get("court") || "",
      starts_at: search.get("starts") || "",
      ends_at: search.get("ends") || "",
      sides: Number(search.get("sides") || 1),
      purpose: search.get("purpose") || "",
      group_name: search.get("group") || "",
      rep_name: search.get("rep") || "",
      headcount: search.get("head") ? Number(search.get("head")) : undefined,
      note: search.get("note") || ""
    }),
    [search]
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

  if (done) {
    return (
      <>
        <header className="app-header">予約完了</header>
        <main className="app-main">
          <div
            className="border border-[#e5e7eb] rounded-[8px] p-4 mb-4"
            style={{ background: "#ecfdf5" }}
          >
            <h2 className="font-semibold mb-2" style={{ color: "#047857" }}>
              ご予約が確定しました
            </h2>
            <p className="text-sm mb-1">予約番号: {done.display_number}</p>
            <p className="text-sm mb-1">
              日時: {formatRange(payload.starts_at, payload.ends_at)}
            </p>
            <p className="text-sm">
              金額: {formatYen(done.amount)}（当日現地払い）
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary w-full mb-2"
            onClick={() => router.push("/mypage")}
          >
            マイページで確認する
          </button>
          <button
            type="button"
            className="btn btn-ghost w-full"
            onClick={() => router.push("/")}
          >
            予約トップに戻る
          </button>
        </main>
      </>
    );
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
        ご予約内容の確認
      </header>
      <main className="app-main">
        <dl className="text-sm mb-4">
          <Row label="日時" value={formatRange(payload.starts_at, payload.ends_at)} />
          <Row label="面数" value={`${payload.sides} 面`} />
          <Row label="用途" value={payload.purpose} />
          <Row label="団体名" value={payload.group_name} />
          {payload.rep_name && <Row label="代表者" value={payload.rep_name} />}
          {payload.headcount && <Row label="人数" value={`${payload.headcount} 名`} />}
          {payload.note && <Row label="備考" value={payload.note} />}
        </dl>

        <div
          className="border border-[#e5e7eb] rounded-[8px] p-3 mb-4"
          style={{ background: "#fff7ed" }}
        >
          <p className="text-sm mb-1 font-semibold">当日現地でお支払いください</p>
          <p className="text-xs text-muted">
            現金 / PayPay / 口座振込 に対応しています。
          </p>
        </div>

        <label className="flex items-start gap-2 mb-3">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm">
            キャンセル規定（開始 72 時間未満は 100%、72 時間以上は 50%）と
            利用規約に同意します
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
    <div className="flex py-2 border-b border-[#e5e7eb]">
      <dt className="w-20 text-muted">{label}</dt>
      <dd className="flex-1">{value}</dd>
    </div>
  );
}

export const runtime = 'edge';
