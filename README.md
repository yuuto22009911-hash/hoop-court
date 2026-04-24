# Hoop Court — Next.js フロント

仕様書 v2.0 §3 画面仕様 / §10 技術スタック に準拠した LIFF アプリ。

## スタック

- Next.js 14 (App Router)
- TypeScript 5
- Tailwind CSS 3
- `@line/liff` 2.24+
- `qrcode` (入場 QR 生成)
- デプロイ: Cloudflare Pages + `@cloudflare/next-on-pages`

## ディレクトリ

```
src/
├─ app/
│  ├─ layout.tsx            ルート (metadata / viewport)
│  ├─ globals.css           仕様書 §2.2 ビジュアル規約
│  ├─ page.tsx              S-01 カレンダー
│  ├─ register/page.tsx     S-07 プロフィール登録
│  ├─ mypage/page.tsx       S-06 マイページ (QR / キャンセル)
│  └─ reserve/[date]/
│     ├─ page.tsx           S-02 時刻表 + S-03 利用内容入力
│     └─ confirm/page.tsx   S-04 確認 + S-05 完了
├─ components/
│  ├─ LiffGate.tsx          LIFF 初期化 + 未登録→/register 誘導
│  └─ TabBar.tsx            下部タブ (予約する / マイページ)
└─ lib/
   ├─ types.ts              共通型
   ├─ gas.ts                Apps Script クライアント + DEMO モード
   ├─ auth.ts               LIFF 初期化 + ID Token 管理
   ├─ format.ts             日時 / 金額フォーマット
   └─ qr.ts                 QR 生成
```

## セットアップ

```bash
# 1. 依存インストール
npm install

# 2. 環境変数を設定
cp .env.example .env.local
# .env.local を編集し、NEXT_PUBLIC_GAS_ENDPOINT と NEXT_PUBLIC_LIFF_ID を設定

# 3. DEMO モードで動作確認 (LINE / GAS 不要)
# .env.local の NEXT_PUBLIC_DEMO_MODE=1 のまま:
npm run dev
# http://localhost:3000 でカレンダー → 予約まで通せる (localStorage に擬似保存)

# 4. 本番ビルド
# .env.local の NEXT_PUBLIC_DEMO_MODE=0 にする
npm run build
```

## DEMO モード (仕様書 §10.5)

`NEXT_PUBLIC_DEMO_MODE=1` を設定すると、`src/lib/gas.ts` の DEMO 分岐が有効になり：

- LIFF 初期化をスキップ（ダミー user を使用）
- Apps Script への fetch をスキップし、localStorage に予約情報を保持
- 料金計算・排他・キャンセル料率判定はクライアント側で再現

キー無しで画面遷移 → 予約作成 → キャンセルまで通せるため、UI 検証に便利。

## デプロイ (仕様書 §11.6)

Cloudflare Pages + `@cloudflare/next-on-pages` を使う。

1. GitHub にリポジトリを push
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git
3. 設定:
   - Framework preset: **Next.js**
   - Build command: `npx @cloudflare/next-on-pages@1`
   - Build output directory: `.vercel/output/static`
4. 環境変数を設定:
   - `NEXT_PUBLIC_DEMO_MODE=0`
   - `NEXT_PUBLIC_GAS_ENDPOINT=<Apps Script の /exec URL>`
   - `NEXT_PUBLIC_LIFF_ID=<LIFF ID>`
5. Deploy → `*.pages.dev` の URL を LIFF の Endpoint URL に設定

## 画面遷移 (仕様書 §3.2)

```
リッチメニュー
  ↓
S-01 カレンダー (/)
  ↓ 日付タップ
S-02/S-03 (/reserve/[date])
  ↓ 金額を確認する
S-04 (/reserve/[date]/confirm)
  ↓ 予約を確定する
S-05 予約完了 (同 confirm 画面で状態変化)
  ↓ マイページで確認する
S-06 マイページ (/mypage)
```

## 実装されていないもの (MVP 以降で追加)

- 管理画面 (`/admin/*`) — A-01 ダッシュボード / 予約一覧 / 枠カレンダー / QR スキャン / 一斉配信
- 特定商取引法表記ページ
- Sentry 連携 (任意、仕様書 §9.2)

## 未設置だが今後追加したいもの

- ESLint / Prettier 設定
- ユニットテスト (Vitest + Testing Library)
- E2E テスト (Playwright)
