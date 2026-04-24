/**
 * 管理画面共通レイアウト
 * 仕様書 §3.1 / §11.10
 *   - AdminGate で LIFF + 管理者認可チェック
 *   - ヘッダーはブランド色 + 下部は 5 タブ (ダッシュ / 予約 / 枠 / QR / 配信)
 */

import AdminGate from "@/components/AdminGate";
import AdminTabBar from "@/components/AdminTabBar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGate>
      <header className="app-header">Hoop Court 管理</header>
      <main className="app-main">{children}</main>
      <AdminTabBar />
    </AdminGate>
  );
}
