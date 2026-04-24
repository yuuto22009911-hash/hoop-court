/**
 * A-05 一斉配信
 * 仕様書 §3.1 / §7.3 / §9.6
 *   - LINE broadcast (月 200 通枠の中で運用)
 *   - 実質 全会員に一括で届く。月 1 回程度を想定
 */

"use client";

import { useState } from "react";
import { adminBroadcast } from "@/lib/gas";
import { getIdToken } from "@/lib/auth";

export default function AdminBroadcast() {
  const [text, setText] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!confirm("全会員にこのメッセージを一斉送信します。よろしいですか？")) return;
    setBusy(true);
    setError(null);
    try {
      await adminBroadcast(getIdToken(), text);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div>
        <h2 className="font-semibold mb-2">配信を受け付けました</h2>
        <p className="text-sm text-muted mb-3">
          LINE 側で順次配信されます。月 200 通枠を消費している点にご注意ください。
        </p>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setSent(false);
            setText("");
          }}
        >
          続けて別のメッセージを作成
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        className="border border-[#e5e7eb] rounded-[8px] p-3 mb-3"
        style={{ background: "#fff7ed" }}
      >
        <p className="text-sm font-semibold">月 200 通枠を消費します</p>
        <p className="text-xs text-muted">
          LINE Messaging API のフリープランは月 200 通です。配信前に予約数・通知件数を確認してください。
        </p>
      </div>

      <label className="field">
        配信本文
        <textarea
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="例) 4/26 (土) 18-20 時の枠が空きました。ぜひご予約ください。"
        />
        <span className="text-xs text-muted">{text.length} / 500</span>
      </label>

      {error && (
        <p className="text-danger text-sm mb-3" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        className="btn btn-primary w-full"
        disabled={!text.trim() || busy}
        onClick={handleSend}
      >
        {busy ? "送信中..." : "一斉配信する"}
      </button>
    </div>
  );
}
