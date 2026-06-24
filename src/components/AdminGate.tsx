/**
 * AdminGate — 管理画面の入口コンポーネント
 *
 * ID/パスワードのセッショントークン（localStorage）で認可する。LINE は不要。
 *   - /admin/login … クロム無しで素のまま表示（ログインフォーム自身）
 *   - それ以外    … セッションを検証し、未ログインなら /admin/login へ誘導。
 *                   認可済みならヘッダー＋タブバーを付けて children を表示。
 * 最終認可は GAS 側 requireAdmin_ が行うため、ここは UI 制御。
 */

"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AdminTabBar from "@/components/AdminTabBar";
import { adminSignOut, verifyAdminSession } from "@/lib/adminAuth";

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<"loading" | "ready">("loading");
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) return;
    let alive = true;
    (async () => {
      const ok = await verifyAdminSession();
      if (!alive) return;
      if (ok) setState("ready");
      else router.replace("/admin/login");
    })();
    return () => {
      alive = false;
    };
  }, [isLoginPage, pathname, router]);

  // ログイン画面はクロム無しで素のまま表示（ヘッダー／タブバーを付けない）
  if (isLoginPage) return <>{children}</>;

  if (state === "loading") {
    return (
      <>
        <header className="app-header">向日葵株式会社 管理</header>
        <main className="app-main">
          <p className="text-muted">読み込み中...</p>
        </main>
      </>
    );
  }

  async function handleLogout() {
    await adminSignOut();
    router.replace("/admin/login");
  }

  return (
    <>
      <header className="app-header">
        <span>向日葵株式会社 管理</span>
        <button
          type="button"
          className="back"
          style={{ marginLeft: "auto", marginRight: 0, fontSize: 13 }}
          onClick={handleLogout}
        >
          ログアウト
        </button>
      </header>
      <main className="app-main">{children}</main>
      <AdminTabBar />
    </>
  );
}
