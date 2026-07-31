# 02. データモデル

[← 目次に戻る](./README.md)

Google スプレッドシート「向日葵 体育館予約 DB」が**唯一の正データ**です。

---

## 0. 全シートの読み書きルール（重要）

GAS は**ヘッダ行の名前**で列を解決します（`readTable_` / `appendRow_` / `updateRow_`）。

| やってよいこと | やってはいけないこと |
| --- | --- |
| 末尾に列を追加する | 列の並べ替え |
| 行を追加・更新する | 列の削除・改名 |
| | ヘッダ行の編集 |

> ⚠ 列を並べ替えるとコードは壊れませんが、**別の列に書き込まれる**わけではなく
> 「名前で引く」ため実害は出ません。ただし削除・改名は即座に破綻します。
> 追加した列は `appendRow_` が自動で埋めます（未指定なら空文字）。

---

## 1. Courts（コート）

| 列 | 型 | 例 | 説明 |
| --- | --- | --- | --- |
| `id` | string | `court-half` | 主キー。API の `court_id` |
| `facility_id` | string | `himawari` | 施設ID（現状1施設） |
| `name` | string | `バスケコート（ハーフ1面）` | 表示名 |
| `court_type` | enum | `HALF` | `FULL` / `HALF` / `THREE_X_THREE` |
| `sides_max` | number | `1` | 面数 |
| `capacity` | number | `9` | フリー利用の上限人数 |
| `is_active` | boolean | `true` | `false` にすると `courts.list` から消える |
| `created_at` | ISO8601 | | |

現状は `court-half` の1行のみです。

---

## 2. Users（会員）

LINE ログインしてプロフィール登録したお客様。

| 列 | 型 | 説明 |
| --- | --- | --- |
| `id` | UUID | 主キー。`Reservations.user_id` から参照される |
| `line_user_id` | string | LINE の `sub`。**ここで本人を識別する** |
| `display_name` | string | 氏名（必須） |
| `phone` | string | 電話番号（必須） |
| `email` | string | メール（必須） |
| `team_name` | string | 団体名（任意） |
| `role` | enum | 現状 `MEMBER` 固定 |
| `created_at` / `updated_at` | ISO8601 | |

> **カウンター受付（代理予約）では Users に行を作りません。** `Reservations.user_id` に
> 固定文字列 `WALK_IN` を入れます。理由は [api/admin.reservations.create.md](./api/admin.reservations.create.md)。

---

## 3. Reservations（予約）★中心テーブル

**26列。** 前半21列が初期からの列、末尾5列が 2026-08 に追加した列です。

### 3-1. 基本

| 列 | 型 | 説明 |
| --- | --- | --- |
| `id` | UUID | 主キー。QR コードに埋め込む値 |
| `display_number` | string | 予約番号 `R-YYYY-MM-DD-xxxx`（`id` の先頭4文字）。お客様提示用 |
| `user_id` | UUID \| `WALK_IN` | 会員の `Users.id`、またはカウンター受付を示す固定値 |
| `court_id` | string | `Courts.id` |
| `mode` | enum | `CHARTER`（貸切） / `FREE`（フリーゴール） |
| `starts_at` | ISO8601+09:00 | 開始日時 |
| `ends_at` | ISO8601+09:00 | 終了日時（排他: この時刻は含まない） |
| `sides` | number | 現状 `1` 固定 |

### 3-2. 内容

| 列 | 型 | 説明 |
| --- | --- | --- |
| `purpose` | string | 用途（例: 練習） |
| `group_name` | string | 団体名。**カウンター受付では必須** |
| `rep_name` | string | 代表者名（任意） |
| `headcount` | number \| "" | `FREE` のときの人数。`CHARTER` では空 |
| `note` | string | 備考 |

### 3-3. 状態

| 列 | 型 | 説明 |
| --- | --- | --- |
| `status` | enum | `CONFIRMED` / `CANCELED` / `NO_SHOW` / `COMPLETED` |
| `total_amount` | number | **確定金額（税込）。GAS が算出した値が正** |
| `payment_status` | enum | `UNPAID` / `PAID` |
| `paid_at` | ISO8601 | 入金記録時刻 |
| `checked_in_at` | ISO8601 | 受付（チェックイン）時刻 |
| `created_at` / `updated_at` / `canceled_at` | ISO8601 | |

### 3-4. 末尾5列（2026-08 追加）

| 列 | 型 | 説明 |
| --- | --- | --- |
| `source` | string | 空 = LIFF 経由 / `manual` = 管理画面のカウンター受付 |
| `payment_method` | enum | `CASH` / `PAYPAY` / `BANK_TRANSFER`。カウンター受付（`admin.reservations.create`）と入金記録（`admin.reservations.markPaid`）で指定されたときのみ。**`PAYPAY` は現在使えません**（[04-business-rules §7-A](./04-business-rules.md#7-a-paypay-が使えない理由といま何が制限されているか)） |
| `phone` | string | カウンター受付で取得した電話番号（後の名寄せ用） |
| `cancel_reason` | string | キャンセル理由 |
| `canceled_by` | string | `admin:<username>` / `line:<userId>`（**系統を前置き**） |

> ⚠ これらの列が物理的に無い状態で書き込むと、`appendRow_` は**値を黙って捨てます**。
> そのため `admin.reservations.create` / `admin.reservations.cancel` は実行前に
> 列の存在を確認し、無ければ `CONFIG` エラーで止めます。
> 追加は `migrateSheets()`（冪等）で行います → [05-operations.md](./05-operations.md) §2。

### 3-5. status の遷移

```
                    ┌──────────────┐
   予約作成 ───────▶│  CONFIRMED    │
                    └──────────────┘
                       │    │    │
        受付           │    │    │  No-Show 記録
    admin.checkin      │    │    └──────────────▶ NO_SHOW ──┐
                       ▼    │                                │
                 COMPLETED  │                                │
                       │    │  キャンセル                     │
                       │    └──────────────▶ CANCELED       │
                       │                          ▲          │
                       └──────────────────────────┴──────────┘
                         admin.reservations.cancel は
                         COMPLETED / NO_SHOW からも実行できる
```

- `COMPLETED` は**取り消せません**（`admin.checkin` に逆操作なし）
- `CANCELED` からのキャンセルは**冪等成功**（`already: true`）
- 会員自身の `reservations.cancel` は本人の予約のみ・status を問わない

---

## 4. Slots（枠の上書き）

営業時間内でも「閉じる」ための例外テーブル。**行が無い枠は OPEN 扱い**です。

| 列 | 型 | 説明 |
| --- | --- | --- |
| `court_id` | string | `Courts.id` |
| `starts_at` | ISO8601+09:00 | 期間の開始 |
| `ends_at` | ISO8601+09:00 | 期間の終了（排他） |
| `status` | enum | `OPEN` / `CLOSED`（休業） / `BLOCKED`（貸出停止） |

- `availability.range` は **`OPEN` 以外の行**に重なる枠を予約不可にします
- `admin.slots.set` は重なる行を削除し、はみ出した前後を元の status で再挿入します
- `admin.slots.bulkUpdate` は追加のみ（削除経路なし・旧 action）

---

## 5. Admins / AdminAuth（管理者）

### Admins — LINE 経由の管理者許可リスト

| 列 | 説明 |
| --- | --- |
| `line_user_id` | 管理者の LINE userId |
| `note` | メモ |

スクリプト プロパティ `ADMIN_USER_IDS`（カンマ区切り）でも同じことができます。両方が有効です。

### AdminAuth — ID/パスワード認証

| 列 | 説明 |
| --- | --- |
| `username` | ログインID |
| `salt` | ランダム16バイト（hex） |
| `hash` | `SHA-256(salt + ":" + password)` を `iterations` 回反復した hex |
| `iterations` | 反復回数（既定 1000） |
| `note` / `created_at` / `updated_at` | |

**平文パスワードはどこにも保存されません。** 設定は `setAdminLogin()` で行います。

---

## 6. ID・採番の規則

| 対象 | 規則 | 例 |
| --- | --- | --- |
| 予約の内部ID | `Utilities.getUuid()` | `9f2c...` |
| 予約番号 | `R-` + 開始日(YMD) + `-` + 内部IDの先頭4文字 | `R-2026-08-01-167f` |
| 会員ID | `Utilities.getUuid()` | |
| 管理セッション | UUID2つを連結した64桁hex | |
| 枠ID（API のみ） | `<court_id>-<開始ISO>` | `court-half-2026-08-01T10:00:00+09:00` |

> 予約番号は**内部IDの先頭4文字**しか含まないため、理論上は衝突しえます（同日16^4分の1）。
> 受付での照合は予約番号で行い、一意性が要る処理は内部IDを使ってください。
