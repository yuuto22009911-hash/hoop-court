/**
 * 管理画面共通レイアウト
 * 仕様書 §3.1 / §11.10
 *   - AdminGate が ID/パスワードのセッション認可とクロム（ヘッダー／タブバー）を担う。
 *   - /admin/login だけはクロム無しでログインフォームを表示する。
 */

import AdminGate from "@/components/AdminGate";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminGate>{children}</AdminGate>;
}

export const runtime = "edge";
