/**
 * LIFF 初期化 + プロフィール登録チェック
 * 仕様書 §3.4 S-07 プロフィール登録。
 *   - LIFF 未ログインなら liff.login() に誘導
 *   - 登録済みでないなら /register に遷移
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { initLiff, getIdToken } from "@/lib/auth";
import { authMe } from "@/lib/gas";
import type { UserProfile } from "@/lib/types";

type State =
  | { kind: "loading" }
  | { kind: "unregistered" }
  | { kind: "ready"; user: UserProfile };

export default function LiffGate({
  children,
  requireRegistered = true
}: {
  children: React.ReactNode;
  requireRegistered?: boolean;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await initLiff();
        const idToken = getIdToken();
        const res = await authMe(idToken);
        if (!active) return;
        if (!res.registered || !res.user) {
          setState({ kind: "unregistered" });
          if (requireRegistered && pathname !== "/register") {
            router.replace("/register");
          }
        } else {
          setState({ kind: "ready", user: res.user });
        }
      } catch (err) {
        console.error(err);
        if (!active) return;
        setState({ kind: "unregistered" });
      }
    })();
    return () => {
      active = false;
    };
  }, [router, pathname, requireRegistered]);

  if (state.kind === "loading") {
    return <p className="p-4 text-muted">読み込み中...</p>;
  }
  if (state.kind === "unregistered" && requireRegistered) {
    return <p className="p-4 text-muted">プロフィール登録画面に移動しています...</p>;
  }
  return <>{children}</>;
}
