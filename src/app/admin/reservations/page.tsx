/**
 * A-02 予約一覧
 * 仕様書 §3.1
 *   - 期間 / ステータスで絞り込み
 *   - 「支払い済みマーク」「No-Show マーク」を行う
 */

"use client";

import { useEffect, useState } from "react";
import {
  adminListReservations,
  adminMarkNoShow,
  adminMarkPaid
} from "@/lib/gas";
import { getIdToken } from "@/lib/auth";
import { formatRange, formatYen } from "@/lib/format";
import type { Reservation } from "@/lib/types";

export default function AdminReservations() {
  const [status, setStatus] = useState<string>("CONFIRMED");
  const [q, setQ] = useState<string>("");
  const [list, setList] = useState<Reservation[] | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function load() {
    try {
      const r = await adminListReservations(getIdToken(), {
        status: status === "ALL" ? undefined : status,
        q: q || undefined
      });
      setList(r.reservations);
    } catch (err) {
      console.error(err);
      setList([]);
    }
  }

  async function markPaid(id: string) {
    const method = window.prompt("支払い方法 (CASH / PAYPAY / BANK_TRANSFER)", "CASH");
    if (!method) return;
    try {
      await adminMarkPaid(getIdToken(), id, method as "CASH" | "PAYPAY" | "BANK_TRANSFER");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  async function markNoShow(id: string) {
    if (!confirm("No-Show としてマークしますか？")) return;
    try {
      await adminMarkNoShow(getIdToken(), id);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="btn btn-ghost"
          style={{ paddingRight: 24 }}
        >
          <option value="CONFIRMED">確定</option>
          <option value="COMPLETED">完了</option>
          <option value="CANCELED">キャンセル</option>
          <option value="NO_SHOW">No-Show</option>
          <option value="ALL">すべて</option>
        </select>
        <input
          type="search"
          placeholder="団体名 / 番号"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") load();
          }}
          className="flex-1 border border-[#e5e7eb] rounded-[6px] px-2"
          style={{ height: 44 }}
        />
      </div>

      {list === null && <p className="text-muted">読み込み中...</p>}
      {list !== null && list.length === 0 && (
        <p className="text-muted">該当する予約はありません。</p>
      )}
      {list?.map((r) => (
        <article
          key={r.id}
          className="border border-[#e5e7eb] rounded-[8px] p-3 mb-3"
        >
          <div className="flex justify-between mb-1">
            <span className="font-semibold">{r.display_number}</span>
            <span className="text-xs text-muted">{r.status}</span>
          </div>
          <div className="text-sm">{formatRange(r.starts_at, r.ends_at)}</div>
          <div className="text-sm text-muted">
            {r.group_name} / {r.purpose} / {r.sides}面
          </div>
          <div className="text-sm mt-1">
            {formatYen(Number(r.total_amount))}（{r.payment_status}）
          </div>
          {r.status === "CONFIRMED" && (
            <div className="flex gap-2 mt-2">
              {r.payment_status !== "PAID" && (
                <button
                  type="button"
                  className="btn btn-primary flex-1"
                  onClick={() => markPaid(r.id)}
                >
                  支払い済み
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost flex-1"
                onClick={() => markNoShow(r.id)}
              >
                No-Show
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
