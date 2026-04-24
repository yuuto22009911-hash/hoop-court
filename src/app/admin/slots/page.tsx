/**
 * A-03 枠カレンダー (一括 OPEN/CLOSED/BLOCKED 切替)
 * 仕様書 §3.1 / admin.slots.bulkUpdate
 */

"use client";

import { useEffect, useState } from "react";
import { adminSlotsBulk, listCourts } from "@/lib/gas";
import { getIdToken } from "@/lib/auth";
import type { Court } from "@/lib/types";

export default function AdminSlots() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [courtId, setCourtId] = useState<string>("");
  const [from, setFrom] = useState<string>(todayHour(9));
  const [to, setTo] = useState<string>(todayHour(22));
  const [status, setStatus] = useState<"OPEN" | "CLOSED" | "BLOCKED">("CLOSED");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listCourts().then((r) => {
      setCourts(r.courts);
      if (r.courts[0]) setCourtId(r.courts[0].id);
    });
  }, []);

  async function handleSubmit() {
    if (!courtId) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await adminSlotsBulk(
        getIdToken(),
        courtId,
        new Date(from).toISOString(),
        new Date(to).toISOString(),
        status
      );
      setResult(`${r.updated} 件の枠を ${status} に更新しました。`);
    } catch (err) {
      setResult(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-sm text-muted mb-3">
        指定期間の枠状態を一括変更します。OPEN = 予約可、CLOSED / BLOCKED = 予約不可。
      </p>
      <label className="field">
        コート<span className="req">*</span>
        <select value={courtId} onChange={(e) => setCourtId(e.target.value)}>
          {courts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        開始日時<span className="req">*</span>
        <input
          type="datetime-local"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </label>
      <label className="field">
        終了日時<span className="req">*</span>
        <input
          type="datetime-local"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </label>
      <label className="field">
        変更先ステータス<span className="req">*</span>
        <select
          value={status}
          onChange={(e) =>
            setStatus(e.target.value as "OPEN" | "CLOSED" | "BLOCKED")
          }
        >
          <option value="OPEN">OPEN (予約可)</option>
          <option value="CLOSED">CLOSED (休業)</option>
          <option value="BLOCKED">BLOCKED (占有)</option>
        </select>
      </label>

      <button
        type="button"
        className="btn btn-primary w-full"
        disabled={busy}
        onClick={handleSubmit}
      >
        {busy ? "更新中..." : "一括更新する"}
      </button>

      {result && <p className="text-sm mt-3">{result}</p>}
    </div>
  );
}

function todayHour(h: number) {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const runtime = 'edge';
