# 01. 全体構成

[← 目次に戻る](./README.md)

---

## 1. 登場するもの

| # | 名前 | 役割 | 技術 | 置き場所 |
| --- | --- | --- | --- | --- |
| 1 | **LIFF 予約アプリ** | お客様が予約する画面 | Next.js 14 (App Router) / Edge | `hoop-court` → Cloudflare Pages |
| 2 | **管理画面** | 運営が受付・入金・枠設定を行う画面 | Astro 5 + React アイランド | `himawari-site` → Cloudflare Pages |
| 3 | **バックエンド** | 業務ルールとデータアクセス | Google Apps Script (Web App) | `hoop-court/apps-script/Code.gs` |
| 4 | **データストア** | 唯一の正データ | Google スプレッドシート | 「向日葵 体育館予約 DB」 |
| 5 | **認証基盤** | お客様の本人確認 | LINE Login (LIFF) | LINE Developers |
| 6 | **通知** | 予約確定の連絡 | LINE Messaging API | 同上 |

**1 と 2 は独立したアプリで、互いを呼びません。** 共有しているのは 3 の API だけです。

---

## 2. 構成図

```
                    ┌──────────────────────────┐
   お客様            │  LIFF 予約アプリ           │
   （LINE）  ───────▶│  hoop-court.pages.dev     │──┐
                    │  Next.js / Edge Runtime   │  │
                    └──────────────────────────┘  │
                                                   │  POST /exec
                    ┌──────────────────────────┐  │  { action, payload, idToken }
   運営              │  管理画面                  │  │
   （PC）    ───────▶│  himawari-co.pages.dev/admin│─┤
                    │  Astro + React            │  │
                    └──────────────────────────┘  │
                                                   ▼
                                    ┌──────────────────────────┐
                                    │  Google Apps Script       │
                                    │  Code.gs (doPost)         │
                                    │  ─────────────────────── │
                                    │  ・認証（LINE / 管理）      │
                                    │  ・業務ルール（重複・金額）  │
                                    │  ・排他制御（LockService）  │
                                    └──────────────────────────┘
                                                   │
                                                   ▼
                                    ┌──────────────────────────┐
                                    │  スプレッドシート           │
                                    │  Courts / Users /         │
                                    │  Reservations / Slots /   │
                                    │  Admins / AdminAuth       │
                                    └──────────────────────────┘
```

---

## 3. 設計上の決めごと（なぜこうなっているか）

### 3-1. 業務ルールはすべて GAS に置く

重複判定・空き計算・金額算出を**フロントに実装しません**。

理由: クライアントが2つ（LIFF・管理画面）あり、同じ判定を二重実装すると必ず食い違います。
とくに**金額**と**重複**は、片方だけ直したときに実害（過剰請求・ダブルブッキング）が出ます。

フロント側にある `pricing.ts` は**表示用の見積もりのミラー**であり、確定金額は必ず GAS が返した
`total_amount` をそのまま使います（再計算しない）。

### 3-2. エンドポイントは1本、action で分岐

`POST /exec` に `{ action, payload, idToken }` を送る形に統一しています。

理由: GAS の Web App は `doGet` / `doPost` しか入口がなく、REST 的なパス設計ができません。
無理に URL を分けるより、1本にして action 名で分岐するほうが素直です。

### 3-3. 排他制御は LockService

予約作成と枠設定は `LockService.getScriptLock()`（20秒待機）の中で行います。
スプレッドシートには行ロックが無いため、これが唯一の同時実行対策です。

### 3-4. 認証は2系統

| 経路 | 対象 | 仕組み |
| --- | --- | --- |
| LINE IDトークン | お客様・LINE 管理者 | LIFF が発行 → GAS が LINE の verify API で検証 |
| 管理セッショントークン | 運営（PC・LINE不要） | `admin.login` が発行 → CacheService に6時間保持 |

詳細は [03-api-conventions.md](./03-api-conventions.md) §3。

---

## 4. デプロイ経路

| 対象 | 経路 | 自動/手動 |
| --- | --- | --- |
| LIFF 予約アプリ | `hoop-court` の `main` → GitHub Actions → Cloudflare Pages (`hoop-court`) | 自動 |
| 管理画面 | `himawari-site` の `main` → GitHub Actions → Cloudflare Pages (`himawari-co`) | 自動 |
| **GAS** | **リポジトリと同期しない。エディタに貼り付け → 新バージョンでデプロイ** | **手動** |

> ⚠ **GAS だけは自動デプロイされません。** `main` にマージしただけでは本番は変わりません。
> 手順は [05-operations.md](./05-operations.md) §1。

### 環境変数（ビルド時にバンドルへ埋め込まれる）

| リポジトリ | 変数 | 用途 |
| --- | --- | --- |
| hoop-court | `NEXT_PUBLIC_GAS_ENDPOINT` | GAS の `/exec` URL |
| hoop-court | `NEXT_PUBLIC_LIFF_ID` | LIFF ID |
| hoop-court | `NEXT_PUBLIC_DEMO_MODE` | `1` でローカル擬似データ。本番は `0` |
| himawari-site | `PUBLIC_GAS_ENDPOINT` | 同じ `/exec` URL |

> `NEXT_PUBLIC_*` / `PUBLIC_*` は**ビルド時に埋め込まれる**ため、変数を変えただけでは反映されません。
> 必ず再ビルド（＝再デプロイ）が要ります。

### GAS のスクリプト プロパティ（実行時に読まれる）

| キー | 必須 | 用途 |
| --- | --- | --- |
| `LINE_LOGIN_CHANNEL_ID` | ✅ | IDトークン検証（`aud` の照合） |
| `LINE_MESSAGING_TOKEN` | 推奨 | 予約確定通知・一斉配信 |
| `ADMIN_USER_IDS` | 任意 | LINE 経由の管理者許可リスト |
| `SPREADSHEET_ID` | 任意 | スタンドアロン構成のときの対象シート |

こちらは**再デプロイ不要**で反映されます（実行のたびに読まれるため）。

---

## 5. 環境

**ステージングはありません。本番のみです。**

| 環境 | URL | 備考 |
| --- | --- | --- |
| LIFF 予約アプリ | `hoop-court.pages.dev` | LINE 内、または外部ブラウザ（LINE Login 経由） |
| 管理画面 | `himawari-co.pages.dev/admin` | Basic 認証 + 管理ログインの二層 |
| ローカル | `localhost:3000` / `:4321` | `DEMO_MODE=1` なら擬似データ |

書き込み系の検証は**本番データに入ります。** テスト予約の作法は [05-operations.md](./05-operations.md) §4。
