# `admin.reservations.create` 🟡

[← action 一覧](./README.md)

> 種別: **管理** ／ 実装: `adminReservationsCreate_()` → `createReservationCore_()`

カウンターに来たお客様を、管理者が代理で登録します。**LINE 未登録の方が対象**です。

## 認証

管理トークン。

## payload

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `court_id` | string | ✅ | |
| `mode` | enum | | `CHARTER`（既定） / `FREE` |
| `starts_at` | ISO8601 | ✅ | |
| `ends_at` | ISO8601 | ✅ | |
| `group_name` | string | ✅ | **必須。** 空なら `VALIDATION` |
| `purpose` | string | | |
| `rep_name` | string | | |
| `phone` | string | | 電話番号。`phone` 列に構造化して保存 |
| `headcount` | number | `FREE` で必須 | 1〜9 |
| `note` | string | | |
| `payment_method` | enum | | `CASH` / `PAYPAY` / `BANK_TRANSFER` |

## 戻り値

```json
{ "reservation_id": "…", "display_number": "R-2026-08-01-167f",
  "amount": 1800, "payment_status": "PAID" }
```

## エラー

| code | 条件 |
| --- | --- |
| `AUTH` / `FORBIDDEN` | 認証・権限 |
| `VALIDATION` | `group_name` が空、`payment_method` が不正、日時の形式不正 |
| `CONFIG` | **末尾5列が未追加**（`migrateSheets()` の実行漏れ） |
| `P0001` 〜 `P0011` | 予約ルール違反。[`reservations.create`](./reservations.create.md) と同じ |

## 書き込まれる値

| 列 | 値 | 理由 |
| --- | --- | --- |
| `user_id` | **`WALK_IN`**（固定文字列） | `Users` にゲスト行を作らないため。`listMine` は UUID 完全一致なので**会員のマイページに混入しない** |
| `source` | `manual` | LIFF 経由と区別する |
| `phone` | payload の値 | `note` に埋めず構造化（後の名寄せ用） |
| `payment_status` | `payment_method` あり → **`PAID`** / なし → `UNPAID` | |
| `paid_at` | `PAID` のとき作成時刻 | |

## LIFF 版との違い

| 項目 | LIFF 版 | この action |
| --- | --- | --- |
| 会員登録 | 必須 | **不要** |
| 過去時刻 | 拒否（`P0005`） | **許可**（受付入力は事後になりがちなため） |
| LINE 通知 | 送る | **送らない** |
| `source` | 空 | `manual` |

**重複判定・営業時間・単位・金額はすべて同じコード**（`createReservationCore_`）を通ります。

## ⚠ 運用上の注意

> **`payment_method` を指定すると、その場で「入金済み」として売上に計上されます。**
> 「支払い予定」ではなく「**受領済み**」の意味です。
> 管理画面では既定を「あとで受け取る」にし、方法を選ぶと警告を出しています。

## 呼び出し元

管理画面 `/admin/bookings` の「カウンター受付」フォーム。
