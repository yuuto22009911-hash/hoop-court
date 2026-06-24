/**
 * 管理ログイン（ID/パスワード）
 * LINE を使わず PC ブラウザ等から /admin に入るためのログイン画面。
 * 認証は GAS の admin.login（apps-script/Code.gs）。成功で /admin へ。
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminSignIn } from "@/lib/adminAuth";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminSignIn(username.trim(), password);
      router.replace("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="app-header">向日葵株式会社 管理ログイン</header>
      <main className="app-main">
        <p className="text-sm text-muted mb-4">
          管理者専用ページです。配布されたユーザーID・パスワードでログインしてください。
        </p>
        <form onSubmit={handleSubmit}>
          <label className="field">
            ユーザーID
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </label>
          <label className="field">
            パスワード
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && (
            <p className="text-danger text-sm mb-3" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={busy || !username || !password}
          >
            {busy ? "ログイン中..." : "ログイン"}
          </button>
        </form>
      </main>
    </>
  );
}

export const runtime = "edge";
