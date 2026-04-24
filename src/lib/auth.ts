/**
 * LIFF 初期化 + ID Token 管理
 * 仕様書 §6.6 / §7.1。ID Token は 1 時間で失効するため、フロント側で
 * 55 分ごとに再取得する。
 */

"use client";

import type { Liff } from "@line/liff";
import { DEMO } from "./gas";

let liffInstance: Liff | null = null;
let idToken: string | null = null;
let tokenRefreshTimer: ReturnType<typeof setInterval> | null = null;

/**
 * LIFF を初期化する。未ログインなら liff.login() を呼び LINE の認可画面に遷移。
 * DEMO モードでは何もしない (ダミーの idToken を返す)。
 */
export async function initLiff(): Promise<{ demo: boolean; liff: Liff | null }> {
  if (DEMO) return { demo: true, liff: null };

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId) throw new Error("NEXT_PUBLIC_LIFF_ID is not configured");

  // dynamic import でサーバー側バンドル除外
  const liff = (await import("@line/liff")).default;
  await liff.init({ liffId });
  liffInstance = liff;

  if (!liff.isLoggedIn()) {
    liff.login();
    // login() でページ遷移するため、以降は実行されない
    return { demo: false, liff };
  }

  await refreshIdToken();
  // 55 分ごとに再取得 (有効期限 1h)
  if (tokenRefreshTimer) clearInterval(tokenRefreshTimer);
  tokenRefreshTimer = setInterval(() => {
    refreshIdToken().catch(console.error);
  }, 55 * 60 * 1000);

  return { demo: false, liff };
}

async function refreshIdToken() {
  if (!liffInstance) return;
  idToken = liffInstance.getIDToken();
}

/** 最新の ID Token を返す。DEMO モードではダミー文字列。 */
export function getIdToken(): string {
  if (DEMO) return "demo-id-token";
  if (!idToken) throw new Error("LIFF not initialized or no token");
  return idToken;
}

export function getLiffProfile() {
  if (DEMO) {
    return Promise.resolve({
      userId: "demo-user",
      displayName: "デモ太郎",
      pictureUrl: "",
      statusMessage: ""
    });
  }
  if (!liffInstance) throw new Error("LIFF not initialized");
  return liffInstance.getProfile();
}

export function logout() {
  if (DEMO) {
    // DEMO は localStorage をクリアして再度 register に進ませる
    if (typeof window !== "undefined") {
      localStorage.removeItem("hc_demo_user");
      localStorage.removeItem("hc_demo_reservations");
    }
    return;
  }
  if (liffInstance && liffInstance.isLoggedIn()) liffInstance.logout();
}
