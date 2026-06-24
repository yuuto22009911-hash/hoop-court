# 予約バックエンド（Google Apps Script）

向日葵株式会社 体育館予約 LIFF（hoop-court）の本番バックエンド。
フロント `src/lib/gas.ts` の単一エンドポイント契約に準拠し、Google スプレッドシートを
データストアとして動作する Web アプリです。料金・予約ルールは `src/lib/pricing.ts` /
`src/lib/holidays.ts` と厳密一致しています。

## 提供 API（action）

| action | 認証 | 内容 |
| --- | --- | --- |
| `courts.list` | 不要 | コート一覧 |
| `availability.range` | 不要 | 30分枠の空き（9:00–20:00） |
| `auth.me` | IDトークン | 登録状況・プロフィール |
| `auth.register` | IDトークン | プロフィール登録 |
| `reservations.create` | IDトークン | 予約作成（料金は GAS が算出） |
| `reservations.listMine` | IDトークン | 自分の予約一覧 |
| `reservations.cancel` | IDトークン | キャンセル（当面無料） |
| `admin.*` | 管理者 | 予約一覧/入金/No-Show/QR入場/枠/一斉配信/売上 |

## セットアップ手順

### 1. スプレッドシートとスクリプトを用意
- 新しい Google スプレッドシートを作成 → 拡張機能 → Apps Script。
- `Code.gs` の内容を貼り付けて保存（スタンドアロン作成時は Script Property `SPREADSHEET_ID` に対象シートIDを設定）。

### 2. シート初期化
- エディタで関数 **`setup`** を一度実行（初回は権限承認が必要）。
- `Courts / Users / Reservations / Slots / Admins` シートが作られ、`Courts` に
  「バスケコート（ハーフ1面）」が1件投入されます。

### 3. Script Properties を設定
プロジェクトの設定 → スクリプト プロパティ:

| キー | 必須 | 値 |
| --- | --- | --- |
| `LINE_LOGIN_CHANNEL_ID` | ✅ | LINE ログインチャネルの **Channel ID**（IDトークン検証用） |
| `LINE_MESSAGING_TOKEN` | 任意 | Messaging API チャネルアクセストークン（`admin.broadcast` 用） |
| `ADMIN_USER_IDS` | 任意 | 管理者の LINE userId をカンマ区切り（`Admins` シートでも可） |
| `SPREADSHEET_ID` | 任意 | スタンドアロン時の対象スプレッドシートID |

> `LINE_LOGIN_CHANNEL_ID` は、LIFF が属する **LINEログインチャネル**の Channel ID です
> （LIFF ID とは別物）。IDトークンの `aud` 検証に使います。

### 4. ウェブアプリとしてデプロイ
- デプロイ → 新しいデプロイ → 種類: **ウェブアプリ**
- 実行ユーザー: **自分**
- アクセスできるユーザー: **全員**
- デプロイ後の **`/exec` URL** を控える。

### 5. フロントに接続
GitHub → リポジトリ Settings → Secrets and variables → Actions → **Variables**:
- `NEXT_PUBLIC_GAS_ENDPOINT` = 上記 `/exec` URL
- `NEXT_PUBLIC_LIFF_ID` = LIFF ID
- `NEXT_PUBLIC_DEMO_MODE` = `0`

→ `main` へマージ（または再デプロイ）で本番反映。

## データモデル（シート列）

- **Courts**: id, facility_id, name, court_type, sides_max, capacity, is_active, created_at
- **Users**: id, line_user_id, display_name, phone, email, team_name, role, created_at, updated_at
- **Reservations**: id, display_number, user_id, court_id, mode, starts_at, ends_at, sides, purpose,
  group_name, rep_name, headcount, note, status, total_amount, payment_status, paid_at, checked_in_at,
  created_at, updated_at, canceled_at
- **Slots**（休業/占有の上書き）: court_id, starts_at, ends_at, status（OPEN/CLOSED/BLOCKED）
- **Admins**: line_user_id, note

## 料金（pricing.ts と一致・税込）

- 貸切: 平日朝(9-14) 1,210/h（延長30分 660）／平日夕(14-20) 1,500/h（延長30分 800）／土日祝 1,800/h（1時間単位）
- フリー: 平日 440 / 土日祝 550（30分・1人）。同一時間帯 最大9名。
- 当日予約はカウンターのみ（アプリは翌日以降）。キャンセルは当面無料。

> ⚠ 料金を改定する際は、本ファイル冒頭の定数とフロント `src/lib/pricing.ts` を**同時に**更新すること。

## 動作確認
- デプロイ URL に GET でアクセス → `{"ok":true,"data":{"status":"ok",...}}` が返れば起動成功。
- LIFF からログイン → プロフィール登録 → 予約作成まで通ることを確認。
