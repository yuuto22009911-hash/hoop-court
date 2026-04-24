/**
 * AdminGate — 管理画面の入口コンポーネント
 * LIFF 初期化 + admins シート認可の簡易確認。
 * 最終認可は GAS 側の requireAdmin が行うため、ここは UI 制御のみ。
 */

"use client";

import { useEffect, useState } from "react";
import { initLiff, getIdToken } from "@/lib/auth";
import { adminListReservations } from "@/lib/gas";

type State =
  | { kind: "loading" }
  | { kind: "denied"; reason: string }
  | { kind: "ready" };

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        // admin 権限のある呼び出しを 1 本試し、通れば OK
        await adminListReservations(getIdToken(), {
          from: new Date().toISOString(),
          to: new Date(Date.now() + 3600_000).toISOString()
        });
        setState({ kind: "ready" });
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        setState({ kind: "denied", reason });
      }
    })();
  }, []);

  if (state.kind === "loading") {
    return <p className="p-4 text-muted">読み込み中...</p>;
  }
  if (state.kind === "denied") {
    return (
      <div className="p-4">
        <h1 className="font-semibold mb-2">アクセスできません</h1>
        <p className="text-sm text-muted">
          この画面は管理者アカウントでのみ利用可能です。
        </p>
        <p className="text-xs text-muted mt-2">詳細: {state.reason}</p>
      </div>
    );
  }
  return <>{children}</>;
}
