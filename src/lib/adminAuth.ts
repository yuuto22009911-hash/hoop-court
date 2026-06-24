/**
 * 管理画面のセッション管理（ID/パスワード方式）
 *
 * LINE を使わず、ユーザーID＋パスワードで /admin にログインするための薄いクライアント。
 *   - ログイン成功時に GAS が発行するセッショントークンを localStorage に保持
 *   - 各 admin API 呼び出しでは getAdminToken() の値を idToken 枠で送る
 *   - GAS 側 requireAdmin_ がトークンを検証（src/lib/gas.ts / apps-script/Code.gs）
 *
 * DEMO モードでは常にログイン済みとして振る舞う（UI 検証用）。
 */

"use client";

import { DEMO, adminLogin, adminLogout, adminSession } from "./gas";

const TOKEN_KEY = "hc_admin_session";

export function getAdminToken(): string {
  if (DEMO) return "demo-admin-token";
  if (typeof window === "undefined") return "";
  return localStorage.getItem(TOKEN_KEY) || "";
}

function setAdminToken(token: string) {
  if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, token);
}

function clearAdminToken() {
  if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
}

/** ID/パスワードでログインし、セッショントークンを保存する。 */
export async function adminSignIn(username: string, password: string): Promise<void> {
  if (DEMO) {
    setAdminToken("demo-admin-token");
    return;
  }
  const r = await adminLogin(username, password);
  setAdminToken(r.token);
}

/** ログアウト（サーバ側セッションも破棄）。 */
export async function adminSignOut(): Promise<void> {
  const token = getAdminToken();
  clearAdminToken();
  if (!DEMO && token) {
    try {
      await adminLogout(token);
    } catch {
      // サーバ側破棄に失敗してもローカルは消えているので無視
    }
  }
}

/** 保持しているセッションが有効かを確認する。無効なら false。 */
export async function verifyAdminSession(): Promise<boolean> {
  if (DEMO) return true;
  const token = getAdminToken();
  if (!token) return false;
  try {
    await adminSession(token);
    return true;
  } catch {
    clearAdminToken();
    return false;
  }
}
